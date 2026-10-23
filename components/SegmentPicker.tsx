"use client";

import { useEffect, useRef } from "react";
import type { RangeDef, Segment } from "@/lib/ranges";

const UNIT_LABEL = { day: "일별", week: "주별", year: "연도별" } as const;
const MAX_CHIPS = 12; // 이보다 많으면(1년·3년의 주 단위) 목록으로 선택

interface Props {
  unit: NonNullable<RangeDef["segment"]>;
  segments: Segment[];
  value: Segment | null;
  onChange: (seg: Segment | null) => void;
}

export default function SegmentPicker({ unit, segments, value, onChange }: Props) {
  const idx = value ? segments.findIndex((s) => s.from === value.from) : -1;
  const chips = useRef<HTMLDivElement>(null);

  // 좁은 화면에서도 선택한 칩이 보이도록 가로 스크롤 (선택 전에는 최근 구간 쪽 끝으로)
  useEffect(() => {
    const el = chips.current;
    if (!el) return;
    const active = el.querySelector<HTMLElement>("button.active");
    if (active) el.scrollTo({ left: active.offsetLeft - (el.clientWidth - active.offsetWidth) / 2, behavior: "smooth" });
    else el.scrollLeft = el.scrollWidth;
  }, [idx, segments.length]);
  const step = (d: number) => {
    // 전체 보기에서 ◀를 누르면 가장 최근 구간부터
    const next = idx < 0 ? (d < 0 ? segments.length - 1 : 0) : idx + d;
    if (next >= 0 && next < segments.length) onChange(segments[next]);
  };

  const groups = new Map<string, Segment[]>();
  for (const s of segments) groups.set(s.group ?? "", [...(groups.get(s.group ?? "") ?? []), s]);

  return (
    <div className="segments" role="group" aria-label={`${UNIT_LABEL[unit]} 구간 선택`}>
      <span className="segments-label">{UNIT_LABEL[unit]}</span>
      <button className={idx < 0 ? "active" : ""} aria-pressed={idx < 0} onClick={() => onChange(null)}>
        전체
      </button>
      <button className="step" aria-label="이전 구간" disabled={idx === 0} onClick={() => step(-1)}>
        ‹
      </button>
      {segments.length <= MAX_CHIPS ? (
        <div ref={chips} className="segment-chips">
          {segments.map((s) => (
            <button key={s.from} className={s.from === value?.from ? "active" : ""} aria-pressed={s.from === value?.from} onClick={() => onChange(s)}>
              {s.label}
            </button>
          ))}
        </div>
      ) : (
        <select
          aria-label="구간"
          value={idx < 0 ? "" : String(segments[idx].from)}
          onChange={(e) => onChange(segments.find((s) => String(s.from) === e.target.value) ?? null)}
        >
          <option value="">구간 선택…</option>
          {[...groups.entries()].reverse().map(([g, list]) => (
            <optgroup key={g} label={g}>
              {[...list].reverse().map((s) => (
                <option key={s.from} value={s.from}>
                  {s.label}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      )}
      <button className="step" aria-label="다음 구간" disabled={idx < 0 || idx === segments.length - 1} onClick={() => step(1)}>
        ›
      </button>
    </div>
  );
}
