import React, { useEffect, useMemo, useState } from "react";
import { Button } from "../components/ui";
import { ipc } from "../lib/ipc";
import { eur } from "../lib/format";
import { FinanceView, calcTotals, deviceTotalCost, useDevices } from "./Inventory";

function monthKey(d: string | null | undefined) {
  if (!d) return "Nepoznato";
  return String(d).slice(0, 7);
}

export function Finance() {
  const { devices } = useDevices();
  const totals = useMemo(() => calcTotals(devices), [devices]);
  const [budgetTotal, setBudgetTotal] = useState<number>(0);
  const [budgetInput, setBudgetInput] = useState<string>("");
  const [budgetMsg, setBudgetMsg] = useState<string>("");
  useEffect(() => { (async()=>{ try{ const b = await ipc.getBudget(); const t = Number(b?.total_eur||0); setBudgetTotal(t); setBudgetInput(t?String(t):""); } catch{} })(); }, []);
  const spentPhones = useMemo(() => devices.reduce((a,d)=>a + (Number(d.buy_price_eur)||0), 0), [devices]);
  const spentParts = useMemo(() => devices.reduce((a,d)=>a + (Number(d.parts_cost_eur)||0), 0), [devices]);
  const spentTotal = spentPhones + spentParts;
  const budgetRemaining = budgetTotal - spentTotal;
  const saveBudget = async () => { const v = Number(budgetInput||0); try{ await ipc.setBudget(v); setBudgetTotal(v); setBudgetMsg("Budžet sačuvan."); setTimeout(()=>setBudgetMsg(""), 2500);} catch(e){ setBudgetMsg("Greška: "+String(e)); } };

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

      <div className="card" style={{ marginBottom: 12 }}>
        <div className="card-h"><b>Budžet</b><span className="faint" style={{ fontSize: 11 }}>definiši budžet i prati potrošnju (telefoni + delovi)</span></div>
        <div className="card-b">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10, alignItems: "end" }}>
            <div><div className="label">Ukupan budžet (€)</div><input className="input" type="number" value={budgetInput} onChange={(e)=>setBudgetInput(e.target.value)} placeholder="npr. 5000" style={{ width: "100%" }} /></div>
            <div><Button size="sm" variant="primary" onClick={saveBudget}>Sačuvaj budžet</Button> {budgetMsg && <span className="faint" style={{ marginLeft: 8, fontSize: 11 }}>{budgetMsg}</span>}</div>
            <div><div className="label">Potrošeno (telefoni)</div><div className="money"><b>{eur(spentPhones)}</b></div></div>
            <div><div className="label">Potrošeno (delovi)</div><div className="money"><b>{eur(spentParts)}</b></div></div>
            <div><div className="label">Ukupno potrošeno</div><div className="money"><b>{eur(spentTotal)}</b></div></div>
            <div><div className="label">Preostalo</div><div className="money" style={{ color: budgetRemaining >= 0 ? "var(--pos)" : "var(--neg)" }}><b>{budgetRemaining >= 0 ? "" : "-"}{eur(Math.abs(budgetRemaining))}</b></div><div className="faint" style={{ fontSize: 11 }}>{budgetTotal>0 ? `${Math.min(100, Math.max(0, Math.round((spentTotal/budgetTotal)*100)))}% iskorišćeno` : "Budžet nije postavljen"}</div></div>
          </div>
          <div style={{ marginTop: 10, height: 10, border: "1px solid var(--line)", borderRadius: 999, overflow: "hidden", background: "var(--surface-2)" }}>
            <div style={{ width: `${budgetTotal>0 ? Math.min(100, Math.max(0, (spentTotal/budgetTotal)*100)) : 0}%`, height: "100%", background: budgetRemaining>=0 ? "var(--ink)" : "var(--neg)" }} />
          </div>
        </div>
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
