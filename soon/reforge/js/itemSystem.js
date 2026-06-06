// 강화 시스템
const ItemSystem = (() => {

  // 장착 슬롯 키 반환
  function getSlotKey(type) {
    return type === 'sword' ? 'equippedSword' : 'equippedShield';
  }

  // 강화 시도
  function tryEnhance(state, slotKey) {
    const item = state[slotKey];
    if (!item) return { success: false, reason: 'no_item' };

    const cost = getEnhanceCost(item.grade, item.enhancement);
    if (state.gold < cost) return { success: false, reason: 'insufficient_gold' };

    const prob = getProbability(item.grade, item.enhancement);
    const roll = Math.random() * 100;
    const success = roll < prob;

    state.gold -= cost;
    if (success) {
      item.enhancement++;
    }

    const isRare = prob <= 30;
    return { success, isRare, prob, cost, enhancement: item.enhancement };
  }

  // 인벤토리에서 장착 슬롯으로 이동
  function equipItem(state, itemId) {
    const idx = state.inventory.findIndex(i => i.id === itemId);
    if (idx === -1) return false;

    const item = state.inventory[idx];
    const slotKey = getSlotKey(item.type);
    const current = state[slotKey];

    // 기존 장착 아이템을 인벤토리로 반환
    if (current) {
      state.inventory.push(current);
    }

    state[slotKey] = item;
    state.inventory.splice(idx, 1);
    return true;
  }

  // 장착 슬롯에서 인벤토리로 이동
  function unequipItem(state, slotKey) {
    const item = state[slotKey];
    if (!item) return false;
    state.inventory.push(item);
    state[slotKey] = null;
    return true;
  }

  // 아이템 구매
  function buyItem(state, type, grade) {
    const price = CONFIG.ITEM_PRICES[grade];
    if (state.gold < price) return { success: false, reason: 'insufficient_gold' };
    state.gold -= price;
    const item = GameState.createItem(type, grade);
    state.inventory.push(item);
    return { success: true, item };
  }

  // 인벤토리에서 아이템 삭제
  function removeItem(state, itemId) {
    const idx = state.inventory.findIndex(i => i.id === itemId);
    if (idx === -1) return false;
    state.inventory.splice(idx, 1);
    return true;
  }

  return { tryEnhance, equipItem, unequipItem, buyItem, getSlotKey, removeItem };
})();
