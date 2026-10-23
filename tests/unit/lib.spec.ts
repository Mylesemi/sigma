import { expect, test } from "@playwright/test";
import { dropSpikes, regularSessionTest } from "../../lib/quotes";
import { fromYahoo, hasHangul, naverToYahoo } from "../../lib/search";
import { isValidSymbol } from "../../lib/symbols";
import { buildSegments, segmentQuery } from "../../lib/ranges";
import { DEFAULT_PICKS, DEFAULT_STATE, MAX_PICKS, parseUrlState, toSearch } from "../../lib/urlState";

const DAY = 86400;
// 2026-10-19(월) 00:00 KST — 단위 테스트는 Node에서 돌아 TZ가 환경마다 다르므로 KST 고정이 필요한 테스트는 TZ를 확인
const MON_KST = Date.UTC(2026, 9, 18, 15) / 1000;

test.describe("urlState", () => {
  test("빈 주소는 기본 상태", () => {
    expect(parseUrlState("")).toEqual(DEFAULT_STATE);
    expect(toSearch(DEFAULT_STATE)).toBe("");
  });

  test("왕복 변환이 같은 상태를 돌려줌", () => {
    const s = { filter: "custom", range: "1y", view: "compare", seg: 1792335600, picks: ["AAPL", "TSLA"] } as const;
    const search = toSearch({ ...s, picks: [...s.picks] });
    expect(search).toBe("?cat=custom&range=1y&view=compare&seg=1792335600&picks=AAPL,TSLA");
    expect(parseUrlState(search)).toEqual({ ...s, picks: [...s.picks] });
  });

  test("잘못된 값은 기본값으로 정리", () => {
    const s = parseUrlState("?cat=bogus&range=5y&view=table&seg=-3&picks=AAPL,no%20pe!,AAPL");
    expect(s).toEqual({ ...DEFAULT_STATE, picks: ["AAPL"] });
  });

  test("picks는 중복 제거 후 최대 개수까지", () => {
    const many = "^KS11,^KQ11,^GSPC,^IXIC,^DJI,^N225,000001.SS,^JKSE,AAPL,TSLA";
    expect(parseUrlState(`?picks=${encodeURIComponent(many)}`).picks).toHaveLength(MAX_PICKS);
    expect(parseUrlState("?picks=").picks).toEqual([]); // 모두 뺀 상태도 유지
    expect(parseUrlState("").picks).toEqual(DEFAULT_PICKS);
  });

  test("1일 기간에는 구간을 주소에 남기지 않음", () => {
    expect(toSearch({ ...DEFAULT_STATE, seg: 123 })).toBe("");
  });
});

test.describe("segmentQuery", () => {
  const now = 1_800_000_000;
  test("최근 하루는 15분봉, 최근 한 주는 30분봉", () => {
    expect(segmentQuery(now - 2 * DAY, now - DAY, now).interval).toBe("15m");
    expect(segmentQuery(now - 7 * DAY, now, now).interval).toBe("30m");
  });
  test("60일~730일 전 주는 1시간봉, 그보다 오래되면 일봉", () => {
    expect(segmentQuery(now - 100 * DAY, now - 93 * DAY, now).interval).toBe("1h");
    expect(segmentQuery(now - 1000 * DAY, now - 993 * DAY, now).interval).toBe("1d");
  });
  test("연 단위는 일봉, 끝난 구간은 길게 캐시", () => {
    const q = segmentQuery(now - 800 * DAY, now - 435 * DAY, now);
    expect(q).toEqual({ interval: "1d", cacheSec: 3600 });
    expect(segmentQuery(now - DAY / 2, now, now).cacheSec).toBe(60);
  });
});

test.describe("buildSegments", () => {
  test.skip(new Date(MON_KST * 1000).getHours() !== 0, "KST(TZ=Asia/Seoul)에서만 의미 있는 경계 검사");

  test("일 단위는 토·일을 제외하고 시간순", () => {
    // 금(10/16) 10시 ~ 월(10/19) 10시를 6시간 간격으로
    const times = Array.from({ length: 13 }, (_, i) => MON_KST - 3 * DAY + 10 * 3600 + i * 6 * 3600);
    const segs = buildSegments("day", times, MON_KST + 2 * DAY);
    expect(segs.map((s) => s.label)).toEqual(["10/16(금)", "10/19(월)"]);
    expect(segs[1].from).toBe(MON_KST);
    expect(segs[1].to - segs[1].from).toBe(DAY);
  });

  test("주 단위는 월요일 시작, 연 단위는 1월 1일 시작", () => {
    const wed = MON_KST + 2 * DAY + 3600;
    expect(buildSegments("week", [wed], MON_KST + 30 * DAY)[0]).toMatchObject({ from: MON_KST, label: "10/19~10/25", group: "2026년" });
    const y = buildSegments("year", [wed], MON_KST + 400 * DAY)[0];
    expect(y.label).toBe("2026년");
    expect(new Date(y.from * 1000).getMonth()).toBe(0);
  });

  test("진행 중인 구간의 끝은 현재 시각까지", () => {
    const now = MON_KST + 3 * 3600;
    expect(buildSegments("day", [MON_KST + 3600], now)[0].to).toBe(now);
  });
});

test.describe("dropSpikes", () => {
  test("자릿수가 틀린 값만 제외", () => {
    const closes = [1300, 1310, 1305, 0.1154, 1320, 1315, 1330, 1325];
    expect(dropSpikes(closes.map((_, i) => i), closes)).toEqual([0, 1, 2, 4, 5, 6, 7]);
  });
  test("실제 급등락(두 배 이내)은 유지", () => {
    const closes = [100, 120, 150, 190, 180, 200, 210];
    expect(dropSpikes(closes.map((_, i) => i), closes)).toHaveLength(closes.length);
  });
});

test.describe("search", () => {
  test("네이버 종목 → Yahoo 티커 (한국·미국·일본만)", () => {
    expect(naverToYahoo({ code: "005930", name: "삼성전자", typeCode: "KOSPI", nationCode: "KOR", category: "stock" })?.symbol).toBe("005930.KS");
    expect(naverToYahoo({ code: "293490", name: "카카오게임즈", typeCode: "KOSDAQ", nationCode: "KOR" })?.symbol).toBe("293490.KQ");
    expect(naverToYahoo({ code: "BRK.B", name: "버크셔", typeCode: "NYSE", nationCode: "USA" })?.symbol).toBe("BRK-B");
    expect(naverToYahoo({ code: "7203", name: "토요타", typeCode: "TOKYO", nationCode: "JPN" })?.symbol).toBe("7203.T");
    expect(naverToYahoo({ code: "123456", name: "코넥스", typeCode: "KONEX", nationCode: "KOR" })).toBeNull();
    expect(naverToYahoo({ code: "0700", name: "텐센트", typeCode: "HONGKONG", nationCode: "HKG" })).toBeNull();
    expect(naverToYahoo({ code: "KOSPI", name: "코스피", category: "index", nationCode: "KOR" })).toBeNull();
  });

  test("Yahoo 검색은 주식·ETF만", () => {
    expect(fromYahoo({ symbol: "NVDA", longname: "NVIDIA Corporation", exchDisp: "나스닥", quoteType: "EQUITY" })).toEqual({
      symbol: "NVDA",
      name: "NVIDIA Corporation",
      exchange: "나스닥",
    });
    expect(fromYahoo({ symbol: "000660-USD", quoteType: "CRYPTOCURRENCY" })).toBeNull();
  });

  test("한글 포함 여부로 검색 경로 결정", () => {
    expect(hasHangul("엔비디아")).toBe(true);
    expect(hasHangul("SK하이닉스")).toBe(true);
    expect(hasHangul("nvidia 000660")).toBe(false);
  });

  test("티커 형식 검증", () => {
    for (const ok of ["AAPL", "005930.KS", "BRK-B", "^GSPC", "KRW=X"]) expect(isValidSymbol(ok)).toBe(true);
    for (const bad of ["", "aapl", "A B", "<script>", "X".repeat(21)]) expect(isValidSymbol(bad)).toBe(false);
  });
});

test.describe("regularSessionTest (장외 판정)", () => {
  const day = (h: number, m = 0) => Date.UTC(2026, 9, 20, h, m) / 1000;
  const periods = { regular: [[{ start: day(13, 30), end: day(20) }]] };

  test("주식·ETF만 판정, 환율·선물은 null", () => {
    expect(regularSessionTest({ instrumentType: "CURRENCY", tradingPeriods: periods })).toBeNull();
    expect(regularSessionTest({ instrumentType: "FUTURE", tradingPeriods: periods })).toBeNull();
  });

  test("날짜별 정규장: 안·종료 시각·밖", () => {
    const f = regularSessionTest({ instrumentType: "EQUITY", tradingPeriods: periods })!;
    expect(f(day(14))).toBe("regular");
    expect(f(day(20))).toBe("edge"); // 한국장 동시호가 종가처럼 정규장일 수도, 미국 애프터 첫 봉일 수도
    expect(f(day(9))).toBe("ext");
    expect(f(day(21))).toBe("ext");
  });

  test("날짜별 정보가 없으면 오늘 정규장 시각을 매일 적용 (현지 시각 기준)", () => {
    const f = regularSessionTest({
      instrumentType: "EQUITY",
      gmtoffset: -4 * 3600,
      currentTradingPeriod: { regular: { start: day(13, 30), end: day(20) } },
    })!;
    expect(f(day(15) - 3 * 86400)).toBe("regular"); // 3일 전 같은 시각
    expect(f(day(12))).toBe("ext");
  });
});
