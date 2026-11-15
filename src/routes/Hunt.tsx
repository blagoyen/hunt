import React, { useMemo, useState } from "react";
import { Icon } from "../components/icons";
import { Badge, Button, Toggle, SourceChip } from "../components/ui";import { ListingDrawer } from "../components/ListingDrawer";
import { mockListings, conditionLabel } from "../lib/data";
import { maxBidOf as maxBidFor } from "../lib/deal";
import { ipc, isTauri } from "../lib/ipc";import { profitOf, marginOf } from "../lib/deal";
import { eur, pct } from "../lib/format";
import type { Listing } from "../lib/types";

const SOURCE_FILTERS = ["Svi", "KP", "Halo", "Limundo"] as const;

export function Hunt() {
  const [sourceFilter, setSourceFilter] = useState(0);
  const [query, setQuery] = useState("");
  const [onlyProfit, setOnlyProfit] = useState(false);
  const [sort, setSort] = useState<"profit" | "price" | "date">("profit");
  const [sel, setSel] = useState<Listing | null>(null);
  const [scraping, setScraping] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const rows = useMemo(() => {
    let r = mockListings.slice();
    if (sourceFilter === 1) r = r.filter((l) => l.source === "kp");
    if (sourceFilter === 2) r = r.filter((l) => l.source === "halo");
    if (sourceFilter === 3) r = r.filter((l) => l.source === "limundo");
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      r = r.filter((l) => l.title.toLowerCase().includes(q) || l.model.toLowerCase().includes(q));
    }
    if (onlyProfit) r = r.filter((l) => profitOf(l) > 0);
    r.sort((a, b) => {
      if (sort === "profit") return profitOf(b) - profitOf(a);
      if (sort === "price") return a.price - b.price;
      return b.postedDays - a.postedDays;
    });
    return r;
  }, [sourceFilter, query, onlyProfit, sort]);

  const stats = useMemo(() => {
    const total = mockListings.length;
    const profit = mockListings.filter((l) => profitOf(l) > 0).length;
    const best = mockListings.reduce((acc, l) => (profitOf(l) > profitOf(acc) ? l : acc), mockListings[0]);
    const avg = Math.round(mockListings.reduce((a, l) => a + marginOf(l), 0) / mockListings.length * 100);
    return { total, profit, best, avg };
  }, []);

  return (
    <>
      <div className="page-head">
        <div>
          <div className="label">01 — Lov</div>
          <h1 className="page-title">
            Aktivni <em>oglasi</em>.
          </h1>
          <p className="page-sub">
            Sve objave koje skener prati — filtriraj, sortiraj, otvori detalj i izračunaj profit.
          </p>
        </div>
        <div className="head-meta">
          <span>
            Ažurirano <b>pre 2 min</b>
          </span>
          <span>
            Skener <b>radi</b>
          </span>
        </div>
      </div>

      <div className="stats">
        <div className="stat">
          <div className="stat-label">Aktivni oglasi</div>
          <div className="stat-value">{stats.total}</div>
          <div className="stat-note">KP · Halo · Limundo</div>
        </div>
        <div className="stat">
          <div className="stat-label">Profitabilni</div>
          <div className="stat-value is-pos">{stats.profit}</div>
          <div className="stat-note">marža &gt; 0</div>
        </div>
        <div className="stat">
          <div className="stat-label">Najbolji deal</div>
          <div className="stat-value is-pos">{eur(profitOf(stats.best))}</div>
          <div className="stat-note">{stats.best.model} · {stats.best.location}</div>
        </div>
        <div className="stat">
          <div className="stat-label">Prosečna marža</div>
          <div className="stat-value">{stats.avg}%</div>
          <div className="stat-note">prošle nedelje +12%</div>
        </div>
      </div>

      <div className="filters">
        <div className="seg">
          {SOURCE_FILTERS.map((s, i) => (
            <button
              key={s}
              className={`seg-btn${sourceFilter === i ? " is-active" : ""}`}
              onClick={() => setSourceFilter(i)}
            >
              {s}
            </button>
          ))}
        </div>
        <select
          className="select"
          value={sort}
          onChange={(e) => setSort(e.target.value as "profit" | "price" | "date")}
        >
          <option value="profit">Sort: Profit</option>
          <option value="price">Sort: Cena</option>
          <option value="date">Sort: Datum</option>
        </select>
        <input
          className="input"
          placeholder="pretraga modela…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{ width: 180 }}
        />
        <div className="filters-right">
          <Toggle
            on={onlyProfit}
            onChange={setOnlyProfit}
            label="Samo profitabilni"
          />
          <Button
            size="sm"
            variant="ghost"
            disabled={scraping}
            onClick={async () => {
              setScraping(true);
              const q = query.trim() || "iphone";
              let total = 0;
              let ok = false;
              for (const src of ["kp", "halo", "limundo"]) {
                const n = await ipc.scrapeSource(src, q);
                if (n === null) continue;
                ok = true;
                total += n;
              }
              setScraping(false);
              setToast(!ok ? "Skeniranje nije dostupno (browser mod)" : `Skenirano: ${total} novih oglasa (KP+Halo+Limundo)`);
              setTimeout(() => setToast(null), 3200);
            }}
          >
            <Icon name="refresh" size={13} />
            {scraping ? "Skeniram…" : "Skeniraj KP"}
          </Button>
          <Button size="sm" variant="primary">
            <Icon name="plus" size={13} />
            Nova pretraga
          </Button>
        </div>
      </div>

      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Model</th>
              <th>Mem</th>
              <th className="num">Cena</th>
              <th>Stanje</th>
              <th className="num">Popravka</th>
              <th className="num">Prodaja</th>
              <th className="num">Profit</th>
              <th className="num">Max bid</th>
              <th>Starost</th>
              <th>Izvor</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((l) => {
              const profit = profitOf(l);
              const margin = marginOf(l);
              const mb = maxBidFor(l);
              return (
                <tr
                  key={l.id}
                  className={sel?.id === l.id ? "is-selected" : ""}
                  onClick={() => setSel(l)}
                >
                  <td>
                    <div className="cell-model">
                      <b>{l.model}</b>
                      <span>{l.location} · {l.seller}</span>
                    </div>
                  </td>
                  <td className="num">{l.storage}</td>
                  <td className="num">{eur(l.price)}</td>
                  <td>
                    <div className="badges">
                      {l.damage.map((d) => (
                        <Badge key={d} variant={d === "working" ? "solid" : "outline"}>
                          {conditionLabel[d]}
                        </Badge>
                      ))}
                      {l.icloud && <Badge variant="risk">iCloud</Badge>}
                    </div>
                  </td>
                  <td className="num">{eur(l.repairCost)}</td>
                  <td className="num">{eur(l.marketPrice)}</td>
                  <td className="num">
                    <div className={`profit${profit < 0 ? " is-neg" : ""}`}>
                      <span className="profit-bar">
                        <i style={{ width: `${Math.min(100, Math.abs(margin) * 100 * 2)}%` }} />
                      </span>
                      <b>
                        {profit >= 0 ? "+" : ""}
                        {eur(profit)}
                      </b>
                    </div>
                  </td>
                  <td className="num">{eur(mb)}</td>
                  <td className="mono">{l.postedDays}d</td>
                  <td>
                    <SourceChip source={l.source} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {rows.length === 0 && (
        <div className="empty">
          <b>Nema rezultata</b>
          <span>Pokušaj sa drugim filterom ili terminom.</span>
        </div>
      )}

      {sel && <ListingDrawer listing={sel} onClose={() => setSel(null)} />}
      {toast && <div className="toast">{toast}</div>}
    </>
  );
}
