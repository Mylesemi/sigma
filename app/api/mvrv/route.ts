import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const revalidate = 21600;

type MetricRow = { time: string; CapMVRVCur?: string; CapMrktCurUSD?: string };
type Point = { t: number; mvrv: number; z: number };

export async function GET() {
  try {
    const url = new URL("https://community-api.coinmetrics.io/v4/timeseries/asset-metrics");
    url.searchParams.set("assets", "btc");
    url.searchParams.set("metrics", "CapMVRVCur,CapMrktCurUSD");
    url.searchParams.set("frequency", "1d");
    url.searchParams.set("start_time", "2010-01-01");
    url.searchParams.set("page_size", "10000");
    const res = await fetch(url, { next: { revalidate: 21600 }, signal: AbortSignal.timeout(20000) });
    if (!res.ok) throw new Error("Coin Metrics HTTP " + res.status);
    const json: { data?: MetricRow[]; next_page_url?: string } = await res.json();
    if (json.next_page_url) throw new Error("온체인 데이터가 한 페이지에 모두 포함되지 않았습니다.");
    const rows = (json.data ?? [])
      .map(r => ({ t: Date.parse(r.time) / 1000, cap: Number(r.CapMrktCurUSD), mvrv: Number(r.CapMVRVCur) }))
      .filter(r => Number.isFinite(r.t) && Number.isFinite(r.cap) && r.cap > 0 && Number.isFinite(r.mvrv) && r.mvrv > 0)
      .sort((a,b) => a.t-b.t);
    if (rows.length < 100) throw new Error("MVRV 계산에 필요한 데이터가 부족합니다.");
    // Welford online variance: only observations up to each date are used.
    let n=0, mean=0, m2=0;
    const points: Point[] = [];
    for (const r of rows) {
      n++;
      const delta=r.cap-mean;
      mean+=delta/n;
      m2+=delta*(r.cap-mean);
      const std=n>1?Math.sqrt(m2/n):0;
      const realized=r.cap/r.mvrv;
      points.push({t:r.t,mvrv:r.mvrv,z:std>0?(r.cap-realized)/std:0});
    }
    return NextResponse.json({ source:"Coin Metrics Community API", updatedAt:new Date(points[points.length-1].t*1000).toISOString(), points }, {headers:{"Cache-Control":"public, s-maxage=21600, stale-while-revalidate=3600"}});
  } catch(e) {
    return NextResponse.json({error:e instanceof Error?e.message:"MVRV 조회 실패"}, {status:502});
  }
}
