import { isValidSymbol } from "./symbols";

export interface SearchResult {
  symbol: string; // Yahoo 티커 (시세 조회에 그대로 사용)
  name: string;
  exchange: string;
}

const HANGUL = /[가-힣ㄱ-ㅎ]/;
export const hasHangul = (q: string) => HANGUL.test(q);

interface NaverItem {
  code?: string;
  name?: string;
  typeCode?: string;
  typeName?: string;
  nationCode?: string;
  category?: string;
}

// 네이버 증권 종목 → Yahoo 티커 (변환 규칙이 확실한 한국·미국·일본만)
export function naverToYahoo(item: NaverItem): SearchResult | null {
  const { code, name, typeCode, typeName, nationCode, category } = item;
  if (!code || !name || (category && category !== "stock")) return null;
  let symbol: string | null = null;
  if (nationCode === "KOR" && typeCode === "KOSPI") symbol = `${code}.KS`;
  else if (nationCode === "KOR" && typeCode === "KOSDAQ") symbol = `${code}.KQ`;
  else if (nationCode === "USA") symbol = code.replace(/\./g, "-"); // BRK.B → BRK-B
  else if (nationCode === "JPN") symbol = `${code}.T`;
  if (!symbol || !isValidSymbol(symbol)) return null;
  return { symbol, name, exchange: typeName ?? typeCode ?? "" };
}

interface YahooQuote {
  symbol?: string;
  shortname?: string;
  longname?: string;
  exchDisp?: string;
  quoteType?: string;
}

// Yahoo 검색 결과 중 주식·ETF만
export function fromYahoo(item: YahooQuote): SearchResult | null {
  const { symbol, shortname, longname, exchDisp, quoteType } = item;
  if (!symbol || !isValidSymbol(symbol) || (quoteType !== "EQUITY" && quoteType !== "ETF")) return null;
  return { symbol, name: longname ?? shortname ?? symbol, exchange: exchDisp ?? "" };
}

const UA = { "User-Agent": "Mozilla/5.0 (SIGMA)" };

// 한글 검색어는 네이버 증권 자동완성(Yahoo는 한글 검색을 400으로 거절), 그 외는 Yahoo 검색
export async function searchSymbols(q: string): Promise<SearchResult[]> {
  const opts = { headers: UA, signal: AbortSignal.timeout(6000), cache: "no-store" as const };
  let results: (SearchResult | null)[];
  if (hasHangul(q)) {
    const url = `https://m.stock.naver.com/front-api/search/autoComplete?${new URLSearchParams({ query: q, target: "stock" })}`;
    const res = await fetch(url, opts);
    if (!res.ok) throw new Error(`naver HTTP ${res.status}`);
    const json = await res.json();
    results = ((json?.result?.items ?? []) as NaverItem[]).map(naverToYahoo);
  } else {
    const url = `https://query1.finance.yahoo.com/v1/finance/search?${new URLSearchParams({ q, quotesCount: "10", newsCount: "0", lang: "ko-KR", region: "KR" })}`;
    const res = await fetch(url, opts);
    if (!res.ok) throw new Error(`yahoo HTTP ${res.status}`);
    const json = await res.json();
    results = ((json?.quotes ?? []) as YahooQuote[]).map(fromYahoo);
  }
  const seen = new Set<string>();
  return results.filter((r): r is SearchResult => r != null && !seen.has(r.symbol) && !!seen.add(r.symbol)).slice(0, 8);
}
