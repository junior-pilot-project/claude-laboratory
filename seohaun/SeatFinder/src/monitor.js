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
