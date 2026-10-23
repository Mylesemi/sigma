import { SYMBOLS, isBuiltin, type SymbolDef } from "./symbols";
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
  ext?: number[]; // spark와 같은 길이, 1 = 정규장 외(프리·애프터마켓) — 장외 시세가 있는 개별 주식만
  extPrice?: number | null; // 최신 장외 가격 (마지막 점이 장외일 때)
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

const intervalOf = (range: RangeDef, win: QuoteWindow | null) => (win ? segmentQuery(win.from, win.to).interval : range.interval);
// 분봉·시간봉은 장외(프리·애프터마켓) 시세 포함 — 일봉 이상에는 효과 없음. Yahoo는 미국 개별 주식에만 장외 시세를 줌
const isIntraday = (interval: string) => /^\d+[mh]$/.test(interval);

function chartQuery(range: RangeDef, win: QuoteWindow | null) {
  const interval = intervalOf(range, win);
  const prePost = isIntraday(interval) ? "&includePrePost=true" : "";
  if (win) return `period1=${win.from}&period2=${win.to}&interval=${interval}${prePost}`;
  if (range.key === "1d") return `range=1d&interval=${interval}${prePost}`;
  const now = Math.floor(Date.now() / 1000);
  return `period1=${now - range.days * 86400}&period2=${now}&interval=${interval}${prePost}`;
}

interface Period {
  start: number;
  end: number;
  gmtoffset?: number;
}

// 정규장인지 판정: [start, end) 안이면 정규장, end와 정확히 같으면 "경계", 그 밖은 장외
// (개별 주식·ETF만 — 환율·선물은 '정규장' 개념이 달라 표시하지 않음)
// 날짜별 정규장 시간(tradingPeriods)이 있으면 그것을, 없으면 오늘 정규장의 시각을 매일 같은 시각으로 적용
export type Session = "regular" | "edge" | "ext";
export function regularSessionTest(meta: {
  instrumentType?: string;
  gmtoffset?: number;
  tradingPeriods?: { regular?: Period[][] } | Period[][];
  currentTradingPeriod?: { regular?: Period };
}): ((t: number) => Session) | null {
  if (meta.instrumentType !== "EQUITY" && meta.instrumentType !== "ETF") return null;
  const tp = meta.tradingPeriods;
  const regular = (Array.isArray(tp) ? tp : tp?.regular)?.flat().filter((p) => p && p.end > p.start);
  if (regular?.length)
    return (t) => (regular.some((p) => t >= p.start && t < p.end) ? "regular" : regular.some((p) => t === p.end) ? "edge" : "ext");
  const cur = meta.currentTradingPeriod?.regular;
  if (!cur) return null;
  const off = meta.gmtoffset ?? 0;
  const tod = (t: number) => (((t + off) % 86400) + 86400) % 86400;
  const rs = tod(cur.start);
  const re = tod(cur.end) || 86400;
  if (re <= rs) return null;
  return (t) => (tod(t) >= rs && tod(t) < re ? "regular" : tod(t) === re % 86400 ? "edge" : "ext");
}

const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

function median(xs: number[]) {
  const s = [...xs].sort((a, b) => a - b);
  return s.length % 2 ? s[s.length >> 1] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
}

// Yahoo 장기 데이터에는 가끔 자릿수가 틀린 값(예: USD/KRW 0.1154)이 섞여 있음
// → 앞뒤 이웃 중앙값과 비교해 크게 벗어난 점은 제외
export function dropSpikes(idx: number[], closes: (number | null)[]) {
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
    // 사용자가 추가한 종목은 이름·통화·자릿수를 시세 응답에서 채움 (원화·엔화 등은 소수점 없음 — Yahoo priceHint는 원화에도 2)
    const currency: string | undefined = meta.currency;
    const info: Partial<SymbolDef> = def.custom
      ? {
          name: meta.shortName ?? meta.longName ?? def.symbol,
          sub: currency ? `${def.symbol} · ${currency}` : def.symbol,
          digits: currency && ["KRW", "JPY", "IDR", "VND"].includes(currency) ? 0 : 2,
        }
      : {};

    const ohlc = result?.indicators?.quote?.[0];
    const ts: number[] = result?.timestamp ?? [];
    const closes: (number | null)[] = ohlc?.close ?? [];
    const highsRaw: (number | null)[] = ohlc?.high ?? [];
    const lowsRaw: (number | null)[] = ohlc?.low ?? [];
    // 토·일 데이터 제외 (가상자산 등 주말 거래분). 거래소 현지 시각 기준으로 판단해야
    // 미국 금요일 장(한국 시간 토요일 새벽)이 잘리지 않음. 1일 기간과 주봉·월봉(봉 날짜가 주말일 수 있음)은 제외
    const interval = intervalOf(range, win);
    const skipWeekends = (win != null || range.key !== "1d") && interval !== "1wk" && interval !== "1mo";
    const offset: number = meta.gmtoffset ?? 0;
    const isWeekend = (t: number) => {
      const day = new Date((t + offset) * 1000).getUTCDay();
      return day === 0 || day === 6;
    };
    const valid = dropSpikes(
      closes.flatMap((v, i) => (isNum(v) && v > 0 && ts[i] != null && !(skipWeekends && isWeekend(ts[i])) ? [i] : [])),
      closes,
    );
    const spark = valid.map((i) => closes[i] as number);
    const times = valid.map((i) => ts[i]);
    // 고가/저가도 같은 봉의 종가와 동떨어진 값은 제외
    const near = (v: number | null, i: number): v is number => isNum(v) && v / (closes[i] as number) > 0.5 && v / (closes[i] as number) < 2;
    const highs = valid.flatMap((i) => (near(highsRaw[i], i) ? [highsRaw[i] as number] : []));
    const lows = valid.flatMap((i) => (near(lowsRaw[i], i) ? [lowsRaw[i] as number] : []));
    const isDay = range.key === "1d" && !win;
    // 장외 구간 표시 — 정규장 밖의 점이 실제로 있을 때만 (장외 시세가 없는 한국 주식 등은 표시 안 함)
    // 정규장 종료 시각과 같은 봉은 한국장 동시호가 종가처럼 정규장일 수도, 미국 애프터마켓 첫 봉일 수도 있어
    // 장외 점이 있는 종목에서만 장외로 봄
    const session = isIntraday(interval) ? regularSessionTest(meta) : null;
    const sessions = session ? times.map(session) : [];
    const hasExt = sessions.includes("ext");
    const ext = hasExt ? sessions.map((s) => (s === "regular" ? 0 : 1)) : [];
    // 과거 구간은 현재가 대신 구간 마지막 종가를 기준으로 표시
    const price: number | null = win ? (spark[spark.length - 1] ?? null) : (meta.regularMarketPrice ?? null);
    const marketTime: number | null = win ? (times[times.length - 1] ?? null) : (meta.regularMarketTime ?? null);
    const change = price != null && prevClose != null ? price - prevClose : null;
    const changePct = change != null && prevClose ? (change / prevClose) * 100 : null;
    // 일부 심볼(예: CNYKRW=X)은 장기 기간에 데이터가 거의 없고, 주말 등 휴장 구간도 비어 있음
    // → 하루 등락이 기간 등락처럼 보이지 않게 처리
    if (!isDay && spark.length < 2) return { ...empty, ...info, price, marketTime, error: "no range data" };

    return {
      ...empty,
      ...info,
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
      ...(hasExt ? { ext, extPrice: !win && ext[ext.length - 1] === 1 ? spark[spark.length - 1] : null } : {}),
    };
  } catch (e) {
    return { ...empty, error: e instanceof Error ? e.message : "fetch failed" };
  }
}

// extra: 사용자가 웹에서 추가한 종목 티커 (검증은 라우트에서)
export async function getQuotes(range: RangeDef = RANGES[0], win: QuoteWindow | null = null, extra: string[] = []): Promise<QuotesResponse> {
  const customDefs: SymbolDef[] = extra
    .filter((s) => !isBuiltin(s))
    .map((symbol) => ({ symbol, name: symbol, sub: symbol, category: "stock", digits: 2, custom: true }));
  const quotes = await Promise.all([...SYMBOLS, ...customDefs].map((def) => fetchQuote(def, range, win)));
  return { range: range.key, window: win, updatedAt: new Date().toISOString(), quotes };
}
