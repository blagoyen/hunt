import React, { useEffect, useRef, useState } from "react";
import { Brand } from "./ui";
import { Icon } from "./icons";

function useTauriWindow() {
  const [win, setWin] = useState<any>(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (typeof window === "undefined" || !("__TAURI_INTERNALS__" in window)) return;
      try {
        const mod = await import("@tauri-apps/api/window");
        if (!cancelled) setWin(mod.getCurrentWindow());
      } catch {
        /* browser mode */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  return win;
}

export function Titlebar({ crumbs, onToggleSide, sideHidden }: { crumbs: string; onToggleSide?: () => void; sideHidden?: boolean }) {
  const appWindow = useTauriWindow();
  const titlebarRef = useRef<HTMLElement>(null);

  const onTitlebarMouseDown = async (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest("button")) return;
    if (!appWindow) {
      console.warn("No Tauri window handle");
      return;
    }
    try {
      await appWindow.startDragging();
    } catch (err) {
      console.warn("startDragging failed:", err);
      // Fallback: try native drag region (already set via attribute)
    }
  };

  // Debug: log when window handle is acquired
  useEffect(() => {
    if (appWindow) console.log("Tauri window handle acquired");
  }, [appWindow]);

  const minimize = () => appWindow?.minimize();
  const toggleMax = () => appWindow?.toggleMaximize();
  const close = () => appWindow?.close();

  return (
    <header
      className="titlebar"
      ref={titlebarRef as any}
      data-tauri-drag-region
      onMouseDown={onTitlebarMouseDown}
      style={{ cursor: "default", WebkitAppRegion: "drag" } as any}
    >
      <Brand size={14} />
      <button
        type="button"
        className="win-btn side-toggle"
        aria-label={sideHidden ? "Prikaži sidebar" : "Sakrij sidebar"}
        title={sideHidden ? "Prikaži sidebar" : "Sakrij sidebar"}
        onClick={onToggleSide}
        style={{ width: 32, alignSelf: "center" }}
      >
        <Icon name="chevron" size={13} style={{ transform: sideHidden ? "rotate(-90deg)" : "rotate(90deg)" }} />
      </button>
      <span className="titlebar-sep" />
      <span className="crumbs">
        hunt. / <b>{crumbs}</b>
      </span>
      <div className="drag" data-tauri-drag-region />
      <div className="win-actions" data-tauri-drag-region="false">
        <button className="win-btn" aria-label="Minimize" onClick={minimize}>
          <Icon name="minus" size={12} />
        </button>
        <button className="win-btn" aria-label="Maximize" onClick={toggleMax}>
          <Icon name="chevron" size={12} style={{ transform: "rotate(-45deg)" }} />
        </button>
        <button className="win-btn is-close" aria-label="Close" onClick={close}>
          <Icon name="close" size={12} />
        </button>
      </div>
    </header>
  );
}
