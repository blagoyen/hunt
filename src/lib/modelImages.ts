export function normalizeModelName(model: string = ""): string {
  return String(model || "").toLowerCase().replace(/\s+/g, " ").trim();
}

type BackKind =
  | "se1"
  | "home_single"
  | "home_dual"
  | "xr"
  | "x_xs"
  | "xs_max"
  | "dual_vertical"
  | "dual_diagonal"
  | "triple"
  | "island_dual_diagonal"
  | "island_triple"
  | "generic";

function detectBackKind(model: string = ""): BackKind {
  const m = normalizeModelName(model);
  if (!m) return "generic";

  if (m.includes("16e")) return "dual_vertical";
  if (m.includes("16 pro max") || m.includes("15 pro max") || m.includes("14 pro max")) return "island_triple";
  if (m.includes("16 pro") || m.includes("15 pro") || m.includes("14 pro")) return "island_triple";
  if (m.includes("16 plus") || m === "iphone 16") return "island_dual_diagonal";
  if (m.includes("15 plus") || m === "iphone 15") return "island_dual_diagonal";
  if (m.includes("14 plus") || m === "iphone 14") return "dual_diagonal";
  if (m.includes("13 pro max") || m.includes("13 pro") || m.includes("12 pro max") || m.includes("12 pro") || m.includes("11 pro max") || m.includes("11 pro")) return "triple";
  if (m.includes("13 mini") || m === "iphone 13") return "dual_diagonal";
  if (m.includes("12 mini") || m === "iphone 12") return "dual_vertical";
  if (m.includes("11")) return "dual_vertical";
  if (m.includes("xr")) return "xr";
  if (m.includes("xs max")) return "xs_max";
  if (m.includes("xs")) return "x_xs";
  if (m.includes("iphone x") || m === "iphone x" || m.endsWith(" x") || m.includes(" x ")) return "x_xs";
  if (m.includes("se") && (m.includes("3") || m.includes("2022") || m.includes("2") || m.includes("2020"))) return "home_single";
  if (m.includes("se") && (m.includes("1") || m.includes("2016"))) return "se1";
  if (m.includes("8 plus") || m.includes("7 plus") || m.includes("6s plus") || m.includes("6 plus")) return "home_dual";
  if (m.includes("8") || m.includes("7") || m.includes("6s") || m.includes("6") || m.includes("se")) return "home_single";
  if (m.includes("pro")) return "island_triple";
  if (m.includes("plus")) return "dual_diagonal";
  return "generic";
}

function esc(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export function getBackModelImage(model: string = ""): string {
  const kind = detectBackKind(model);
  const label = (model || "iPhone").trim() || "iPhone";
  const short = esc(label.length > 18 ? label.replace(/^iPhone\s*/i, "iPh ") : label);
  const W = 220;
  const H = 440;
  const frame = "#0d0d0d";
  const body = "#f5f5f4";
  const edge = "#dcdcdc";
  const bump = "#efefee";
  const lens = "#fafafa";
  const ring = "#151515";
  const logo = "#d7d7d5";
  const text = "#6f6f6f";

  let bumpSvg = `<rect x="22" y="22" width="66" height="66" rx="18" fill="${bump}" stroke="${edge}"/><circle cx="44" cy="44" r="11" fill="${lens}" stroke="${ring}" stroke-width="2.2"/><circle cx="66" cy="66" r="11" fill="${lens}" stroke="${ring}" stroke-width="2.2"/>`;
  if (kind === "se1" || kind === "home_single" || kind === "xr") {
    bumpSvg = `<rect x="24" y="24" width="46" height="46" rx="12" fill="${bump}" stroke="${edge}"/><circle cx="47" cy="47" r="12" fill="${lens}" stroke="${ring}" stroke-width="2.4"/><circle cx="60" cy="33" r="4" fill="${lens}" stroke="${ring}" stroke-width="1.4"/>`;
  } else if (kind === "home_dual") {
    bumpSvg = `<rect x="22" y="22" width="48" height="78" rx="16" fill="${bump}" stroke="${edge}"/><circle cx="46" cy="44" r="11" fill="${lens}" stroke="${ring}" stroke-width="2.2"/><circle cx="46" cy="74" r="11" fill="${lens}" stroke="${ring}" stroke-width="2.2"/><circle cx="60" cy="59" r="4" fill="${lens}" stroke="${ring}" stroke-width="1.4"/>`;
  } else if (kind === "x_xs" || kind === "xs_max" || kind === "dual_vertical") {
    bumpSvg = `<rect x="22" y="22" width="50" height="82" rx="17" fill="${bump}" stroke="${edge}"/><circle cx="47" cy="45" r="11.5" fill="${lens}" stroke="${ring}" stroke-width="2.2"/><circle cx="47" cy="76" r="11.5" fill="${lens}" stroke="${ring}" stroke-width="2.2"/><circle cx="63" cy="60.5" r="4.2" fill="${lens}" stroke="${ring}" stroke-width="1.4"/>`;
  } else if (kind === "dual_diagonal" || kind === "island_dual_diagonal") {
    bumpSvg = `<rect x="20" y="20" width="74" height="74" rx="20" fill="${bump}" stroke="${edge}"/><circle cx="42" cy="42" r="11.5" fill="${lens}" stroke="${ring}" stroke-width="2.2"/><circle cx="70" cy="70" r="11.5" fill="${lens}" stroke="${ring}" stroke-width="2.2"/><circle cx="70" cy="42" r="4.2" fill="${lens}" stroke="${ring}" stroke-width="1.4"/><circle cx="42" cy="70" r="4.2" fill="#e2e2e2" stroke="${edge}" stroke-width="1"/>`;
  } else if (kind === "triple" || kind === "island_triple") {
    bumpSvg = `<rect x="18" y="18" width="84" height="84" rx="22" fill="${bump}" stroke="${edge}"/><circle cx="42" cy="40" r="11.5" fill="${lens}" stroke="${ring}" stroke-width="2.2"/><circle cx="42" cy="72" r="11.5" fill="${lens}" stroke="${ring}" stroke-width="2.2"/><circle cx="76" cy="56" r="11.5" fill="${lens}" stroke="${ring}" stroke-width="2.2"/><circle cx="76" cy="30" r="4.2" fill="${lens}" stroke="${ring}" stroke-width="1.4"/><circle cx="76" cy="84" r="4.2" fill="#e2e2e2" stroke="${edge}" stroke-width="1"/>`;
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect x="8" y="8" width="${W - 16}" height="${H - 16}" rx="38" fill="${frame}"/>
  <rect x="14" y="14" width="${W - 28}" height="${H - 28}" rx="32" fill="${body}" stroke="${edge}"/>
  <g transform="translate(14,14)">${bumpSvg}</g>
  <g transform="translate(${W / 2 - 14},${H / 2 - 48})">
    <path d="M19.6 10.4c1.4-1.7 2.3-4 2-6.4-2 .1-4.3 1.3-5.7 3-1.2 1.4-2.3 3.8-2 6 .2.1 2.2.4 5.7-2.6zm9.1 20.9c-1.6 2.4-3.3 4.7-5.9 4.8-2.6.1-3.4-1.5-6.3-1.5-2.9 0-3.9 1.5-6.3 1.6-2.5.1-4.4-2.6-6.1-4.9-3.3-4.8-5.9-13.5-2.5-19.4 1.7-3 4.8-4.9 8.1-4.9 2.5 0 4.9 1.7 6.4 1.7 1.5 0 4.3-2.1 7.3-1.8 1.2 0 4.8.5 7 3.8-.2.1-4.2 2.4-4.1 7.2 0 5.7 5 7.6 5.1 7.6 0 .1-.8 2.7-2.7 5.8z" fill="${logo}"/>
  </g>
  <rect x="18" y="${H - 74}" width="${W - 36}" height="40" rx="10" fill="#fafafa" stroke="${edge}"/>
  <text x="${W / 2}" y="${H - 52}" text-anchor="middle" font-family="ui-monospace, SFMono-Regular, Consolas, monospace" font-size="10" fill="${text}" letter-spacing="1.4">ZADNJA STRANA</text>
  <text x="${W / 2}" y="${H - 38}" text-anchor="middle" font-family="ui-sans-serif, system-ui, Arial" font-size="14" font-weight="600" fill="#151515">${short}</text>
</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

// Kept for compatibility with existing imports/usages.
export function getDefaultModelImage(model: string = ""): string {
  return getBackModelImage(model);
}

export function getFallbackModelImage(model: string = ""): string {
  return getBackModelImage(model);
}

export function resolveDeviceImage(d: any): string {
  const custom = typeof d?.custom_image === "string" ? d.custom_image.trim() : "";
  if (custom) return custom;
  return getDefaultModelImage(d?.model || "");
}
