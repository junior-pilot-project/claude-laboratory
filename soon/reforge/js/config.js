// 게임 설정 상수
const CONFIG = {
  // 강화 확률 테이블 (인덱스 0~11, 이후 1% 유지)
  PROB_TABLE: [100, 90, 80, 70, 60, 50, 40, 30, 20, 10, 5, 1],

  // 등급별 시작 인덱스
  GRADE_START_INDEX: {
    high: 0,
    mid: 4,
    low: 9,
  },

  // 아이템 구매 가격
  ITEM_PRICES: {
    low: 50000,
    mid: 500000,
    high: 5000000,
  },

  // 강화 비용 계산 기준
  COST_EASY_PER_LEVEL: 5000,        // 확률 > 30% 구간
  COST_HARD_PER_LEVEL: 100000,      // 확률 <= 30% 구간
  // 확률 테이블에서 <=30% 구간은 index 7부터 (PROB_TABLE[7] = 30)

  // 랜덤박스
  BOXES: [
    { id: 'free', name: '무료 상자 🎁', price: 0, maxReward: 100, maxCount: 10 },
    { id: 'silver', name: '천원 상자 🎪', price: 1000, maxReward: 10000, maxCount: 10 },
    { id: 'gold', name: '만원 상자 👑', price: 10000, maxReward: 100000, maxCount: 10 },
    { id: 'diamond', name: '오만원 상자 💠', price: 50000, maxReward: 500000, maxCount: 10 },
  ],

  // 게임 목표
  GOAL: 40,

  // 랭킹 최대 개수
  MAX_RANKINGS: 10,

  // 아이템 등급 표시명
  GRADE_NAMES: {
    high: '상급',
    mid: '중급',
    low: '하급',
  },

  // 초기 골드
  INITIAL_GOLD: 0,
};

// 강화 확률 계산
function getProbability(grade, currentLevel) {
  const startIndex = CONFIG.GRADE_START_INDEX[grade];
  const index = startIndex + currentLevel;
  return index >= CONFIG.PROB_TABLE.length ? 1 : CONFIG.PROB_TABLE[index];
}

// 강화 비용 계산
function getEnhanceCost(grade, currentLevel) {
  const prob = getProbability(grade, currentLevel);
  const gradeStartIndex = CONFIG.GRADE_START_INDEX[grade];

  if (prob > 30) {
    return (currentLevel + 1) * CONFIG.COST_EASY_PER_LEVEL;
  } else {
    // PROB_TABLE[7] = 30 이므로 hard zone 시작 레벨 = max(0, 7 - gradeStartIndex)
    const hardZoneStart = Math.max(0, 7 - gradeStartIndex);
    const lastEasyCost = hardZoneStart * CONFIG.COST_EASY_PER_LEVEL;
    const relativeHardLevel = currentLevel - hardZoneStart + 1;
    return lastEasyCost + relativeHardLevel * CONFIG.COST_HARD_PER_LEVEL;
  }
}
