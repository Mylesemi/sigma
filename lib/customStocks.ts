import { MAX_CUSTOM, isBuiltin, isValidSymbol } from "./symbols";

// 사용자가 웹에서 추가한 종목 — 브라우저(localStorage)에 저장, 방문자마다 따로 관리
export interface CustomStock {
  symbol: string; // Yahoo 티커
  name: string; // 검색 결과의 이름 (한글 검색이면 한글명)
}

const KEY = "sigma.customStocks";

// 저장소가 막혀 있거나(사생활 보호 모드 등) 값이 깨져 있어도 빈 목록으로 동작
export function loadCustomStocks(): CustomStock[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    if (!Array.isArray(raw)) return [];
    return raw
      .filter((s): s is CustomStock => typeof s?.symbol === "string" && typeof s?.name === "string")
      .filter((s) => isValidSymbol(s.symbol) && !isBuiltin(s.symbol))
      .slice(0, MAX_CUSTOM);
  } catch {
    return [];
  }
}

export function saveCustomStocks(list: CustomStock[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    // 저장 실패는 무시 (이번 방문 동안은 화면에 유지됨)
  }
}
