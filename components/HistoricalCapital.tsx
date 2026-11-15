"use client";
import { useState } from "react";

type Datum={year:number;value:number};
const SERIES:{key:string;label:string;color:string;source:string;points:Datum[]}[]=[
{key:"property",label:"부동산",color:"#8b5cf6",source:"Savills",points:[{year:2019,value:393.3/1.213},{year:2021,value:390.5},{year:2022,value:379.7},{year:2023,value:393.3/.995},{year:2024,value:393.3}]},
{key:"stocks",label:"상장주식",color:"#2a78d6",source:"SIFMA/WFE",points:[{year:2014,value:69.6},{year:2022,value:98.9},{year:2024,value:126.7},{year:2025,value:157.8}]},
{key:"bonds",label:"채권",color:"#16a085",source:"SIFMA/BIS",points:[{year:2014,value:83.4},{year:2022,value:129.8},{year:2024,value:145.1},{year:2025,value:160.7}]}
];
const SHARE=[
{key:"stocks",label:"상장주식",year:2024,items:[["미국",49.1],["중국",9.3],["EU",8.7],["일본",5],["인도",4.1],["기타",23.8]] as [string,number][]},
{key:"bonds",label:"채권",year:2024,items:[["미국",40.1],["EU",18],["중국",17.3],["일본",7.3],["기타",17.3]] as [string,number][]},
{key:"property",label:"부동산",year:2024,items:[["중국",23.5],["미국",20.7],["기타",55.8]] as [string,number][]}
];
const citations=[
{label:"SIFMA 2026 Fact Book",url:"https://www.sifma.org/research/reports/fact-book"},
{label:"SIFMA 2025 Fact Book",url:"https://www.sifma.org/wp-content/uploads/2024/07/2025-SIFMA-Capital-Markets-Factbook.pdf"},
{label:"Savills 2024 valuation",url:"https://www.savills.com/insight-and-opinion/savills-news/381209/world-s-real-estate-worth-%24393.3-trillion-and-is-the-world-s-largest-store-of-wealth"},
{label:"Savills 2022 valuation",url:"https://www.savills.com/insight-and-opinion/savills-news/352068/total-global-value-of-real-estate-estimated-at-%24379.7-trillion---almost-four-times-the-value-of-global-gdp"}
];
export default function HistoricalCapital(){
 const [active,setActive]=useState<string[]>(SERIES.map(s=>s.key));
 const [market,setMarket]=useState("stocks");
 const [hover,setHover]=useState<{year:number;value:number;label:string}|null>(null);
 const filtered=SERIES.filter(s=>active.includes(s.key));
 const plot={left:55,right:770,top:20,bottom:255};
 const x=(year:number)=>plot.left+(year-2014)/11*(plot.right-plot.left);
 const y=(value:number)=>plot.bottom-value/450*(plot.bottom-plot.top);
 const current=SHARE.find(s=>s.key===market)!;
 const palette=["#2a78d6","#8b5cf6","#16a085","#eda100","#e87ba4","#9ca3af"];
 return <div className="capital-history">
  <div className="capital-panel"><h2>글로벌 자산 규모 변화</h2><p>공식 발표된 연말 값만 표시합니다. 점 사이의 선은 시각적 연결이며 중간 연도의 관측값이 아닙니다.</p>
   <div className="capital-checks">{SERIES.map(s=><label key={s.key}><input type="checkbox" checked={active.includes(s.key)} onChange={()=>setActive(p=>p.includes(s.key)?p.filter(k=>k!==s.key):[...p,s.key])}/><span style={{background:s.color}}/>{s.label}</label>)}</div>
   <div style={{overflowX:"auto"}}><svg viewBox="0 0 800 290" role="img" aria-label="2014년부터 2025년까지 부동산 주식 채권의 발표된 시장 규모" style={{width:"100%",minWidth:490}}>
    {[0,100,200,300,400].map(v=><g key={v}><line x1={plot.left} y1={y(v)} x2={plot.right} y2={y(v)} stroke="currentColor" opacity=".12"/><text x="46" y={y(v)+4} textAnchor="end" fontSize="12" fill="currentColor">{v}</text></g>)}
    {[2014,2016,2018,2020,2022,2024,2025].map(v=><text key={v} x={x(v)} y="278" textAnchor="middle" fontSize="12" fill="currentColor">{v}</text>)}
    {filtered.map(s=><g key={s.key}><polyline points={s.points.map(p=>x(p.year)+","+y(p.value)).join(" ")} fill="none" stroke={s.color} strokeWidth="2.5" strokeDasharray="6 4"/>{s.points.map(p=><circle key={p.year} cx={x(p.year)} cy={y(p.value)} r="5" fill={s.color} stroke="var(--surface)" strokeWidth="2" onMouseEnter={()=>setHover({year:p.year,value:p.value,label:s.label})} onMouseLeave={()=>setHover(null)}><title>{s.label} {p.year}: ${p.value.toFixed(1)}T</title></circle>)}</g>)}
   </svg></div>
   <p>{hover?`${hover.label} · ${hover.year}년: $${hover.value.toFixed(1)}T`:"단위: USD 조 달러 · 점을 가리키면 수치 표시"}</p>
   <p className="capital-warning">2019년 부동산은 Savills의 2019~2024 증가율(21.3%)을 역산한 값, 2023년은 2024년 감소율(0.5%)을 역산한 값입니다. 두 값은 추정치이며 나머지 점은 공표 수치입니다. 서로 다른 기관의 통계 범위가 완전히 같지 않을 수 있습니다.</p>
  </div>
  <div className="capital-panel"><h2>주요 시장별 점유율</h2><p>시장별 비교 기준은 2024년 말입니다. 국가와 지역(EU)은 중복되지 않도록 출처의 구분을 따릅니다.</p>
   <div className="capital-tabs" style={{width:"fit-content",margin:"16px 0"}}>{SHARE.map(s=><button key={s.key} className={market===s.key?"on":""} onClick={()=>setMarket(s.key)}>{s.label}</button>)}</div>
   <div className="capital-stackbar" role="img" aria-label={current.items.map(([n,v])=>n+" "+v+"%").join(", ")}>{current.items.map(([n,v],i)=><div key={n} title={n+" "+v+"%"} style={{width:v+"%",background:palette[i]}}/>)}</div>
   <div className="capital-bars">{current.items.map(([n,v],i)=><div className="capital-bar-row" key={n}><div className="capital-bar-label"><b>{n}</b><span>{v.toFixed(1)}%</span></div><div className="capital-track"><div style={{width:v+"%",background:palette[i]}}/></div></div>)}</div>
   <p className="capital-warning">주식·채권: SIFMA 2025 Fact Book. 부동산: Savills 2024 평가. 기타는 나머지 국가·지역을 합한 값이며, 상세 국가별 시계열 데이터는 아직 미연결입니다.</p>
  </div>
  <div className="capital-panel"><h2>데이터 출처 및 갱신</h2><p>아래 통계는 공표 자료의 고정 스냅샷입니다. 현재 실시간 자동 갱신이나 전 국가 시계열 수집은 구현되지 않았습니다.</p><div className="capital-legend">{citations.map(c=><a key={c.url} href={c.url} target="_blank" rel="noopener noreferrer" style={{color:"var(--accent)",fontSize:12}}>{c.label} ↗</a>)}</div></div>
 </div>;
}
