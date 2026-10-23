import { expect, mockQuotes, test } from "./mock";

test("모바일: 가로 넘침 없이 보기·기간 버튼이 화면 안에 보임", async ({ page }) => {
  await mockQuotes(page);
  await page.goto("/?range=1w");
  await expect(page.locator(".card:not(.skeleton)").first()).toBeVisible();
  const width = page.viewportSize()!.width;
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  for (const name of ["비교", "10년"]) {
    const box = (await page.getByRole("button", { name, exact: true }).boundingBox())!;
    expect(box.x + box.width).toBeLessThanOrEqual(width);
  }
});

test("모바일: 차트를 탭하면 툴팁이 뜨고 손을 떼도 유지", async ({ page }) => {
  await mockQuotes(page);
  await page.goto("/?view=compare&cat=stock&range=1y");
  const plot = page.locator(".compare-plot svg rect").last();
  await plot.scrollIntoViewIfNeeded();
  await plot.tap({ position: { x: 120, y: 60 } });
  await expect(page.locator(".compare-tip")).toBeVisible();
  await expect(page.locator(".compare-tip .tip-row")).toHaveCount(3);
});

test("모바일: 선택한 날짜 칩이 가로 스크롤 영역 안에 보임", async ({ page }) => {
  await mockQuotes(page);
  await page.goto("/?range=1w");
  const chips = page.locator(".segment-chips button");
  await chips.last().click();
  await page.waitForTimeout(600); // 부드러운 스크롤
  const area = (await page.locator(".segment-chips").boundingBox())!;
  const chip = (await page.locator(".segment-chips button.active").boundingBox())!;
  expect(chip.x).toBeGreaterThanOrEqual(area.x - 1);
  expect(chip.x + chip.width).toBeLessThanOrEqual(area.x + area.width + 1);
});
