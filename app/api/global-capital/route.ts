import { NextResponse } from "next/server";

export const revalidate = 86400;
const FALLBACK = {value:169.1044265,period:"2026-10",publishedAt:"2026-10-01",sourceUrl:"https://focus.world-exchanges.org/issue/november-2026/dashboard",source:"World Federation of Exchanges",note:"2026년 11월 대시보드(2026년 10월 발행)에서 확인한 기준값"};
const months=["january","february","march","april","may","june","july","august","september","october","november","december"];
function recent(date:string) {
 const d=new Date(date+"T00:00:00Z"),cutoff=new Date();cutoff.setUTCMonth(cutoff.getUTCMonth()-6);
 return Number.isFinite(d.getTime())&&d<=new Date()&&d>=cutoff;
}
function strip(html:string) {
 return html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi," ").replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi," ").replace(/<[^>]*>/g," ").replace(/&nbsp;|&#160;/gi," ").replace(/\s+/g," ");
}
async function latestWfe() {
 const now=new Date();
 for(let offset=0;offset<3;offset++){
  const d=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth()-offset,1));
  const url=`https://focus.world-exchanges.org/issue/${months[d.getUTCMonth()]}-${d.getUTCFullYear()}/dashboard`;
  try {
   const response=await fetch(url,{next:{revalidate:86400},signal:AbortSignal.timeout(8000)});
   if(!response.ok)continue;
   const raw=await response.text(),text=strip(raw);
   if(!/Market Capitalisation/i.test(text)||!/USD millions/i.test(text))continue;
   const match=text.match(/Market Capitalisation\s+([\d,]+(?:\.\d+)?)\s*\(USD millions\)/i);
   if(!match)continue;
   const value=Number(match[1].replace(/,/g,""))/1e6;
   if(value<50||value>400)continue;
   const publication=text.match(/Published:\s*([A-Za-z]+)\s+(20\d{2})/i);
   if(!publication)continue;
   const publishedMonth=months.indexOf(publication[1].toLowerCase());
   if(publishedMonth<0)continue;
   const publishedAt=`${publication[2]}-${String(publishedMonth+1).padStart(2,"0")}-01`;
   if(!recent(publishedAt))continue;
   return {value,period:`${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,"0")}`,publishedAt,sourceUrl:url,source:"World Federation of Exchanges",note:"발표 월의 1일을 보수적 기준일로 적용. 대시보드 호수와 발표월을 구분함"};
  }catch{continue}
 }
 return null;
}
export async function GET(){
 const fresh=await latestWfe();
 const result=fresh??(recent(FALLBACK.publishedAt)?FALLBACK:null);
 return NextResponse.json({asOf:new Date().toISOString(),assets:[
  {key:"equity",label:"상장주식",...(result??{value:null,period:null,publishedAt:null,sourceUrl:null,source:null,note:"최근 6개월 내 검증 가능한 WFE 자료 없음"})},
  ...["부동산","채권","금","가상자산"].map((label,i)=>({key:["property","bonds","gold","crypto"][i],label,value:null,period:null,publishedAt:null,sourceUrl:null,source:null,note:"최근 6개월 내 동일 범위의 글로벌 총액 자료 미연결"}))
 ],freshnessRule:"source publication within 6 calendar months; fetch time does not count"}, {headers:{"Cache-Control":"public, s-maxage=86400, stale-while-revalidate=3600"}});
}
