import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { Platform } from "react-native";

import { api, GAS_LABELS, MATERIAL_LABELS, type CalcInput, type CalcResult, type Profile, type SaveMeta } from "@/src/api";
import { themes } from "@/src/theme";

const c = themes.light;

const esc = (s: string | number) =>
  String(s).replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]!);

function buildHtml(meta: SaveMeta, input: CalcInput, r: CalcResult, p: Profile | null, logo: string | null) {
  const byId = Object.fromEntries(input.segments.map((s) => [s.id, s]));
  const segRows = r.segments
    .map((s) => {
      const from = s.parent_id ? byId[s.parent_id]?.name ?? "-" : "Contatore";
      const apps = byId[s.id].appliances.map((a) => `${esc(a.name)} (${a.power_kw} kW)`).join(", ") || "-";
      return `<tr>
        <td><b>${esc(s.name)}</b><br/><span class="mut">da ${esc(from)}</span></td>
        <td>${s.length_m}</td><td>${s.power_kw}</td><td>${s.flow_m3h}</td>
        <td class="b">${s.recommended ? esc(s.recommended.nominal) : "N.D."}</td>
        <td>${s.recommended ? s.recommended.internal_mm : "-"}</td>
        <td>${s.recommended ? s.recommended.pressure_drop_mbar.toFixed(2) : "-"}</td>
        <td>${s.cumulative_drop_mbar !== null ? s.cumulative_drop_mbar.toFixed(2) : "-"}</td>
      </tr><tr><td colspan="8" class="mut small">Apparecchi: ${apps}</td></tr>`;
    })
    .join("");

  const installer = p
    ? [p.company, p.full_name, p.address, [p.phone, p.email].filter(Boolean).join(" · "), p.vat && `P.IVA ${p.vat}`, p.license]
        .filter(Boolean)
        .map((x) => esc(x as string))
        .join("<br/>")
    : "";

  const verdict = r.ok
    ? `<div class="ok">Verifica superata: caduta di pressione massima ${r.max_cumulative_drop_mbar?.toFixed(2)} mbar ≤ ${r.max_drop_mbar} mbar</div>`
    : `<div class="ko">Verifica NON superata: almeno un tratto supera i limiti tabellari</div>`;

  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><style>
    body{font-family:-apple-system,Helvetica,Arial,sans-serif;color:${c.onSurface};font-size:12px;margin:28px}
    .head{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid ${c.brandPrimary};padding-bottom:12px}
    .logo{max-height:70px;max-width:180px}
    h1{font-size:20px;margin:16px 0 4px} h2{font-size:14px;color:${c.brandPrimary};margin:20px 0 8px;text-transform:uppercase;letter-spacing:1px}
    .mut{color:${c.muted}} .small{font-size:10px} .b{font-weight:800;color:${c.brandPrimary}}
    table{width:100%;border-collapse:collapse} th{background:${c.surfaceTertiary};text-align:left;font-size:10px;padding:6px}
    td{padding:6px;border-bottom:1px solid ${c.border};vertical-align:top}
    .grid td{border:none;padding:3px 6px}
    .ok{background:#DCFCE7;color:${c.success};padding:10px;border-radius:6px;font-weight:700;margin-top:12px}
    .ko{background:#FEE2E2;color:${c.error};padding:10px;border-radius:6px;font-weight:700;margin-top:12px}
    .foot{margin-top:28px;font-size:10px;color:${c.muted};border-top:1px solid ${c.border};padding-top:8px}
    .sign{margin-top:40px;display:flex;justify-content:flex-end}.sign div{border-top:1px solid ${c.onSurface};width:220px;text-align:center;padding-top:4px}
  </style></head><body>
    <div class="head">
      <div>${logo ? `<img class="logo" src="${logo}"/>` : ""}</div>
      <div style="text-align:right">${installer}</div>
    </div>
    <h1>Relazione tecnica – Dimensionamento impianto gas</h1>
    <div class="mut">Data: ${new Date().toLocaleDateString("it-IT")}</div>
    <h2>Dati generali</h2>
    <table class="grid">
      <tr><td class="mut">Calcolo</td><td><b>${esc(meta.name || "-")}</b></td><td class="mut">Cliente</td><td>${esc(meta.client_name || "-")}</td></tr>
      <tr><td class="mut">Indirizzo cantiere</td><td colspan="3">${esc(meta.site_address || "-")}</td></tr>
      <tr><td class="mut">Gas</td><td>${esc(GAS_LABELS[input.gas])}</td><td class="mut">Materiale</td><td>${esc(MATERIAL_LABELS[input.material])}</td></tr>
      <tr><td class="mut">Potenza totale</td><td>${r.total_power_kw} kW</td><td class="mut">Portata totale</td><td>${r.flow_m3h} m³/h</td></tr>
      <tr><td class="mut">Lungh. di calcolo</td><td>${r.equivalent_length_m} m (incl. +${input.fittings_pct}% raccordi)</td><td class="mut">Δp ammessa</td><td>${r.max_drop_mbar} mbar</td></tr>
    </table>
    <h2>Dimensionamento tratti</h2>
    <table>
      <tr><th>Tratto</th><th>L (m)</th><th>kW</th><th>m³/h</th><th>Misura</th><th>Ø int. mm</th><th>Δp tratto</th><th>Δp cumul.</th></tr>
      ${segRows}
    </table>
    ${verdict}
    <div class="sign"><div>Timbro e firma del tecnico</div></div>
    <div class="foot">Calcolo eseguito secondo il metodo tabellare UNI 7129 (formula di Renouard, bassa pressione): ogni tratto è dimensionato con la propria portata e la lunghezza totale dal contatore all'apparecchio più lontano. I valori sono indicativi e devono essere verificati da un tecnico abilitato.</div>
  </body></html>`;
}

export async function shareReport(meta: SaveMeta, input: CalcInput, result: CalcResult) {
  const profile = await api.profile().catch(() => null);
  const logo = profile?.has_logo ? await api.logoData().then((d) => d.data_uri).catch(() => null) : null;
  const html = buildHtml(meta, input, result, profile, logo);
  if (Platform.OS === "web") {
    // expo-print on web ignores html and prints the app; print the report in its own window
    const w = window.open("", "_blank");
    if (!w) throw new Error("popup blocked");
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 400);
    return;
  }
  const { uri } = await Print.printToFileAsync({ html });
  await Sharing.shareAsync(uri, {
    mimeType: "application/pdf",
    UTI: "com.adobe.pdf",
    dialogTitle: "Condividi relazione tecnica",
  });
}
