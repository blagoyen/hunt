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
  :root{--ink:#000;--muted:#6e6e6e;--faint:#9a9a9a;--line:#e4e4e4;--bg:#fff;}
  *{box-sizing:border-box} body{margin:0;background:#fff;color:var(--ink);font:13px/1.45 ui-sans-serif,system-ui,"Segoe UI",Arial,sans-serif;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  .page{max-width:780px;margin:0 auto;padding:36px 40px}
  .top{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:1px solid var(--ink);padding-bottom:16px;margin-bottom:18px}
  .brand{font:600 11px/1 ui-sans-serif,system-ui,"Segoe UI",Arial,sans-serif;letter-spacing:.18em;text-transform:uppercase}
  .brand em{font:italic 400 28px/1 Georgia,"Times New Roman",serif;letter-spacing:-.02em;text-transform:none;display:block;margin-top:4px}
  .meta{ text-align:right;font-size:11px;color:var(--muted)}
  .meta b{color:var(--ink);font-weight:600}
  h2{font:500 10px/1 ui-sans-serif,system-ui,"Segoe UI",Arial,sans-serif;letter-spacing:.16em;text-transform:uppercase;color:var(--muted);margin:18px 0 8px}
  .grid{display:grid;grid-template-columns:1fr 1fr;gap:12px 24px}
  .kv{display:grid;grid-template-columns:140px 1fr;gap:4px 10px;font-size:12px}
  .kv dt{color:var(--muted)} .kv dd{margin:0;color:var(--ink)}
  table{width:100%;border-collapse:collapse;margin-top:6px}
  th,td{padding:9px 8px;border-bottom:1px solid var(--line);text-align:left;font-size:12px}
  th{font:500 9px/1 ui-sans-serif,system-ui,"Segoe UI",Arial,sans-serif;letter-spacing:.14em;text-transform:uppercase;color:var(--muted)}
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
    const frame = document.createElement("iframe");
    frame.setAttribute("aria-hidden", "true");
    frame.style.position = "fixed";
    frame.style.width = "0";
    frame.style.height = "0";
    frame.style.border = "0";
    frame.style.visibility = "hidden";
    frame.srcdoc = html;
    document.body.appendChild(frame);
    const cleanup = () => {
      setTimeout(() => {
        try { frame.remove(); } catch {}
      }, 1500);
    };
    frame.onload = () => {
      try {
        frame.contentWindow?.focus();
        frame.contentWindow?.print();
      } catch (err) {
        try { frame.remove(); } catch {}
        // Fallback: save the HTML to Downloads so the user can open/print without a popup blocker.
        ipc.saveExportFile(`hunt-servisna-potvrda-${Date.now()}.html`, html)
          .then((path) => setToast(`Naštampano kopiju sačuvano u: ${path}`))
          .catch(() => setToast("Štampanje nije uspelo. Proveri dozvole za štampač."));
      } finally {
        cleanup();
      }
    };
  };

  function fmt(n: number) { return new Intl.NumberFormat("sr-RS", { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(n||0); }
  function escapeHtml(s: string) { return String(s||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;"); }

  const device = rc.device || [form.model, form.storage ? form.storage+"GB" : ""].filter(Boolean).join(" ") || "—";
  const previewItems = items.map((it, i) => {
    const qty = Number(it.qty) || 0;
    const price = Number(it.price) || 0;
    return { ...it, rowTotal: qty * price };
  });

  const saveAndPrint = async () => {
    setSaving(true);
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      await invoke("save_manual_listing", {
        data: {
          title: form.title || `${form.model} ${form.storage}GB`.trim() || "Ručni unos",
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
        },
      });
      setToast("Sačuvano i poslato na štampu");
      exportReceiptPdf();
    } catch (e) {
      setToast("Greška: " + String(e).slice(0, 140));
    }
    setSaving(false);
    setTimeout(() => setToast(null), 3200);
  };

  return (
    <>
      <div className="page-head">
        <div>
          <div className="label">02 — Ručni unos</div>
          <h1 className="page-title">Ručni <em>unos i potvrda</em>.</h1>
          <p className="page-sub">Leva strana je forma za unos; desno se u realnom vremenu ispisuje servisna potvrda/račun. Na kraju — Sačuvaj i štampaj.</p>
        </div>
        <Button size="sm" variant="primary" onClick={saveAndPrint} disabled={saving}>
          <Icon name="download" size={13} /> {saving ? "Čuvam…" : "Sačuvaj i štampaj"}
        </Button>
      </div>

      <div className="split-screen">
        <div className="card">
          <div className="card-h">
            <b>Forma za unos</b>
            <Button size="sm" variant="ghost" onClick={exportReceiptPdf}>
              <Icon name="download" size={13} /> Samo štampaj
            </Button>
          </div>
          <div className="card-b" style={{ display: "grid", gap: 14 }}>
            <section>
              <div className="label" style={{ marginBottom: 6 }}>1. Telefon</div>
              <div style={{ display: "grid", gap: 8 }}>
                <input className="input" value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="Naslov (npr. iPhone 13 Pro 256GB - razbijen ekran)" />
                <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 2fr) minmax(0, 1fr) minmax(0, 1fr)", gap: 8 }}>
                  <input className="input" value={form.model} onChange={(e) => set("model", e.target.value)} placeholder="Model" />
                  <input className="input" value={form.storage} onChange={(e) => set("storage", e.target.value)} placeholder="Memorija (GB)" />
                  <input className="input" value={form.price} onChange={(e) => set("price", e.target.value)} placeholder="Cena (€)" />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 8 }}>
                  <input className="input" value={form.location} onChange={(e) => set("location", e.target.value)} placeholder="Lokacija" />
                  <input className="input" value={form.seller} onChange={(e) => set("seller", e.target.value)} placeholder="Prodavac / kontakt" />
                  <input className="input" value={form.battery} onChange={(e) => set("battery", e.target.value)} placeholder="Baterija (%)" />
                  <select className="select" value={form.damage} onChange={(e) => set("damage", e.target.value)}>
                    <option value="working">Ispravan</option>
                    <option value="screen">Ekran</option>
                    <option value="battery">Baterija</option>
                    <option value="back">Zadnje staklo</option>
                    <option value="faceid">Face ID</option>
                    <option value="camera">Kamera</option>
                    <option value="water">Voda</option>
                    <option value="no_power">Ne pali / ne radi</option>
                  </select>
                </div>
                <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                  <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 12 }}><input type="checkbox" checked={form.icloud} onChange={(e) => set("icloud", e.target.checked)} /> iCloud zaključan</label>
                  <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 12 }}><input type="checkbox" checked={form.carrierLocked} onChange={(e) => set("carrierLocked", e.target.checked)} /> SIM zaključan</label>
                  <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 12 }}><input type="checkbox" checked={form.screenReplaced} onChange={(e) => set("screenReplaced", e.target.checked)} /> Menjan ekran</label>
                </div>
                <textarea className="input" rows={2} value={form.description} onChange={(e) => set("description", e.target.value)} placeholder="Opis stanja, dogovor, napomene prodavca..." style={{ resize: "vertical" }} />
                <textarea className="input" rows={2} value={form.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Interne napomene (plan popravke, troškovi...)" style={{ resize: "vertical" }} />
              </div>
            </section>

            <section>
              <div className="label" style={{ marginBottom: 6 }}>2. Dokument / servis</div>
              <div style={{ display: "grid", gap: 8 }}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 8 }}>
                  <input className="input" value={rc.receiptNo} onChange={e=>setR("receiptNo", e.target.value)} placeholder="Broj računa" />
                  <input className="input" type="date" value={rc.date} onChange={e=>setR("date", e.target.value)} />
                </div>
                <input className="input" value={rc.shopName} onChange={e=>setR("shopName", e.target.value)} placeholder="Naziv servisa" />
                <input className="input" value={rc.shopInfo} onChange={e=>setR("shopInfo", e.target.value)} placeholder="Adresa, telefon, PIB..." />
              </div>
            </section>

            <section>
              <div className="label" style={{ marginBottom: 6 }}>3. Klijent i uređaj</div>
              <div style={{ display: "grid", gap: 8 }}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 8 }}>
                  <input className="input" value={rc.customer} onChange={e=>setR("customer", e.target.value)} placeholder="Ime i prezime klijenta" />
                  <input className="input" value={rc.customerPhone} onChange={e=>setR("customerPhone", e.target.value)} placeholder="Telefon klijenta" />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 8 }}>
                  <input className="input" value={rc.device} onChange={e=>setR("device", e.target.value)} placeholder={form.model ? `${form.model} ${form.storage}GB` : "Model uređaja"} />
                  <input className="input" value={rc.imei} onChange={e=>setR("imei", e.target.value)} placeholder="IMEI / serijski broj" />
                </div>
                <input className="input" value={rc.issue} onChange={e=>setR("issue", e.target.value)} placeholder="Prijavljeni kvar" />
                <input className="input" value={rc.receivedCondition} onChange={e=>setR("receivedCondition", e.target.value)} placeholder="Stanje pri prijemu (ogrebotine, napomene...)" />
                <input className="input" value={rc.warranty} onChange={e=>setR("warranty", e.target.value)} placeholder="Garancija" />
              </div>
            </section>

            <section>
              <div className="label" style={{ marginBottom: 6 }}>4. Stavke (delovi i usluge)</div>
              <table className="table">
                <thead><tr><th>Opis</th><th className="num">Kol.</th><th className="num">Cena (€)</th><th className="num">Iznos</th><th style={{ width: 40 }}></th></tr></thead>
                <tbody>
                  {items.map((it, i) => (
                    <tr key={i}>
                      <td><input className="input" value={it.desc} onChange={e=>setItem(i,"desc",e.target.value)} placeholder="npr. Zamena ekrana" style={{width:"100%"}} /></td>
                      <td className="num"><input className="input" type="number" value={it.qty} onChange={e=>setItem(i,"qty",parseFloat(e.target.value)||0)} style={{width:64,textAlign:"right"}} /></td>
                      <td className="num"><input className="input" type="number" value={it.price} onChange={e=>setItem(i,"price",parseFloat(e.target.value)||0)} style={{width:84,textAlign:"right"}} /></td>
                      <td className="num">{fmt((Number(it.qty)||0)*(Number(it.price)||0))}</td>
                      <td><button className="icon-btn" onClick={()=>removeItem(i)} title="Ukloni"><Icon name="close" size={14} /></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginTop: 6 }}>
                <Button size="sm" variant="ghost" onClick={addItem}><Icon name="plus" size={13} /> Dodaj stavku</Button>
                <div className="money"><b>Ukupno: {fmt(total)} €</b></div>
              </div>
              <div style={{ marginTop: 8 }}>
                <div className="label" style={{ marginBottom: 6 }}>Napomena na računu</div>
                <input className="input" value={rc.note} onChange={e=>setR("note", e.target.value)} placeholder="Dodatne napomene, uslovi..." />
              </div>
            </section>
          </div>
        </div>

        <div className="card" aria-label="Live preview servisne potvrde">
          <div className="card-h">
            <b>Live pregled potvrde</b>
            <span className="faint" style={{ fontSize: 11 }}>{rc.receiptNo}</span>
          </div>
          <div className="card-b" style={{ padding: 14, display: "grid", gap: 10 }}>
            <div className="receipt-preview">
              <div className="rp-brand">
                <div>
                  <b>hunt. · servis</b>
                  <em>Servisna potvrda</em>
                </div>
                <div className="rp-meta">
                  <div><b>Račun br.</b> {rc.receiptNo}</div>
                  <div><b>Datum:</b> {rc.date}</div>
                </div>
              </div>
              <h3>Servis</h3>
              <dl className="rp-kv">
                <dt>Naziv</dt><dd>{rc.shopName || "—"}</dd>
                <dt>Info</dt><dd>{rc.shopInfo || "—"}</dd>
              </dl>
              <h3>Klijent</h3>
              <dl className="rp-kv">
                <dt>Ime</dt><dd>{rc.customer || "—"}</dd>
                <dt>Telefon</dt><dd>{rc.customerPhone || "—"}</dd>
              </dl>
              <h3>Uređaj</h3>
              <dl className="rp-kv">
                <dt>Model</dt><dd>{device}</dd>
                <dt>IMEI</dt><dd>{rc.imei || "—"}</dd>
                <dt>Kvar</dt><dd>{rc.issue || "—"}</dd>
                <dt>Stanje</dt><dd>{rc.receivedCondition || "—"}</dd>
              </dl>
              <h3>Usluge i delovi</h3>
              <table>
                <thead><tr><th>Opis</th><th className="rp-num">Kol.</th><th className="rp-num">Cena</th><th className="rp-num">Iznos</th></tr></thead>
                <tbody>
                  {previewItems.length === 0 && <tr><td colSpan={4} style={{ color: "#9a9a9a" }}>Nema stavki</td></tr>}
                  {previewItems.map((it, i) => (
                    <tr key={i}>
                      <td>{it.desc || "—"}</td>
                      <td className="rp-num">{it.qty}</td>
                      <td className="rp-num">{fmt(Number(it.price) || 0)}</td>
                      <td className="rp-num">{fmt(it.rowTotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="rp-total">Ukupno: {fmt(total)} EUR</div>
              <div className="rp-note">
                <div><b>Garancija:</b> {rc.warranty || "—"}</div>
                <div><b>Napomena:</b> {rc.note || "—"}</div>
              </div>
            </div>
            <Button size="sm" variant="primary" className="btn--xl" onClick={saveAndPrint} disabled={saving}>
              <Icon name="download" size={16} /> {saving ? "Čuvam…" : "Sačuvaj i štampaj (PDF)"}
            </Button>
          </div>
        </div>
      </div>
      {toast && <div className="toast">{toast}</div>}
    </>
  );
}
