import { SYMBOLS, type SymbolDef } from "./symbols";
import { RANGES, type RangeDef, type RangeKey } from "./ranges";

export interface Quote extends SymbolDef {
  price: number | null;
  prevClose: number | null; // 기간 시작 직전 종가 (등락 기준)
  change: number | null;
  changePct: number | null;
  high: number | null; // 기간 고가
  low: number | null; // 기간 저가
  marketTime: number | null; // unix seconds
  spark: number[];
  times: number[]; // spark와 같은 길이의 unix seconds
  error?: string;
}

export interface QuotesResponse {
  range: RangeKey;
  updatedAt: string;
  quotes: Quote[];
}

const CHART_URL = "https://query1.finance.yahoo.com/v8/finance/chart/";

function chartQuery(range: RangeDef) {
  if (range.key === "1d") return `range=1d&interval=${range.interval}`;
  const now = Math.floor(Date.now() / 1000);
  return `period1=${now - range.days * 86400}&period2=${now}&interval=${range.interval}`;
}

const nums = (arr: (number | null)[] | undefined) =>
  (arr ?? []).filter((v): v is number => typeof v === "number");

async function fetchQuote(def: SymbolDef, range: RangeDef): Promise<Quote> {
  const empty: Quote = {
    ...def,
    price: null,
    prevClose: null,
    change: null,
    changePct: null,
    high: null,
    low: null,
    marketTime: null,
    spark: [],
    times: [],
  };

  try {
    const url = `${CHART_URL}${encodeURIComponent(def.symbol)}?${chartQuery(range)}`;
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

    const ohlc = result?.indicators?.quote?.[0];
    const ts: number[] = result?.timestamp ?? [];
    const closes: (number | null)[] = ohlc?.close ?? [];
    const valid = closes.flatMap((v, i) => (typeof v === "number" && ts[i] != null ? [i] : []));
    const spark = valid.map((i) => closes[i] as number);
    const times = valid.map((i) => ts[i]);
    const highs = nums(ohlc?.high);
    const lows = nums(ohlc?.low);
    const isDay = range.key === "1d";
    // 일부 심볼(예: CNYKRW=X)은 장기 기간에 데이터가 거의 없음 → 하루 등락이 기간 등락처럼 보이지 않게 처리
    if (!isDay && spark.length < 2) return { ...empty, price, marketTime: meta.regularMarketTime ?? null, error: "no range data" };

    return {
      ...empty,
      price,
      prevClose,
      change,
      changePct,
      high: (isDay ? meta.regularMarketDayHigh : null) ?? (highs.length ? Math.max(...highs) : null),
      low: (isDay ? meta.regularMarketDayLow : null) ?? (lows.length ? Math.min(...lows) : null),
      marketTime: meta.regularMarketTime ?? null,
      spark,
      times,
    };
  } catch (e) {
    return { ...empty, error: e instanceof Error ? e.message : "fetch failed" };
  }
}

export async function getQuotes(range: RangeDef = RANGES[0]): Promise<QuotesResponse> {
  const quotes = await Promise.all(SYMBOLS.map((def) => fetchQuote(def, range)));
  return { range: range.key, updatedAt: new Date().toISOString(), quotes };
}
