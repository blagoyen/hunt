import React, { useMemo, useState } from "react";
import { Button } from "../components/ui";
import { Icon } from "../components/icons";
import { eur } from "../lib/format";
import { DeviceEditor, type Device, STATUS_COLS, STATUS_LABEL, calcTotals, deviceTotalCost, genAdText, useDevices, printDeviceDocument, printInventoryDocument } from "./Inventory";
import { getFallbackModelImage, resolveDeviceImage } from "../lib/modelImages";

export function Lager() {
  const { devices, partsCatalog, toast, busy, notify, saveDevice, removeDevice } = useDevices();
  const [selected, setSelected] = useState<Device | null>(null);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<string>("all");

  const totals = useMemo(() => calcTotals(devices), [devices]);
  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return devices.filter((d) => {
      if (status !== "all" && d.status !== status) return false;
      if (!term) return true;
      const hay = [d.model, d.imei, d.serial, d.color, d.source_seller, d.sale_platform, d.sale_notes, STATUS_LABEL[d.status]].filter(Boolean).join(" ").toLowerCase();
      return hay.includes(term);
    });
  }, [devices, q, status]);

  const saveAndRefresh = async (dev: Device) => { await saveDevice(dev); };
  const removeAndClose = async (id: number) => { const ok = await removeDevice(id); if (ok) setSelected(null); };

  const copyAd = async (d: Device) => {
    const text = (d.sale_notes && String(d.sale_notes).trim()) || genAdText(d);
    try { await navigator.clipboard.writeText(text); notify("Tekst oglasa kopiran."); }
    catch { notify("Kopiranje nije uspelo."); }
  };

  return (
    <>
      <div className="page-head">
        <div>
          <div className="label">03 — Lager</div>
          <h1 className="page-title">Svi <em>uređaji</em> i istorija.</h1>
          <p className="page-sub">Kompletna lista, filteri i pretraga — nabavka, delovi, prodaja i profit po uređaju.</p>
        </div>
        <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
          <div className="head-meta">
            <span>Ukupno <b>{devices.length}</b></span>
            <span>Na stanju <b>{totals.inStockCount}</b></span>
            <span>Prodato <b>{totals.soldCount}</b></span>
          </div>
          <Button size="sm" variant="ghost" onClick={() => printInventoryDocument(filtered, notify)}><Icon name="download" size={13} /> Štampaj inventar</Button>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 12 }}>
        <div className="card-b" style={{ display: "grid", gridTemplateColumns: "minmax(220px, 1.6fr) minmax(180px, 1fr) auto", gap: 8, alignItems: "center" }}>
          <input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Pretraga: model, IMEI, serijski, prodavac, kupac, platforma..." />
          <select className="select" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="all">Svi statusi</option>
            {STATUS_COLS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
          <div className="faint" style={{ fontSize: 11 }}>Prikazano: <b>{filtered.length}</b></div>
        </div>
      </div>

      <div className="card"><div className="card-b" style={{ padding: 0, overflowX: "auto" }}>
        <table className="table">
          <thead>
            <tr>
              <th>Model</th>
              <th>IMEI / kontakt</th>
              <th>Status</th>
              <th className="num">Nabavka</th>
              <th className="num">Delovi</th>
              <th className="num">Troškovi</th>
              <th>Prodato</th>
              <th className="num">Prodaja</th>
              <th className="num">Profit</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((d) => {
              const tc = deviceTotalCost(d);
              const profit = d.sale_price_eur != null ? (Number(d.sale_price_eur) || 0) - tc : null;
              const ready = d.status === "spreman";
              return (
                <tr key={d.id}>
                  <td style={{ cursor: "pointer" }} onClick={() => setSelected(d)}><div style={{display:"flex",alignItems:"center",gap:8}}><div style={{width:28,height:44,display:"flex",alignItems:"center",justifyContent:"center",border:"1px solid var(--line)",borderRadius:6,background:"var(--surface)",padding:2,overflow:"hidden",flex:"0 0 auto"}}><img src={resolveDeviceImage(d)} alt="" style={{maxWidth:"100%",maxHeight:"100%",width:"auto",height:"auto",objectFit:"contain",objectPosition:"center",display:"block"}} onError={(e)=>{const el=e.currentTarget; const fb=getFallbackModelImage(d?.model||""); if(el.src!==fb) el.src=fb;}} /></div><div><b>{d.model || "—"}</b> <span className="faint">{d.storage_gb ? `${d.storage_gb}GB` : ""} {d.color || ""}</span></div></div></td>
                  <td className="mono" style={{ fontSize: 11 }}><div>{d.imei || "—"}</div><div className="faint" style={{ fontSize: 10 }}>{d.source_seller || ""}</div></td>
                  <td><span className="faint">{STATUS_LABEL[d.status] || d.status}</span></td>
                  <td className="num">{eur(Number(d.buy_price_eur) || 0)}</td>
                  <td className="num">{eur(Number(d.parts_cost_eur) || 0)}</td>
                  <td className="num">{eur(tc)}</td>
                  <td><span className="faint">{d.sale_date || (d.sale_platform ? d.sale_platform : "—")}</span></td>
                  <td className="num">{d.sale_price_eur != null ? eur(Number(d.sale_price_eur)) : "—"}</td>
                  <td className="num" style={{ color: profit == null ? "var(--muted)" : profit >= 0 ? "var(--pos)" : "var(--neg)" }}>{profit == null ? "—" : `${profit >= 0 ? "+" : ""}${eur(profit)}`}</td>
                  <td>
                    <div style={{ display: "flex", gap: 4, justifyContent: "flex-end", flexWrap:"wrap" }}>
                      <Button size="sm" variant="ghost" onClick={() => printDeviceDocument(d, notify)}>Štampaj</Button>
                      {ready && <Button size="sm" variant="ghost" onClick={() => copyAd(d)}>Kopiraj oglas</Button>}
                      <Button size="sm" variant="ghost" onClick={() => setSelected(d)}>Uredi</Button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && <tr><td colSpan={10} className="faint">Nema uređaja za prikaz.</td></tr>}
          </tbody>
        </table>
      </div></div>

      {selected && <DeviceEditor dev={selected} onClose={() => setSelected(null)} onSave={saveAndRefresh} onDelete={removeAndClose} busy={busy} partsCatalog={partsCatalog} notify={notify} />}
      {toast && <div className="toast">{toast}</div>}
    </>
  );
}
