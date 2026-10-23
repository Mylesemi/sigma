"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Quote } from "@/lib/quotes";
import type { RangeKey } from "@/lib/ranges";

const H = 280;
const PAD = { top: 12, right: 52, bottom: 26, left: 8 };

interface Series {
  q: Quote;
  slot: number; // 색상 슬롯: 카테고리 내 심볼 순서로 고정 (숨김·오류와 무관)
  pts: { t: number; v: number }[]; // v = 기간 시작 대비 등락률(%)
}

function fmtPct(v: number) {
  v = v === 0 ? 0 : v; // -0 → 0 ("-0%" 방지)
  const digits = Math.abs(v) >= 100 ? 0 : 2;
  return `${v > 0 ? "+" : ""}${v.toLocaleString("ko-KR", { minimumFractionDigits: digits, maximumFractionDigits: digits })}%`;
}

function fmtTick(v: number) {
  v = Math.abs(v) < 1e-9 ? 0 : v; // -0·부동소수 오차 → 0 ("-0%" 방지)
  return `${v > 0 ? "+" : ""}${v.toLocaleString("ko-KR", { maximumFractionDigits: Math.abs(v) >= 10 ? 0 : 2 })}%`;
}

function fmtAxisTime(sec: number, range: RangeKey) {
  const d = new Date(sec * 1000);
  if (range === "1d") return `${d.getHours()}시`;
  if (range === "1w") return `${d.getMonth() + 1}/${d.getDate()}`;
  if (range === "1y") return d.getMonth() === 0 ? `${d.getFullYear()}년` : `${d.getMonth() + 1}월`;
  return `${d.getFullYear()}`;
}

// x축 눈금을 달력 경계(정시·자정·월초·연초)에 맞춤 — 같은 라벨이 반복되지 않도록
function calendarTicks(t0: number, t1: number, range: RangeKey, maxTicks: number) {
  const unit = range === "1d" ? "hour" : range === "1w" ? "day" : range === "1y" ? "month" : "year";
  const steps = unit === "hour" ? [1, 2, 3, 6, 12] : unit === "day" ? [1, 2] : unit === "month" ? [1, 2, 3, 6] : [1, 2, 5];
  const start = new Date(t0 * 1000);
  if (unit === "hour") start.setMinutes(0, 0, 0);
  else start.setHours(0, 0, 0, 0);
  if (unit === "month" || unit === "year") start.setDate(1);
  if (unit === "year") start.setMonth(0);
  const all: number[] = [];
  for (const d = new Date(start); d.getTime() / 1000 <= t1 && all.length < 1000; ) {
    if (d.getTime() / 1000 >= t0) all.push(d.getTime() / 1000);
    if (unit === "hour") d.setHours(d.getHours() + 1);
    else if (unit === "day") d.setDate(d.getDate() + 1);
    else if (unit === "month") d.setMonth(d.getMonth() + 1);
    else d.setFullYear(d.getFullYear() + 1);
  }
  const key = (t: number) => {
    const d = new Date(t * 1000);
    return unit === "hour" ? d.getHours() : unit === "day" ? d.getDate() : unit === "month" ? d.getMonth() : d.getFullYear();
  };
  for (const step of steps) {
    const picked = all.filter((t) => key(t) % step === 0);
    if (picked.length <= maxTicks) return picked;
  }
  return all.filter((_, i) => i % Math.ceil(all.length / maxTicks) === 0);
}

function fmtTipTime(sec: number, range: RangeKey) {
  const d = new Date(sec * 1000);
  if (range === "1d" || range === "1w")
    return d.toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false });
  return d.toLocaleDateString("ko-KR", { year: "numeric", month: "numeric", day: "numeric" });
}

// 보기 좋은 눈금 간격 (1·2·5 × 10^n)
function niceTicks(min: number, max: number, count: number) {
  const raw = (max - min) / count || 1;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? raw;
  const ticks: number[] = [];
  for (let v = Math.ceil(min / step) * step; v <= max + step * 1e-9; v += step) ticks.push(Math.round(v / step) * step);
  return ticks;
}

// 로그 축 눈금: 배율 1·2·5 × 10^n (너무 많으면 10^n만)
function logTicks(rMin: number, rMax: number) {
  const pick = (ms: number[]) => {
    const out: number[] = [];
    for (let e = -4; e <= 6; e++) for (const m of ms) {
      const r = m * 10 ** e;
      if (r >= rMin && r <= rMax) out.push(r);
    }
    return out;
  };
  const fine = pick([1, 2, 5]);
  return (fine.length > 7 ? pick([1]) : fine).map((r) => (r - 1) * 100);
}

// 데이터가 없는 긴 구간(주말 등)을 x축에서 접어 붙이는 시간 변환
// 간격이 중앙값의 6배이자 3시간을 넘으면 그 구간을 중앙값 하나 길이로 줄임
function gapCompressor(times: number[]) {
  const ts = [...new Set(times)].sort((a, b) => a - b);
  const diffs = ts.slice(1).map((t, i) => t - ts[i]);
  const step = diffs.length ? [...diffs].sort((a, b) => a - b)[diffs.length >> 1] : 0;
  const gaps: { start: number; end: number; removed: number }[] = [];
  diffs.forEach((d, i) => {
    if (d > step * 6 && d > 3 * 3600) gaps.push({ start: ts[i], end: ts[i + 1], removed: d - step });
  });
  const map = (t: number) => {
    let out = t;
    for (const g of gaps) {
      if (t >= g.end) out -= g.removed;
      else if (t > g.start) out -= Math.min(t - g.start, g.removed); // 접힌 구간 안의 시각은 시작점 쪽으로
    }
    return out;
  };
  // 접힌 구간 안의 시각 → 데이터가 다시 시작하는 시각 (예: 월요일 자정 눈금 → 월요일 장 시작)
  const snap = (t: number) => gaps.find((g) => t > g.start && t < g.end)?.end ?? t;
  return { map, snap, gaps };
}

// 자산 자신의 장이 닫힌 구간(자기 봉 간격 중앙값의 6배이자 3시간 초과)에서는 선을 끊음
// → 다른 시장이 거래하는 시간에 이 자산이 움직인 것처럼 직선으로 잇지 않도록
function linePath(pts: Series["pts"], x: (t: number) => number, y: (v: number) => number) {
  const diffs = pts.slice(1).map((p, i) => p.t - pts[i].t).sort((a, b) => a - b);
  const step = diffs[diffs.length >> 1] ?? 0;
  return pts
    .map((p, i) => {
      const brk = i === 0 || (p.t - pts[i - 1].t > step * 6 && p.t - pts[i - 1].t > 3 * 3600);
      return `${brk ? "M" : "L"}${x(p.t).toFixed(1)},${y(p.v).toFixed(1)}`;
    })
    .join("");
}

// t 시점 직전(포함)의 값 — 거래 시간이 다른 자산도 같은 시각으로 읽기 위함
function valueAt(pts: Series["pts"], t: number) {
  if (!pts.length || t < pts[0].t) return null;
  let lo = 0;
  let hi = pts.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (pts[mid].t <= t) lo = mid;
    else hi = mid - 1;
  }
  return pts[lo].v;
}

// 데이터가 실제로 덮는 시간 길이로 축 눈금 단위를 정함 (하위 구간 확대 시에도 맞도록)
function scaleFor(span: number): RangeKey {
  const day = 86400;
  return span <= 2 * day ? "1d" : span <= 10 * day ? "1w" : span <= 400 * day ? "1y" : "3y";
}

interface Props {
  quotes: Quote[];
  slots?: number[]; // 색상 슬롯 (생략하면 목록 순서 — 카테고리 내 심볼 순서)
  resetKey: string;
}

export default function CompareChart({ quotes, slots, resetKey }: Props) {
  const wrap = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [hoverT, setHoverT] = useState<number | null>(null);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // 기간/구간이 바뀌면 이전 호버 시각은 의미가 없음
  useEffect(() => setHoverT(null), [resetKey]);

  const series: Series[] = useMemo(
    () =>
      quotes.map((q, i) => {
        const slot = slots?.[i] ?? i;
        const spark = q.spark ?? [];
        const times = q.times ?? [];
        const base = q.prevClose ?? spark[0];
        // 시각이 없거나 길이가 어긋난 데이터(예: 이전 버전 API 응답)는 그리지 않음
        const ok = !q.error && !!base && times.length === spark.length;
        const pts = ok
          ? spark.map((v, i) => ({ t: times[i], v: (v / base - 1) * 100 })).filter((p) => Number.isFinite(p.t) && Number.isFinite(p.v))
          : [];
        return { q, slot, pts };
      }),
    [quotes, slots],
  );

  const visible = series.filter((s) => s.pts.length > 1 && !hidden.has(s.q.symbol));
  const all = visible.flatMap((s) => s.pts);
  const t0 = Math.min(...all.map((p) => p.t));
  const t1 = Math.max(...all.map((p) => p.t));
  const range = scaleFor(t1 - t0);
  const vMin = Math.min(0, ...all.map((p) => p.v));
  const vMax = Math.max(0, ...all.map((p) => p.v));
  // 자산 간 배율 차이가 크면(예: 10년 비트코인 +17,000%) 선형 축에선 나머지가 바닥에 붙으므로 로그 축 사용
  const rMin = 1 + vMin / 100;
  const rMax = 1 + vMax / 100;
  const useLog = rMin > 0 && rMax / rMin > 4;
  const f = (v: number) => (useLog ? Math.log10(1 + v / 100) : v);
  let yTicks: number[];
  let y0: number;
  let y1: number;
  if (useLog) {
    const lPad = (Math.log10(rMax) - Math.log10(rMin)) * 0.05;
    y0 = Math.log10(rMin) - lPad;
    y1 = Math.log10(rMax) + lPad;
    yTicks = logTicks(10 ** y0, 10 ** y1);
  } else {
    const vPad = (vMax - vMin) * 0.08 || 1;
    yTicks = niceTicks(vMin - vPad, vMax + vPad, 5);
    y0 = Math.min(yTicks[0], vMin);
    y1 = Math.max(yTicks[yTicks.length - 1], vMax);
  }

  const plotW = Math.max(0, width - PAD.left - PAD.right);
  const plotH = H - PAD.top - PAD.bottom;
  const gap = gapCompressor(all.map((p) => p.t));
  const c0 = gap.map(t0);
  const c1 = gap.map(t1);
  const x = (t: number) => PAD.left + (c1 > c0 ? ((gap.map(t) - c0) / (c1 - c0)) * plotW : plotW / 2);
  const y = (v: number) => PAD.top + (1 - (f(v) - y0) / (y1 - y0 || 1)) * plotH;

  const xTicks = (t1 > t0 ? calendarTicks(t0, t1, range, Math.max(2, Math.floor(plotW / 70))) : [])
    .map(gap.snap)
    .filter((t, i, arr) => i === 0 || x(t) - x(arr[i - 1]) > 36); // 겹치는 라벨 제거

  const onMove = (e: React.PointerEvent<SVGRectElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = PAD.left + ((e.clientX - rect.left) / rect.width) * plotW;
    // 화면상 가장 가까운 실제 데이터 시각으로 스냅 (x축이 접혀 있어 시간이 아닌 픽셀로 비교)
    let best = t0;
    for (const s of visible) for (const p of s.pts) if (Math.abs(x(p.t) - px) < Math.abs(x(best) - px)) best = p.t;
    setHoverT(best);
  };

  const hasData = series.some((s) => s.pts.length > 1);

  const toggle = (sym: string) =>
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(sym)) next.delete(sym);
      else next.add(sym);
      return next;
    });

  const tipRows =
    hoverT == null
      ? []
      : visible
          .map((s) => ({ s, v: valueAt(s.pts, hoverT) }))
          .filter((r): r is { s: Series; v: number } => r.v != null)
          .sort((a, b) => b.v - a.v);
  const tipLeft = hoverT == null ? 0 : x(hoverT);

  return (
    <div className="compare">
      {useLog && visible.length > 0 && (
        <span className="scale-note" title="자산 간 등락 폭 차이가 커서 로그 축으로 표시합니다">로그 스케일</span>
      )}
      <ul className="legend">
        {series.map((s) => {
          const last = s.pts[s.pts.length - 1]?.v;
          const off = hidden.has(s.q.symbol);
          const empty = s.pts.length < 2;
          return (
            <li key={s.q.symbol}>
              <button
                className={off || empty ? "off" : ""}
                disabled={empty}
                aria-pressed={!off}
                onClick={() => toggle(s.q.symbol)}
              >
                <span className="key" style={{ background: `var(--s${s.slot + 1})` }} />
                {s.q.name}
                <b>{empty ? "데이터 없음" : fmtPct(last)}</b>
              </button>
            </li>
          );
        })}
      </ul>

      <div ref={wrap} className="compare-plot">
        {visible.length === 0 && (
          <div className="compare-empty">
            {hasData ? (
              <>
                범례에서 비교할 자산을 선택하세요.
                <button onClick={() => setHidden(new Set())}>모두 보기</button>
              </>
            ) : (
              "이 기간에 표시할 데이터가 없습니다."
            )}
          </div>
        )}
        {width > 0 && visible.length > 0 && (
          <svg width={width} height={H} role="img" aria-label="기간 시작 대비 등락률 비교 차트">
            {yTicks.map((v) => (
              <g key={v}>
                <line x1={PAD.left} x2={PAD.left + plotW} y1={y(v)} y2={y(v)} className={v === 0 ? "axis-zero" : "gridline"} />
                <text x={PAD.left + plotW + 6} y={y(v)} dy="0.32em" className="tick-label">
                  {fmtTick(v)}
                </text>
              </g>
            ))}
            {xTicks.map((t, i) => (
              <text
                key={i}
                x={x(t)}
                y={H - 6}
                className="tick-label"
                textAnchor={x(t) - PAD.left < 20 ? "start" : PAD.left + plotW - x(t) < 20 ? "end" : "middle"}
              >
                {fmtAxisTime(t, range)}
              </text>
            ))}

            {/* 접힌 지점 표시는 몇 개 안 될 때만 (일봉처럼 매 주말이 접히면 점선이 너무 촘촘해짐) */}
            {gap.gaps.length <= 3 && gap.gaps.map((g) => (
              <line key={g.start} x1={x(g.end)} x2={x(g.end)} y1={PAD.top} y2={PAD.top + plotH} className="gap-mark">
                <title>데이터 없는 구간(주말·휴장) 생략</title>
              </line>
            ))}

            {visible.map((s) => (
              <path
                key={s.q.symbol}
                d={linePath(s.pts, x, y)}
                fill="none"
                stroke={`var(--s${s.slot + 1})`}
                strokeWidth="2"
                strokeLinejoin="round"
              />
            ))}

            {hoverT != null && (
              <g>
                <line x1={x(hoverT)} x2={x(hoverT)} y1={PAD.top} y2={PAD.top + plotH} className="crosshair" />
                {tipRows.map(({ s, v }) => (
                  <circle key={s.q.symbol} cx={x(hoverT)} cy={y(v)} r="4" fill={`var(--s${s.slot + 1})`} className="dot" />
                ))}
              </g>
            )}

            <rect
              x={PAD.left}
              y={PAD.top}
              width={plotW}
              height={plotH}
              fill="transparent"
              style={{ touchAction: "pan-y" }}
              onPointerDown={onMove}
              onPointerMove={onMove}
              // 터치는 손을 떼면 pointerleave가 발생 → 마우스일 때만 툴팁 닫기 (터치는 다음 탭까지 유지)
              onPointerLeave={(e) => e.pointerType === "mouse" && setHoverT(null)}
            />
          </svg>
        )}

        {hoverT != null && tipRows.length > 0 && (
          <div className={`compare-tip ${tipLeft > width / 2 ? "left" : ""}`} style={{ left: tipLeft }}>
            <div className="tip-time">{fmtTipTime(hoverT, range)}</div>
            {tipRows.map(({ s, v }) => (
              <div key={s.q.symbol} className="tip-row">
                <span className="key" style={{ background: `var(--s${s.slot + 1})` }} />
                <b>{fmtPct(v)}</b>
                <span>{s.q.name}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
