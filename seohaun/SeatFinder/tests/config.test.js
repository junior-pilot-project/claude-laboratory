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
