import { SYMBOLS, type SymbolDef } from "./symbols";
import { RANGES, segmentQuery, type RangeDef, type RangeKey } from "./ranges";

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

export interface QuoteWindow {
  from: number; // unix seconds
  to: number;
}

export interface QuotesResponse {
  range: RangeKey;
  window: QuoteWindow | null; // 하위 구간을 확대 조회한 경우

  updatedAt: string;
  quotes: Quote[];
}

const CHART_URL = "https://query1.finance.yahoo.com/v8/finance/chart/";

function chartQuery(range: RangeDef, win: QuoteWindow | null) {
  if (win) return `period1=${win.from}&period2=${win.to}&interval=${segmentQuery(win.from, win.to).interval}`;
  if (range.key === "1d") return `range=1d&interval=${range.interval}`;
  const now = Math.floor(Date.now() / 1000);
  return `period1=${now - range.days * 86400}&period2=${now}&interval=${range.interval}`;
}

const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

function median(xs: number[]) {
  const s = [...xs].sort((a, b) => a - b);
  return s.length % 2 ? s[s.length >> 1] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
}

// Yahoo 장기 데이터에는 가끔 자릿수가 틀린 값(예: USD/KRW 0.1154)이 섞여 있음
// → 앞뒤 이웃 중앙값과 비교해 크게 벗어난 점은 제외
function dropSpikes(idx: number[], closes: (number | null)[]) {
  return idx.filter((i, k) => {
    const neighbors = [...idx.slice(Math.max(0, k - 3), k), ...idx.slice(k + 1, k + 4)].map((j) => closes[j] as number);
    if (neighbors.length < 2) return true;
    const ratio = (closes[i] as number) / median(neighbors);
    return ratio > 0.4 && ratio < 2.5;
  });
}

async function fetchQuote(def: SymbolDef, range: RangeDef, win: QuoteWindow | null): Promise<Quote> {
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
    const url = `${CHART_URL}${encodeURIComponent(def.symbol)}?${chartQuery(range, win)}`;
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

    const prevClose: number | null = meta.chartPreviousClose ?? meta.previousClose ?? null;

    const ohlc = result?.indicators?.quote?.[0];
    const ts: number[] = result?.timestamp ?? [];
    const closes: (number | null)[] = ohlc?.close ?? [];
    const highsRaw: (number | null)[] = ohlc?.high ?? [];
    const lowsRaw: (number | null)[] = ohlc?.low ?? [];
    const valid = dropSpikes(
      closes.flatMap((v, i) => (isNum(v) && v > 0 && ts[i] != null ? [i] : [])),
      closes,
    );
    const spark = valid.map((i) => closes[i] as number);
    const times = valid.map((i) => ts[i]);
    // 고가/저가도 같은 봉의 종가와 동떨어진 값은 제외
    const near = (v: number | null, i: number): v is number => isNum(v) && v / (closes[i] as number) > 0.5 && v / (closes[i] as number) < 2;
    const highs = valid.flatMap((i) => (near(highsRaw[i], i) ? [highsRaw[i] as number] : []));
    const lows = valid.flatMap((i) => (near(lowsRaw[i], i) ? [lowsRaw[i] as number] : []));
    const isDay = range.key === "1d" && !win;
    // 과거 구간은 현재가 대신 구간 마지막 종가를 기준으로 표시
    const price: number | null = win ? (spark[spark.length - 1] ?? null) : (meta.regularMarketPrice ?? null);
    const marketTime: number | null = win ? (times[times.length - 1] ?? null) : (meta.regularMarketTime ?? null);
    const change = price != null && prevClose != null ? price - prevClose : null;
    const changePct = change != null && prevClose ? (change / prevClose) * 100 : null;
    // 일부 심볼(예: CNYKRW=X)은 장기 기간에 데이터가 거의 없고, 주말 등 휴장 구간도 비어 있음
    // → 하루 등락이 기간 등락처럼 보이지 않게 처리
    if (!isDay && spark.length < 2) return { ...empty, price, marketTime, error: "no range data" };

    return {
      ...empty,
      price,
      prevClose,
      change,
      changePct,
      // 장 시작 전 지수(^IRX 등)는 당일 고저가 0으로 오므로 0은 값 없음으로 취급
      high: (isDay && meta.regularMarketDayHigh > 0 ? meta.regularMarketDayHigh : null) ?? (highs.length ? Math.max(...highs) : null),
      low: (isDay && meta.regularMarketDayLow > 0 ? meta.regularMarketDayLow : null) ?? (lows.length ? Math.min(...lows) : null),
      marketTime,
      spark,
      times,
    };
  } catch (e) {
    return { ...empty, error: e instanceof Error ? e.message : "fetch failed" };
  }
}

export async function getQuotes(range: RangeDef = RANGES[0], win: QuoteWindow | null = null): Promise<QuotesResponse> {
  const quotes = await Promise.all(SYMBOLS.map((def) => fetchQuote(def, range, win)));
  return { range: range.key, window: win, updatedAt: new Date().toISOString(), quotes };
}
