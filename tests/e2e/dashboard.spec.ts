import type { Page } from "@playwright/test";
import { CATEGORIES, SYMBOLS } from "../../lib/symbols";
import { expect, mockQuotes, test } from "./mock";

const seg = (page: Page, label: string) => page.getByRole("group", { name: label });
const heading = (page: Page) => page.locator("section h2 small").first();

test("카드 보기: 모든 카테고리와 종목이 표시되고 필터가 동작", async ({ page }) => {
  await mockQuotes(page);
  await page.goto("/");
  await expect(page.locator(".card:not(.skeleton)")).toHaveCount(SYMBOLS.length);
  await expect(page.locator("section h2")).toHaveCount(CATEGORIES.length);
  await page.getByRole("button", { name: "개별 종목" }).click();
  await expect(page.locator(".card")).toHaveCount(3);
  await expect(page.locator(".card h3")).toHaveText(["삼성전자", "애플", "테슬라"]);
});

test("비교 보기: 카테고리마다 차트, 범례로 숨기기, 전부 숨기면 안내", async ({ page }) => {
  await mockQuotes(page);
  await page.goto("/?view=compare&cat=stock");
  const chart = page.locator(".compare").first();
  await expect(chart.locator("svg path[stroke^='var(--s']")).toHaveCount(3);
  await chart.getByRole("button", { name: /애플/ }).click();
  await expect(chart.locator("svg path[stroke^='var(--s']")).toHaveCount(2);
  await chart.getByRole("button", { name: /삼성전자/ }).click();
  await chart.getByRole("button", { name: /테슬라/ }).click();
  await expect(chart.getByText("범례에서 비교할 자산을 선택하세요.")).toBeVisible();
  await chart.getByRole("button", { name: "모두 보기" }).click();
  await expect(chart.locator("svg path[stroke^='var(--s']")).toHaveCount(3);
});

test("비교 보기: 호버하면 모든 자산 값이 툴팁에 표시", async ({ page }) => {
  await mockQuotes(page);
  await page.goto("/?view=compare&cat=stock&range=1y");
  const plot = page.locator(".compare-plot svg rect").last();
  await plot.hover({ position: { x: 200, y: 50 } });
  await expect(page.locator(".compare-tip .tip-row")).toHaveCount(3);
  await expect(page.locator(".tick-label").filter({ hasText: /^-0%$/ })).toHaveCount(0);
});

test("회귀: times가 없는 이전 버전 응답에도 페이지가 멈추지 않음", async ({ page }) => {
  await mockQuotes(page, {
    transform: (res) => ({ ...res, quotes: res.quotes.map(({ times: _t, ...q }) => q) }),
  });
  await page.goto("/?view=compare");
  await expect(page.locator(".compare-empty")).toHaveCount(CATEGORIES.length);
  await expect(page.getByText("이 기간에 표시할 데이터가 없습니다.").first()).toBeVisible();
});

test("기간을 빠르게 바꿔도 마지막에 고른 기간의 데이터가 남음", async ({ page }) => {
  // 1년 응답을 10년보다 늦게 도착시킴
  await mockQuotes(page, { delayMs: (r) => (r === "1y" ? 1500 : 0) });
  await page.goto("/");
  await expect(page.locator(".card:not(.skeleton)").first()).toBeVisible();
  await seg(page, "기간").getByRole("button", { name: "1년" }).click();
  await seg(page, "기간").getByRole("button", { name: "10년" }).click();
  await expect(heading(page)).toHaveText("10년 전 대비");
  await page.waitForTimeout(2000); // 늦게 온 1년 응답이 덮어쓰지 않는지
  await expect(heading(page)).toHaveText("10년 전 대비");
  await expect(page.locator("main")).not.toHaveClass(/stale/);
});

test("URL 상태: 조작이 주소에 남고, 새로고침·뒤로 가기로 복원", async ({ page }) => {
  await mockQuotes(page);
  await page.goto("/");
  await seg(page, "보기").getByRole("button", { name: "비교" }).click();
  await seg(page, "기간").getByRole("button", { name: "1년" }).click();
  await page.getByRole("button", { name: "주가지수" }).click();
  await expect(page).toHaveURL(/\?cat=index&range=1y&view=compare$/);

  await page.reload();
  await expect(seg(page, "기간").getByRole("button", { name: "1년" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("button", { name: "주가지수" })).toHaveClass(/active/);
  await expect(page.locator(".compare svg")).toHaveCount(1);

  await page.goBack(); // 카테고리 선택 이전으로
  await expect(page).toHaveURL(/\?range=1y&view=compare$/);
  await expect(page.locator(".compare svg")).toHaveCount(CATEGORIES.length);
  await page.goBack();
  await page.goBack();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator(".card:not(.skeleton)").first()).toBeVisible();
});

test("URL 상태: 잘못된 값은 기록을 늘리지 않고 정리", async ({ page }) => {
  await mockQuotes(page);
  // 페이지 스크립트가 돌기 전의 기록 길이 (새 탭은 about:blank부터라 1이 아님)
  await page.addInitScript(() => ((window as unknown as { __len: number }).__len = history.length));
  await page.goto("/?range=5y&cat=nope&view=compare");
  await expect(page).toHaveURL(/\?view=compare$/);
  expect(await page.evaluate(() => history.length - (window as unknown as { __len: number }).__len)).toBe(0);
});

test("구간: 1주는 평일 칩만, 칩을 고르면 해당 구간만 다시 조회", async ({ page }) => {
  const requests = await mockQuotes(page);
  await page.goto("/?range=1w&view=compare");
  const chips = page.locator(".segment-chips button");
  await expect(chips.first()).toBeVisible();
  const labels = await chips.allTextContents();
  expect(labels.length).toBeGreaterThanOrEqual(4);
  for (const l of labels) expect(l).not.toMatch(/\((토|일)\)/); // 가상자산은 주말 데이터가 있어도 칩은 평일만

  await chips.nth(1).click();
  await expect(heading(page)).toHaveText(`${labels[1]} 시작 대비`);
  await expect(page).toHaveURL(/seg=\d+/);
  expect(requests.some((u) => u.searchParams.has("from"))).toBe(true);

  await page.getByRole("button", { name: "다음 구간" }).click();
  await expect(heading(page)).toHaveText(`${labels[2]} 시작 대비`);
  await page.locator(".segments").getByRole("button", { name: "전체" }).click();
  await expect(heading(page)).toHaveText("1주 전 대비");
});

test("구간: 구간이 담긴 링크로 바로 들어와도 구간 선택이 보임", async ({ page }) => {
  await mockQuotes(page);
  await page.goto("/?range=10y");
  const year = page.locator(".segment-chips button").nth(3);
  const label = (await year.textContent())!;
  await year.click();
  await expect(page).toHaveURL(/seg=\d+/);
  const url = page.url();

  const fresh = await page.context().newPage();
  await mockQuotes(fresh);
  await fresh.goto(url);
  await expect(fresh.locator(".segment-chips button.active")).toHaveText(label);
  await expect(fresh.locator("section h2 small").first()).toHaveText(`${label} 시작 대비`);
  await fresh.close();
});

test("직접 비교: 기본 3개, 추가·삭제, 남은 자산의 색 유지, 주소 반영", async ({ page }) => {
  await mockQuotes(page);
  await page.goto("/?view=compare");
  await page.getByRole("button", { name: "직접 비교" }).click();
  const picks = page.locator(".pick");
  await expect(picks).toHaveText([/코스피/, /삼성전자/, /애플/]);
  await expect(page.locator(".compare svg path[stroke^='var(--s']")).toHaveCount(3);

  const colorOf = (name: string) => picks.filter({ hasText: name }).locator(".key").evaluate((el) => (el as HTMLElement).style.background);
  const appleColor = await colorOf("애플");

  await page.getByRole("button", { name: "삼성전자 빼기" }).click();
  await expect(picks).toHaveCount(2);
  expect(await colorOf("애플")).toBe(appleColor); // 다른 자산을 빼도 색이 바뀌지 않음

  await page.getByLabel("비교할 자산 추가").selectOption({ label: "비트코인" });
  await expect(picks).toHaveCount(3);
  await expect(page).toHaveURL(/picks=%5EKS11,AAPL,BTC-USD/);
  await expect(page.locator(".compare .legend button")).toHaveCount(3);
});

test("직접 비교: 최대 8개, 모두 빼면 안내", async ({ page }) => {
  await mockQuotes(page);
  await page.goto("/?cat=custom&picks=" + encodeURIComponent("^KS11,^KQ11,^GSPC,^IXIC,^DJI,^N225,000001.SS"));
  const add = page.getByLabel("비교할 자산 추가");
  await add.selectOption({ label: "테슬라" });
  await expect(page.locator(".pick")).toHaveCount(8);
  await expect(add).toBeDisabled();
  for (let i = 0; i < 8; i++) await page.locator(".pick button").first().click();
  await expect(page.getByText("비교할 자산을 추가하세요.")).toBeVisible();
  await expect(page).toHaveURL(/picks=$/);
});
