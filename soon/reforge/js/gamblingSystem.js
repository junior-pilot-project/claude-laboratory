// 도박장 (랜덤박스) 시스템
const GamblingSystem = (() => {

  // 보상 계산: Math.pow(Math.random(), 2) * max (높은 값일수록 낮은 확률)
  function calcReward(maxReward) {
    return Math.floor(Math.pow(Math.random(), 2) * maxReward);
  }

  // 박스 오픈 (수량 지원)
  function openBoxes(state, boxId, count) {
    const box = CONFIG.BOXES.find(b => b.id === boxId);
    if (!box) return { success: false, reason: 'invalid_box' };

    const safeCount = Math.min(count, box.maxCount || 10);
    const totalCost = box.price * safeCount;

    if (state.gold < totalCost) return { success: false, reason: 'insufficient_gold' };

    state.gold -= totalCost;

    const rewards = [];
    for (let i = 0; i < safeCount; i++) {
      rewards.push(calcReward(box.maxReward));
    }

    const totalReward = rewards.reduce((a, b) => a + b, 0);
    state.gold += totalReward;

    return { success: true, rewards, totalReward };
  }

  return { openBoxes };
})();
