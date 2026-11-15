import React, { useMemo, useState } from "react";
import { Button } from "../components/ui";
import { Icon } from "../components/icons";
import { eur } from "../lib/format";
import { DeviceEditor, type Device, BOARD_COLS, NEXT_STATUS, calcTotals, deviceTotalCost, useDevices } from "./Inventory";
import { resolveDeviceImage } from "../lib/modelImages";

export function Dashboard({ onOpenDevice, onNewIntake }: { onOpenDevice?: () => void; onNewIntake?: () => void }) {
  const { devices, partsCatalog, toast, busy, notify, saveDevice, removeDevice } = useDevices();
  const [selected, setSelected] = useState<Device | null>(null);

  const totals = useMemo(() => calcTotals(devices), [devices]);
  const byStatus = useMemo(() => {
    const m: Record<string, Device[]> = {};
    for (const c of BOARD_COLS) m[c.id] = [];
    for (const d of devices) {
      for (const col of BOARD_COLS) {
        if (col.statuses.includes(d.status)) {
          m[col.id].push(d);
          break;
        }
      }
    }
    return m;
  }, [devices]);

  const advanceDevice = async (dev: Device) => {
    const next = NEXT_STATUS[dev.status];
    if (!next || !dev.id) return;
    await saveDevice({ ...dev, status: next });
    notify(next === "prodat" ? "Pomereno u arhivu (prodato)." : "Status ažuriran.");
  };

  const saveAndRefresh = async (dev: Device) => {
    await saveDevice(dev);
  };
  const removeAndClose = async (id: number) => {
    const ok = await removeDevice(id);
    if (ok) setSelected(null);
  };

  return (
    <>
      <div className="page-head">
        <div>
          <div className="label">01 — Radna ploča</div>
          <h1 className="page-title">Kanban <em>aktivnih naloga</em>.</h1>
          <p className="page-sub">Centralni pregled uređaja u procesu — prebaci status jednim klikom.</p>
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <Button size="sm" variant="ghost" onClick={onOpenDevice}>Otvori lager</Button>
          <Button size="sm" variant="primary" onClick={onNewIntake}><Icon name="plus" size={13} /> Novi prijem</Button>
        </div>
      </div>

      <div className="kpi-bar" aria-label="Sažete metrike">
        <div className="kpi"><div className="kpi-label">Aktivnih uređaja</div><div className="kpi-value">{totals.inStockCount}</div><div className="kpi-note">u procesu / na prodaju</div></div>
        <div className="kpi"><div className="kpi-label">Vezan kapital</div><div className="kpi-value">{eur(totals.lockedCapital)}</div><div className="kpi-note">nabavka + delovi + troškovi</div></div>
        <div className="kpi"><div className="kpi-label">Oč. zarada</div><div className="kpi-value">+{eur(totals.expectedProfit)}</div><div className="kpi-note">≈25% na stanju</div></div>
        <div className="kpi"><div className="kpi-label">Neto profit</div><div className="kpi-value" style={{ color: totals.profit >= 0 ? "var(--pos)" : "var(--neg)" }}>{totals.profit >= 0 ? "+" : ""}{eur(totals.profit)}</div><div className="kpi-note">prodate stavke</div></div>
      </div>

      <div className="board">
        {BOARD_COLS.map((col) => (
          <div key={col.id} className="card board-col">
            <div className="card-h"><b style={{ fontSize: 12 }}>{col.label}</b><span className="faint">{(byStatus[col.id] || []).length}</span></div>
            <div className="board-col-body">
              {(byStatus[col.id] || []).map((d) => {
                const totalCost = deviceTotalCost(d);
                const modelInitial = String(d.model || "?").split(" ").filter(Boolean).slice(-2).map((x: string) => x[0]).join("").slice(0, 2).toUpperCase();
                return (
                  <div key={d.id} className="board-card" role="button" tabIndex={0} onClick={() => setSelected(d)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setSelected(d); }}>
                    <div className="board-thumb" aria-hidden="true" style={{padding:4,background:"var(--surface)"}}><img src={resolveDeviceImage(d)} alt="" style={{width:"100%",height:"100%",objectFit:"contain"}} /></div>
                    <div className="board-main">
                      <b>{d.model || "Uređaj"}</b>
                      <span>{d.storage_gb ? `${d.storage_gb}GB` : "—"}{d.battery_health != null ? ` · bat ${d.battery_health}%` : ""}</span>
                      <div className="board-foot">
                        <span>Trošak {eur(totalCost)}</span>
                        {d.imei && <span>· {String(d.imei).slice(-5)}</span>}
                      </div>
                    </div>
                    <button className="board-next" type="button" title="Sledeći status" aria-label="Sledeći status" disabled={!NEXT_STATUS[d.status]} onClick={(e) => { e.stopPropagation(); advanceDevice(d); }}>
                      <Icon name="arrow-right" size={14} />
                    </button>
                  </div>
                );
              })}
              {(byStatus[col.id] || []).length === 0 && <div className="board-empty">—</div>}
            </div>
          </div>
        ))}
      </div>

      {selected && <DeviceEditor dev={selected} onClose={() => setSelected(null)} onSave={saveAndRefresh} onDelete={removeAndClose} busy={busy} partsCatalog={partsCatalog} notify={notify} />}
      {toast && <div className="toast">{toast}</div>}
    </>
  );
}
