// UI 관리자
const UIManager = (() => {
  let _state = null;
  let _selectedSlotKey = null;
  let _selectedBossStage = null;
  let _selectedRaidActionStage = null;

  function formatGold(n) {
    return n.toLocaleString('ko-KR') + '원';
  }

  // 헤더 업데이트
  function updateHeader(state) {
    const total = GameState.getTotalEnhancement(state);
    document.getElementById('gold-display').textContent = formatGold(state.gold);
    document.getElementById('enhance-sum').textContent = `${total} / ${CONFIG.GOAL}`;
    const pct = Math.min(100, Math.floor((total / CONFIG.GOAL) * 100));
    document.getElementById('progress-bar').style.width = pct + '%';
  }

  function startTimer() {}
  function stopTimer() {}

  // 탭 1: 장비/강화 렌더링
  function renderEquip(state) {
    renderSlot('sword', state);
    renderSlot('shield', state);
    renderEnhancePanel(state);
    renderInventory(state);
  }

  function renderSlot(type, state) {
    const slotKey = ItemSystem.getSlotKey(type);
    const item = state[slotKey];
    const el = document.getElementById(`slot-${type}`);
    if (!el) return;

    if (item) {
      el.innerHTML = `
        <div class="item-icon">${type === 'sword' ? '⚔️' : '🛡️'}</div>
        <div class="item-info">
          <span class="item-grade grade-${item.grade}">${CONFIG.GRADE_NAMES[item.grade]}</span>
          <span class="item-name">${type === 'sword' ? '칼' : '방패'} +${item.enhancement}</span>
        </div>
        <button class="btn-sm btn-unequip" data-slot="${slotKey}">해제</button>
        <button class="btn-sm btn-enhance-slot ${_selectedSlotKey === slotKey ? 'selected' : ''}" data-slot="${slotKey}">강화</button>
      `;
    } else {
      el.innerHTML = `<div class="slot-empty">슬롯 비어있음<br><small>${type === 'sword' ? '⚔️ 칼' : '🛡️ 방패'}</small></div>`;
    }
  }

  function renderEnhancePanel(state) {
    const panel = document.getElementById('enhance-panel');
    if (!_selectedSlotKey || !state[_selectedSlotKey]) {
      panel.innerHTML = `<p class="hint">슬롯에서 [강화] 버튼을 눌러 선택하세요.</p>`;
      return;
    }
    const item = state[_selectedSlotKey];
    const prob = getProbability(item.grade, item.enhancement);
    const cost = getEnhanceCost(item.grade, item.enhancement);
    panel.innerHTML = `
      <div class="enhance-info">
        <span>선택: <b>${CONFIG.GRADE_NAMES[item.grade]} ${item.type === 'sword' ? '칼' : '방패'} +${item.enhancement}</b></span>
        <span>성공 확률: <b class="${prob <= 30 ? 'text-danger' : 'text-success'}">${prob}%</b></span>
        <span>비용: <b>${formatGold(cost)}</b></span>
      </div>
      <button id="btn-do-enhance" class="btn-primary btn-lg">🔨 강화 시도</button>
      <div id="enhance-result"></div>
    `;
    document.getElementById('btn-do-enhance').addEventListener('click', () => {
      window.handleEnhance(_selectedSlotKey);
    });
  }

  function renderInventory(state) {
    const container = document.getElementById('inventory-list');
    if (!container) return;
    const whetCount = state.whetstones || 0;
    const whetHtml = whetCount > 0
      ? `<div class="inv-item inv-whetstone">
          <span>🪨</span>
          <span class="item-grade grade-high">재료</span>
          <span>강화연마제</span>
          <span class="whet-count">× ${whetCount}</span>
        </div>`
      : '';
    if (!state.inventory.length) {
      container.innerHTML = whetHtml || `<p class="hint">인벤토리가 비어있습니다.</p>`;
      return;
    }
    container.innerHTML = whetHtml + state.inventory.map(item => `
      <div class="inv-item" data-id="${item.id}">
        <span>${item.type === 'sword' ? '⚔️' : '🛡️'}</span>
        <span class="item-grade grade-${item.grade}">${CONFIG.GRADE_NAMES[item.grade]}</span>
        <span>${item.type === 'sword' ? '칼' : '방패'} +${item.enhancement}</span>
        <button class="btn-sm btn-equip" data-id="${item.id}">착용</button>
        <button class="btn-sm btn-remove-item" data-id="${item.id}">🗑️</button>
      </div>
    `).join('');

    container.querySelectorAll('.btn-equip').forEach(btn => {
      btn.addEventListener('click', () => {
        window.handleEquip(btn.dataset.id);
      });
    });

    container.querySelectorAll('.btn-remove-item').forEach(btn => {
      btn.addEventListener('click', () => {
        window.handleRemoveItem(btn.dataset.id);
      });
    });
  }

  // 탭 2: 상점 렌더링
  function renderShop(state) {
    const container = document.getElementById('shop-items');
    if (!container) return;
    const types = ['sword', 'shield'];
    const grades = ['low', 'mid', 'high'];
    const typeLabels = { sword: '칼', shield: '방패' };

    container.innerHTML = grades.map(grade =>
      types.map(type => `
        <div class="shop-item">
          <div class="shop-item-icon">${type === 'sword' ? '⚔️' : '🛡️'}</div>
          <div class="shop-item-name">${CONFIG.GRADE_NAMES[grade]} ${typeLabels[type]}</div>
          <div class="shop-item-price">${formatGold(CONFIG.ITEM_PRICES[grade])}</div>
          <button class="btn-buy btn-primary" data-type="${type}" data-grade="${grade}">구매</button>
        </div>
      `).join('')
    ).join('');

    container.querySelectorAll('.btn-buy').forEach(btn => {
      btn.addEventListener('click', () => {
        window.handleBuy(btn.dataset.type, btn.dataset.grade);
      });
    });
  }

  // 탭 3: 도박장 렌더링
  function renderGambling() {
    const container = document.getElementById('gambling-boxes');
    if (!container) return;
    container.innerHTML = CONFIG.BOXES.map(box => `
      <div class="box-row">
        <div class="box-name">${box.name}</div>
        <div class="box-price">${box.price === 0 ? '무료' : formatGold(box.price)}</div>
        <div class="box-count-wrap">
          개수: <input type="number" id="count-${box.id}" min="1" max="${box.maxCount}" value="1" class="count-input">
        </div>
        <button class="btn-primary btn-open-box" data-box="${box.id}">열기</button>
      </div>
    `).join('');

    container.querySelectorAll('.btn-open-box').forEach(btn => {
      btn.addEventListener('click', () => {
        const boxId = btn.dataset.box;
        const countEl = document.getElementById(`count-${boxId}`);
        const count = countEl ? parseInt(countEl.value) : 1;
        window.handleOpenBox(boxId, count);
      });
    });
  }

  // 탭 4: 보스 렌더링
  function renderBoss(state) {
    const playerStats = BossSystem.getPlayerStats(state);

    const statsBox = document.getElementById('boss-stats-box');
    if (statsBox) {
      statsBox.innerHTML = `
        <div class="boss-stat-item">⚔️ ATK <strong>${playerStats.atk}</strong></div>
        <div class="boss-stat-item">🛡️ DEF <strong>${playerStats.def}</strong></div>
      `;
    }

    const stagesEl = document.getElementById('boss-stages');
    if (stagesEl) {
      stagesEl.innerHTML = CONFIG.BOSS_STAGES.map(stage => {
        const unlocked = BossSystem.isStageUnlocked(stage, state);
        const selected = _selectedBossStage === stage.id;
        const innerHtml = unlocked
          ? `<div class="boss-stage-info">HP <b>${stage.bossHp}</b> / ATK <b>${stage.bossAtk}</b></div>
             <div class="boss-stage-reward">💰 ${stage.reward.toLocaleString()}원</div>`
          : `<div class="boss-lock-msg">🔒 강화합 ${stage.unlock} 필요</div>`;
        return `
          <div class="boss-stage-card ${unlocked ? 'unlocked' : 'locked'} ${selected ? 'selected' : ''}"
               ${unlocked ? `onclick="window.handleBossSelectStage('${stage.id}')"` : ''}>
            <div class="boss-stage-label">${stage.label}</div>
            ${innerHtml}
          </div>
        `;
      }).join('');
    }

    const battleArea = document.getElementById('boss-battle-area');
    if (!battleArea) return;
    if (window.isBossingActive) return;

    if (_selectedBossStage) {
      const stage = CONFIG.BOSS_STAGES.find(s => s.id === _selectedBossStage);
      battleArea.innerHTML = `
        <canvas id="boss-canvas" width="420" height="260"></canvas>
        <div class="boss-hp-bars">
          <div class="boss-hp-row">
            <span class="boss-hp-label">👤 플레이어</span>
            <div class="boss-hp-bar-wrap">
              <div class="boss-hp-bar player-hp" id="boss-player-hp-bar" style="width:100%"></div>
            </div>
            <span id="boss-player-hp-text">${CONFIG.BOSS_PLAYER_HP}</span>
          </div>
          <div class="boss-hp-row">
            <span class="boss-hp-label">👹 보스</span>
            <div class="boss-hp-bar-wrap">
              <div class="boss-hp-bar boss-hp" id="boss-boss-hp-bar" style="width:100%"></div>
            </div>
            <span id="boss-boss-hp-text">${stage.bossHp}</span>
          </div>
        </div>
        <div id="boss-log" class="boss-log"></div>
        <div id="boss-result" class="boss-result"></div>
        <button id="btn-boss-start" class="btn-primary btn-lg" onclick="window.handleBossStart()">⚔️ 전투 시작</button>
      `;
      BossCanvas.init('boss-canvas', stage, state);
    } else {
      BossCanvas.stop();
      battleArea.innerHTML = '<p class="hint">스테이지를 선택하세요.</p>';
    }
  }

  // 탭 5 (레이드 액션): 렌더링
  function renderRaidAction(state) {
    const stagesEl = document.getElementById('raidact-stages');
    if (stagesEl) {
      stagesEl.innerHTML = CONFIG.RAID_ACTION_STAGES.map(stage => {
        const bossStageCfg = CONFIG.BOSS_STAGES.find(s => s.id === stage.id);
        const unlocked = bossStageCfg ? BossSystem.isStageUnlocked(bossStageCfg, state) : true;
        const selected = _selectedRaidActionStage === stage.id;
        const innerHtml = unlocked
          ? `<div class="boss-stage-info">HP <b>${stage.bossHp}</b> / ATK <b>${stage.bossAtk}</b></div>
             <div class="boss-stage-reward">💰 ${stage.reward.toLocaleString()}원</div>`
          : `<div class="boss-lock-msg">🔒 강화합 ${bossStageCfg?.unlock ?? 0} 필요</div>`;
        return `
          <div class="boss-stage-card ${unlocked ? 'unlocked' : 'locked'} ${selected ? 'selected' : ''}"
               ${unlocked ? `onclick="window.handleRaidActionSelectStage('${stage.id}')"` : ''}>
            <div class="boss-stage-label">${stage.label}</div>
            ${innerHtml}
          </div>
        `;
      }).join('');
    }

    if (_selectedRaidActionStage) {
      const stage = CONFIG.RAID_ACTION_STAGES.find(s => s.id === _selectedRaidActionStage);
      const bossHpText = document.getElementById('raidact-boss-hp-text');
      if (bossHpText && stage) bossHpText.textContent = stage.bossHp;
    }

    RaidAction.init('raidact-canvas');
  }

  // 강화 결과 메시지 표시
  function showEnhanceResult(result) {
    const el = document.getElementById('enhance-result');
    if (!el) return;
    if (result.success) {
      el.innerHTML = `<div class="result-success">✨ 강화 성공! +${result.enhancement}</div>`;
    } else {
      el.innerHTML = `<div class="result-fail">💥 강화 실패... (${result.prob}% 도전)</div>`;
    }
    setTimeout(() => { if (el) el.innerHTML = ''; }, 2000);
  }

  // 박스 오픈 결과 렌더링
  function showBoxResults(rewards) {
    const area = document.getElementById('box-result-area');
    if (!area) return;
    area.innerHTML = rewards.map(r => `<span class="coin-result">🪙 +${r.toLocaleString()}원</span>`).join(' ');
    soundManager.playCoin();
    setTimeout(() => { area.innerHTML = ''; }, 4000);
  }

  // 에러 토스트
  function showToast(msg, type = 'error') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = msg;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 2000);
  }

  // 강화 정보 팝업 바인딩
  function bindProbInfo() {
    const btn = document.getElementById('btn-prob-info');
    const modal = document.getElementById('prob-info-modal');
    const closeBtn = document.getElementById('prob-info-close');
    if (!btn || !modal) return;

    let currentGrade = 'high';

    function renderTable(grade) {
      const container = document.getElementById('prob-info-table');
      if (!container) return;

      const isSupreme = grade === 'supreme';
      const start = isSupreme ? CONFIG.SUPREME_START_LEVEL : 0;
      const count = isSupreme ? 9 : 20;

      const rows = Array.from({ length: count }, (_, i) => {
        const level = start + i;
        const prob = getProbability(grade, level);
        const cost = getEnhanceCost(grade, level);
        const isHard = prob <= 30;
        return `<tr class="${isHard ? 'hard-zone' : ''}">
          <td>+${level} → +${level + 1}</td>
          <td class="${isHard ? 'text-danger' : 'text-success'}">${prob}%</td>
          <td>${formatGold(cost)}</td>
        </tr>`;
      }).join('');
      container.innerHTML = `
        <table class="prob-table">
          <thead><tr><th>단계</th><th>확률</th><th>비용</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      `;
    }

    btn.addEventListener('click', () => {
      renderTable(currentGrade);
      modal.classList.add('active');
    });

    closeBtn.addEventListener('click', () => modal.classList.remove('active'));

    modal.addEventListener('click', e => {
      if (e.target === modal) modal.classList.remove('active');
    });

    modal.querySelectorAll('.prob-tab-btn').forEach(tabBtn => {
      tabBtn.addEventListener('click', () => {
        modal.querySelectorAll('.prob-tab-btn').forEach(b => b.classList.remove('active'));
        tabBtn.classList.add('active');
        currentGrade = tabBtn.dataset.grade;
        renderTable(currentGrade);
      });
    });
  }

  // 탭 6: 제작 렌더링
  function renderCraft(state) {
    const container = document.getElementById('tab-craft');
    if (!container) return;

    const whetCount = state.whetstones || 0;
    const types = [
      { key: 'sword', label: '칼', icon: '⚔️' },
      { key: 'shield', label: '방패', icon: '🛡️' },
    ];

    const panelsHtml = types.map(t => {
      const hasMaterial = _hasHighPlusEleven(state, t.key);
      const canCraft = hasMaterial && whetCount >= CONFIG.CRAFT.WHETSTONE_COST;
      const materialClass = hasMaterial ? 'craft-check ok' : 'craft-check ng';
      const whetClass = whetCount >= CONFIG.CRAFT.WHETSTONE_COST ? 'craft-check ok' : 'craft-check ng';
      return `
        <div class="craft-panel">
          <div class="craft-panel-title">${t.icon} ${t.label} 제작</div>
          <div class="craft-requirements">
            <div class="${materialClass}">
              ${hasMaterial ? '✅' : '❌'} 상급 ${t.label} +${CONFIG.CRAFT.REQUIRED_ENHANCEMENT}
            </div>
            <div class="${whetClass}">
              ${whetCount >= CONFIG.CRAFT.WHETSTONE_COST ? '✅' : '❌'} 강화연마제 × ${CONFIG.CRAFT.WHETSTONE_COST}
            </div>
          </div>
          <div class="craft-rate">제작 성공률: <b>${CONFIG.CRAFT.SUCCESS_RATE}%</b></div>
          <button class="btn-primary btn-craft ${canCraft ? '' : 'disabled'}"
            ${canCraft ? `onclick="window.handleCraftAttempt('${t.key}')"` : 'disabled'}>
            🔨 제작 시도
          </button>
        </div>
      `;
    }).join('');

    container.innerHTML = `
      <div class="craft-whetstone-info">
        🪨 강화연마제 보유: <b>${whetCount}개</b>
        <div class="craft-drop-hint">하급 보스 1% / 중급 10% / 상급 30% 확률로 드롭</div>
      </div>
      <div class="craft-panels">${panelsHtml}</div>
    `;
  }

  function _hasHighPlusEleven(state, type) {
    const inInv = state.inventory.some(
      i => i.type === type && i.grade === 'high' && i.enhancement === CONFIG.CRAFT.REQUIRED_ENHANCEMENT
    );
    if (inInv) return true;
    const slotKey = type === 'sword' ? 'equippedSword' : 'equippedShield';
    const equipped = state[slotKey];
    return !!(equipped && equipped.grade === 'high' && equipped.enhancement === CONFIG.CRAFT.REQUIRED_ENHANCEMENT);
  }

  // 랭킹 화면 렌더링
  function renderRanking(state) {
    const container = document.getElementById('ranking-list');
    if (!container) return;
    if (!state.rankings.length) {
      container.innerHTML = '<p class="hint">기록 없음</p>';
      return;
    }
    container.innerHTML = state.rankings.map((r, i) => `
      <div class="rank-row">
        <span class="rank-num">${i + 1}.</span>
        <span class="rank-date">${r.date}</span>
        ${i === 0 ? '<span class="rank-badge">최신 기록</span>' : ''}
      </div>
    `).join('');
  }

  // 게임 종료 화면 표시
  function showGameOver(state) {
    const screen = document.getElementById('gameover-screen');
    const main = document.getElementById('main-content');
    if (screen) screen.style.display = 'flex';
    if (main) main.style.display = 'none';
    renderRanking(state);
    soundManager.playVictory();
  }

  // 슬롯 선택
  function selectSlot(slotKey) {
    _selectedSlotKey = slotKey;
  }

  function getSelectedSlot() {
    return _selectedSlotKey;
  }

  function selectBossStage(stageId) {
    _selectedBossStage = stageId;
  }

  function getSelectedBossStage() {
    return _selectedBossStage;
  }

  function selectRaidActionStage(stageId) {
    _selectedRaidActionStage = stageId;
  }

  function getSelectedRaidActionStage() {
    return _selectedRaidActionStage;
  }

  // 전체 UI 갱신
  function render(state) {
    _state = state;
    updateHeader(state);
    const activeTab = document.querySelector('.tab-btn.active')?.dataset?.tab || 'equip';
    if (activeTab === 'equip') renderEquip(state);
    else if (activeTab === 'shop') renderShop(state);
    else if (activeTab === 'gambling') renderGambling();
    else if (activeTab === 'boss') renderBoss(state);
    else if (activeTab === 'raid') renderRaidAction(state);
    else if (activeTab === 'craft') renderCraft(state);
  }

  return {
    render,
    renderEquip,
    renderShop,
    renderGambling,
    renderBoss,
    renderRaidAction,
    showEnhanceResult,
    showBoxResults,
    showToast,
    showGameOver,
    bindProbInfo,
    startTimer,
    stopTimer,
    selectSlot,
    getSelectedSlot,
    selectBossStage,
    getSelectedBossStage,
    selectRaidActionStage,
    getSelectedRaidActionStage,
    renderCraft,
    renderInventory,
    formatGold,
    updateHeader,
  };
})();
