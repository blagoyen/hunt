import React, { useState } from "react";
import { Button, Toggle } from "../components/ui";
import { marketStats, repairCatalog, maxBidOf, DEFAULT_TARGET_MARGIN, SHIPPING } from "../lib/deal";
import { eur, pct } from "../lib/format";

export function Market() {
  const [active, setActive] = useState(marketStats[0].model);
  const stat = marketStats.find((m) => m.model === active)!;

  const trend = stat.trend;
  const min = Math.min(...trend.map((p) => p.p));
  const max = Math.max(...trend.map((p) => p.p));
  const span = max - min || 1;
  const path = trend
    .map((p, i) => {
      const x = 12 + (i / (trend.length - 1)) * 696;
      const y = 10 + (1 - (p.p - min) / span) * 170;
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  const area = `${path} L708,180 L12,180 Z`;

  // Calculator state
  const [model, setModel] = useState(repairCatalog[0].model);
  const [storage, setStorage] = useState(128);
  const [price, setPrice] = useState(250);
  const [parts, setParts] = useState({ display: true, battery: false, back: false, camera: false, faceid: false });
  const [margin, setMargin] = useState(DEFAULT_TARGET_MARGIN);
  const row = repairCatalog.find((r) => r.model === model)!;
  const marketPrice = (() => {
    const map: Record<string, number> = { "iPhone 13 Pro": 495, "iPhone 13": 340, "iPhone 14 Pro": 640, "iPhone 12": 270, "iPhone 16 Pro Max": 1080 };
    return (map[model] ?? 500) + (storage > 128 ? 80 : 0);
  })();
  const repairCost = (parts.display ? row.display : 0) + (parts.battery ? row.battery : 0) + (parts.back ? row.back : 0) + (parts.camera ? row.camera : 0) + (parts.faceid ? row.faceid : 0);
  const labor = Math.round(repairCost * 0.55);
  const totalCost = price + repairCost + labor + SHIPPING;
  const profit = marketPrice - totalCost;
  const marginReal = marketPrice > 0 ? profit / marketPrice : 0;
  const mb = maxBidOf({ repairCost: repairCost + labor, marketPrice }, margin);
  const toggle = (k: keyof typeof parts) => setParts((p) => ({ ...p, [k]: !p[k] }));
  const warn = profit < 0 || marginReal < margin;

  return (
    <>
      <div className="page-head">
        <div>
          <div className="label">05 — Tržište</div>
          <h1 className="page-title">Cene i <em>isplativost</em>.</h1>
          <p className="page-sub">Prati tržišne medijane i brzo proceni da li se nabavka isplati pre kupovine.</p>
        </div>
        <div className="head-meta"><span>Prozor <b>30 dana</b></span><span>Modela <b>{marketStats.length}</b></span></div>
      </div>

      <div className="grid-side">
        <div className="card">
          <div className="card-h"><b>Modeli</b></div>
          <div className="model-list">
            {marketStats.map((m) => (
              <button key={m.model} className={`model-row${active === m.model ? " is-active" : ""}`} onClick={() => setActive(m.model)}>
                <div className="grow"><b>{m.model}</b><span>p50 {eur(m.variants[0].p50)} · {m.sold30d} prodaja</span></div>
                <span className="mono">{m.liquidityDays}d</span>
              </button>
            ))}
          </div>
        </div>

        <div className="stack">
          <div className="stats">
            {stat.variants.map((v) => (
              <div className="stat" key={v.storage}><div className="stat-label">{v.storage} GB · p50</div><div className="stat-value">{eur(v.p50)}</div><div className="stat-note">p25 {eur(v.p25)} · p75 {eur(v.p75)}</div></div>
            ))}
            <div className="stat"><div className="stat-label">Likvidnost</div><div className="stat-value">{stat.liquidityDays}d</div><div className="stat-note">{stat.sold30d} prodaja / 30d</div></div>
          </div>

          <div className="card">
            <div className="card-h"><b>{stat.model} · trend 30 dana</b><span className="faint mono" style={{ fontSize: 8.5 }}>p50</span></div>
            <div className="card-b">
              <svg className="chart" viewBox="0 0 720 200" preserveAspectRatio="none" style={{ height: 160 }}>
                <line className="grid-line" x1="12" y1="10" x2="708" y2="10" />
                <line className="grid-line" x1="12" y1="100" x2="708" y2="100" />
                <line className="grid-line" x1="12" y1="190" x2="708" y2="190" />
                <path d={area} className="area" />
                <path d={path} className="line" />
                {trend.map((p, i) => {
                  const x = 12 + (i / (trend.length - 1)) * 696;
                  const y = 10 + (1 - (p.p - min) / span) * 170;
                  return <circle key={i} cx={x} cy={y} r={i === trend.length - 1 ? 3 : 1.5} className="dot" />;
                })}
              </svg>
            </div>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 14 }}>
        <div className="card-h"><b>Kalkulator isplativosti</b><span className="faint" style={{ fontSize: 11 }}>tržišna cena − (nabavka + delovi/rad) = zarada</span></div>
        <div className="card-b">
          <div className="grid-side" style={{ alignItems: "start" }}>
            <div style={{ display: "grid", gap: 10 }}>
              <div><div className="label" style={{ marginBottom: 6 }}>Model</div>
                <select className="select" value={model} onChange={(e) => setModel(e.target.value)} style={{ width: "100%" }}>
                  {repairCatalog.map((r) => <option key={r.model} value={r.model}>{r.model}</option>)}
                </select>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <div><div className="label" style={{ marginBottom: 6 }}>Memorija</div>
                  <select className="select" value={storage} onChange={(e) => setStorage(parseInt(e.target.value))} style={{ width: "100%" }}>
                    <option value={64}>64 GB</option><option value={128}>128 GB</option><option value={256}>256 GB</option><option value={512}>512 GB</option>
                  </select>
                </div>
                <div><div className="label" style={{ marginBottom: 6 }}>Target marža %</div>
                  <input className="input" type="number" value={Math.round(margin * 100)} onChange={(e) => setMargin((parseInt(e.target.value) || 0) / 100)} style={{ width: "100%" }} />
                </div>
              </div>
              <div><div className="label" style={{ marginBottom: 6 }}>Cena nabavke (€)</div>
                <input className="input" type="number" value={price} onChange={(e) => setPrice(parseInt(e.target.value) || 0)} style={{ width: "100%" }} />
              </div>
              <div>
                <div className="label" style={{ marginBottom: 6 }}>Potrebni delovi/popravke</div>
                {([ ["display","Ekran"],["battery","Baterija"],["back","Zadnje staklo"],["camera","Kamera"],["faceid","Face ID"] ] as const).map(([k,label]) => (
                  <div key={k} className="rowline"><span>{label}</span><Toggle on={parts[k as keyof typeof parts]} onChange={() => toggle(k as keyof typeof parts)} label="" /></div>
                ))}
              </div>
            </div>

            <div className="stack">
              <div className="stats">
                <div className="stat"><div className="stat-label">Očekivana zarada</div><div className={`stat-value${profit >= 0 ? " is-pos" : " is-neg"}`}>{profit >= 0 ? "+" : ""}{eur(profit)}</div><div className="stat-note">marža {pct(marginReal)}</div></div>
                <div className="stat"><div className="stat-label">Max nabavka</div><div className="stat-value">{eur(mb)}</div><div className="stat-note">za ciljanu maržu</div></div>
                <div className="stat"><div className="stat-label">Ukupni trošak</div><div className="stat-value">{eur(totalCost)}</div><div className="stat-note">nabavka + delovi + rad</div></div>
                <div className="stat"><div className="stat-label">Prodaja (p50)</div><div className="stat-value">{eur(marketPrice)}</div><div className="stat-note">tržišna medijana</div></div>
              </div>
              <div className="card" style={{ borderColor: warn ? "var(--neg)" : "var(--line)" }}>
                <div className="card-b">
                  {warn ? <div style={{ color: "var(--neg)", fontSize: 12, marginBottom: 8 }}><b>Upozorenje:</b> zarada/marža je ispod cilja ili negativna — posao se možda ne isplati.</div> : <div style={{ color: "var(--pos)", fontSize: 12, marginBottom: 8 }}><b>OK:</b> procena je u okviru ciljne marže.</div>}
                  <dl className="kv">
                    <dt>Nabavka</dt><dd className="money">{eur(price)}</dd>
                    <dt>Delovi</dt><dd className="money">{eur(repairCost)}</dd>
                    <dt>Rad</dt><dd className="money">{eur(labor)}</dd>
                    <dt>Transport</dt><dd className="money">{eur(SHIPPING)}</dd>
                    <dt>Ukupno</dt><dd className="money"><b>{eur(totalCost)}</b></dd>
                  </dl>
                  <div style={{ marginTop: 8 }}><span className="faint" style={{ fontSize: 11 }}>Formula: {eur(marketPrice)} − ({eur(price)} + {eur(repairCost + labor)} + {eur(SHIPPING)}) = {profit >= 0 ? "+" : ""}{eur(profit)}</span></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
