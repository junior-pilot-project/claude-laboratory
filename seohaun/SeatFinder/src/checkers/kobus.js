/**
 * 고속버스 잔여석 확인 (kobus.co.kr)
 *
 * 터미널 코드 예시:
 *   서울경부: 010 | 동서울: 032 | 센트럴시티(서울): 021
 *   부산: 700 | 서부산(사상): 703 | 대전복합: 305 | 광주: 500
 *
 * config.json route 예시:
 *   { "site": "kobus", "from": "서울경부", "to": "부산", ... }
 *   from/to 값이 터미널 이름과 정확히 일치해야 합니다.
 *
 * @param {import('playwright').Page} page
 * @param {{ from: string, to: string, date: string, timeRange?: { start: string, end: string } }} route
 * @returns {Promise<Array<{ time: string, count: number }>>}
 */

// 주요 터미널 이름 → 코드 매핑
const TERMINAL_CODES = {
  '서울경부': '010',
  '동서울': '032',
  '센트럴시티(서울)': '021',
  '부산': '700',
  '서부산(사상)': '703',
  '대전복합': '305',
  '광주': '500',
  '대구': '800',
  '동대구': '801',
  '울산': '850',
  '수원': '160',
  '인천': '100',
  '속초': '230',
  '인천공항T1': '105',
  '인천공항T2': '117',
};

async function check(page, route) {
  const fromCode = TERMINAL_CODES[route.from];
  const toCode = TERMINAL_CODES[route.to];

  if (!fromCode || !toCode) {
    throw new Error(`터미널 코드를 찾을 수 없습니다: ${route.from}(${fromCode}) → ${route.to}(${toCode}). TERMINAL_CODES에 추가하세요.`);
  }

  await page.goto('https://www.kobus.co.kr/main.do', {
    waitUntil: 'networkidle',
    timeout: 30000,
  });
  await page.waitForTimeout(1500);

  // 공지 팝업 숨기기
  await page.evaluate(() => {
    document.querySelectorAll('.noti_pop_wrap,.main_pop,[class*=pop_wrap],.pop_dimmed').forEach(el => {
      el.style.display = 'none';
      el.style.pointerEvents = 'none';
    });
  });

  // 출발지 선택
  await page.evaluate(() => fnReadDeprInfoList({ preventDefault: () => {} }));
  await page.waitForTimeout(400);
  await page.evaluate(([code, name]) => fnDeprChc(code, name), [fromCode, route.from]);
  await page.waitForTimeout(400);

  // 도착지 선택
  await page.evaluate(() => fnReadArvlInfoList({ preventDefault: () => {} }));
  await page.waitForTimeout(400);

  // 도착지는 실제 onclick 파라미터가 6개 (코드, 이름, N, '', '', 거리)
  // 거리값은 알 수 없으므로 fnArvlChc를 동적으로 찾아 호출
  await page.evaluate(([code, name]) => {
    // 버튼 목록에서 해당 터미널 찾아 클릭
    const btn = Array.from(document.querySelectorAll('#tableTrmList button'))
      .find(b => b.textContent.trim() === name);
    if (btn) {
      btn.click();
    } else {
      // 직접 코드로 호출 (거리 240 기본값)
      fnArvlChc(code, name, 'N', '', '', '240');
    }
  }, [toCode, route.to]);
  await page.waitForTimeout(400);

  // 선택완료 버튼 클릭 (모달 닫기)
  await page.evaluate(() => {
    document.querySelector('#cfmBtn')?.click();
  });
  await page.waitForTimeout(400);

  // 날짜 설정
  const [year, month, day] = route.date.split('-').map(Number);
  await page.evaluate(([y, m, d]) => {
    jQuery('#datepicker1').datepicker('setDate', new Date(y, m - 1, d));
    jQuery('#datepicker1').trigger('change');
  }, [year, month, day]);
  await page.waitForTimeout(300);

  // 검색 실행 (페이지 이동)
  await Promise.all([
    page.waitForNavigation({ timeout: 15000 }),
    page.evaluate(() => fnAlcnSrch()),
  ]);
  await page.waitForTimeout(2000);

  // 결과 파싱: p[role="row"][data-time] 항목에서 시간/잔여석 추출
  const allSeats = await page.evaluate(() => {
    const items = Array.from(document.querySelectorAll('p[role="row"][data-time]'));
    return items.map(item => {
      const timeEl = item.querySelector('.start_time');
      const remainEl = item.querySelector('.remain');
      const isSoldOut = item.classList.contains('noselect');
      const time = timeEl?.textContent?.replace(/\s/g, '') || '';
      const remain = remainEl?.textContent?.trim() || '';
      const count = parseInt(remain.replace(/[^0-9]/g, ''), 10);
      return { time, count: isNaN(count) ? 0 : count, isSoldOut };
    }).filter(s => s.count > 0 && !s.isSoldOut);
  });

  // 시간대 필터링
  if (!route.timeRange) return allSeats;

  return allSeats.filter(s => {
    const t = s.time.replace(':', '');
    const start = route.timeRange.start.replace(':', '');
    const end = route.timeRange.end.replace(':', '');
    return t >= start && t <= end;
  }).map(s => ({ time: s.time, count: s.count }));
}

module.exports = { check };
