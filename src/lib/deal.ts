import type { Listing, MarketPoint, ModelStat, PartRow } from "./types";

export const SHIPPING = 6;
export const FEES = 0;
export const DEFAULT_TARGET_MARGIN = 0.18;

export interface CostBreakdown {
  buy: number;
  parts: number;
  labor: number;
  shipping: number;
  fees: number;
  total: number;
}

export function costOf(l: { price: number; repairCost: number }): CostBreakdown {
  const labor = Math.max(0, Math.round(l.repairCost * 0.55));
  const shipping = SHIPPING;
  const fees = FEES;
  const total = l.price + l.repairCost + labor + shipping + fees;
  return { buy: l.price, parts: l.repairCost, labor, shipping, fees, total };
}

export function profitOf(l: { price: number; repairCost: number; marketPrice: number }): number {
  if (l.marketPrice <= 0) return 0;
  return l.marketPrice - l.price - l.repairCost - SHIPPING;
}

export function marginOf(l: { price: number; repairCost: number; marketPrice: number }): number {
  if (l.marketPrice <= 0) return 0;
  return profitOf(l) / l.marketPrice;
}

/** Cena koju možeš da ponudiš (bez obzira na profit) za "ispravan" kalkulacijski model. */
export function maxBidOf(l: { repairCost: number; marketPrice: number }, margin = DEFAULT_TARGET_MARGIN): number {
  const net = l.marketPrice * (1 - margin) - l.repairCost - SHIPPING;
  return Math.max(0, net);
}

export const listingProfit = (l: Listing) => profitOf(l);
export const listingMargin = (l: Listing) => marginOf(l);

export function trend(base: number): MarketPoint[] {
  const pts: MarketPoint[] = [];
  const now = new Date("2026-11-14T10:00:00Z");
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 86400000);
    const wobble = Math.sin(i * 1.7) * 0.05;
    const v = Math.max(40, base * (1 + wobble));
    pts.push({
      t: `${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`,
      p: Math.round(v * 100) / 100,
    });
  }
  return pts;
}

export const marketStats: ModelStat[] = [
  {
    model: "iPhone 16 Pro Max",
    variants: [
      { storage: 256, p25: 780, p50: 900, p75: 1050 },
      { storage: 512, p25: 1100, p50: 1250, p75: 1450 },
    ],
    liquidityDays: 9,
    sold30d: 34,
    trend: trend(900),
  },
  {
    model: "iPhone 16 Pro",
    variants: [
      { storage: 128, p25: 640, p50: 760, p75: 900 },
      { storage: 256, p25: 880, p50: 1040, p75: 1250 },
    ],
    liquidityDays: 11,
    sold30d: 41,
    trend: trend(760),
  },
  {
    model: "iPhone 15 Pro",
    variants: [
      { storage: 128, p25: 480, p50: 560, p75: 640 },
      { storage: 256, p25: 680, p50: 800, p75: 920 },
    ],
    liquidityDays: 14,
    sold30d: 57,
    trend: trend(560),
  },
  {
    model: "iPhone 15",
    variants: [
      { storage: 128, p25: 360, p50: 430, p75: 500 },
    ],
    liquidityDays: 17,
    sold30d: 63,
    trend: trend(430),
  },
  {
    model: "iPhone 14 Pro",
    variants: [
      { storage: 128, p25: 380, p50: 460, p75: 540 },
      { storage: 256, p25: 560, p50: 680, p75: 800 },
    ],
    liquidityDays: 13,
    sold30d: 48,
    trend: trend(460),
  },
  {
    model: "iPhone 13 Pro Max",
    variants: [
      { storage: 128, p25: 360, p50: 430, p75: 500 },
      { storage: 256, p25: 530, p50: 620, p75: 700 },
    ],
    liquidityDays: 12,
    sold30d: 52,
    trend: trend(430),
  },
  {
    model: "iPhone 13",
    variants: [
      { storage: 128, p25: 280, p50: 340, p75: 400 },
      { storage: 256, p25: 420, p50: 500, p75: 580 },
    ],
    liquidityDays: 16,
    sold30d: 71,
    trend: trend(340),
  },
  {
    model: "iPhone 12",
    variants: [
      { storage: 64, p25: 150, p50: 190, p75: 230 },
      { storage: 128, p25: 220, p50: 270, p75: 320 },
    ],
    liquidityDays: 22,
    sold30d: 39,
    trend: trend(270),
  },
  {
    model: "iPhone 11",
    variants: [
      { storage: 64, p25: 130, p50: 160, p75: 190 },
    ],
    liquidityDays: 25,
    sold30d: 22,
    trend: trend(160),
  },
];

export const repairCatalog: PartRow[] = [
  { model: "iPhone 13 Pro", display: 118, battery: 34, back: 42, camera: 44, faceid: 58, laborPerUnit: 40 },
  { model: "iPhone 13", display: 96, battery: 30, back: 38, camera: 40, faceid: 50, laborPerUnit: 34 },
  { model: "iPhone 14 Pro", display: 128, battery: 36, back: 46, camera: 46, faceid: 60, laborPerUnit: 44 },
  { model: "iPhone 12", display: 82, battery: 28, back: 34, camera: 36, faceid: 46, laborPerUnit: 28 },
  { model: "iPhone 16 Pro Max", display: 210, battery: 52, back: 60, camera: 62, faceid: 70, laborPerUnit: 68 },
];
