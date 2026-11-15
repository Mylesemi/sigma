"use client";

import { useState } from "react";
import Link from "next/link";
import HistoricalCapital from "@/components/HistoricalCapital";

type Asset = { key: string; name: string; value: number; year: number; source: string; url: string; color: string; note: string };
const ASSETS: Asset[] = [
  { key: "realestate", name: "부동산", value: 393.3, year: 2024, source: "Savills", url: "https://www.savills.com/insight-and-opinion/savills-news/381209/world-s-real-estate-worth-%24393.3-trillion-and-is-the-world-s-largest-store-of-wealth", color: "#8b5cf6", note: "주거·상업·농지 포함. 평가액 추정치" },
  { key: "equity", name: "상장주식", value: 157.8, year: 2025, source: "SIFMA", url: "https://www.sifma.org/research/reports/fact-book", color: "#2a78d6", note: "글로벌 상장주식 시가총액" },
  { key: "bond", name: "채권", value: 160.7, year: 2025, source: "SIFMA", url: "https://www.sifma.org/research/reports/fact-book", color: "#16a085", note: "글로벌 채권 발행잔액" },
];
const REAL_ESTATE = [
  { name: "주거용", value: 286.9, color: "#8b5cf6" },
  { name: "상업용", value: 58.5, color: "#c4b5fd" },
  { name: "농지", value: 47.9, color: "#ddd6fe" },
];
const money = (v: number) => "$" + v.toLocaleString("en-US", { maximumFractionDigits: 1 }) + "T";

export default function CapitalPage() {
  const [selected, setSelected] = useState<string[]>(ASSETS.map(a => a.key));
  const [detail, setDetail] = useState<"assets" | "realestate">("assets");
  const shown = ASSETS.filter(a => selected.includes(a.key));
  const total = shown.reduce((s, a) => s + a.value, 0);
  const max = Math.max(1, ...shown.map(a => a.value));
  return <div className="capital-page">
    <header className="capital-head"><Link href="/" className="capital-back">← SIGMA</Link><span>GLOBAL ASSETS</span></header>
    <main className="capital-main">
      <div className="capital-intro"><p>GLOBAL WEALTH & CAPITAL</p><h1>세계 자산시장의 크기</h1><p>부동산·주식·채권의 규모와 구성을 비교합니다. 자산별 발표 시점이 달라 동일 시점의 세계 순자산을 의미하지 않습니다.</p></div>
      <div className="capital-kpis">
        {ASSETS.map(a => <div className="capital-card" key={a.key}><small>{a.name} · {a.year}년 말</small><strong>{money(a.value)}</strong><a href={a.url} target="_blank" rel="noopener noreferrer">{a.source} ↗</a></div>)}
      </div>
      <div className="capital-panel">
        <div className="capital-row"><div><h2>자산군별 규모 비교</h2><p>단위: 조 달러(USD) · 서로 다른 기준연도</p></div><div className="capital-tabs"><button className={detail==="assets"?"on":""} onClick={()=>setDetail("assets")}>자산 비교</button><button className={detail==="realestate"?"on":""} onClick={()=>setDetail("realestate")}>부동산 구성</button></div></div>
        {detail==="assets" ? <>
          <div className="capital-checks">{ASSETS.map(a=><label key={a.key}><input type="checkbox" checked={selected.includes(a.key)} onChange={()=>setSelected(p=>p.includes(a.key)?p.filter(k=>k!==a.key):[...p,a.key])}/><span style={{background:a.color}}/>{a.name}</label>)}</div>
          <div className="capital-bars">{shown.length ? shown.map(a=><div className="capital-bar-row" key={a.key}><div className="capital-bar-label"><b>{a.name}</b><span>{money(a.value)}</span></div><div className="capital-track"><div style={{width:(a.value/max*100)+"%",background:a.color}}/></div><small>{a.year} · {a.note}</small></div>):<p>표시할 자산을 선택하세요.</p>}</div>
          {shown.length>0 && <div className="capital-stack"><h3>선택 자산별 상대 비중</h3><div className="capital-stackbar" role="img" aria-label={shown.map(a=>a.name+" "+(a.value/total*100).toFixed(1)+"%").join(", ")}>{shown.map(a=><div key={a.key} title={a.name+" "+(a.value/total*100).toFixed(1)+"%"} style={{width:(a.value/total*100)+"%",background:a.color}} />)}</div><div className="capital-legend">{shown.map(a=><span key={a.key}><i style={{background:a.color}}/>{a.name} {(a.value/total*100).toFixed(1)}%</span>)}</div><p className="capital-warning">단순 합산한 상대 비중입니다. 기업 보유 부동산과 주식 가치 등의 중복이 존재하며, 순자산이나 공식 글로벌 자산 점유율이 아닙니다.</p></div>}
        </>:<><div className="capital-bars">{REAL_ESTATE.map(a=><div className="capital-bar-row" key={a.name}><div className="capital-bar-label"><b>{a.name}</b><span>{money(a.value)} · {(a.value/393.3*100).toFixed(1)}%</span></div><div className="capital-track"><div style={{width:(a.value/393.3*100)+"%",background:a.color}}/></div></div>)}</div><p className="capital-warning">Savills 2024년 말 추정치. 부동산 유형별 구분이며 국가별 점유율과는 다릅니다.</p></>}
      </div>
      <HistoricalCapital />
      <div className="capital-panel"><h2>지표 해석 안내</h2><p>부동산은 추정 자산가치, 주식은 시가총액, 채권은 발행잔액입니다. 주식·채권·부동산의 합계는 부채와 중복 보유를 제거한 글로벌 순자산이 아닙니다. 금·가상자산·GDP는 이후 별도 비교 계열로 추가할 예정입니다.</p></div>
    </main>
  </div>;
}
