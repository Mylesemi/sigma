"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { QuotesResponse } from "@/lib/quotes";
import { RANGES, buildSegments, getRange, type RangeKey, type Segment } from "@/lib/ranges";
import { CATEGORIES, type Category } from "@/lib/symbols";
import CompareChart from "./CompareChart";
import ErrorBoundary from "./ErrorBoundary";
import QuoteCard from "./QuoteCard";
import SegmentPicker from "./SegmentPicker";

const REFRESH_MS = 30_000;
const TICKER = ["KRW=X", "^KS11", "^GSPC", "^IXIC", "GC=F", "CL=F", "^TNX", "BTC-USD"];

// 요청/응답이 같은 화면(기간 + 하위 구간)에 해당하는지 비교하는 키
const viewKey = (range: RangeKey, from?: number | null) => (from ? `${range}:${from}` : range);

export default function Dashboard() {
  const [data, setData] = useState<QuotesResponse | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<Category | "all">("all");
  const [range, setRange] = useState<RangeKey>("1d");
  const [view, setView] = useState<"cards" | "compare">("cards");
  const [segments, setSegments] = useState<Segment[]>([]);
  const [seg, setSeg] = useState<Segment | null>(null); // 확대해서 보는 하위 구간 (null = 기간 전체)
  const wantKey = viewKey(range, seg?.from);
  const wantRef = useRef(wantKey);
  wantRef.current = wantKey;

  const changeRange = (key: RangeKey) => {
    if (key === range) return;
    setRange(key);
    setSeg(null);
    setSegments([]);
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = seg ? `range=${range}&from=${seg.from}&to=${seg.to}` : `range=${range}`;
      // CDN은 캐시하되 브라우저는 매번 새로 요청 (stale-while-revalidate로 오래된 시세가 보이지 않도록)
      const res = await fetch(`/api/quotes?${qs}`, { cache: "no-store" });
      if (!res.ok) throw new Error(String(res.status));
      const json: QuotesResponse = await res.json();
      // 기간/구간을 빠르게 바꾸면 응답 순서가 뒤바뀔 수 있음 → 현재 선택이 아닌 응답은 버림
      if (viewKey(json.range, json.window?.from) !== wantRef.current) return;
      setData(json);
      const unit = getRange(json.range).segment;
      if (!json.window && unit) setSegments(buildSegments(unit, json.quotes.flatMap((q) => (q.error ? [] : (q.times ?? [])))));
      setError(false);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [range, seg]);

  useEffect(() => {
    load();
    // 이미 끝난 과거 구간은 값이 바뀌지 않으므로 자동 갱신하지 않음
    const settled = seg != null && seg.to < Date.now() / 1000 - 86400;
    const id = setInterval(() => {
      if (!settled && document.visibilityState === "visible") load();
    }, REFRESH_MS);
    const onVisible = () => document.visibilityState === "visible" && load();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [load, seg]);

  // 기간 전환 중에는 이전 데이터를 흐리게 유지 (화면이 깜빡이지 않도록)
  const stale = data != null && viewKey(data.range, data.window?.from) !== wantKey;
  const shownRange = getRange(data?.range ?? range);
  const shownSeg = data?.window ? segments.find((s) => s.from === data.window!.from) : undefined;
  const baseLabel = data?.window
    ? `${shownSeg?.label ?? "선택 구간"} 시작 대비`
    : shownRange.key === "1d"
      ? "전일 종가 대비"
      : `${shownRange.label} 전 대비`;
  const quotes = data?.quotes ?? [];
  const tickerItems = TICKER.map((s) => quotes.find((q) => q.symbol === s)).filter(Boolean);
  const sections = CATEGORIES.filter((c) => filter === "all" || c.key === filter);

  return (
    <>
      <header className="topbar">
        <div className="brand">
          <span className="logo">Σ</span>
          <span>
            <strong>SIGMA</strong>
            <small>Signals &amp; Indicators for Global Market Analysis</small>
          </span>
        </div>
        <div className="status">
          <span className={`dot ${error ? "bad" : loading ? "busy" : "ok"}`} />
          {error
            ? "연결 오류 · 재시도 중"
            : data
              ? `${new Date(data.updatedAt).toLocaleTimeString("ko-KR", { hour12: false })} 업데이트`
              : "불러오는 중…"}
          <button onClick={load} disabled={loading} aria-label="새로고침">
            ↻
          </button>
        </div>
      </header>

      {tickerItems.length > 0 && (
        <div className="ticker">
          {tickerItems.map((q) => {
            const dir = !q!.change ? "flat" : q!.change > 0 ? "up" : "down";
            return (
              <span key={q!.symbol} className="tick">
                <b>{q!.name}</b>
                {q!.price?.toLocaleString("ko-KR", { maximumFractionDigits: q!.digits })}
                <em className={dir}>
                  {q!.changePct == null ? "" : `${q!.changePct > 0 ? "+" : ""}${q!.changePct.toFixed(2)}%`}
                </em>
              </span>
            );
          })}
        </div>
      )}

      <div className="toolbar">
        <nav className="filters" aria-label="카테고리">
          <button className={filter === "all" ? "active" : ""} onClick={() => setFilter("all")}>
            전체
          </button>
          {CATEGORIES.map((c) => (
            <button key={c.key} className={filter === c.key ? "active" : ""} onClick={() => setFilter(c.key)}>
              {c.title}
            </button>
          ))}
        </nav>
        <div className="controls">
          <div className="seg" role="group" aria-label="보기">
            <button aria-pressed={view === "cards"} className={view === "cards" ? "active" : ""} onClick={() => setView("cards")}>
              카드
            </button>
            <button aria-pressed={view === "compare"} className={view === "compare" ? "active" : ""} onClick={() => setView("compare")}>
              비교
            </button>
          </div>
          <div className="seg" role="group" aria-label="기간">
            {RANGES.map((r) => (
              <button key={r.key} aria-pressed={range === r.key} className={range === r.key ? "active" : ""} onClick={() => changeRange(r.key)}>
                {r.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {getRange(range).segment && segments.length > 0 && (
        <SegmentPicker unit={getRange(range).segment!} segments={segments} value={seg} onChange={setSeg} />
      )}

      <main className={stale ? "stale" : ""} aria-busy={stale}>
        {sections.map((c) => (
          <section key={c.key}>
            <h2>
              {c.title}
              {data && <small>{baseLabel}</small>}
            </h2>
            {view === "compare" ? (
              data ? (
                <ErrorBoundary
                  resetKey={data.updatedAt}
                  fallback={<div className="compare compare-empty">차트를 표시할 수 없습니다. 카드 보기를 이용해 주세요.</div>}>
                  <CompareChart
                    quotes={quotes.filter((q) => q.category === c.key)}
                    resetKey={viewKey(data.range, data.window?.from)}
                  />
                </ErrorBoundary>
              ) : (
                <div className="compare skeleton" />
              )
            ) : (
              <div className="grid">
                {data
                  ? quotes.filter((q) => q.category === c.key).map((q) => <QuoteCard key={q.symbol} q={q} />)
                  : Array.from({ length: 4 }, (_, i) => <div key={i} className="card skeleton" />)}
              </div>
            )}
          </section>
        ))}
      </main>

      <footer className="foot">
        데이터: Yahoo Finance · {REFRESH_MS / 1000}초마다 자동 갱신 · 시세는 거래소 사정에 따라 지연될 수 있으며 투자 판단의
        근거로 사용할 수 없습니다.
      </footer>
    </>
  );
}
