import React, { useEffect, useMemo, useState } from "react";
import { Button } from "../components/ui";
import { Icon } from "../components/icons";
import { eur } from "../lib/format";
import { ipc } from "../lib/ipc";

type Device = any;

const STATUS_COLS: { id: string; label: string }[] = [
  { id: "kupljen", label: "Kupljeni / Äeka" },
  { id: "ceka_delove", label: "ÄŒekaju delove" },
  { id: "u_popravci", label: "U popravci" },
  { id: "qc", label: "Testiranje / QC" },
  { id: "spreman", label: "Spremni za prodaju" },
  { id: "prodat", label: "Prodat" },
];

const DIAG_ITEMS = [
  ["ekran", "Ekran"], ["face_id", "Face ID"], ["touch_id", "Touch ID"], ["baterija", "Baterija"], ["zadnje_staklo", "Zadnje staklo"], ["maticna", "MatiÄna ploÄa"], ["kamera", "Kamera (prednja/zadnja)"], ["zvucnik", "ZvuÄnik/mikrofon"], ["punjenje", "Punjenje/konektor"], ["mreza", "MreÅ¾a/SIM/Wi-Fi/BT"], ["kuciste", "KuÄ‡iÅ¡te/tasteri"], ["ostalo", "Ostalo"],
] as const;
const QC_ITEMS = [
  ["zvuk_mikrofon", "ZvuÄnici i mikrofon (pozivi)"], ["truetone_face", "TrueTone i Face ID / Touch ID"], ["kamere", "Kamere (prednja/zadnja, fokus, portret)"], ["mreza", "Wi-Fi, Bluetooth, mobilna mreÅ¾a (SIM)"], ["baterija_punjenje", "Stanje baterije (%) i punjenje"], ["icloud", "iCloud status (Äist / otkljuÄan)"],
] as const;

function emptyDevice(): Device {
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

function inferFromImei(imei: string): Partial<Device> {
  // No public TAC DB bundled; provide lightweight hints/normalization.
  const v = (imei || "").replace(/\D/g, "");
  const out: any = {};
  if (v.length >= 8) out.imei = v;
  return out;
}

export function Inventory() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [selected, setSelected] = useState<Device | null>(null);
  const [mode, setMode] = useState<"board"|"list"|"finance">("board");
  const [toast, setToast] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [partsCatalog, setPartsCatalog] = useState<any[]>([]);

  const load = async () => {
    const d = await ipc.listDevices();
    if (Array.isArray(d)) setDevices(d);
    const p = await ipc.listPartsPrices();
    if (Array.isArray(p)) setPartsCatalog(p);
  };
  useEffect(() => { load(); }, []);

  const notify = (m: string) => { setToast(m); setTimeout(()=>setToast(null), 3200); };

  const saveDevice = async (dev: Device) => {
    setBusy(true);
    try {
      const id = await ipc.upsertDevice(dev);
      if (id && !dev.id) dev.id = id;
      notify("SaÄuvano");
      await load();
      // refresh selected from latest
      if (dev.id) {
        const fresh = (await ipc.listDevices() || []).find((x:any)=>x.id===dev.id);
        if (fresh) setSelected(fresh);
      }
    } catch (e) { notify("GreÅ¡ka: " + String(e).slice(0,120)); }
    setBusy(false);
  };

  const removeDevice = async (id: number) => {
    if (!window.confirm("Obrisati ovaj ureÄ‘aj/nalog?")) return;
    await ipc.deleteDevice(id);
    setSelected(null);
    await load();
  };

  const newIntake = () => { setSelected(emptyDevice()); };

  const byStatus = useMemo(() => {
    const m: Record<string, Device[]> = {};
    for (const c of STATUS_COLS) m[c.id] = [];
    for (const d of devices) { (m[d.status] ||= []).push(d); }
    return m;
  }, [devices]);

  const totals = useMemo(() => {
    const sold = devices.filter(d=>d.status==="prodat");
    const revenue = sold.reduce((a,d)=>a+(Number(d.sale_price_eur)||0),0);
    const cost = sold.reduce((a,d)=>a+(Number(d.total_cost_eur)||0),0);
    const profit = revenue - cost;
    const inStock = devices.filter(d=>d.status!=="prodat");
    const lockedCapital = inStock.reduce((a,d)=>a+(Number(d.total_cost_eur)||0),0);
    const byModel: Record<string,{count:number, profit:number}> = {};
    for (const d of sold) {
      const k = d.model || "Nepoznato";
      byModel[k] = byModel[k] || {count:0, profit:0};
      byModel[k].count++; byModel[k].profit += Number(d.profit_eur)||0;
    }
    return { soldCount: sold.length, revenue, cost, profit, lockedCapital, inStockCount: inStock.length, byModel };
  }, [devices]);

  return (
    <>
      <div className="page-head">
        <div>
          <div className="label">Nalozi Â· Inventar</div>
          <h1 className="page-title">Servisni <em>nalozi</em> i prodaja.</h1>
          <p className="page-sub">Prijem, dijagnostika, popravka, QC, prodaja i profit â€” sve na jednom mestu.</p>
        </div>
        <div style={{ display:"flex", gap:6, alignItems:"center", flexWrap:"wrap" }}>
          <Button size="sm" variant={mode==="board"?"primary":"ghost"} onClick={()=>setMode("board")}>Kanban</Button>
          <Button size="sm" variant={mode==="list"?"primary":"ghost"} onClick={()=>setMode("list")}>Lista</Button>
          <Button size="sm" variant={mode==="finance"?"primary":"ghost"} onClick={()=>setMode("finance")}>Finansije</Button>
          <Button size="sm" variant="primary" onClick={newIntake}><Icon name="plus" size={13}/> Novi prijem</Button>
        </div>
      </div>

      <div className="stats" style={{ marginBottom: 12 }}>
        <div className="stat"><div className="stat-label">Na stanju</div><div className="stat-value">{totals.inStockCount}</div><div className="stat-note">ureÄ‘aja u obradi/na prodaju</div></div>
        <div className="stat"><div className="stat-label">Vezan kapital</div><div className="stat-value">{eur(totals.lockedCapital)}</div><div className="stat-note">nabavka+delovi+troÅ¡kovi</div></div>
        <div className="stat"><div className="stat-label">Prodato</div><div className="stat-value">{totals.soldCount}</div><div className="stat-note">ureÄ‘aja</div></div>
        <div className="stat"><div className="stat-label">Neto profit</div><div className={`stat-value ${totals.profit>=0?"is-pos":"is-neg"}`}>{totals.profit>=0?"+":""}{eur(totals.profit)}</div><div className="stat-note">prihod {eur(totals.revenue)}</div></div>
      </div>

      {mode === "finance" && <FinanceView totals={totals} devices={devices} />}
      {mode === "board" && (
        <div style={{ display:"grid", gridTemplateColumns:"repeat(6, minmax(180px,1fr))", gap:10, overflowX:"auto", alignItems:"start" }}>
          {STATUS_COLS.map(col => (
            <div key={col.id} className="card" style={{ minHeight: 220 }}>
              <div className="card-h"><b style={{ fontSize:12 }}>{col.label}</b><span className="faint">{(byStatus[col.id]||[]).length}</span></div>
              <div className="card-b" style={{ display:"grid", gap:8 }}>
                {(byStatus[col.id]||[]).map(d => (
                  <button key={d.id} className="rowline" style={{ textAlign:"left", border:"1px solid var(--line)", borderRadius:8, padding:8, background:"var(--surface)" }} onClick={()=>setSelected(d)}>
                    <div className="rowline-label">
                      <b style={{ fontSize:12 }}>{d.model || "UreÄ‘aj"} {d.storage_gb?`${d.storage_gb}GB`:""}</b>
                      <span>{d.imei ? `IMEI ${String(d.imei).slice(-6)}` : (d.source_seller || "â€”")} Â· {eur(d.buy_price_eur||0)}</span>
                    </div>
                    {d.profit_eur!=null && <span className="money" style={{ color: d.profit_eur>=0?"var(--pos)":"var(--neg)" }}>{d.profit_eur>=0?"+":""}{eur(d.profit_eur)}</span>}
                  </button>
                ))}
                {(byStatus[col.id]||[]).length===0 && <div className="faint" style={{ fontSize:11 }}>â€”</div>}
              </div>
            </div>
          ))}
        </div>
      )}
      {mode === "list" && (
        <div className="card"><div className="card-b" style={{ padding:0 }}>
          <table className="table"><thead><tr><th>Model</th><th>IMEI</th><th>Status</th><th className="num">Nabavka</th><th className="num">TroÅ¡kovi</th><th className="num">Prodaja</th><th className="num">Profit</th></tr></thead>
          <tbody>{devices.map(d=>(
            <tr key={d.id} onClick={()=>setSelected(d)} style={{cursor:"pointer"}}>
              <td><b>{d.model||"â€”"}</b> <span className="faint">{d.storage_gb?`${d.storage_gb}GB`:""}</span></td>
              <td className="mono" style={{fontSize:11}}>{d.imei||"â€”"}</td>
              <td><span className="faint">{STATUS_COLS.find(s=>s.id===d.status)?.label||d.status}</span></td>
              <td className="num">{eur(d.buy_price_eur||0)}</td>
              <td className="num">{eur((d.parts_cost_eur||0)+(d.hidden_cost_eur||0))}</td>
              <td className="num">{d.sale_price_eur!=null?eur(d.sale_price_eur):"â€”"}</td>
              <td className="num" style={{color: (d.profit_eur||0)>=0?"var(--pos)":"var(--neg)"}}>{d.profit_eur!=null?`${d.profit_eur>=0?"+":""}${eur(d.profit_eur)}`:"â€”"}</td>
            </tr>
          ))}{devices.length===0 && <tr><td colSpan={7} className="faint">Nema unosa. Klikni â€žNovi prijemâ€œ.</td></tr>}</tbody></table>
        </div></div>
      )}

      {selected && <DeviceEditor dev={selected} onClose={()=>setSelected(null)} onSave={saveDevice} onDelete={removeDevice} busy={busy} partsCatalog={partsCatalog} notify={notify} />}

      {toast && <div className="toast">{toast}</div>}
    </>
  );
}

function FinanceView({ totals, devices }: { totals: any; devices: Device[] }) {
  const rows = Object.entries(totals.byModel || {}).map(([model, v]: any) => ({ model, ...v })).sort((a,b)=>b.profit-a.profit);
  return (
    <div className="grid-side" style={{ alignItems:"start" }}>
      <div className="card"><div className="card-h"><b>Profit po modelu (prodate)</b></div>
        <div className="card-b" style={{padding:0}}>
          <table className="table"><thead><tr><th>Model</th><th className="num">Kom.</th><th className="num">Profit</th><th className="num">Prosek</th></tr></thead>
          <tbody>{rows.map(r=>(
            <tr key={r.model}><td>{r.model}</td><td className="num">{r.count}</td><td className="num" style={{color:r.profit>=0?"var(--pos)":"var(--neg)"}}>{r.profit>=0?"+":""}{eur(r.profit)}</td><td className="num">{eur(r.count? r.profit/r.count : 0)}</td></tr>
          ))}{rows.length===0 && <tr><td colSpan={4} className="faint">JoÅ¡ nema prodatih ureÄ‘aja.</td></tr>}</tbody></table>
        </div>
      </div>
      <div className="card"><div className="card-h"><b>Pregled</b></div>
        <div className="card-b">
          <dl className="kv">
            <dt>Ukupan prihod (prodato)</dt><dd className="money">{eur(totals.revenue)}</dd>
            <dt>Ukupni troÅ¡ak (prodato)</dt><dd className="money">{eur(totals.cost)}</dd>
            <dt>Neto profit</dt><dd className="money" style={{color: totals.profit>=0?"var(--pos)":"var(--neg)"}}><b>{totals.profit>=0?"+":""}{eur(totals.profit)}</b></dd>
            <dt>Kapital u lageru/obradi</dt><dd className="money">{eur(totals.lockedCapital)}</dd>
            <dt>UreÄ‘aja na stanju</dt><dd>{totals.inStockCount}</dd>
          </dl>
          <p className="faint" style={{marginTop:8,fontSize:11}}>Saveti: prati koji modeli daju najveÄ‡u marÅ¾u i drÅ¾i kapital u obradi pod kontrolom (delovi na vreme, brÅ¾i QC/prodaja).</p>
        </div>
      </div>
    </div>
  );
}

function DeviceEditor({ dev, onClose, onSave, onDelete, busy, partsCatalog, notify }: { dev: Device; onClose:()=>void; onSave:(d:Device)=>void; onDelete:(id:number)=>void; busy:boolean; partsCatalog:any[]; notify:(m:string)=>void }) {
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
    const model = [d.model, d.storage_gb?`${d.storage_gb}GB`:"", d.color||""].filter(Boolean).join(" ") || "iPhone";
    const bat = d.battery_health!=null ? `Zdravlje baterije ${d.battery_health}%. ` : "";
    const notes = [];
    if (d.qc?.truetone_face) notes.push("TrueTone/Face ID provereni i rade");
    if (d.qc?.icloud || d.icloud_clear) notes.push("iCloud Äist/otkljuÄan");
    const repairs = (d.repair_notes||"").trim();
    const repTxt = repairs ? `IzvrÅ¡ene intervencije: ${repairs}. ` : "";
    const warranty = "Garancija (dogovor).";
    const accessories = "Uz telefon: (navedite prilog).";
    const text = `Na prodaju ${model}.\nTelefon je proveren i funkcionalan. ${repTxt}${bat}${notes.length?notes.join(". ")+". ":""}\n${accessories}\n${warranty}\nKontakt: ______`;
    navigator.clipboard?.writeText(text);
    notify("Opis oglasa generisan i kopiran (moÅ¾eÅ¡ ga izmeniti/koristiti).");
    set("sale_notes", (d.sale_notes? d.sale_notes+"\n\n":"") + text);
  };

  const applyImei = () => {
    const inf = inferFromImei(d.imei||"");
    setD((x:any)=>({...x, ...inf}));
    notify("IMEI unet/normalizovan. Za detalje koristi iUnlocker proveru.");
  };

  const lookupImei = async () => {
    const imei = String(d.imei||"").replace(/\D/g,"").trim();
    if (!imei) { notify("Unesi IMEI prvo."); return; }
    const url = `https://iunlocker.com/check_imei.php?imei=${encodeURIComponent(imei)}`;
    try {
      await ipc.openExternalUrl(url);
      notify("Otvoren iUnlocker u browseru za IMEI proveru.");
    } catch {
      window.open(url, "_blank");
      notify("Otvoren iUnlocker u novom tabu za IMEI proveru.");
    }
  };

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.35)", zIndex:40, display:"flex", justifyContent:"flex-end" }} onClick={(e)=>{ if(e.target===e.currentTarget) onClose(); }}>
      <div className="card" style={{ width:"min(980px, 96vw)", height:"100%", borderRadius:0, overflow:"auto" }}>
        <div className="card-h" style={{ position:"sticky", top:0, background:"var(--surface)", zIndex:2 }}>
          <b>{d.id ? `Nalog #${d.id}` : "Novi prijem ureÄ‘aja"}</b>
          <div style={{display:"flex", gap:6, flexWrap:"wrap"}}>
            {d.id && <Button size="sm" variant="ghost" onClick={()=>onDelete(d.id)}>ObriÅ¡i</Button>}
            <Button size="sm" variant="ghost" onClick={onClose}>Zatvori</Button>
            <Button size="sm" variant="primary" onClick={()=>onSave(d)} disabled={busy}>{busy?"ÄŒuvamâ€¦":"SaÄuvaj"}</Button>
          </div>
        </div>
        <div className="card-b" style={{ display:"grid", gap:14 }}>
          <section>
            <div className="label" style={{marginBottom:6}}>1. Prijem i nabavka</div>
            <div style={{display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:8}}>
              <div><div className="label">IMEI</div><div style={{display:"flex",gap:4}}><input className="input" value={d.imei||""} onChange={e=>set("imei",e.target.value)} placeholder="IMEI (sken/unos)" style={{width:"100%"}}/><Button size="sm" variant="ghost" onClick={applyImei}>OK</Button><Button size="sm" variant="ghost" onClick={lookupImei}>iUnlocker</Button></div><div className="faint" style={{fontSize:10,marginTop:4}}>OK normalizuje unos; iUnlocker otvara proveru (model/garancija/status) u browseru.</div></div>
              <div><div className="label">Serijski br.</div><input className="input" value={d.serial||""} onChange={e=>set("serial",e.target.value)} style={{width:"100%"}}/></div>
              <div><div className="label">Model</div><input className="input" value={d.model||""} onChange={e=>set("model",e.target.value)} placeholder="npr. iPhone 13 Pro" style={{width:"100%"}}/></div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}>
                <div><div className="label">Mem. (GB)</div><input className="input" type="number" value={d.storage_gb||""} onChange={e=>set("storage_gb",parseInt(e.target.value)||0)} style={{width:"100%"}}/></div>
                <div><div className="label">Boja</div><input className="input" value={d.color||""} onChange={e=>set("color",e.target.value)} style={{width:"100%"}}/></div>
              </div>
              <div><div className="label">Nabavna cena (â‚¬)</div><input className="input" type="number" value={d.buy_price_eur||0} onChange={e=>set("buy_price_eur",parseFloat(e.target.value)||0)} style={{width:"100%"}}/></div>
              <div><div className="label">Datum kupovine</div><input className="input" type="date" value={d.buy_date||""} onChange={e=>set("buy_date",e.target.value)} style={{width:"100%"}}/></div>
              <div><div className="label">Od koga (kontakt)</div><input className="input" value={d.source_seller||""} onChange={e=>set("source_seller",e.target.value)} placeholder="prodavac/kontakt" style={{width:"100%"}}/></div>
              <div><div className="label">Status</div>
                <select className="select" value={d.status||"kupljen"} onChange={e=>set("status",e.target.value)} style={{width:"100%"}}>
                  {STATUS_COLS.map(s=> <option key={s.id} value={s.id}>{s.label}</option>)}
                </select>
              </div>
            </div>
            <div style={{marginTop:8}}><div className="label">Napomena nabavke (garancija porekla/sigurnost)</div><input className="input" value={d.buy_notes||""} onChange={e=>set("buy_notes",e.target.value)} style={{width:"100%"}}/></div>
          </section>

          <section>
            <div className="label" style={{marginBottom:6}}>2. Dijagnostika (Å¡ta ne radi)</div>
            <div style={{display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:6}}>
              {DIAG_ITEMS.map(([k,label])=>(
                <label key={k} style={{display:"flex",gap:6,alignItems:"center",fontSize:12}}><input type="checkbox" checked={!!d.diagnostics?.[k]} onChange={e=>setDiag(k,e.target.checked)}/> {label}</label>
              ))}
            </div>
          </section>

          <section>
            <div className="label" style={{marginBottom:6}}>3. Popravka, delovi i troÅ¡kovi</div>
            <div style={{display:"grid", gridTemplateColumns:"1fr 1fr 1fr 1fr", gap:8, marginBottom:8}}>
              <div><div className="label">Serviser / ko radi</div><input className="input" value={d.servicer||""} onChange={e=>set("servicer",e.target.value)} style={{width:"100%"}}/></div>
              <div><div className="label">Delovi ukupno (â‚¬)</div><input className="input" type="number" value={d.parts_cost_eur||0} onChange={e=>set("parts_cost_eur",parseFloat(e.target.value)||0)} style={{width:"100%"}}/></div>
              <div><div className="label">Skriveni troÅ¡kovi (â‚¬)</div><input className="input" type="number" value={d.hidden_cost_eur||0} onChange={e=>set("hidden_cost_eur",parseFloat(e.target.value)||0)} placeholder="poÅ¡tarina, sitno..." style={{width:"100%"}}/></div>
              <div><div className="label">Preporuka cene (â‰ˆ25% marÅ¾a)</div><div className="money" style={{padding:"8px 0"}}>{recPrice!=null?eur(recPrice):"â€”"}</div></div>
            </div>
            <div style={{marginBottom:8}}><div className="label">Stavke delova (dobavljaÄ/tip/cena)</div>
              <table className="table"><thead><tr><th>Deo/opis</th><th>Tip</th><th>DobavljaÄ</th><th className="num">Cena (â‚¬)</th><th></th></tr></thead>
              <tbody>{(d.parts_items||[]).map((it:any,i:number)=>(
                <tr key={i}><td><input className="input" value={it.name||""} onChange={e=>setPartItem(i,"name",e.target.value)} style={{width:"100%"}}/></td>
                <td><select className="select" value={it.type||"zamenski"} onChange={e=>setPartItem(i,"type",e.target.value)}><option value="original">Original</option><option value="zamenski">Zamenski</option><option value="pulled">Pulled</option></select></td>
                <td><input className="input" value={it.supplier||""} onChange={e=>setPartItem(i,"supplier",e.target.value)} style={{width:"100%"}}/></td>
                <td className="num"><input className="input" type="number" value={it.cost||0} onChange={e=>setPartItem(i,"cost",parseFloat(e.target.value)||0)} style={{width:90,textAlign:"right"}}/></td>
                <td><button className="icon-btn" onClick={()=>rmPartItem(i)}><Icon name="close" size={14}/></button></td></tr>
              ))}</tbody></table>
              <div style={{display:"flex",justifyContent:"space-between",marginTop:6}}><Button size="sm" variant="ghost" onClick={addPartItem}><Icon name="plus" size={13}/> Dodaj deo</Button><span className="faint">Zbir stavki: {eur((d.parts_items||[]).reduce((a:any,it:any)=>a+(Number(it.cost)||0),0))} (unesi i/ili uskladi â€žDelovi ukupnoâ€œ)</span></div>
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
              <div><div className="label">iCloud Äist/otkljuÄan</div><select className="select" value={d.icloud_clear==null?"":(d.icloud_clear?"da":"ne")} onChange={e=>set("icloud_clear", e.target.value===""?null:e.target.value==="da")} style={{width:"100%"}}><option value="">Nepoznato</option><option value="da">Da</option><option value="ne">Ne</option></select></div>
              <div style={{display:"flex",alignItems:"end"}}><Button size="sm" variant="ghost" onClick={()=>set("status","spreman")}>OznaÄi: Spreman za prodaju</Button></div>
            </div>
          </section>

          <section>
            <div className="label" style={{marginBottom:6}}>5. Prodaja i finansije</div>
            <div style={{display:"grid", gridTemplateColumns:"1fr 1fr 1fr 1fr", gap:8}}>
              <div><div className="label">Prodajna cena (â‚¬)</div><input className="input" type="number" value={d.sale_price_eur??""} onChange={e=>set("sale_price_eur", e.target.value===""?null:parseFloat(e.target.value))} style={{width:"100%"}}/></div>
              <div><div className="label">Platforma</div><input className="input" value={d.sale_platform||""} onChange={e=>set("sale_platform",e.target.value)} placeholder="KP, Instagram, FB, uÅ¾ivo..." style={{width:"100%"}}/></div>
              <div><div className="label">Datum prodaje</div><input className="input" type="date" value={d.sale_date||""} onChange={e=>set("sale_date",e.target.value)} style={{width:"100%"}}/></div>
              <div style={{display:"flex",alignItems:"end"}}><Button size="sm" variant="ghost" onClick={()=>set("status","prodat")}>OznaÄi: Prodat</Button></div>
            </div>
            <div className="card" style={{marginTop:8}}><div className="card-b">
              <dl className="kv">
                <dt>Ukupna cena (nabavka+delovi+skriveno)</dt><dd className="money">{eur(totalCost)}</dd>
                <dt>Neto profit</dt><dd className="money" style={{color: profit==null?"var(--muted)": profit>=0?"var(--pos)":"var(--neg)"}}><b>{profit==null?"â€”":`${profit>=0?"+":""}${eur(profit)}`}</b></dd>
                <dt>MarÅ¾a</dt><dd className="money">{profit!=null && d.sale_price_eur? `${(((profit)/(Number(d.sale_price_eur)||1))*100).toFixed(1)}%`:"â€”"}</dd>
              </dl>
            </div></div>
          </section>

          <section>
            <div className="label" style={{marginBottom:6}}>6. Oglas i slike</div>
            <div style={{display:"flex", gap:8, flexWrap:"wrap", marginBottom:8}}>
              <Button size="sm" variant="primary" onClick={genAd}><Icon name="plus" size={13}/> GeneriÅ¡i opis oglasa</Button>
              <Button size="sm" variant="ghost" onClick={()=>addImage("images_before")}>Dodaj sliku PRE</Button>
              <Button size="sm" variant="ghost" onClick={()=>addImage("images_after")}>Dodaj sliku POSLE</Button>
            </div>
            <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:8}}>
              <div><div className="label">Slike pre popravke ({(d.images_before||[]).length})</div><ul className="faint" style={{fontSize:11,margin:0,paddingLeft:16}}>{(d.images_before||[]).map((p:string,i:number)=><li key={i}>{p}</li>)}</ul></div>
              <div><div className="label">Slike posle popravke ({(d.images_after||[]).length})</div><ul className="faint" style={{fontSize:11,margin:0,paddingLeft:16}}>{(d.images_after||[]).map((p:string,i:number)=><li key={i}>{p}</li>)}</ul></div>
            </div>
            <div style={{marginTop:8}}><div className="label">Tekst oglasa / napomene prodaje</div><textarea className="input" rows={5} value={d.sale_notes||""} onChange={e=>set("sale_notes",e.target.value)} placeholder="Generisani ili ruÄni opis za KP/Instagram/FB..." style={{width:"100%",resize:"vertical"}}/></div>
          </section>
        </div>
      </div>
    </div>
  );
}


