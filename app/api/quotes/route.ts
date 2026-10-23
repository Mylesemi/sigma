import { getQuotes, type QuoteWindow } from "@/lib/quotes";
import { getRange, segmentQuery } from "@/lib/ranges";
import { MAX_CUSTOM, isValidSymbol } from "@/lib/symbols";
import { MAX_PICKS } from "@/lib/urlState";

export const dynamic = "force-dynamic";

const MAX_SPAN = 370 * 86400; // 하위 구간은 최대 1년(연 단위)
const MAX_AGE = 11 * 365 * 86400;

// ?from=&to= (unix seconds) 검증 — 잘못된 값이면 무시하고 전체 기간 조회
function parseWindow(params: URLSearchParams): QuoteWindow | null {
  const from = Number(params.get("from"));
  const to = Number(params.get("to"));
  const now = Math.floor(Date.now() / 1000);
  if (!Number.isInteger(from) || !Number.isInteger(to) || from <= 0 || to <= from) return null;
  if (to - from > MAX_SPAN || from < now - MAX_AGE || from > now) return null;
  return { from, to: Math.min(to, now) };
}

// ?extra=NVDA,000660.KS — 사용자가 추가한 종목 (형식이 틀린 값은 버리고, 정렬해 CDN 캐시 키를 맞춤)
function parseExtra(params: URLSearchParams): string[] {
  const list = (params.get("extra") ?? "").split(",").map((s) => s.trim().toUpperCase());
  return [...new Set(list.filter(isValidSymbol))].sort().slice(0, MAX_CUSTOM + MAX_PICKS); // 추가 종목 + 공유 링크의 직접 비교 종목
}

export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  const range = getRange(params.get("range"));
  const win = range.segment ? parseWindow(params) : null;
  const data = await getQuotes(range, win, parseExtra(params));
  const cacheSec = win ? segmentQuery(win.from, win.to).cacheSec : range.cacheSec;
  return Response.json(data, {
    headers: {
      // Vercel CDN 캐시 → 방문자가 많아도 원본 API 호출은 cacheSec마다 1번
      "Cache-Control": `public, s-maxage=${cacheSec}, stale-while-revalidate=${cacheSec * 2}`,
    },
  });
}
