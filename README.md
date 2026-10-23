# SIGMA

**S**ignals & **I**ndicators for **G**lobal **M**arket **A**nalysis — 환율 · 원자재 · 주가지수 · 금리 등 주요 시장 지표를 한눈에 보는 실시간 대시보드.

- Next.js (App Router) + TypeScript, 외부 UI 라이브러리 없음
- 데이터: Yahoo Finance 차트 API (API 키 불필요), `/api/quotes`에서 서버 측 조회
- Vercel CDN 캐시 (1일 30초 ~ 장기 1시간, `lib/ranges.ts`) + 클라이언트 30초 자동 갱신
- 기간 선택: 1일 · 1주 · 1년 · 3년 · 10년 (등락은 기간 시작 대비)
- 구간 확대: 1주는 일별, 1년·3년은 주별, 10년은 연도별로 골라 해당 구간만 더 촘촘한 데이터로 보기
- 토·일(거래소 현지 시각 기준) 데이터는 제외하고, 차트에서도 주말 구간을 접어서 표시
- 비교 보기: 같은 카테고리 자산을 기간 시작 대비 등락률(%)로 한 그래프에 겹쳐 비교 (범례 클릭으로 숨김, 등락 폭 차이가 크면 로그 축)
- 한국식 색상 표기 (상승 빨강 / 하락 파랑), 다크 모드 · 모바일 대응

## 로컬 실행

```bash
npm install
npm run dev   # http://localhost:3000
```

## 지표 추가/변경

`lib/symbols.ts`의 `SYMBOLS` 배열에 Yahoo Finance 티커를 추가하면 됩니다.

## 배포

1. GitHub에 저장소를 만들고 push
2. https://vercel.com/new 에서 해당 저장소 Import → Deploy (설정 변경 불필요)

> 시세는 거래소 사정에 따라 지연될 수 있으며 투자 판단의 근거로 사용할 수 없습니다.
