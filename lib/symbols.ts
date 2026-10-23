export type Category = "fx" | "commodity" | "index" | "macro";

export interface SymbolDef {
  symbol: string; // Yahoo Finance ticker
  name: string;
  sub: string;
  category: Category;
  digits: number;
}

export const CATEGORIES: { key: Category; title: string }[] = [
  { key: "fx", title: "환율" },
  { key: "commodity", title: "원자재" },
  { key: "index", title: "주가지수" },
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

  // 금리 · 변동성 · 가상자산
  { symbol: "^TNX", name: "미 10년물", sub: "US 10Y 국채금리 (%)", category: "macro", digits: 3 },
  { symbol: "^IRX", name: "미 3개월물", sub: "US 13W 국채금리 (%)", category: "macro", digits: 3 },
  { symbol: "^VIX", name: "VIX", sub: "변동성 지수", category: "macro", digits: 2 },
  { symbol: "BTC-USD", name: "비트코인", sub: "BTC · USD", category: "macro", digits: 0 },
  { symbol: "ETH-USD", name: "이더리움", sub: "ETH · USD", category: "macro", digits: 2 },
];
