"use client";

import { CATEGORIES, SYMBOLS } from "@/lib/symbols";
import { MAX_PICKS } from "@/lib/urlState";

interface Props {
  picks: string[];
  slots: number[]; // picks와 같은 순서의 색상 슬롯
  onAdd: (symbol: string) => void;
  onRemove: (symbol: string) => void;
}

// 카테고리와 상관없이 비교할 자산을 고르는 목록
export default function PickList({ picks, slots, onAdd, onRemove }: Props) {
  const full = picks.length >= MAX_PICKS;
  return (
    <div className="picks">
      {picks.map((sym, i) => {
        const def = SYMBOLS.find((d) => d.symbol === sym);
        return (
          <span key={sym} className="pick">
            <span className="key" style={{ background: `var(--s${slots[i] + 1})` }} />
            {def?.name ?? sym}
            <button aria-label={`${def?.name ?? sym} 빼기`} onClick={() => onRemove(sym)}>
              ×
            </button>
          </span>
        );
      })}
      <select
        aria-label="비교할 자산 추가"
        value=""
        disabled={full}
        onChange={(e) => e.target.value && onAdd(e.target.value)}
      >
        <option value="">{full ? `최대 ${MAX_PICKS}개` : "+ 자산 추가"}</option>
        {CATEGORIES.map((c) => (
          <optgroup key={c.key} label={c.title}>
            {SYMBOLS.filter((d) => d.category === c.key && !picks.includes(d.symbol)).map((d) => (
              <option key={d.symbol} value={d.symbol}>
                {d.name}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
    </div>
  );
}
