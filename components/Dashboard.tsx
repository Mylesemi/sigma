"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { loadCustomStocks, saveCustomStocks, type CustomStock } from "@/lib/customStocks";
import type { Quote, QuotesResponse } from "@/lib/quotes";
import { RANGES, buildSegments, getRange, type RangeKey, type Segment } from "@/lib/ranges";
import { CATEGORIES, SYMBOLS, isBuiltin } from "@/lib/symbols";
import { DEFAULT_STATE, MAX_PICKS, parseUrlState, toSearch, type Filter, type View } from "@/lib/urlState";
import CompareChart from "./CompareChart";
import ErrorBoundary from "./ErrorBoundary";
import PickList from "./PickList";
import QuoteCard from "./QuoteCard";
import SegmentPicker from "./SegmentPicker";
import StockSearch from "./StockSearch";

const REFRESH_MS = 30_000;
const TICKER = ["KRW=X", "^KS11", "^GSPC", "^IXIC", "GC=F", "CL=F", "^TNX", "BTC-USD"];

// 요청/응답이 같은 화면(기간 + 하위 구간)에 해당하는지 비교하는 키
const viewKey = (range: RangeKey, from?: number | null) => (from ? `${range}:${from}` : range);

// 직접 비교 자산 — 색상 슬롯을 추가 시점에 고정해, 다른 자산을 빼도 남은 자산의 색이 바뀌지 않게 함
interface Pick {
  symbol: string;
  slot: number;
}
const toPicks = (symbols: string[]): Pick[] => symbols.map((symbol, slot) => ({ symbol, slot }));

// URL의 구간 시작 시각 → 해당 기간의 구간 (기간에 맞지 않으면 null)
function segmentFrom(range: RangeKey, from: number | null): Segment | null {
  const unit = getRange(range).segment;
  return unit && from ? (buildSegments(unit, [from])[0] ?? null) : null;
}

interface Section {
  key: string;
  title: string;
  quotes: Quote[];
  slots?: number[];
}

export default function Dashboard() {
  const [ready, setReady] = useState(false); // URL에서 초기 상태를 읽은 뒤에만 조회
  const [data, setData] = useState<QuotesResponse | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<Filter>(DEFAULT_STATE.filter);
  const [range, setRange] = useState<RangeKey>(DEFAULT_STATE.range);
  const [view, setView] = useState<View>(DEFAULT_STATE.view);
  const [picks, setPicks] = useState<Pick[]>(toPicks(DEFAULT_STATE.picks));
  const [customStocks, setCustomStocks] = useState<CustomStock[]>([]); // 웹에서 추가한 종목 (브라우저에 저장)
  // 하위 구간 목록은 어느 기간의 것인지와 함께 보관 (다른 기간 목록이 잠깐이라도 보이지 않게)
  const [segInfo, setSegInfo] = useState<{ range: RangeKey; list: Segment[] }>({ range: DEFAULT_STATE.range, list: [] });
  const segments = segInfo.range === range ? segInfo.list : [];
  const [seg, setSeg] = useState<Segment | null>(null); // 확대해서 보는 하위 구간 (null = 기간 전체)
  const wantKey = viewKey(range, seg?.from);
  const wantRef = useRef(wantKey);
  wantRef.current = wantKey;
  const segInfoRef = useRef(segInfo);
  segInfoRef.current = segInfo;
  // 첫 진입 시 주소 정리(잘못된 값 제거 등)는 방문 기록에 새로 쌓지 않음
  // (뒤로/앞으로 가기 후에는 상태가 곧 그 주소라 다시 쓸 일이 없음)
  const fromUrl = useRef(false);

  // URL → 상태 (첫 진입, 뒤로/앞으로 가기)
  useEffect(() => {
    const apply = (initial: boolean) => {
      const s = parseUrlState(window.location.search);
      setFilter(s.filter);
      setRange(s.range);
      setView(s.view);
      setPicks(toPicks(s.picks));
      setSeg(segmentFrom(s.range, s.seg));
      if (initial) {
        fromUrl.current = true;
        setCustomStocks(loadCustomStocks());
      }
      setReady(true);
    };
    apply(true);
    const onPop = () => apply(false);
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  // 상태 → URL (사용자가 바꿀 때마다 기록해 뒤로 가기로 되돌릴 수 있게)
  useEffect(() => {
    if (!ready) return;
    const search = toSearch({ filter, range, view, seg: seg?.from ?? null, picks: picks.map((p) => p.symbol) });
    const replace = fromUrl.current;
    fromUrl.current = false;
    if (search === window.location.search) return;
    const url = `${window.location.pathname}${search}`;
    if (replace) window.history.replaceState(null, "", url);
    else window.history.pushState(null, "", url);
  }, [ready, filter, range, view, seg, picks]);

  const changeRange = (key: RangeKey) => {
    if (key === range) return;
    setRange(key);
    setSeg(null);
  };

  const addPick = (symbol: string) =>
    setPicks((prev) => {
      if (prev.length >= MAX_PICKS || prev.some((p) => p.symbol === symbol)) return prev;
      const used = new Set(prev.map((p) => p.slot));
      const slot = Array.from({ length: MAX_PICKS }, (_, i) => i).find((i) => !used.has(i)) ?? prev.length;
      return [...prev, { symbol, slot }];
    });
  const removePick = (symbol: string) => setPicks((prev) => prev.filter((p) => p.symbol !== symbol));

  const updateCustom = (fn: (prev: CustomStock[]) => CustomStock[]) =>
    setCustomStocks((prev) => {
      const next = fn(prev);
      saveCustomStocks(next);
      return next;
    });
  const addCustom = (stock: CustomStock) =>
    updateCustom((prev) => (prev.some((s) => s.symbol === stock.symbol) ? prev : [...prev, stock]));
  const removeCustom = (symbol: string) => updateCustom((prev) => prev.filter((s) => s.symbol !== symbol));

  // 기본 목록에 없는 종목은 함께 조회 — 추가한 종목 + 공유 링크로 받은 직접 비교 종목. 정렬해 CDN 캐시 키를 맞춤
  const extra = useMemo(
    () => [...new Set([...customStocks.map((s) => s.symbol), ...picks.map((p) => p.symbol)])].filter((s) => !isBuiltin(s)).sort().join(","),
    [customStocks, picks],
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = (seg ? `range=${range}&from=${seg.from}&to=${seg.to}` : `range=${range}`) + (extra ? `&extra=${encodeURIComponent(extra)}` : "");
      // CDN은 캐시하되 브라우저는 매번 새로 요청 (stale-while-revalidate로 오래된 시세가 보이지 않도록)
      const res = await fetch(`/api/quotes?${qs}`, { cache: "no-store" });
      if (!res.ok) throw new Error(String(res.status));
      const json: QuotesResponse = await res.json();
      // 기간/구간을 빠르게 바꾸면 응답 순서가 뒤바뀔 수 있음 → 현재 선택이 아닌 응답은 버림
      if (viewKey(json.range, json.window?.from) !== wantRef.current) return;
      setData(json);
      const unit = getRange(json.range).segment;
      const toSegments = (r: QuotesResponse) => buildSegments(unit!, r.quotes.flatMap((q) => (q.error ? [] : (q.times ?? []))));
      if (unit && !json.window) setSegInfo({ range: json.range, list: toSegments(json) });
      else if (unit && segInfoRef.current.range !== json.range) {
        // 구간이 담긴 링크로 바로 들어온 경우: 구간 목록을 만들려고 전체 기간을 한 번 더 조회
        fetch(`/api/quotes?range=${json.range}`, { cache: "no-store" })
          .then((r) => r.json())
          .then((full: QuotesResponse) => setSegInfo({ range: full.range, list: toSegments(full) }))
          .catch(() => {});
      }
      setError(false);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [range, seg, extra]);

  useEffect(() => {
    if (!ready) return;
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
  }, [ready, load, seg]);

  // 기간 전환 중에는 이전 데이터를 흐리게 유지 (화면이 깜빡이지 않도록)
  const stale = data != null && viewKey(data.range, data.window?.from) !== wantKey;
  const shownRange = getRange(data?.range ?? range);
  const shownSeg = data?.window ? (segments.find((s) => s.from === data.window!.from) ?? seg) : undefined;
  const baseLabel = data?.window
    ? `${shownSeg?.label ?? "선택 구간"} 시작 대비`
    : shownRange.key === "1d"
      ? "전일 종가 대비"
      : `${shownRange.label} 전 대비`;
  // 추가한 종목은 검색 때 고른 이름(한글명 등)으로 표시
  const quotes = useMemo(() => {
    const names = new Map(customStocks.map((s) => [s.symbol, s.name]));
    return (data?.quotes ?? []).map((q) => (names.has(q.symbol) ? { ...q, name: names.get(q.symbol)! } : q));
  }, [data, customStocks]);
  const customSet = new Set(customStocks.map((s) => s.symbol));
  const pickOptions = [
    ...SYMBOLS.map(({ symbol, name, category }) => ({ symbol, name, category })),
    ...customStocks.map((s) => ({ symbol: s.symbol, name: s.name, category: "stock" as const })),
  ];
  const tickerItems = TICKER.map((s) => quotes.find((q) => q.symbol === s)).filter(Boolean);
  const pickedQuotes = picks.flatMap((p) => quotes.filter((q) => q.symbol === p.symbol));
  const sections: Section[] =
    filter === "custom"
      ? [{ key: "custom", title: "직접 비교", quotes: pickedQuotes, slots: picks.filter((p) => quotes.some((q) => q.symbol === p.symbol)).map((p) => p.slot) }]
      : CATEGORIES.filter((c) => filter === "all" || c.key === filter).map((c) => ({
          key: c.key,
          title: c.title,
          // 공유 링크의 직접 비교 때문에 함께 받은 종목은 개별 종목 목록에 넣지 않음
          quotes: quotes.filter((q) => q.category === c.key && (!q.custom || customSet.has(q.symbol))),
        }));

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
          <button className={filter === "custom" ? "active" : ""} onClick={() => setFilter("custom")}>
            직접 비교
          </button>
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
            {c.key === "custom" && (
              <PickList
                options={pickOptions}
                picks={picks.map((p) => p.symbol)}
                slots={picks.map((p) => p.slot)}
                onAdd={addPick}
                onRemove={removePick}
              />
            )}
            {c.key === "stock" && <StockSearch stocks={customStocks} onAdd={addCustom} onRemove={removeCustom} />}
            {c.key === "custom" && picks.length === 0 ? (
              <div className="compare compare-empty">비교할 자산을 추가하세요.</div>
            ) : view === "compare" ? (
              data ? (
                <ErrorBoundary
                  resetKey={data.updatedAt}
                  fallback={<div className="compare compare-empty">차트를 표시할 수 없습니다. 카드 보기를 이용해 주세요.</div>}>
                  <CompareChart quotes={c.quotes} slots={c.slots} resetKey={viewKey(data.range, data.window?.from)} />
                </ErrorBoundary>
              ) : (
                <div className="compare skeleton" />
              )
            ) : (
              <div className="grid">
                {data
                  ? c.quotes.map((q) => <QuoteCard key={q.symbol} q={q} />)
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
