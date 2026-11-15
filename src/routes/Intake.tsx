import React, { useMemo, useState } from "react";
import { Button } from "../components/ui";
import { Icon } from "../components/icons";
import { ipc } from "../lib/ipc";
import { eur } from "../lib/format";
import { emptyDevice, deviceTotalCost, useDevices, inferFromImei } from "./Inventory";

const CONDITIONS = [
  ["ekran", "Razbijen/oštećen ekran"],
  ["zadnje_staklo", "Zadnje staklo"],
  ["baterija", "Slaba baterija"],
  ["face_id", "Face ID ne radi"],
  ["kamera", "Kamera"],
  ["punjenje", "Punjenje/konektor"],
  ["zvucnik", "Zvuk/mikrofon"],
  ["ne_pali", "Ne pali"],
  ["icloud", "iCloud zaključan"],
] as const;

type ReceiptItem = { desc: string; qty: number; price: number };

export function Intake() {
  const { notify, saveDevice, busy, toast } = useDevices();
  const [d, setD] = useState<any>(() => {
    const base = emptyDevice();
    base.storage_gb = 128;
    base.diagnostics = {};
    return base;
  });
  const [rc, setRc] = useState({
    shopName: "Servis telefona",
    shopInfo: "Beograd · tel: ______ · PIB: ______",
    receiptNo: `R-${new Date().toISOString().slice(0,10).replace(/-/g,"")}-${Math.floor(Math.random()*900+100)}`,
    date: new Date().toISOString().slice(0,10),
    customer: "",
    customerPhone: "",
    warranty: "30 dana na ugrađene delove i rad",
    note: "",
  });
  const [items, setItems] = useState<ReceiptItem[]>([{ desc: "Otkup / prijem uređaja", qty: 1, price: 0 }]);
  const [lastId, setLastId] = useState<number | null>(null);

  const set = (k: string, v: any) => setD((x: any) => ({ ...x, [k]: v }));
  const setDiag = (k: string, v: boolean) => setD((x: any) => ({ ...x, diagnostics: { ...(x.diagnostics || {}), [k]: v } }));
  const total = useMemo(() => items.reduce((a, it) => a + (Number(it.qty)||0) * (Number(it.price)||0), 0), [items]);
  const deviceLabel = [d.model, d.storage_gb ? `${d.storage_gb}GB` : "", d.color || ""].filter(Boolean).join(" ") || "—";

  const [lookupBusy, setLookupBusy] = useState(false);
  const lookupImei = async () => {
    const imei = String(d.imei || "").replace(/\D/g, "").trim();
    if (!imei) { notify("Unesi IMEI prvo."); return; }
    setLookupBusy(true);
    try {
      const res = await ipc.lookupImei(imei);
      if (res) {
        const patch: any = {};
        if (res.input) patch.imei = res.input;
        if (res.model && !d.model) patch.model = res.model;
        if (res.storage_gb && (!d.storage_gb || d.storage_gb === 128)) patch.storage_gb = Number(res.storage_gb);
        if (res.color && !d.color) patch.color = res.color;
        if (Object.keys(patch).length) setD((x: any) => ({ ...x, ...patch }));
        notify(res.message || (res.ok ? "Podaci preuzeti." : "IMEI normalizovan."));
      } else {
        setD((x: any) => ({ ...x, ...inferFromImei(imei) }));
        notify("Provera nije dostupna u ovom okruženju. IMEI je normalizovan.");
      }
    } catch (e) {
      setD((x: any) => ({ ...x, ...inferFromImei(imei) }));
      notify("Greška pri proveri: " + String(e).slice(0, 100));
    }
    setLookupBusy(false);
  };

  function fmt(n: number) { return new Intl.NumberFormat("sr-RS", { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(n||0); }
  function esc(s: string) { return String(s||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;"); }

  const printReceipt = () => {
    const issue = CONDITIONS.filter(([k]) => d.diagnostics?.[k]).map(([, l]) => l).join(", ") || "—";
    const rows = items.map(it => `<tr><td>${esc(it.desc||"—")}</td><td class="num">${it.qty}</td><td class="num">${fmt(it.price)}</td><td class="num">${fmt((Number(it.qty)||0)*(Number(it.price)||0))}</td></tr>`).join("");
    const html = `<!doctype html><html><head><meta charset="utf-8"/><title>Prijem ${esc(rc.receiptNo)}</title>
<style>
  :root{--ink:#0b0b0b;--muted:#6e6e6e;--line:#e3e3e3;}*{box-sizing:border-box} body{margin:0;background:#fff;color:var(--ink);font:13px/1.5 ui-sans-serif,system-ui,"Segoe UI",Arial,sans-serif;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  .page{max-width:780px;margin:0 auto;padding:32px 36px}
  .top{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:1px solid var(--ink);padding-bottom:14px;margin-bottom:16px}
  .brand{font:600 10px/1 ui-sans-serif,system-ui;letter-spacing:.18em;text-transform:uppercase}.brand em{font:italic 500 24px/1 Georgia,"Times New Roman",serif;letter-spacing:-.03em;text-transform:none;display:block;margin-top:5px}
  .meta{text-align:right;font-family:ui-monospace,SFMono-Regular,Consolas,monospace;font-size:10px;color:var(--muted);letter-spacing:.04em} .meta b{color:var(--ink);font-weight:500}
  h2{font:500 9px/1 ui-monospace,SFMono-Regular,Consolas,monospace;letter-spacing:.18em;text-transform:uppercase;color:var(--muted);margin:14px 0 6px}
  .kv{display:grid;grid-template-columns:150px 1fr;gap:4px 10px;font-size:12px}.kv dt{color:var(--muted);font-family:ui-monospace,SFMono-Regular,Consolas,monospace;font-size:9px;letter-spacing:.1em;text-transform:uppercase;padding-top:2px} .kv dd{margin:0}
  table{width:100%;border-collapse:collapse;margin-top:6px} th,td{padding:8px;border-bottom:1px solid var(--line);text-align:left;font-size:12px}
  th{font:500 8.5px/1 ui-monospace,SFMono-Regular,Consolas,monospace;letter-spacing:.14em;text-transform:uppercase;color:var(--muted)} .num{text-align:right;font-variant-numeric:tabular-nums;font-family:ui-monospace,SFMono-Regular,Consolas,monospace}
  .totals{margin-top:10px;display:flex;justify-content:flex-end}.totals table{width:280px}.totals td{border:0;padding:6px 8px}.grand{border-top:1px solid var(--ink);font-weight:600}
  .sign{margin-top:34px;display:grid;grid-template-columns:1fr 1fr;gap:40px;font-size:11px;color:var(--muted)} .sign .line{border-top:1px solid var(--ink);margin-top:34px;padding-top:6px;color:var(--ink)}
</style></head><body><div class="page">
  <div class="top"><div class="brand">hunt. · servis<em>Potvrda prijema</em></div><div class="meta"><div><b>Br.</b> ${esc(rc.receiptNo)}</div><div><b>Datum:</b> ${esc(rc.date)}</div></div></div>
  <h2>Servis</h2><div class="kv"><dt>Naziv</dt><dd>${esc(rc.shopName)}</dd><dt>Info</dt><dd>${esc(rc.shopInfo)}</dd></div>
  <h2>Klijent / prodavac</h2><div class="kv"><dt>Ime/kontakt</dt><dd>${esc(rc.customer || d.source_seller || "—")}</dd><dt>Telefon</dt><dd>${esc(rc.customerPhone||"—")}</dd></div>
  <h2>Uređaj</h2><div class="kv"><dt>Model</dt><dd>${esc(deviceLabel)}</dd><dt>IMEI/serijski</dt><dd>${esc(d.imei||d.serial||"—")}</dd><dt>Stanje/kvar</dt><dd>${esc(issue)}</dd><dt>Nabavna cena</dt><dd>${fmt(Number(d.buy_price_eur)||0)} EUR</dd></div>
  <h2>Napomena</h2><table><thead><tr><th>Stavka</th><th class="num">Kol.</th><th class="num">Iznos</th><th class="num">Ukupno</th></tr></thead><tbody>${rows}</tbody></table>
  <div class="totals"><table><tr><td>Ukupno</td><td class="num grand">${fmt(total)} EUR</td></tr></table></div>
  <div style="margin-top:14px;font-size:11px;color:#6e6e6e"><b>Napomena:</b> ${esc(rc.note || d.buy_notes || "—")}</div>
  <div class="sign"><div><div class="line">Predao</div></div><div><div class="line">Primio</div></div></div>
</div><script>window.onload=()=>setTimeout(()=>window.print(),300)</script></body></html>`;
    const frame = document.createElement("iframe");
    Object.assign(frame.style, { position:"fixed", width:"0", height:"0", border:"0", visibility:"hidden" });
    frame.srcdoc = html; document.body.appendChild(frame);
    frame.onload = () => { try { frame.contentWindow?.focus(); frame.contentWindow?.print(); } catch { ipc.saveExportFile(`hunt-prijem-${Date.now()}.html`, html).then((p)=>notify(`Sačuvano: ${p}`)).catch(()=>{}); } finally { setTimeout(()=>{ try{frame.remove();}catch{} },1500); } };
  };

  const saveIntake = async (andPrint = false) => {
    if (!d.model?.trim() && !d.imei?.trim()) { notify("Unesi bar IMEI ili model."); return; }
    const payload = { ...d, buy_price_eur: Number(d.buy_price_eur)||0, storage_gb: Number(d.storage_gb)||0, status: d.status || "kupljen" };
    const id = await saveDevice(payload);
    if (id) setLastId(id);
    if (andPrint) printReceipt();
  };

  const reset = () => {
    const base = emptyDevice(); base.storage_gb = 128; base.diagnostics = {}; setD(base);
    setItems([{ desc: "Otokup / prijem uređaja", qty: 1, price: Number(d.buy_price_eur)||0 }]);
    setRc((r)=>({ ...r, receiptNo: `R-${new Date().toISOString().slice(0,10).replace(/-/g,"")}-${Math.floor(Math.random()*900+100)}`, date: new Date().toISOString().slice(0,10) }));
  };

  return (
    <>
      <div className="page-head">
        <div>
          <div className="label">02 — Novi prijem</div>
          <h1 className="page-title">Brz <em>prijem</em> uređaja.</h1>
          <p className="page-sub">Unesi IMEI/model, cenu nabavke i stanje — sačuvaj u sistem i po potrebi odštampaj potvrdu prijema.</p>
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <Button size="sm" variant="ghost" onClick={reset}>Novi</Button>
          <Button size="sm" variant="ghost" onClick={() => saveIntake(false)} disabled={busy}><Icon name="plus" size={13} /> {busy ? "Čuvam…" : "Sačuvaj"}</Button>
          <Button size="sm" variant="primary" onClick={() => saveIntake(true)} disabled={busy}><Icon name="download" size={13} /> Sačuvaj i štampaj</Button>
        </div>
      </div>

      <div className="split-screen">
        <div className="card">
          <div className="card-h"><b>Prijem i nabavka</b>{lastId ? <span className="faint" style={{ fontSize: 11 }}>Sačuvano #{lastId}</span> : null}</div>
          <div className="card-b" style={{ display: "grid", gap: 14 }}>
            <section>
              <div className="label" style={{ marginBottom: 6 }}>Uređaj (IMEI / model)</div>
              <div style={{ display: "grid", gap: 8 }}>
                <div style={{ display: "flex", gap: 6 }}>
                  <input className="input" value={d.imei || ""} onChange={(e) => set("imei", e.target.value)} placeholder="IMEI / serijski (sken ili unos)" style={{ flex: 1 }} />
                  <Button size="sm" variant="ghost" onClick={lookupImei} disabled={lookupBusy}>{lookupBusy ? "Provera…" : "Proveri IMEI"}</Button>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "minmax(0,2fr) 110px 1fr", gap: 8 }}>
                  <input className="input" value={d.model || ""} onChange={(e) => set("model", e.target.value)} placeholder="Model (npr. iPhone 13 Pro)" />
                  <input className="input" type="number" value={d.storage_gb || ""} onChange={(e) => set("storage_gb", parseInt(e.target.value) || 0)} placeholder="GB" />
                  <input className="input" value={d.color || ""} onChange={(e) => set("color", e.target.value)} placeholder="Boja" />
                </div>
              </div>
            </section>
            <section>
              <div className="label" style={{ marginBottom: 6 }}>Nabavka i kontakt</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 8 }}>
                <div><div className="label">Cena nabavke (€)</div><input className="input" type="number" value={d.buy_price_eur || 0} onChange={(e) => { const v = parseFloat(e.target.value)||0; set("buy_price_eur", v); setItems((arr)=>arr.map((it,i)=>i===0?{...it,price:v}:it)); }} style={{ width: "100%" }} /></div>
                <div><div className="label">Datum</div><input className="input" type="date" value={d.buy_date || ""} onChange={(e) => set("buy_date", e.target.value)} style={{ width: "100%" }} /></div>
                <div><div className="label">Prodavac / kontakt</div><input className="input" value={d.source_seller || ""} onChange={(e) => { set("source_seller", e.target.value); if(!rc.customer) setRc(r=>({...r, customer: e.target.value})); }} style={{ width: "100%" }} /></div>
              </div>
              <div style={{ marginTop: 8 }}><div className="label">Napomena nabavke</div><input className="input" value={d.buy_notes || ""} onChange={(e) => set("buy_notes", e.target.value)} placeholder="dogovor, poreklo, napomena..." style={{ width: "100%" }} /></div>
            </section>
            <section>
              <div className="label" style={{ marginBottom: 6 }}>Početno stanje / kvarovi</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 6 }}>
                {CONDITIONS.map(([k, label]) => (
                  <label key={k} style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 12 }}><input type="checkbox" checked={!!d.diagnostics?.[k]} onChange={(e) => setDiag(k, e.target.checked)} /> {label}</label>
                ))}
              </div>
            </section>
            <section>
              <div className="label" style={{ marginBottom: 6 }}>Potvrda prijema (štampa)</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 8 }}>
                <input className="input" value={rc.receiptNo} onChange={(e)=>setRc(r=>({...r, receiptNo:e.target.value}))} placeholder="Broj" />
                <input className="input" value={rc.shopName} onChange={(e)=>setRc(r=>({...r, shopName:e.target.value}))} placeholder="Naziv servisa" />
                <input className="input" value={rc.shopInfo} onChange={(e)=>setRc(r=>({...r, shopInfo:e.target.value}))} placeholder="Info servisa" />
                <input className="input" value={rc.customerPhone} onChange={(e)=>setRc(r=>({...r, customerPhone:e.target.value}))} placeholder="Telefon klijenta" />
              </div>
            </section>
          </div>
        </div>

        <div className="card" aria-label="Pregled potvrde prijema">
          <div className="card-h"><b>Pregled potvrde</b><span className="faint" style={{ fontSize: 11 }}>{rc.receiptNo}</span></div>
          <div className="card-b" style={{ padding: 14, display: "grid", gap: 10 }}>
            <div className="receipt-preview">
              <div className="rp-brand"><div><b>hunt. · servis</b><em>Potvrda prijema</em></div><div className="rp-meta"><div><b>Br.</b> {rc.receiptNo}</div><div><b>Datum:</b> {rc.date}</div></div></div>
              <h3>Uređaj</h3>
              <dl className="rp-kv"><dt>Model</dt><dd>{deviceLabel}</dd><dt>IMEI</dt><dd>{d.imei || "—"}</dd><dt>Prodavac</dt><dd>{d.source_seller || "—"}</dd><dt>Cena nabavke</dt><dd>{fmt(Number(d.buy_price_eur)||0)} EUR</dd></dl>
              <h3>Stanje / kvarovi</h3>
              <div style={{ fontSize: 11 }}>{CONDITIONS.filter(([k]) => d.diagnostics?.[k]).map(([, l]) => l).join(", ") || "Nije označeno"}</div>
              <h3>Napomena</h3>
              <div style={{ fontSize: 11, color: "#6e6e6e" }}>{d.buy_notes || "—"}</div>
              <div className="rp-total" style={{ marginTop: 10 }}>Ukupno: {fmt(Number(d.buy_price_eur)||0)} EUR</div>
            </div>
            <Button size="sm" variant="primary" className="btn--xl" onClick={() => saveIntake(true)} disabled={busy}><Icon name="download" size={16} /> {busy ? "Čuvam…" : "Sačuvaj i štampaj potvrdu"}</Button>
            <Button size="sm" variant="ghost" onClick={printReceipt}>Samo štampaj pregled</Button>
          </div>
        </div>
      </div>
      {toast && <div className="toast">{toast}</div>}
    </>
  );
}
