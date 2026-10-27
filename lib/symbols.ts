export type Category = "fx" | "commodity" | "index" | "semiconductor" | "stock" | "macro";

export interface SymbolDef {
  symbol: string; // Yahoo Finance ticker
  name: string;
  sub: string;
  category: Category;
  digits: number;
  custom?: boolean; // 사용자가 웹에서 추가한 종목 (이름·통화·자릿수는 시세 응답에서 채움)
}

// Yahoo 티커 형식 (예: AAPL, 005930.KS, BRK-B, ^GSPC, KRW=X)
const SYMBOL_RE = /^[A-Z0-9^][A-Z0-9.\-=^]{0,19}$/;
export const isValidSymbol = (s: string) => SYMBOL_RE.test(s);
export const isBuiltin = (s: string) => SYMBOLS.some((d) => d.symbol === s);

export const MAX_CUSTOM = 20; // 웹에서 추가할 수 있는 종목 수

export const CATEGORIES: { key: Category; title: string }[] = [
  { key: "fx", title: "환율" },
  { key: "commodity", title: "원자재" },
  { key: "index", title: "주가지수" },
  { key: "semiconductor", title: "반도체 지수" },
  { key: "stock", title: "개별 종목" },
  { key: "macro", title: "금리 · 변동성 · 가상자산" },
];

export const SYMBOLS: SymbolDef[] = [
  // 환율
  { symbol: "KRW=X", name: "USD/KRW", sub: "원/달러", category: "fx", digits: 2 },
  { symbol: "JPYKRW=X", name: "JPY/KRW", sub: "원/엔 (1엔)", category: "fx", digits: 4 },
  { symbol: "EURKRW=X", name: "EUR/KRW", sub: "원/유로", category: "fx", digits: 2 },
  { symbol: "CNYKRW=X", name: "CNY/KRW", sub: "원/위안", category: "fx", digits: 2 },
  { symbol: "JPY=X", name: "USD/JPY", sub: "엔/달러", category: "fx", digits: 3 },
  { symbol: "EURUSD=X", name: "EUR/USD", sub: "달러/유로", category: "fx", digits: 4 },
  { symbol: "DX-Y.NYB", name: "DXY", sub: "달러인덱스", category: "fx", digits: 2 },

  // 원자재
  { symbol: "GC=F", name: "금", sub: "Gold · USD/oz", category: "commodity", digits: 1 },
  { symbol: "SI=F", name: "은", sub: "Silver · USD/oz", category: "commodity", digits: 3 },
  { symbol: "CL=F", name: "WTI", sub: "WTI 원유 · USD/bbl", category: "commodity", digits: 2 },
  { symbol: "BZ=F", name: "브렌트유", sub: "Brent · USD/bbl", category: "commodity", digits: 2 },
  { symbol: "NG=F", name: "천연가스", sub: "Natural Gas · USD/MMBtu", category: "commodity", digits: 3 },
  { symbol: "HG=F", name: "구리", sub: "Copper · USD/lb", category: "commodity", digits: 3 },

  // 주가지수
  { symbol: "^KS11", name: "코스피", sub: "KOSPI", category: "index", digits: 2 },
  { symbol: "^KQ11", name: "코스닥", sub: "KOSDAQ", category: "index", digits: 2 },
  { symbol: "^GSPC", name: "S&P 500", sub: "미국", category: "index", digits: 2 },
  { symbol: "^IXIC", name: "나스닥", sub: "NASDAQ Composite", category: "index", digits: 2 },
  { symbol: "^DJI", name: "다우존스", sub: "Dow Jones", category: "index", digits: 2 },
  { symbol: "^N225", name: "닛케이 225", sub: "일본", category: "index", digits: 2 },
  { symbol: "000001.SS", name: "상해종합", sub: "중국", category: "index", digits: 2 },
  { symbol: "^JKSE", name: "자카르타종합", sub: "인도네시아 IDX", category: "index", digits: 2 },

  // 반도체 산업 지수 및 추종 ETF (ETF는 지수 자체가 아닌 거래 상품)
  { symbol: "^SOX", name: "필라델피아 반도체", sub: "PHLX Semiconductor Sector Index · 지수", category: "semiconductor", digits: 2 },
  { symbol: "SMH", name: "VanEck 반도체 ETF", sub: "미국 상장 반도체 ETF · USD", category: "semiconductor", digits: 2 },
  { symbol: "SOXX", name: "iShares 반도체 ETF", sub: "미국 상장 반도체 ETF · USD", category: "semiconductor", digits: 2 },
  { symbol: "091160.KS", name: "KODEX 반도체 ETF", sub: "국내 반도체 ETF · KRW", category: "semiconductor", digits: 0 },

  // 개별 종목
  { symbol: "005930.KS", name: "삼성전자", sub: "005930 · KRW", category: "stock", digits: 0 },
  { symbol: "AAPL", name: "애플", sub: "AAPL · USD", category: "stock", digits: 2 },
  { symbol: "TSLA", name: "테슬라", sub: "TSLA · USD", category: "stock", digits: 2 },

  // 금리 · 변동성 · 가상자산
  { symbol: "^TNX", name: "미 10년물", sub: "US 10Y 국채금리 (%)", category: "macro", digits: 3 },
  { symbol: "^IRX", name: "미 3개월물", sub: "US 13W 국채금리 (%)", category: "macro", digits: 3 },
  { symbol: "^VIX", name: "VIX", sub: "변동성 지수", category: "macro", digits: 2 },
  { symbol: "BTC-USD", name: "비트코인", sub: "BTC · USD", category: "macro", digits: 0 },
  { symbol: "ETH-USD", name: "이더리움", sub: "ETH · USD", category: "macro", digits: 2 },
];
