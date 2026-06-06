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
