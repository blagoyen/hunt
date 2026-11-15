import React, { useEffect, useState } from "react";

const DIRS = [
  { dir: "North", style: { top: 0, left: 6, right: 6, height: 6, cursor: "ns-resize" } },
  { dir: "South", style: { bottom: 0, left: 6, right: 6, height: 6, cursor: "ns-resize" } },
  { dir: "West", style: { left: 0, top: 6, bottom: 6, width: 6, cursor: "ew-resize" } },
  { dir: "East", style: { right: 0, top: 6, bottom: 6, width: 6, cursor: "ew-resize" } },
  { dir: "NorthWest", style: { top: 0, left: 0, width: 8, height: 8, cursor: "nwse-resize" } },
  { dir: "NorthEast", style: { top: 0, right: 0, width: 8, height: 8, cursor: "nesw-resize" } },
  { dir: "SouthWest", style: { bottom: 0, left: 0, width: 8, height: 8, cursor: "nesw-resize" } },
  { dir: "SouthEast", style: { bottom: 0, right: 0, width: 8, height: 8, cursor: "nwse-resize" } },
] as const;

export function ResizeHandles() {
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

  if (!win) return null;

  return (
    <>
      {DIRS.map((d) => (
        <div
          key={d.dir}
          style={{
            position: "fixed",
            zIndex: 9999,
            ...d.style,
          }}
          onMouseDown={async (e) => {
            e.preventDefault();
            e.stopPropagation();
            try {
              await win.startResizeDragging(d.dir);
            } catch {
              /* ignore */
            }
          }}
        />
      ))}
    </>
  );
}
