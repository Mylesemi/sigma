import { getQuotes } from "@/lib/quotes";

export const dynamic = "force-dynamic";

export async function GET() {
  const data = await getQuotes();
  return Response.json(data, {
    headers: {
      // Vercel CDN에서 30초 캐시 → 방문자가 많아도 원본 API 호출은 30초에 1번
      "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60",
    },
  });
}
