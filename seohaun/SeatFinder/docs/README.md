# SeatFinder

취소표 알림 도구. 시외버스·고속버스 잔여석을 주기적으로 조회하고 Telegram 및 Windows 토스트로 알려준다.

---

## 프로젝트 구조

```
SeatFinder/
├── index.js                  # 진입점
├── config.json               # 감시 노선 설정
├── .env                      # Telegram 토큰 (gitignore)
├── .env.example
└── src/
    ├── monitor.js            # 메인 루프 (브라우저 관리 + 반복 체크)
    ├── config.js             # config.json 로더 + 유효성 검사
    ├── checkers/
    │   ├── bustago.js        # 시외버스 (bustago.or.kr)
    │   └── kobus.js          # 고속버스 (kobus.co.kr)
    └── notify/
        ├── format.js         # 알림 메시지 포맷
        ├── telegram.js       # Telegram Bot API
        └── windows.js        # Windows 토스트 (node-notifier)
```

---

## 실행 방법

```bash
# 의존성 설치
npm install

# .env 설정
cp .env.example .env
# TELEGRAM_TOKEN, TELEGRAM_CHAT_ID 입력

# 실행
node index.js
```

---

## config.json

```json
{
  "interval": 60,
  "routes": [
    {
      "site": "bustago",
      "from": "인천공항T1",
      "to": "동대구",
      "date": "2026-06-07",
      "timeRange": { "start": "07:00", "end": "12:00" }
    },
    {
      "site": "kobus",
      "from": "인천",
      "to": "속초",
      "date": "2026-06-12"
    }
  ]
}
```

| 필드 | 설명 |
|------|------|
| `interval` | 체크 주기 (초, 최소 60) |
| `site` | `bustago` 또는 `kobus` |
| `from` / `to` | 터미널 이름 (아래 코드표 참조) |
| `date` | `YYYY-MM-DD` |
| `timeRange` | 선택사항. 이 범위 밖 시간대는 무시 |

---

## 터미널 코드표

### bustago.or.kr (시외버스)

| 터미널 | config 값 |
|--------|-----------|
| 동서울 | `동서울` |
| 인천 | `인천` |
| 인천공항 1터미널 | `인천공항T1` |
| 인천공항 2터미널 | `인천공항T2` |
| 고양종합 | `고양종합` |
| 수원터미널 | `수원터미널` |
| 대전복합 | `대전복합` |
| 대전서부 | `대전서부` |
| 동대구 | `동대구` |
| 대구북부 | `대구북부` |
| 부산동부(노포) | `부산동부(노포)` |
| 부산서부 | `부산서부` |
| 부산해운대 | `부산해운대` |
| 광주(유스퀘어) | `광주(유스퀘어)` |
| 전주 | `전주` |
| 순천 | `순천` |

### kobus.co.kr (고속버스)

| 터미널 | config 값 |
|--------|-----------|
| 서울경부 | `서울경부` |
| 동서울 | `동서울` |
| 센트럴시티(서울) | `센트럴시티(서울)` |
| 인천 | `인천` |
| 인천공항 1터미널 | `인천공항T1` |
| 인천공항 2터미널 | `인천공항T2` |
| 수원 | `수원` |
| 대전복합 | `대전복합` |
| 대구 | `대구` |
| 동대구 | `동대구` |
| 울산 | `울산` |
| 부산 | `부산` |
| 서부산(사상) | `서부산(사상)` |
| 광주 | `광주` |
| 속초 | `속초` |

> 목록에 없는 터미널은 각 `checkers/*.js` 의 `TERMINAL_CODES` 에 직접 추가한다.

---

## 환경변수 (.env)

```
TELEGRAM_TOKEN=<봇 토큰>
TELEGRAM_CHAT_ID=<채팅 ID>
```

Telegram 봇은 [@BotFather](https://t.me/BotFather) 에서 생성.  
채팅 ID는 봇에게 메시지 보낸 뒤 `https://api.telegram.org/bot<TOKEN>/getUpdates` 에서 확인.

---

## 동작 흐름

```
index.js
  └── monitor.runLoop()
        ├── chromium.launch()           # 브라우저 1개 공유
        └── 매 interval마다:
              for each route:
                checker.check(page, route)
                  → 잔여석 있으면 notify()
                        ├── sendTelegram()
                        └── sendWindowsToast()
```

### checker 구조

각 checker는 `async function check(page, route)` 하나만 export한다.  
`page`는 monitor가 열어서 넘겨주고, checker는 닫지 않는다.

**bustago.js**  
UI 조작 없이 `POST /newweb/kr/ticket/ticketListJson3.do` 직접 호출.  
`X-Requested-With: XMLHttpRequest` + `Referer` 헤더 필수.  
응답 필드: `DEP_TIME`(HHMM), `REMAIN_CNT`, `OPENGBN`(2=예매가능, 1=마감)

**kobus.js**  
`kobus.co.kr/main.do` 로드 후 `fnReadDeprInfoList` → `fnDeprChc` → `fnReadArvlInfoList` → `fnArvlChc` → `fnAlcnSrch` 순서로 JS 함수 직접 호출.  
결과 페이지 `p[role="row"][data-time]` 셀렉터로 시간/잔여석 파싱.

---

## 알림 포맷

```
🎉 취소표 발견!
[시외버스] 인천공항T1 → 동대구
날짜: 2026-06-07
시간: 07:20 출발
잔여석: 28석
시간: 08:00 출발
잔여석: 25석
```

---

## 미구현 / 제외

- **korail.com (KTX)**: 세션마다 바뀌는 암호화 URL(`/web_s/...`) + dynaPath 브라우저 핑거프린트 검증(-8003)으로 Playwright 자동화 차단. 우회 불가 판단으로 제외.

---

## 기술 스택

- Node.js 20
- Playwright 1.60 (Chromium)
- node-notifier (Windows 토스트)
- dotenv
