import React, { useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "./icons";

export interface PaletteItem {
  id: string;
  label: string;
  group: string;
  icon: Parameters<typeof Icon>[0]["name"];
  hint?: string;
  run: () => void;
}

export function CommandPalette({
  open,
  items,
  onClose,
}: {
  open: boolean;
  items: PaletteItem[];
  onClose: () => void;
}) {
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return items;
    return items.filter((it) => it.label.toLowerCase().includes(s) || it.group.toLowerCase().includes(s));
  }, [q, items]);

  useEffect(() => {
    if (open) {
      setQ("");
      setSel(0);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  useEffect(() => {
    if (sel >= filtered.length) setSel(Math.max(0, filtered.length - 1));
  }, [filtered, sel]);

  if (!open) return null;

  const runSel = () => {
    const it = filtered[sel];
    if (it) {
      it.run();
      onClose();
    }
  };

  return (
    <div className="palette-scrim" onClick={onClose}>
      <div className="palette" onClick={(e) => e.stopPropagation()}>
        <div className="palette-input">
          <Icon name="search" size={15} />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setSel(0);
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setSel((s) => Math.min(s + 1, filtered.length - 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setSel((s) => Math.max(s - 1, 0));
              } else if (e.key === "Enter") {
                e.preventDefault();
                runSel();
              } else if (e.key === "Escape") {
                e.preventDefault();
                onClose();
              }
            }}
            placeholder="Komanda ili navigacija…"
          />
          <span className="kbd">ESC</span>
        </div>
        <div className="palette-list">
          {filtered.length === 0 && <div className="empty"><b>Nema rezultata</b></div>}
          {filtered.map((it, i) => (
            <button
              key={it.id}
              className={`palette-item${i === sel ? " is-active" : ""}`}
              onMouseEnter={() => setSel(i)}
              onClick={() => {
                it.run();
                onClose();
              }}
            >
              <Icon name={it.icon} size={14} />
              <span className="grow">{it.label}</span>
              <span className="faint" style={{ fontFamily: "var(--mono)", fontSize: 8.5, letterSpacing: "0.08em", textTransform: "uppercase" }}>
                {it.group}
              </span>
              {it.hint && <span className="kbd">{it.hint}</span>}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
