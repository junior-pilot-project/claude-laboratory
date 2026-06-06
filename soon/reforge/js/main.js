// 진입점 - 초기화 및 이벤트 바인딩
let state;

function init() {
  state = GameState.load();
  UIManager.startTimer(state);
  UIManager.render(state);
  bindTabs();
  bindGlobalHandlers();

  // 저장된 게임이 이미 클리어된 경우 처리
  if (state.gameOver) {
    const elapsed = state.endTime ? state.endTime - state.startTime : 0;
    UIManager.showGameOver(state, elapsed);
  }
}

function bindTabs() {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      btn.classList.add('active');
      const tab = btn.dataset.tab;
      document.getElementById(`tab-${tab}`).classList.add('active');
      soundManager.init();
      soundManager.playTabSwitch();
      UIManager.render(state);
    });
  });

  // 음소거 버튼
  document.getElementById('btn-sound').addEventListener('click', () => {
    soundManager.init();
    const enabled = soundManager.toggle();
    document.getElementById('btn-sound').textContent = enabled ? '🔊' : '🔇';
  });
}

function bindGlobalHandlers() {
  // 슬롯 강화 버튼 (이벤트 위임)
  document.getElementById('tab-equip').addEventListener('click', (e) => {
    soundManager.init();
    const btn = e.target.closest('.btn-enhance-slot');
    if (btn) {
      soundManager.playClick();
      UIManager.selectSlot(btn.dataset.slot);
      soundManager.playEnhanceReady();
      UIManager.renderEquip(state);
    }
    const unequip = e.target.closest('.btn-unequip');
    if (unequip) {
      soundManager.playClick();
      ItemSystem.unequipItem(state, unequip.dataset.slot);
      if (UIManager.getSelectedSlot() === unequip.dataset.slot) {
        UIManager.selectSlot(null);
      }
      GameState.save(state);
      UIManager.renderEquip(state);
      UIManager.updateHeader(state);
    }
  });
}

// 전역 핸들러 (uiManager에서 직접 호출)
window.handleEnhance = function(slotKey) {
  soundManager.init();
  soundManager.playEnhanceReady();
  const result = ItemSystem.tryEnhance(state, slotKey);

  if (result.reason === 'insufficient_gold') {
    soundManager.playInsufficientGold();
    UIManager.showToast('골드가 부족합니다!', 'error');
    return;
  }
  if (result.reason === 'no_item') {
    UIManager.showToast('장착된 아이템이 없습니다.', 'error');
    return;
  }

  if (result.success) {
    soundManager.playSuccess(result.isRare);
  } else {
    soundManager.playFail();
  }

  GameState.save(state);
  UIManager.showEnhanceResult(result);
  UIManager.renderEquip(state);
  UIManager.updateHeader(state);

  // 목표 달성 확인
  if (GameState.isGoalReached(state)) {
    const playTimeMs = Date.now() - state.startTime;
    state.gameOver = true;
    state.endTime = Date.now();
    RankingSystem.addRanking(state, playTimeMs);
    GameState.save(state);
    setTimeout(() => UIManager.showGameOver(state, playTimeMs), 800);
  }
};

window.handleEquip = function(itemId) {
  soundManager.init();
  soundManager.playClick();
  ItemSystem.equipItem(state, itemId);
  GameState.save(state);
  UIManager.renderEquip(state);
  UIManager.updateHeader(state);
};

window.handleBuy = function(type, grade) {
  soundManager.init();
  const result = ItemSystem.buyItem(state, type, grade);
  if (!result.success) {
    soundManager.playInsufficientGold();
    UIManager.showToast('골드가 부족합니다!', 'error');
    return;
  }
  soundManager.playPurchase();
  GameState.save(state);
  UIManager.updateHeader(state);
  UIManager.showToast(`${CONFIG.GRADE_NAMES[grade]} ${type === 'sword' ? '칼' : '방패'} 구매 완료!`, 'success');
};

window.handleOpenBox = function(boxId, count) {
  soundManager.init();
  const box = CONFIG.BOXES.find(b => b.id === boxId);
  const cost = (box?.price || 0) * count;

  if (state.gold < cost) {
    soundManager.playInsufficientGold();
    UIManager.showToast('골드가 부족합니다!', 'error');
    return;
  }

  soundManager.playBoxShake(() => {
    const result = GamblingSystem.openBoxes(state, boxId, count);
    if (!result.success) {
      soundManager.playInsufficientGold();
      UIManager.showToast('골드가 부족합니다!', 'error');
      return;
    }
    soundManager.playBoxOpen();
    GameState.save(state);
    UIManager.updateHeader(state);
    UIManager.showBoxResults(result.rewards);
  });
};

window.handleNewGame = function() {
  state = GameState.reset(true);
  UIManager.selectSlot(null);
  UIManager.startTimer(state);
  document.getElementById('gameover-screen').style.display = 'none';
  document.getElementById('main-content').style.display = '';

  // 첫 탭으로 돌아가기
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
  document.querySelector('.tab-btn[data-tab="equip"]').classList.add('active');
  document.getElementById('tab-equip').classList.add('active');

  UIManager.render(state);
};

document.addEventListener('DOMContentLoaded', init);
