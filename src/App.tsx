import React, { useEffect, useMemo, useState } from "react";
import { Titlebar } from "./components/Titlebar";
import { Sidebar } from "./components/Sidebar";
import { CommandPalette } from "./components/CommandPalette";
import type { PaletteItem } from "./components/CommandPalette";
import { Market } from "./routes/Market";
import { Repairs } from "./routes/Repairs";
import { Calculator } from "./routes/Calculator";
import { Watchlist } from "./routes/Watchlist";
import { Settings } from "./routes/Settings";
import { ManualEntry } from "./routes/ManualEntry";
import { Inventory } from "./routes/Inventory";
import { Icon } from "./components/icons";
import { ResizeHandles } from "./components/ResizeHandles";

const NAV = [
  { id: "inventory", label: "NALOZI", icon: "target" as const, kbd: "1" },
  { id: "repairs", label: "POPRAVKE", icon: "wrench" as const, kbd: "2" },
  { id: "unos", label: "UNOS", icon: "plus" as const, kbd: "3" },
  { id: "calculator", label: "KALKULATOR", icon: "chart" as const, kbd: "4" },
  { id: "market", label: "TRÅ½IÅ TE", icon: "chart" as const, kbd: "5" },
  { id: "watchlist", label: "WATCHLIST", icon: "eye" as const, kbd: "6" },
  { id: "settings", label: "PODEÅ AVANJA", icon: "settings" as const, kbd: "," },
];

const CRUMBS: Record<string, string> = {
  inventory: "Nalozi / inventar",
  repairs: "Popravke",
  unos: "RuÄni unos",
  market: "TrÅ¾iÅ¡te",
  calculator: "Kalkulator",
  watchlist: "Watchlist",
  settings: "PodeÅ¡avanja",
};

export default function App() {
  const [route, setRoute] = useState("inventory");
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
      // number shortcuts (ignore when typing in inputs)
      if (!paletteOpen && !e.metaKey && !e.ctrlKey && !e.altKey) {
        const target = e.target as HTMLElement | null;
        const tag = target?.tagName?.toLowerCase();
        const isTyping = tag === "input" || tag === "textarea" || tag === "select" || target?.isContentEditable;
        if (!isTyping) {
          const idx = ["1", "2", "3", "4", "5", "6", ","].indexOf(e.key);
          if (idx >= 0 && idx < NAV.length) {
            setRoute(NAV[idx].id);
          }
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
        label: mono ? "UkljuÄi boje" : "Monohrom (iskljuÄi boje)",
        group: "Izgled",
        icon: "dot",
        run: () => setMono((m) => !m),
      },
      {
        id: "toggle-side",
        label: collapsed ? "RaÅ¡iri sidebar" : "Skupi sidebar",
        group: "Izgled",
        icon: "chevron",
        run: () => setCollapsed((c) => !c),
      },
      {
        id: "refresh",
        label: "OsvjeÅ¾i skener",
        group: "Akcije",
        icon: "refresh",
        run: () => {},
      },
      {
        id: "new-entry",
        label: "Novi ruÄni unos",
        group: "Akcije",
        icon: "plus",
        run: () => setRoute("unos"),
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
      case "inventory":
        return <Inventory />;
      case "market":
        return <Market />;
      case "repairs":
        return <Repairs />;
      case "unos":
        return <ManualEntry />;
      case "calculator":
        return <Calculator />;
      case "watchlist":
        return <Watchlist />;
      case "settings":
        return <Settings />;
      default:
        return <Inventory />;
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
                placeholder="Pretraga: model, deo, unosâ€¦"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    setRoute("unos");
                  }
                }}
              />
              <span className="kbd">âŒ˜K</span>
            </div>
            <div className="topbar-right">
              <div className="live">
                <span className="pulse" />
                <span>Skener radi Â· pre 2 min</span>
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

