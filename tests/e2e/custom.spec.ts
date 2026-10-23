import type { Page } from "@playwright/test";
import { expect, mockQuotes, mockSearch, test } from "./mock";

const search = (page: Page) => page.getByLabel("추가할 종목 검색");
const cardNames = (page: Page) => page.locator(".card h3");

test("종목 검색 → 추가 → 새로고침 후에도 유지 → 삭제", async ({ page }) => {
  const requests = await mockQuotes(page);
  await mockSearch(page);
  await page.goto("/?cat=stock");
  await expect(cardNames(page)).toHaveText(["삼성전자", "애플", "테슬라"]);

  await search(page).fill("nvidia");
  const results = page.locator(".search-results button");
  await expect(results).toHaveCount(2);
  await expect(results.filter({ hasText: "AAPL" })).toBeDisabled(); // 기본 목록에 이미 있음
  await results.filter({ hasText: "NVDA" }).click();

  await expect(cardNames(page)).toHaveText(["삼성전자", "애플", "테슬라", "NVIDIA Corporation"]);
  expect(requests.some((u) => u.searchParams.get("extra") === "NVDA")).toBe(true);

  await page.reload();
  await expect(cardNames(page)).toHaveText(["삼성전자", "애플", "테슬라", "NVIDIA Corporation"]);

  await page.getByRole("button", { name: "NVIDIA Corporation 삭제" }).click();
  await expect(cardNames(page)).toHaveText(["삼성전자", "애플", "테슬라"]);
  expect(await page.evaluate(() => localStorage.getItem("sigma.customStocks"))).toBe("[]");
});

test("한글로 검색해 추가하면 검색 결과의 한글 이름으로 표시, Enter로 첫 결과 추가", async ({ page }) => {
  await mockQuotes(page);
  await mockSearch(page);
  await page.goto("/?cat=stock");
  await search(page).fill("하이닉스");
  await expect(page.locator(".search-results button")).toHaveCount(1);
  await search(page).press("Enter");
  await expect(cardNames(page).last()).toHaveText("SK하이닉스"); // 서버가 준 영문명(000660.KS Inc.) 대신
  await expect(search(page)).toHaveValue("");
});

test("추가한 종목은 직접 비교에서도 고를 수 있음", async ({ page }) => {
  await mockQuotes(page);
  await page.addInitScript(() => localStorage.setItem("sigma.customStocks", JSON.stringify([{ symbol: "NVDA", name: "엔비디아" }])));
  await page.goto("/?cat=custom&view=compare");
  await page.getByLabel("비교할 자산 추가").selectOption({ label: "엔비디아" });
  await expect(page.locator(".pick").last()).toContainText("엔비디아");
  await expect(page.locator(".compare .legend button").last()).toContainText("엔비디아");
});

test("공유 링크의 직접 비교 종목은 받은 쪽에 없어도 조회되고, 개별 종목 목록엔 넣지 않음", async ({ page }) => {
  const requests = await mockQuotes(page);
  await page.goto("/?cat=custom&picks=NVDA,AAPL");
  await expect(page.locator(".card h3")).toHaveText(["NVDA Inc.", "애플"]);
  expect(requests.some((u) => u.searchParams.get("extra") === "NVDA")).toBe(true);
  await page.getByRole("button", { name: "개별 종목" }).click();
  await expect(cardNames(page)).toHaveText(["삼성전자", "애플", "테슬라"]);
});

test("저장된 목록이 깨져 있어도 정상 동작", async ({ page }) => {
  await mockQuotes(page);
  await page.addInitScript(() => localStorage.setItem("sigma.customStocks", "{not json"));
  await page.goto("/?cat=stock");
  await expect(cardNames(page)).toHaveText(["삼성전자", "애플", "테슬라"]);
});

test("장외: 미국 주식은 비교 차트에 점선 구간과 범례 안내, 카드에 시간외 가격", async ({ page }) => {
  // 카드의 시간외 줄은 마지막 점이 장외일 때만 나오므로 값 고정
  await mockQuotes(page, {
    transform: (res) => ({ ...res, quotes: res.quotes.map((q) => (q.symbol === "AAPL" ? { ...q, extPrice: +(q.price! * 1.02).toFixed(2) } : q)) }),
  });
  await page.goto("/?cat=stock&range=1w");
  const apple = page.locator(".card", { hasText: "애플" });
  await expect(apple.locator(".ext-price")).toContainText(/시간외 .* \+2\.00%/);
  await expect(page.locator(".card", { hasText: "삼성전자" }).locator(".ext-price")).toHaveCount(0);

  await page.getByRole("group", { name: "보기" }).getByRole("button", { name: "비교" }).click();
  await expect(page.locator(".compare-plot path.ext-line")).toHaveCount(2); // 애플·테슬라
  await expect(page.locator(".legend-note")).toHaveText(/장외/);
});
