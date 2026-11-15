import React, { useState } from "react";
import { Icon } from "../components/icons";
import { Button, Badge } from "../components/ui";

interface SavedSearch {
  id: string;
  query: string;
  source: string;
  maxPrice: number;
  matches: number;
  newToday: number;
  active: boolean;
}

const searches: SavedSearch[] = [
  { id: "s1", query: "iPhone 13 Pro 256 ekran", source: "KP", maxPrice: 320, matches: 14, newToday: 2, active: true },
  { id: "s2", query: "iPhone 14 Pro 256 kauč", source: "KP + Halo", maxPrice: 560, matches: 9, newToday: 1, active: true },
  { id: "s3", query: "iPhone 12 128 baterija", source: "KP", maxPrice: 160, matches: 23, newToday: 4, active: true },
  { id: "s4", query: "iPhone 15 128 kao nov", source: "Halo", maxPrice: 520, matches: 6, newToday: 0, active: false },
  { id: "s5", query: "iPhone 16 Pro Max 256", source: "KP", maxPrice: 980, matches: 3, newToday: 1, active: true },
];

export function Watchlist() {
  const [items, setItems] = useState(searches);
  const toggle = (id: string) =>
    setItems((xs) => xs.map((x) => (x.id === id ? { ...x, active: !x.active } : x)));

  return (
    <>
      <div className="page-head">
        <div>
          <div className="label">05 — Watchlist</div>
          <h1 className="page-title">
            Sačuvane <em>pretrage</em>.
          </h1>
          <p className="page-sub">
            Prati izvore i dobij alert kad iskoči oglas ispod max bid-a.
          </p>
        </div>
        <div className="head-meta">
          <span>
            Aktivne <b>{items.filter((x) => x.active).length}</b>
          </span>
          <span>
            Nove danas <b>{items.reduce((a, x) => a + x.newToday, 0)}</b>
          </span>
        </div>
      </div>

      <div className="card">
        <div className="card-h">
          <b>Sačuvane pretrage</b>
          <Button size="sm" variant="primary">
            <Icon name="plus" size={13} />
            Nova
          </Button>
        </div>
        <div className="card-b" style={{ padding: 0 }}>
          <table className="table">
            <thead>
              <tr>
                <th>Pretraga</th>
                <th>Izvor</th>
                <th className="num">Max cena</th>
                <th className="num">Pronađeno</th>
                <th className="num">Nove</th>
                <th>Alert</th>
              </tr>
            </thead>
            <tbody>
              {items.map((s) => (
                <tr key={s.id}>
                  <td>
                    <b>{s.query}</b>
                  </td>
                  <td className="mono">{s.source}</td>
                  <td className="num">{s.maxPrice}€</td>
                  <td className="num">{s.matches}</td>
                  <td className="num">
                    {s.newToday > 0 ? <Badge variant="solid">{s.newToday}</Badge> : <span className="faint">—</span>}
                  </td>
                  <td>
                    <Button size="sm" variant={s.active ? "primary" : "ghost"} onClick={() => toggle(s.id)}>
                      {s.active ? "UKLJ." : "OFF"}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div style={{ marginTop: 14 }} className="card">
        <div className="card-h">
          <b>Poslednji alerti</b>
        </div>
        <div className="card-b">
          {[
            { t: "pre 12 min", model: "iPhone 13 Pro 256", price: 260, profit: 89 },
            { t: "pre 41 min", model: "iPhone 14 Pro 256", price: 470, profit: 164 },
            { t: "pre 2 h", model: "iPhone 15 Pro 256", price: 520, profit: 179 },
          ].map((a, i) => (
            <div key={i} className="rowline">
              <div className="rowline-label">
                <b>{a.model}</b>
                <span>
                  {a.t} · cena {a.price}€
                </span>
              </div>
              <span className="money" style={{ color: "var(--pos)" }}>
                +{a.profit}€
              </span>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
