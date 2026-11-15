export function normalizeModelName(model: string = ""): string {
  return String(model || "").toLowerCase().replace(/\s+/g, " ").trim();
}

// Best-effort mapping from human model names to apple-device-images device keys.
// Images served from https://img.appledb.dev (littlebyteorg/apple-device-images).
export function getAppleDeviceImageKey(model: string = ""): string | null {
  const m = normalizeModelName(model);
  if (!m) return null;
  // iPhone 16 series
  if (m.includes("16e")) return "iPhone17,5";
  if (m.includes("16 pro max")) return "iPhone17,2";
  if (m.includes("16 pro")) return "iPhone17,1";
  if (m.includes("16 plus")) return "iPhone17,4";
  if (m.includes("16")) return "iPhone17,3";
  // iPhone 15 series
  if (m.includes("15 pro max")) return "iPhone16,2";
  if (m.includes("15 pro")) return "iPhone16,1";
  if (m.includes("15 plus")) return "iPhone15,5";
  if (m.includes("15")) return "iPhone15,4";
  // iPhone 14 series
  if (m.includes("14 pro max")) return "iPhone15,3";
  if (m.includes("14 pro")) return "iPhone15,2";
  if (m.includes("14 plus")) return "iPhone14,8";
  if (m.includes("14")) return "iPhone14,7";
  // iPhone 13 series
  if (m.includes("13 pro max")) return "iPhone14,3";
  if (m.includes("13 pro")) return "iPhone14,2";
  if (m.includes("13 mini")) return "iPhone14,4";
  if (m.includes("13")) return "iPhone14,5";
  // iPhone SE 3 / 2
  if (m.includes("se") && (m.includes("3") || m.includes("2022"))) return "iPhone14,6";
  if (m.includes("se") && (m.includes("2") || m.includes("2020"))) return "iPhone12,8";
  // iPhone 12 series
  if (m.includes("12 pro max")) return "iPhone13,4";
  if (m.includes("12 pro")) return "iPhone13,3";
  if (m.includes("12 mini")) return "iPhone13,1";
  if (m.includes("12")) return "iPhone13,2";
  // iPhone 11 series
  if (m.includes("11 pro max")) return "iPhone12,5";
  if (m.includes("11 pro")) return "iPhone12,3";
  if (m.includes("11")) return "iPhone12,1";
  // iPhone XS / XR / X
  if (m.includes("xs max")) return "iPhone11,6";
  if (m.includes("xs")) return "iPhone11,2";
  if (m.includes("xr")) return "iPhone11,8";
  if (m.includes(" x") || m.endsWith(" x") || m === "iphone x" || m.endsWith("iphone x")) return "iPhone10,6";
  // iPhone 8/7/6/SE1
  if (m.includes("8 plus")) return "iPhone10,5";
  if (m.includes("8")) return "iPhone10,4";
  if (m.includes("7 plus")) return "iPhone9,4";
  if (m.includes("7")) return "iPhone9,3";
  if (m.includes("6s plus")) return "iPhone8,2";
  if (m.includes("6s")) return "iPhone8,1";
  if (m.includes("6 plus")) return "iPhone7,1";
  if (m.includes("6")) return "iPhone7,2";
  if (m.includes("se") && (m.includes("1") || m.includes("2016"))) return "iPhone8,4";
  if (m.includes("se")) return "iPhone12,8";
  return null;
}

export function getAppleDeviceImageUrl(model: string = ""): string | null {
  const key = getAppleDeviceImageKey(model);
  if (!key) return null;
  // Use index 0 for a neutral/default device image (apple-device-images convention).
  return `https://img.appledb.dev/device@256/${key}/0.png`;
}

function esc(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export function getFallbackModelImage(model: string = ""): string {
  const label = esc((model || "iPhone").trim() || "iPhone");
  const short = esc(label.length > 18 ? label.replace(/^iPhone\s*/i, "iPh ") : label);
  const W = 220;
  const H = 440;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect x="18" y="8" width="184" height="424" rx="34" fill="#f7f7f7" stroke="#d8d8d8"/>
  <rect x="28" y="22" width="164" height="396" rx="24" fill="#ffffff" stroke="#e6e6e6"/>
  <rect x="86" y="28" width="48" height="10" rx="5" fill="#111"/>
  <text x="${W / 2}" y="360" text-anchor="middle" font-family="ui-monospace, SFMono-Regular, Consolas, monospace" font-size="10" fill="#8a8a8a" letter-spacing="1.4">HUNT. MODEL</text>
  <text x="${W / 2}" y="382" text-anchor="middle" font-family="ui-sans-serif, system-ui, Arial" font-size="15" font-weight="600" fill="#111">${short}</text>
</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export function getDefaultModelImage(model: string = ""): string {
  return getAppleDeviceImageUrl(model) || getFallbackModelImage(model);
}

export function resolveDeviceImage(d: any): string {
  const custom = typeof d?.custom_image === "string" ? d.custom_image.trim() : "";
  if (custom) return custom;
  return getDefaultModelImage(d?.model || "");
}
