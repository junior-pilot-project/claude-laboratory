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
