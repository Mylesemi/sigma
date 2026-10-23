// E2E용 결정적(deterministic) 가짜 시세 — 실제 API 응답과 같은 모양
import type { Quote, QuoteWindow, QuotesResponse } from "../../lib/quotes";
import { getRange, segmentQuery, type RangeKey } from "../../lib/ranges";
import { SYMBOLS } from "../../lib/symbols";

const MIN = 60;
const HOUR = 3600;
const DAY = 86400;

const STEP: Record<string, number> = { "5m": 5 * MIN, "15m": 15 * MIN, "30m": 30 * MIN, "1h": HOUR, "1d": DAY, "1wk": 7 * DAY, "1mo": 30 * DAY };

function isWeekendUtc(t: number) {
  const d = new Date(t * 1000).getUTCDay();
  return d === 0 || d === 6;
}

export function makeQuotes(range: RangeKey, win: QuoteWindow | null = null, now = Math.floor(Date.now() / 1000)): QuotesResponse {
  const def = getRange(range);
  const interval = win ? segmentQuery(win.from, win.to, now).interval : def.interval;
  const step = STEP[interval];
  const from = win ? win.from : now - (range === "1d" ? 8 * HOUR : def.days * DAY);
  const to = win ? Math.min(win.to, now) : now;

  const quotes: Quote[] = SYMBOLS.map((s, i) => {
    const base = 100 * (i + 1);
    // 가상자산만 주말 데이터 포함 (실제 서버는 주말을 빼지만, 클라이언트의 주말 칩 제외도 검증하려고)
    const crypto = s.symbol.endsWith("-USD");
    const times: number[] = [];
    for (let t = from + step; t <= to; t += step) if (crypto || step >= 7 * DAY || !isWeekendUtc(t)) times.push(t);
    const spark = times.map((_, k) => +(base * (1 + 0.04 * Math.sin(k / 6 + i) + 0.002 * k * ((i % 3) - 1))).toFixed(4));
    const longRange = range !== "1d" && range !== "1w";
    if ((s.symbol === "CNYKRW=X" && longRange) || spark.length < 2) {
      return { ...s, price: base, prevClose: null, change: null, changePct: null, high: null, low: null, marketTime: now, spark: [], times: [], error: "no range data" };
    }
    const price = spark[spark.length - 1];
    return {
      ...s,
      price,
      prevClose: base,
      change: price - base,
      changePct: ((price - base) / base) * 100,
      high: Math.max(...spark),
      low: Math.min(...spark),
      marketTime: times[times.length - 1],
      spark,
      times,
    };
  });
  return { range, window: win, updatedAt: new Date(now * 1000).toISOString(), quotes };
}
