export function normalizeModelName(model: string = ""): string {
  return String(model || "").toLowerCase().replace(/\s+/g, " ").trim();
}

type ModelKind =
  | "se1" | "home" | "x" | "xr" | "notch_dual" | "notch_dual_diag" | "notch_triple"
  | "island_dual" | "island_dual_diag" | "island_triple" | "generic";

export function detectModelKind(model: string = ""): ModelKind {
  const m = normalizeModelName(model);
  if (!m) return "generic";
  if (m.includes("se (1") || m.includes("se 1") || (m.includes("se") && m.includes("2016"))) return "se1";
  if (m.includes("se")) return "home";
  if (m.includes("16e")) return "notch_dual"; // approximation
  if (m.includes("16 pro")) return "island_triple";
  if (m.includes("15 pro")) return "island_triple";
  if (m.includes("14 pro")) return "island_triple";
  if (m.includes("16 plus") || m === "iphone 16") return "island_dual_diag";
  if (m.includes("15 plus") || m === "iphone 15") return "island_dual_diag";
  if (m.includes("14 plus") || m === "iphone 14") return "notch_dual_diag";
  if (m.includes("13 pro")) return "notch_triple";
  if (m.includes("12 pro")) return "notch_triple";
  if (m.includes("11 pro")) return "notch_triple";
  if (m.includes("13 mini") || m === "iphone 13") return "notch_dual_diag";
  if (m.includes("12 mini") || m === "iphone 12") return "notch_dual";
  if (m.includes("11")) return "notch_dual";
  if (m.includes("xr")) return "xr";
  if (m.includes("xs")) return "notch_dual";
  if (m.includes(" x") || m.endsWith("x") || m.includes("iphone x")) return "x";
  if (m.includes("8 plus") || m.includes("7 plus") || m.includes("6s plus") || m.includes("6 plus")) return "home";
  if (m.includes("8") || m.includes("7") || m.includes("6s") || m.includes("6")) return "home";
  if (m.includes("pro")) return "island_triple";
  if (m.includes("plus")) return "notch_dual_diag";
  return "generic";
}

function esc(s: string) { return s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;"); }

export function getDefaultModelImage(model: string = ""): string {
  const kind = detectModelKind(model);
  const label = esc((model || "iPhone").trim() || "iPhone");
  const short = esc(label.length > 18 ? label.replace(/^iPhone\s*/i, "iPh ") : label);

  const W=220, H=440, R=34;
  const frame = `#0b0b0b`;
  const body = `#f4f4f4`;
  const screen = `#ffffff`;
  const line = `#d8d8d8`;
  const accent = `#111111`;

  // camera bump drawings
  const bumpSingle = `<rect x="24" y="24" width="44" height="44" rx="12" fill="#ededed" stroke="${line}"/><circle cx="46" cy="46" r="10" fill="#fff" stroke="${accent}" stroke-width="2"/>`;
  const bumpDualV = `<rect x="22" y="22" width="44" height="70" rx="14" fill="#ededed" stroke="${line}"/><circle cx="44" cy="42" r="9" fill="#fff" stroke="${accent}" stroke-width="2"/><circle cx="44" cy="72" r="9" fill="#fff" stroke="${accent}" stroke-width="2"/>`;
  const bumpDualD = `<rect x="22" y="22" width="64" height="64" rx="16" fill="#ededed" stroke="${line}"/><circle cx="42" cy="42" r="9" fill="#fff" stroke="${accent}" stroke-width="2"/><circle cx="64" cy="64" r="9" fill="#fff" stroke="${accent}" stroke-width="2"/><circle cx="64" cy="42" r="4" fill="#fff" stroke="${accent}" stroke-width="1.5"/>`;
  const bumpTriple = `<rect x="20" y="20" width="74" height="74" rx="18" fill="#ededed" stroke="${line}"/><circle cx="42" cy="40" r="9" fill="#fff" stroke="${accent}" stroke-width="2"/><circle cx="42" cy="66" r="9" fill="#fff" stroke="${accent}" stroke-width="2"/><circle cx="70" cy="53" r="9" fill="#fff" stroke="${accent}" stroke-width="2"/><circle cx="70" cy="30" r="4" fill="#fff" stroke="${accent}" stroke-width="1.5"/><circle cx="70" cy="76" r="3.5" fill="#d0d0d0"/>`;
  const bumpXR = `<rect x="24" y="24" width="44" height="44" rx="12" fill="#ededed" stroke="${line}"/><circle cx="46" cy="46" r="10" fill="#fff" stroke="${accent}" stroke-width="2"/>`;

  let topFeature = `<rect x="86" y="10" width="48" height="8" rx="4" fill="#1a1a1a"/>`; // notch-ish bar area
  let bottomFeature = ``;
  let camera = bumpDualV;
  let screenInset = 10;

  if(kind === "home" || kind === "se1"){
    screenInset = 14;
    topFeature = `<circle cx="110" cy="18" r="3" fill="#2a2a2a"/><rect x="92" y="26" width="36" height="4" rx="2" fill="#2a2a2a"/>`;
    bottomFeature = `<circle cx="110" cy="${H-18}" r="11" fill="none" stroke="#cfcfcf" stroke-width="2"/>`;
    camera = kind === "se1" ? bumpSingle : (normalizeModelName(model).includes("plus") ? bumpDualV : bumpSingle);
  } else if(kind === "x" || kind === "xr"){
    topFeature = `<rect x="78" y="10" width="64" height="14" rx="7" fill="#111"/>`;
    camera = kind === "xr" ? bumpXR : bumpDualV;
  } else if(kind === "notch_dual"){
    topFeature = `<rect x="78" y="10" width="64" height="14" rx="7" fill="#111"/>`;
    camera = bumpDualV;
  } else if(kind === "notch_dual_diag"){
    topFeature = `<rect x="78" y="10" width="64" height="14" rx="7" fill="#111"/>`;
    camera = bumpDualD;
  } else if(kind === "notch_triple"){
    topFeature = `<rect x="78" y="10" width="64" height="14" rx="7" fill="#111"/>`;
    camera = bumpTriple;
  } else if(kind === "island_dual" || kind === "island_dual_diag"){
    topFeature = `<rect x="88" y="12" width="44" height="12" rx="6" fill="#111"/>`;
    camera = bumpDualD;
  } else if(kind === "island_triple"){
    topFeature = `<rect x="88" y="12" width="44" height="12" rx="6" fill="#111"/>`;
    camera = bumpTriple;
  } else {
    topFeature = `<rect x="84" y="12" width="52" height="10" rx="5" fill="#1a1a1a"/>`;
    camera = bumpDualV;
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect x="2" y="2" width="${W-4}" height="${H-4}" rx="${R}" fill="${frame}"/>
  <rect x="${screenInset}" y="${screenInset}" width="${W-screenInset*2}" height="${H-screenInset*2}" rx="${R-8}" fill="${screen}" stroke="${line}"/>
  ${topFeature}
  <g transform="translate(14,14)">${camera}</g>
  ${bottomFeature}
  <rect x="18" y="${H-86}" width="${W-36}" height="46" rx="10" fill="#fafafa" stroke="${line}"/>
  <text x="${W/2}" y="${H-58}" text-anchor="middle" font-family="ui-monospace, SFMono-Regular, Consolas, monospace" font-size="11" fill="#6e6e6e" letter-spacing="1.5">HUNT. MODEL</text>
  <text x="${W/2}" y="${H-40}" text-anchor="middle" font-family="ui-sans-serif, system-ui, Arial" font-size="15" font-weight="600" fill="#111">${short}</text>
</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export function resolveDeviceImage(d: any): string {
  const custom = typeof d?.custom_image === "string" ? d.custom_image.trim() : "";
  if (custom) return custom;
  return getDefaultModelImage(d?.model || "");
}
