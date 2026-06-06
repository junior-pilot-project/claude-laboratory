# SeatFinder 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 고속버스/시외버스/KTX 취소표를 자동 감지하여 텔레그램 + 윈도우 토스트로 알림을 보내는 모니터링 도구 구현

**Architecture:** Playwright 브라우저 1개를 상시 유지하며 setInterval로 노선 목록을 순회 체크. 잔여석 발견 시 텔레그램 Bot API와 node-notifier로 동시 알림. config.json으로 노선/간격 설정, .env로 텔레그램 토큰 관리.

**Tech Stack:** Node.js 20, Playwright 1.60, node-notifier, dotenv

---

## 파일 구조

| 파일 | 역할 |
|------|------|
| `config.json` | 노선/간격 설정 |
| `.env` | 텔레그램 토큰/채팅ID |
| `index.js` | 진입점: .env 로드 → monitor 시작 |
| `src/config.js` | config.json 로드 및 유효성 검사 |
| `src/monitor.js` | 브라우저 관리 + 폴링 루프 |
| `src/notify/format.js` | 알림 메시지 포맷 생성 |
| `src/notify/telegram.js` | 텔레그램 Bot API 전송 |
| `src/notify/windows.js` | 윈도우 토스트 알림 |
| `src/checkers/kobus.js` | 고속버스 잔여석 확인 |
| `src/checkers/bustago.js` | 시외버스 잔여석 확인 |
| `src/checkers/korail.js` | KTX 잔여석 확인 |
| `tests/config.test.js` | config 유효성 검사 테스트 |
| `tests/format.test.js` | 메시지 포맷 테스트 |

---

## Task 1: 의존성 설치 및 기본 파일 생성

**Files:**
- Create: `config.json`
- Create: `.env.example`
- Create: `index.js`

- [ ] **Step 1: 패키지 설치**

```bash
npm install dotenv node-notifier
npm install --save-dev jest
```

Expected: `node_modules/dotenv`, `node_modules/node-notifier`, `node_modules/jest` 설치됨

- [ ] **Step 2: package.json에 test/start 스크립트 추가**

`package.json`의 `scripts` 섹션을 다음으로 교체:

```json
"scripts": {
  "start": "node index.js",
  "test": "jest"
}
```

- [ ] **Step 3: config.json 생성**

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

- [ ] **Step 4: .env.example 생성**

```
TELEGRAM_TOKEN=your_bot_token_here
TELEGRAM_CHAT_ID=your_chat_id_here
```

- [ ] **Step 5: index.js 생성**

```javascript
require('dotenv').config();
const { runLoop } = require('./src/monitor');

runLoop().catch(err => {
  console.error('[fatal]', err.message);
  process.exit(1);
});
```

- [ ] **Step 6: 커밋**

```bash
git add config.json .env.example index.js package.json package-lock.json
git commit -m "feat: project setup with dependencies and entry point"
```

---

## Task 2: config 로더 구현

**Files:**
- Create: `src/config.js`
- Create: `tests/config.test.js`

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/config.test.js`:

```javascript
const path = require('path');
const { loadConfig } = require('../src/config');

describe('loadConfig', () => {
  it('유효한 config를 로드한다', () => {
    const config = loadConfig(path.join(__dirname, 'fixtures/valid-config.json'));
    expect(config.interval).toBe(60);
    expect(config.routes).toHaveLength(1);
    expect(config.routes[0].site).toBe('kobus');
  });

  it('interval이 60 미만이면 에러를 던진다', () => {
    expect(() =>
      loadConfig(path.join(__dirname, 'fixtures/short-interval-config.json'))
    ).toThrow('interval은 최소 60초');
  });

  it('routes가 비어있으면 에러를 던진다', () => {
    expect(() =>
      loadConfig(path.join(__dirname, 'fixtures/empty-routes-config.json'))
    ).toThrow('routes가 비어있');
  });

  it('알 수 없는 site이면 에러를 던진다', () => {
    expect(() =>
      loadConfig(path.join(__dirname, 'fixtures/unknown-site-config.json'))
    ).toThrow('알 수 없는 사이트');
  });
});
```

- [ ] **Step 2: 테스트 픽스처 파일 4개 생성**

`tests/fixtures/valid-config.json`:
```json
{
  "interval": 60,
  "routes": [{ "site": "kobus", "from": "서울", "to": "부산", "date": "2026-06-10", "timeRange": { "start": "08:00", "end": "14:00" } }]
}
```

`tests/fixtures/short-interval-config.json`:
```json
{ "interval": 30, "routes": [{ "site": "kobus", "from": "서울", "to": "부산", "date": "2026-06-10", "timeRange": { "start": "08:00", "end": "14:00" } }] }
```

`tests/fixtures/empty-routes-config.json`:
```json
{ "interval": 60, "routes": [] }
```

`tests/fixtures/unknown-site-config.json`:
```json
{ "interval": 60, "routes": [{ "site": "unknown", "from": "서울", "to": "부산", "date": "2026-06-10", "timeRange": { "start": "08:00", "end": "14:00" } }] }
```

- [ ] **Step 3: 테스트 실행 → 실패 확인**

```bash
npm test -- tests/config.test.js
```

Expected: FAIL (loadConfig not found)

- [ ] **Step 4: src/config.js 구현**

```javascript
const fs = require('fs');

const VALID_SITES = ['kobus', 'bustago', 'korail'];

function loadConfig(filePath = 'config.json') {
  const raw = fs.readFileSync(filePath, 'utf-8');
  const config = JSON.parse(raw);

  if (!config.interval || config.interval < 60) {
    throw new Error('interval은 최소 60초 이상이어야 합니다');
  }
  if (!Array.isArray(config.routes) || config.routes.length === 0) {
    throw new Error('routes가 비어있습니다. 최소 1개 이상의 노선을 설정하세요');
  }
  for (const route of config.routes) {
    if (!route.site || !route.from || !route.to || !route.date) {
      throw new Error('각 route에는 site, from, to, date가 필요합니다');
    }
    if (!VALID_SITES.includes(route.site)) {
      throw new Error(`알 수 없는 사이트: ${route.site}. 가능한 값: ${VALID_SITES.join(', ')}`);
    }
  }
  return config;
}

module.exports = { loadConfig };
```

- [ ] **Step 5: 테스트 실행 → 통과 확인**

```bash
npm test -- tests/config.test.js
```

Expected: PASS (4 tests)

- [ ] **Step 6: 커밋**

```bash
git add src/config.js tests/config.test.js tests/fixtures/
git commit -m "feat: config loader with validation"
```

---

## Task 3: 알림 메시지 포맷터 구현

**Files:**
- Create: `src/notify/format.js`
- Create: `tests/format.test.js`

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/format.test.js`:

```javascript
const { formatMessage } = require('../src/notify/format');

describe('formatMessage', () => {
  it('고속버스 메시지를 올바르게 포맷한다', () => {
    const route = { from: '서울', to: '부산', date: '2026-06-10' };
    const seats = [{ time: '09:30', count: 2 }];
    const msg = formatMessage('kobus', route, seats);

    expect(msg).toContain('🎉 취소표 발견!');
    expect(msg).toContain('[고속버스] 서울 → 부산');
    expect(msg).toContain('날짜: 2026-06-10');
    expect(msg).toContain('시간: 09:30 출발');
    expect(msg).toContain('잔여석: 2석');
  });

  it('시외버스는 [시외버스]로 표시한다', () => {
    const route = { from: '서울', to: '강릉', date: '2026-06-10' };
    const msg = formatMessage('bustago', route, [{ time: '10:00', count: 1 }]);
    expect(msg).toContain('[시외버스]');
  });

  it('KTX는 [KTX]로 표시한다', () => {
    const route = { from: '서울', to: '부산', date: '2026-06-10' };
    const msg = formatMessage('korail', route, [{ time: '11:00', count: 3 }]);
    expect(msg).toContain('[KTX]');
  });

  it('여러 좌석을 모두 나열한다', () => {
    const route = { from: '서울', to: '대전', date: '2026-06-10' };
    const seats = [{ time: '09:00', count: 1 }, { time: '11:00', count: 2 }];
    const msg = formatMessage('kobus', route, seats);
    expect(msg).toContain('09:00');
    expect(msg).toContain('11:00');
  });
});
```

- [ ] **Step 2: 테스트 실행 → 실패 확인**

```bash
npm test -- tests/format.test.js
```

Expected: FAIL (formatMessage not found)

- [ ] **Step 3: src/notify/format.js 구현**

```javascript
const SITE_NAMES = {
  kobus: '고속버스',
  bustago: '시외버스',
  korail: 'KTX',
};

function formatMessage(site, route, seats) {
  const siteName = SITE_NAMES[site] || site;
  const lines = [
    '🎉 취소표 발견!',
    `[${siteName}] ${route.from} → ${route.to}`,
    `날짜: ${route.date}`,
  ];

  for (const seat of seats) {
    lines.push(`시간: ${seat.time} 출발`);
    lines.push(`잔여석: ${seat.count}석`);
  }

  return lines.join('\n');
}

module.exports = { formatMessage };
```

- [ ] **Step 4: 테스트 실행 → 통과 확인**

```bash
npm test -- tests/format.test.js
```

Expected: PASS (4 tests)

- [ ] **Step 5: 커밋**

```bash
git add src/notify/format.js tests/format.test.js
git commit -m "feat: notification message formatter"
```

---

## Task 4: 텔레그램 + 윈도우 알림 모듈 구현

**Files:**
- Create: `src/notify/telegram.js`
- Create: `src/notify/windows.js`

> **텔레그램 봇 준비:** 구현 전 텔레그램에서 @BotFather로 봇 생성 → 토큰 발급. @userinfobot으로 chat_id 확인. `.env` 파일에 저장.

- [ ] **Step 1: src/notify/telegram.js 구현**

```javascript
async function sendTelegram(token, chatId, message) {
  if (!token || !chatId) {
    throw new Error('TELEGRAM_TOKEN과 TELEGRAM_CHAT_ID가 .env에 설정되어야 합니다');
  }

  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text: message }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`텔레그램 API 오류 (${res.status}): ${body}`);
  }
}

module.exports = { sendTelegram };
```

- [ ] **Step 2: src/notify/windows.js 구현**

```javascript
const notifier = require('node-notifier');

function sendWindowsToast(title, message) {
  notifier.notify({
    title,
    message,
    sound: true,
    wait: false,
  });
}

module.exports = { sendWindowsToast };
```

- [ ] **Step 3: 알림 동작 수동 확인**

임시 테스트 스크립트로 두 알림이 실제로 뜨는지 확인:

```bash
node -e "
require('dotenv').config();
const { sendTelegram } = require('./src/notify/telegram');
const { sendWindowsToast } = require('./src/notify/windows');
sendTelegram(process.env.TELEGRAM_TOKEN, process.env.TELEGRAM_CHAT_ID, '✅ SeatFinder 알림 테스트')
  .then(() => console.log('텔레그램 전송 성공'))
  .catch(e => console.error('텔레그램 실패:', e.message));
sendWindowsToast('SeatFinder', '✅ 윈도우 토스트 테스트');
console.log('윈도우 알림 발송됨');
"
```

Expected: 텔레그램 메시지 수신 + 우측 하단 토스트 팝업 확인

- [ ] **Step 4: 커밋**

```bash
git add src/notify/telegram.js src/notify/windows.js
git commit -m "feat: telegram and windows toast notification modules"
```

---

## Task 5: 모니터 루프 구현

**Files:**
- Create: `src/monitor.js`

- [ ] **Step 1: src/monitor.js 구현**

```javascript
const { chromium } = require('playwright');
const { loadConfig } = require('./config');
const { sendTelegram } = require('./notify/telegram');
const { sendWindowsToast } = require('./notify/windows');
const { formatMessage } = require('./notify/format');

let browser = null;

async function launchBrowser() {
  browser = await chromium.launch({ headless: true });
  console.log('[monitor] 브라우저 시작됨');
}

async function checkRoute(route) {
  // checkers/kobus.js 등이 완성되면 동적으로 로드
  let checker;
  try {
    checker = require(`./checkers/${route.site}`);
  } catch {
    console.error(`[monitor] checker 없음: ${route.site}`);
    return;
  }

  const page = await browser.newPage();
  try {
    console.log(`[monitor] 체크 중: ${route.site} ${route.from}→${route.to} ${route.date}`);
    const seats = await checker.check(page, route);
    if (seats.length > 0) {
      const message = formatMessage(route.site, route, seats);
      console.log(`[monitor] ✅ 잔여석 발견!\n${message}`);
      await notify(message);
    } else {
      console.log(`[monitor] ❌ 잔여석 없음`);
    }
  } catch (err) {
    console.error(`[monitor] 체크 실패 (${route.site}): ${err.message}`);
  } finally {
    await page.close();
  }
}

async function notify(message) {
  const { TELEGRAM_TOKEN, TELEGRAM_CHAT_ID } = process.env;

  await Promise.allSettled([
    sendTelegram(TELEGRAM_TOKEN, TELEGRAM_CHAT_ID, message)
      .catch(e => console.error('[notify] 텔레그램 실패:', e.message)),
    Promise.resolve(sendWindowsToast('SeatFinder', message)),
  ]);
}

async function runLoop() {
  const config = loadConfig();
  const intervalMs = Math.max(60, config.interval) * 1000;

  await launchBrowser();

  const tick = async () => {
    if (!browser || !browser.isConnected()) {
      console.log('[monitor] 브라우저 재시작 중...');
      await launchBrowser();
    }
    for (const route of config.routes) {
      await checkRoute(route);
    }
    console.log(`[monitor] 다음 체크: ${config.interval}초 후`);
  };

  await tick();
  setInterval(tick, intervalMs);
}

module.exports = { runLoop };
```

- [ ] **Step 2: 커밋**

```bash
git add src/monitor.js
git commit -m "feat: monitor loop with browser management and crash recovery"
```

---

## Task 6: 고속버스(kobus.co.kr) checker 구현

**Files:**
- Create: `src/checkers/kobus.js`

> **사전 작업:** 브라우저로 kobus.co.kr에 접속하여 출발지/도착지 선택 모달의 실제 셀렉터를 개발자 도구로 확인. 아래 셀렉터는 2026-06-06 기준이며 사이트 업데이트 시 변경될 수 있음.

- [ ] **Step 1: kobus.co.kr 셀렉터 사전 조사**

브라우저로 kobus.co.kr 접속 후 개발자 도구(F12)로 다음 요소의 셀렉터 확인:
- 출발지 입력 버튼
- 도착지 입력 버튼
- 날짜 선택 input
- 조회 버튼
- 결과 목록에서 잔여석 표시 요소

- [ ] **Step 2: src/checkers/kobus.js 구현**

```javascript
/**
 * 고속버스 잔여석 확인
 * @param {import('playwright').Page} page
 * @param {{ from: string, to: string, date: string, timeRange: { start: string, end: string } }} route
 * @returns {Promise<Array<{ time: string, count: number }>>} 잔여석 있는 시간대 목록
 */
async function check(page, route) {
  await page.goto('https://www.kobus.co.kr/main.do', {
    waitUntil: 'domcontentloaded',
    timeout: 30000,
  });

  // 출발지 선택 모달 열기
  await page.click('#startPoint');
  await page.waitForSelector('.layer_wrap', { timeout: 5000 });

  // 출발지 검색 후 선택
  await page.fill('#startPointSearch', route.from);
  await page.click(`.startPointList li:has-text("${route.from}")`);

  // 도착지 선택 모달 열기
  await page.click('#destPoint');
  await page.waitForSelector('.layer_wrap', { timeout: 5000 });

  // 도착지 검색 후 선택
  await page.fill('#destPointSearch', route.to);
  await page.click(`.destPointList li:has-text("${route.to}")`);

  // 날짜 설정 (YYYYMMDD 형식으로 변환)
  const dateFormatted = route.date.replace(/-/g, '');
  await page.evaluate((date) => {
    document.querySelector('#s_date').value = date;
  }, dateFormatted);

  // 조회 버튼 클릭
  await page.click('#btnSearch');
  await page.waitForSelector('.result_wrap, .no_result', { timeout: 15000 });

  // 결과 없음 체크
  const noResult = await page.$('.no_result');
  if (noResult) return [];

  // 결과에서 잔여석 있는 시간대 추출
  const rows = await page.$$('.result_wrap .bus_item');
  const seats = [];

  for (const row of rows) {
    const timeText = await row.$eval('.dep_time', el => el.textContent.trim()).catch(() => null);
    const seatText = await row.$eval('.seat_num', el => el.textContent.trim()).catch(() => null);

    if (!timeText || !seatText) continue;

    const count = parseInt(seatText.replace(/[^0-9]/g, ''), 10);
    if (isNaN(count) || count === 0) continue;

    // 시간대 필터링
    if (route.timeRange) {
      if (timeText < route.timeRange.start || timeText > route.timeRange.end) continue;
    }

    seats.push({ time: timeText, count });
  }

  return seats;
}

module.exports = { check };
```

> **중요:** 위 셀렉터(`#startPoint`, `.startPointList`, `.result_wrap` 등)는 실제 사이트 구조를 확인 후 수정 필요. 개발자 도구로 실제 class명/id를 확인하여 교체.

- [ ] **Step 3: 수동 테스트 실행**

```bash
node -e "
require('dotenv').config();
const { chromium } = require('playwright');
const kobus = require('./src/checkers/kobus');

(async () => {
  const browser = await chromium.launch({ headless: false }); // 화면 보이게
  const page = await browser.newPage();
  const route = {
    from: '서울',
    to: '부산',
    date: '2026-06-15',
    timeRange: { start: '08:00', end: '14:00' }
  };
  const seats = await kobus.check(page, route);
  console.log('결과:', seats);
  await browser.close();
})();
"
```

Expected: 잔여석 배열 또는 빈 배열 `[]` 출력. 셀렉터 오류 발생 시 에러 메시지 확인 후 실제 셀렉터로 수정.

- [ ] **Step 4: 커밋**

```bash
git add src/checkers/kobus.js
git commit -m "feat: kobus.co.kr seat availability checker"
```

---

## Task 7: 전체 통합 실행 테스트

**Files:** 없음 (통합 테스트)

- [ ] **Step 1: .env 파일 생성**

```
TELEGRAM_TOKEN=실제_봇_토큰
TELEGRAM_CHAT_ID=실제_채팅_ID
```

- [ ] **Step 2: config.json에 실제 노선 설정**

```json
{
  "interval": 60,
  "routes": [
    {
      "site": "kobus",
      "from": "서울",
      "to": "부산",
      "date": "2026-06-15",
      "timeRange": { "start": "08:00", "end": "14:00" }
    }
  ]
}
```

- [ ] **Step 3: 실행 및 확인**

```bash
npm start
```

Expected:
- `[monitor] 브라우저 시작됨` 출력
- `[monitor] 체크 중: kobus 서울→부산 2026-06-15` 출력
- 잔여석 있으면 텔레그램 알림 + 윈도우 토스트 팝업
- 60초 후 재체크

- [ ] **Step 4: 커밋**

```bash
git add .env.example
git commit -m "feat: complete kobus monitoring pipeline"
```

---

## Task 8: 시외버스(bustago.or.kr) checker 구현

**Files:**
- Create: `src/checkers/bustago.js`

> **사전 작업:** bustago.or.kr 접속 후 개발자 도구로 터미널 선택 모달 및 결과 셀렉터 확인.

- [ ] **Step 1: src/checkers/bustago.js 구현**

```javascript
/**
 * 시외버스 잔여석 확인
 * @param {import('playwright').Page} page
 * @param {{ from: string, to: string, date: string, timeRange: { start: string, end: string } }} route
 * @returns {Promise<Array<{ time: string, count: number }>>}
 */
async function check(page, route) {
  await page.goto('https://www.bustago.or.kr/newweb/kr/main/index.do', {
    waitUntil: 'domcontentloaded',
    timeout: 30000,
  });

  // 출발지 버튼 클릭 → 모달 열기
  await page.click('#startTerminal');
  await page.waitForSelector('.terminal_popup', { timeout: 5000 });

  // 출발지 검색 및 선택
  await page.fill('.terminal_popup input[type=text]', route.from);
  await page.click(`.terminal_popup .result_list li:has-text("${route.from}")`);

  // 도착지 버튼 클릭 → 모달 열기
  await page.click('#arriveTerminal');
  await page.waitForSelector('.terminal_popup', { timeout: 5000 });

  // 도착지 검색 및 선택
  await page.fill('.terminal_popup input[type=text]', route.to);
  await page.click(`.terminal_popup .result_list li:has-text("${route.to}")`);

  // 날짜 설정
  const dateFormatted = route.date.replace(/-/g, '');
  await page.evaluate((date) => {
    document.querySelector('#depDate').value = date;
  }, dateFormatted);

  // 조회 버튼 클릭
  await page.click('#btnSearch');
  await page.waitForSelector('.schedule_list, .no_data', { timeout: 15000 });

  const noData = await page.$('.no_data');
  if (noData) return [];

  const rows = await page.$$('.schedule_list .item');
  const seats = [];

  for (const row of rows) {
    const timeText = await row.$eval('.dep_time', el => el.textContent.trim()).catch(() => null);
    const seatText = await row.$eval('.seat_cnt', el => el.textContent.trim()).catch(() => null);

    if (!timeText || !seatText) continue;

    const count = parseInt(seatText.replace(/[^0-9]/g, ''), 10);
    if (isNaN(count) || count === 0) continue;

    if (route.timeRange) {
      if (timeText < route.timeRange.start || timeText > route.timeRange.end) continue;
    }

    seats.push({ time: timeText, count });
  }

  return seats;
}

module.exports = { check };
```

- [ ] **Step 2: 수동 테스트**

```bash
node -e "
const { chromium } = require('playwright');
const bustago = require('./src/checkers/bustago');
(async () => {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  const seats = await bustago.check(page, {
    from: '서울', to: '강릉', date: '2026-06-15',
    timeRange: { start: '08:00', end: '18:00' }
  });
  console.log('결과:', seats);
  await browser.close();
})();
"
```

- [ ] **Step 3: 커밋**

```bash
git add src/checkers/bustago.js
git commit -m "feat: bustago.or.kr seat availability checker"
```

---

## Task 9: KTX(korail.com) checker 구현

**Files:**
- Create: `src/checkers/korail.js`

> korail.com은 완전 SPA(AJAX)이므로 `waitForResponse`로 API 응답을 기다려야 함.

- [ ] **Step 1: src/checkers/korail.js 구현**

```javascript
/**
 * KTX 잔여석 확인
 * @param {import('playwright').Page} page
 * @param {{ from: string, to: string, date: string, timeRange: { start: string, end: string } }} route
 * @returns {Promise<Array<{ time: string, count: number }>>}
 */
async function check(page, route) {
  await page.goto('https://www.korail.com/ticket/search/searchTrainList', {
    waitUntil: 'domcontentloaded',
    timeout: 30000,
  });

  // 출발역 입력
  await page.fill('#txtDptRsStnCdNm', route.from);
  await page.click(`.station_list li:has-text("${route.from}")`);

  // 도착역 입력
  await page.fill('#txtArvRsStnCdNm', route.to);
  await page.click(`.station_list li:has-text("${route.to}")`);

  // 날짜 설정 (YYYYMMDD 형식)
  const dateFormatted = route.date.replace(/-/g, '');
  await page.evaluate((date) => {
    document.querySelector('#txtDptDt').value = date;
  }, dateFormatted);

  // 조회 버튼 클릭 → AJAX 응답 대기
  await Promise.all([
    page.waitForResponse(res =>
      res.url().includes('searchTrainList') && res.status() === 200,
      { timeout: 15000 }
    ),
    page.click('#btnSearch'),
  ]);

  await page.waitForSelector('.train_list, .no_result_wrap', { timeout: 10000 });

  const noResult = await page.$('.no_result_wrap');
  if (noResult) return [];

  const rows = await page.$$('.train_list .train_row');
  const seats = [];

  for (const row of rows) {
    const timeText = await row.$eval('.dpt_time', el => el.textContent.trim()).catch(() => null);
    const seatEl = await row.$('.seat_num:not(.sold_out)');
    if (!timeText || !seatEl) continue;

    const seatText = await seatEl.textContent();
    const count = parseInt(seatText.replace(/[^0-9]/g, ''), 10);
    if (isNaN(count) || count === 0) continue;

    if (route.timeRange) {
      if (timeText < route.timeRange.start || timeText > route.timeRange.end) continue;
    }

    seats.push({ time: timeText, count });
  }

  return seats;
}

module.exports = { check };
```

- [ ] **Step 2: 수동 테스트**

```bash
node -e "
const { chromium } = require('playwright');
const korail = require('./src/checkers/korail');
(async () => {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  const seats = await korail.check(page, {
    from: '서울', to: '부산', date: '2026-06-15',
    timeRange: { start: '08:00', end: '14:00' }
  });
  console.log('결과:', seats);
  await browser.close();
})();
"
```

- [ ] **Step 3: 커밋**

```bash
git add src/checkers/korail.js
git commit -m "feat: korail.com KTX seat availability checker"
```

---

## Task 10: 전체 테스트 실행 및 마무리

- [ ] **Step 1: 전체 테스트 통과 확인**

```bash
npm test
```

Expected: PASS (config + format 테스트 전부 통과)

- [ ] **Step 2: config.json에 3개 사이트 모두 추가하여 통합 실행**

```json
{
  "interval": 60,
  "routes": [
    { "site": "kobus", "from": "서울", "to": "부산", "date": "2026-06-15", "timeRange": { "start": "08:00", "end": "14:00" } },
    { "site": "bustago", "from": "서울", "to": "강릉", "date": "2026-06-15", "timeRange": { "start": "09:00", "end": "18:00" } },
    { "site": "korail", "from": "서울", "to": "부산", "date": "2026-06-15", "timeRange": { "start": "08:00", "end": "14:00" } }
  ]
}
```

- [ ] **Step 3: npm start로 3개 노선 동시 모니터링 확인**

```bash
npm start
```

Expected: 3개 노선 순차 체크 → 60초 후 반복

- [ ] **Step 4: 최종 커밋**

```bash
git add config.json
git commit -m "feat: complete SeatFinder with all three transport checkers"
```
