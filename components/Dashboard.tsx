"use client";

import { useCallback, useEffect, useState } from "react";
import type { QuotesResponse } from "@/lib/quotes";
import { CATEGORIES, type Category } from "@/lib/symbols";
import QuoteCard from "./QuoteCard";

const REFRESH_MS = 30_000;
const TICKER = ["KRW=X", "^KS11", "^GSPC", "^IXIC", "GC=F", "CL=F", "^TNX", "BTC-USD"];

export default function Dashboard() {
  const [data, setData] = useState<QuotesResponse | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<Category | "all">("all");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/quotes");
      if (!res.ok) throw new Error(String(res.status));
      setData(await res.json());
      setError(false);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(() => {
      if (document.visibilityState === "visible") load();
    }, REFRESH_MS);
    const onVisible = () => document.visibilityState === "visible" && load();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [load]);

  const quotes = data?.quotes ?? [];
  const tickerItems = TICKER.map((s) => quotes.find((q) => q.symbol === s)).filter(Boolean);
  const sections = CATEGORIES.filter((c) => filter === "all" || c.key === filter);

  return (
    <>
      <header className="topbar">
        <div className="brand">
          <span className="logo">e</span>
          <span>
            <strong>eSignal</strong>
            <small>실시간 시장 지표</small>
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

      <nav className="filters">
        <button className={filter === "all" ? "active" : ""} onClick={() => setFilter("all")}>
          전체
        </button>
        {CATEGORIES.map((c) => (
          <button key={c.key} className={filter === c.key ? "active" : ""} onClick={() => setFilter(c.key)}>
            {c.title}
          </button>
        ))}
      </nav>

      <main>
        {sections.map((c) => (
          <section key={c.key}>
            <h2>{c.title}</h2>
            <div className="grid">
              {data
                ? quotes.filter((q) => q.category === c.key).map((q) => <QuoteCard key={q.symbol} q={q} />)
                : Array.from({ length: 4 }, (_, i) => <div key={i} className="card skeleton" />)}
            </div>
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
