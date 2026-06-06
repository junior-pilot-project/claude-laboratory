// 제작 시스템
const CraftSystem = (() => {

  function rollWhetstoneDrops(state, stageId) {
    const rate = CONFIG.WHETSTONE_DROP_RATES[stageId] || 0;
    if (Math.random() * 100 < rate) {
      state.whetstones = (state.whetstones || 0) + 1;
      return true;
    }
    return false;
  }

  function _findHighPlusEleven(state, type) {
    // 인벤토리에서 탐색
    const inInv = state.inventory.find(
      i => i.type === type && i.grade === 'high' && i.enhancement === CONFIG.CRAFT.REQUIRED_ENHANCEMENT
    );
    if (inInv) return { source: 'inventory', item: inInv };

    // 장착 슬롯에서 탐색
    const slotKey = type === 'sword' ? 'equippedSword' : 'equippedShield';
    const equipped = state[slotKey];
    if (equipped && equipped.grade === 'high' && equipped.enhancement === CONFIG.CRAFT.REQUIRED_ENHANCEMENT) {
      return { source: 'equipped', slotKey, item: equipped };
    }

    return null;
  }

  function craftSupreme(state, type) {
    if ((state.whetstones || 0) < CONFIG.CRAFT.WHETSTONE_COST) {
      return { success: false, reason: 'no_whetstone' };
    }

    const found = _findHighPlusEleven(state, type);
    if (!found) {
      return { success: false, reason: 'no_material' };
    }

    state.whetstones -= CONFIG.CRAFT.WHETSTONE_COST;

    const success = Math.random() * 100 < CONFIG.CRAFT.SUCCESS_RATE;

    if (success) {
      // 재료 장비 제거
      if (found.source === 'inventory') {
        state.inventory = state.inventory.filter(i => i.id !== found.item.id);
      } else {
        state[found.slotKey] = null;
      }

      // 최상급 장비 생성 후 인벤토리 추가
      const newItem = GameState.createItem(type, 'supreme');
      state.inventory.push(newItem);
      return { success: true, item: newItem };
    }

    return { success: false, reason: 'failed' };
  }

  return { rollWhetstoneDrops, craftSupreme };
})();
