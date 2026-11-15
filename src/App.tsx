import React, { useEffect, useMemo, useState } from "react";
import { Titlebar } from "./components/Titlebar";
import { Sidebar } from "./components/Sidebar";
import { CommandPalette } from "./components/CommandPalette";
import type { PaletteItem } from "./components/CommandPalette";
import { Hunt } from "./routes/Hunt";
import { Market } from "./routes/Market";
import { Repairs } from "./routes/Repairs";
import { Calculator } from "./routes/Calculator";
import { Watchlist } from "./routes/Watchlist";
import { Settings } from "./routes/Settings";
import { Icon } from "./components/icons";
import { ResizeHandles } from "./components/ResizeHandles";

const NAV = [
  { id: "hunt", label: "LOV", icon: "target" as const, kbd: "1", badge: 18 },
  { id: "market", label: "TRŽIŠTE", icon: "chart" as const, kbd: "2" },
  { id: "repairs", label: "POPRAVKE", icon: "wrench" as const, kbd: "3" },  { id: "calculator", label: "KALKULATOR", icon: "chart" as const, kbd: "4" },
  { id: "watchlist", label: "WATCHLIST", icon: "eye" as const, kbd: "5", badge: 4 },
  { id: "settings", label: "PODEŠAVANJA", icon: "settings" as const, kbd: "," },
];

const CRUMBS: Record<string, string> = {
  hunt: "Lov",
  market: "Tržište",
  repairs: "Popravke",  calculator: "Kalkulator",
  watchlist: "Watchlist",
  settings: "Podešavanja",
};

export default function App() {
  const [route, setRoute] = useState("hunt");
  const [collapsed, setCollapsed] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [mono, setMono] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = theme;
    try {
      localStorage.setItem("hunt:theme", theme);
    } catch {}
  }, [theme]);

  useEffect(() => {
    const root = document.documentElement;
    if (mono) root.dataset.mono = "on";
    else delete root.dataset.mono;
    try {
      localStorage.setItem("hunt:mono", mono ? "on" : "off");
    } catch {}
  }, [mono]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((v) => !v);
        return;
      }
      if (e.key === "Escape") setPaletteOpen(false);
      // number shortcuts
      if (!paletteOpen && !e.metaKey && !e.ctrlKey && !e.altKey) {
        const idx = ["1", "2", "3", "4", "5", ","].indexOf(e.key);
        if (idx >= 0 && idx < NAV.length) {
          setRoute(NAV[idx].id);
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [paletteOpen]);

  const paletteItems = useMemo<PaletteItem[]>(
    () => [
      ...NAV.map((n) => ({
        id: `nav-${n.id}`,
        label: `Idi na ${n.label}`,
        group: "Navigacija",
        icon: n.icon,
        hint: n.kbd,
        run: () => setRoute(n.id),
      })),
      {
        id: "toggle-theme",
        label: theme === "dark" ? "Prebaci na svetlu temu" : "Prebaci na tamnu temu",
        group: "Izgled",
        icon: theme === "dark" ? "sun" : "moon",
        run: () => setTheme((t) => (t === "dark" ? "light" : "dark")),
      },
      {
        id: "toggle-mono",
        label: mono ? "Uključi boje" : "Monohrom (isključi boje)",
        group: "Izgled",
        icon: "dot",
        run: () => setMono((m) => !m),
      },
      {
        id: "toggle-side",
        label: collapsed ? "Raširi sidebar" : "Skupi sidebar",
        group: "Izgled",
        icon: "chevron",
        run: () => setCollapsed((c) => !c),
      },
      {
        id: "refresh",
        label: "Osvježi skener",
        group: "Akcije",
        icon: "refresh",
        run: () => {},
      },
      {
        id: "new-search",
        label: "Nova pretraga",
        group: "Akcije",
        icon: "plus",
        run: () => setRoute("hunt"),
      },
      {
        id: "export",
        label: "Export CSV",
        group: "Akcije",
        icon: "download",
        run: () => {},
      },
    ],
    [theme, mono, collapsed],
  );

  const renderRoute = () => {
    switch (route) {
      case "market":
        return <Market />;
      case "repairs":
        return <Repairs />;
      case "calculator":
        return <Calculator />;
      case "watchlist":
        return <Watchlist />;
      case "settings":
        return <Settings />;
      default:
        return <Hunt />;
    }
  };

  return (
    <div className="app">
      <Titlebar crumbs={CRUMBS[route]} />
      <div className="shell" style={{ gridTemplateColumns: `${collapsed ? 58 : 214}px 1fr` }}>
        <Sidebar
          items={NAV}
          active={route}
          collapsed={collapsed}
          onToggle={() => setCollapsed((c) => !c)}
          onNav={setRoute}
          theme={theme}
          onTheme={setTheme}
          mono={mono}
          onMono={setMono}
        />
        <main className="main">
          <div className="topbar">
            <div className="search">
              <Icon name="search" size={14} />
              <input
                placeholder="Pretraga: model, prodavac, grad…"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    // focus hunt
                    setRoute("hunt");
                  }
                }}
              />
              <span className="kbd">⌘K</span>
            </div>
            <div className="topbar-right">
              <div className="live">
                <span className="pulse" />
                <span>Skener radi · pre 2 min</span>
              </div>
              <button className="icon-btn" title="Command palette" onClick={() => setPaletteOpen(true)}>
                <Icon name="chevron" size={15} />
              </button>
            </div>
          </div>
          <div className="content">{renderRoute()}</div>
        </main>
      </div>
      <CommandPalette open={paletteOpen} items={paletteItems} onClose={() => setPaletteOpen(false)} />
      <ResizeHandles />
      <div className="grain" aria-hidden="true" />
    </div>
  );
}
