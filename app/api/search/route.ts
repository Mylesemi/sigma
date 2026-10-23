import { searchSymbols } from "@/lib/search";

export const dynamic = "force-dynamic";

// ?q=엔비디아 | nvidia | 000660 — 종목 검색 (웹에서 개별 종목 추가용)
export async function GET(req: Request) {
  const q = (new URL(req.url).searchParams.get("q") ?? "").trim().slice(0, 40);
  if (!q) return Response.json({ results: [] });
  try {
    const results = await searchSymbols(q);
    return Response.json(
      { results },
      // 검색 결과는 자주 바뀌지 않으므로 CDN에 하루 캐시
      { headers: { "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=86400" } },
    );
  } catch (e) {
    console.error("search failed", q, e);
    return Response.json({ results: [], error: "search failed" }, { status: 502 });
  }
}
