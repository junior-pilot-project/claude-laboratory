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
  COST_BASE: 0,
  COST_EASY_PER_LEVEL: 10000,       // 확률 > 30% 구간
  COST_HARD_PER_LEVEL: 1000000,     // 확률 <= 30% 구간
  COST_HARD_BASE: 70000,            // 30% 구간 진입 시 base (level 7부터)

  // 랜덤박스
  BOXES: [
    { id: 'free', name: '무료 상자 🎁', price: 0, maxReward: 100, maxCount: 10 },
    { id: 'silver', name: '천원 상자 🎪', price: 1000, maxReward: 10000, maxCount: 1 },
    { id: 'gold', name: '만원 상자 👑', price: 10000, maxReward: 100000, maxCount: 1 },
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
  INITIAL_GOLD: 50000,
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
  if (prob > 30) {
    return CONFIG.COST_BASE + (currentLevel + 1) * CONFIG.COST_EASY_PER_LEVEL;
  } else {
    return CONFIG.COST_HARD_BASE + (currentLevel + 1) * CONFIG.COST_HARD_PER_LEVEL;
  }
}
