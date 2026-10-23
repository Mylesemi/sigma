export type RangeKey = "1d" | "1w" | "1y" | "3y" | "10y";

export interface RangeDef {
  key: RangeKey;
  label: string;
  days: number; // 조회 기간 (1d는 Yahoo의 range=1d 사용)
  interval: string; // Yahoo Finance 봉 간격
  cacheSec: number; // CDN 캐시 시간
}

export const RANGES: RangeDef[] = [
  { key: "1d", label: "1일", days: 1, interval: "5m", cacheSec: 30 },
  { key: "1w", label: "1주", days: 7, interval: "30m", cacheSec: 60 },
  { key: "1y", label: "1년", days: 365, interval: "1d", cacheSec: 600 },
  { key: "3y", label: "3년", days: 365 * 3, interval: "1wk", cacheSec: 3600 },
  { key: "10y", label: "10년", days: 365 * 10, interval: "1mo", cacheSec: 3600 },
];

export function getRange(key: string | null | undefined): RangeDef {
  return RANGES.find((r) => r.key === key) ?? RANGES[0];
}
