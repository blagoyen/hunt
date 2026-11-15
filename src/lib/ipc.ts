// Thin wrapper around Tauri IPC. Falls back gracefully when running in a browser (dev mode without Tauri).

export function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in (window as unknown as Record<string, unknown>);
}

type Invoke = <T>(cmd: string, args?: Record<string, unknown>) => Promise<T>;

let invokeCached: Invoke | null = null;

async function getInvoke(): Promise<Invoke | null> {
  if (invokeCached) return invokeCached;
  if (!isTauri()) return null;
  try {
    const mod = await import("@tauri-apps/api/core");
    invokeCached = mod.invoke as Invoke;
    return invokeCached;
  } catch {
    return null;
  }
}

export async function invokeCommand<T>(cmd: string, args?: Record<string, unknown>): Promise<T | null> {
  const inv = await getInvoke();
  if (!inv) return null;
  try {
    return await inv<T>(cmd, args);
  } catch (e) {
    console.warn("IPC failed:", cmd, e);
    return null;
  }
}

export const ipc = {
  listListings: () => invokeCommand<unknown[]>("list_listings"),
  calcProfit: (input: { buy_price: number; repair_cost: number; market_price: number; target_margin?: number }) =>
    invokeCommand<{ profit: number; margin: number; max_bid: number; total_cost: number }>("calc_profit", { input }),
  greet: (name: string) => invokeCommand<string>("greet", { name }),
  scrapeSource: (source: string, query: string) => invokeCommand<number>("scrape_source", { source, query }),
  connectSource: (source: string) => invokeCommand<void>("connect_source", { source }),
  captureCookies: (source: string) => invokeCommand<number>("capture_cookies", { source }),
  cookiesStatus: () => invokeCommand<boolean>("cookies_status"),
  extractListing: (id: number) => invokeCommand<void>("extract_listing", { id }),
  extractAll: () => invokeCommand<number>("extract_all"),
  getLlmConfig: () => invokeCommand<{ provider: string; model: string; api_key: string }>("get_llm_config"),
  setLlmConfig: (provider: string, model: string, apiKey: string) =>
    invokeCommand<void>("set_llm_config", { provider, model, apiKey }),
};
