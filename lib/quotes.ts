import { SYMBOLS, type SymbolDef } from "./symbols";

export interface Quote extends SymbolDef {
  price: number | null;
  prevClose: number | null;
  change: number | null;
  changePct: number | null;
  dayHigh: number | null;
  dayLow: number | null;
  marketTime: number | null; // unix seconds
  spark: number[];
  error?: string;
}

export interface QuotesResponse {
  updatedAt: string;
  quotes: Quote[];
}

const CHART_URL = "https://query1.finance.yahoo.com/v8/finance/chart/";

async function fetchQuote(def: SymbolDef): Promise<Quote> {
  const empty: Quote = {
    ...def,
    price: null,
    prevClose: null,
    change: null,
    changePct: null,
    dayHigh: null,
    dayLow: null,
    marketTime: null,
    spark: [],
  };

  try {
    const url = `${CHART_URL}${encodeURIComponent(def.symbol)}?range=1d&interval=5m`;
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (SIGMA)" },
      signal: AbortSignal.timeout(8000),
      cache: "no-store",
    });
    if (!res.ok) return { ...empty, error: `HTTP ${res.status}` };

    const json = await res.json();
    const result = json?.chart?.result?.[0];
    const meta = result?.meta;
    if (!meta) return { ...empty, error: "no data" };

    const price: number | null = meta.regularMarketPrice ?? null;
    const prevClose: number | null = meta.chartPreviousClose ?? meta.previousClose ?? null;
    const change = price != null && prevClose != null ? price - prevClose : null;
    const changePct = change != null && prevClose ? (change / prevClose) * 100 : null;

    const closes: (number | null)[] = result?.indicators?.quote?.[0]?.close ?? [];
    const spark = closes.filter((v): v is number => typeof v === "number");

    return {
      ...empty,
      price,
      prevClose,
      change,
      changePct,
      dayHigh: meta.regularMarketDayHigh ?? null,
      dayLow: meta.regularMarketDayLow ?? null,
      marketTime: meta.regularMarketTime ?? null,
      spark,
    };
  } catch (e) {
    return { ...empty, error: e instanceof Error ? e.message : "fetch failed" };
  }
}

export async function getQuotes(): Promise<QuotesResponse> {
  const quotes = await Promise.all(SYMBOLS.map(fetchQuote));
  return { updatedAt: new Date().toISOString(), quotes };
}
