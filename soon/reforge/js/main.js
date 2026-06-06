// 진입점 - 초기화 및 이벤트 바인딩
let state;
let isOpening = false;
let _modalCloseTimer = null;
let isEnhancing = false;
let _enhanceCloseTimer = null;
let isBossing = false;
let isRaidActing = false;
let isCrafting = false;

const _ITEM_TYPE_ICONS  = { sword: '⚔️', shield: '🛡️', armor: '🥋', boots: '👟', helmet: '🪖' };
const _ITEM_TYPE_LABELS = { sword: '칼', shield: '방패', armor: '갑옷', boots: '신발', helmet: '투구' };

function _openCraftModal(type) {
  const icon = _ITEM_TYPE_ICONS[type] || '🔨';
  const typeName = _ITEM_TYPE_LABELS[type] || type;
  document.getElementById('enhance-modal-icon').textContent = icon;
  document.getElementById('enhance-modal-icon').className = 'enhance-modal-icon charging';
  document.getElementById('enhance-modal-level').textContent =
    `상급 ${typeName} +${CONFIG.CRAFT.REQUIRED_ENHANCEMENT} → 최상급 ${typeName} +${CONFIG.SUPREME_START_LEVEL}`;
  document.getElementById('enhance-modal-level').style.color = '';
  document.getElementById('enhance-modal-prob').innerHTML =
    `성공 확률: <b style="color:var(--fail)">${CONFIG.CRAFT.SUCCESS_RATE}%</b>`;
  document.getElementById('enhance-modal-status').textContent = '제작 시도 중...';
  document.getElementById('enhance-modal-status').className = 'enhance-modal-status';
  document.getElementById('enhance-modal-bar').className = 'enhance-modal-bar charging';
  document.getElementById('enhance-modal-ring').className = 'enhance-modal-ring spinning';
  document.getElementById('enhance-modal').className = 'enhance-modal-overlay active';
  document.querySelector('#enhance-modal .enhance-modal-hint')?.remove();
}

function _revealCraftModal(result, type) {
  const modal = document.getElementById('enhance-modal');
  const iconEl   = document.getElementById('enhance-modal-icon');
  const levelEl  = document.getElementById('enhance-modal-level');
  const statusEl = document.getElementById('enhance-modal-status');
  const barEl    = document.getElementById('enhance-modal-bar');
  const ringEl   = document.getElementById('enhance-modal-ring');
  const typeName = _ITEM_TYPE_LABELS[type] || type;

  if (result.success) {
    iconEl.className   = 'enhance-modal-icon success';
    ringEl.className   = 'enhance-modal-ring success';
    barEl.className    = 'enhance-modal-bar success';
    levelEl.textContent = `최상급 ${typeName} +${CONFIG.SUPREME_START_LEVEL} 제작 완료!`;
    levelEl.style.color = 'var(--gold)';
    statusEl.textContent = '✨ 제작 성공!';
    statusEl.className  = 'enhance-modal-status success';
    _spawnEnhanceSparks(modal.querySelector('.enhance-modal-card'));
  } else {
    iconEl.className   = 'enhance-modal-icon fail';
    ringEl.className   = 'enhance-modal-ring fail';
    barEl.className    = 'enhance-modal-bar fail';
    levelEl.textContent = `제작 실패`;
    levelEl.style.color = 'var(--fail)';
    statusEl.textContent = '💥 제작 실패... 연마제 소모';
    statusEl.className  = 'enhance-modal-status fail';
  }

  const hint = document.createElement('p');
  hint.className = 'enhance-modal-hint';
  hint.textContent = '화면을 클릭하여 닫기';
  modal.querySelector('.enhance-modal-card').appendChild(hint);

  modal.classList.add('closeable');
  _enhanceCloseTimer = setTimeout(_closeEnhanceModal, 2500);
}

function _openEnhanceModal(item) {
  const icon = _ITEM_TYPE_ICONS[item.type] || '⚔️';
  const prob = getProbability(item.grade, item.enhancement);
  const probClass = prob <= 30 ? 'color:var(--fail)' : 'color:var(--success)';

  document.getElementById('enhance-modal-icon').textContent = icon;
  document.getElementById('enhance-modal-icon').className = 'enhance-modal-icon charging';
  document.getElementById('enhance-modal-level').textContent =
    `${CONFIG.GRADE_NAMES[item.grade]} +${item.enhancement} → ?`;
  document.getElementById('enhance-modal-level').style.color = '';
  document.getElementById('enhance-modal-prob').innerHTML =
    `성공 확률: <b style="${probClass}">${prob}%</b>`;
  document.getElementById('enhance-modal-status').textContent = '강화 시도 중...';
  document.getElementById('enhance-modal-status').className = 'enhance-modal-status';
  document.getElementById('enhance-modal-bar').className = 'enhance-modal-bar charging';
  document.getElementById('enhance-modal-ring').className = 'enhance-modal-ring spinning';
  document.getElementById('enhance-modal').className = 'enhance-modal-overlay active';
  document.querySelector('#enhance-modal .enhance-modal-hint')?.remove();
}

function _revealEnhanceModal(result, snapshot) {
  const modal = document.getElementById('enhance-modal');
  const iconEl   = document.getElementById('enhance-modal-icon');
  const levelEl  = document.getElementById('enhance-modal-level');
  const statusEl = document.getElementById('enhance-modal-status');
  const barEl    = document.getElementById('enhance-modal-bar');
  const ringEl   = document.getElementById('enhance-modal-ring');
  const grade    = CONFIG.GRADE_NAMES[snapshot.grade];

  if (result.success) {
    iconEl.className   = 'enhance-modal-icon success';
    ringEl.className   = 'enhance-modal-ring success';
    barEl.className    = 'enhance-modal-bar success';
    levelEl.textContent = `${grade} +${snapshot.enhancement} → +${result.enhancement}`;
    levelEl.style.color = 'var(--gold)';
    statusEl.textContent = '✨ 강화 성공!';
    statusEl.className  = 'enhance-modal-status success';
    _spawnEnhanceSparks(modal.querySelector('.enhance-modal-card'));
  } else {
    iconEl.className   = 'enhance-modal-icon fail';
    ringEl.className   = 'enhance-modal-ring fail';
    barEl.className    = 'enhance-modal-bar fail';
    levelEl.textContent = `${grade} +${snapshot.enhancement}`;
    levelEl.style.color = 'var(--fail)';
    statusEl.textContent = '💥 강화 실패...';
    statusEl.className  = 'enhance-modal-status fail';
  }

  const hint = document.createElement('p');
  hint.className = 'enhance-modal-hint';
  hint.textContent = '화면을 클릭하여 닫기';
  modal.querySelector('.enhance-modal-card').appendChild(hint);

  modal.classList.add('closeable');
  _enhanceCloseTimer = setTimeout(_closeEnhanceModal, 2500);
}

function _spawnEnhanceSparks(card) {
  card.querySelectorAll('.box-modal-spark').forEach(s => s.remove());
  ['✨','⭐','💫','🌟','✨','⭐'].forEach((e, i) => {
    const span = document.createElement('span');
    span.textContent = e;
    span.className = 'box-modal-spark';
    const angle = (i / 6) * 2 * Math.PI;
    const dist = 70 + Math.random() * 40;
    span.style.cssText = `--tx:${(Math.cos(angle)*dist).toFixed(0)}px;--ty:${(Math.sin(angle)*dist).toFixed(0)}px;animation-delay:${i*40}ms`;
    card.appendChild(span);
  });
}

function _closeEnhanceModal() {
  if (_enhanceCloseTimer) { clearTimeout(_enhanceCloseTimer); _enhanceCloseTimer = null; }
  const modal = document.getElementById('enhance-modal');
  modal.className = 'enhance-modal-overlay';
  document.getElementById('enhance-modal-icon').style.color = '';
  document.getElementById('enhance-modal-level').style.color = '';
}

function _openBoxModal(boxId) {
  const emojiMap = { free: '🎁', silver: '💰', gold: '💎', diamond: '💠' };
  const modal = document.getElementById('box-open-modal');
  const emoji = document.getElementById('box-modal-emoji');
  const status = document.getElementById('box-modal-status');
  document.getElementById('box-modal-rewards').innerHTML = '';

  emoji.textContent = emojiMap[boxId] || '📦';
  emoji.style.visibility = '';
  emoji.className = 'box-modal-emoji shaking';
  status.textContent = '두근두근...';
  modal.querySelector('.box-modal-glow-ring').className = 'box-modal-glow-ring pulse';
  modal.className = 'box-modal-overlay active';
}

function _revealBoxModal(rewards) {
  const modal = document.getElementById('box-open-modal');
  const emoji = document.getElementById('box-modal-emoji');
  const status = document.getElementById('box-modal-status');
  const rewardsEl = document.getElementById('box-modal-rewards');

  modal.querySelector('.box-modal-glow-ring').className = 'box-modal-glow-ring gone';
  emoji.className = 'box-modal-emoji burst';

  const card = modal.querySelector('.box-modal-card');
  modal.querySelectorAll('.box-modal-spark').forEach(s => s.remove());
  ['✨','💫','⭐','🌟','💥','✨','💫','⭐'].forEach((e, i) => {
    const span = document.createElement('span');
    span.textContent = e;
    span.className = 'box-modal-spark';
    const angle = (i / 8) * 2 * Math.PI - Math.PI / 2;
    const dist = 90 + Math.random() * 55;
    span.style.cssText = `--tx:${(Math.cos(angle) * dist).toFixed(0)}px;--ty:${(Math.sin(angle) * dist).toFixed(0)}px;animation-delay:${i * 35}ms`;
    card.appendChild(span);
  });

  setTimeout(() => {
    emoji.style.visibility = 'hidden';
    status.textContent = '🎉 오픈 완료!';
    const total = rewards.reduce((a, b) => a + b, 0);
    rewardsEl.innerHTML =
      `<div class="box-modal-total" style="animation-delay:0ms">🪙 ${total.toLocaleString()}원 획득!</div>` +
      rewards.map((r, i) =>
        `<span class="modal-coin-item" style="animation-delay:${80 + i * 65}ms">+${r.toLocaleString()}원</span>`
      ).join('') +
      `<p class="box-modal-close-hint">화면을 클릭하여 닫기</p>`;
    modal.classList.add('closeable');
    _modalCloseTimer = setTimeout(_closeBoxModal, 3500);
  }, 500);
}

function _closeBoxModal() {
  if (_modalCloseTimer) { clearTimeout(_modalCloseTimer); _modalCloseTimer = null; }
  const modal = document.getElementById('box-open-modal');
  modal.className = 'box-modal-overlay';
  document.getElementById('box-modal-emoji').style.visibility = '';
}

function init() {
  state = GameState.load();
  UIManager.render(state);
  bindTabs();
  UIManager.bindProbInfo();
  bindGlobalHandlers();

  document.getElementById('box-open-modal').addEventListener('click', function() {
    if (this.classList.contains('closeable')) _closeBoxModal();
  });
  document.getElementById('enhance-modal').addEventListener('click', function() {
    if (this.classList.contains('closeable')) _closeEnhanceModal();
  });
  document.getElementById('item-detail-modal').addEventListener('click', function(e) {
    if (e.target === this || e.target.id === 'item-detail-close') {
      this.classList.remove('active');
    }
  });

  if (state.gameOver) {
    UIManager.showGameOver(state);
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
    const detailBtn = e.target.closest('.btn-item-detail');
    if (detailBtn) {
      window.handleItemDetail(JSON.parse(decodeURIComponent(detailBtn.dataset.item)));
      return;
    }
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
  if (isEnhancing) return;
  soundManager.init();

  const item = state[slotKey];
  if (!item) { UIManager.showToast('장착된 아이템이 없습니다.', 'error'); return; }
  if (state.gold < getEnhanceCost(item.grade, item.enhancement)) {
    soundManager.playInsufficientGold();
    UIManager.showToast('골드가 부족합니다!', 'error');
    return;
  }

  isEnhancing = true;
  const snapshot = { grade: item.grade, type: item.type, enhancement: item.enhancement };
  soundManager.playEnhanceReady();
  _openEnhanceModal(snapshot);

  setTimeout(() => {
    const result = ItemSystem.tryEnhance(state, slotKey);

    if (result.reason === 'insufficient_gold' || result.reason === 'no_item') {
      _closeEnhanceModal();
      UIManager.showToast('오류가 발생했습니다.', 'error');
      isEnhancing = false;
      return;
    }

    _revealEnhanceModal(result, snapshot);

    if (result.success) soundManager.playSuccess(result.isRare);
    else soundManager.playFail();

    GameState.save(state);
    UIManager.showEnhanceResult(result);
    UIManager.renderEquip(state);
    UIManager.updateHeader(state);
    isEnhancing = false;

    if (GameState.isGoalReached(state)) {
      state.gameOver = true;
      RankingSystem.addRanking(state);
      GameState.save(state);
      setTimeout(() => UIManager.showGameOver(state), 2800);
    }
  }, 1500);
};

window.handleEquip = function(itemId) {
  soundManager.init();
  soundManager.playClick();
  ItemSystem.equipItem(state, itemId);
  GameState.save(state);
  UIManager.renderEquip(state);
  UIManager.updateHeader(state);
};

const _itemTypeNames = { sword: '칼', shield: '방패', armor: '갑옷', boots: '신발', helmet: '투구' };

window.handleRemoveItem = function(itemId) {
  soundManager.init();
  const item = state.inventory.find(i => i.id === itemId);
  if (!item) return;
  const typeName = _itemTypeNames[item.type] || item.type;
  const name = `${CONFIG.GRADE_NAMES[item.grade]} ${typeName} +${item.enhancement}`;
  if (!confirm(`${name}을(를) 버리겠습니까?`)) return;
  soundManager.playClick();
  ItemSystem.removeItem(state, itemId);
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
  const typeName = _itemTypeNames[type] || type;
  UIManager.showToast(`${CONFIG.GRADE_NAMES[grade]} ${typeName} 구매 완료!`, 'success');
};

window.handleOpenBox = function(boxId, count) {
  if (isOpening) return;
  soundManager.init();
  const box = CONFIG.BOXES.find(b => b.id === boxId);
  const cost = (box?.price || 0) * count;

  if (state.gold < cost) {
    soundManager.playInsufficientGold();
    UIManager.showToast('골드가 부족합니다!', 'error');
    return;
  }

  isOpening = true;
  document.querySelectorAll('.btn-open-box').forEach(b => b.disabled = true);
  _openBoxModal(boxId);

  soundManager.playBoxShake(() => {
    const result = GamblingSystem.openBoxes(state, boxId, count);
    if (!result.success) {
      _closeBoxModal();
      soundManager.playInsufficientGold();
      UIManager.showToast('골드가 부족합니다!', 'error');
      isOpening = false;
      document.querySelectorAll('.btn-open-box').forEach(b => b.disabled = false);
      return;
    }
    soundManager.playBoxOpen();
    GameState.save(state);
    UIManager.updateHeader(state);
    _revealBoxModal(result.rewards);
    UIManager.showBoxResults(result.rewards);
    isOpening = false;
    document.querySelectorAll('.btn-open-box').forEach(b => b.disabled = false);
  });
};

window.handleBossSelectStage = function(stageId) {
  UIManager.selectBossStage(stageId);
  UIManager.renderBoss(state);
};

window.handleBossStart = function() {
  if (isBossing) return;
  soundManager.init();
  const stageId = UIManager.getSelectedBossStage();
  if (!stageId) return;

  const stage = CONFIG.BOSS_STAGES.find(s => s.id === stageId);
  if (!stage || !BossSystem.isStageUnlocked(stage, state)) return;

  isBossing = true;
  window.isBossingActive = true;
  BossCanvas.reset();

  const btn = document.getElementById('btn-boss-start');
  if (btn) btn.disabled = true;

  const playerStats = BossSystem.getPlayerStats(state);
  const battle = BossSystem.simulateBattle(playerStats, stage);

  const logEl = document.getElementById('boss-log');
  const resultEl = document.getElementById('boss-result');
  if (logEl) logEl.innerHTML = '';
  if (resultEl) resultEl.innerHTML = '';

  let roundIdx = 0;
  const ticker = setInterval(() => {
    if (roundIdx >= battle.rounds.length) {
      clearInterval(ticker);

      if (battle.cleared) {
        state.gold += stage.reward;
        const dropped = CraftSystem.rollWhetstoneDrops(state, stage.id);
        GameState.save(state);
        UIManager.updateHeader(state);
        const res = document.getElementById('boss-result');
        const whetMsg = dropped ? ' <span class="whetstone-drop">🪨 강화연마제 획득!</span>' : '';
        if (res) res.innerHTML = `<div class="boss-clear">🏆 클리어! +${stage.reward.toLocaleString()}G${whetMsg}</div>`;
        BossCanvas.animateVictory();
        soundManager.playRaidVictory();
      } else {
        const res = document.getElementById('boss-result');
        if (res) res.innerHTML = `<div class="boss-fail">💀 전투 실패...</div>`;
        BossCanvas.animateDefeat();
        soundManager.playRaidDefeat();
      }

      isBossing = false;
      window.isBossingActive = false;
      const startBtn = document.getElementById('btn-boss-start');
      if (startBtn) startBtn.disabled = false;
      return;
    }

    const r = battle.rounds[roundIdx];
    const playerPct = (r.playerHp / playerStats.maxHp) * 100;
    const bossPct = (r.bossHp / stage.bossHp) * 100;

    const playerBar = document.getElementById('boss-player-hp-bar');
    const bossBar = document.getElementById('boss-boss-hp-bar');
    const playerText = document.getElementById('boss-player-hp-text');
    const bossText = document.getElementById('boss-boss-hp-text');

    if (playerBar) playerBar.style.width = playerPct + '%';
    if (bossBar) bossBar.style.width = bossPct + '%';
    if (playerText) playerText.textContent = r.playerHp;
    if (bossText) bossText.textContent = r.bossHp;

    const log = document.getElementById('boss-log');
    if (log) {
      const entry = document.createElement('div');
      entry.className = 'boss-log-entry';
      entry.innerHTML = `<span class="boss-round">${r.round}R</span> ⚔️<b class="atk-num">-${r.playerDmg}</b> 보스HP<b>${r.bossHp}</b> | 👹<b class="dmg-num">-${r.bossDmg}</b> 내HP<b>${r.playerHp}</b>`;
      log.appendChild(entry);
      log.scrollTop = log.scrollHeight;
    }

    BossCanvas.animateRound();
    soundManager.playRaidAttack();
    setTimeout(() => soundManager.playRaidBossHit(), 150);
    if (r.bossDmg > 0) {
      setTimeout(() => soundManager.playRaidBossAttack(), 280);
      setTimeout(() => soundManager.playRaidPlayerHit(), 380);
    }
    roundIdx++;
  }, 500);
};

window.handleRaidActionStart = function() {
  if (isRaidActing) return;
  soundManager.init();

  isRaidActing = true;
  const startBtn = document.getElementById('btn-raidact-start');
  if (startBtn) startBtn.disabled = true;

  const resEl = document.getElementById('raidact-result');
  if (resEl) resEl.innerHTML = '';

  const playerStats = BossSystem.getPlayerStats(state);
  playerStats.swordGrade  = state.equippedSword?.grade  || null;
  playerStats.shieldGrade = state.equippedShield?.grade || null;
  playerStats.armorGrade  = state.equippedArmor?.grade  || null;
  playerStats.bootsGrade  = state.equippedBoots?.grade  || null;
  playerStats.helmetGrade = state.equippedHelmet?.grade || null;
  RaidAction.start(playerStats, function(result) {
    isRaidActing = false;
    if (startBtn) startBtn.disabled = false;
    const B = CONFIG.RAID_BOSS;
    if (result.victory) {
      state.gold += B.reward;
      const dropped = CraftSystem.rollWhetstoneDrops(state, 'normal');
      const helmetGrade = CraftSystem.rollHelmetDrop(state);
      GameState.save(state);
      UIManager.updateHeader(state);
      soundManager.playRaidVictory();
      const whetMsg   = dropped     ? ' <span class="whetstone-drop">🪨 강화연마제 획득!</span>' : '';
      const helmMsg   = helmetGrade ? ` <span class="whetstone-drop">🪖 ${CONFIG.GRADE_NAMES[helmetGrade]} 투구 획득!</span>` : '';
      if (resEl) resEl.innerHTML = `<div class="boss-clear">🏆 클리어! +${B.reward.toLocaleString()}G${whetMsg}${helmMsg}</div>`;
    } else {
      soundManager.playRaidDefeat();
      if (resEl) resEl.innerHTML = `<div class="boss-fail">💀 전투 실패...</div>`;
    }
  });
};

window.handleCraftAttempt = function(type) {
  if (isCrafting) return;
  soundManager.init();

  const slotMap = { sword: 'equippedSword', shield: 'equippedShield', armor: 'equippedArmor', boots: 'equippedBoots' };
  const slotKey = slotMap[type];
  const hasMaterial = state.inventory.some(
    i => i.type === type && i.grade === 'high' && i.enhancement === CONFIG.CRAFT.REQUIRED_ENHANCEMENT
  ) || (slotKey && state[slotKey]?.grade === 'high' && state[slotKey]?.enhancement === CONFIG.CRAFT.REQUIRED_ENHANCEMENT);

  if ((state.whetstones || 0) < CONFIG.CRAFT.WHETSTONE_COST) {
    soundManager.playInsufficientGold();
    UIManager.showToast('강화연마제가 부족합니다!', 'error');
    return;
  }
  if (!hasMaterial) {
    soundManager.playInsufficientGold();
    const typeName = _ITEM_TYPE_LABELS[type] || type;
    UIManager.showToast(`상급 ${typeName} +${CONFIG.CRAFT.REQUIRED_ENHANCEMENT}이 필요합니다!`, 'error');
    return;
  }

  isCrafting = true;
  soundManager.playEnhanceReady();
  _openCraftModal(type);

  setTimeout(() => {
    const result = CraftSystem.craftSupreme(state, type);

    if (result.reason === 'no_whetstone' || result.reason === 'no_material') {
      _closeEnhanceModal();
      UIManager.showToast('오류가 발생했습니다.', 'error');
      isCrafting = false;
      return;
    }

    _revealCraftModal(result, type);

    if (result.success) soundManager.playSuccess(true);
    else soundManager.playFail();

    GameState.save(state);
    UIManager.renderCraft(state);
    UIManager.renderInventory(state);
    UIManager.updateHeader(state);
    isCrafting = false;
  }, 1500);
};

window.handleItemDetail = function(item) {
  const meta = { sword: { icon: '⚔️', name: '칼' }, shield: { icon: '🛡️', name: '방패' }, armor: { icon: '🥋', name: '갑옷' }, boots: { icon: '👟', name: '신발' }, helmet: { icon: '🪖', name: '투구' } };
  const m = meta[item.type] || { icon: '❓', name: item.type };

  let stats = {};
  if (item.type === 'sword') {
    const s = CONFIG.ITEM_GRADE_STATS[item.grade];
    stats = { '⚔️ 공격력': Math.round(s.atk + item.enhancement * s.atkMult) };
  } else if (item.type === 'shield') {
    const s = CONFIG.ITEM_GRADE_STATS[item.grade];
    stats = { '🛡️ 방어력': Math.round(s.def + item.enhancement * s.defMult) };
  } else if (item.type === 'armor') {
    const s = CONFIG.ARMOR_GRADE_STATS[item.grade];
    stats = {
      '🛡️ 방어력': Math.round(s.def + item.enhancement * s.defMult),
      '❤️ 체력': Math.round(s.hp + item.enhancement * s.hpMult),
    };
  } else if (item.type === 'boots') {
    const s = CONFIG.BOOTS_GRADE_STATS[item.grade];
    stats = {
      '🛡️ 방어력': Math.round(s.def + item.enhancement * s.defMult),
      '❤️ 체력': Math.round(s.hp + item.enhancement * s.hpMult),
    };
  } else if (item.type === 'helmet') {
    const s = CONFIG.HELMET_GRADE_STATS[item.grade];
    if (s) stats = { '🛡️ 방어력': s.def, '❤️ 체력': s.hp };
  }

  const statRows = Object.entries(stats).map(([k, v]) =>
    `<div class="detail-stat-row"><span class="detail-stat-label">${k}</span><span class="detail-stat-val">${v}</span></div>`
  ).join('');

  document.getElementById('item-detail-icon').textContent = m.icon;
  document.getElementById('item-detail-name').textContent = `${CONFIG.GRADE_NAMES[item.grade]} ${m.name} +${item.enhancement}`;
  document.getElementById('item-detail-name').className = `item-detail-name grade-${item.grade}`;
  document.getElementById('item-detail-stats').innerHTML = statRows || '<p class="hint">스탯 없음</p>';
  document.getElementById('item-detail-modal').classList.add('active');
};

window.handleNewGame = function() {
  state = GameState.reset(true);
  UIManager.selectSlot(null);
  document.getElementById('gameover-screen').style.display = 'none';
  document.getElementById('main-content').style.display = '';

  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
  document.querySelector('.tab-btn[data-tab="equip"]').classList.add('active');
  document.getElementById('tab-equip').classList.add('active');

  UIManager.render(state);
};

document.addEventListener('DOMContentLoaded', init);
