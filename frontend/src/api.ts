const BASE = `${process.env.EXPO_PUBLIC_BACKEND_URL}/api`;

export type GasType = "metano" | "gpl";
export type Material = "acciaio" | "rame" | "multistrato";

export type Appliance = { name: string; power_kw: number };

export type CalcInput = {
  gas: GasType;
  material: Material;
  length_m: number;
  fittings_pct: number;
  appliances: Appliance[];
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
};

export type Calculation = {
  id: string;
  name: string;
  input: CalcInput;
  result: CalcResult;
  created_at: string;
};

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) throw new Error(`Errore ${res.status}`);
  return res.json();
}

export const api = {
  calculate: (input: CalcInput) => req<CalcResult>("/calculate", { method: "POST", body: JSON.stringify(input) }),
  save: (name: string, input: CalcInput) =>
    req<Calculation>("/calculations", { method: "POST", body: JSON.stringify({ name, input }) }),
  list: () => req<Calculation[]>("/calculations"),
  get: (id: string) => req<Calculation>(`/calculations/${id}`),
  remove: (id: string) => req<{ ok: boolean }>(`/calculations/${id}`, { method: "DELETE" }),
};

export const GAS_LABELS: Record<GasType, string> = { metano: "Metano", gpl: "GPL" };
export const MATERIAL_LABELS: Record<Material, string> = { acciaio: "Acciaio", rame: "Rame", multistrato: "Multistrato" };
