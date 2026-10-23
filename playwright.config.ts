import { defineConfig, devices } from "@playwright/test";

// 단위 테스트(Node)도 브라우저와 같은 시간대로 — 구간 경계가 현지 시간 기준
process.env.TZ = "Asia/Seoul";

const PORT = 3200;
// 로컬에서는 설치된 Chrome 사용, CI에서는 `npx playwright install chromium`으로 받은 Chromium 사용
const channel = process.env.CI ? undefined : "chrome";

export default defineConfig({
  testDir: "tests",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    locale: "ko-KR",
    timezoneId: "Asia/Seoul", // 구간(일·주·연) 경계가 브라우저 현지 시간 기준이라 고정
    trace: "retain-on-failure",
  },
  projects: [
    { name: "unit", testMatch: /unit\/.*\.spec\.ts/ },
    {
      name: "desktop",
      testMatch: /e2e\/.*\.spec\.ts/,
      testIgnore: /mobile\.spec\.ts/,
      use: { ...devices["Desktop Chrome"], channel },
    },
    { name: "mobile", testMatch: /e2e\/mobile\.spec\.ts/, use: { ...devices["Pixel 7"], channel } },
  ],
  // 배포와 같은 프로덕션 빌드로 검증 (E2E는 /api/quotes를 모킹하므로 Yahoo에 의존하지 않음)
  webServer: {
    command: `npm run build && npm run start -- -p ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 240_000,
  },
});
