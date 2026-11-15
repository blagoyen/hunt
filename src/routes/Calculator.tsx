import React, { useMemo, useState } from "react";
import { Icon } from "../components/icons";
import { Button, Toggle } from "../components/ui";import { repairCatalog, maxBidOf, DEFAULT_TARGET_MARGIN, SHIPPING } from "../lib/deal";
import { eur, pct } from "../lib/format";

export function Calculator() {
  const [model, setModel] = useState(repairCatalog[0].model);
  const [storage, setStorage] = useState(128);
  const [price, setPrice] = useState(250);
  const [parts, setParts] = useState({
    display: true,
    battery: false,
    back: false,
    camera: false,
    faceid: false,
  });
  const [margin, setMargin] = useState(DEFAULT_TARGET_MARGIN);

  const row = repairCatalog.find((r) => r.model === model)!;
  const marketPrice = (() => {
    const map: Record<string, number> = {
      "iPhone 13 Pro": 495,
      "iPhone 13": 340,
      "iPhone 14 Pro": 640,
      "iPhone 12": 270,
      "iPhone 16 Pro Max": 1080,
    };
    return (map[model] ?? 500) + (storage > 128 ? 80 : 0);
  })();

  const repairCost =
    (parts.display ? row.display : 0) +
    (parts.battery ? row.battery : 0) +
    (parts.back ? row.back : 0) +
    (parts.camera ? row.camera : 0) +
    (parts.faceid ? row.faceid : 0);
  const labor = Math.round(repairCost * 0.55);
  const totalCost = price + repairCost + labor + SHIPPING;
  const profit = marketPrice - totalCost;
  const marginReal = marketPrice > 0 ? profit / marketPrice : 0;
  const mb = maxBidOf({ repairCost: repairCost + labor, marketPrice }, margin);

  const toggle = (k: keyof typeof parts) => setParts((p) => ({ ...p, [k]: !p[k] }));

  const scenarios = [
    { name: "Bolji", market: Math.round(marketPrice * 1.08) },
    { name: "Prosečan", market: marketPrice },
    { name: "Najgori", market: Math.round(marketPrice * 0.92) },
  ].map((s) => ({ ...s, profit: s.market - totalCost }));

  return (
    <>
      <div className="page-head">
        <div>
          <div className="label">04 — Kalkulator</div>
          <h1 className="page-title">
            Da li se <em>isplati</em>.
          </h1>
          <p className="page-sub">
            Unesi kupovnu cenu i oštećenja — dobijaš profit, maržu i max bid.
          </p>
        </div>
        <div className="head-meta">
          <span>
            Target marža <b>{(margin * 100).toFixed(0)}%</b>
          </span>
          <span>
            Transport <b>{eur(SHIPPING)}</b>
          </span>
        </div>
      </div>

      <div className="grid-side">
        <div className="stack">
          <div className="card">
            <div className="card-h">
              <b>Ulaz</b>
            </div>
            <div className="card-b">
              <div style={{ marginBottom: 12 }}>
                <div className="label" style={{ marginBottom: 6 }}>
                  Model
                </div>
                <select
                  className="select"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  style={{ width: "100%" }}
                >
                  {repairCatalog.map((r) => (
                    <option key={r.model} value={r.model}>
                      {r.model}
                    </option>
                  ))}
                </select>
              </div>
              <div style={{ marginBottom: 12 }}>
                <div className="label" style={{ marginBottom: 6 }}>
                  Memorija
                </div>
                <select
                  className="select"
                  value={storage}
                  onChange={(e) => setStorage(parseInt(e.target.value))}
                  style={{ width: "100%" }}
                >
                  <option value={64}>64 GB</option>
                  <option value={128}>128 GB</option>
                  <option value={256}>256 GB</option>
                  <option value={512}>512 GB</option>
                </select>
              </div>
              <div style={{ marginBottom: 12 }}>
                <div className="label" style={{ marginBottom: 6 }}>
                  Kupovna cena
                </div>
                <input
                  className="input num"
                  type="number"
                  value={price}
                  onChange={(e) => setPrice(parseInt(e.target.value) || 0)}
                  style={{ width: "100%" }}
                />
              </div>
              <div style={{ marginBottom: 12 }}>
                <div className="label" style={{ marginBottom: 6 }}>
                  Target marža
                </div>
                <input
                  className="input num"
                  type="number"
                  value={Math.round(margin * 100)}
                  onChange={(e) => setMargin((parseInt(e.target.value) || 0) / 100)}
                  style={{ width: "100%" }}
                />
              </div>
              <div className="label" style={{ marginBottom: 6 }}>
                Oštećenja
              </div>
              {[
                { k: "display", label: "Ekran" },
                { k: "battery", label: "Baterija" },
                { k: "back", label: "Zadnje staklo" },
                { k: "camera", label: "Kamera" },
                { k: "faceid", label: "Face ID" },
              ].map((r) => (
                <div key={r.k} className="rowline">
                  <span>{r.label}</span>
                  <Toggle
                    on={parts[r.k as keyof typeof parts]}
                    onChange={() => toggle(r.k as keyof typeof parts)}
                    label=""
                  />
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="stack">
          <div className="stats">
            <div className="stat">
              <div className="stat-label">Profit</div>
              <div className={`stat-value${profit >= 0 ? " is-pos" : " is-neg"}`}>
                {profit >= 0 ? "+" : ""}
                {eur(profit)}
              </div>
              <div className="stat-note">marža {pct(marginReal)}</div>
            </div>
            <div className="stat">
              <div className="stat-label">Max bid</div>
              <div className="stat-value">{eur(mb)}</div>
              <div className="stat-note">za ciljanu maržu</div>
            </div>
            <div className="stat">
              <div className="stat-label">Ukupni trošak</div>
              <div className="stat-value">{eur(totalCost)}</div>
              <div className="stat-note">kupovna + delovi + rad</div>
            </div>
            <div className="stat">
              <div className="stat-label">Prodaja (p50)</div>
              <div className="stat-value">{eur(marketPrice)}</div>
              <div className="stat-note">tržišna medijana</div>
            </div>
          </div>

          <div className="card">
            <div className="card-h">
              <b>Razlaganje troškova</b>
            </div>
            <div className="card-b">
              <dl className="kv">
                <dt>Kupovna</dt>
                <dd className="money">{eur(price)}</dd>
                <dt>Delovi</dt>
                <dd className="money">{eur(repairCost)}</dd>
                <dt>Rad</dt>
                <dd className="money">{eur(labor)}</dd>
                <dt>Transport</dt>
                <dd className="money">{eur(SHIPPING)}</dd>
                <dt>Ukupno</dt>
                <dd className="money">
                  <b>{eur(totalCost)}</b>
                </dd>
              </dl>
            </div>
          </div>

          <div className="card">
            <div className="card-h">
              <b>Scenariji prodaje</b>
            </div>
            <div className="card-b" style={{ padding: 0 }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>Scenarij</th>
                    <th className="num">Prodaja</th>
                    <th className="num">Profit</th>
                    <th className="num">Marža</th>
                  </tr>
                </thead>
                <tbody>
                  {scenarios.map((s) => (
                    <tr key={s.name}>
                      <td>{s.name}</td>
                      <td className="num">{eur(s.market)}</td>
                      <td className={`num${s.profit >= 0 ? "" : ""}`} style={{ color: s.profit >= 0 ? "var(--pos)" : "var(--neg)" }}>
                        {s.profit >= 0 ? "+" : ""}
                        {eur(s.profit)}
                      </td>
                      <td className="num">{pct(s.market > 0 ? s.profit / s.market : 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
