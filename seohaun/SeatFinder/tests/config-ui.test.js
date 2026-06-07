const request = require('supertest');
const fs = require('fs');
const path = require('path');

const CONFIG_PATH = path.join(__dirname, '..', 'config.json');
const BACKUP_PATH = CONFIG_PATH + '.bak';

let app;

beforeEach(() => {
  if (fs.existsSync(CONFIG_PATH)) {
    fs.copyFileSync(CONFIG_PATH, BACKUP_PATH);
    fs.unlinkSync(CONFIG_PATH);
  }
  jest.resetModules();
  app = require('../config-ui');
});

afterEach(() => {
  if (fs.existsSync(BACKUP_PATH)) {
    fs.copyFileSync(BACKUP_PATH, CONFIG_PATH);
    fs.unlinkSync(BACKUP_PATH);
  } else if (fs.existsSync(CONFIG_PATH)) {
    fs.unlinkSync(CONFIG_PATH);
  }
});

test('GET /api/config — config.json 없으면 기본값 반환', async () => {
  const res = await request(app).get('/api/config');
  expect(res.status).toBe(200);
  expect(res.body).toEqual({ interval: 60, routes: [] });
});

test('GET /api/config — config.json 있으면 내용 반환', async () => {
  const data = { interval: 120, routes: [{ site: 'kobus', from: '서울', to: '부산', date: '2026-06-10' }] };
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(data));
  const res = await request(app).get('/api/config');
  expect(res.status).toBe(200);
  expect(res.body).toEqual(data);
});

test('POST /api/config — config.json 저장', async () => {
  const data = { interval: 60, routes: [{ site: 'bustago', from: '대구', to: '광주', date: '2026-06-15' }] };
  const res = await request(app).post('/api/config').send(data);
  expect(res.status).toBe(200);
  expect(res.body).toEqual({ ok: true });
  const saved = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
  expect(saved).toEqual(data);
});
