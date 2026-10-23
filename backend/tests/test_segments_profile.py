# Iteration 2: multi-segment network calc, calculations CRUD with client/address + PUT, installer profile + logo
import io
import pytest
import requests
from PIL import Image


def seg(id, parent=None, length=5, apps=None, name=None):
    return {"id": id, "name": name or f"T_{id}", "parent_id": parent, "length_m": length,
            "appliances": apps if apps is not None else []}


BOILER = {"name": "Caldaia", "power_kw": 24}
HOB = {"name": "Piano cottura", "power_kw": 8}


def network():
    return {"gas": "metano", "material": "acciaio", "fittings_pct": 10, "segments": [
        seg("root", None, 6, [], "Contatore"),
        seg("b1", "root", 4, [BOILER]),
        seg("b2", "root", 8, [HOB]),
    ]}


# --- Tree validation (/api/calculate) ---
class TestTreeValidation:
    def _post(self, api_client, base_url, segs):
        return api_client.post(f"{base_url}/api/calculate",
                               json={"gas": "metano", "material": "acciaio", "segments": segs})

    def test_two_roots(self, api_client, base_url):
        r = self._post(api_client, base_url, [seg("a", None, 5, [BOILER]), seg("b", None, 5, [HOB])])
        assert r.status_code == 422

    def test_no_root(self, api_client, base_url):
        r = self._post(api_client, base_url, [seg("a", "b", 5, [BOILER]), seg("b", "a", 5, [HOB])])
        assert r.status_code == 422

    def test_missing_parent(self, api_client, base_url):
        r = self._post(api_client, base_url, [seg("a", None, 5, [BOILER]), seg("b", "zzz", 5, [HOB])])
        assert r.status_code == 422

    def test_cycle_detached(self, api_client, base_url):
        r = self._post(api_client, base_url, [seg("a", None, 5, [BOILER]), seg("b", "c", 5), seg("c", "b", 5)])
        assert r.status_code == 422

    def test_self_parent(self, api_client, base_url):
        r = self._post(api_client, base_url, [seg("a", None, 5, [BOILER]), seg("b", "b", 5)])
        assert r.status_code == 422

    def test_no_appliances(self, api_client, base_url):
        r = self._post(api_client, base_url, [seg("a", None, 5), seg("b", "a", 5)])
        assert r.status_code == 422

    def test_duplicate_ids(self, api_client, base_url):
        r = self._post(api_client, base_url, [seg("a", None, 5, [BOILER]), seg("a", None, 5)])
        assert r.status_code == 422

    def test_zero_segment_length(self, api_client, base_url):
        r = self._post(api_client, base_url, [seg("a", None, 5, [BOILER]), seg("b", "a", 0, [HOB])])
        assert r.status_code == 422

    def test_empty_segments(self, api_client, base_url):
        r = self._post(api_client, base_url, [])
        assert r.status_code == 422


# --- Multi-segment results ---
class TestNetworkCalc:
    def test_network_result(self, api_client, base_url):
        r = api_client.post(f"{base_url}/api/calculate", json=network())
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["ok"] is True
        assert d["total_power_kw"] == 32
        assert len(d["segments"]) == 3
        by = {s["id"]: s for s in d["segments"]}
        assert by["root"]["power_kw"] == 32
        assert by["b1"]["power_kw"] == 24 and by["b2"]["power_kw"] == 8
        # design length = longest path (6+8) * 1.1
        assert abs(d["equivalent_length_m"] - 15.4) < 0.01
        assert d["max_cumulative_drop_mbar"] is not None
        assert d["max_cumulative_drop_mbar"] <= d["max_drop_mbar"]
        for s in d["segments"]:
            assert s["recommended"] is not None
            assert s["cumulative_drop_mbar"] <= d["max_drop_mbar"]
        # cumulative = parent + own
        assert abs(by["b1"]["cumulative_drop_mbar"] - (by["root"]["cumulative_drop_mbar"]
                   + by["b1"]["recommended"]["pressure_drop_mbar"])) < 0.01
        # root diameter >= branch diameter
        assert by["root"]["recommended"]["internal_mm"] >= by["b2"]["recommended"]["internal_mm"]

    def test_legacy_payload(self, api_client, base_url):
        r = api_client.post(f"{base_url}/api/calculate", json={
            "gas": "gpl", "material": "rame", "fittings_pct": 0, "length_m": 10, "appliances": [BOILER]})
        assert r.status_code == 200, r.text
        d = r.json()
        assert len(d["segments"]) == 1 and d["segments"][0]["length_m"] == 10
        assert d["ok"] is True and d["recommended"] is not None

    def test_not_ok_huge_load(self, api_client, base_url):
        payload = {"gas": "metano", "material": "rame", "segments": [
            seg("r", None, 400, [{"name": "Big", "power_kw": 1000}])]}
        r = api_client.post(f"{base_url}/api/calculate", json=payload)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["ok"] is False and d["max_cumulative_drop_mbar"] is None


# --- Calculations CRUD with client/address + PUT ---
class TestCalculationsCRUD2:
    def test_crud(self, api_client, base_url):
        body = {"name": "TEST_rete", "client_name": "TEST_Rossi", "site_address": "Via Roma 1", "input": network()}
        r = api_client.post(f"{base_url}/api/calculations", json=body)
        assert r.status_code == 200, r.text
        c = r.json()
        cid = c["id"]
        assert c["client_name"] == "TEST_Rossi" and c["site_address"] == "Via Roma 1"
        assert len(c["result"]["segments"]) == 3
        try:
            g = api_client.get(f"{base_url}/api/calculations/{cid}").json()
            assert g["name"] == "TEST_rete" and g["input"]["segments"][1]["parent_id"] == "root"
            lst = api_client.get(f"{base_url}/api/calculations").json()
            assert any(x["id"] == cid for x in lst)
            # update
            body2 = {**body, "name": "TEST_rete_upd", "client_name": "TEST_Bianchi",
                     "input": {**network(), "gas": "gpl"}}
            u = api_client.put(f"{base_url}/api/calculations/{cid}", json=body2)
            assert u.status_code == 200, u.text
            ud = u.json()
            assert ud["id"] == cid and ud["name"] == "TEST_rete_upd" and ud["updated_at"]
            assert ud["result"]["gas_label"].lower().startswith("gpl")
            g2 = api_client.get(f"{base_url}/api/calculations/{cid}").json()
            assert g2["client_name"] == "TEST_Bianchi" and g2["input"]["gas"] == "gpl"
        finally:
            d = api_client.delete(f"{base_url}/api/calculations/{cid}")
            assert d.status_code == 200
        assert api_client.get(f"{base_url}/api/calculations/{cid}").status_code == 404

    def test_put_missing(self, api_client, base_url):
        body = {"name": "TEST_x", "input": network()}
        assert api_client.put(f"{base_url}/api/calculations/aaaaaaaaaaaaaaaaaaaaaaaa", json=body).status_code == 404
        assert api_client.put(f"{base_url}/api/calculations/bad-id", json=body).status_code == 404

    def test_put_invalid_tree(self, api_client, base_url):
        body = {"name": "TEST_x", "input": {"gas": "metano", "material": "acciaio",
                                             "segments": [seg("a", None, 5), seg("b", None, 5)]}}
        assert api_client.put(f"{base_url}/api/calculations/aaaaaaaaaaaaaaaaaaaaaaaa", json=body).status_code == 422


# --- Profile + logo ---
def _png(size=(64, 64)):
    buf = io.BytesIO()
    Image.new("RGB", size, (200, 30, 30)).save(buf, "PNG")
    return buf.getvalue()


class TestProfile:
    def test_profile_put_get(self, api_client, base_url):
        orig = api_client.get(f"{base_url}/api/profile").json()
        data = {"full_name": "TEST_Mario", "company": "TEST_Gas Srl", "address": "Via X", "phone": "123",
                "email": "a@b.it", "vat": "IT123", "license": "DM37"}
        r = api_client.put(f"{base_url}/api/profile", json={k: f"  {v} " for k, v in data.items()})
        assert r.status_code == 200, r.text
        assert r.json()["company"] == "TEST_Gas Srl"  # stripped
        g = api_client.get(f"{base_url}/api/profile").json()
        for k, v in data.items():
            assert g[k] == v
        assert "has_logo" in g
        # restore
        api_client.put(f"{base_url}/api/profile", json={k: orig.get(k, "") for k in data})

    def test_profile_too_long(self, api_client, base_url):
        r = api_client.put(f"{base_url}/api/profile", json={"phone": "1" * 41})
        assert r.status_code == 422

    def test_logo_bad_type(self, base_url):
        r = requests.post(f"{base_url}/api/profile/logo", files={"file": ("a.txt", b"hello", "text/plain")})
        assert r.status_code == 400

    def test_logo_too_big(self, base_url):
        r = requests.post(f"{base_url}/api/profile/logo",
                          files={"file": ("a.png", b"\x89PNG" + b"0" * (3 * 1024 * 1024 + 10), "image/png")})
        assert r.status_code == 400

    def test_logo_lifecycle(self, base_url):
        png = _png()
        r = requests.post(f"{base_url}/api/profile/logo", files={"file": ("logo.png", png, "image/png")}, timeout=120)
        assert r.status_code == 200, r.text
        assert r.json()["has_logo"] is True and r.json()["logo_version"]
        try:
            g = requests.get(f"{base_url}/api/profile/logo", timeout=60)
            assert g.status_code == 200 and g.headers["content-type"].startswith("image/png")
            assert g.content == png
            dd = requests.get(f"{base_url}/api/profile/logo-data", timeout=60).json()
            assert dd["data_uri"].startswith("data:image/png;base64,")
        finally:
            d = requests.delete(f"{base_url}/api/profile/logo")
            assert d.status_code == 200 and d.json()["has_logo"] is False
        assert requests.get(f"{base_url}/api/profile/logo").status_code == 404
        assert requests.get(f"{base_url}/api/profile/logo-data").status_code == 404
