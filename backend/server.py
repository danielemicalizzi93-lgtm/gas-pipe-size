from fastapi import FastAPI, APIRouter, HTTPException
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


class CalcInput(BaseModel):
    gas: Literal["metano", "gpl"]
    material: Literal["acciaio", "rame", "multistrato"]
    length_m: float = Field(gt=0, le=500)
    fittings_pct: float = Field(default=0, ge=0, le=100)
    appliances: List[Appliance] = Field(min_length=1)


class PipeOption(BaseModel):
    nominal: str
    internal_mm: float
    pressure_drop_mbar: float
    velocity_ms: float
    ok: bool


class CalcResult(BaseModel):
    gas_label: str
    material_label: str
    total_power_kw: float
    flow_m3h: float
    equivalent_length_m: float
    max_drop_mbar: float
    recommended: Optional[PipeOption]
    options: List[PipeOption]


def renouard_drop(density: float, length_m: float, flow_m3h: float, d_mm: float) -> float:
    # Renouard linear formula (low pressure), basis of UNI 7129 tables:
    # dp[mbar] = 23200 * d * L * Q^1.82 * D^-4.82
    return 23200 * density * length_m * flow_m3h ** 1.82 * d_mm ** -4.82


def calculate(inp: CalcInput) -> CalcResult:
    gas = GASES[inp.gas]
    total_kw = sum(a.power_kw for a in inp.appliances)
    flow = total_kw / gas["pci"]
    eq_len = inp.length_m * (1 + inp.fittings_pct / 100)
    options = []
    for nominal, d in PIPES[inp.material]:
        dp = renouard_drop(gas["density"], eq_len, flow, d)
        area = math.pi * (d / 1000) ** 2 / 4
        v = (flow / 3600) / area
        options.append(PipeOption(
            nominal=nominal, internal_mm=d,
            pressure_drop_mbar=round(dp, 3), velocity_ms=round(v, 2),
            ok=dp <= gas["max_drop"],
        ))
    recommended = next((o for o in options if o.ok), None)
    return CalcResult(
        gas_label=gas["label"], material_label=MATERIAL_LABELS[inp.material],
        total_power_kw=round(total_kw, 2), flow_m3h=round(flow, 3),
        equivalent_length_m=round(eq_len, 2), max_drop_mbar=gas["max_drop"],
        recommended=recommended, options=options,
    )


class Calculation(BaseDocument):
    name: str
    input: CalcInput
    result: CalcResult
    created_at: str


class SaveRequest(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    input: CalcInput


@api_router.get("/")
async def root():
    return {"message": "Gas pipe sizing API"}


@api_router.post("/calculate", response_model=CalcResult)
async def calculate_endpoint(inp: CalcInput):
    return calculate(inp)


@api_router.post("/calculations", response_model=Calculation, response_model_by_alias=False)
async def save_calculation(req: SaveRequest):
    calc = Calculation(
        name=req.name.strip(), input=req.input, result=calculate(req.input),
        created_at=datetime.now(timezone.utc).isoformat(),
    )
    res = await db.calculations.insert_one(calc.to_mongo())
    calc.id = str(res.inserted_id)
    return calc


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


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
