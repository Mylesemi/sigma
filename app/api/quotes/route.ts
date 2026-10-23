import { getQuotes } from "@/lib/quotes";
import { getRange } from "@/lib/ranges";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const range = getRange(new URL(req.url).searchParams.get("range"));
  const data = await getQuotes(range);
  return Response.json(data, {
    headers: {
      // Vercel CDN 캐시 → 방문자가 많아도 원본 API 호출은 기간별 cacheSec마다 1번
      "Cache-Control": `public, s-maxage=${range.cacheSec}, stale-while-revalidate=${range.cacheSec * 2}`,
    },
  });
}
