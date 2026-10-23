"use client";

import { useEffect, useRef, useState } from "react";
import type { Quote } from "@/lib/quotes";
import Sparkline from "./Sparkline";

function fmt(v: number | null, digits: number) {
  if (v == null) return "—";
  return v.toLocaleString("ko-KR", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

function fmtTime(sec: number | null) {
  if (!sec) return "";
  return new Date(sec * 1000).toLocaleString("ko-KR", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export default function QuoteCard({ q }: { q: Quote }) {
  const prev = useRef(q.price);
  const [flash, setFlash] = useState<"" | "flash-up" | "flash-down">("");

  useEffect(() => {
    if (prev.current != null && q.price != null && q.price !== prev.current) {
      setFlash(q.price > prev.current ? "flash-up" : "flash-down");
      const t = setTimeout(() => setFlash(""), 1200);
      prev.current = q.price;
      return () => clearTimeout(t);
    }
    prev.current = q.price;
  }, [q.price]);

  const dir = q.change == null || q.change === 0 ? "flat" : q.change > 0 ? "up" : "down";
  const arrow = dir === "up" ? "▲" : dir === "down" ? "▼" : "";

  return (
    <article className={`card ${flash}`}>
      <header className="card-head">
        <div>
          <h3>{q.name}</h3>
          <p className="sub">{q.sub}</p>
        </div>
        <time className="time">{fmtTime(q.marketTime)}</time>
      </header>

      <div className="price">{fmt(q.price, q.digits)}</div>

      <div className={`change ${dir}`}>
        {q.error ? (
          <span className="err">데이터 없음</span>
        ) : (
          <>
            {arrow} {fmt(q.change == null ? null : Math.abs(q.change), q.digits)}
            <span className="pct">
              {q.changePct == null ? "" : `${q.changePct > 0 ? "+" : ""}${q.changePct.toFixed(2)}%`}
            </span>
          </>
        )}
      </div>

      {/* 장외 거래 중이면 정규장 종가와 별도로 시간외 가격 표시 (미국 개별 주식) */}
      {q.extPrice != null && q.price != null && (
        <div className={`ext-price ${q.extPrice > q.price ? "up" : q.extPrice < q.price ? "down" : "flat"}`}>
          <span>시간외</span> {fmt(q.extPrice, q.digits)}{" "}
          {`${q.extPrice >= q.price ? "+" : ""}${((q.extPrice / q.price - 1) * 100).toFixed(2)}%`}
        </div>
      )}

      <Sparkline data={q.spark} baseline={q.prevClose} up={dir !== "down"} />

      <footer className="range">
        <span>저 {fmt(q.low, q.digits)}</span>
        <span>고 {fmt(q.high, q.digits)}</span>
      </footer>
    </article>
  );
}
