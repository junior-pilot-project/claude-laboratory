/**
 * 시외버스 잔여석 확인 (bustago.or.kr)
 *
 * API: POST /newweb/kr/ticket/ticketListJson3.do
 * 응답 필드: DEP_TIME (HHMM), REMAIN_CNT, OPENGBN (2=예매가능, 1=마감)
 *
 * 터미널 코드 예시:
 *   동서울: 0001 | 인천공항T1: 9303 | 인천공항T2: 9337 | 인천: 9302
 *   부산동부(노포): 9001 | 부산서부: 9002
 *   광주(유스퀘어): 9401 | 동대구: 9201 | 대구북부: 9202
 *   대전복합: 9503 | 대전서부: 9504 | 수원터미널: 1012
 *   전주: 7033 | 순천: 8038
 *
 * config.json route 예시:
 *   { "site": "bustago", "from": "동서울", "to": "순천", ... }
 *
 * @param {import('playwright').Page} page
 * @param {{ from: string, to: string, date: string, timeRange?: { start: string, end: string } }} route
 * @returns {Promise<Array<{ time: string, count: number }>>}
 */

const TERMINAL_CODES = {
  '동서울': '0001',
  '인천공항T1': '9303',
  '인천공항T2': '9337',
  '인천': '9302',
  '부산동부(노포)': '9001',
  '부산서부': '9002',
  '부산해운대': '9007',
  '광주(유스퀘어)': '9401',
  '동대구': '9201',
  '대구북부': '9202',
  '대전복합': '9503',
  '대전서부': '9504',
  '수원터미널': '1012',
  '전주': '7033',
  '순천': '8038',
  '고양종합': '1782',
};

async function check(page, route) {
  const fromCode = TERMINAL_CODES[route.from];
  const toCode = TERMINAL_CODES[route.to];

  if (!fromCode || !toCode) {
    throw new Error(`터미널 코드를 찾을 수 없습니다: ${route.from}(${fromCode}) → ${route.to}(${toCode}). TERMINAL_CODES에 추가하세요.`);
  }

  // 세션/쿠키 확보를 위해 메인 페이지 방문
  await page.goto('https://www.bustago.or.kr/newweb/kr/index.do', {
    waitUntil: 'domcontentloaded',
    timeout: 30000,
  });
  await page.waitForTimeout(1000);

  const dateFormatted = route.date.replace(/-/g, '');

  // ticketListJson3 API 직접 호출
  const data = await page.evaluate(
    async ({ depTerId, arrTerId, orderDate }) => {
      const params = new URLSearchParams({
        startType: 'S',
        orderDate,
        orderBackDate: '',
        depTerId,
        arrTerId,
        depTime: '0000',
        arrTime: '',
        goBusGrade: '',
        goBackBusGrade: '',
      });

      const res = await fetch('/newweb/kr/ticket/ticketListJson3.do', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
          'X-Requested-With': 'XMLHttpRequest',
          'Referer': 'https://www.bustago.or.kr/newweb/kr/ticket/ticket.do',
        },
        body: params.toString(),
      });

      return await res.json();
    },
    { depTerId: fromCode, arrTerId: toCode, orderDate: dateFormatted }
  );

  const list = data.ticketSingleList || [];

  // 잔여석 있고 예매 가능한 배차만 필터링
  const allSeats = list
    .filter(v => parseInt(v.REMAIN_CNT, 10) > 0 && v.OPENGBN !== '1')
    .map(v => {
      const rawTime = String(v.DEP_TIME).padStart(4, '0');
      const time = `${rawTime.substring(0, 2)}:${rawTime.substring(2, 4)}`;
      const count = parseInt(v.REMAIN_CNT, 10);
      return { time, count };
    })
    .filter(s => s.count > 0);

  // 시간대 필터링
  if (!route.timeRange) return allSeats;

  return allSeats.filter(s => {
    const t = s.time.replace(':', '');
    const start = route.timeRange.start.replace(':', '');
    const end = route.timeRange.end.replace(':', '');
    return t >= start && t <= end;
  });
}

module.exports = { check };
