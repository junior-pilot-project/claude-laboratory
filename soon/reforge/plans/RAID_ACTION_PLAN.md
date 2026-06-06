# 계획: 레이드→보스 리네임 + 새 레이드 액션 게임

## Context
기존 자동전투 "레이드" 시스템을 "보스"로 명칭 변경하고, 새로운 "레이드" 탭에 실시간 수동 조작 픽셀 액션 게임을 추가한다. PC 방향키/Z키 + 모바일 터치 버튼으로 조작하며, 픽셀아트 스타일의 캐릭터를 Canvas에 그린다.

---

## 작업 1: "레이드" → "보스" 전면 리네임

### 파일 생성/삭제
- `js/raidSystem.js` → 내용을 `js/bossSystem.js`로 새로 작성 (구 파일은 index.html에서 참조 제거)
- `js/raidCanvas.js` → 내용을 `js/bossCanvas.js`로 새로 작성

두 구 파일은 더 이상 로드하지 않으므로 삭제하거나 그대로 두어도 됨 (index.html 태그만 제거하면 됨).

### js/config.js
```
RAID_STAGES → BOSS_STAGES
RAID_ROUNDS → BOSS_ROUNDS
RAID_PLAYER_HP → BOSS_PLAYER_HP
```
주석 "// 레이드 스테이지" → "// 보스 스테이지"

### js/bossSystem.js (구 raidSystem.js 복사 후 수정)
- `const RaidSystem` → `const BossSystem`
- 내부 `CONFIG.RAID_*` → `CONFIG.BOSS_*`

### js/bossCanvas.js (구 raidCanvas.js 복사 후 수정)
- `const RaidCanvas` → `const BossCanvas`
- 내부 `CONFIG.RAID_*` → `CONFIG.BOSS_*`

### js/uiManager.js
- `let _selectedRaidStage` → `let _selectedBossStage`
- `function renderRaid` → `function renderBoss`
- 내부 DOM id: `raid-stats-box`, `raid-stages`, `raid-battle-area` → `boss-*`
- 동적 생성 HTML 내 `raid-canvas`, `raid-hp-bar*`, `raid-log`, `raid-result`, `btn-raid-start` → `boss-*`
- `RaidSystem.` → `BossSystem.`, `RaidCanvas.` → `BossCanvas.`
- `CONFIG.RAID_STAGES` → `CONFIG.BOSS_STAGES`, `CONFIG.RAID_PLAYER_HP` → `CONFIG.BOSS_PLAYER_HP`
- `window.isRaidingActive` → `window.isBossingActive`
- onclick 문자열: `handleRaidSelectStage` → `handleBossSelectStage`, `handleRaidStart` → `handleBossStart`
- `selectRaidStage` → `selectBossStage`, `getSelectedRaidStage` → `getSelectedBossStage`
- `render()` 분기: `activeTab === 'raid'` → `'boss'`, `renderRaid` → `renderBoss`
- 반환 객체 함수명 동일하게 변경
- `renderCraft()` 내 "레이드" 문자열 → "보스"

### js/main.js
- `let isRaiding` → `let isBossing`
- `window.handleRaidSelectStage` → `window.handleBossSelectStage`
- `window.handleRaidStart` → `window.handleBossStart`
- 내부 DOM id, CONFIG, BossSystem, BossCanvas 참조 모두 변경
- `window.isRaidingActive` → `window.isBossingActive`

### index.html
- 탭 버튼: `data-tab="raid"` → `data-tab="boss"`, 텍스트 `⚔️ 레이드` → `👾 보스`
- 섹션: `id="tab-raid"` → `id="tab-boss"`
- 내부 div id: `raid-stats-box`, `raid-stages`, `raid-battle-area` → `boss-*`
- script 태그: `raidSystem.js`→`bossSystem.js`, `raidCanvas.js`→`bossCanvas.js`

### style.css
CSS 셀렉터 일괄 치환 (`.raid-*` → `.boss-*`, `#raid-*` → `#boss-*`):
- `.raid-stats-box`, `.raid-stat-item`, `.raid-stages`, `.raid-stage-card`, `.raid-stage-label`
- `.raid-lock-msg`, `.raid-stage-info`, `.raid-stage-reward`, `.raid-battle-area`
- `.raid-hp-bars`, `.raid-hp-row`, `.raid-hp-label`, `.raid-hp-bar-wrap`, `.raid-hp-bar`
- `.raid-log`, `.raid-log-entry`, `.raid-round`, `.raid-result`, `.raid-clear`, `.raid-fail`
- `#raid-canvas` → `#boss-canvas`

---

## 작업 2: 새 "레이드" 탭 — 픽셀 액션 게임

### js/config.js에 추가
```js
// 레이드 액션 게임 설정
RAID_ACTION: {
  CANVAS_W: 160,
  CANVAS_H: 96,
  SCALE: 3,              // CSS: 480×288
  PLAYER_W: 16,
  PLAYER_H: 24,
  GROUND_Y: 82,          // 논리 픽셀 기준 바닥 Y
  ATTACK_RANGE: 22,      // 공격 판정 거리 (논리 px)
  WALK_SPEED: 42,        // px/sec
  JUMP_FORCE: 180,       // 초기 상승 속도 (논리 px/sec)
  GRAVITY: 380,          // 중력 가속도 (논리 px/sec²)
  PLAYER_HP: 200,
  ATTACK_COOLDOWN: 0.45, // 초
},
// 레이드 액션 스테이지 (HP는 자동전투 3배, 보스ATK는 수동조작 고려해 조정)
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
```

### index.html에 추가
탭 버튼 (보스 탭 다음에 삽입):
```html
<button class="tab-btn" data-tab="raid">⚔️ 레이드</button>
```

레이드 섹션 (tab-boss 섹션 다음에 삽입, **정적 HTML** — 캔버스를 동적 생성하지 않음):
```html
<section class="tab-content" id="tab-raid">
  <div id="raidact-stages" class="boss-stages"></div>
  <div class="raidact-canvas-wrap">
    <canvas id="raidact-canvas" width="160" height="96"></canvas>
  </div>
  <div class="raidact-hpbars">
    <div class="raidact-hp-row">
      <span>👤</span>
      <div class="raidact-bar-wrap"><div class="raidact-bar player" id="raidact-player-hp"></div></div>
      <span id="raidact-player-hp-text">200</span>
    </div>
    <div class="raidact-hp-row">
      <span>👹</span>
      <div class="raidact-bar-wrap"><div class="raidact-bar boss" id="raidact-boss-hp"></div></div>
      <span id="raidact-boss-hp-text">-</span>
    </div>
  </div>
  <div id="raidact-result" class="raidact-result"></div>
  <button id="btn-raidact-start" class="btn-primary btn-lg" onclick="window.handleRaidActionStart()">⚔️ 전투 시작</button>
  <div class="raidact-controls" id="raidact-controls">
    <button class="raidact-btn" id="raidact-left">◀</button>
    <button class="raidact-btn" id="raidact-jump">▲</button>
    <button class="raidact-btn raidact-atk" id="raidact-attack">⚔</button>
    <button class="raidact-btn" id="raidact-right">▶</button>
  </div>
</section>
```

스크립트 로드 순서 (index.html 하단):
```
config.js → gameState.js → itemSystem.js → gamblingSystem.js
→ rankingSystem.js → soundManager.js → bossSystem.js → craftSystem.js → bossCanvas.js
→ raidAction.js → uiManager.js → main.js
```

### js/raidAction.js (신규 파일)
전역 패턴 (IIFE → `const RaidAction = (() => { ... return {...}; })()`)

**상태 변수 (모듈 스코프):**
```
_canvas, _ctx, _rafId
_phase: 'idle' | 'ready' | 'playing' | 'victory' | 'defeat'
_selectedStageId, _currentStage
_lastTs, _animTimer, _walkFrame
_endTimer
_keys: { left, right, up, attack }
_attackEdge  // 공격 에지 트리거
_jumpEdge    // 점프 에지 트리거 (한 번만 발동)
_proj[]      // 데몬 화염구 배열
```

**플레이어 엔티티:**
```
_player = {
  x, y, w:16, h:24,
  vy: 0,         // 수직 속도 (중력 적용)
  onGround: true,
  hp, maxHp,
  facingRight: true,
  state: 'idle'|'walk'|'jump'|'attack'|'hurt',
  stateTimer,    // state 지속 시간 카운트다운
  attackCooldown,
  hurtTimer,
  flashTimer,
}
```

**보스 엔티티:**
```
_boss = {
  x, y, w, h,           // 스테이지별 크기
  hp, maxHp,
  facingRight: false,
  state: 'idle'|'chase'|'windup'|'attack'|'hurt',
  stateTimer,
  aiTimer,              // 다음 공격까지 남은 시간
  flashTimer,
  // 고블린: chargeVx (돌진 속도)
  // 오크: knockbackTarget (넉백 방향)
  // 데몬: teleportReady (순간이동 플래그)
}
```

**주요 함수:**
- `init(canvasId)` — 캔버스 획득, keydown/keyup 리스너, 모바일 버튼 touchstart/touchend 리스너
- `start(stageId, playerStats, onEnd)` — 엔티티 초기화, phase='playing', rAF 시작
- `stop()` — cancelAnimationFrame, phase='idle'
- `selectStage(id)` / `getSelectedStage()` — 스테이지 선택 상태 관리
- `_loop(ts)` — dt 계산(최대 50ms 캡), `_update(dt)`, `_draw()`, `_updateHpUI()`
- `_update(dt)` — playing 시: `_updatePlayer(dt)`, `_updateBoss(dt)`, `_checkEnd()`
- `_updatePlayer(dt)` — 좌우 이동, 점프(vy=-JUMP_FORCE, onGround=false), 중력(vy+=GRAVITY*dt), 착지(y>=GROUND_Y-h), 경계 클램프, 공격 쿨다운
- `_tryAttack()` — 쿨다운 0 이하이고 보스와 거리 <= ATTACK_RANGE이면 보스 HP 감소
- `_updateBoss(dt)` — 스테이지별 AI 분기
  - `_goblinAI(dt)`: aiTimer → 플레이어 방향으로 돌진, 근접 시 할퀴기
  - `_orcAI(dt)`: 플레이어 추격, 일정 거리 이내 도끼 내리치기 + 넉백
  - `_demonAI(dt)`: teleport (x 순간이동), 투사체 발사, `_proj[]` 업데이트
- `_checkEnd()` — player.hp<=0 → 'defeat', boss.hp<=0 → 'victory'
- `_handleEnd(victory)` — 3초 대기 후 onEnd 콜백 호출 (보상은 main.js에서 처리)

**렌더링 함수:**
- `_draw()` — `_drawBg()`, `_drawPlayer()`, `_drawBoss()`, `_drawProjectiles()`, `_drawHudOverlay()`
- `_drawBg()` — 논리 160×96 기준, 스테이지별 색상 테마
  - easy: 하늘(#7ec8e3), 풀밭(#4a7c59)
  - normal: 흐린 하늘(#8aa0b0), 돌바닥(#556070)
  - hard: 어두운 하늘(#1a0a1a), 용암빛 바닥(#3d1010)
  - 간단한 픽셀 배경 오브젝트 (나무 실루엣, 돌기둥 등)
- `_drawPlayer()` — `ctx.save() / translate(x, GROUND_Y-h)`, fillRect 블록 조합
  - 걷기 2프레임 애니메이션 (다리 Y 오프셋)
  - 점프 state: 몸통 약간 기울임 (x offset)
  - 공격 state: 칼 블록 X+4 offset, 팔 뻗음
  - hurt state: ctx.globalAlpha 0.6 (반투명)
  - flashTimer: 전체 실루엣 위에 흰 오버레이
- `_drawBoss(id)` — 스테이지별 분기, idleBob = sin(time*2)*1 (Y ±1)
  - `_drawGoblin()` (24×32): 녹색 블록 뭉치, 뿔 2개, 노란 눈
  - `_drawOrc()` (36×48): 회록색 큰 몸통, 회색 도끼
  - `_drawDemon()` (48×64): 검정/보라 몸통, 날개 블록, 붉은 눈
  - windup state: 약간 뒤로 이동 오프셋
  - attack state: 플레이어 방향으로 이동 오프셋
- `_drawProjectiles()` — 데몬 화염구: 주황 3×3 + 밝은 1×1 코어
- `_drawHudOverlay()` — victory/defeat 시 텍스트 (ctx.fillText, 폰트 "8px monospace")
- `_updateHpUI()` — DOM HP 바 & 텍스트 업데이트 (rAF 매프레임)

**입력 처리:**
- PC: `ArrowLeft`/`ArrowRight` → `_keys.left/right`, `ArrowUp`/`KeyX` → `_jumpEdge = true`, `KeyZ`/`Space` → `_attackEdge = true`
- 모바일 (`#raidact-left/right/jump/attack`): touchstart → 키 on / jumpEdge, touchend → 키 off
  - `e.preventDefault()` with `{ passive: false }` (스크롤 방지)

### js/uiManager.js에 추가
`renderRaidAction(state)` 함수:
- `#raidact-stages`에 스테이지 카드 렌더링 (`BossSystem.isStageUnlocked` 재사용)
- 선택된 스테이지 강조
- onclick: `handleRaidActionSelectStage(stageId)`
- 선택 시 HP 바 `#raidact-boss-hp-text`에 보스 HP 표시
- `RaidAction.init('raidact-canvas')` 호출 (캔버스 초기화)

`render()` 분기에 추가:
```js
else if (activeTab === 'raid') renderRaidAction(state);
```

반환 객체에 `renderRaidAction` 추가.

### js/main.js에 추가
```js
let isRaidActing = false;

window.handleRaidActionSelectStage = function(stageId) {
  RaidAction.selectStage(stageId);
  UIManager.renderRaidAction(state);
};

window.handleRaidActionStart = function() {
  if (isRaidActing) return;
  soundManager.init();
  const stageId = RaidAction.getSelectedStage();
  if (!stageId) return;
  const stage = CONFIG.RAID_ACTION_STAGES.find(s => s.id === stageId);
  if (!stage || !BossSystem.isStageUnlocked(
    CONFIG.BOSS_STAGES.find(s => s.id === stageId), state)) return;

  isRaidActing = true;
  document.getElementById('btn-raidact-start').disabled = true;

  const playerStats = BossSystem.getPlayerStats(state);
  RaidAction.start(stageId, playerStats, function(result) {
    isRaidActing = false;
    document.getElementById('btn-raidact-start').disabled = false;
    if (result.victory) {
      state.gold += stage.reward;
      const dropped = CraftSystem.rollWhetstoneDrops(state, stage.id);
      GameState.save(state);
      UIManager.updateHeader(state);
      soundManager.playRaidVictory();
      const resEl = document.getElementById('raidact-result');
      const whetMsg = dropped ? ' <span class="whetstone-drop">🪨 강화연마제 획득!</span>' : '';
      if (resEl) resEl.innerHTML = `<div class="boss-clear">🏆 클리어! +${stage.reward.toLocaleString()}G${whetMsg}</div>`;
    } else {
      soundManager.playRaidDefeat();
      const resEl = document.getElementById('raidact-result');
      if (resEl) resEl.innerHTML = `<div class="boss-fail">💀 전투 실패...</div>`;
    }
  });
};
```

### style.css에 추가 (`/* ===== 레이드 액션 ===== */` 섹션)
```css
.raidact-canvas-wrap {
  display: flex; justify-content: center; margin-bottom: 10px;
}
#raidact-canvas {
  width: 480px; height: 288px;
  max-width: 100%;
  border: 2px solid var(--border); border-radius: 6px;
  image-rendering: pixelated; image-rendering: crisp-edges;
  display: block;
}
.raidact-hpbars { display: flex; flex-direction: column; gap: 6px; max-width: 480px; margin: 0 auto; }
.raidact-hp-row { display: flex; align-items: center; gap: 8px; }
.raidact-bar-wrap { flex: 1; background: var(--border); border-radius: 4px; height: 12px; overflow: hidden; }
.raidact-bar { height: 100%; border-radius: 4px; transition: width 0.08s linear; }
.raidact-bar.player { background: linear-gradient(90deg, #43a047, #81c784); }
.raidact-bar.boss   { background: linear-gradient(90deg, #e53935, #e57373); }
.raidact-result { text-align: center; min-height: 28px; margin: 6px 0; }
.raidact-controls {
  display: flex; gap: 12px; justify-content: center; margin-top: 12px;
}
.raidact-btn {
  width: 72px; height: 72px; font-size: 1.8rem;
  background: var(--bg-card); border: 2px solid var(--border); border-radius: 12px;
  color: var(--text); cursor: pointer; user-select: none; touch-action: none;
  transition: transform 0.08s, background 0.08s;
}
.raidact-btn:active { background: var(--accent); border-color: var(--accent); transform: scale(0.92); }
.raidact-atk { color: var(--gold); border-color: var(--gold); }
```

---

## 구현 순서

**Phase 1 — 보스 리네임:**
1. `js/bossSystem.js` 생성 (raidSystem.js 복사 + 심볼 변경)
2. `js/bossCanvas.js` 생성 (raidCanvas.js 복사 + 심볼 변경)
3. `js/config.js` 수정 (`RAID_*` → `BOSS_*`)
4. `js/uiManager.js` 수정 (renderRaid→renderBoss, DOM id, 전역 참조 전체)
5. `js/main.js` 수정 (핸들러명, 플래그, DOM id, 전역 참조 전체)
6. `index.html` 수정 (탭 버튼, section id, script 태그)
7. `style.css` 수정 (`.raid-*`→`.boss-*` 전체 치환)

**Phase 2 — 레이드 액션:**
1. `js/config.js`에 `RAID_ACTION`, `RAID_ACTION_STAGES`, `RAID_BOSS_SIZES` 추가
2. `js/raidAction.js` 생성 (게임 루프, 엔티티, AI, 픽셀렌더링 전체)
3. `index.html`에 레이드 탭 버튼, 섹션 HTML, script 태그 추가
4. `style.css`에 레이드 액션 CSS 추가
5. `js/uiManager.js`에 `renderRaidAction()` 추가, `render()` 분기 추가
6. `js/main.js`에 `handleRaidActionSelectStage`, `handleRaidActionStart` 추가

---

## 검증

**Phase 1:**
- 보스 탭 클릭 → 스테이지 카드 → 전투 시작 → 캔버스 애니메이션 → 승리/패배 → 골드 증가 정상 동작
- Console: `BossSystem`, `BossCanvas`, `CONFIG.BOSS_STAGES` 접근 가능, `RaidSystem` undefined

**Phase 2:**
- 레이드 탭 클릭 → 스테이지 선택 → 전투 시작
- 캔버스 픽셀이 선명한지 (흐릿하지 않음) 확인
- PC: 방향키(←→)로 이동, ↑/X로 점프, Z/스페이스로 공격, 보스에 데미지 반영
- 점프 중 공격 가능한지 확인
- 모바일 에뮬레이션(DevTools): ◀▲⚔▶ 버튼 동작, 스크롤 방지 확인
- 승리: 골드 증가, 연마제 드롭 가능 여부
- 패배: 패배 메시지 표시
- 탭 전환 후 재진입 시 rAF 중복 없음 (stop() 호출 확인)
