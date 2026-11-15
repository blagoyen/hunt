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

export function Sidebar({
  items,
  active,
  collapsed,
  onToggle,
  onNav,
  theme,
  onTheme,
  mono,
  onMono,
}: {
  items: NavItem[];
  active: string;
  collapsed: boolean;
  onToggle: () => void;
  onNav: (id: string) => void;
  theme: "light" | "dark";
  onTheme: (v: "light" | "dark") => void;
  mono: boolean;
  onMono: (v: boolean) => void;
}) {
  return (
    <aside className={`side${collapsed ? " is-min" : ""}`}>
      <div className="side-label">Navigacija</div>
      {items.map((it) => (
        <button
          key={it.id}
          className={`nav-item${active === it.id ? " is-active" : ""}`}
          onClick={() => onNav(it.id)}
        >
          <Icon name={it.icon} size={15} />
          <span>{it.label}</span>
          {it.badge !== undefined && <span className="nav-count">{it.badge}</span>}
          {!it.badge && <span className="nav-key">{it.kbd}</span>}
        </button>
      ))}
      <div className="side-foot">
        <div className="side-status">
          <span className="pulse" />
          <span>Skener radi · pre 2 min</span>
        </div>
        <div className="side-tools">
          <button className="icon-btn" title="Tema" onClick={() => onTheme(theme === "dark" ? "light" : "dark")}>
            <Icon name={theme === "dark" ? "sun" : "moon"} size={15} />
          </button>
          <button className={`icon-btn${mono ? " is-on" : ""}`} title="Monohrom" onClick={() => onMono(!mono)}>
            <Icon name="dot" size={15} />
          </button>
          <button className="icon-btn" title="Skupi/raširi" onClick={onToggle}>
            <Icon name="chevron" size={15} style={{ transform: collapsed ? "rotate(-90deg)" : "rotate(90deg)" }} />
          </button>
        </div>
      </div>
    </aside>
  );
}
