import { test as base, expect, type Page } from "@playwright/test";
import type { QuotesResponse } from "../../lib/quotes";
import { getRange } from "../../lib/ranges";
import { makeQuotes } from "../fixtures/quotes";

interface MockOptions {
  delayMs?: (range: string) => number; // 응답 지연 (응답 순서 뒤바뀜 재현용)
  transform?: (res: QuotesResponse) => unknown; // 응답 변형 (예: 이전 버전 API 모양)
}

// /api/quotes를 가짜 시세로 대체하고, 받은 요청을 기록
export async function mockQuotes(page: Page, opts: MockOptions = {}) {
  const requests: URL[] = [];
  await page.route("**/api/quotes**", async (route) => {
    const url = new URL(route.request().url());
    requests.push(url);
    const range = getRange(url.searchParams.get("range")).key;
    const from = Number(url.searchParams.get("from"));
    const to = Number(url.searchParams.get("to"));
    const res = makeQuotes(range, from && to ? { from, to } : null);
    const delay = opts.delayMs?.(range) ?? 0;
    if (delay) await new Promise((r) => setTimeout(r, delay));
    await route.fulfill({ json: opts.transform ? opts.transform(res) : res });
  });
  return requests;
}

// 모든 E2E 테스트 공통: 콘솔 오류·페이지 예외가 하나라도 생기면 실패
export const test = base.extend<{ noErrors: void }>({
  noErrors: [
    async ({ page }, use) => {
      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(e.message));
      page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
      await use();
      expect(errors).toEqual([]);
    },
    { auto: true },
  ],
});
export { expect };
