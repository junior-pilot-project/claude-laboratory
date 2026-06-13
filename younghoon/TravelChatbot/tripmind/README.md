# TripMind ✈️
> AI와 대화하며 찾는 나만의 여행지

Claude AI와 자연스럽게 대화하면서 현재 시즌·예산·여행 스타일에 맞는 여행지를 추천받고,
실시간 항공권 최저가까지 확인할 수 있는 AI 여행 플래너입니다.

## 시작하기

```bash
git clone <repo-url>
cd tripmind

# 의존성 설치
npm run install:all

# 환경변수 설정
cp .env.example .env
# .env 파일을 열어 API 키 입력

# 개발 서버 실행 (서버 3001 + 클라이언트 5173)
npm run dev
```

브라우저에서 `http://localhost:5173` 접속

## 환경변수 설정

| 변수명 | 필수 | 설명 |
|--------|------|------|
| ANTHROPIC_API_KEY | ✅ | [Anthropic Console](https://console.anthropic.com)에서 발급 |
| AMADEUS_API_KEY | 선택 | 항공권 실시간 조회용 (없으면 Mock 데이터 사용) |
| AMADEUS_API_SECRET | 선택 | Amadeus 인증 시크릿 |

## 주요 기능

- **AI 대화 추천** — Claude와 자연스러운 대화로 여행지 발견, 스트리밍 응답
- **시즌·예산 매칭** — 현재 시즌 날씨, 예산, 여행 스타일 종합 고려
- **상세 정보** — 관광명소 Top 5, 맛집 추천, 즐길거리, 예상 경비
- **항공권 조회** — Amadeus API 연동 (없을 경우 Mock 데이터 fallback)
- **대화 복원** — 새로고침 후 localStorage에서 이전 대화 자동 복원
- **슬래시 커맨드** — `/다시추천`, `/예산변경`, `/새대화`

## 프로젝트 구조

```
tripmind/
├── server/
│   ├── index.js          # Express 서버 (PORT 3001)
│   ├── routes/
│   │   ├── chat.js       # Claude SSE 스트리밍 프록시
│   │   └── flights.js    # 항공권 API (Amadeus + Mock)
│   └── data/
│       └── destinations.json  # 여행지 데이터 (20개)
├── client/
│   ├── src/
│   │   ├── App.jsx
│   │   ├── store/chatStore.js  # Zustand 상태 관리
│   │   ├── components/         # 9개 컴포넌트
│   │   └── styles/index.css    # Tailwind + 커스텀 애니메이션
│   └── vite.config.js
├── vercel.json
└── package.json
```

## 배포 (Vercel)

```bash
# Vercel CLI 설치
npm i -g vercel

# 배포 (환경변수 함께 설정)
vercel --env ANTHROPIC_API_KEY=your_key_here

# 또는 Vercel 대시보드에서 Environment Variables 설정 후:
vercel --prod
```

## 빌드 확인

```bash
npm run check
```

빌드 성공 시 `✅ TripMind MVP 완성!` 출력
