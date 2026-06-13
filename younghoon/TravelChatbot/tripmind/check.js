#!/usr/bin/env node
const { execSync } = require('child_process');
const path = require('path');

console.log('🔨 TripMind 빌드 검증 중...\n');

try {
  execSync('npm run build', {
    stdio: 'inherit',
    cwd: __dirname,
  });

  console.log('\n✅ TripMind MVP 완성!');
  console.log('');
  console.log('  📦 빌드 결과: client/dist/');
  console.log('  🚀 배포: npm i -g vercel && vercel');
  console.log('  🏃 개발: npm run dev');
  console.log('');
} catch {
  console.error('\n❌ 빌드 실패. 위 오류를 확인해주세요.');
  process.exit(1);
}
