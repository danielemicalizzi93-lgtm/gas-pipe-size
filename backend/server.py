from fastapi import FastAPI, APIRouter, HTTPException, UploadFile, File, Response
from fastapi.concurrency import run_in_threadpool
from pydantic import model_validator
import base64
import uuid
import requests
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId
import os
import math
import logging
from pathlib import Path
from pydantic import BaseModel, Field, BeforeValidator, ConfigDict
from typing import List, Optional, Literal, Annotated
from datetime import datetime, timezone


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI()


@app.get("/health", include_in_schema=False)
@app.head("/health", include_in_schema=False)
async def health():
    return {"status": "ok"}


api_router = APIRouter(prefix="/api")

PyObjectId = Annotated[str, BeforeValidator(lambda v: str(v) if isinstance(v, ObjectId) else v)]


class BaseDocument(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    id: Optional[PyObjectId] = Field(default=None, alias="_id")

    def to_mongo(self) -> dict:
        data = self.model_dump(by_alias=True, exclude={"id"})
        return data

    @classmethod
    def from_mongo(cls, doc: dict):
        return cls.model_validate(doc)


# ---------------------------------------------------------------------------
# Technical data (UNI 7129 - low pressure domestic installations)
# ---------------------------------------------------------------------------
GASES = {
    # PCI in kWh/m3 (standard conditions), relative density to air, max drop mbar
    "metano": {"label": "Metano (G20)", "pci": 9.45, "density": 0.60, "max_drop": 1.0},
    "gpl": {"label": "GPL (G31)", "pci": 25.9, "density": 1.56, "max_drop": 2.0},
}

# (nominal label, internal diameter mm)
PIPES = {
    "acciaio": [
        ('1/2"', 16.1), ('3/4"', 21.7), ('1"', 27.3), ('1 1/4"', 36.0),
        ('1 1/2"', 41.9), ('2"', 53.1), ('2 1/2"', 68.9), ('3"', 80.9),
    ],
    "rame": [
        ("12x1", 10.0), ("14x1", 12.0), ("16x1", 14.0), ("18x1", 16.0),
        ("22x1", 20.0), ("28x1", 26.0), ("35x1.5", 32.0), ("42x1.5", 39.0),
        ("54x2", 50.0),
    ],
    "multistrato": [
        ("16x2", 12.0), ("20x2", 16.0), ("26x3", 20.0), ("32x3", 26.0),
        ("40x3.5", 33.0), ("50x4", 42.0), ("63x4.5", 54.0),
    ],
}
MATERIAL_LABELS = {"acciaio": "Acciaio", "rame": "Rame", "multistrato": "Multistrato"}


class Appliance(BaseModel):
    name: str = Field(min_length=1, max_length=60)
    power_kw: float = Field(gt=0, le=1000)


class Segment(BaseModel):
    id: str = Field(min_length=1, max_length=40)
    name: str = Field(min_length=1, max_length=60)
    parent_id: Optional[str] = None
    length_m: float = Field(gt=0, le=500)
    appliances: List[Appliance] = Field(default_factory=list)


class CalcInput(BaseModel):
    gas: Literal["metano", "gpl"]
    material: Literal["acciaio", "rame", "multistrato"]
    fittings_pct: float = Field(default=0, ge=0, le=100)
    segments: List[Segment] = Field(min_length=1, max_length=50)

    @model_validator(mode="before")
    @classmethod
    def legacy_single(cls, data):
        # Legacy single-pipe payload {length_m, appliances} -> one segment
        if isinstance(data, dict) and "segments" not in data and "length_m" in data:
            data = {**data, "segments": [{
                "id": "s1", "name": "Tratto 1", "parent_id": None,
                "length_m": data.get("length_m"), "appliances": data.get("appliances", []),
            }]}
        return data

    @model_validator(mode="after")
    def check_tree(self):
        ids = [s.id for s in self.segments]
        if len(set(ids)) != len(ids):
            raise ValueError("ID tratti duplicati")
        by_id = {s.id: s for s in self.segments}
        roots = [s for s in self.segments if s.parent_id is None]
        if len(roots) != 1:
            raise ValueError("Serve esattamente un tratto collegato al contatore")
        for s in self.segments:
            seen = set()
            cur = s
            while cur.parent_id is not None:
                if cur.parent_id not in by_id:
                    raise ValueError(f"Tratto padre inesistente per '{s.name}'")
                if cur.id in seen:
                    raise ValueError("Rete non valida (ciclo)")
                seen.add(cur.id)
                cur = by_id[cur.parent_id]
        if not any(a for s in self.segments for a in s.appliances):
            raise ValueError("Aggiungi almeno un apparecchio")
        return self


class PipeOption(BaseModel):
    nominal: str
    internal_mm: float
    pressure_drop_mbar: float
    velocity_ms: float
    ok: bool


class SegmentResult(BaseModel):
    id: str
    name: str
    parent_id: Optional[str]
    length_m: float
    power_kw: float
    flow_m3h: float
    recommended: Optional[PipeOption]
    cumulative_drop_mbar: Optional[float]


class CalcResult(BaseModel):
    gas_label: str
    material_label: str
    total_power_kw: float
    flow_m3h: float
    equivalent_length_m: float  # design length: longest path meter -> farthest appliance (+fittings)
    max_drop_mbar: float
    recommended: Optional[PipeOption]  # first (root) segment
    options: List[PipeOption]  # verification of root segment
    segments: List[SegmentResult]
    max_cumulative_drop_mbar: Optional[float]
    ok: bool


def renouard_drop(density: float, length_m: float, flow_m3h: float, d_mm: float) -> float:
    # Renouard linear formula (low pressure), basis of UNI 7129 tables:
    # dp[mbar] = 23200 * d * L * Q^1.82 * D^-4.82
    return 23200 * density * length_m * flow_m3h ** 1.82 * d_mm ** -4.82


def size_options(gas: dict, material: str, length_m: float, flow: float) -> List[PipeOption]:
    options = []
    for nominal, d in PIPES[material]:
        dp = renouard_drop(gas["density"], length_m, flow, d)
        area = math.pi * (d / 1000) ** 2 / 4
        v = (flow / 3600) / area
        options.append(PipeOption(
            nominal=nominal, internal_mm=d,
            pressure_drop_mbar=round(dp, 3), velocity_ms=round(v, 2),
            ok=dp <= gas["max_drop"],
        ))
    return options


def calculate(inp: CalcInput) -> CalcResult:
    """UNI 7129 table method: each segment is sized with its own flow and the
    total length from the meter to the farthest appliance, so the cumulative
    drop along any path stays within the allowed maximum."""
    gas = GASES[inp.gas]
    k = 1 + inp.fittings_pct / 100
    by_id = {s.id: s for s in inp.segments}
    children: dict = {s.id: [] for s in inp.segments}
    for s in inp.segments:
        if s.parent_id:
            children[s.parent_id].append(s.id)

    def subtree_kw(sid: str) -> float:
        return sum(a.power_kw for a in by_id[sid].appliances) + sum(subtree_kw(c) for c in children[sid])

    def path_len(sid: str) -> float:
        s = by_id[sid]
        return s.length_m + (path_len(s.parent_id) if s.parent_id else 0)

    design_len = max(path_len(s.id) for s in inp.segments) * k
    root = next(s for s in inp.segments if s.parent_id is None)
    total_kw = subtree_kw(root.id)

    seg_results: dict = {}
    for s in inp.segments:
        kw = subtree_kw(s.id)
        flow = kw / gas["pci"]
        rec = None
        if flow > 0:
            design = next((o for o in size_options(gas, inp.material, design_len, flow) if o.ok), None)
            if design:
                actual = renouard_drop(gas["density"], s.length_m * k, flow, design.internal_mm)
                rec = design.model_copy(update={"pressure_drop_mbar": round(actual, 3)})
        seg_results[s.id] = SegmentResult(
            id=s.id, name=s.name, parent_id=s.parent_id, length_m=s.length_m,
            power_kw=round(kw, 2), flow_m3h=round(flow, 3), recommended=rec, cumulative_drop_mbar=None,
        )

    ok = all(r.recommended is not None for r in seg_results.values() if r.flow_m3h > 0)

    def cum(sid: str) -> Optional[float]:
        r = seg_results[sid]
        if r.recommended is None:
            return None if r.flow_m3h > 0 else 0.0
        prev = cum(r.parent_id) if r.parent_id else 0.0
        return None if prev is None else prev + r.recommended.pressure_drop_mbar

    for sid, r in seg_results.items():
        c = cum(sid)
        r.cumulative_drop_mbar = round(c, 3) if c is not None else None
    cums = [r.cumulative_drop_mbar for r in seg_results.values() if r.cumulative_drop_mbar is not None]

    root_flow = total_kw / gas["pci"]
    return CalcResult(
        gas_label=gas["label"], material_label=MATERIAL_LABELS[inp.material],
        total_power_kw=round(total_kw, 2), flow_m3h=round(root_flow, 3),
        equivalent_length_m=round(design_len, 2), max_drop_mbar=gas["max_drop"],
        recommended=seg_results[root.id].recommended,
        options=size_options(gas, inp.material, design_len, root_flow),
        segments=[seg_results[s.id] for s in inp.segments],
        max_cumulative_drop_mbar=round(max(cums), 3) if ok and cums else None,
        ok=ok,
    )


class Calculation(BaseDocument):
    name: str
    client_name: str = ""
    site_address: str = ""
    input: CalcInput
    result: CalcResult
    created_at: str
    updated_at: Optional[str] = None

    @classmethod
    def from_mongo(cls, doc: dict):
        # Always recompute the result so stored docs follow the current calc logic
        inp = CalcInput.model_validate(doc["input"])
        return cls.model_validate({**{k: v for k, v in doc.items() if k != "result"}, "result": calculate(inp)})


class SaveRequest(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    client_name: str = Field(default="", max_length=100)
    site_address: str = Field(default="", max_length=200)
    input: CalcInput


class Profile(BaseModel):
    full_name: str = Field(default="", max_length=100)
    company: str = Field(default="", max_length=100)
    address: str = Field(default="", max_length=200)
    phone: str = Field(default="", max_length=40)
    email: str = Field(default="", max_length=100)
    vat: str = Field(default="", max_length=40)
    license: str = Field(default="", max_length=100)


class ProfileOut(Profile):
    has_logo: bool = False
    logo_version: Optional[str] = None


# ---------------------------------------------------------------------------
# Object storage (logo)
# ---------------------------------------------------------------------------
STORAGE_BASE = (os.environ.get("INTEGRATION_PROXY_URL") or "").strip() or "https://integrations.emergentagent.com"
STORAGE_URL = STORAGE_BASE.rstrip("/") + "/objstore/api/v1/storage"
EMERGENT_KEY = os.environ.get("EMERGENT_LLM_KEY")
APP_NAME = "gascalc-pro"
storage_key = None


def init_storage():
    global storage_key
    if storage_key:
        return storage_key
    resp = requests.post(f"{STORAGE_URL}/init", json={"emergent_key": EMERGENT_KEY}, timeout=30)
    resp.raise_for_status()
    storage_key = resp.json()["storage_key"]
    return storage_key


def put_object(path: str, data: bytes, content_type: str) -> dict:
    key = init_storage()
    resp = requests.put(f"{STORAGE_URL}/objects/{path}",
                        headers={"X-Storage-Key": key, "Content-Type": content_type}, data=data, timeout=120)
    resp.raise_for_status()
    return resp.json()


def get_object(path: str) -> tuple:
    key = init_storage()
    resp = requests.get(f"{STORAGE_URL}/objects/{path}", headers={"X-Storage-Key": key}, timeout=60)
    resp.raise_for_status()
    return resp.content, resp.headers.get("Content-Type", "application/octet-stream")


PROFILE_ID = "installer"
_logo_cache: dict = {}


async def _load_logo():
    doc = await db.profile.find_one({"_id": PROFILE_ID})
    if not doc or not doc.get("logo_path"):
        raise HTTPException(404, "Nessun logo")
    path = doc["logo_path"]
    if path not in _logo_cache:
        try:
            _logo_cache[path] = await run_in_threadpool(get_object, path)
        except requests.RequestException:
            raise HTTPException(502, "Logo non disponibile")
    return _logo_cache[path]


@api_router.get("/")
async def root():
    return {"message": "Gas pipe sizing API"}


@api_router.post("/calculate", response_model=CalcResult)
async def calculate_endpoint(inp: CalcInput):
    return calculate(inp)


@api_router.post("/calculations", response_model=Calculation, response_model_by_alias=False)
async def save_calculation(req: SaveRequest):
    calc = Calculation(
        name=req.name.strip(), client_name=req.client_name.strip(), site_address=req.site_address.strip(),
        input=req.input, result=calculate(req.input),
        created_at=datetime.now(timezone.utc).isoformat(),
    )
    res = await db.calculations.insert_one(calc.to_mongo())
    calc.id = str(res.inserted_id)
    return calc


@api_router.put("/calculations/{cid}", response_model=Calculation, response_model_by_alias=False)
async def update_calculation(cid: str, req: SaveRequest):
    upd = {
        "name": req.name.strip(), "client_name": req.client_name.strip(), "site_address": req.site_address.strip(),
        "input": req.input.model_dump(), "result": calculate(req.input).model_dump(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    res = await db.calculations.update_one({"_id": _oid(cid)}, {"$set": upd})
    if res.matched_count == 0:
        raise HTTPException(404, "Calcolo non trovato")
    return Calculation.from_mongo(await db.calculations.find_one({"_id": _oid(cid)}))


@api_router.get("/profile", response_model=ProfileOut)
async def get_profile():
    doc = await db.profile.find_one({"_id": PROFILE_ID}) or {}
    return ProfileOut(
        **Profile.model_validate({k: v for k, v in doc.items() if k in Profile.model_fields}).model_dump(),
        has_logo=bool(doc.get("logo_path")), logo_version=doc.get("logo_version"),
    )


@api_router.put("/profile", response_model=ProfileOut)
async def update_profile(p: Profile):
    data = {k: v.strip() for k, v in p.model_dump().items()}
    await db.profile.update_one({"_id": PROFILE_ID}, {"$set": data}, upsert=True)
    return await get_profile()


ALLOWED_IMG = {"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp"}


@api_router.post("/profile/logo", response_model=ProfileOut)
async def upload_logo(file: UploadFile = File(...)):
    ctype = file.content_type or ""
    if ctype not in ALLOWED_IMG:
        raise HTTPException(400, "Formato non supportato (usa JPG, PNG o WEBP)")
    data = await file.read()
    if len(data) > 3 * 1024 * 1024:
        raise HTTPException(400, "Immagine troppo grande (max 3 MB)")
    path = f"{APP_NAME}/uploads/{PROFILE_ID}/{uuid.uuid4()}.{ALLOWED_IMG[ctype]}"
    try:
        result = await run_in_threadpool(put_object, path, data, ctype)
    except requests.HTTPError as e:
        code = e.response.status_code if e.response is not None else 500
        raise HTTPException(402 if code == 402 else 502, "Caricamento logo non riuscito")
    _logo_cache[result["path"]] = (data, ctype)
    await db.profile.update_one(
        {"_id": PROFILE_ID},
        {"$set": {"logo_path": result["path"], "logo_version": uuid.uuid4().hex[:8]}},
        upsert=True,
    )
    return await get_profile()


@api_router.delete("/profile/logo", response_model=ProfileOut)
async def remove_logo():
    await db.profile.update_one({"_id": PROFILE_ID}, {"$unset": {"logo_path": "", "logo_version": ""}})
    return await get_profile()


@api_router.get("/profile/logo")
async def get_logo():
    data, ctype = await _load_logo()
    return Response(content=data, media_type=ctype, headers={"Cache-Control": "public, max-age=86400"})


@api_router.get("/profile/logo-data")
async def get_logo_data():
    data, ctype = await _load_logo()
    return {"data_uri": f"data:{ctype};base64,{base64.b64encode(data).decode()}"}


@api_router.get("/calculations", response_model=List[Calculation], response_model_by_alias=False)
async def list_calculations():
    docs = await db.calculations.find().sort("created_at", -1).to_list(500)
    return [Calculation.from_mongo(d) for d in docs]


def _oid(cid: str) -> ObjectId:
    if not ObjectId.is_valid(cid):
        raise HTTPException(404, "Calcolo non trovato")
    return ObjectId(cid)


@api_router.get("/calculations/{cid}", response_model=Calculation, response_model_by_alias=False)
async def get_calculation(cid: str):
    doc = await db.calculations.find_one({"_id": _oid(cid)})
    if not doc:
        raise HTTPException(404, "Calcolo non trovato")
    return Calculation.from_mongo(doc)


@api_router.delete("/calculations/{cid}")
async def delete_calculation(cid: str):
    res = await db.calculations.delete_one({"_id": _oid(cid)})
    if res.deleted_count == 0:
        raise HTTPException(404, "Calcolo non trovato")
    return {"ok": True}


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')


@app.on_event("startup")
async def startup_storage():
    try:
        await run_in_threadpool(init_storage)
    except Exception as e:
        logging.getLogger(__name__).error(f"Storage init failed: {e}")


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
