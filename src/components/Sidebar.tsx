import React from "react";
import { Icon } from "./icons";
import { Button } from "./ui";

export interface NavItem {
  id: string;
  label: string;
  icon: Parameters<typeof Icon>[0]["name"];
  kbd: string;
  badge?: number;
}

export type SideMode = "wide" | "icons" | "hidden";

export function Sidebar({
  items,
  active,
  mode,
  onToggle,
  onHide,
  onNav,
  theme,
  onTheme,
  mono,
  onMono,
}: {
  items: NavItem[];
  active: string;
  mode: "expanded" | "wide" | "icons";
  onToggle: () => void;
  onHide: () => void;
  onNav: (id: string) => void;
  theme: "light" | "dark";
  onTheme: (v: "light" | "dark") => void;
  mono: boolean;
  onMono: (v: boolean) => void;
}) {
  return (
    <aside className={`side${mode === "icons" ? " is-min" : mode === "expanded" ? " is-expanded" : ""}`}>
      <div className="side-label">Navigacija</div>
      {items.map((it) => (
        <button
          key={it.id}
          className={`nav-item${active === it.id ? " is-active" : ""}`}
          title={`${it.label} (${it.kbd})`}
          aria-label={`${it.label} (tastatura: ${it.kbd})`}
          onClick={() => onNav(it.id)}
        >
          <Icon name={it.icon} size={15} />
          <span>{it.label}</span>
          {it.badge !== undefined && <span className="nav-count">{it.badge}</span>}
          {!it.badge && it.kbd ? <span className="nav-key">{it.kbd}</span> : null}
        </button>
      ))}
      <div className="side-foot">
        <div className="side-status">
          <span className="pulse" />
          <span>Skener radi · pre 2 min</span>
        </div>
        <div className="side-tools">
          <button className="icon-btn" title="Tema" aria-label="Tema" onClick={() => onTheme(theme === "dark" ? "light" : "dark")}>
            <Icon name={theme === "dark" ? "sun" : "moon"} size={15} />
          </button>
          <button className={`icon-btn${mono ? " is-on" : ""}`} title="Monohrom" aria-label="Monohrom" onClick={() => onMono(!mono)}>
            <Icon name="dot" size={15} />
          </button>
          <button className="icon-btn" title={mode === "icons" ? "Proširi sidebar" : mode === "wide" ? "Još proširi sidebar" : "Skupi sidebar"} aria-label="Promeni širinu sidebara" onClick={onToggle}>
            <Icon name="chevron" size={15} style={{ transform: mode === "icons" ? "rotate(-90deg)" : mode === "expanded" ? "rotate(90deg)" : "rotate(-90deg)" }} />
          </button>
          <button className="icon-btn" title="Sakrij sidebar" aria-label="Sakrij sidebar" onClick={onHide}>
            <Icon name="arrow-right" size={15} style={{ transform: "rotate(180deg)" }} />
          </button>
        </div>
      </div>
    </aside>
  );
}
