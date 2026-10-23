export type RangeKey = "1d" | "1w" | "1y" | "3y" | "10y";

export interface RangeDef {
  key: RangeKey;
  label: string;
  days: number; // 조회 기간 (1d는 Yahoo의 range=1d 사용)
  interval: string; // Yahoo Finance 봉 간격
  cacheSec: number; // CDN 캐시 시간
  segment?: "day" | "week" | "year"; // 확대해서 볼 수 있는 하위 구간 단위
}

export const RANGES: RangeDef[] = [
  { key: "1d", label: "1일", days: 1, interval: "5m", cacheSec: 30 },
  { key: "1w", label: "1주", days: 7, interval: "30m", cacheSec: 60, segment: "day" },
  { key: "1y", label: "1년", days: 365, interval: "1d", cacheSec: 600, segment: "week" },
  { key: "3y", label: "3년", days: 365 * 3, interval: "1wk", cacheSec: 3600, segment: "week" },
  { key: "10y", label: "10년", days: 365 * 10, interval: "1mo", cacheSec: 3600, segment: "year" },
];

export function getRange(key: string | null | undefined): RangeDef {
  return RANGES.find((r) => r.key === key) ?? RANGES[0];
}

// 선택한 하위 구간(unix seconds, [from, to))
export interface Segment {
  from: number;
  to: number;
  label: string; // 버튼/목록에 표시
  group?: string; // 목록 묶음 (예: 연도)
}

const DAY = 86400;

// 구간 길이와 오래된 정도에 따라 Yahoo가 제공하는 가장 촘촘한 봉 간격 선택
// (분봉은 최근 60일, 1시간봉은 최근 730일까지만 제공)
export function segmentQuery(from: number, to: number, now = Math.floor(Date.now() / 1000)) {
  const span = to - from;
  const age = now - from;
  let interval = "1d";
  if (span <= 2 * DAY && age < 59 * DAY) interval = "15m";
  else if (span <= 8 * DAY && age < 59 * DAY) interval = "30m";
  else if (span <= 8 * DAY && age < 729 * DAY) interval = "1h";
  // 끝난 과거 구간은 바뀌지 않으므로 길게 캐시
  const cacheSec = to < now - DAY ? 3600 : 60;
  return { interval, cacheSec };
}

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

// 실제 데이터가 있는 시각들로부터 하위 구간 목록 생성 (브라우저 현지 시간 기준)
export function buildSegments(unit: NonNullable<RangeDef["segment"]>, times: number[], now = Date.now() / 1000): Segment[] {
  const starts = new Map<number, Date>();
  for (const t of times) {
    const d = new Date(t * 1000);
    if (unit === "day" && (d.getDay() === 0 || d.getDay() === 6)) continue; // 토·일 칩은 만들지 않음
    d.setHours(0, 0, 0, 0);
    if (unit === "week") d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); // 월요일 시작
    if (unit === "year") d.setMonth(0, 1);
    starts.set(d.getTime(), d);
  }
  return [...starts.values()]
    .sort((a, b) => a.getTime() - b.getTime())
    .map((d) => {
      const end = new Date(d);
      if (unit === "day") end.setDate(end.getDate() + 1);
      else if (unit === "week") end.setDate(end.getDate() + 7);
      else end.setFullYear(end.getFullYear() + 1);
      const from = d.getTime() / 1000;
      const to = Math.min(end.getTime() / 1000, Math.floor(now));
      const md = (x: Date) => `${x.getMonth() + 1}/${x.getDate()}`;
      const last = new Date(end.getTime() - DAY * 1000);
      const label =
        unit === "day"
          ? `${md(d)}(${WEEKDAYS[d.getDay()]})`
          : unit === "week"
            ? `${md(d)}~${md(last)}`
            : `${d.getFullYear()}년`;
      return { from, to, label, group: unit === "week" ? `${d.getFullYear()}년` : undefined };
    });
}
