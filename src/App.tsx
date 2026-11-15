import React, { useEffect, useMemo, useState } from "react";
import { Titlebar } from "./components/Titlebar";
import { Sidebar } from "./components/Sidebar";
import { CommandPalette } from "./components/CommandPalette";
import type { PaletteItem } from "./components/CommandPalette";
import { Dashboard } from "./routes/Dashboard";
import { Intake } from "./routes/Intake";
import { Lager } from "./routes/Lager";
import { Finance } from "./routes/Finance";
import { Market } from "./routes/Market";
import { Watchlist } from "./routes/Watchlist";
import { Settings } from "./routes/Settings";
import { Repairs } from "./routes/Repairs";
import { Icon } from "./components/icons";
import { ResizeHandles } from "./components/ResizeHandles";

const NAV = [
  { id: "dashboard", label: "RADNA PLOČA", icon: "target" as const, kbd: "" },
  { id: "intake", label: "NOVI PRIJEM", icon: "plus" as const, kbd: "" },
  { id: "lager", label: "LAGER", icon: "eye" as const, kbd: "" },
  { id: "finance", label: "FINANSIJE", icon: "chart" as const, kbd: "" },
  { id: "parts", label: "CENE DELOVA", icon: "wrench" as const, kbd: "" },
  { id: "market", label: "TRŽIŠTE", icon: "arrow-up-right" as const, kbd: "" },
  { id: "watchlist", label: "WATCHLIST", icon: "search" as const, kbd: "" },
  { id: "settings", label: "PODEŠAVANJA", icon: "settings" as const, kbd: "" },
];

const CRUMBS: Record<string, string> = {
  dashboard: "Radna ploča",
  intake: "Novi prijem",
  lager: "Lager / svi uređaji",
  finance: "Finansije i profit",
  parts: "Cene delova (baza)",
  market: "Praćenje cena / tržište",
  watchlist: "Watchlist / oglasi na čekanju",
  settings: "Podešavanja",
};

const nextSideMode = (mode: "expanded" | "wide" | "icons" | "hidden"): "expanded" | "wide" | "icons" | "hidden" => {
  if (mode === "hidden") return "icons";
  if (mode === "icons") return "wide";
  if (mode === "wide") return "expanded";
  return "wide";
};

export default function App() {
  const [route, setRoute] = useState("dashboard");
  const [sideMode, setSideMode] = useState<"expanded" | "wide" | "icons" | "hidden">(() => {
    try {
      const v = localStorage.getItem("hunt:side");
      if (v === "expanded" || v === "wide" || v === "icons" || v === "hidden") return v;
      return "icons";
    } catch {
      return "icons";
    }
  });
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [mono, setMono] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.side = sideMode;
    try {
      localStorage.setItem("hunt:side", sideMode);
    } catch {}
  }, [sideMode]);

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
        const search = document.getElementById("hunt-global-search") as HTMLInputElement | null;
        if (search) {
          search.focus();
          search.select();
        } else {
          setPaletteOpen((v) => !v);
        }
        return;
      }
      if (e.key === "Escape") setPaletteOpen(false);
      // Number-key page switching is intentionally disabled.
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
        label: sideMode === "hidden" ? "Prikaži sidebar" : sideMode === "expanded" ? "Skupi sidebar" : "Proširi sidebar",
        group: "Izgled",
        icon: "chevron",
        run: () => setSideMode((m) => nextSideMode(m)),
      },
      {
        id: "refresh",
        label: "Osvježi skener",
        group: "Akcije",
        icon: "refresh",
        run: () => {},
      },
      {
        id: "new-entry",
        label: "Novi prijem",
        group: "Akcije",
        icon: "plus",
        run: () => setRoute("intake"),
      },
      {
        id: "export",
        label: "Export CSV",
        group: "Akcije",
        icon: "download",
        run: () => {},
      },
    ],
    [theme, mono, sideMode],
  );

  const renderRoute = () => {
    switch (route) {
      case "dashboard":
        return <Dashboard onOpenDevice={() => setRoute("lager")} onNewIntake={() => setRoute("intake")} />;
      case "intake":
        return <Intake />;
      case "lager":
        return <Lager />;
      case "finance":
        return <Finance />;
      case "parts":
        return <Repairs />;
      case "market":
        return <Market />;
      case "watchlist":
        return <Watchlist />;
      case "settings":
        return <Settings />;
      default:
        return <Dashboard onOpenDevice={() => setRoute("lager")} onNewIntake={() => setRoute("intake")} />;
    }
  };

  return (
    <div className="app">
      <Titlebar
        crumbs={CRUMBS[route]}
        sideHidden={sideMode === "hidden"}
        onToggleSide={() => setSideMode((m) => (m === "hidden" ? "wide" : "hidden"))}
      />
      <div className={`shell${sideMode === "hidden" ? " is-side-hidden" : ""}`} style={{ gridTemplateColumns: `${sideMode === "hidden" ? 0 : sideMode === "wide" ? 214 : 58}px minmax(0, 1fr)` }}>
        {sideMode !== "hidden" && (
        <Sidebar
          items={NAV}
          active={route}
          mode={sideMode === "expanded" ? "expanded" : sideMode === "wide" ? "wide" : "icons"}
          onToggle={() => setSideMode((m) => (m === "icons" ? "wide" : m === "wide" ? "expanded" : "icons"))}
          onHide={() => setSideMode("hidden")}
          onNav={setRoute}
          theme={theme}
          onTheme={setTheme}
          mono={mono}
          onMono={setMono}
        />
        )}
        <main className="main">
          <div className="topbar">
            <div className="search">
              <Icon name="search" size={14} />
              <input
                id="hunt-global-search"
                placeholder="Pretraga po IMEI-u, modelu ili imenu kupca…"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    setRoute("lager");
                  }
                }}
              />
              <span className="kbd">Ctrl K</span>
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

