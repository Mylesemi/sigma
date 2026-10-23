"use client";

import { useEffect, useRef, useState } from "react";
import type { CustomStock } from "@/lib/customStocks";
import type { SearchResult } from "@/lib/search";
import { MAX_CUSTOM, isBuiltin } from "@/lib/symbols";

interface Props {
  stocks: CustomStock[];
  onAdd: (stock: CustomStock) => void;
  onRemove: (symbol: string) => void;
}

// 개별 종목 검색·추가 (한글명·영문명·종목코드)
export default function StockSearch({ stocks, onAdd, onRemove }: Props) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<SearchResult[] | null>(null); // null = 검색 전
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const full = stocks.length >= MAX_CUSTOM;

  // 입력이 멈추고 0.3초 뒤 검색, 이전 요청은 취소
  useEffect(() => {
    const query = q.trim();
    if (!query) {
      setResults(null);
      setStatus("idle");
      return;
    }
    const ctrl = new AbortController();
    const id = setTimeout(async () => {
      setStatus("loading");
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`, { signal: ctrl.signal });
        if (!res.ok) throw new Error(String(res.status));
        setResults((await res.json()).results);
        setStatus("idle");
      } catch {
        if (!ctrl.signal.aborted) setStatus("error");
      }
    }, 300);
    return () => {
      clearTimeout(id);
      ctrl.abort();
    };
  }, [q]);

  // 바깥을 누르면 결과 목록 닫기
  useEffect(() => {
    const onDown = (e: PointerEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, []);

  const added = (symbol: string) => isBuiltin(symbol) || stocks.some((s) => s.symbol === symbol);
  const pick = (r: SearchResult) => {
    if (added(r.symbol) || full) return;
    onAdd({ symbol: r.symbol, name: r.name });
    setQ("");
    setOpen(false);
  };

  return (
    <div className="stock-search" ref={box}>
      {stocks.map((s) => (
        <span key={s.symbol} className="pick">
          {s.name}
          <button aria-label={`${s.name} 삭제`} onClick={() => onRemove(s.symbol)}>
            ×
          </button>
        </span>
      ))}
      <div className="search-box">
        <input
          type="search"
          value={q}
          disabled={full}
          placeholder={full ? `최대 ${MAX_CUSTOM}개까지 추가할 수 있습니다` : "+ 종목 추가 (예: 엔비디아, 000660, toyota)"}
          aria-label="추가할 종목 검색"
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "Escape") setOpen(false);
            if (e.key === "Enter") {
              const first = results?.find((r) => !added(r.symbol));
              if (first) pick(first);
            }
          }}
        />
        {open && q.trim() && (
          <ul className="search-results" role="listbox" aria-label="검색 결과">
            {status === "loading" && <li className="hint">검색 중…</li>}
            {status === "error" && <li className="hint">검색에 실패했습니다. 잠시 후 다시 시도해 주세요.</li>}
            {status === "idle" && results?.length === 0 && <li className="hint">검색 결과가 없습니다.</li>}
            {status === "idle" &&
              results?.map((r) => (
                <li key={r.symbol} role="option" aria-selected={false} aria-disabled={added(r.symbol)}>
                  <button disabled={added(r.symbol)} onClick={() => pick(r)}>
                    <b>{r.name}</b>
                    <span>
                      {r.symbol} · {r.exchange}
                    </span>
                    {added(r.symbol) && <em>추가됨</em>}
                  </button>
                </li>
              ))}
          </ul>
        )}
      </div>
    </div>
  );
}
