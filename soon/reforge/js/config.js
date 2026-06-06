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

  // 방어 아이템 전용 스탯 (갑옷/신발/투구 — def + hp 보너스)
  ARMOR_GRADE_STATS: {
    low:     { def: 2,  defMult: 0.8, hp: 15,  hpMult: 3  },
    mid:     { def: 8,  defMult: 1.5, hp: 40,  hpMult: 7  },
    high:    { def: 15, defMult: 2.5, hp: 80,  hpMult: 12 },
    supreme: { def: 40, defMult: 4.0, hp: 200, hpMult: 25 },
  },
  BOOTS_GRADE_STATS: {
    low:     { def: 1,  defMult: 0.5, hp: 8,   hpMult: 1.5 },
    mid:     { def: 5,  defMult: 1.0, hp: 20,  hpMult: 4   },
    high:    { def: 10, defMult: 1.8, hp: 40,  hpMult: 8   },
    supreme: { def: 25, defMult: 3.0, hp: 100, hpMult: 15  },
  },
  HELMET_GRADE_STATS: {
    low:  { def: 2,  defMult: 0, hp: 20  },
    mid:  { def: 8,  defMult: 0, hp: 50  },
    high: { def: 15, defMult: 0, hp: 100 },
  },

  // 투구 드롭률 (레이드 액션 보스 클리어 시)
  HELMET_DROP_RATES: { high: 2, mid: 8, low: 20 },

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
  GOAL: 80,

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
    { id: 'easy',   label: '하급', bossHp: 200,  bossAtk: 80,  reward: 30000,  unlock: 0  },
    { id: 'normal', label: '중급', bossHp: 600,  bossAtk: 160, reward: 100000, unlock: 10 },
    { id: 'hard',   label: '상급', bossHp: 1500, bossAtk: 290, reward: 300000, unlock: 20 },
  ],
  BOSS_ROUNDS: 10,
  BOSS_PLAYER_HP: 300,

  // 레이드 액션 게임 설정
  RAID_ACTION: {
    CANVAS_W: 240,
    CANVAS_H: 135,
    SCALE: 2,
    PLAYER_W: 16,
    PLAYER_H: 24,
    GROUND_Y: 113,
    ATTACK_RANGE: 28,
    WALK_SPEED: 55,
    JUMP_FORCE: 210,
    GRAVITY: 430,
    PLAYER_HP: 300,
    ATTACK_COOLDOWN: 0.4,
  },

  // 레이드 단일 보스 (방어 아이템 추가로 공격력 대폭 상향, HP 하향으로 전투 가속)
  RAID_BOSS: {
    w: 42, h: 56,
    hp: 600,
    atk: 250,
    reward: 120000,
    firstAtkDelay: 1.2,
    minInterval: 1.2,
    maxInterval: 2.2,
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
