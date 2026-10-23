import { create } from "zustand";

import type { Appliance, CalcInput, Calculation, GasType, Material, SaveMeta } from "@/src/api";

export type SegmentDraft = {
  id: string;
  name: string;
  parent_id: string | null;
  length: string;
  appliances: Appliance[];
};

const newId = () => Math.random().toString(36).slice(2, 10);

const firstSegment = (): SegmentDraft => ({ id: newId(), name: "Tratto 1", parent_id: null, length: "", appliances: [] });

type DraftState = {
  gas: GasType;
  material: Material;
  fittings: number;
  segments: SegmentDraft[];
  editingId: string | null;
  meta: SaveMeta;
  setGas: (g: GasType) => void;
  setMaterial: (m: Material) => void;
  setFittings: (f: number) => void;
  addSegment: () => void;
  updateSegment: (id: string, patch: Partial<SegmentDraft>) => void;
  removeSegment: (id: string) => void;
  addAppliance: (segId: string, a: Appliance) => void;
  removeAppliance: (segId: string, index: number) => void;
  setMeta: (m: Partial<SaveMeta>) => void;
  setEditingId: (id: string | null) => void;
  loadCalculation: (c: Calculation, mode: "edit" | "duplicate") => void;
  reset: () => void;
};

const initial = () => ({
  gas: "metano" as GasType,
  material: "acciaio" as Material,
  fittings: 0,
  segments: [firstSegment()],
  editingId: null,
  meta: { name: "", client_name: "", site_address: "" },
});

export const useDraft = create<DraftState>((set) => ({
  ...initial(),
  setGas: (gas) => set({ gas }),
  setMaterial: (material) => set({ material }),
  setFittings: (fittings) => set({ fittings }),
  addSegment: () =>
    set((s) => ({
      segments: [
        ...s.segments,
        {
          id: newId(),
          name: `Tratto ${s.segments.length + 1}`,
          parent_id: s.segments[s.segments.length - 1].id,
          length: "",
          appliances: [],
        },
      ],
    })),
  updateSegment: (id, patch) =>
    set((s) => ({ segments: s.segments.map((x) => (x.id === id ? { ...x, ...patch } : x)) })),
  removeSegment: (id) =>
    set((s) => {
      const removed = s.segments.find((x) => x.id === id);
      if (!removed || removed.parent_id === null) return s;
      return {
        segments: s.segments
          .filter((x) => x.id !== id)
          .map((x) => (x.parent_id === id ? { ...x, parent_id: removed.parent_id } : x)),
      };
    }),
  addAppliance: (segId, a) =>
    set((s) => ({
      segments: s.segments.map((x) => (x.id === segId ? { ...x, appliances: [...x.appliances, a] } : x)),
    })),
  removeAppliance: (segId, index) =>
    set((s) => ({
      segments: s.segments.map((x) =>
        x.id === segId ? { ...x, appliances: x.appliances.filter((_, i) => i !== index) } : x,
      ),
    })),
  setMeta: (m) => set((s) => ({ meta: { ...s.meta, ...m } })),
  setEditingId: (editingId) => set({ editingId }),
  loadCalculation: (c, mode) =>
    set({
      gas: c.input.gas,
      material: c.input.material,
      fittings: c.input.fittings_pct,
      segments: c.input.segments.map((x) => ({
        id: x.id,
        name: x.name,
        parent_id: x.parent_id,
        length: String(x.length_m),
        appliances: [...x.appliances],
      })),
      editingId: mode === "edit" ? c.id : null,
      meta: {
        name: mode === "edit" ? c.name : `${c.name} (copia)`,
        client_name: c.client_name ?? "",
        site_address: c.site_address ?? "",
      },
    }),
  reset: () => set(initial()),
}));

export const parseNum = (v: string) => parseFloat(v.replace(",", "."));

export function draftToInput(s: Pick<DraftState, "gas" | "material" | "fittings" | "segments">): CalcInput {
  return {
    gas: s.gas,
    material: s.material,
    fittings_pct: s.fittings,
    segments: s.segments.map((x) => ({
      id: x.id,
      name: x.name.trim() || "Tratto",
      parent_id: x.parent_id,
      length_m: parseNum(x.length),
      appliances: x.appliances,
    })),
  };
}
