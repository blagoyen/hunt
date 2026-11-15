export type Source = "kp" | "halo" | "limundo";

export type RouteId = "hunt" | "market" | "repairs" | "calculator" | "watchlist" | "settings";

export type Condition =
  | "working"
  | "battery"
  | "screen"
  | "back"
  | "faceid"
  | "camera"
  | "water"
  | "no_power";

export interface MarketPoint {
  t: string;
  p: number;
}

export interface Duplicate {
  source: Source;
  title: string;
  price: number;
  url: string;
  condition: Condition;
}

export interface Listing {
  id: string;
  source: Source;
  title: string;
  model: string;
  storage: number;
  price: number;
  repairCost: number;
  marketPrice: number;
  profit: number;
  margin: number;
  maxBid: number;
  damage: Condition[];
  battery?: number;
  icloud: boolean;
  carrierLocked: boolean;
  screenReplaced: boolean;
  location: string;
  seller: string;
  postedDays: number;
  url: string;
  description: string;
  images: number;
  imagePaths: string[];
  confidence: number;
  firstSeen: string;
  lastSeen: string;
  status: "new" | "watching" | "bought" | "dismissed";
  priceHistory: MarketPoint[];
  duplicates: Duplicate[];
}

export interface ModelStat {
  model: string;
  variants: { storage: number; p25: number; p50: number; p75: number }[];
  liquidityDays: number;
  sold30d: number;
  trend: MarketPoint[];
}

export interface PartRow {
  model: string;
  display: number;
  battery: number;
  back: number;
  camera: number;
  faceid: number;
  laborPerUnit: number;
}
