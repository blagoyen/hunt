import React, { useState } from "react";
import { Button } from "../components/ui";
import { Icon } from "../components/icons";
import { ipc } from "../lib/ipc";

type ReceiptItem = { desc: string; qty: number; price: number };

export function ManualEntry() {
  const [form, setForm] = useState({
    title: "",
    model: "",
    storage: "128",
    price: "",
    location: "",
    seller: "",
    description: "",
    battery: "",
    icloud: false,
    carrierLocked: false,
    screenReplaced: false,
    damage: "working",
    notes: "",
  });
  const [toast, setToast] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Receipt / servisna potvrda
  const [rc, setRc] = useState({
    shopName: "Servis telefona",
    shopInfo: "Beograd · tel: ______ · PIB: ______",
    receiptNo: `R-${new Date().toISOString().slice(0,10).replace(/-/g,"")}-${Math.floor(Math.random()*900+100)}`,
    date: new Date().toISOString().slice(0,10),
    customer: "",
    customerPhone: "",
    device: "",
    imei: "",
    issue: "",
    receivedCondition: "",
    warranty: "30 dana na ugrađene delove i rad",
    note: "",
  });
  const [items, setItems] = useState<ReceiptItem[]>([
    { desc: "Zamena dela / usluga", qty: 1, price: 0 },
  ]);

  const set = (k: string, v: any) => setForm((f) => ({ ...f, [k]: v }));
  const setR = (k: string, v: any) => setRc((r) => ({ ...r, [k]: v }));
  const setItem = (i: number, k: keyof ReceiptItem, v: any) => setItems((arr) => arr.map((it, idx) => idx === i ? { ...it, [k]: v } : it));
  const addItem = () => setItems((arr) => [...arr, { desc: "", qty: 1, price: 0 }]);
  const removeItem = (i: number) => setItems((arr) => arr.filter((_, idx) => idx !== i));
  const total = items.reduce((a, it) => a + (Number(it.qty)||0) * (Number(it.price)||0), 0);

  const exportReceiptPdf = () => {
    const device = rc.device || [form.model, form.storage ? form.storage+"GB" : ""].filter(Boolean).join(" ") || "—";
    const rows = items.map(it => `<tr><td>${escapeHtml(it.desc||"—")}</td><td class="num">${it.qty}</td><td class="num">${fmt(it.price)}</td><td class="num">${fmt((Number(it.qty)||0)*(Number(it.price)||0))}</td></tr>`).join("");
    const html = `<!doctype html><html><head><meta charset="utf-8"/><title>Račun ${escapeHtml(rc.receiptNo)}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Instrument+Serif:ital@0;1&display=swap');
  :root{--ink:#000;--muted:#6e6e6e;--faint:#9a9a9a;--line:#e4e4e4;--bg:#fff;}
  *{box-sizing:border-box} body{margin:0;background:#fff;color:var(--ink);font:13px/1.45 Inter,system-ui,sans-serif;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  .page{max-width:780px;margin:0 auto;padding:36px 40px}
  .top{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:1px solid var(--ink);padding-bottom:16px;margin-bottom:18px}
  .brand{font:600 11px/1 Inter,system-ui;letter-spacing:.18em;text-transform:uppercase}
  .brand em{font:italic 400 28px/1 "Instrument Serif",serif;letter-spacing:-.02em;text-transform:none;display:block;margin-top:4px}
  .meta{ text-align:right;font-size:11px;color:var(--muted)}
  .meta b{color:var(--ink);font-weight:600}
  h2{font:500 10px/1 Inter;letter-spacing:.16em;text-transform:uppercase;color:var(--muted);margin:18px 0 8px}
  .grid{display:grid;grid-template-columns:1fr 1fr;gap:12px 24px}
  .kv{display:grid;grid-template-columns:140px 1fr;gap:4px 10px;font-size:12px}
  .kv dt{color:var(--muted)} .kv dd{margin:0;color:var(--ink)}
  table{width:100%;border-collapse:collapse;margin-top:6px}
  th,td{padding:9px 8px;border-bottom:1px solid var(--line);text-align:left;font-size:12px}
  th{font:500 9px/1 Inter;letter-spacing:.14em;text-transform:uppercase;color:var(--muted)}
  .num{text-align:right;font-variant-numeric:tabular-nums}
  .totals{margin-top:12px;display:flex;justify-content:flex-end}
  .totals table{width:320px} .totals td{border:0;padding:6px 8px} .totals .grand{border-top:1px solid var(--ink);font-weight:600;font-size:14px}
  .note{margin-top:18px;padding-top:12px;border-top:1px solid var(--line);font-size:11px;color:var(--muted)}
  .sign{margin-top:36px;display:grid;grid-template-columns:1fr 1fr;gap:40px;font-size:11px;color:var(--muted)}
  .sign .line{border-top:1px solid var(--ink);margin-top:36px;padding-top:6px;color:var(--ink)}
  @media print{.page{padding:20px 24px} body{background:#fff}}
</style></head><body><div class="page">
  <div class="top"><div class="brand">hunt. · servis<em>Servisna potvrda</em></div>
  <div class="meta"><div><b>Račun br.</b> ${escapeHtml(rc.receiptNo)}</div><div><b>Datum:</b> ${escapeHtml(rc.date)}</div></div></div>
  <div class="grid">
    <div><h2>Servis</h2><div class="kv"><dt>Naziv</dt><dd>${escapeHtml(rc.shopName)}</dd><dt>Info</dt><dd>${escapeHtml(rc.shopInfo)}</dd></div></div>
    <div><h2>Klijent</h2><div class="kv"><dt>Ime</dt><dd>${escapeHtml(rc.customer||"—")}</dd><dt>Telefon</dt><dd>${escapeHtml(rc.customerPhone||"—")}</dd></div></div>
  </div>
  <h2>Uređaj</h2><div class="kv"><dt>Model/uređaj</dt><dd>${escapeHtml(device)}</dd><dt>IMEI/serijski</dt><dd>${escapeHtml(rc.imei||"—")}</dd><dt>Prijavljeni kvar</dt><dd>${escapeHtml(rc.issue||"—")}</dd><dt>Stanje pri prijemu</dt><dd>${escapeHtml(rc.receivedCondition||"—")}</dd></div>
  <h2>Usluge i delovi</h2>
  <table><thead><tr><th>Opis</th><th class="num">Kol.</th><th class="num">Cena</th><th class="num">Iznos</th></tr></thead><tbody>${rows || `<tr><td colspan="4" style="color:#9a9a9a">Nema stavki</td></tr>`}</tbody></table>
  <div class="totals"><table><tr><td>Ukupno</td><td class="num grand">${fmt(total)} EUR</td></tr></table></div>
  <div class="note"><b>Garancija:</b> ${escapeHtml(rc.warranty||"—")}<br/><b>Napomena:</b> ${escapeHtml(rc.note||"—")}</div>
  <div class="sign"><div><div class="line">Predao (klijent)</div></div><div><div class="line">Primio (servis)</div></div></div>
</div><script>window.onload=()=>{setTimeout(()=>window.print(),300)}</script></body></html>`;
    const w = window.open("", "_blank");
    if (!w) { alert("Dozvoli popup prozor za izvoz PDF-a."); return; }
    w.document.open(); w.document.write(html); w.document.close();
  };

  function fmt(n: number) { return new Intl.NumberFormat("sr-RS", { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(n||0); }
  function escapeHtml(s: string) { return String(s||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;"); }

  return (
    <>
      <div className="page-head">
        <div>
          <div className="label">02 — Ručni unos</div>
          <h1 className="page-title">Ručni <em>unos podataka</em>.</h1>
          <p className="page-sub">Unesi telefon/oglas ručno sa svim informacijama (model, stanje, cena, napomene). Podaci se čuvaju u bazi.</p>
        </div>
      </div>

      <div className="grid-side">
        <div className="card">
          <div className="card-h"><b>Osnovni podaci</b></div>
          <div className="card-b">
            <div style={{ display: "grid", gap: 10 }}>
              <div>
                <div className="label" style={{ marginBottom: 6 }}>Naslov</div>
                <input className="input" value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="npr. iPhone 13 Pro 256GB - razbijen ekran" style={{ width: "100%" }} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 8 }}>
                <div>
                  <div className="label" style={{ marginBottom: 6 }}>Model</div>
                  <input className="input" value={form.model} onChange={(e) => set("model", e.target.value)} placeholder="iPhone 13 Pro" style={{ width: "100%" }} />
                </div>
                <div>
                  <div className="label" style={{ marginBottom: 6 }}>Memorija (GB)</div>
                  <input className="input" value={form.storage} onChange={(e) => set("storage", e.target.value)} placeholder="128" style={{ width: "100%" }} />
                </div>
                <div>
                  <div className="label" style={{ marginBottom: 6 }}>Cena (€)</div>
                  <input className="input" value={form.price} onChange={(e) => set("price", e.target.value)} placeholder="250" style={{ width: "100%" }} />
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <div>
                  <div className="label" style={{ marginBottom: 6 }}>Lokacija</div>
                  <input className="input" value={form.location} onChange={(e) => set("location", e.target.value)} placeholder="Beograd" style={{ width: "100%" }} />
                </div>
                <div>
                  <div className="label" style={{ marginBottom: 6 }}>Prodavac/kontakt</div>
                  <input className="input" value={form.seller} onChange={(e) => set("seller", e.target.value)} placeholder="ime, telefon..." style={{ width: "100%" }} />
                </div>
              </div>
              <div>
                <div className="label" style={{ marginBottom: 6 }}>Opis</div>
                <textarea className="input" rows={4} value={form.description} onChange={(e) => set("description", e.target.value)} placeholder="Opis stanja, dogovor, napomene prodavca..." style={{ width: "100%", resize: "vertical" }} />
              </div>
            </div>
          </div>
        </div>

        <div className="stack">
          <div className="card">
            <div className="card-h"><b>Stanje i atributi</b></div>
            <div className="card-b">
              <div style={{ display: "grid", gap: 10 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  <div>
                    <div className="label" style={{ marginBottom: 6 }}>Baterija (%)</div>
                    <input className="input" value={form.battery} onChange={(e) => set("battery", e.target.value)} placeholder="npr. 84" style={{ width: "100%" }} />
                  </div>
                  <div>
                    <div className="label" style={{ marginBottom: 6 }}>Oštećenje/stanje</div>
                    <select className="select" value={form.damage} onChange={(e) => set("damage", e.target.value)} style={{ width: "100%" }}>
                      <option value="working">Ispravan</option>
                      <option value="screen">Ekran</option>
                      <option value="battery">Baterija</option>
                      <option value="back">Zadnje staklo</option>
                      <option value="faceid">Face ID</option>
                      <option value="camera">Kamera</option>
                      <option value="water">Voda</option>
                      <option value="no_power">Ne pali/ne radi</option>
                    </select>
                  </div>
                </div>
                <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13 }}>
                  <input type="checkbox" checked={form.icloud} onChange={(e) => set("icloud", e.target.checked)} /> iCloud zaključan
                </label>
                <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13 }}>
                  <input type="checkbox" checked={form.carrierLocked} onChange={(e) => set("carrierLocked", e.target.checked)} /> SIM/carrier zaključan
                </label>
                <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13 }}>
                  <input type="checkbox" checked={form.screenReplaced} onChange={(e) => set("screenReplaced", e.target.checked)} /> Menjan ekran
                </label>
                <div>
                  <div className="label" style={{ marginBottom: 6 }}>Interne napomene</div>
                  <textarea className="input" rows={3} value={form.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Plan popravke, troškovi, dogovor..." style={{ width: "100%", resize: "vertical" }} />
                </div>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-h"><b>Sačuvaj</b></div>
            <div className="card-b">
              <p className="faint" style={{ marginBottom: 10, fontSize: 11 }}>
                Ručni unos se čuva kao zapis u bazi (izvor: ručno). Možeš ga kasnije koristiti za kalkulaciju i evidenciju.
              </p>
              <Button
                size="sm"
                variant="primary"
                disabled={saving}
                onClick={async () => {
                  setSaving(true);
                  try {
                    const { invoke } = await import("@tauri-apps/api/core");
                    await invoke("save_manual_listing", {
                      data: {
                        title: form.title || `${form.model} ${form.storage}GB`,
                        model: form.model,
                        storage: parseInt(form.storage) || 0,
                        price: parseFloat(form.price) || 0,
                        location: form.location,
                        seller: form.seller,
                        description: [form.description, form.notes ? `Napomene: ${form.notes}` : ""].filter(Boolean).join("\n"),
                        battery: form.battery ? parseInt(form.battery) : null,
                        icloud: form.icloud,
                        carrier_locked: form.carrierLocked,
                        screen_replaced: form.screenReplaced,
                        damage: [form.damage],
                      }
                    });
                    setToast("Sačuvano (ručni unos)");
                    setForm({ title: "", model: "", storage: "128", price: "", location: "", seller: "", description: "", battery: "", icloud: false, carrierLocked: false, screenReplaced: false, damage: "working", notes: "" });
                  } catch (e) {
                    setToast("Greška: " + String(e).slice(0, 140));
                  }
                  setSaving(false);
                  setTimeout(() => setToast(null), 3200);
                }}
              >
                <Icon name="plus" size={13} /> {saving ? "Čuvam…" : "Sačuvaj unos"}
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 14 }}>
        <div className="card-h">
          <b>Servisna potvrda / račun (PDF)</b>
          <Button size="sm" variant="primary" onClick={exportReceiptPdf}><Icon name="download" size={13} /> Izvezi PDF</Button>
        </div>
        <div className="card-b">
          <p className="faint" style={{ marginBottom: 10, fontSize: 11 }}>Popuni podatke o servisu, klijentu, uređaju i stavkama popravke, pa izvezi PDF u dizajnu aplikacije (štampa → Sačuvaj kao PDF).</p>
          <div className="grid-side" style={{ alignItems: "start" }}>
            <div style={{ display: "grid", gap: 8 }}>
              <div className="label">Servis i dokument</div>
              <input className="input" value={rc.shopName} onChange={e=>setR("shopName", e.target.value)} placeholder="Naziv servisa" />
              <input className="input" value={rc.shopInfo} onChange={e=>setR("shopInfo", e.target.value)} placeholder="Adresa, telefon, PIB..." />
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
                <input className="input" value={rc.receiptNo} onChange={e=>setR("receiptNo", e.target.value)} placeholder="Broj računa" />
                <input className="input" type="date" value={rc.date} onChange={e=>setR("date", e.target.value)} />
              </div>
              <div className="label" style={{ marginTop: 6 }}>Klijent</div>
              <input className="input" value={rc.customer} onChange={e=>setR("customer", e.target.value)} placeholder="Ime i prezime klijenta" />
              <input className="input" value={rc.customerPhone} onChange={e=>setR("customerPhone", e.target.value)} placeholder="Telefon klijenta" />
            </div>
            <div style={{ display: "grid", gap: 8 }}>
              <div className="label">Uređaj i prijem</div>
              <input className="input" value={rc.device} onChange={e=>setR("device", e.target.value)} placeholder={form.model ? `${form.model} ${form.storage}GB` : "Model uređaja"} />
              <input className="input" value={rc.imei} onChange={e=>setR("imei", e.target.value)} placeholder="IMEI / serijski broj" />
              <input className="input" value={rc.issue} onChange={e=>setR("issue", e.target.value)} placeholder="Prijavljeni kvar" />
              <input className="input" value={rc.receivedCondition} onChange={e=>setR("receivedCondition", e.target.value)} placeholder="Stanje pri prijemu (ogrebotine, napomene...)" />
              <input className="input" value={rc.warranty} onChange={e=>setR("warranty", e.target.value)} placeholder="Garancija" />
            </div>
          </div>

          <div style={{ marginTop: 12 }}>
            <div className="label" style={{ marginBottom: 6 }}>Stavke (delovi i usluge)</div>
            <table className="table">
              <thead><tr><th>Opis</th><th className="num" style={{width:80}}>Kol.</th><th className="num" style={{width:120}}>Cena (€)</th><th className="num" style={{width:120}}>Iznos</th><th style={{width:40}}></th></tr></thead>
              <tbody>
                {items.map((it, i) => (
                  <tr key={i}>
                    <td><input className="input" value={it.desc} onChange={e=>setItem(i,"desc",e.target.value)} placeholder="npr. Zamena ekrana iPhone 13 Pro" style={{width:"100%"}} /></td>
                    <td className="num"><input className="input" type="number" value={it.qty} onChange={e=>setItem(i,"qty",parseFloat(e.target.value)||0)} style={{width:70,textAlign:"right"}} /></td>
                    <td className="num"><input className="input" type="number" value={it.price} onChange={e=>setItem(i,"price",parseFloat(e.target.value)||0)} style={{width:100,textAlign:"right"}} /></td>
                    <td className="num">{fmt((Number(it.qty)||0)*(Number(it.price)||0))} €</td>
                    <td><button className="icon-btn" onClick={()=>removeItem(i)} title="Ukloni"><Icon name="close" size={14} /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginTop:8 }}>
              <Button size="sm" variant="ghost" onClick={addItem}><Icon name="plus" size={13} /> Dodaj stavku</Button>
              <div className="money"><b>Ukupno: {fmt(total)} €</b></div>
            </div>
            <div style={{ marginTop: 8 }}>
              <div className="label" style={{ marginBottom: 6 }}>Napomena na računu</div>
              <input className="input" value={rc.note} onChange={e=>setR("note", e.target.value)} placeholder="Dodatne napomene, uslovi..." style={{ width: "100%" }} />
            </div>
          </div>
        </div>
      </div>
      {toast && <div className="toast">{toast}</div>}
    </>
  );
}
