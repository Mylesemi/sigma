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
  return `${v > 0 ? "+" : ""}${v.toFixed(2)}%`;
}

function fmtAxisTime(sec: number, range: RangeKey) {
  const d = new Date(sec * 1000);
  if (range === "1d") return d.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", hour12: false });
  if (range === "1w") return d.toLocaleDateString("ko-KR", { month: "numeric", day: "numeric" });
  if (range === "1y") return d.toLocaleDateString("ko-KR", { year: "2-digit", month: "numeric" });
  return `${d.getFullYear()}`;
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

export default function CompareChart({ quotes, range }: { quotes: Quote[]; range: RangeKey }) {
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

  const series: Series[] = useMemo(
    () =>
      quotes.map((q, slot) => {
        const base = q.prevClose ?? q.spark[0];
        const pts = q.error || !base ? [] : q.spark.map((v, i) => ({ t: q.times[i], v: (v / base - 1) * 100 }));
        return { q, slot, pts };
      }),
    [quotes],
  );

  const visible = series.filter((s) => s.pts.length > 1 && !hidden.has(s.q.symbol));
  const all = visible.flatMap((s) => s.pts);
  const t0 = Math.min(...all.map((p) => p.t));
  const t1 = Math.max(...all.map((p) => p.t));
  const vMin = Math.min(0, ...all.map((p) => p.v));
  const vMax = Math.max(0, ...all.map((p) => p.v));
  const vPad = (vMax - vMin) * 0.08 || 1;
  const yTicks = niceTicks(vMin - vPad, vMax + vPad, 5);
  const y0 = Math.min(yTicks[0], vMin);
  const y1 = Math.max(yTicks[yTicks.length - 1], vMax);

  const plotW = Math.max(0, width - PAD.left - PAD.right);
  const plotH = H - PAD.top - PAD.bottom;
  const x = (t: number) => PAD.left + (t1 > t0 ? ((t - t0) / (t1 - t0)) * plotW : plotW / 2);
  const y = (v: number) => PAD.top + (1 - (v - y0) / (y1 - y0 || 1)) * plotH;

  const xTickCount = Math.max(2, Math.floor(plotW / 110));
  const xTicks = t1 > t0 ? Array.from({ length: xTickCount + 1 }, (_, i) => t0 + ((t1 - t0) * i) / xTickCount) : [];

  const onMove = (e: React.PointerEvent<SVGRectElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const t = t0 + ((e.clientX - rect.left) / rect.width) * (t1 - t0);
    // 가장 가까운 실제 데이터 시각으로 스냅
    let best = t0;
    for (const s of visible) for (const p of s.pts) if (Math.abs(p.t - t) < Math.abs(best - t)) best = p.t;
    setHoverT(best);
  };

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
        {width > 0 && visible.length > 0 && (
          <svg width={width} height={H} role="img" aria-label="기간 시작 대비 등락률 비교 차트">
            {yTicks.map((v) => (
              <g key={v}>
                <line x1={PAD.left} x2={PAD.left + plotW} y1={y(v)} y2={y(v)} className={v === 0 ? "axis-zero" : "gridline"} />
                <text x={PAD.left + plotW + 6} y={y(v)} dy="0.32em" className="tick-label">
                  {fmtPct(v).replace(".00", "")}
                </text>
              </g>
            ))}
            {xTicks.map((t, i) => (
              <text
                key={i}
                x={x(t)}
                y={H - 6}
                className="tick-label"
                textAnchor={i === 0 ? "start" : i === xTicks.length - 1 ? "end" : "middle"}
              >
                {fmtAxisTime(t, range)}
              </text>
            ))}

            {visible.map((s) => (
              <path
                key={s.q.symbol}
                d={s.pts.map((p, i) => `${i ? "L" : "M"}${x(p.t).toFixed(1)},${y(p.v).toFixed(1)}`).join("")}
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
              onPointerMove={onMove}
              onPointerLeave={() => setHoverT(null)}
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
