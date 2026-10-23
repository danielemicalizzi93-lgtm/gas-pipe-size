const BASE = `${process.env.EXPO_PUBLIC_BACKEND_URL}/api`;

export type GasType = "metano" | "gpl";
export type Material = "acciaio" | "rame" | "multistrato";

export type Appliance = { name: string; power_kw: number };

export type Segment = {
  id: string;
  name: string;
  parent_id: string | null;
  length_m: number;
  appliances: Appliance[];
};

export type CalcInput = {
  gas: GasType;
  material: Material;
  fittings_pct: number;
  segments: Segment[];
};

export type SegmentResult = {
  id: string;
  name: string;
  parent_id: string | null;
  length_m: number;
  power_kw: number;
  flow_m3h: number;
  recommended: PipeOption | null;
  cumulative_drop_mbar: number | null;
};

export type SaveMeta = { name: string; client_name: string; site_address: string };

export type Profile = {
  full_name: string;
  company: string;
  address: string;
  phone: string;
  email: string;
  vat: string;
  license: string;
  has_logo?: boolean;
  logo_version?: string | null;
};

export type PipeOption = {
  nominal: string;
  internal_mm: number;
  pressure_drop_mbar: number;
  velocity_ms: number;
  ok: boolean;
};

export type CalcResult = {
  gas_label: string;
  material_label: string;
  total_power_kw: number;
  flow_m3h: number;
  equivalent_length_m: number;
  max_drop_mbar: number;
  recommended: PipeOption | null;
  options: PipeOption[];
  segments: SegmentResult[];
  max_cumulative_drop_mbar: number | null;
  ok: boolean;
};

export type Calculation = SaveMeta & {
  id: string;
  input: CalcInput;
  result: CalcResult;
  created_at: string;
  updated_at?: string | null;
};

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) throw new Error(`Errore ${res.status}`);
  return res.json();
}

export const LOGO_URL = `${BASE}/profile/logo`;
export const LOGO_UPLOAD_URL = `${BASE}/profile/logo`;

export const api = {
  calculate: (input: CalcInput) => req<CalcResult>("/calculate", { method: "POST", body: JSON.stringify(input) }),
  save: (meta: SaveMeta, input: CalcInput) =>
    req<Calculation>("/calculations", { method: "POST", body: JSON.stringify({ ...meta, input }) }),
  update: (id: string, meta: SaveMeta, input: CalcInput) =>
    req<Calculation>(`/calculations/${id}`, { method: "PUT", body: JSON.stringify({ ...meta, input }) }),
  list: () => req<Calculation[]>("/calculations"),
  get: (id: string) => req<Calculation>(`/calculations/${id}`),
  remove: (id: string) => req<{ ok: boolean }>(`/calculations/${id}`, { method: "DELETE" }),
  profile: () => req<Profile>("/profile"),
  saveProfile: (p: Profile) => req<Profile>("/profile", { method: "PUT", body: JSON.stringify(p) }),
  removeLogo: () => req<Profile>("/profile/logo", { method: "DELETE" }),
  logoData: () => req<{ data_uri: string }>("/profile/logo-data"),
};

export const GAS_LABELS: Record<GasType, string> = { metano: "Metano", gpl: "GPL" };
export const MATERIAL_LABELS: Record<Material, string> = { acciaio: "Acciaio", rame: "Rame", multistrato: "Multistrato" };
