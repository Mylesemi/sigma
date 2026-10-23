# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 프로젝트 개요

SIGMA (Signals & Indicators for Global Market Analysis) — 환율 · 원자재 · 주가지수 · 금리 등 시장 지표를 보여주는 실시간 대시보드. Next.js App Router + React 19 + TypeScript (strict). 외부 UI/차트 라이브러리 없이 순수 CSS와 직접 그린 SVG만 사용한다. Vercel 배포를 전제로 한다(별도 설정 불필요).

## 명령어

```bash
npm install
npm run dev        # http://localhost:3000
npm run build      # 프로덕션 빌드 (타입 체크 포함)
npm run typecheck  # 빠른 타입 체크
npm test           # Playwright: 단위 + E2E(데스크톱·모바일). 프로덕션 빌드를 3200 포트에 띄워 검증
npm run test:unit  # lib 단위 테스트만
npx playwright test -g "직접 비교"          # 이름으로 테스트 하나만
npx playwright test --project=mobile        # 프로젝트(unit·desktop·mobile) 하나만
```

lint는 설정되어 있지 않다. CI(`.github/workflows/ci.yml`)는 push·PR마다 typecheck와 `npm test`를 돈다.

## 테스트

- E2E는 `/api/quotes`를 `tests/e2e/mock.ts`로 모킹한다(가짜 시세는 `tests/fixtures/quotes.ts`가 `SYMBOLS`로 생성) — Yahoo 상태와 무관하게 결정적이다. 실제 Yahoo 응답은 테스트하지 않으므로 데이터 처리(`lib/quotes.ts`)를 바꾸면 실제 API로 직접 확인한다.
- E2E의 `test`/`expect`는 `@playwright/test`가 아니라 `./mock`에서 가져온다 — 콘솔 오류·페이지 예외가 하나라도 있으면 실패시키는 자동 fixture가 붙어 있다.
- 로컬은 설치된 Chrome(`channel: "chrome"`), CI는 Chromium을 쓴다. 시간대는 `Asia/Seoul`로 고정(구간 경계가 현지 시간 기준).

## 아키텍처

데이터 흐름: `lib/symbols.ts` → `lib/quotes.ts` → `app/api/quotes/route.ts?range=<1d|1w|1y|3y|10y>[&from=&to=]` → `components/Dashboard.tsx` (클라이언트)

- **`lib/symbols.ts`** — 표시할 지표의 단일 정의 소스. `SYMBOLS`(Yahoo Finance 티커, 표시명, 카테고리, 소수 자릿수 `digits`)와 `CATEGORIES`(섹션 순서·제목). 지표 추가/변경은 여기만 고치면 된다. 새 카테고리는 `Category` 타입과 `CATEGORIES` 둘 다 수정해야 한다.
- **`lib/ranges.ts`** — 조회 기간 정의(`RANGES`: 일수, Yahoo 봉 간격, CDN 캐시 시간, 하위 구간 단위 `segment`). 클라이언트와 서버가 공유하므로 서버 전용 코드를 넣지 않는다. 하위 구간(1주→일, 1년·3년→주, 10년→연) 목록은 `buildSegments`가 전체 기간 응답의 실제 데이터 시각으로 만들고(브라우저 현지 시간 기준), 확대 조회의 봉 간격은 `segmentQuery`가 정한다. Yahoo는 분봉을 최근 60일, 1시간봉을 최근 730일까지만 준다.
- **`lib/quotes.ts`** — 서버 전용. 심볼마다 Yahoo Finance chart API(`v8/finance/chart`, API 키 불필요)를 병렬 호출해 `Quote`로 정규화한다. 1일은 `range=1d`, 그 외 기간은 `period1/period2`를 쓴다(Yahoo의 `range`는 `3y`를 지원하지 않음). 등락 기준은 기간 시작 직전 종가인 `chartPreviousClose`, `high`/`low`는 1일이면 당일 고저, 그 외에는 기간 내 고저다. 개별 심볼 실패는 throw하지 않고 `error` 필드가 채워진 빈 `Quote`로 반환 → 일부 실패해도 응답 전체는 성공한다. 장기 기간 데이터가 없는 심볼(예: `CNYKRW=X`)이나 휴장 구간도 `error`로 처리한다. Yahoo 장기 데이터에는 자릿수가 틀린 값(예: USD/KRW 0.1154)이 섞여 있어 `dropSpikes`로 이웃 중앙값 대비 크게 벗어난 점을 제외한다. `from/to` 구간 조회에서는 `price`가 현재가가 아니라 구간 마지막 종가다. 1일 기간을 제외한 분봉·일봉에서는 토·일 데이터를 뺀다 — 주말 판정은 거래소 현지 시각(`meta.gmtoffset`) 기준이라 미국 금요일 장(한국 토요일 새벽)은 남는다. 주봉·월봉은 봉 날짜가 주말일 수 있어 제외하지 않는다.
- **`app/api/quotes/route.ts`** — `force-dynamic` 라우트지만 기간별 `cacheSec`로 `s-maxage`를 걸어 Vercel CDN이 캐시한다. `from/to`는 검증(최대 1년 길이, 11년 이내) 후 무효하면 무시한다. 클라이언트는 `cache: "no-store"`로 요청한다 — 그렇지 않으면 브라우저가 `stale-while-revalidate`로 오래된 시세를 보여준다.
- **`lib/urlState.ts`** — 화면 상태(카테고리 `cat`, `range`, `view`, 구간 `seg`, 직접 비교 `picks`)와 URL 쿼리 간 변환. 기본값은 생략하고, 잘못된 값은 기본값으로 정리한다. Dashboard는 첫 진입 때 URL을 읽고(그 전에는 조회하지 않음), 사용자 조작은 `pushState`로 쌓으며(뒤로 가기 지원), 첫 진입의 주소 정리만 `replaceState`로 한다.
- **`components/Dashboard.tsx`** — 선택한 기간으로 `/api/quotes`를 30초마다 폴링(탭이 보일 때만, 탭 복귀 시 즉시 갱신). 상단 티커 스트립은 하드코딩된 `TICKER` 배열의 심볼을 `SYMBOLS`에서 찾아 표시하므로, 심볼을 삭제·변경할 때 여기도 맞춰야 한다. 카테고리 필터(+ "직접 비교": `PickList`로 카테고리 무관하게 최대 8개), 기간·하위 구간 선택(`SegmentPicker`, 12개 초과면 `<select>`) 포함. 응답은 `range`+`window.from` 키가 현재 선택과 맞을 때만 반영하고(늦게 도착한 응답 무시), 전환 중에는 이전 데이터를 흐리게 유지한다. 끝난 과거 구간은 자동 갱신하지 않는다.
- **`components/CompareChart.tsx`** — "비교" 보기. 카테고리별로 모든 자산을 기간 시작 대비 등락률(%)로 정규화해 한 그래프·한 y축에 겹쳐 그린다. x축은 실제 시각(`Quote.times`)이라 거래 시간이 다른 시장은 서로 다른 구간에 그려지고, 툴팁은 각 자산의 해당 시각 직전 값을 보여준다. 계열 색은 `--s1`~`--s8`(globals.css, 색각이상 대비 검증된 고정 순서)이며 카테고리 내 심볼 순서로 고정된다 — 숨김/오류로 다시 칠하지 않는다. 직접 비교는 `slots` prop으로 자산을 추가한 시점의 슬롯을 넘겨, 다른 자산을 빼도 남은 자산의 색이 바뀌지 않는다. 한 카테고리 심볼은 8개를 넘기지 않는다. 축 눈금 단위는 데이터가 덮는 시간 길이로 정하고(달력 경계 정렬), 배율 차이가 4배를 넘으면 자동으로 로그 축이 된다. 데이터가 없는 긴 간격(주말·휴장, 중앙 간격의 6배이자 3시간 초과)은 x축에서 접고 점선으로 표시한다(`gapCompressor`) — 그래서 호버 스냅은 시간이 아닌 픽셀 거리로 한다. `ErrorBoundary`로 감싸 차트 오류가 페이지 전체를 멈추지 않게 한다.
- **`components/QuoteCard.tsx`** — 가격 변동 시 flash 애니메이션, `digits`로 숫자 포맷(`ko-KR`). **`Sparkline.tsx`** — 전일 종가 기준선을 포함한 인라인 SVG.

## 규칙

- 한국식 색상 표기: **상승 = 빨강(`--up`), 하락 = 파랑(`--down`)**. CSS 변수는 `app/globals.css`의 `:root`에 있고 `prefers-color-scheme: dark`에서 재정의된다. 새 색상도 이 토큰 방식을 따른다.
- UI 문구와 코드 주석은 한국어.
- import는 `@/*` 경로 별칭(프로젝트 루트 기준)을 사용한다.
