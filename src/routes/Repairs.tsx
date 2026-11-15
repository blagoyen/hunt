import React, { useState } from "react";
import { Icon } from "../components/icons";
import { Button, Toggle } from "../components/ui";
import { repairCatalog } from "../lib/deal";
import { eur } from "../lib/format";

export function Repairs() {
  const [selected, setSelected] = useState(repairCatalog[0].model);
  const [parts, setParts] = useState({
    display: true,
    battery: false,
    back: false,
    camera: false,
    faceid: false,
  });
  const row = repairCatalog.find((r) => r.model === selected)!;
  const total =
    (parts.display ? row.display : 0) +
    (parts.battery ? row.battery : 0) +
    (parts.back ? row.back : 0) +
    (parts.camera ? row.camera : 0) +
    (parts.faceid ? row.faceid : 0);
  const labor = Math.round(total * 0.55);
  const all = total + labor;

  const toggle = (k: keyof typeof parts) => setParts((p) => ({ ...p, [k]: !p[k] }));

  return (
    <>
      <div className="page-head">
        <div>
          <div className="label">03 — Popravke</div>
          <h1 className="page-title">
            Katalog <em>delova</em>.
          </h1>
          <p className="page-sub">
            Cene delova i rada po modelu — osnova za profit kalkulaciju.
          </p>
        </div>
        <div className="head-meta">
          <span>
            Labor <b>{row.laborPerUnit} €/h</b>
          </span>
          <span>
            Rad <b>procena</b>
          </span>
        </div>
      </div>

      <div className="grid-side">
        <div className="card">
          <div className="card-h">
            <b>Modeli</b>
          </div>
          <div className="model-list">
            {repairCatalog.map((r) => (
              <button
                key={r.model}
                className={`model-row${selected === r.model ? " is-active" : ""}`}
                onClick={() => setSelected(r.model)}
              >
                <div className="grow">
                  <b>{r.model}</b>
                  <span>ekran {eur(r.display)} · bat {eur(r.battery)}</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="stack">
          <div className="card">
            <div className="card-h">
              <b>{row.model} · delovi</b>
              <span className="faint mono" style={{ fontSize: 8.5, letterSpacing: "0.1em" }}>
                EUR
              </span>
            </div>
            <div className="card-b" style={{ padding: 0 }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>Deo</th>
                    <th className="num">Cena</th>
                    <th style={{ width: 120 }}>Uključi</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { k: "display", label: "Ekran (OEM)", val: row.display },
                    { k: "battery", label: "Baterija", val: row.battery },
                    { k: "back", label: "Zadnje staklo", val: row.back },
                    { k: "camera", label: "Kamera", val: row.camera },
                    { k: "faceid", label: "Face ID modul", val: row.faceid },
                  ].map((r) => (
                    <tr
                      key={r.k}
                      onClick={() => toggle(r.k as keyof typeof parts)}
                      style={{ cursor: "pointer" }}
                    >
                      <td>{r.label}</td>
                      <td className="num">{eur(r.val)}</td>
                      <td>
                        <Toggle
                          on={parts[r.k as keyof typeof parts]}
                          onChange={(v) => setParts((p) => ({ ...p, [r.k]: v }))}
                          label=""
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card">
            <div className="card-h">
              <b>Procena popravke</b>
            </div>
            <div className="card-b">
              <dl className="kv">
                <dt>Delovi</dt>
                <dd className="money">{eur(total)}</dd>
                <dt>Rad</dt>
                <dd className="money">{eur(labor)}</dd>
                <dt>Ukupno</dt>
                <dd className="money">
                  <b>{eur(all)}</b>
                </dd>
              </dl>
              <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
                <Button size="sm" variant="ghost">
                  <Icon name="plus" size={13} />
                  Dodaj deo
                </Button>
                <Button size="sm" variant="primary">
                  Sačuvaj cenovnik
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
