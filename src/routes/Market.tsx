import React, { useState } from "react";
import { Icon } from "../components/icons";
import { Button } from "../components/ui";
import { marketStats } from "../lib/deal";
import { eur } from "../lib/format";

export function Market() {
  const [active, setActive] = useState(marketStats[0].model);
  const stat = marketStats.find((m) => m.model === active)!;

  const variant = stat.variants[0];
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
  const area = `${path} L${(12 + (trend.length - 1) / (trend.length - 1) * 696).toFixed(1)},180 L12,180 Z`;

  return (
    <>
      <div className="page-head">
        <div>
          <div className="label">02 — Tržište</div>
          <h1 className="page-title">
            Medijane i <em>likvidnost</em>.
          </h1>
          <p className="page-sub">
            Koliko se prodaje "ispravan" uređaj po modelu — osnova za profit i max bid.
          </p>
        </div>
        <div className="head-meta">
          <span>
            Prozor <b>30 dana</b>
          </span>
          <span>
            IQR <b>trim</b>
          </span>
        </div>
      </div>

      <div className="grid-side">
        <div className="card">
          <div className="card-h">
            <b>Modeli</b>
            <span className="faint mono" style={{ fontSize: 8.5, letterSpacing: "0.1em" }}>
              {marketStats.length}
            </span>
          </div>
          <div className="model-list">
            {marketStats.map((m) => (
              <button
                key={m.model}
                className={`model-row${active === m.model ? " is-active" : ""}`}
                onClick={() => setActive(m.model)}
              >
                <div className="grow">
                  <b>{m.model}</b>
                  <span>
                    p50 {eur(m.variants[0].p50)} · {m.sold30d} prodaja
                  </span>
                </div>
                <span className="mono">{m.liquidityDays}d</span>
              </button>
            ))}
          </div>
        </div>

        <div className="stack">
          <div className="stats">
            {stat.variants.map((v) => (
              <div className="stat" key={v.storage}>
                <div className="stat-label">{v.storage} GB · p50</div>
                <div className="stat-value">{eur(v.p50)}</div>
                <div className="stat-note">
                  p25 {eur(v.p25)} · p75 {eur(v.p75)}
                </div>
              </div>
            ))}
            <div className="stat">
              <div className="stat-label">Likvidnost</div>
              <div className="stat-value">{stat.liquidityDays}d</div>
              <div className="stat-note">{stat.sold30d} prodaja / 30d</div>
            </div>
          </div>

          <div className="card">
            <div className="card-h">
              <b>{stat.model} · trend 30 dana</b>
              <span className="faint mono" style={{ fontSize: 8.5, letterSpacing: "0.1em" }}>
                p50
              </span>
            </div>
            <div className="card-b">
              <svg className="chart" viewBox="0 0 720 200" preserveAspectRatio="none" style={{ height: 180 }}>
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

          <div className="card">
            <div className="card-h">
              <b>Rasponi po memoriji</b>
            </div>
            <div className="card-b" style={{ padding: 0 }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>Memorija</th>
                    <th className="num">p25</th>
                    <th className="num">p50</th>
                    <th className="num">p75</th>
                    <th className="num">Raspon</th>
                  </tr>
                </thead>
                <tbody>
                  {stat.variants.map((v) => (
                    <tr key={v.storage}>
                      <td className="mono">{v.storage} GB</td>
                      <td className="num">{eur(v.p25)}</td>
                      <td className="num">
                        <b>{eur(v.p50)}</b>
                      </td>
                      <td className="num">{eur(v.p75)}</td>
                      <td className="num">{eur(v.p75 - v.p25)}</td>
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
