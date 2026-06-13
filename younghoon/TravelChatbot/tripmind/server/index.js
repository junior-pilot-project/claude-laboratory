require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const chatRoutes = require('./routes/chat');
const flightsRoutes = require('./routes/flights');

const app = express();
const PORT = process.env.PORT || 3001;

if (!process.env.ANTHROPIC_API_KEY) {
  console.warn('\x1b[33m⚠️  ANTHROPIC_API_KEY가 설정되지 않았습니다. .env 파일을 확인해주세요.\x1b[0m');
}

// destinations.json 서버 시작 시 메모리 캐싱 (매번 파일 읽기 X)
let destinationsCache = [];
try {
  const dataPath = path.join(__dirname, 'data', 'destinations.json');
  destinationsCache = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));
  console.log(`✅ destinations 캐시 완료 (${destinationsCache.length}개)`);
} catch (err) {
  console.error('destinations.json 로드 실패:', err.message);
}

const allowedOrigins =
  process.env.NODE_ENV === 'production'
    ? true
    : ['http://localhost:5173', 'http://localhost:3000', 'http://localhost:4173'];

app.use(cors({ origin: allowedOrigins }));
app.use(express.json());

app.use('/api/chat', chatRoutes);
app.use('/api/flights', flightsRoutes);

app.get('/api/destinations', (_req, res) => {
  res.json(destinationsCache);
});

// 프로덕션: 빌드된 클라이언트 파일 서빙
if (process.env.NODE_ENV === 'production') {
  const clientDist = path.join(__dirname, '../client/dist');
  app.use(express.static(clientDist));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`TripMind 서버 실행 중: http://localhost:${PORT}`);
});
