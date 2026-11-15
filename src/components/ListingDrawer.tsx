import React from "react";
import { Icon } from "./icons";
import { Badge, Button } from "./ui";
import { conditionLabel } from "../lib/data";
import { profitOf, marginOf, maxBidOf, costOf } from "../lib/deal";
import { eur, pct } from "../lib/format";
import type { Listing } from "../lib/types";

export function ListingDrawer({
  listing: l,
  onClose,
}: {
  listing: Listing;
  onClose: () => void;
}) {
  const profit = profitOf(l);
  const margin = marginOf(l);
  const maxBid = maxBidOf(l);
  const cost = costOf(l);

  return (
    <>
      <div className="scrim" onClick={onClose} />
      <aside className="drawer">
        <div className="drawer-head">
          <div className="grow">
            <div className="drawer-title">{l.title}</div>
            <div className="drawer-sub">
              <span>{l.model}</span>
              <span>·</span>
              <span>{l.storage} GB</span>
              <span>·</span>
              <span>{l.location}</span>
              <span>·</span>
              <span>{l.source.toUpperCase()}</span>
            </div>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Zatvori">
            <Icon name="close" size={16} />
          </button>
        </div>
        <div className="drawer-body">
          <div className="section-h">Oglas</div>
          <div className="thumbs">
            {Array.from({ length: Math.min(l.images, 3) }).map((_, i) => (
              <div key={i} className={`thumb${i === 0 ? " is-match" : ""}`}>
                #{i + 1}
              </div>
            ))}
          </div>

          <div className="section-h">Izvučena polja</div>
          <dl className="kv">
            <dt>Cena</dt>
            <dd>
              <b className="money">{eur(l.price)}</b>
            </dd>
            <dt>Model</dt>
            <dd>{l.model}</dd>
            <dt>Memorija</dt>
            <dd>{l.storage} GB</dd>
            <dt>Baterija</dt>
            <dd>{l.battery ? `${l.battery}%` : "nije navedeno"}</dd>
            <dt>iCloud</dt>
            <dd>
              {l.icloud ? (
                <Badge variant="risk">Zaključan</Badge>
              ) : (
                <Badge variant="solid">Slobodan</Badge>
              )}
            </dd>
            <dt>Carrier</dt>
            <dd>{l.carrierLocked ? "SIM zaključan" : "Otključan"}</dd>
            <dt>Oštećenja</dt>
            <dd>
              <div className="badges">
                {l.damage.map((d) => (
                  <Badge key={d} variant={d === "working" ? "solid" : "outline"}>
                    {conditionLabel[d]}
                  </Badge>
                ))}
              </div>
            </dd>
            <dt>Prodavac</dt>
            <dd>{l.seller}</dd>
            <dt>Objavljeno</dt>
            <dd>pre {l.postedDays} dana</dd>
            <dt>Poverenje</dt>
            <dd>
              <span className="mono">{(l.confidence * 100).toFixed(0)}%</span>
            </dd>
          </dl>

          <div className="section-h">Originalni opis</div>
          <div className="desc">{l.description}</div>

          {l.duplicates.length > 0 && (
            <>
              <div className="section-h">Isti uređaj drugde</div>
              {l.duplicates.map((d, i) => (
                <div key={i} className="match">
                  <div className="match-main">
                    <b>{d.title}</b>
                    <span>
                      {d.source.toUpperCase()} · {conditionLabel[d.condition]} · {eur(d.price)}
                    </span>
                  </div>
                  <Button size="sm" variant="ghost">
                    Otvori
                    <Icon name="external" size={12} />
                  </Button>
                </div>
              ))}
            </>
          )}

          <div className="section-h">Istorija cene</div>
          <div className="card">
            <div className="card-b">
              <svg className="chart" viewBox="0 0 320 100" preserveAspectRatio="none">
                {(() => {
                  const pts = l.priceHistory;
                  if (pts.length === 0) return null;
                  const vals = pts.map((p) => p.p);
                  const min = Math.min(...vals);
                  const max = Math.max(...vals);
                  const span = max - min || 1;
                  const n = pts.length;
                  const denom = n > 1 ? n - 1 : 1;
                  const path = pts
                    .map((p, i) => {
                      const x = 12 + (i / denom) * 296;
                      const y = 10 + (1 - (p.p - min) / span) * 80;
                      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
                    })
                    .join(" ");
                  return (
                    <>
                      {n > 1 && <path d={path} className="line" />}
                      {pts.map((p, i) => {
                        const x = 12 + (i / denom) * 296;
                        const y = 10 + (1 - (p.p - min) / span) * 80;
                        return <circle key={i} cx={x} cy={y} r={2.5} className="dot" />;
                      })}
                    </>
                  );
                })()}
              </svg>
            </div>
          </div>

          <div className="section-h">Kalkulacija</div>
          <dl className="kv">
            <dt>Kupovna</dt>
            <dd className="money">{eur(l.price)}</dd>
            <dt>Delovi</dt>
            <dd className="money">{eur(cost.parts)}</dd>
            <dt>Rad</dt>
            <dd className="money">{eur(cost.labor)}</dd>
            <dt>Transport</dt>
            <dd className="money">{eur(cost.shipping)}</dd>
            <dt>Ukupno</dt>
            <dd className="money">
              <b>{eur(cost.total)}</b>
            </dd>
            <dt>Prodaja (p50)</dt>
            <dd className="money">{eur(l.marketPrice)}</dd>
            <dt>Profit</dt>
            <dd className="money">
              <b style={{ color: profit >= 0 ? "var(--pos)" : "var(--neg)" }}>
                {profit >= 0 ? "+" : ""}
                {eur(profit)}
              </b>
            </dd>
            <dt>Marža</dt>
            <dd className="mono">{pct(margin)}</dd>
            <dt>Max bid</dt>
            <dd className="money">
              <b>{eur(maxBid)}</b>
            </dd>
          </dl>
        </div>
        <div className="drawer-foot">
          <Button variant="ghost" size="sm">
            <Icon name="external" size={14} />
            Otvori oglas
          </Button>
          <Button variant="primary" size="sm">
            Kupio sam
          </Button>
        </div>
      </aside>
    </>
  );
}
