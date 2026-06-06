# SeatFinder 설계 스펙

- **날짜:** 2026-06-06
- **상태:** 승인됨

---

## 개요

버스(고속/시외) 및 KTX 취소표를 자동 감지하여 텔레그램 + 윈도우 토스트로 알림을 보내는 Node.js + Playwright 기반 모니터링 도구.

---

## 아키텍처

### 디렉토리 구조

```
SeatFinder/
├── config.json              # 모니터링 노선/간격 설정
├── .env                     # 텔레그램 토큰/채팅ID (git 제외)
├── index.js                 # 진입점
├── src/
│   ├── monitor.js           # 브라우저 유지 + 폴링 루프
│   ├── checkers/
│   │   ├── kobus.js         # 고속버스 잔여석 확인
│   │   ├── bustago.js       # 시외버스 잔여석 확인
│   │   └── korail.js        # KTX 잔여석 확인
│   └── notify/
│       ├── telegram.js      # 텔레그램 Bot API 알림
│       └── windows.js       # 윈도우 토스트 알림
└── docs/
    ├── requirements.md
    └── daily/               # 날짜별 작업 요약
```

---

## 핵심 설계 결정

### 브라우저 상시 유지 방식 채택

Playwright 브라우저를 1개만 실행하고 계속 유지. 매 체크마다 새 페이지(탭)를 열어 확인 후 닫음. 브라우저 자체는 살아있으므로 매번 재실행하는 것보다 빠름.

크래시 감지: `browser.isConnected()` 체크 → 연결 끊기면 자동 재시작.

### 멀티 노선 동시 모니터링

`config.json`의 `routes` 배열을 순회하며 각 노선을 순차 체크. 간격은 `interval`(초) 설정값 사용, 최소 60초 강제.

---

## 데이터 흐름

```
index.js 실행
    → config.json 로드
    → monitor.js 시작
        → Playwright 브라우저 실행 (1회)
        → setInterval(interval초마다)
            → 각 route에 대해 checker 호출
                → 잔여석 있음?
                    → YES: telegram.js + windows.js 동시 알림
                    → NO: 대기
```

---

## config.json 구조

```json
{
  "interval": 60,
  "routes": [
    {
      "site": "kobus",
      "from": "서울",
      "to": "부산",
      "date": "2026-06-10",
      "timeRange": { "start": "08:00", "end": "14:00" }
    }
  ]
}
```

---

## 알림 메시지 형식

```
🎉 취소표 발견!
[고속버스] 서울 → 부산
날짜: 2026-06-10
시간: 09:30 출발
잔여석: 2석
```

---

## 에러 처리

| 상황 | 처리 방법 |
|------|-----------|
| 브라우저 크래시 | 감지 후 자동 재시작 |
| 페이지 로딩 실패 | 해당 회차 스킵, 다음 인터벌에 재시도 |
| 텔레그램 전송 실패 | 콘솔 에러 출력 후 윈도우 알림만 발송 |
| 잘못된 config | 실행 즉시 에러 메시지 출력 후 종료 |

---

## 구현 순서

1. `config.json` + `.env` 구조 정의
2. `monitor.js` — 브라우저 관리 + 폴링 루프
3. `checkers/kobus.js` — 고속버스 (1순위)
4. `notify/telegram.js` + `notify/windows.js`
5. `checkers/bustago.js` — 시외버스 (2순위)
6. `checkers/korail.js` — KTX (3순위)
