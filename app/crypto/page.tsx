"use client";
import { useEffect, useMemo, useState } from "react";
import type { Quote, QuotesResponse } from "@/lib/quotes";
type Span = "1m" | "3m" | "1y" | "3y" | "10y";
const ASSETS = [
  { symbol: "BTC-USD", label: "비트코인", color: "#f59e0b" },
  { symbol: "ETH-USD", label: "이더리움", color: "#8b5cf6" },
  { symbol: "GC=F", label: "금 선물", color: "#d6a544" },
  { symbol: "^GSPC", label: "S&P 500", color: "#16a085" },
  { symbol: "IEF", label: "미국 국채 ETF (7~10년)", color: "#2563eb" },
  { symbol: "^TNX", label: "미국 10년 국채금리", color: "#e05252" },
] as const;
const MS_DAY = 86400000;
const periods: {key: Span; label: string; days: number; api: string}[] = [
  {key:"1m",label:"1개월",days:30,api:"1y"},
  {key:"3m",label:"3개월",days:90,api:"1y"},
  {key:"1y",label:"1년",days:365,api:"1y"},
  {key:"3y",label:"3년",days:1095,api:"3y"},
  {key:"10y",label:"10년",days:3650,api:"10y"},
];
const fmt = (v:number) => (v >= 0 ? "+" : "") + v.toFixed(2) + "%";
function series(q: Quote | undefined, from: number) {
  if (!q) return [] as {t:number;p:number}[];
  return q.times.map((t,i)=>({t,p:q.spark[i]})).filter(x=>x.t>=from && Number.isFinite(x.p) && x.p>0);
}
function plotPath(points:{x:number;y:number}[]) {
  return points.map((p,i)=>(i?"L":"M")+p.x.toFixed(1)+","+p.y.toFixed(1)).join(" ");
}
export default function CryptoPage() {
  const [span,setSpan]=useState<Span>("1y");
  const [selected,setSelected]=useState<string[]>(["BTC-USD","ETH-USD","GC=F","^GSPC","IEF"]);
  const [data,setData]=useState<QuotesResponse|null>(null);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [mode,setMode]=useState<"return"|"z">("return");
  const period=periods.find(p=>p.key===span)!;
  useEffect(()=>{
    let alive=true;
    setBusy(true);setError("");
    fetch("/api/quotes?range="+period.api,{cache:"no-store"})
      .then(r=>{if(!r.ok)throw Error("HTTP "+r.status);return r.json() as Promise<QuotesResponse>})
      .then(r=>{if(alive)setData(r)})
      .catch(e=>{if(alive)setError(String(e))})
      .finally(()=>{if(alive)setBusy(false)});
    return ()=>{alive=false};
  },[period.api]);
  const values=useMemo(()=>{
    const quotes=new Map((data?.quotes??[]).map(q=>[q.symbol,q]));
    const cutoff=Date.now()/1000-period.days*86400;
    return ASSETS.map(a=>{
      const q=quotes.get(a.symbol);
      const pts=series(q,cutoff);
      const base=pts[0]?.p;
      const returns=pts.map(v=>({t:v.t,v:base ? (v.p/base-1)*100:0}));
      // Z-score of log price relative to its own selected-window distribution.
      const logs=pts.map(v=>Math.log(v.p));
      const mean=logs.reduce((s,v)=>s+v,0)/(logs.length||1);
      const std=Math.sqrt(logs.reduce((s,v)=>s+(v-mean)**2,0)/(logs.length||1));
      const zs=pts.map((v,i)=>({t:v.t,v:std>0?(logs[i]-mean)/std:0}));
      return {...a,quote:q,points:mode==="return"?returns:zs,latest:returns.at(-1)?.v,price:pts.at(-1)?.p};
    }).filter(a=>selected.includes(a.symbol) && a.points.length>=2);
  },[data,period.days,selected,mode]);
  const all=values.flatMap(a=>a.points);
  const lo=Math.min(0,...all.map(p=>p.v)),hi=Math.max(0,...all.map(p=>p.v));
  const minT=Math.min(...all.map(p=>p.t)),maxT=Math.max(...all.map(p=>p.t));
  const width=900,height=340,left=56,right=20,top=16,bottom=36;
  const x=(t:number)=>left+(t-minT)/Math.max(1,maxT-minT)*(width-left-right);
  const y=(v:number)=>top+(hi-v)/Math.max(1,hi-lo)*(height-top-bottom);
  return <div className="crypto-page">
    <header className="crypto-head"><a href="/" className="crypto-brand">Σ SIGMA</a><nav><a href="/">시장 대시보드</a><a href="/capital">글로벌 자산</a><b>가상화폐</b></nav></header>
    <main className="crypto-main">
      <div className="crypto-intro"><small>CRYPTO / CROSS-ASSET</small><h1>가상화폐 · 글로벌 자산 비교</h1><p>비트코인과 이더리움을 금, S&P 500, 미국 국채와 동일한 기간 기준으로 비교합니다.</p></div>
      <div className="crypto-controls"><div className="crypto-pills">{periods.map(p=><button key={p.key} className={span===p.key?"active":""} onClick={()=>setSpan(p.key)}>{p.label}</button>)}</div><div className="crypto-pills"><button className={mode==="return"?"active":""} onClick={()=>setMode("return")}>누적 수익률</button><button className={mode==="z"?"active":""} onClick={()=>setMode("z")}>가격 Z-Score</button></div></div>
      <div className="crypto-select">{ASSETS.map(a=><label key={a.symbol}><input type="checkbox" checked={selected.includes(a.symbol)} onChange={e=>setSelected(s=>e.target.checked?[...s,a.symbol]:s.filter(v=>v!==a.symbol))}/><i style={{background:a.color}}/>{a.label}</label>)}</div>
      <section className="crypto-panel"><h2>{mode==="return"?"기간 시작 대비 누적 수익률":"로그 가격의 기간 내 Z-Score"}</h2><p>{mode==="return"?"각 자산의 첫 관측치를 0%로 정규화합니다. 서로 다른 거래일은 연결선으로 표시하며 보간하지 않습니다.":"선택 기간의 로그 가격 평균과 표준편차로 계산한 가격 Z-Score입니다. 온체인 MVRV Z-Score와 다릅니다."}</p>
        {busy&&<p role="status">데이터 불러오는 중…</p>}{error&&<p role="alert">데이터 조회 실패: {error}</p>}
        {!busy&&!error&&values.length===0&&<p>선택한 기간에 유효한 데이터가 없습니다.</p>}
        {values.length>0&&<div className="crypto-chart"><svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="선택 자산의 기간별 비교 선 그래프">
          {Array.from({length:5},(_,i)=>lo+(hi-lo)*i/4).map((v,i)=><g key={i}><line x1={left} x2={width-right} y1={y(v)} y2={y(v)} stroke="var(--border)"/><text x={left-8} y={y(v)+4} textAnchor="end" fill="var(--muted)" fontSize="12">{v.toFixed(mode==="return"?0:1)}{mode==="return"?"%":""}</text></g>)}
          {values.map(a=><path key={a.symbol} d={plotPath(a.points.map(p=>({x:x(p.t),y:y(p.v)})))} fill="none" stroke={a.color} strokeWidth="2.5" strokeLinejoin="round"/>)}
          <text x={left} y={height-8} fontSize="12" fill="var(--muted)">{new Date(minT*1000).toLocaleDateString("ko-KR")}</text><text x={width-right} y={height-8} textAnchor="end" fontSize="12" fill="var(--muted)">{new Date(maxT*1000).toLocaleDateString("ko-KR")}</text>
        </svg></div>}
        <div className="crypto-legend">{values.map(a=><div key={a.symbol}><i style={{background:a.color}}/><span>{a.label}</span><strong>{mode==="return"&&a.latest!=null?fmt(a.latest):a.points.at(-1)?.v.toFixed(2)}</strong></div>)}</div>
      </section>
      <section className="crypto-panel"><h2>비트코인 MVRV Z-Score</h2><p>MVRV Z-Score는 시가총액과 실현시가총액의 차이를 시가총액의 표준편차로 나눈 온체인 지표입니다. 가격만으로 계산할 수 없으므로 검증되지 않은 수치를 표시하지 않습니다.</p><a href="https://studio.glassnode.com/charts/market/mvrv-z-score" target="_blank" rel="noopener noreferrer">Glassnode에서 MVRV Z-Score 확인 ↗</a><p>참고: 이 페이지의 가격 Z-Score는 별도의 통계 지표이며 MVRV를 대체하지 않습니다.</p></section>
      <p className="crypto-disclaimer">출처: Yahoo Finance · 미국 국채 ETF(IEF)는 채권 가격의 대용 지표이며, ^TNX는 10년물 수익률(%)입니다. 금은 현물 대신 금 선물(GC=F)을 사용합니다. 24시간 거래하는 코인과 휴장하는 전통자산의 관측 시각이 다릅니다. 투자 조언이 아닙니다.</p>
    </main>
  </div>;
}
