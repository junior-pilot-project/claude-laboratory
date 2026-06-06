// 게임 상태 관리
const GameState = (() => {
  const STORAGE_KEY = 'reforge_game';

  const defaultState = () => ({
    gold: CONFIG.INITIAL_GOLD,
    startTime: Date.now(),
    equippedSword: null,
    equippedShield: null,
    inventory: [],
    rankings: [],
    gameOver: false,
  });

  function load() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        // rankings는 별도 보존
        return { ...defaultState(), ...parsed };
      }
    } catch (e) {
      console.warn('상태 불러오기 실패, 초기화합니다.');
    }
    return defaultState();
  }

  function save(state) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      console.warn('상태 저장 실패:', e);
    }
  }

  function reset(keepRankings = true) {
    const current = load();
    const fresh = defaultState();
    if (keepRankings) {
      fresh.rankings = current.rankings || [];
    }
    save(fresh);
    return fresh;
  }

  function getTotalEnhancement(state) {
    const sword = state.equippedSword ? state.equippedSword.enhancement : 0;
    const shield = state.equippedShield ? state.equippedShield.enhancement : 0;
    return sword + shield;
  }

  function isGoalReached(state) {
    return getTotalEnhancement(state) >= CONFIG.GOAL;
  }

  function generateId() {
    return `item_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  function createItem(type, grade) {
    return {
      id: generateId(),
      type,
      grade,
      enhancement: 0,
    };
  }

  return { load, save, reset, getTotalEnhancement, isGoalReached, createItem };
})();
