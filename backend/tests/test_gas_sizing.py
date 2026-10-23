"""Backend tests for Gas Pipe Sizing API (UNI 7129)."""
import pytest


# ---------- /api/ root ----------
def test_root(api_client, base_url):
    r = api_client.get(f"{base_url}/api/")
    assert r.status_code == 200
    assert "message" in r.json()


# ---------- /api/calculate validation ----------
class TestCalculateValidation:
    def test_length_zero_rejected(self, api_client, base_url):
        payload = {"gas": "metano", "material": "acciaio", "length_m": 0,
                   "fittings_pct": 0, "appliances": [{"name": "A", "power_kw": 10}]}
        r = api_client.post(f"{base_url}/api/calculate", json=payload)
        assert r.status_code == 422

    def test_length_negative_rejected(self, api_client, base_url):
        payload = {"gas": "metano", "material": "acciaio", "length_m": -5,
                   "fittings_pct": 0, "appliances": [{"name": "A", "power_kw": 10}]}
        r = api_client.post(f"{base_url}/api/calculate", json=payload)
        assert r.status_code == 422

    def test_empty_appliances_rejected(self, api_client, base_url):
        payload = {"gas": "metano", "material": "acciaio", "length_m": 10,
                   "fittings_pct": 0, "appliances": []}
        r = api_client.post(f"{base_url}/api/calculate", json=payload)
        assert r.status_code == 422

    def test_invalid_gas_rejected(self, api_client, base_url):
        payload = {"gas": "idrogeno", "material": "acciaio", "length_m": 10,
                   "fittings_pct": 0, "appliances": [{"name": "A", "power_kw": 10}]}
        r = api_client.post(f"{base_url}/api/calculate", json=payload)
        assert r.status_code == 422

    def test_invalid_material_rejected(self, api_client, base_url):
        payload = {"gas": "metano", "material": "titanio", "length_m": 10,
                   "fittings_pct": 0, "appliances": [{"name": "A", "power_kw": 10}]}
        r = api_client.post(f"{base_url}/api/calculate", json=payload)
        assert r.status_code == 422

    def test_zero_power_rejected(self, api_client, base_url):
        payload = {"gas": "metano", "material": "acciaio", "length_m": 10,
                   "fittings_pct": 0, "appliances": [{"name": "A", "power_kw": 0}]}
        r = api_client.post(f"{base_url}/api/calculate", json=payload)
        assert r.status_code == 422

    def test_fittings_out_of_range(self, api_client, base_url):
        payload = {"gas": "metano", "material": "acciaio", "length_m": 10,
                   "fittings_pct": 150, "appliances": [{"name": "A", "power_kw": 10}]}
        r = api_client.post(f"{base_url}/api/calculate", json=payload)
        assert r.status_code == 422


# ---------- /api/calculate successful ----------
class TestCalculateSuccess:
    def test_metano_acciaio_basic(self, api_client, base_url):
        payload = {"gas": "metano", "material": "acciaio", "length_m": 20,
                   "fittings_pct": 20, "appliances": [{"name": "Caldaia", "power_kw": 24},
                                                      {"name": "Piano", "power_kw": 7.5}]}
        r = api_client.post(f"{base_url}/api/calculate", json=payload)
        assert r.status_code == 200
        d = r.json()
        assert d["total_power_kw"] == 31.5
        assert d["max_drop_mbar"] == 1.0
        assert d["gas_label"].startswith("Metano")
        assert d["material_label"] == "Acciaio"
        assert d["equivalent_length_m"] == 24.0
        assert isinstance(d["options"], list) and len(d["options"]) >= 4
        # Recommended should be first option with ok=True
        if d["recommended"]:
            assert d["recommended"]["ok"] is True
            # recommended must be the smallest ok option
            ok_opts = [o for o in d["options"] if o["ok"]]
            assert d["recommended"]["nominal"] == ok_opts[0]["nominal"]

    def test_gpl_rame(self, api_client, base_url):
        payload = {"gas": "gpl", "material": "rame", "length_m": 15,
                   "fittings_pct": 10, "appliances": [{"name": "Caldaia", "power_kw": 24}]}
        r = api_client.post(f"{base_url}/api/calculate", json=payload)
        assert r.status_code == 200
        d = r.json()
        assert d["max_drop_mbar"] == 2.0
        assert d["gas_label"].startswith("GPL")
        assert d["material_label"] == "Rame"

    def test_multistrato_metano(self, api_client, base_url):
        payload = {"gas": "metano", "material": "multistrato", "length_m": 25,
                   "fittings_pct": 30, "appliances": [{"name": "Caldaia", "power_kw": 28}]}
        r = api_client.post(f"{base_url}/api/calculate", json=payload)
        assert r.status_code == 200
        d = r.json()
        assert d["material_label"] == "Multistrato"
        # Check options have required fields
        for o in d["options"]:
            assert set(o.keys()) >= {"nominal", "internal_mm", "pressure_drop_mbar", "velocity_ms", "ok"}

    def test_gpl_smaller_or_equal_diameter_vs_metano(self, api_client, base_url):
        """At same power/length, GPL (higher PCI, higher max drop) should allow equal or smaller diameter."""
        base = {"material": "acciaio", "length_m": 20, "fittings_pct": 0,
                "appliances": [{"name": "Caldaia", "power_kw": 24}]}
        r_m = api_client.post(f"{base_url}/api/calculate", json={**base, "gas": "metano"}).json()
        r_g = api_client.post(f"{base_url}/api/calculate", json={**base, "gas": "gpl"}).json()
        assert r_m["recommended"] and r_g["recommended"]
        assert r_g["recommended"]["internal_mm"] <= r_m["recommended"]["internal_mm"]


# ---------- /api/calculations CRUD ----------
class TestCalculationsCRUD:
    def test_full_crud_cycle(self, api_client, base_url):
        # Create
        payload = {
            "name": "TEST_appartamento",
            "input": {"gas": "metano", "material": "acciaio", "length_m": 12,
                      "fittings_pct": 20,
                      "appliances": [{"name": "Caldaia", "power_kw": 24}]},
        }
        r = api_client.post(f"{base_url}/api/calculations", json=payload)
        assert r.status_code == 200, r.text
        created = r.json()
        assert created["name"] == "TEST_appartamento"
        assert "id" in created and created["id"]
        assert "_id" not in created  # mongo id should not leak
        assert created["result"]["total_power_kw"] == 24.0
        cid = created["id"]

        # Get by id - verify persistence
        r = api_client.get(f"{base_url}/api/calculations/{cid}")
        assert r.status_code == 200
        got = r.json()
        assert got["id"] == cid
        assert got["name"] == "TEST_appartamento"
        # legacy payload is normalized into a single root segment
        assert got["input"]["segments"][0]["length_m"] == 12

        # List includes it
        r = api_client.get(f"{base_url}/api/calculations")
        assert r.status_code == 200
        ids = [c["id"] for c in r.json()]
        assert cid in ids

        # Delete
        r = api_client.delete(f"{base_url}/api/calculations/{cid}")
        assert r.status_code == 200
        assert r.json().get("ok") is True

        # Verify gone
        r = api_client.get(f"{base_url}/api/calculations/{cid}")
        assert r.status_code == 404

    def test_get_invalid_id(self, api_client, base_url):
        r = api_client.get(f"{base_url}/api/calculations/not-an-id")
        assert r.status_code == 404

    def test_get_missing_id(self, api_client, base_url):
        # valid ObjectId format but non-existent
        r = api_client.get(f"{base_url}/api/calculations/000000000000000000000000")
        assert r.status_code == 404

    def test_delete_invalid_id(self, api_client, base_url):
        r = api_client.delete(f"{base_url}/api/calculations/bad-id")
        assert r.status_code == 404

    def test_save_empty_name_rejected(self, api_client, base_url):
        payload = {
            "name": "",
            "input": {"gas": "metano", "material": "acciaio", "length_m": 12,
                      "fittings_pct": 0,
                      "appliances": [{"name": "Caldaia", "power_kw": 24}]},
        }
        r = api_client.post(f"{base_url}/api/calculations", json=payload)
        assert r.status_code == 422

    def test_save_invalid_input_rejected(self, api_client, base_url):
        payload = {"name": "TEST_bad", "input": {"gas": "metano", "material": "acciaio",
                   "length_m": 0, "fittings_pct": 0, "appliances": []}}
        r = api_client.post(f"{base_url}/api/calculations", json=payload)
        assert r.status_code == 422


# ---------- Cleanup any TEST_ remnants ----------
@pytest.fixture(scope="module", autouse=True)
def _cleanup(api_client=None):
    yield
    try:
        import requests
        from pathlib import Path
        from dotenv import load_dotenv
        import os
        load_dotenv(Path(__file__).resolve().parents[2] / "frontend" / ".env")
        base = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "").rstrip("/")
        if not base:
            return
        items = requests.get(f"{base}/api/calculations").json()
        for c in items:
            if c.get("name", "").startswith("TEST_"):
                requests.delete(f"{base}/api/calculations/{c['id']}")
    except Exception:
        pass
