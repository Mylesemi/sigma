# eSignal

환율 · 원자재 · 주가지수 · 금리 등 주요 시장 지표를 한눈에 보는 실시간 대시보드.

- Next.js (App Router) + TypeScript, 외부 UI 라이브러리 없음
- 데이터: Yahoo Finance 차트 API (API 키 불필요), `/api/quotes`에서 서버 측 조회
- Vercel CDN 30초 캐시 (`s-maxage=30`) + 클라이언트 30초 자동 갱신
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
