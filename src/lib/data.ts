import type { Listing, MarketPoint } from "./types";

export const conditionLabel: Record<string, string> = {
  working: "Ispravan",
  battery: "Baterija",
  screen: "Ekran",
  back: "Zadnje staklo",
  faceid: "Face ID",
  camera: "Kamera",
  water: "Voda",
  no_power: "Ne pali se",
};

const H = "2026-11-14T09:00:00Z";
const D = (daysAgo: number) => new Date(Date.parse(H) - daysAgo * 86400000).toISOString();

function makeListing(
  id: string,
  title: string,
  model: string,
  storage: number,
  price: number,
  repairCost: number,
  marketPrice: number,
  damage: Listing["damage"],
  condition: Listing["damage"][number],
  seller: string,
  description: string,
): Listing {
  const profit = marketPrice - price - repairCost;
  const margin = profit / marketPrice;
  const maxBid = Math.max(0, Math.floor(marketPrice * 0.75 - repairCost));
  return {
    id,
    source: "kp",
    title,
    model,
    storage,
    price,
    repairCost,
    marketPrice,
    profit,
    margin,
    maxBid,
    damage,
    icloud: damage.includes("water" as any) ? false : false,
    carrierLocked: false,
    screenReplaced: false,
    location: "Beograd",
    seller,
    postedDays: 3,
    url: "https://kupujemprodajem.rs/",
    description,
    images: 0,
    imagePaths: [],
    confidence: 0.9,
    firstSeen: D(3),
    lastSeen: D(0),
    status: "new",
    priceHistory: [{ t: "11-12", p: price } as MarketPoint],
    duplicates: [],
  };
}

export const mockListings: Listing[] = [
  makeListing(
    "l1",
    "iPhone 13 Pro 256GB grafit — pukao ekran",
    "iPhone 13 Pro",
    256,
    260,
    150,
    620,
    ["screen"],
    "screen",
    "m. perić",
    "Ekran je pukao, telefon radi. Face ID i kamera rade.",
  ),
  makeListing(
    "l2",
    "iPhone 12 128GB — ne puni se",
    "iPhone 12",
    128,
    210,
    80,
    430,
    ["no_power"],
    "working",
    "j. nikolić",
    "Ne puni se. Probao sam više punjača, problem je u konektoru.",
  ),
  makeListing(
    "l3",
    "iPhone 15 Pro 256GB — polomljeno zadnje staklo",
    "iPhone 15 Pro",
    256,
    560,
    120,
    920,
    ["back"],
    "back",
    "n. jokić",
    "Zadnje staklo je polomljeno, telefon radi normalno.",
  ),
  makeListing(
    "l4",
    "iPhone 13 128GB — iCloud zaključan",
    "iPhone 13",
    128,
    180,
    100,
    480,
    ["working"],
    "working",
    "t. marić",
    "Telefon je zaključan na iCloud nalog. Prodajem za delove.",
  ),
];
