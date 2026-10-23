import { RANGES, type RangeKey } from "./ranges";
import { CATEGORIES, isValidSymbol, type Category } from "./symbols";

export type Filter = Category | "all" | "custom"; // custom = 직접 고른 자산 비교
export type View = "cards" | "compare";

export const MAX_PICKS = 8; // 비교 차트 계열 색 수와 같음
export const DEFAULT_PICKS = ["^KS11", "005930.KS", "AAPL"];

// 화면 상태 — 공유·즐겨찾기·뒤로 가기를 위해 URL 쿼리에 그대로 담음
export interface UrlState {
  filter: Filter;
  range: RangeKey;
  view: View;
  seg: number | null; // 선택한 하위 구간의 시작 시각 (unix seconds)
  picks: string[];
}

export const DEFAULT_STATE: UrlState = { filter: "all", range: "1d", view: "cards", seg: null, picks: DEFAULT_PICKS };

const FILTERS: string[] = ["all", "custom", ...CATEGORIES.map((c) => c.key)];

// 잘못되거나 알 수 없는 값은 기본값으로 (손으로 고친 URL이나 오래된 링크 대비)
export function parseUrlState(search: string): UrlState {
  const p = new URLSearchParams(search);
  const filter = p.get("cat");
  const range = p.get("range");
  const seg = Number(p.get("seg"));
  const picks = p.has("picks")
    ? [...new Set((p.get("picks") ?? "").split(",").filter(isValidSymbol))].slice(0, MAX_PICKS) // 웹에서 추가한 종목도 허용
    : DEFAULT_PICKS;
  return {
    filter: filter && FILTERS.includes(filter) ? (filter as Filter) : DEFAULT_STATE.filter,
    range: RANGES.some((r) => r.key === range) ? (range as RangeKey) : DEFAULT_STATE.range,
    view: p.get("view") === "compare" ? "compare" : "cards",
    seg: Number.isInteger(seg) && seg > 0 ? seg : null,
    picks,
  };
}

// 기본값과 같은 항목은 생략해 URL을 짧게 유지
export function toSearch(s: UrlState): string {
  const p = new URLSearchParams();
  if (s.filter !== DEFAULT_STATE.filter) p.set("cat", s.filter);
  if (s.range !== DEFAULT_STATE.range) p.set("range", s.range);
  if (s.view !== DEFAULT_STATE.view) p.set("view", s.view);
  if (s.seg != null && s.range !== "1d") p.set("seg", String(s.seg));
  if (s.picks.join(",") !== DEFAULT_PICKS.join(",")) p.set("picks", s.picks.join(","));
  const qs = p.toString().replace(/%2C/g, ","); // 쉼표는 그대로 두어 읽기 쉽게
  return qs ? `?${qs}` : "";
}
