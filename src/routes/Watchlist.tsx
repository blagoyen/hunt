import React, { useEffect, useState } from "react";
import { Button } from "../components/ui";
import { Icon } from "../components/icons";

type Note = { id: string; title: string; url: string; price: string; note: string; createdAt: string };

const KEY = "hunt:watchlistNotes";

function load(): Note[] {
  try { const raw = localStorage.getItem(KEY); if (raw) { const v = JSON.parse(raw); if (Array.isArray(v)) return v; } } catch {}
  return [];
}

export function Watchlist() {
  const [items, setItems] = useState<Note[]>(load);
  const [draft, setDraft] = useState<Note>({ id: "", title: "", url: "", price: "", note: "", createdAt: "" });

  useEffect(() => { try { localStorage.setItem(KEY, JSON.stringify(items)); } catch {} }, [items]);

  const add = () => {
    if (!draft.title.trim() && !draft.url.trim()) return;
    const item: Note = { ...draft, id: String(Date.now()), createdAt: new Date().toISOString().slice(0, 10) };
    setItems((xs) => [item, ...xs]);
    setDraft({ id: "", title: "", url: "", price: "", note: "", createdAt: "" });
  };
  const remove = (id: string) => setItems((xs) => xs.filter((x) => x.id !== id));
  const copy = async (t: string) => { try { await navigator.clipboard.writeText(t); } catch {} };

  return (
    <>
      <div className="page-head">
        <div>
          <div className="label">06 — Watchlist</div>
          <h1 className="page-title">Oglasi na <em>čekanju</em>.</h1>
          <p className="page-sub">Sačuvaj linkove i beleške za telefone koje planiraš da kontaktiraš.</p>
        </div>
        <div className="head-meta"><span>Sačuvano <b>{items.length}</b></span></div>
      </div>

      <div className="grid-side" style={{ alignItems: "start" }}>
        <div className="card">
          <div className="card-h"><b>Dodaj oglas / link</b></div>
          <div className="card-b" style={{ display: "grid", gap: 8 }}>
            <input className="input" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} placeholder="Naziv (npr. iPhone 13 Pro 256GB, KP)" />
            <input className="input" value={draft.url} onChange={(e) => setDraft({ ...draft, url: e.target.value })} placeholder="Link oglasa (https://...)" />
            <input className="input" value={draft.price} onChange={(e) => setDraft({ ...draft, price: e.target.value })} placeholder="Cena / ponuda (npr. 280€)" />
            <textarea className="input" rows={4} value={draft.note} onChange={(e) => setDraft({ ...draft, note: e.target.value })} placeholder="Beleške: stanje, dogovor, kada zvati..." style={{ resize: "vertical" }} />
            <Button size="sm" variant="primary" onClick={add}><Icon name="plus" size={13} /> Sačuvaj u watchlist</Button>
          </div>
        </div>

        <div className="card">
          <div className="card-h"><b>Sačuvano</b></div>
          <div className="card-b" style={{ display: "grid", gap: 8 }}>
            {items.length === 0 && <div className="faint">Nema sačuvanih oglasa. Dodaj link i belešku sa leve strane.</div>}
            {items.map((it) => (
              <div key={it.id} className="card" style={{ background: "var(--surface-2)" }}>
                <div className="card-b" style={{ display: "grid", gap: 6 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "start" }}>
                    <div style={{ minWidth: 0 }}>
                      <b style={{ fontSize: 13 }}>{it.title || "Oglas"}</b>
                      <div className="faint" style={{ fontSize: 11 }}>{it.createdAt}{it.price ? ` · ${it.price}` : ""}</div>
                    </div>
                    <div style={{ display: "flex", gap: 4 }}>
                      {it.url && <Button size="sm" variant="ghost" onClick={() => window.open(it.url, "_blank")}>Otvori</Button>}
                      {it.url && <Button size="sm" variant="ghost" onClick={() => copy(it.url)}>Link</Button>}
                      <button className="icon-btn" onClick={() => remove(it.id)} title="Ukloni"><Icon name="close" size={14} /></button>
                    </div>
                  </div>
                  {it.url && <div className="mono" style={{ fontSize: 10, color: "var(--muted)", wordBreak: "break-all" }}>{it.url}</div>}
                  {it.note && <div style={{ fontSize: 12, whiteSpace: "pre-wrap" }}>{it.note}</div>}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
