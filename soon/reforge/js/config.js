// 게임 설정 상수
const CONFIG = {
  // 강화 확률 테이블 (인덱스 0~11, 이후 1% 유지)
  PROB_TABLE: [100, 90, 80, 70, 60, 50, 40, 30, 20, 10, 5, 1],

  // 등급별 시작 인덱스
  GRADE_START_INDEX: {
    high: 0,
    mid: 4,
    low: 9,
    supreme: 0,
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
    supreme: '최상급',
  },

  // 초기 골드
  INITIAL_GOLD: 0,

  // 레이드: 등급별 스탯
  ITEM_GRADE_STATS: {
    low:     { atk: 5,  def: 3,  atkMult: 1, defMult: 1 },
    mid:     { atk: 15, def: 10, atkMult: 2, defMult: 2 },
    high:    { atk: 30, def: 20, atkMult: 3, defMult: 3 },
    supreme: { atk: 80, def: 50, atkMult: 5, defMult: 5 },
  },

  // 제작 시스템
  CRAFT: {
    SUCCESS_RATE: 10,
    REQUIRED_ENHANCEMENT: 11,
    WHETSTONE_COST: 1,
  },

  // 최상급 강화 전용
  SUPREME_PROB_TABLE: [10, 7, 5, 3, 1],   // +12 → +13, +13 → +14, ... (이후 1% 고정)
  SUPREME_START_LEVEL: 12,
  COST_SUPREME_PER_LEVEL: 1000000,

  // 강화연마제 드롭률 (stage id 기준)
  WHETSTONE_DROP_RATES: { easy: 1, normal: 10, hard: 30 },

  // 보스 스테이지
  BOSS_STAGES: [
    { id: 'easy',   label: '하급', bossHp: 100, bossAtk: 12, reward: 30000,  unlock: 0  },
    { id: 'normal', label: '중급', bossHp: 300, bossAtk: 35, reward: 100000, unlock: 10 },
    { id: 'hard',   label: '상급', bossHp: 700, bossAtk: 80, reward: 300000, unlock: 20 },
  ],
  BOSS_ROUNDS: 10,
  BOSS_PLAYER_HP: 100,

  // 레이드 액션 게임 설정
  RAID_ACTION: {
    CANVAS_W: 160,
    CANVAS_H: 96,
    SCALE: 3,
    PLAYER_W: 16,
    PLAYER_H: 24,
    GROUND_Y: 82,
    ATTACK_RANGE: 22,
    WALK_SPEED: 42,
    JUMP_FORCE: 180,
    GRAVITY: 380,
    PLAYER_HP: 200,
    ATTACK_COOLDOWN: 0.45,
  },

  // 레이드 액션 스테이지
  RAID_ACTION_STAGES: [
    { id: 'easy',   label: '하급', bossHp: 300,  bossAtk: 8,  bossAtkInterval: 3.0, reward: 30000,  unlock: 0  },
    { id: 'normal', label: '중급', bossHp: 900,  bossAtk: 20, bossAtkInterval: 2.5, reward: 100000, unlock: 10 },
    { id: 'hard',   label: '상급', bossHp: 2100, bossAtk: 50, bossAtkInterval: 2.0, reward: 300000, unlock: 20 },
  ],

  // 보스별 픽셀 스프라이트 크기 (논리 px)
  RAID_BOSS_SIZES: {
    easy:   { w: 24, h: 32 },
    normal: { w: 36, h: 48 },
    hard:   { w: 48, h: 64 },
  },
};

// 강화 확률 계산
function getProbability(grade, currentLevel) {
  if (grade === 'supreme') {
    const idx = currentLevel - CONFIG.SUPREME_START_LEVEL;
    if (idx < 0) return 0;
    const tbl = CONFIG.SUPREME_PROB_TABLE;
    return idx >= tbl.length ? 1 : tbl[idx];
  }
  const startIndex = CONFIG.GRADE_START_INDEX[grade];
  const index = startIndex + currentLevel;
  return index >= CONFIG.PROB_TABLE.length ? 1 : CONFIG.PROB_TABLE[index];
}

// 강화 비용 계산
function getEnhanceCost(grade, currentLevel) {
  if (grade === 'supreme') {
    const relativeLevel = currentLevel - CONFIG.SUPREME_START_LEVEL + 1;
    return Math.max(1, relativeLevel) * CONFIG.COST_SUPREME_PER_LEVEL;
  }

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
