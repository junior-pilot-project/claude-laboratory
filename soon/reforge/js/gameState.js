// 게임 상태 관리
const GameState = (() => {
  const STORAGE_KEY = 'reforge_game';

  const defaultState = () => ({
    gold: CONFIG.INITIAL_GOLD,
    startTime: Date.now(),
    equippedSword: null,
    equippedShield: null,
    equippedArmor: null,
    equippedBoots: null,
    equippedHelmet: null,
    inventory: [],
    rankings: [],
    gameOver: false,
    whetstones: 0,
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
    const sword   = state.equippedSword   ? state.equippedSword.enhancement   : 0;
    const shield  = state.equippedShield  ? state.equippedShield.enhancement  : 0;
    const armor   = state.equippedArmor   ? state.equippedArmor.enhancement   : 0;
    const boots   = state.equippedBoots   ? state.equippedBoots.enhancement   : 0;
    // 투구는 강화 불가이므로 강화합 미포함
    return sword + shield + armor + boots;
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
