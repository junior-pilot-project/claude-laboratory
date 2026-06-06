const RaidAction = (() => {
  let _canvas, _ctx, _rafId;
  let _phase = 'idle';
  let _selectedStageId = null;
  let _currentStage = null;
  let _playerStats = null;
  let _onEnd = null;

  let _lastTs = 0;
  let _walkTimer = 0;
  let _walkFrame = 0;
  let _gameTime = 0;
  let _endTimer = 0;

  const _keys = { left: false, right: false };
  let _attackEdge = false;
  let _jumpEdge = false;
  let _proj = [];

  let _player = {};
  let _boss = {};

  function _initPlayer() {
    const C = CONFIG.RAID_ACTION;
    const ps = _playerStats || { atk: 1, def: 0 };
    return {
      x: 10,
      y: C.GROUND_Y - C.PLAYER_H,
      w: C.PLAYER_W,
      h: C.PLAYER_H,
      vy: 0,
      onGround: true,
      hp: C.PLAYER_HP,
      maxHp: C.PLAYER_HP,
      facingRight: true,
      state: 'idle',
      stateTimer: 0,
      attackCooldown: 0,
      flashTimer: 0,
      atk: ps.atk,
      def: ps.def,
    };
  }

  function _initBoss(stageId) {
    const C = CONFIG.RAID_ACTION;
    const sz = CONFIG.RAID_BOSS_SIZES[stageId];
    const st = CONFIG.RAID_ACTION_STAGES.find(s => s.id === stageId);
    return {
      x: C.CANVAS_W - sz.w - 6,
      y: C.GROUND_Y - sz.h,
      w: sz.w,
      h: sz.h,
      hp: st.bossHp,
      maxHp: st.bossHp,
      facingRight: false,
      state: 'idle',
      stateTimer: 0,
      aiTimer: st.bossAtkInterval * 0.6,
      flashTimer: 0,
    };
  }

  function init(canvasId) {
    const c = document.getElementById(canvasId);
    if (!c) return;
    if (_canvas !== c) {
      _canvas = c;
      _ctx = c.getContext('2d');
      _setupKeyListeners();
      _setupTouchListeners();
    }
  }

  let _keysAttached = false;
  function _setupKeyListeners() {
    if (_keysAttached) return;
    _keysAttached = true;
    document.addEventListener('keydown', _onKeyDown);
    document.addEventListener('keyup', _onKeyUp);
  }

  function _onKeyDown(e) {
    if (e.code === 'ArrowLeft') _keys.left = true;
    if (e.code === 'ArrowRight') _keys.right = true;
    if ((e.code === 'ArrowUp' || e.code === 'KeyX') && _phase === 'playing') _jumpEdge = true;
    if ((e.code === 'KeyZ' || e.code === 'Space') && _phase === 'playing') _attackEdge = true;
    if (e.code === 'ArrowUp' || e.code === 'Space') e.preventDefault();
  }

  function _onKeyUp(e) {
    if (e.code === 'ArrowLeft') _keys.left = false;
    if (e.code === 'ArrowRight') _keys.right = false;
  }

  let _touchAttached = false;
  function _setupTouchListeners() {
    if (_touchAttached) return;
    _touchAttached = true;
    const ids = ['raidact-left', 'raidact-right', 'raidact-jump', 'raidact-attack'];
    ids.forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      el.addEventListener('touchstart', e => {
        e.preventDefault();
        if (id === 'raidact-left') _keys.left = true;
        if (id === 'raidact-right') _keys.right = true;
        if ((id === 'raidact-jump') && _phase === 'playing') _jumpEdge = true;
        if ((id === 'raidact-attack') && _phase === 'playing') _attackEdge = true;
      }, { passive: false });
      el.addEventListener('touchend', e => {
        e.preventDefault();
        if (id === 'raidact-left') _keys.left = false;
        if (id === 'raidact-right') _keys.right = false;
      }, { passive: false });
      el.addEventListener('touchcancel', e => {
        e.preventDefault();
        if (id === 'raidact-left') _keys.left = false;
        if (id === 'raidact-right') _keys.right = false;
      }, { passive: false });
    });
  }

  function start(stageId, playerStats, onEnd) {
    if (_rafId) cancelAnimationFrame(_rafId);
    _selectedStageId = stageId;
    _currentStage = CONFIG.RAID_ACTION_STAGES.find(s => s.id === stageId);
    _playerStats = playerStats;
    _onEnd = onEnd;
    _player = _initPlayer();
    _boss = _initBoss(stageId);
    _proj = [];
    _phase = 'playing';
    _lastTs = 0;
    _walkFrame = 0; _walkTimer = 0;
    _gameTime = 0; _endTimer = 0;
    _attackEdge = false; _jumpEdge = false;
    _keys.left = false; _keys.right = false;
    _updateHpUI();
    _rafId = requestAnimationFrame(_loop);
  }

  function stop() {
    if (_rafId) { cancelAnimationFrame(_rafId); _rafId = null; }
    _phase = 'idle';
    _keys.left = false; _keys.right = false;
    _attackEdge = false; _jumpEdge = false;
  }

  function selectStage(id) { _selectedStageId = id; }
  function getSelectedStage() { return _selectedStageId; }

  function _loop(ts) {
    const dt = _lastTs ? Math.min((ts - _lastTs) * 0.001, 0.05) : 0.016;
    _lastTs = ts;
    _gameTime += dt;

    if (_phase === 'playing') {
      _updatePlayer(dt);
      _updateBoss(dt);
      _updateProjectiles(dt);
      _checkEnd();
    } else if (_phase === 'victory' || _phase === 'defeat') {
      _endTimer -= dt;
      if (_endTimer <= 0) {
        const won = _phase === 'victory';
        stop();
        _onEnd && _onEnd({ victory: won });
        return;
      }
    }
    _draw();
    _updateHpUI();
    _rafId = requestAnimationFrame(_loop);
  }

  function _updatePlayer(dt) {
    const C = CONFIG.RAID_ACTION;
    const p = _player;

    if (p.stateTimer > 0) p.stateTimer -= dt;
    if (p.attackCooldown > 0) p.attackCooldown -= dt;
    if (p.flashTimer > 0) p.flashTimer -= dt;

    // Clear finished states
    if (p.stateTimer <= 0 && (p.state === 'attack' || p.state === 'hurt')) {
      p.state = p.onGround ? 'idle' : 'jump';
    }

    // Movement (blocked during attack)
    if (p.state !== 'attack') {
      if (_keys.left) { p.x -= C.WALK_SPEED * dt; p.facingRight = false; }
      if (_keys.right) { p.x += C.WALK_SPEED * dt; p.facingRight = true; }
      if (p.onGround) {
        if (_keys.left || _keys.right) {
          _walkTimer += dt;
          if (_walkTimer >= 0.18) { _walkFrame ^= 1; _walkTimer = 0; }
          if (p.state !== 'hurt') p.state = 'walk';
        } else {
          if (p.state === 'walk') p.state = 'idle';
          _walkFrame = 0;
        }
      }
    }

    // Jump
    if (_jumpEdge && p.onGround) {
      p.vy = -C.JUMP_FORCE;
      p.onGround = false;
      p.state = 'jump';
    }
    _jumpEdge = false;

    // Gravity + vertical movement
    p.vy += C.GRAVITY * dt;
    p.y += p.vy * dt;

    // Land
    if (p.y >= C.GROUND_Y - p.h) {
      p.y = C.GROUND_Y - p.h;
      p.vy = 0;
      p.onGround = true;
      if (p.state === 'jump') p.state = 'idle';
    }

    // Boundary
    p.x = Math.max(0, Math.min(C.CANVAS_W - p.w, p.x));

    // Attack
    if (_attackEdge && p.attackCooldown <= 0) _tryAttack();
    _attackEdge = false;
  }

  function _tryAttack() {
    const C = CONFIG.RAID_ACTION;
    const p = _player;
    const b = _boss;
    p.attackCooldown = C.ATTACK_COOLDOWN;
    p.state = 'attack';
    p.stateTimer = 0.22;

    const pCX = p.x + p.w / 2;
    const bCX = b.x + b.w / 2;
    if (Math.abs(pCX - bCX) <= C.ATTACK_RANGE + p.w / 2 + b.w / 2) {
      const dmg = Math.max(1, p.atk);
      b.hp = Math.max(0, b.hp - dmg);
      b.flashTimer = 0.12;
      b.state = 'hurt';
      b.stateTimer = 0.12;
    }
  }

  function _updateBoss(dt) {
    const b = _boss;
    if (b.stateTimer > 0) b.stateTimer -= dt;
    if (b.flashTimer > 0) b.flashTimer -= dt;
    if (b.stateTimer <= 0 && b.state === 'hurt') b.state = 'idle';

    const id = _selectedStageId;
    if (id === 'easy') _goblinAI(dt);
    else if (id === 'normal') _orcAI(dt);
    else _demonAI(dt);
  }

  function _goblinAI(dt) {
    const C = CONFIG.RAID_ACTION;
    const b = _boss;
    const p = _player;
    const pCX = p.x + p.w / 2;
    const bCX = b.x + b.w / 2;
    const dist = Math.abs(pCX - bCX);
    const atkRange = C.ATTACK_RANGE + p.w / 2 + b.w / 2;

    b.facingRight = bCX > pCX;

    if (b.state !== 'attack' && b.state !== 'hurt') {
      if (dist > atkRange) {
        const dir = pCX > bCX ? 1 : -1;
        b.x += dir * 38 * dt;
        b.state = 'chase';
      } else {
        b.state = 'idle';
      }
    }

    b.aiTimer -= dt;
    if (b.aiTimer <= 0) {
      b.aiTimer = _currentStage.bossAtkInterval;
      if (dist <= atkRange) _doBossHit();
    }

    b.x = Math.max(0, Math.min(C.CANVAS_W - b.w, b.x));
  }

  function _orcAI(dt) {
    const C = CONFIG.RAID_ACTION;
    const b = _boss;
    const p = _player;
    const pCX = p.x + p.w / 2;
    const bCX = b.x + b.w / 2;
    const dist = Math.abs(pCX - bCX);
    const atkRange = C.ATTACK_RANGE * 1.4 + p.w / 2 + b.w / 2;

    b.facingRight = bCX > pCX;

    if (b.state !== 'attack' && b.state !== 'hurt') {
      if (dist > atkRange * 0.7) {
        const dir = pCX > bCX ? 1 : -1;
        b.x += dir * 24 * dt;
        b.state = 'chase';
      } else {
        b.state = 'idle';
      }
    }

    b.aiTimer -= dt;
    if (b.aiTimer <= 0) {
      b.aiTimer = _currentStage.bossAtkInterval;
      if (dist <= atkRange) {
        _doBossHit();
        // Knockback
        const kbDir = p.x < b.x ? -1 : 1;
        p.x = Math.max(0, Math.min(C.CANVAS_W - p.w, p.x + kbDir * 22));
      }
    }

    b.x = Math.max(0, Math.min(C.CANVAS_W - b.w, b.x));
  }

  function _demonAI(dt) {
    const C = CONFIG.RAID_ACTION;
    const b = _boss;
    const p = _player;
    const bCX = b.x + b.w / 2;
    const pCX = p.x + p.w / 2;

    b.facingRight = bCX > pCX;
    b.state = 'idle';

    b.aiTimer -= dt;
    if (b.aiTimer <= 0) {
      b.aiTimer = _currentStage.bossAtkInterval;
      // Teleport
      b.x = pCX < C.CANVAS_W / 2
        ? C.CANVAS_W - b.w - 8
        : 8;
      // Fire projectile toward player
      const bx2 = b.x + b.w / 2;
      const px2 = p.x + p.w / 2;
      const raw = px2 - bx2;
      const spd = 65;
      _proj.push({
        x: bx2,
        y: b.y + b.h * 0.4,
        vx: (raw < 0 ? -1 : 1) * spd,
        vy: -8,
        life: 2.5,
      });
      b.state = 'attack';
      b.stateTimer = 0.3;
    }

    b.x = Math.max(0, Math.min(C.CANVAS_W - b.w, b.x));
  }

  function _doBossHit() {
    const p = _player;
    const st = _currentStage;
    const dmg = Math.max(0, st.bossAtk - p.def);
    if (dmg > 0) {
      p.hp = Math.max(0, p.hp - dmg);
      p.flashTimer = 0.18;
      p.state = 'hurt';
      p.stateTimer = 0.18;
    }
    const b = _boss;
    b.state = 'attack';
    b.stateTimer = 0.35;
  }

  function _updateProjectiles(dt) {
    const C = CONFIG.RAID_ACTION;
    const p = _player;
    for (let i = _proj.length - 1; i >= 0; i--) {
      const pr = _proj[i];
      pr.x += pr.vx * dt;
      pr.y += pr.vy * dt;
      pr.life -= dt;

      const hit = pr.x >= p.x && pr.x <= p.x + p.w && pr.y >= p.y && pr.y <= p.y + p.h;
      if (hit) {
        const dmg = Math.max(0, _currentStage.bossAtk - p.def);
        if (dmg > 0) { p.hp = Math.max(0, p.hp - dmg); p.flashTimer = 0.18; }
        _proj.splice(i, 1);
        continue;
      }
      if (pr.life <= 0 || pr.x < -10 || pr.x > C.CANVAS_W + 10) _proj.splice(i, 1);
    }
  }

  function _checkEnd() {
    if (_phase !== 'playing') return;
    if (_player.hp <= 0) { _phase = 'defeat'; _endTimer = 2.2; }
    else if (_boss.hp <= 0) { _phase = 'victory'; _endTimer = 2.2; }
  }

  // ── Rendering ──
  function _draw() {
    if (!_canvas || !_ctx) return;
    const C = CONFIG.RAID_ACTION;
    const ctx = _ctx;
    ctx.clearRect(0, 0, C.CANVAS_W, C.CANVAS_H);
    _drawBg();
    _drawBoss();
    _drawPlayer();
    _drawProjAll();
    _drawHud();
  }

  function _drawBg() {
    const C = CONFIG.RAID_ACTION;
    const ctx = _ctx;
    const id = _selectedStageId;

    if (id === 'easy') {
      ctx.fillStyle = '#7ec8e3'; ctx.fillRect(0, 0, C.CANVAS_W, C.GROUND_Y);
      ctx.fillStyle = '#4a7c59'; ctx.fillRect(0, C.GROUND_Y, C.CANVAS_W, C.CANVAS_H - C.GROUND_Y);
      // 나무
      ctx.fillStyle = '#2d5a3d';
      ctx.fillRect(140, C.GROUND_Y - 18, 3, 18);
      ctx.fillRect(134, C.GROUND_Y - 30, 15, 16);
      ctx.fillRect(5, C.GROUND_Y - 12, 3, 12);
      ctx.fillRect(1, C.GROUND_Y - 20, 11, 10);
      // 구름
      ctx.fillStyle = '#e8f4f8';
      ctx.fillRect(20, 8, 20, 6); ctx.fillRect(18, 10, 24, 4);
      ctx.fillRect(90, 14, 16, 5); ctx.fillRect(88, 16, 20, 3);
    } else if (id === 'normal') {
      ctx.fillStyle = '#8aa0b0'; ctx.fillRect(0, 0, C.CANVAS_W, C.GROUND_Y);
      ctx.fillStyle = '#556070'; ctx.fillRect(0, C.GROUND_Y, C.CANVAS_W, C.CANVAS_H - C.GROUND_Y);
      // 돌기둥
      ctx.fillStyle = '#445060';
      ctx.fillRect(130, C.GROUND_Y - 26, 7, 26);
      ctx.fillRect(128, C.GROUND_Y - 28, 11, 4);
      ctx.fillRect(5, C.GROUND_Y - 18, 7, 18);
      ctx.fillRect(3, C.GROUND_Y - 20, 11, 4);
    } else {
      ctx.fillStyle = '#1a0a1a'; ctx.fillRect(0, 0, C.CANVAS_W, C.GROUND_Y);
      ctx.fillStyle = '#3d1010'; ctx.fillRect(0, C.GROUND_Y, C.CANVAS_W, C.CANVAS_H - C.GROUND_Y);
      // 용암 균열
      ctx.fillStyle = '#ff4400';
      ctx.globalAlpha = 0.25 + 0.2 * Math.sin(_gameTime * 4);
      ctx.fillRect(80, C.GROUND_Y + 2, 50, 2);
      ctx.fillRect(20, C.GROUND_Y + 4, 30, 1);
      ctx.globalAlpha = 1;
      // 별
      [[30,10],[70,5],[120,15],[50,20],[100,8]].forEach(([sx, sy]) => {
        ctx.globalAlpha = 0.4 + 0.4 * Math.sin(_gameTime * 2 + sx);
        ctx.fillStyle = '#fff';
        ctx.fillRect(sx, sy, 1, 1);
      });
      ctx.globalAlpha = 1;
    }

    // Ground line
    ctx.fillStyle = id === 'easy' ? '#3a6b48' : id === 'normal' ? '#445566' : '#6a1010';
    ctx.fillRect(0, C.GROUND_Y, C.CANVAS_W, 1);
  }

  function _drawPlayer() {
    const C = CONFIG.RAID_ACTION;
    const ctx = _ctx;
    const p = _player;
    const flash = p.flashTimer > 0;

    ctx.save();
    ctx.translate(Math.round(p.x), Math.round(p.y));
    if (!p.facingRight) { ctx.translate(p.w, 0); ctx.scale(-1, 1); }
    ctx.globalAlpha = p.state === 'hurt' ? 0.55 : 1.0;

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    if (p.onGround) ctx.fillRect(2, p.h, 12, 2);

    // Leg walk offset
    const lo = (p.state === 'walk' && _walkFrame === 1) ? 1 : 0;

    // Boots
    ctx.fillStyle = '#2a1a0a';
    ctx.fillRect(2, p.h - 5, 5, 5);
    ctx.fillRect(9, p.h - 5 - lo, 5, 5);

    // Legs
    ctx.fillStyle = '#4a5a7a';
    ctx.fillRect(3, p.h - 11, 4, 7);
    ctx.fillRect(9, p.h - 11 - lo, 4, 7);

    // Torso
    ctx.fillStyle = '#6a7a9a';
    ctx.fillRect(2, 8, 12, 8);
    ctx.fillStyle = '#4a5a7a';
    ctx.fillRect(2, 12, 12, 2);

    // Shield (left, non-facing side)
    ctx.fillStyle = '#7070c0';
    ctx.fillRect(0, 9, 3, 7);
    ctx.fillStyle = '#a0a0ff';
    ctx.fillRect(1, 10, 1, 5);

    // Sword (right side, attack offset)
    const atkOff = p.state === 'attack' ? 4 : 0;
    ctx.fillStyle = '#8a6030';
    ctx.fillRect(12, 12, 2, 4);
    ctx.fillStyle = p.atk > 30 ? '#d4a520' : p.atk > 15 ? '#6a70f0' : '#909090';
    ctx.fillRect(13 + atkOff, 4, 2, 9);
    ctx.fillStyle = '#fff';
    ctx.fillRect(14 + atkOff, 4, 1, 9);

    // Head
    ctx.fillStyle = '#c8a070';
    ctx.fillRect(4, 2, 8, 6);
    ctx.fillStyle = '#6a7a9a';
    ctx.fillRect(3, 0, 10, 4);
    ctx.fillStyle = '#00ffaa';
    ctx.fillRect(4, 2, 8, 1);

    // Jump tilt
    if (p.state === 'jump') {
      ctx.fillStyle = '#cc2244';
      ctx.fillRect(7, -1, 2, 2);
    }

    if (flash) {
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.fillRect(0, 0, p.w, p.h);
    }

    ctx.globalAlpha = 1;
    ctx.restore();
  }

  function _drawBoss() {
    const C = CONFIG.RAID_ACTION;
    const ctx = _ctx;
    const b = _boss;
    const flash = b.flashTimer > 0;
    const bob = Math.sin(_gameTime * 3) * 0.7;
    const id = _selectedStageId;

    ctx.save();
    ctx.translate(Math.round(b.x), Math.round(b.y + bob));
    if (!b.facingRight) { ctx.translate(b.w, 0); ctx.scale(-1, 1); }
    if (flash) ctx.filter = 'brightness(4) saturate(0)';

    if (id === 'easy') _drawGoblin();
    else if (id === 'normal') _drawOrc();
    else _drawDemon();

    ctx.filter = 'none';
    ctx.restore();
  }

  function _drawGoblin() {
    // 24×32
    const ctx = _ctx;
    // shadow
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.fillRect(2, 30, 20, 3);
    // boots
    ctx.fillStyle = '#1a2c10';
    ctx.fillRect(3, 26, 6, 6); ctx.fillRect(15, 26, 6, 6);
    // legs
    ctx.fillStyle = '#2d4a1e';
    ctx.fillRect(4, 18, 5, 10); ctx.fillRect(15, 18, 5, 10);
    // belt
    ctx.fillStyle = '#5a3a1a'; ctx.fillRect(3, 17, 18, 3);
    ctx.fillStyle = '#c8a832'; ctx.fillRect(10, 17, 4, 3);
    // body
    ctx.fillStyle = '#3d6b28'; ctx.fillRect(3, 6, 18, 13);
    // right arm (static)
    ctx.fillStyle = '#3d6b28'; ctx.fillRect(20, 8, 5, 10);
    ctx.fillStyle = '#c8a832'; ctx.fillRect(20, 16, 2, 3); ctx.fillRect(23, 16, 2, 3);
    // left arm (attack side)
    const atkOff = _boss.state === 'attack' ? 3 : 0;
    ctx.fillStyle = '#3d6b28'; ctx.fillRect(-1 - atkOff, 8, 5, 10);
    ctx.fillStyle = '#c8a832';
    ctx.fillRect(-1 - atkOff, 16, 2, 3); ctx.fillRect(2 - atkOff, 16, 2, 3);
    // neck
    ctx.fillStyle = '#3d6b28'; ctx.fillRect(9, 0, 6, 8);
    // head
    ctx.fillStyle = '#4d8a34'; ctx.fillRect(4, -12, 16, 14);
    // ears
    ctx.fillStyle = '#3d6b28';
    ctx.fillRect(1, -10, 4, 6); ctx.fillRect(19, -10, 4, 6);
    // eyes
    ctx.fillStyle = '#ffee00';
    ctx.fillRect(6, -9, 4, 4); ctx.fillRect(14, -9, 4, 4);
    ctx.fillStyle = '#000';
    ctx.fillRect(7, -8, 2, 2); ctx.fillRect(15, -8, 2, 2);
    // teeth
    ctx.fillStyle = '#fff';
    ctx.fillRect(8, -2, 2, 2); ctx.fillRect(12, -2, 2, 2);
  }

  function _drawOrc() {
    // 36×48
    const ctx = _ctx;
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(2, 46, 32, 4);
    // boots
    ctx.fillStyle = '#4a4a4a';
    ctx.fillRect(4, 38, 10, 10); ctx.fillRect(22, 38, 10, 10);
    // legs
    ctx.fillStyle = '#556b2f';
    ctx.fillRect(5, 24, 9, 16); ctx.fillRect(22, 24, 9, 16);
    // body
    ctx.fillStyle = '#6b8e23'; ctx.fillRect(4, 4, 28, 22);
    // armor bands
    ctx.fillStyle = '#3a3a3a';
    ctx.fillRect(4, 4, 28, 4); ctx.fillRect(4, 14, 28, 3);
    // right arm (axe side, static)
    ctx.fillStyle = '#6b8e23'; ctx.fillRect(28, 6, 8, 14);
    // axe
    ctx.fillStyle = '#4a2a10'; ctx.fillRect(32, -2, 3, 20);
    ctx.fillStyle = '#9a9a9a';
    ctx.fillRect(28, -4, 7, 6);
    ctx.fillRect(26, -6, 11, 4);
    // left arm
    const atkOff = _boss.state === 'attack' ? 4 : 0;
    ctx.fillStyle = '#6b8e23'; ctx.fillRect(-2 - atkOff, 6, 8, 14);
    // neck
    ctx.fillStyle = '#6b8e23'; ctx.fillRect(13, -2, 10, 8);
    // head
    ctx.fillStyle = '#7a9e2a'; ctx.fillRect(6, -18, 24, 18);
    // horns
    ctx.fillStyle = '#8b7355';
    ctx.fillRect(6, -24, 5, 8); ctx.fillRect(25, -24, 5, 8);
    // eyes
    ctx.fillStyle = '#ff2200';
    ctx.fillRect(9, -14, 6, 4); ctx.fillRect(21, -14, 6, 4);
    ctx.fillStyle = '#000';
    ctx.fillRect(11, -13, 2, 2); ctx.fillRect(23, -13, 2, 2);
    // tusks
    ctx.fillStyle = '#f5f5dc';
    ctx.fillRect(12, -5, 3, 5); ctx.fillRect(21, -5, 3, 5);
  }

  function _drawDemon() {
    // 48×64
    const ctx = _ctx;
    const mg = 0.6 + 0.4 * Math.sin(_gameTime * 4);
    // shadow
    ctx.fillStyle = 'rgba(80,0,0,0.3)';
    ctx.fillRect(4, 62, 40, 4);
    // wings
    ctx.fillStyle = '#150008'; ctx.globalAlpha = 0.8;
    ctx.fillRect(-12, 0, 14, 32); ctx.fillRect(46, 0, 14, 32);
    ctx.globalAlpha = 1;
    // wing veins
    ctx.fillStyle = '#2a0015';
    ctx.fillRect(-10, 4, 1, 24); ctx.fillRect(-6, 2, 1, 28);
    ctx.fillRect(47, 4, 1, 24); ctx.fillRect(53, 2, 1, 28);
    // hooves
    ctx.fillStyle = '#100404';
    ctx.fillRect(6, 56, 10, 8); ctx.fillRect(32, 56, 10, 8);
    // legs
    ctx.fillStyle = '#1e0808';
    ctx.fillRect(8, 38, 10, 20); ctx.fillRect(30, 38, 10, 20);
    // body
    ctx.fillStyle = '#140614'; ctx.fillRect(4, 12, 40, 28);
    // runes
    ctx.fillStyle = '#7a0000';
    ctx.fillRect(14, 18, 20, 2); ctx.fillRect(14, 26, 20, 2);
    // sigil
    ctx.fillStyle = '#cc0000'; ctx.fillRect(20, 21, 8, 3);
    // arms
    ctx.fillStyle = '#1e0808';
    ctx.fillRect(0, 14, 6, 20); ctx.fillRect(42, 14, 6, 20);
    // orbs
    ctx.fillStyle = `rgba(140,0,200,${mg})`;
    ctx.fillRect(-2, 24, 8, 8);
    ctx.fillStyle = `rgba(200,0,100,${mg})`;
    ctx.fillRect(42, 24, 8, 8);
    // neck
    ctx.fillStyle = '#140010'; ctx.fillRect(18, 4, 12, 10);
    // head
    ctx.fillStyle = '#140010'; ctx.fillRect(10, -14, 28, 20);
    // horns
    ctx.fillStyle = '#7a0000';
    ctx.fillRect(12, -22, 4, 10); ctx.fillRect(20, -28, 4, 16); ctx.fillRect(32, -22, 4, 10);
    // eyes glow
    ctx.shadowBlur = 4; ctx.shadowColor = '#ff0000';
    ctx.fillStyle = '#ff2200';
    ctx.fillRect(13, -10, 7, 4); ctx.fillRect(28, -10, 7, 4);
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#000';
    ctx.fillRect(15, -9, 3, 2); ctx.fillRect(30, -9, 3, 2);
    // attack glow
    if (_boss.state === 'attack') {
      ctx.fillStyle = `rgba(220,0,220,${mg * 0.5})`;
      ctx.fillRect(0, 0, 48, 64);
    }
  }

  function _drawProjAll() {
    const ctx = _ctx;
    _proj.forEach(pr => {
      // Fireball
      ctx.fillStyle = '#ff6600';
      ctx.fillRect(Math.round(pr.x) - 2, Math.round(pr.y) - 2, 4, 4);
      ctx.fillStyle = '#ffcc44';
      ctx.fillRect(Math.round(pr.x) - 1, Math.round(pr.y) - 1, 2, 2);
      ctx.fillStyle = '#fff';
      ctx.fillRect(Math.round(pr.x), Math.round(pr.y), 1, 1);
    });
  }

  function _drawHud() {
    const C = CONFIG.RAID_ACTION;
    const ctx = _ctx;
    if (_phase === 'victory') {
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(0, 0, C.CANVAS_W, C.CANVAS_H);
      ctx.fillStyle = '#ffd700';
      ctx.font = 'bold 8px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('VICTORY!', C.CANVAS_W / 2, C.CANVAS_H / 2 - 2);
      ctx.textAlign = 'left';
    } else if (_phase === 'defeat') {
      ctx.fillStyle = 'rgba(80,0,0,0.6)';
      ctx.fillRect(0, 0, C.CANVAS_W, C.CANVAS_H);
      ctx.fillStyle = '#ff4444';
      ctx.font = 'bold 8px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('DEFEAT', C.CANVAS_W / 2, C.CANVAS_H / 2 - 2);
      ctx.textAlign = 'left';
    }
  }

  function _updateHpUI() {
    const p = _player;
    const b = _boss;
    const pBar = document.getElementById('raidact-player-hp');
    const bBar = document.getElementById('raidact-boss-hp');
    const pTxt = document.getElementById('raidact-player-hp-text');
    const bTxt = document.getElementById('raidact-boss-hp-text');
    if (pBar) pBar.style.width = Math.max(0, (p.hp / p.maxHp) * 100) + '%';
    if (bBar && b.maxHp) bBar.style.width = Math.max(0, (b.hp / b.maxHp) * 100) + '%';
    if (pTxt) pTxt.textContent = Math.max(0, Math.round(p.hp));
    if (bTxt) bTxt.textContent = b.maxHp ? Math.max(0, Math.round(b.hp)) : '-';
  }

  return { init, start, stop, selectStage, getSelectedStage };
})();
