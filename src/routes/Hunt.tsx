import React, { useEffect, useMemo, useState } from "react";
import { Icon } from "../components/icons";
import { Badge, Button, Toggle, SourceChip } from "../components/ui";
import { ListingDrawer } from "../components/ListingDrawer";
import { mockListings, conditionLabel } from "../lib/data";
import { maxBidOf as maxBidFor } from "../lib/deal";
import { profitOf, marginOf } from "../lib/deal";
import { eur, pct } from "../lib/format";
import { ipc, isTauri } from "../lib/ipc";
import type { Listing } from "../lib/types";

const SOURCE_FILTERS = ["Svi", "KP", "Halo", "Limundo"] as const;

function mapDbRow(r: any): Listing {
  const price = Number(r.price) || 0;
  const marketPrice = 0; // unknown until market stats; user can set in calculator
  const repairCost = 0;
  const profit = marketPrice - price - repairCost - 6;
  const margin = marketPrice > 0 ? profit / marketPrice : 0;
  const mb = marketPrice > 0 ? maxBidFor({ repairCost, marketPrice }) : 0;
  const damage = Array.isArray(r.damage) ? r.damage : [];
  const imgs = Array.isArray(r.images) ? r.images : [];
  const imagePaths = imgs.map((i: any) => i.local_path || i.url || "").filter(Boolean);
  return {
    id: String(r.id),
    source: (r.source === "halo" ? "halo" : r.source === "limundo" ? "limundo" : "kp") as any,
    title: r.title || "",
    model: r.model || r.title || "",
    storage: Number(r.storage) || 0,
    price,
    repairCost,
    marketPrice,
    profit,
    margin,
    maxBid: mb,
    damage: damage.length ? damage : ["working"],
    battery: r.battery != null ? Number(r.battery) : undefined,
    icloud: !!r.icloud,
    carrierLocked: !!r.carrier_locked,
    screenReplaced: !!r.screen_replaced,
    location: r.location || "",
    seller: r.seller || "",
    postedDays: 0,
    url: r.url || "",
    description: r.description || "",
    images: imagePaths.length,
    imagePaths,
    confidence: Number(r.confidence) || 0.5,
    firstSeen: r.first_seen || new Date().toISOString(),
    lastSeen: new Date().toISOString(),
    status: (r.status === "watching" ? "watching" : r.status === "bought" ? "bought" : r.status === "dismissed" ? "dismissed" : "new") as any,
    priceHistory: [],
    duplicates: [],
  };
}

export function Hunt() {
  const [sourceFilter, setSourceFilter] = useState(0);
  const [query, setQuery] = useState("");
  const [onlyProfit, setOnlyProfit] = useState(false);
  const [sort, setSort] = useState<"profit" | "price" | "date">("price");
  const [sel, setSel] = useState<Listing | null>(null);
  const [scraping, setScraping] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [dbListings, setDbListings] = useState<Listing[] | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    setLoading(true);
    const rows = await ipc.listListings();
    if (rows && Array.isArray(rows) && rows.length > 0) {
      setDbListings(rows.map(mapDbRow));
    } else if (rows && Array.isArray(rows) && rows.length === 0) {
      setDbListings([]);
    }
    // null => browser mode, keep mock
    setLoading(false);
  };

  useEffect(() => {
    refresh();
  }, []);

  const baseListings: Listing[] =
    dbListings !== null ? dbListings : (isTauri() ? [] : mockListings);

  const rows = useMemo(() => {
    let r = baseListings.slice();
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
  }, [baseListings, sourceFilter, query, onlyProfit, sort]);

  const stats = useMemo(() => {
    const total = baseListings.length;
    const profit = baseListings.filter((l) => profitOf(l) > 0).length;
    const best = baseListings.length ? baseListings.reduce((acc, l) => (profitOf(l) > profitOf(acc) ? l : acc), baseListings[0]) : null;
    const avg = baseListings.length ? Math.round(baseListings.reduce((a, l) => a + marginOf(l), 0) / baseListings.length * 100) : 0;
    return { total, profit, best, avg };
  }, [baseListings]);

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
            Ažurirano <b>upravo</b>
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
          <div className="stat-value is-pos">
            {stats.best ? eur(profitOf(stats.best)) : "—"}
          </div>
          <div className="stat-note">{stats.best ? `${stats.best.model} · ${stats.best.location}` : "nema podataka"}</div>
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
          <Button size="sm" variant="ghost" onClick={refresh} disabled={loading}>
            <Icon name="refresh" size={13} />
            {loading ? "Učitavam…" : "Osvježi"}
          </Button>
          <Button
            size="sm"
            variant="primary"
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
                // extract attrs for the newly scraped listings
                await ipc.extractAll();
              }
              setScraping(false);
              setToast(!ok ? "Skeniranje nije dostupno (browser mod)" : `Skenirano: ${total} novih oglasa (KP+Halo+Limundo)`);
              setTimeout(() => setToast(null), 3200);
              await refresh();
            }}
          >
            <Icon name="refresh" size={13} />
            {scraping ? "Skeniram…" : "Skeniraj sve"}
          </Button>
        </div>
      </div>

      {loading && (
        <div className="empty">
          <b>Učitavam oglase…</b>
        </div>
      )}

      {!loading && rows.length === 0 && (
        <div className="empty">
          <b>Nema oglasa u bazi</b>
          <span>
            {isTauri()
              ? "Klikni \"Skeniraj sve\" da preuzmeš oglase sa KP, HaloOglasa i Limunda. Ako je KP blokiran, prvo poveži cookie-je u Podešavanjima."
              : "Pokreni desktop app (npm run tauri dev) i skeniraj izvore."}
          </span>
        </div>
      )}

      {!loading && rows.length > 0 && (
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
                    <td className="num">{l.storage || "—"}</td>
                    <td className="num">{eur(l.price)}</td>
                    <td>
                      <div className="badges">
                        {l.damage.map((d) => (
                          <Badge key={d} variant={d === "working" ? "solid" : "outline"}>
                            {conditionLabel[d] || d}
                          </Badge>
                        ))}
                        {l.icloud && <Badge variant="risk">iCloud</Badge>}
                      </div>
                    </td>
                    <td className="num">{l.repairCost ? eur(l.repairCost) : "—"}</td>
                    <td className="num">{l.marketPrice ? eur(l.marketPrice) : "—"}</td>
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
                    <td className="num">{mb ? eur(mb) : "—"}</td>
                    <td className="mono">{l.postedDays || "—"}</td>
                    <td>
                      <SourceChip source={l.source} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {sel && <ListingDrawer listing={sel} onClose={() => setSel(null)} />}
      {toast && <div className="toast">{toast}</div>}
    </>
  );
}
