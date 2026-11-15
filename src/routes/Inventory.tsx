import React, { useEffect, useMemo, useState } from "react";
import { Button } from "../components/ui";
import { Icon } from "../components/icons";
import { eur } from "../lib/format";
import { ipc } from "../lib/ipc";

export type Device = any;

export const ALL_STATUSES: { id: string; label: string }[] = [
  { id: "kupljen", label: "Kupljeni / čeka" },
  { id: "ceka_delove", label: "Čekaju delove" },
  { id: "u_popravci", label: "U servisu" },
  { id: "qc", label: "Testiranje (QC)" },
  { id: "spreman", label: "Na oglasima / spremno" },
  { id: "prodat", label: "Prodat / arhiva" },
];

export const STATUS_COLS = ALL_STATUSES;
export const STATUS_LABEL: Record<string, string> = Object.fromEntries(ALL_STATUSES.map((s) => [s.id, s.label]));

export const BOARD_COLS: { id: string; label: string; statuses: string[] }[] = [
  { id: "nabavka", label: "Čeka delove / nabavka", statuses: ["kupljen", "ceka_delove"] },
  { id: "servis", label: "U servisu", statuses: ["u_popravci"] },
  { id: "qc", label: "Testiranje (QC)", statuses: ["qc"] },
  { id: "oglasi", label: "Na oglasima / spremno", statuses: ["spreman"] },
];

export const NEXT_STATUS: Record<string, string | undefined> = {
  kupljen: "ceka_delove",
  ceka_delove: "u_popravci",
  u_popravci: "qc",
  qc: "spreman",
  spreman: "prodat",
};

export const DIAG_ITEMS = [
  ["ekran", "Ekran"], ["face_id", "Face ID"], ["touch_id", "Touch ID"], ["baterija", "Baterija"], ["zadnje_staklo", "Zadnje staklo"], ["maticna", "Matična ploča"], ["kamera", "Kamera (prednja/zadnja)"], ["zvucnik", "Zvučnik/mikrofon"], ["punjenje", "Punjenje/konektor"], ["mreza", "Mreža/SIM/Wi-Fi/BT"], ["kuciste", "Kućište/tasteri"], ["ostalo", "Ostalo"],
] as const;
export const QC_ITEMS = [
  ["zvuk_mikrofon", "Zvučnici i mikrofon (pozivi)"], ["truetone_face", "TrueTone i Face ID / Touch ID"], ["kamere", "Kamere (prednja/zadnja, fokus, portret)"], ["mreza", "Wi-Fi, Bluetooth, mobilna mreža (SIM)"], ["baterija_punjenje", "Stanje baterije (%) i punjenje"], ["icloud", "iCloud status (čist / otključan)"],
] as const;

export function deviceTotalCost(d: any): number {
  return (Number(d?.buy_price_eur) || 0) + (Number(d?.parts_cost_eur) || 0) + (Number(d?.hidden_cost_eur) || 0);
}

export function emptyDevice(): Device {
  const today = new Date().toISOString().slice(0,10);
  return {
    imei: "", serial: "", model: "", storage_gb: 128, color: "", source_seller: "",
    buy_price_eur: 0, buy_date: today, buy_notes: "", status: "kupljen",
    diagnostics: {}, repair_notes: "", servicer: "",
    parts_cost_eur: 0, hidden_cost_eur: 0, parts_items: [],
    qc: {}, battery_health: null, icloud_clear: null,
    sale_price_eur: null, sale_platform: "", sale_date: "", sale_notes: "",
    images_before: [], images_after: [],
  };
}

export function inferFromImei(imei: string): Partial<Device> {
  // No public TAC DB bundled; provide lightweight hints/normalization.
  const v = (imei || "").replace(/\D/g, "");
  const out: any = {};
  if (v.length >= 8) out.imei = v;
  return out;
}

export function calcTotals(devices: Device[]) {
  const sold = devices.filter(d=>d.status==="prodat");
  const revenue = sold.reduce((a,d)=>a+(Number(d.sale_price_eur)||0),0);
  const cost = sold.reduce((a,d)=>a+(Number(d.total_cost_eur || deviceTotalCost(d))||0),0);
  const profit = revenue - cost;
  const inStock = devices.filter(d=>d.status!=="prodat");
  const lockedCapital = inStock.reduce((a,d)=>a+(Number(d.total_cost_eur || deviceTotalCost(d))||0),0);
  const expectedProfit = Math.round(lockedCapital * 0.25);
  const byModel: Record<string,{count:number, profit:number}> = {};
  for (const d of sold) {
    const k = d.model || "Nepoznato";
    byModel[k] = byModel[k] || {count:0, profit:0};
    byModel[k].count++; byModel[k].profit += Number(d.profit_eur)||0;
  }
  return { soldCount: sold.length, revenue, cost, profit, lockedCapital, inStockCount: inStock.length, byModel, expectedProfit, inStock, sold };
}


export function printHtmlDocument(title: string, html: string, notify?: (m:string)=>void) {
  const frame = document.createElement("iframe");
  Object.assign(frame.style, { position:"fixed", width:"0", height:"0", border:"0", visibility:"hidden" });
  document.body.appendChild(frame);
  const doc = frame.contentDocument || frame.contentWindow?.document;
  if (!doc) { notify?.("Štampa nije dostupna."); try{frame.remove();}catch{} return; }
  doc.open(); doc.write(html); doc.close();
  frame.onload = () => { try { frame.contentWindow?.focus(); frame.contentWindow?.print(); } catch { ipc.saveExportFile(`hunt-${title}-${Date.now()}.html`, html).then((p)=>notify?.(`Sačuvano: ${p}`)).catch(()=>{}); } finally { setTimeout(()=>{ try{frame.remove();}catch{} }, 1500); } };
}

export function printDeviceDocument(d: Device, notify?: (m:string)=>void) {
  const esc = (v:any) => String(v ?? "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
  const money = (v:any) => Number(v||0).toFixed(2) + " €";
  const diag = (d.diagnostics && typeof d.diagnostics === "object") ? Object.entries(d.diagnostics).filter(([,v])=>!!v).map(([k])=>k).join(", ") : "-";
  const parts = Array.isArray(d.parts_items) ? d.parts_items : [];
  const partsRows = parts.map((it:any)=>`<tr><td>${esc(it.name||"-")}</td><td>${esc(it.type||"")}</td><td>${esc(it.supplier||"")}</td><td class="num">${money(it.cost)}</td></tr>`).join("") || `<tr><td colspan="4">Nema stavki delova</td></tr>`;
  const totalCost = (Number(d.buy_price_eur)||0) + (Number(d.parts_cost_eur)||0) + (Number(d.hidden_cost_eur)||0);
  const profit = d.sale_price_eur!=null && d.sale_price_eur!=="" ? (Number(d.sale_price_eur)||0) - totalCost : null;
  const html = `<!doctype html><html><head><meta charset="utf-8"/><title>Dokument uređaja</title><style>
  body{margin:0;background:#fff;color:#000;font:13px/1.45 ui-sans-serif,system-ui,"Segoe UI",Arial,sans-serif}
  .page{max-width:820px;margin:0 auto;padding:28px 32px}
  h1{font-size:22px;margin:0 0 4px} .muted{color:#666;font-size:12px}
  .grid{display:grid;grid-template-columns:1fr 1fr;gap:8px 16px;margin:14px 0}
  .box{border:1px solid #ddd;padding:10px;border-radius:8px}
  .label{font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:#666;margin-bottom:2px}
  table{width:100%;border-collapse:collapse;margin-top:8px} th,td{border-bottom:1px solid #eee;padding:6px 4px;text-align:left;font-size:12px}
  .num{text-align:right} .section{margin-top:14px}
  @media print{.page{padding:10mm}}
  </style></head><body><div class="page">
    <h1>Dokument uređaja ${d.id?`#${d.id}`:""}</h1>
    <div class="muted">hunt. • ${new Date().toLocaleString("sr-RS")}</div>
    <div class="grid">
      <div class="box"><div class="label">Uređaj</div><div><b>${esc(d.model||"-")}</b> ${esc(d.storage_gb?d.storage_gb+"GB":"")} ${esc(d.color||"")}</div><div class="muted">IMEI: ${esc(d.imei||"-")} • SN: ${esc(d.serial||"-")}</div></div>
      <div class="box"><div class="label">Status</div><div><b>${esc(d.status||"-")}</b></div><div class="muted">Prethodni: ${esc(d.previous_status||"-")}</div></div>
      <div class="box"><div class="label">Nabavka</div><div>Cena: ${money(d.buy_price_eur)}</div><div class="muted">Datum: ${esc(d.buy_date||"-")} • Izvor: ${esc(d.source_seller||"-")}</div></div>
      <div class="box"><div class="label">Prodaja / Finansije</div><div>Prodaja: ${d.sale_price_eur!=null?money(d.sale_price_eur):"-"}</div><div>Ukupno troškovi: ${money(totalCost)} • Profit: ${profit==null?"-":(profit>=0?"+":"")+money(profit)}</div></div>
    </div>
    <div class="section"><div class="label">Dijagnostika / napomene</div><div class="box">${esc(diag)}<br/><span class="muted">${esc(d.repair_notes||"")}</span></div></div>
    <div class="section"><div class="label">Delovi i troškovi</div>
      <table><thead><tr><th>Stavka</th><th>Tip</th><th>Dobavljač</th><th class="num">Cena</th></tr></thead><tbody>${partsRows}</tbody></table>
      <div class="muted" style="margin-top:6px">Delovi: ${money(d.parts_cost_eur)} • Skriveno: ${money(d.hidden_cost_eur)}</div>
    </div>
    <div class="section"><div class="label">Napomene prodaje / oglas</div><div class="box">${esc((d.sale_notes||"").slice(0,1200)).replace(/\n/g,"<br/>") || "-"}</div></div>
  </div><script>window.onload=()=>setTimeout(()=>window.print(),300)<\/script></body></html>`;
  printHtmlDocument(`uredjaj-${d.id||"novi"}`, html, notify);
}

export function printInventoryDocument(devices: Device[], notify?: (m:string)=>void) {
  const esc = (v:any) => String(v ?? "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
  const money = (v:any) => Number(v||0).toFixed(2) + " €";
  const rows = devices.map((d:any)=>{
    const tc = (Number(d.buy_price_eur)||0)+(Number(d.parts_cost_eur)||0)+(Number(d.hidden_cost_eur)||0);
    const profit = d.sale_price_eur!=null && d.sale_price_eur!=="" ? (Number(d.sale_price_eur)||0)-tc : null;
    return `<tr><td>${esc(d.id||"")}</td><td><b>${esc(d.model||"-")}</b> ${esc(d.storage_gb?d.storage_gb+"GB":"")}</td><td>${esc(d.imei||"")}</td><td>${esc(d.status||"")}</td><td class="num">${money(d.buy_price_eur)}</td><td class="num">${money(d.parts_cost_eur)}</td><td class="num">${money(tc)}</td><td class="num">${d.sale_price_eur!=null?money(d.sale_price_eur):"-"}</td><td class="num">${profit==null?"-":(profit>=0?"+":"")+money(profit)}</td></tr>`;
  }).join("");
  const totalBuy = devices.reduce((a:number,d:any)=>a+(Number(d.buy_price_eur)||0),0);
  const totalParts = devices.reduce((a:number,d:any)=>a+(Number(d.parts_cost_eur)||0),0);
  const totalAll = devices.reduce((a:number,d:any)=>a+(Number(d.buy_price_eur)||0)+(Number(d.parts_cost_eur)||0)+(Number(d.hidden_cost_eur)||0),0);
  const html = `<!doctype html><html><head><meta charset="utf-8"/><title>Inventar</title><style>
  body{margin:0;background:#fff;color:#000;font:12px/1.4 ui-sans-serif,system-ui,"Segoe UI",Arial,sans-serif}
  .page{max-width:1100px;margin:0 auto;padding:20px}
  h1{margin:0 0 4px;font-size:22px} .muted{color:#666}
  table{width:100%;border-collapse:collapse;margin-top:12px} th,td{border-bottom:1px solid #ddd;padding:6px 4px;text-align:left}
  .num{text-align:right} th{font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:#555}
  @media print{@page{size:A4 landscape;margin:10mm}.page{max-width:none;padding:0}}
  </style></head><body><div class="page">
    <h1>Inventar - svi uređaji</h1>
    <div class="muted">Datum: ${new Date().toLocaleString("sr-RS")} • Ukupno: ${devices.length} • Nabavka: ${money(totalBuy)} • Delovi: ${money(totalParts)} • Ukupni troškovi: ${money(totalAll)}</div>
    <table><thead><tr><th>ID</th><th>Model</th><th>IMEI</th><th>Status</th><th class="num">Nabavka</th><th class="num">Delovi</th><th class="num">Troškovi</th><th class="num">Prodaja</th><th class="num">Profit</th></tr></thead><tbody>${rows || '<tr><td colspan="9">Nema uređaja</td></tr>'}</tbody></table>
  </div><script>window.onload=()=>setTimeout(()=>window.print(),300)<\/script></body></html>`;
  printHtmlDocument('inventar', html, notify);
}

export function useDevices() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [partsCatalog, setPartsCatalog] = useState<any[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const notify = (m: string) => { setToast(m); setTimeout(()=>setToast(null), 3200); };
  const load = async () => {
    const d = await ipc.listDevices();
    if (Array.isArray(d)) setDevices(d);
    const p = await ipc.listPartsPrices();
    if (Array.isArray(p)) setPartsCatalog(p);
  };
  useEffect(() => { load(); }, []);
  const saveDevice = async (dev: Device) => {
    setBusy(true);
    try {
      const id = await ipc.upsertDevice(dev);
      if (id && !dev.id) dev.id = id;
      notify("Sačuvano");
      await load();
      return id || dev.id;
    } catch (e) { notify("Greška: " + String(e).slice(0,120)); return null; }
    finally { setBusy(false); }
  };
  const removeDevice = async (id: number) => {
    if (!window.confirm("Obrisati ovaj uređaj/nalog?")) return false;
    await ipc.deleteDevice(id);
    await load();
    return true;
  };
  return { devices, partsCatalog, toast, setToast, busy, notify, load, saveDevice, removeDevice };
}

export function genAdText(d: any): string {
  const model = [d.model, d.storage_gb?`${d.storage_gb}GB`:"", d.color||""].filter(Boolean).join(" ") || "iPhone";
  const bat = d.battery_health!=null ? `Zdravlje baterije ${d.battery_health}%. ` : "";
  const notes: string[] = [];
  if (d.qc?.truetone_face) notes.push("TrueTone/Face ID provereni i rade");
  if (d.qc?.icloud || d.icloud_clear) notes.push("iCloud čist/otključan");
  const repairs = (d.repair_notes||"").trim();
  const repTxt = repairs ? `Izvršene intervencije: ${repairs}. ` : "";
  const warranty = "Garancija (dogovor).";
  const accessories = "Uz telefon: (navedite prilog).";
  return `Na prodaju ${model}.\nTelefon je proveren i funkcionalan. ${repTxt}${bat}${notes.length?notes.join(". ")+". ":""}\n${accessories}\n${warranty}\nKontakt: ______`;
}

export function Inventory() {
  const { devices, partsCatalog, toast, busy, notify, load, saveDevice, removeDevice } = useDevices();
  const [selected, setSelected] = useState<Device | null>(null);
  const [mode, setMode] = useState<"board"|"list"|"finance"|"archive">("board");

  const saveAndRefresh = async (dev: Device) => {
    const id = await saveDevice(dev);
    if (id && dev.id) {
      const fresh = (await ipc.listDevices() || []).find((x:any)=>x.id===dev.id);
      if (fresh) setSelected(fresh);
    } else if (id) {
      const fresh = (await ipc.listDevices() || []).find((x:any)=>x.id===id);
      if (fresh) setSelected(fresh);
    }
  };

  const removeAndClose = async (id: number) => {
    const ok = await removeDevice(id);
    if (ok) setSelected(null);
  };

  const newIntake = () => { setSelected(emptyDevice()); };

  const byStatus = useMemo(() => {
    const m: Record<string, Device[]> = {};
    for (const c of BOARD_COLS) m[c.id] = [];
    for (const d of devices) {
      for (const col of BOARD_COLS) {
        if (col.statuses.includes(d.status)) {
          m[col.id].push(d);
          break;
        }
      }
    }
    return m;
  }, [devices]);

  const archivedDevices = useMemo(() => devices.filter((d) => d.status === "prodat"), [devices]);
  const totals = useMemo(() => calcTotals(devices), [devices]);

  const advanceDevice = async (dev: Device) => {
    const next = NEXT_STATUS[dev.status];
    if (!next || !dev.id) return;
    await saveDevice({ ...dev, status: next });
    notify(next === "prodat" ? "Pomereno u arhivu (prodato)." : "Status ažuriran.");
  };

  return (
    <>
      <div className="page-head">
        <div>
          <div className="label">Nalozi · Inventar</div>
          <h1 className="page-title">Servisni <em>nalozi</em> i prodaja.</h1>
          <p className="page-sub">Prijem, dijagnostika, popravka, QC i prodaja — jednim klikom.</p>
        </div>
        <div style={{ display:"flex", gap:6, alignItems:"center", flexWrap:"wrap" }}>
          <Button size="sm" variant={mode==="board"?"primary":"ghost"} onClick={()=>setMode("board")}>Kanban</Button>
          <Button size="sm" variant={mode==="list"?"primary":"ghost"} onClick={()=>setMode("list")}>Lista</Button>
          <Button size="sm" variant={mode==="finance"?"primary":"ghost"} onClick={()=>setMode("finance")}>Finansije</Button>
          <Button size="sm" variant={mode==="archive"?"primary":"ghost"} onClick={()=>setMode("archive")}>Arhiva</Button>
          <Button size="sm" variant="primary" onClick={newIntake}><Icon name="plus" size={13}/> Novi prijem</Button>
        </div>
      </div>

      <div className="kpi-bar" aria-label="Finansijski pregled">
        <div className="kpi"><div className="kpi-label">Uređaja</div><div className="kpi-value">{totals.inStockCount + totals.soldCount}</div><div className="kpi-note">na stanju {totals.inStockCount} · prodato {totals.soldCount}</div></div>
        <div className="kpi"><div className="kpi-label">Uloženo</div><div className="kpi-value">{eur(totals.lockedCapital)}</div><div className="kpi-note">nabavka + delovi + troškovi</div></div>
        <div className="kpi"><div className="kpi-label">Oč. zarada</div><div className="kpi-value">+{eur(totals.expectedProfit)}</div><div className="kpi-note">≈25% na troškove (na stanju)</div></div>
        <div className="kpi"><div className="kpi-label">Neto profit</div><div className="kpi-value" style={{ color: totals.profit>=0?"var(--pos)":"var(--neg)" }}>{totals.profit>=0?"+":""}{eur(totals.profit)}</div><div className="kpi-note">prihod {eur(totals.revenue)}</div></div>
      </div>

      {mode === "finance" && <FinanceView totals={totals} devices={devices} />}
      {mode === "archive" && (
        <div className="card"><div className="card-b" style={{ padding:0 }}>
          <table className="table"><thead><tr><th>Model</th><th>IMEI</th><th>Prodato</th><th className="num">Prodaja</th><th className="num">Troškovi</th><th className="num">Profit</th></tr></thead>
          <tbody>{archivedDevices.map(d=>(
            <tr key={d.id} onClick={()=>setSelected(d)} style={{cursor:"pointer"}}>
              <td><b>{d.model||"—"}</b> <span className="faint">{d.storage_gb?`${d.storage_gb}GB`:""}</span></td>
              <td className="mono" style={{fontSize:11}}>{d.imei||"—"}</td>
              <td><span className="faint">{d.sale_date || "—"}</span></td>
              <td className="num">{d.sale_price_eur!=null?eur(d.sale_price_eur):"—"}</td>
              <td className="num">{eur((d.parts_cost_eur||0)+(d.hidden_cost_eur||0))}</td>
              <td className="num" style={{color: (d.profit_eur||0)>=0?"var(--pos)":"var(--neg)"}}>{d.profit_eur!=null?`${d.profit_eur>=0?"+":""}${eur(d.profit_eur)}`:"—"}</td>
            </tr>
          ))}{archivedDevices.length===0 && <tr><td colSpan={6} className="faint">Još nema prodatih uređaja u arhivi.</td></tr>}</tbody></table>
        </div></div>
      )}
      {mode === "board" && (
        <div className="board">
          {BOARD_COLS.map(col => (
            <div key={col.id} className="card board-col">
              <div className="card-h"><b style={{ fontSize:12 }}>{col.label}</b><span className="faint">{(byStatus[col.id]||[]).length}</span></div>
              <div className="board-col-body">
                {(byStatus[col.id]||[]).map(d => {
                  const totalCost = (Number(d.buy_price_eur)||0) + (Number(d.parts_cost_eur)||0) + (Number(d.hidden_cost_eur)||0);
                  const modelInitial = String(d.model||"?").split(" ").filter(Boolean).slice(-2).map(x=>x[0]).join("").slice(0,2).toUpperCase();
                  return (
                    <div key={d.id} className="board-card" role="button" tabIndex={0} onClick={()=>setSelected(d)} onKeyDown={(e)=>{ if(e.key==="Enter" || e.key===" ") setSelected(d); }}>
                      <div className="board-thumb" aria-hidden="true">{modelInitial || "?"}</div>
                      <div className="board-main">
                        <b>{d.model || "Uređaj"}</b>
                        <span>{d.storage_gb?`${d.storage_gb}GB`:"—"}{d.battery_health!=null ? ` · bat ${d.battery_health}%` : ""}</span>
                        <div className="board-foot">
                          <span>Trošak {eur(totalCost)}</span>
                          {d.imei && <span>· {String(d.imei).slice(-5)}</span>}
                        </div>
                      </div>
                      <button className="board-next" type="button" title="Sledeći status" aria-label="Sledeći status" disabled={!NEXT_STATUS[d.status]} onClick={(e)=>{ e.stopPropagation(); advanceDevice(d); }}>
                        <Icon name="arrow-right" size={14} />
                      </button>
                    </div>
                  );
                })}
                {(byStatus[col.id]||[]).length===0 && <div className="board-empty">—</div>}
              </div>
            </div>
          ))}
        </div>
      )}
      {mode === "list" && (
        <div className="card"><div className="card-b" style={{ padding:0 }}>
          <table className="table"><thead><tr><th>Model</th><th>IMEI</th><th>Status</th><th className="num">Nabavka</th><th className="num">Troškovi</th><th className="num">Prodaja</th><th className="num">Profit</th></tr></thead>
          <tbody>{devices.map(d=>(
            <tr key={d.id} onClick={()=>setSelected(d)} style={{cursor:"pointer"}}>
              <td><b>{d.model||"—"}</b> <span className="faint">{d.storage_gb?`${d.storage_gb}GB`:""}</span></td>
              <td className="mono" style={{fontSize:11}}>{d.imei||"—"}</td>
              <td><span className="faint">{STATUS_COLS.find(s=>s.id===d.status)?.label||d.status}</span></td>
              <td className="num">{eur(d.buy_price_eur||0)}</td>
              <td className="num">{eur((d.parts_cost_eur||0)+(d.hidden_cost_eur||0))}</td>
              <td className="num">{d.sale_price_eur!=null?eur(d.sale_price_eur):"—"}</td>
              <td className="num" style={{color: (d.profit_eur||0)>=0?"var(--pos)":"var(--neg)"}}>{d.profit_eur!=null?`${d.profit_eur>=0?"+":""}${eur(d.profit_eur)}`:"—"}</td>
            </tr>
          ))}{devices.length===0 && <tr><td colSpan={7} className="faint">Nema unosa. Klikni „Novi prijem“.</td></tr>}</tbody></table>
        </div></div>
      )}

      {selected && <DeviceEditor dev={selected} onClose={()=>setSelected(null)} onSave={saveAndRefresh} onDelete={removeAndClose} busy={busy} partsCatalog={partsCatalog} notify={notify} />}

      {toast && <div className="toast">{toast}</div>}
    </>
  );
}

export function FinanceView({ totals, devices }: { totals: any; devices: Device[] }) {
  const rows = Object.entries(totals.byModel || {}).map(([model, v]: any) => ({ model, ...v })).sort((a,b)=>b.profit-a.profit);
  return (
    <div className="grid-side" style={{ alignItems:"start" }}>
      <div className="card"><div className="card-h"><b>Profit po modelu (prodate)</b></div>
        <div className="card-b" style={{padding:0}}>
          <table className="table"><thead><tr><th>Model</th><th className="num">Kom.</th><th className="num">Profit</th><th className="num">Prosek</th></tr></thead>
          <tbody>{rows.map(r=>(
            <tr key={r.model}><td>{r.model}</td><td className="num">{r.count}</td><td className="num" style={{color:r.profit>=0?"var(--pos)":"var(--neg)"}}>{r.profit>=0?"+":""}{eur(r.profit)}</td><td className="num">{eur(r.count? r.profit/r.count : 0)}</td></tr>
          ))}{rows.length===0 && <tr><td colSpan={4} className="faint">Još nema prodatih uređaja.</td></tr>}</tbody></table>
        </div>
      </div>
      <div className="card"><div className="card-h"><b>Pregled</b></div>
        <div className="card-b">
          <dl className="kv">
            <dt>Ukupan prihod (prodato)</dt><dd className="money">{eur(totals.revenue)}</dd>
            <dt>Ukupni trošak (prodato)</dt><dd className="money">{eur(totals.cost)}</dd>
            <dt>Neto profit</dt><dd className="money" style={{color: totals.profit>=0?"var(--pos)":"var(--neg)"}}><b>{totals.profit>=0?"+":""}{eur(totals.profit)}</b></dd>
            <dt>Kapital u lageru/obradi</dt><dd className="money">{eur(totals.lockedCapital)}</dd>
            <dt>Uređaja na stanju</dt><dd>{totals.inStockCount}</dd>
          </dl>
          <p className="faint" style={{marginTop:8,fontSize:11}}>Saveti: prati koji modeli daju najveću maržu i drži kapital u obradi pod kontrolom (delovi na vreme, brži QC/prodaja).</p>
        </div>
      </div>
    </div>
  );
}

export function DeviceEditor({ dev, onClose, onSave, onDelete, busy, partsCatalog, notify }: { dev: Device; onClose:()=>void; onSave:(d:Device)=>void; onDelete:(id:number)=>void; busy:boolean; partsCatalog:any[]; notify:(m:string)=>void }) {
  const [d, setD] = useState<Device>({ ...dev, diagnostics: dev.diagnostics||{}, qc: dev.qc||{}, parts_items: dev.parts_items||[], images_before: dev.images_before||[], images_after: dev.images_after||[] });
  useEffect(()=>{ setD({ ...dev, diagnostics: dev.diagnostics||{}, qc: dev.qc||{}, parts_items: dev.parts_items||[], images_before: dev.images_before||[], images_after: dev.images_after||[] }); }, [dev?.id]);
  const set = (k:string,v:any)=>setD((x:any)=>({...x,[k]:v}));
  const setDiag = (k:string,v:boolean)=>setD((x:any)=>({...x, diagnostics:{...(x.diagnostics||{}), [k]:v}}));
  const setQc = (k:string,v:boolean)=>setD((x:any)=>({...x, qc:{...(x.qc||{}), [k]:v}}));

  const partsTotal = (d.parts_items||[]).reduce((a:any,it:any)=>a + (Number(it.cost)||0), 0) || Number(d.parts_cost_eur)||0;
  const totalCost = (Number(d.buy_price_eur)||0) + (Number(d.parts_cost_eur)||0) + (Number(d.hidden_cost_eur)||0);
  const profit = d.sale_price_eur!=null && d.sale_price_eur!=="" ? (Number(d.sale_price_eur)||0) - totalCost : null;
  const recPrice = (() => {
    // simple recommendation from parts catalog labor+part? not directly; keep basic: suggest margin over total cost
    return totalCost > 0 ? Math.ceil((totalCost * 1.25) / 5) * 5 : null;
  })();

  const addPartItem = () => set("parts_items", [...(d.parts_items||[]), { name: "", type: "zamenski", supplier: "", cost: 0 }]);
  const setPartItem = (i:number,k:string,v:any)=> set("parts_items", (d.parts_items||[]).map((it:any,idx:number)=> idx===i?{...it,[k]:v}:it));
  const rmPartItem = (i:number)=> set("parts_items", (d.parts_items||[]).filter((_:any,idx:number)=>idx!==i));

  const addImage = (field:"images_before"|"images_after") => {
    const url = window.prompt("Putanja/URL slike (lokalna putanja ili link):");
    if (!url) return;
    set(field, [...(d[field]||[]), url]);
  };

  const genAd = () => {
    const text = genAdText(d);
    navigator.clipboard?.writeText(text);
    notify("Opis oglasa generisan i kopiran (možeš ga izmeniti/koristiti).");
    set("sale_notes", (d.sale_notes? d.sale_notes+"\n\n":"") + text);
  };

  const applyImei = () => {
    const inf = inferFromImei(d.imei||"");
    setD((x:any)=>({...x, ...inf}));
    notify("IMEI unet/normalizovan. Za detalje koristi AppleSN.info proveru (bez captcha).");
  };

  const [imeiBusy, setImeiBusy] = useState(false);
  const lookupImei = async () => {
    const imei = String(d.imei||"").replace(/\D/g,"").trim();
    if (!imei) { notify("Unesi IMEI prvo."); return; }
    setImeiBusy(true);
    try {
      const res = await ipc.lookupImei(imei);
      if (res) {
        const patch: any = {};
        if (res.input) patch.imei = res.input;
        if (res.model && !d.model) patch.model = res.model;
        if (res.storage_gb && (!d.storage_gb || Number(d.storage_gb) === 0)) patch.storage_gb = Number(res.storage_gb);
        if (res.color && !d.color) patch.color = res.color;
        if (Object.keys(patch).length) setD((x:any)=>({...x, ...patch}));
        notify(res.message || (res.ok ? "Podaci preuzeti." : "IMEI normalizovan."));
      } else {
        setD((x:any)=>({...x, ...inferFromImei(imei)}));
        notify("Provera nije dostupna u ovom okruženju. IMEI je normalizovan.");
      }
    } catch (e) {
      setD((x:any)=>({...x, ...inferFromImei(imei)}));
      notify("Greška pri proveri: " + String(e).slice(0, 100));
    }
    setImeiBusy(false);
  };

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.35)", zIndex:40, display:"flex", justifyContent:"flex-end" }} onClick={(e)=>{ if(e.target===e.currentTarget) onClose(); }}>
      <div className="card" style={{ width:"min(980px, 96vw)", height:"100%", borderRadius:0, overflow:"auto" }}>
                <div className="card-h" style={{ position:"sticky", top:0, background:"var(--surface)", zIndex:2 }}>
          <b>{d.id ? `Nalog #${d.id}` : "Novi prijem uređaja"}</b>
          <div style={{display:"flex", gap:6, flexWrap:"wrap"}}>
            <Button size="sm" variant="ghost" onClick={()=>printDeviceDocument(d, notify)}>Štampaj</Button>
            {d.id && d.previous_status && <Button size="sm" variant="ghost" onClick={async()=>{ try{ const r = await ipc.revertDeviceStatus(d.id); if(r && (r.previous_status!==undefined && r.previous_status!==null)){ const prev=r.previous_status; notify("Status vraćen na: " + (STATUS_LABEL[prev]||prev||"-")); setD((x:any)=>({...x, status: prev, previous_status: x.status})); } else { notify("Nema prethodnog statusa."); } } catch(e){ notify("Greška: "+String(e)); } }}>Vrati status</Button>}
            {d.id && <Button size="sm" variant="ghost" onClick={()=>onDelete(d.id)}>Obriši</Button>}
            <Button size="sm" variant="ghost" onClick={onClose}>Zatvori</Button>
            <Button size="sm" variant="primary" onClick={()=>onSave(d)} disabled={busy}>{busy?"Čuvam…":"Sačuvaj"}</Button>
          </div>
        </div>
        <div className="card-b" style={{ display:"grid", gap:14 }}>
          <section>
            <div className="label" style={{marginBottom:6}}>1. Prijem i nabavka</div>
            <div style={{display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(220px, 1fr))", gap:8}}>
              <div><div className="label">IMEI</div><div style={{display:"flex",gap:4}}><input className="input" value={d.imei||""} onChange={e=>set("imei",e.target.value)} placeholder="IMEI (sken/unos)" style={{width:"100%"}}/><Button size="sm" variant="ghost" onClick={applyImei}>OK</Button><Button size="sm" variant="ghost" onClick={lookupImei} disabled={imeiBusy}>{imeiBusy ? "…" : "Proveri"}</Button></div><div className="faint" style={{fontSize:10,marginTop:4}}>Automatska provera preko AppleSN.info (bez otvaranja browsera). Ako captcha blokira detalje, IMEI se normalizuje i model unosi ručno.</div></div>
              <div><div className="label">Serijski br.</div><input className="input" value={d.serial||""} onChange={e=>set("serial",e.target.value)} style={{width:"100%"}}/></div>
              <div><div className="label">Model</div><input className="input" value={d.model||""} onChange={e=>set("model",e.target.value)} placeholder="npr. iPhone 13 Pro" style={{width:"100%"}}/></div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}>
                <div><div className="label">Mem. (GB)</div><input className="input" type="number" value={d.storage_gb||""} onChange={e=>set("storage_gb",parseInt(e.target.value)||0)} style={{width:"100%"}}/></div>
                <div><div className="label">Boja</div><input className="input" value={d.color||""} onChange={e=>set("color",e.target.value)} style={{width:"100%"}}/></div>
              </div>
              <div><div className="label">Nabavna cena (€)</div><input className="input" type="number" value={d.buy_price_eur||0} onChange={e=>set("buy_price_eur",parseFloat(e.target.value)||0)} style={{width:"100%"}}/></div>
              <div><div className="label">Datum kupovine</div><input className="input" type="date" value={d.buy_date||""} onChange={e=>set("buy_date",e.target.value)} style={{width:"100%"}}/></div>
              <div><div className="label">Od koga (kontakt)</div><input className="input" value={d.source_seller||""} onChange={e=>set("source_seller",e.target.value)} placeholder="prodavac/kontakt" style={{width:"100%"}}/></div>
              <div><div className="label">Status</div>
                <select className="select" value={d.status||"kupljen"} onChange={e=>set("status",e.target.value)} style={{width:"100%"}}>
                  {STATUS_COLS.map(s=> <option key={s.id} value={s.id}>{s.label}</option>)}
                </select>
                {d.previous_status ? <div className="faint" style={{fontSize:10,marginTop:4}}>Prethodni: {STATUS_LABEL[d.previous_status] || d.previous_status}</div> : null}
              </div>
            </div>
            <div style={{marginTop:8}}><div className="label">Napomena nabavke (garancija porekla/sigurnost)</div><input className="input" value={d.buy_notes||""} onChange={e=>set("buy_notes",e.target.value)} style={{width:"100%"}}/></div>
          </section>

          <section>
            <div className="label" style={{marginBottom:6}}>2. Dijagnostika (šta ne radi)</div>
            <div style={{display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(200px, 1fr))", gap:6}}>
              {DIAG_ITEMS.map(([k,label])=>(
                <label key={k} style={{display:"flex",gap:6,alignItems:"center",fontSize:12}}><input type="checkbox" checked={!!d.diagnostics?.[k]} onChange={e=>setDiag(k,e.target.checked)}/> {label}</label>
              ))}
            </div>
          </section>

          <section>
            <div className="label" style={{marginBottom:6}}>3. Popravka, delovi i troškovi</div>
            <div style={{display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(180px, 1fr))", gap:8, marginBottom:8}}>
              <div><div className="label">Serviser / ko radi</div><input className="input" value={d.servicer||""} onChange={e=>set("servicer",e.target.value)} style={{width:"100%"}}/></div>
              <div><div className="label">Delovi ukupno (€)</div><input className="input" type="number" value={d.parts_cost_eur||0} onChange={e=>set("parts_cost_eur",parseFloat(e.target.value)||0)} style={{width:"100%"}}/></div>
              <div><div className="label">Skriveni troškovi (€)</div><input className="input" type="number" value={d.hidden_cost_eur||0} onChange={e=>set("hidden_cost_eur",parseFloat(e.target.value)||0)} placeholder="poštarina, sitno..." style={{width:"100%"}}/></div>
              <div><div className="label">Preporuka cene (≈25% marža)</div><div className="money" style={{padding:"8px 0"}}>{recPrice!=null?eur(recPrice):"—"}</div></div>
            </div>
            <div style={{marginBottom:8}}><div className="label">Stavke delova (dobavljač/tip/cena)</div>
              <table className="table"><thead><tr><th>Deo/opis</th><th>Tip</th><th>Dobavljač</th><th className="num">Cena (€)</th><th></th></tr></thead>
              <tbody>{(d.parts_items||[]).map((it:any,i:number)=>(
                <tr key={i}><td><input className="input" value={it.name||""} onChange={e=>setPartItem(i,"name",e.target.value)} style={{width:"100%"}}/></td>
                <td><select className="select" value={it.type||"zamenski"} onChange={e=>setPartItem(i,"type",e.target.value)}><option value="original">Original</option><option value="zamenski">Zamenski</option><option value="pulled">Pulled</option></select></td>
                <td><input className="input" value={it.supplier||""} onChange={e=>setPartItem(i,"supplier",e.target.value)} style={{width:"100%"}}/></td>
                <td className="num"><input className="input" type="number" value={it.cost||0} onChange={e=>setPartItem(i,"cost",parseFloat(e.target.value)||0)} style={{width:90,textAlign:"right"}}/></td>
                <td><button className="icon-btn" onClick={()=>rmPartItem(i)}><Icon name="close" size={14}/></button></td></tr>
              ))}</tbody></table>
              <div style={{display:"flex",justifyContent:"space-between",marginTop:6}}><Button size="sm" variant="ghost" onClick={addPartItem}><Icon name="plus" size={13}/> Dodaj deo</Button><span className="faint">Zbir stavki: {eur((d.parts_items||[]).reduce((a:any,it:any)=>a+(Number(it.cost)||0),0))} (unesi i/ili uskladi „Delovi ukupno“)</span></div>
            </div>
            <div><div className="label">Beleske popravke / servisera</div><textarea className="input" rows={3} value={d.repair_notes||""} onChange={e=>set("repair_notes",e.target.value)} placeholder='npr. "zamenjen ekran, poruka o neoriginalnom delu; TrueTone programiran"' style={{width:"100%",resize:"vertical"}}/></div>
          </section>

          <section>
            <div className="label" style={{marginBottom:6}}>4. Kontrola kvaliteta (QC) pre prodaje</div>
            <div style={{display:"grid", gridTemplateColumns:"repeat(2,1fr)", gap:6, marginBottom:8}}>
              {QC_ITEMS.map(([k,label])=>(
                <label key={k} style={{display:"flex",gap:6,alignItems:"center",fontSize:12}}><input type="checkbox" checked={!!d.qc?.[k]} onChange={e=>setQc(k,e.target.checked)}/> {label}</label>
              ))}
            </div>
            <div style={{display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8}}>
              <div><div className="label">Baterija (%)</div><input className="input" type="number" value={d.battery_health??""} onChange={e=>set("battery_health", e.target.value===""?null:parseInt(e.target.value))} style={{width:"100%"}}/></div>
              <div><div className="label">iCloud čist/otključan</div><select className="select" value={d.icloud_clear==null?"":(d.icloud_clear?"da":"ne")} onChange={e=>set("icloud_clear", e.target.value===""?null:e.target.value==="da")} style={{width:"100%"}}><option value="">Nepoznato</option><option value="da">Da</option><option value="ne">Ne</option></select></div>
              <div style={{display:"flex",alignItems:"end"}}><Button size="sm" variant="ghost" onClick={()=>set("status","spreman")}>Označi: Spreman za prodaju</Button></div>
            </div>
          </section>

          <section>
            <div className="label" style={{marginBottom:6}}>5. Prodaja i finansije</div>
            <div style={{display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(220px, 1fr))", gap:8}}>
              <div><div className="label">Prodajna cena (€)</div><input className="input" type="number" value={d.sale_price_eur??""} onChange={e=>set("sale_price_eur", e.target.value===""?null:parseFloat(e.target.value))} style={{width:"100%"}}/></div>
              <div><div className="label">Platforma</div><input className="input" value={d.sale_platform||""} onChange={e=>set("sale_platform",e.target.value)} placeholder="KP, Instagram, FB, uživo..." style={{width:"100%"}}/></div>
              <div><div className="label">Datum prodaje</div><input className="input" type="date" value={d.sale_date||""} onChange={e=>set("sale_date",e.target.value)} style={{width:"100%"}}/></div>
              <div style={{display:"flex",alignItems:"end"}}><Button size="sm" variant="ghost" onClick={()=>set("status","prodat")}>Označi: Prodat</Button></div>
            </div>
            <div className="card" style={{marginTop:8}}><div className="card-b">
              <dl className="kv">
                <dt>Ukupna cena (nabavka+delovi+skriveno)</dt><dd className="money">{eur(totalCost)}</dd>
                <dt>Neto profit</dt><dd className="money" style={{color: profit==null?"var(--muted)": profit>=0?"var(--pos)":"var(--neg)"}}><b>{profit==null?"—":`${profit>=0?"+":""}${eur(profit)}`}</b></dd>
                <dt>Marža</dt><dd className="money">{profit!=null && d.sale_price_eur? `${(((profit)/(Number(d.sale_price_eur)||1))*100).toFixed(1)}%`:"—"}</dd>
              </dl>
            </div></div>
          </section>

          <section>
            <div className="label" style={{marginBottom:6}}>6. Oglas i slike</div>
            <div style={{display:"flex", gap:8, flexWrap:"wrap", marginBottom:8}}>
              <Button size="sm" variant="primary" onClick={genAd}><Icon name="plus" size={13}/> Generiši opis oglasa</Button>
              <Button size="sm" variant="ghost" onClick={()=>addImage("images_before")}>Dodaj sliku PRE</Button>
              <Button size="sm" variant="ghost" onClick={()=>addImage("images_after")}>Dodaj sliku POSLE</Button>
            </div>
            <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:8}}>
              <div><div className="label">Slike pre popravke ({(d.images_before||[]).length})</div><ul className="faint" style={{fontSize:11,margin:0,paddingLeft:16}}>{(d.images_before||[]).map((p:string,i:number)=><li key={i}>{p}</li>)}</ul></div>
              <div><div className="label">Slike posle popravke ({(d.images_after||[]).length})</div><ul className="faint" style={{fontSize:11,margin:0,paddingLeft:16}}>{(d.images_after||[]).map((p:string,i:number)=><li key={i}>{p}</li>)}</ul></div>
            </div>
            <div style={{marginTop:8}}><div className="label">Tekst oglasa / napomene prodaje</div><textarea className="input" rows={5} value={d.sale_notes||""} onChange={e=>set("sale_notes",e.target.value)} placeholder="Generisani ili ručni opis za KP/Instagram/FB..." style={{width:"100%",resize:"vertical"}}/></div>
          </section>
        </div>
      </div>
    </div>
  );
}



