import React, { useMemo } from "react";
import { eur } from "../lib/format";
import { FinanceView, calcTotals, deviceTotalCost, useDevices } from "./Inventory";

function monthKey(d: string | null | undefined) {
  if (!d) return "Nepoznato";
  return String(d).slice(0, 7);
}

export function Finance() {
  const { devices } = useDevices();
  const totals = useMemo(() => calcTotals(devices), [devices]);

  const byMonth = useMemo(() => {
    const m: Record<string, { revenue: number; cost: number; profit: number; count: number }> = {};
    for (const d of devices.filter((x) => x.status === "prodat")) {
      const k = monthKey(d.sale_date);
      m[k] = m[k] || { revenue: 0, cost: 0, profit: 0, count: 0 };
      const rev = Number(d.sale_price_eur) || 0;
      const cost = Number(d.total_cost_eur || deviceTotalCost(d)) || 0;
      m[k].revenue += rev; m[k].cost += cost; m[k].profit += rev - cost; m[k].count += 1;
    }
    return Object.entries(m).sort(([a], [b]) => b.localeCompare(a)).slice(0, 12);
  }, [devices]);

  const costBreakdown = useMemo(() => {
    let buy = 0, parts = 0, hidden = 0;
    for (const d of devices) { buy += Number(d.buy_price_eur) || 0; parts += Number(d.parts_cost_eur) || 0; hidden += Number(d.hidden_cost_eur) || 0; }
    return { buy, parts, hidden, total: buy + parts + hidden };
  }, [devices]);

  const lockedPct = costBreakdown.total > 0 ? Math.min(100, Math.round((totals.lockedCapital / costBreakdown.total) * 100)) : 0;

  return (
    <>
      <div className="page-head">
        <div>
          <div className="label">04 — Finansije</div>
          <h1 className="page-title">Profit i <em>kapital</em>.</h1>
          <p className="page-sub">Neto zarada, troškovi i koliko novca je vezano u uređajima u obradi.</p>
        </div>
      </div>

      <div className="kpi-bar" aria-label="Finansijski pregled">
        <div className="kpi"><div className="kpi-label">Prihod (prodato)</div><div className="kpi-value">{eur(totals.revenue)}</div><div className="kpi-note">{totals.soldCount} prodatih</div></div>
        <div className="kpi"><div className="kpi-label">Trošak (prodato)</div><div className="kpi-value">{eur(totals.cost)}</div><div className="kpi-note">nabavka + delovi</div></div>
        <div className="kpi"><div className="kpi-label">Neto profit</div><div className="kpi-value" style={{ color: totals.profit >= 0 ? "var(--pos)" : "var(--neg)" }}>{totals.profit >= 0 ? "+" : ""}{eur(totals.profit)}</div><div className="kpi-note">realizovano</div></div>
        <div className="kpi"><div className="kpi-label">Vezan kapital</div><div className="kpi-value">{eur(totals.lockedCapital)}</div><div className="kpi-note">{totals.inStockCount} na stanju</div></div>
      </div>

      <div className="grid-side" style={{ alignItems: "start" }}>
        <div className="card">
          <div className="card-h"><b>Neto profit po periodu</b><span className="faint" style={{ fontSize: 11 }}>poslednjih meseci</span></div>
          <div className="card-b" style={{ padding: 0 }}>
            <table className="table">
              <thead><tr><th>Period</th><th className="num">Kom.</th><th className="num">Prihod</th><th className="num">Trošak</th><th className="num">Profit</th></tr></thead>
              <tbody>
                {byMonth.map(([k, v]) => (
                  <tr key={k}>
                    <td><b>{k}</b></td>
                    <td className="num">{v.count}</td>
                    <td className="num">{eur(v.revenue)}</td>
                    <td className="num">{eur(v.cost)}</td>
                    <td className="num" style={{ color: v.profit >= 0 ? "var(--pos)" : "var(--neg)" }}>{v.profit >= 0 ? "+" : ""}{eur(v.profit)}</td>
                  </tr>
                ))}
                {byMonth.length === 0 && <tr><td colSpan={5} className="faint">Još nema prodatih uređaja po periodima.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>

        <div className="stack">
          <div className="card">
            <div className="card-h"><b>Troškovi (evidencija)</b></div>
            <div className="card-b">
              <dl className="kv">
                <dt>Nabavka uređaja</dt><dd className="money">{eur(costBreakdown.buy)}</dd>
                <dt>Delovi</dt><dd className="money">{eur(costBreakdown.parts)}</dd>
                <dt>Skriveni / ostalo</dt><dd className="money">{eur(costBreakdown.hidden)}</dd>
                <dt>Ukupno uloženo</dt><dd className="money"><b>{eur(costBreakdown.total)}</b></dd>
              </dl>
            </div>
          </div>
          <div className="card">
            <div className="card-h"><b>Kapital / povrat</b></div>
            <div className="card-b">
              <div className="faint" style={{ fontSize: 11, marginBottom: 6 }}>Vezan kapital u obradi/lageru naspram ukupnog uloženog</div>
              <div style={{ height: 12, border: "1px solid var(--line)", borderRadius: 999, overflow: "hidden", background: "var(--surface-2)" }}>
                <div style={{ width: `${lockedPct}%`, height: "100%", background: "var(--ink)" }} />
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, fontSize: 12 }}>
                <span>Vezano: <b>{eur(totals.lockedCapital)}</b></span>
                <span className="faint">{lockedPct}% od {eur(costBreakdown.total)}</span>
              </div>
              <div style={{ marginTop: 10, fontSize: 12 }}>
                <div>Očekivana zarada (na stanju): <b className="money">+{eur(totals.expectedProfit)}</b></div>
                <div className="faint" style={{ marginTop: 4, fontSize: 11 }}>Realizovani neto profit: <span style={{ color: totals.profit >= 0 ? "var(--pos)" : "var(--neg)" }}>{totals.profit >= 0 ? "+" : ""}{eur(totals.profit)}</span></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div style={{ marginTop: 14 }}>
        <FinanceView totals={totals} devices={devices} />
      </div>
    </>
  );
}
