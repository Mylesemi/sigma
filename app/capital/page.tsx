"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type CapitalData = {
  updatedAt: string;
  series: { stockMarketCap: Record<string, number>; gdp: Record<string, number> };
  countries: Record<string, { name: string; series: Record<string, number> }>;
  warnings?: string[];
};
const MONTHS = 6;
const SOURCE = "https://data.worldbank.org/indicator/CM.MKT.LCAP.CD";
function isFresh(iso: string | undefined) {
  if (!iso) return false;
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime()) || date.getTime() > Date.now()) return false;
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - MONTHS);
  return date >= cutoff;
}
export default function CapitalPage() {
  const [data, setData] = useState<CapitalData | null>(null);
  const [error, setError] = useState(false);
  const [live, setLive] = useState<{asOf:string;assets:{key:string;label:string;value:number|null;period:string|null;publishedAt:string|null;sourceUrl:string|null;source:string|null;note:string}[]}|null>(null);
  useEffect(() => {
    let alive = true;
    fetch("/data/global-capital.json", { cache: "no-store" })
      .then(r => { if (!r.ok) throw new Error("missing"); return r.json(); })
      .then(d => { if (alive) setData(d); })
      .catch(() => { if (alive) setError(true); });
    fetch("/api/global-capital", { cache: "no-store" }).then(r=>{if(!r.ok)throw new Error("API unavailable");return r.json()}).then(d=>{if(alive)setLive(d)}).catch(()=>{if(alive)setError(true)});
    return () => { alive = false; };
  }, []);
  // World Bank's annual observation year and the time we fetched it are NOT the
  // original statistical publication date. Never pass the freshness gate using updatedAt.
  const latest = data ? Object.keys(data.series?.stockMarketCap ?? {}).sort().at(-1) : undefined;
  const latestYear = latest ? Number(latest) : undefined;
  const cutoff = new Date(); cutoff.setMonth(cutoff.getMonth() - MONTHS);
  return <div className="capital-page">
    <header className="capital-head"><Link href="/" className="capital-back">← SIGMA</Link><span>GLOBAL ASSETS</span></header>
    <main className="capital-main">
      <div className="capital-intro"><p>GLOBAL WEALTH & CAPITAL</p><h1>세계 자산시장</h1><p>최근 6개월 이내에 발표된 통계만 현재 시장 규모에 반영합니다. 출처의 실제 발표일이 확인되지 않으면 표시하지 않습니다.</p></div>
      <div className="capital-panel">
        <h2>최신 자산 규모</h2>
        <div className="capital-kpis">
          {(live?.assets ?? ["상장주식","부동산","채권","금","가상자산"].map((label,i)=>({key:String(i),label,value:null,period:null,publishedAt:null,sourceUrl:null,source:null,note:"자료 확인 중"}))).map(asset => <div className="capital-card" key={asset.key}><small>{asset.label}</small><strong style={{fontSize:22}}>{asset.value===null?"최신 자료 없음":`${asset.value.toFixed(2)}T`}</strong><span style={{color:"var(--muted)",fontSize:12}}>{asset.value===null?asset.note:`발표 기준 ${asset.publishedAt} · ${asset.period}`}</span>{asset.sourceUrl&&<a href={asset.sourceUrl} target="_blank" rel="noopener noreferrer" style={{fontSize:12,color:"var(--accent)"}}>{asset.source} ↗</a>}</div>)}
        </div>
        <p className="capital-warning">WFE 최근 발표값은 자동 조회하며, 원천 페이지에서 수집하지 못한 경우 확인된 2026년 10월 기준값을 유효기간 내에서만 사용합니다. 값이 없다는 것은 시장 규모가 0이라는 뜻이 아닙니다.</p>
      </div>
      <div className="capital-panel">
        <h2>데이터 갱신 현황</h2>
        {data ? <><p>World Bank 수집 파일 마지막 생성: {new Date(data.updatedAt).toLocaleString("ko-KR")}</p><p>주식 시가총액 최신 관측연도: {latestYear ?? "확인 불가"}년</p><p className="capital-warning">파일 수집일은 통계 발표일이 아닙니다. 연간 관측치의 발표일을 검증하지 못해 현재 규모·점유율에서는 제외했습니다.</p></> : <p>{error ? "자동 수집 파일이 아직 없거나 접근할 수 없습니다." : "수집 상태 확인 중…"}</p>}
        <p>자동 수집은 유지하지만 발표일이 확인되지 않은 수치는 현재값으로 승격하지 않습니다.</p>
        <a href={SOURCE} target="_blank" rel="noopener noreferrer" style={{color:"var(--accent)"}}>World Bank 원천 자료 ↗</a>
      </div>
      <div className="capital-panel"><h2>표시 기준</h2><p>현재 시점 기준 최근 6개월 내 공표된 수치만 허용합니다. 국가별 비교도 동일한 기준일과 시장 범위가 확인된 자료만 표시합니다. 과거 시계열은 최신 시장 판단과 분리하며, 자료가 확보되면 별도로 제공합니다.</p><p>최신 자료 확보가 가능한 주식·채권의 분기 통계와 부동산의 최신 평가 보고서를 순차 연결할 예정입니다.</p></div>
    </main>
  </div>;
}
