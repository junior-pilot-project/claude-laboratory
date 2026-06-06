const RaidAction = (() => {
  let _canvas, _ctx, _rafId;
  let _phase = 'idle';
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

  let _player = {};
  let _boss = {};
  let _proj = [];
  let _groundWave = null;  // { x, y, w, h, vx, timer, warning }
  let _patternTimer = 0;
  let _patternQueue = [];

  function _initPlayer() {
    const C = CONFIG.RAID_ACTION;
    const ps = _playerStats || { atk: 1, def: 0 };
    return {
      x: 12, y: C.GROUND_Y - C.PLAYER_H,
      w: C.PLAYER_W, h: C.PLAYER_H,
      vy: 0, onGround: true,
      hp: _playerStats?.maxHp ?? C.PLAYER_HP, maxHp: _playerStats?.maxHp ?? C.PLAYER_HP,
      facingRight: true,
      state: 'idle', stateTimer: 0,
      attackCooldown: 0, flashTimer: 0,
      atk: ps.atk, def: ps.def,
      kbVx: 0,
    };
  }

  function _initBoss() {
    const C = CONFIG.RAID_ACTION;
    const B = CONFIG.RAID_BOSS;
    return {
      x: C.CANVAS_W - B.w - 10,
      y: C.GROUND_Y - B.h,
      w: B.w, h: B.h,
      hp: B.hp, maxHp: B.hp,
      state: 'idle', stateTimer: 0,
      flashTimer: 0,
      chargeTimer: 0, // 공격 예고 타이머
      nextPattern: null,
    };
  }

  function _shufflePatterns() {
    // 패턴 순서: quick 2회, spread 1회, ground 1회 → 셔플
    const base = ['quick', 'quick', 'spread', 'ground'];
    for (let i = base.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [base[i], base[j]] = [base[j], base[i]];
    }
    return base;
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
    if (e.code === 'ArrowLeft')  _keys.left = true;
    if (e.code === 'ArrowRight') _keys.right = true;
    if ((e.code === 'ArrowUp' || e.code === 'KeyX') && _phase === 'playing') _jumpEdge = true;
    if ((e.code === 'KeyZ' || e.code === 'Space') && _phase === 'playing') _attackEdge = true;
    if (e.code === 'ArrowUp' || e.code === 'Space') e.preventDefault();
  }

  function _onKeyUp(e) {
    if (e.code === 'ArrowLeft')  _keys.left = false;
    if (e.code === 'ArrowRight') _keys.right = false;
  }

  let _touchAttached = false;
  function _setupTouchListeners() {
    if (_touchAttached) return;
    _touchAttached = true;
    const map = {
      'raidact-left':   () => { _keys.left = true; },
      'raidact-right':  () => { _keys.right = true; },
      'raidact-jump':   () => { if (_phase === 'playing') _jumpEdge = true; },
      'raidact-attack': () => { if (_phase === 'playing') _attackEdge = true; },
    };
    const offMap = {
      'raidact-left':  () => { _keys.left = false; },
      'raidact-right': () => { _keys.right = false; },
    };
    Object.entries(map).forEach(([id, fn]) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.addEventListener('touchstart', e => { e.preventDefault(); fn(); }, { passive: false });
      if (offMap[id]) {
        el.addEventListener('touchend',   e => { e.preventDefault(); offMap[id](); }, { passive: false });
        el.addEventListener('touchcancel',e => { e.preventDefault(); offMap[id](); }, { passive: false });
      }
    });
  }

  function start(playerStats, onEnd) {
    if (_rafId) cancelAnimationFrame(_rafId);
    _playerStats = playerStats;
    _onEnd = onEnd;
    _player = _initPlayer();
    _boss   = _initBoss();
    _proj   = [];
    _groundWave = null;
    _phase  = 'playing';
    _lastTs = 0;
    _walkFrame = 0; _walkTimer = 0;
    _gameTime = 0; _endTimer = 0;
    _attackEdge = false; _jumpEdge = false;
    _keys.left = false; _keys.right = false;
    _patternTimer = CONFIG.RAID_BOSS.firstAtkDelay;
    _patternQueue = _shufflePatterns();
    _updateHpUI();
    _rafId = requestAnimationFrame(_loop);
  }

  function stop() {
    if (_rafId) { cancelAnimationFrame(_rafId); _rafId = null; }
    _phase = 'idle';
    _keys.left = false; _keys.right = false;
    _attackEdge = false; _jumpEdge = false;
  }

  function _loop(ts) {
    const dt = _lastTs ? Math.min((ts - _lastTs) * 0.001, 0.05) : 0.016;
    _lastTs = ts;
    _gameTime += dt;

    if (_phase === 'playing') {
      _updatePlayer(dt);
      _updateBoss(dt);
      _updateProjectiles(dt);
      _updateGroundWave(dt);
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

  // ── Player ──
  function _updatePlayer(dt) {
    const C = CONFIG.RAID_ACTION;
    const p = _player;

    if (p.stateTimer > 0) p.stateTimer -= dt;
    if (p.attackCooldown > 0) p.attackCooldown -= dt;
    if (p.flashTimer > 0) p.flashTimer -= dt;

    if (p.stateTimer <= 0 && (p.state === 'attack' || p.state === 'hurt'))
      p.state = p.onGround ? 'idle' : 'jump';

    // 넉백 중이면 이동 입력 무시하고 왼쪽으로 밀려남
    if (p.kbVx < 0) {
      p.x += p.kbVx * dt;
      p.kbVx = Math.min(0, p.kbVx + 1400 * dt);
      p.x = Math.max(0, p.x);
    } else if (p.state !== 'attack') {
      if (_keys.left)  { p.x -= C.WALK_SPEED * dt; p.facingRight = false; }
      if (_keys.right) { p.x += C.WALK_SPEED * dt; p.facingRight = true; }
      if (p.onGround) {
        if (_keys.left || _keys.right) {
          _walkTimer += dt;
          if (_walkTimer >= 0.16) { _walkFrame ^= 1; _walkTimer = 0; }
          if (p.state !== 'hurt') p.state = 'walk';
        } else {
          if (p.state === 'walk') p.state = 'idle';
          _walkFrame = 0;
        }
      }
    }

    if (_jumpEdge && p.onGround) {
      p.vy = -C.JUMP_FORCE;
      p.onGround = false;
      p.state = 'jump';
    }
    _jumpEdge = false;

    p.vy += C.GRAVITY * dt;
    p.y  += p.vy * dt;

    if (p.y >= C.GROUND_Y - p.h) {
      p.y = C.GROUND_Y - p.h;
      p.vy = 0;
      p.onGround = true;
      if (p.state === 'jump') p.state = 'idle';
    }

    p.x = Math.max(0, Math.min(C.CANVAS_W - p.w, p.x));

    if (_attackEdge && p.attackCooldown <= 0 && p.kbVx >= 0) _tryAttack();
    _attackEdge = false;
  }

  function _tryAttack() {
    const C = CONFIG.RAID_ACTION;
    const p = _player;
    const b = _boss;
    p.attackCooldown = C.ATTACK_COOLDOWN;
    p.state = 'attack';
    p.stateTimer = 0.22;

    soundManager.playRaidAttack();
    const pCX = p.x + p.w / 2;
    const bCX = b.x + b.w / 2;
    if (Math.abs(pCX - bCX) <= C.ATTACK_RANGE + p.w / 2 + b.w / 2) {
      b.hp = Math.max(0, b.hp - Math.max(1, p.atk));
      b.flashTimer = 0.1;
      b.state = 'hurt'; b.stateTimer = 0.1;
      soundManager.playRaidBossHit();
      // 보스가 반격 — 플레이어를 시작 위치 방향으로 강하게 밀쳐냄
      p.kbVx = -620;
      p.state = 'hurt';
      p.stateTimer = 0.5;
      p.flashTimer = 0.35;
      if (p.onGround) { p.vy = -110; p.onGround = false; }
      soundManager.playRaidPlayerHit();
    }
  }

  // ── Boss AI ──
  function _updateBoss(dt) {
    const b = _boss;
    if (b.stateTimer > 0) b.stateTimer -= dt;
    if (b.flashTimer > 0) b.flashTimer -= dt;
    if (b.stateTimer <= 0 && b.state === 'hurt') b.state = 'idle';

    // 플레이어 방향 바라보기
    b.facingRight = (b.x + b.w / 2) > (_player.x + _player.w / 2);

    // 공격 예고: chargeTimer 동안 charge 상태 → 0이 되면 실제 발사
    if (b.chargeTimer > 0) {
      b.chargeTimer -= dt;
      b.state = 'charge';
      if (b.chargeTimer <= 0) {
        _firePattern(b.nextPattern);
        b.state = 'attack';
        b.stateTimer = 0.35;
        const B = CONFIG.RAID_BOSS;
        _patternTimer = B.minInterval + Math.random() * (B.maxInterval - B.minInterval);
      }
      return;
    }

    // 패턴 쿨다운
    _patternTimer -= dt;
    if (_patternTimer <= 0 && b.state !== 'attack') {
      if (_patternQueue.length === 0) _patternQueue = _shufflePatterns();
      b.nextPattern = _patternQueue.shift();
      b.chargeTimer = 0.45; // 0.45초 예고
    }
  }

  function _firePattern(name) {
    const C = CONFIG.RAID_ACTION;
    const b = _boss;
    const p = _player;
    const bCX = b.x + b.w / 2;
    const bFY = b.y + b.h * 0.35; // 발사 Y

    if (name === 'quick') {
      // 빠른 단발 — 플레이어 현재 위치 조준
      const pCX = p.x + p.w / 2;
      const pCY = p.y + p.h / 2;
      const dx = pCX - bCX, dy = pCY - bFY;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const spd = 105;
      _proj.push({ x: bCX, y: bFY, vx: dx / dist * spd, vy: dy / dist * spd, life: 3.5, type: 'quick' });

    } else if (name === 'spread') {
      // 3방향 산탄: 위/중간/아래 궤도
      const offsets = [
        { ty: C.GROUND_Y - C.PLAYER_H * 0.1 },  // 바닥
        { ty: C.GROUND_Y - C.PLAYER_H * 0.7 },  // 중간
        { ty: C.GROUND_Y - C.PLAYER_H * 1.5 },  // 점프 높이
      ];
      offsets.forEach(({ ty }) => {
        const tx = p.x + p.w / 2;
        const dx = tx - bCX, dy = ty - bFY;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const spd = 72;
        _proj.push({ x: bCX, y: bFY, vx: dx / dist * spd, vy: dy / dist * spd, life: 3.5, type: 'spread' });
      });

    } else if (name === 'ground') {
      // 바닥 충격파: 보스 발밑에서 왼쪽으로 이동 — 점프로 피해야 함
      _groundWave = {
        x: b.x - 2,
        y: C.GROUND_Y - 10,
        w: 28, h: 12,
        vx: -88,
        timer: 3.0,
        flashTimer: 0.0,
      };
    }
  }

  // ── Projectiles ──
  function _updateProjectiles(dt) {
    const C = CONFIG.RAID_ACTION;
    const p = _player;
    const B = CONFIG.RAID_BOSS;
    for (let i = _proj.length - 1; i >= 0; i--) {
      const pr = _proj[i];
      pr.x += pr.vx * dt;
      pr.y += pr.vy * dt;
      pr.life -= dt;

      const hit = pr.x + 4 >= p.x && pr.x - 4 <= p.x + p.w &&
                  pr.y + 4 >= p.y && pr.y - 4 <= p.y + p.h;
      if (hit) {
        const dmg = Math.max(0, B.atk - p.def);
        if (dmg > 0) { p.hp = Math.max(0, p.hp - dmg); p.flashTimer = 0.2; p.state = 'hurt'; p.stateTimer = 0.15; soundManager.playRaidPlayerHit(); }
        _proj.splice(i, 1);
        continue;
      }
      if (pr.life <= 0 || pr.x < -20 || pr.x > C.CANVAS_W + 20 || pr.y > C.GROUND_Y + 10)
        _proj.splice(i, 1);
    }
  }

  // ── Ground Wave ──
  function _updateGroundWave(dt) {
    if (!_groundWave) return;
    const gw = _groundWave;
    const p  = _player;
    const B  = CONFIG.RAID_BOSS;

    gw.x += gw.vx * dt;
    gw.timer -= dt;
    gw.flashTimer = (gw.flashTimer + dt * 6) % 1; // 깜박임용

    // 플레이어가 지면에 있고 충돌
    if (p.onGround &&
        p.x + p.w > gw.x && p.x < gw.x + gw.w &&
        p.y + p.h > gw.y) {
      const dmg = Math.max(0, B.atk - p.def);
      if (dmg > 0) { p.hp = Math.max(0, p.hp - dmg); p.flashTimer = 0.2; p.state = 'hurt'; p.stateTimer = 0.15; soundManager.playRaidPlayerHit(); }
      _groundWave = null;
      return;
    }

    if (gw.timer <= 0 || gw.x + gw.w < -4) _groundWave = null;
  }

  function _checkEnd() {
    if (_phase !== 'playing') return;
    if (_player.hp <= 0) { _phase = 'defeat'; _endTimer = 2.2; }
    else if (_boss.hp <= 0) { _phase = 'victory'; _endTimer = 2.5; }
  }

  // ── Rendering ──
  function _draw() {
    if (!_canvas || !_ctx) return;
    const C = CONFIG.RAID_ACTION;
    const ctx = _ctx;
    ctx.clearRect(0, 0, C.CANVAS_W, C.CANVAS_H);
    _drawBg();
    _drawGroundWaveVfx();
    _drawProjAll();
    _drawBoss();
    _drawPlayer();
    _drawHud();
  }

  function _drawBg() {
    const C = CONFIG.RAID_ACTION;
    const ctx = _ctx;

    // 어두운 던전 배경
    const skyGrad = ctx.createLinearGradient(0, 0, 0, C.GROUND_Y);
    skyGrad.addColorStop(0, '#0a0015');
    skyGrad.addColorStop(1, '#180820');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, C.CANVAS_W, C.GROUND_Y);

    // 바닥
    ctx.fillStyle = '#110010';
    ctx.fillRect(0, C.GROUND_Y, C.CANVAS_W, C.CANVAS_H - C.GROUND_Y);

    // 바닥 라인
    ctx.fillStyle = '#6a1050';
    ctx.fillRect(0, C.GROUND_Y, C.CANVAS_W, 1);

    // 배경 기둥들
    ctx.fillStyle = '#1a0828';
    [[18, 40], [75, 30], [170, 45]].forEach(([cx2, h]) => {
      ctx.fillRect(cx2 - 4, C.GROUND_Y - h, 8, h);
      ctx.fillRect(cx2 - 7, C.GROUND_Y - h - 3, 14, 4);
    });

    // 룬 불빛
    [[30, C.GROUND_Y - 20], [90, C.GROUND_Y - 15], [155, C.GROUND_Y - 22]].forEach(([rx, ry]) => {
      ctx.globalAlpha = 0.18 + 0.15 * Math.sin(_gameTime * 2.5 + rx);
      ctx.fillStyle = '#aa00ff';
      ctx.fillRect(rx - 3, ry - 3, 6, 6);
      ctx.globalAlpha = 1;
    });

    // 별
    [[22,8],[60,4],[110,12],[160,6],[200,10],[45,18],[130,16]].forEach(([sx, sy]) => {
      ctx.globalAlpha = 0.3 + 0.4 * Math.sin(_gameTime * 1.6 + sx * 0.08);
      ctx.fillStyle = '#fff';
      ctx.fillRect(sx, sy, 1, 1);
    });
    ctx.globalAlpha = 1;
  }

  function _drawGroundWaveVfx() {
    if (!_groundWave) return;
    const gw  = _groundWave;
    const ctx = _ctx;
    const pulse = 0.7 + 0.3 * Math.sin(gw.flashTimer * Math.PI * 2);

    ctx.shadowBlur = 10; ctx.shadowColor = '#ff6600';
    ctx.fillStyle = `rgba(255,100,0,${pulse})`;
    ctx.fillRect(Math.round(gw.x), Math.round(gw.y), gw.w, gw.h);
    ctx.fillStyle = '#ffdd44';
    ctx.globalAlpha = pulse * 0.8;
    ctx.fillRect(Math.round(gw.x), Math.round(gw.y), gw.w, 3);
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
  }

  function _drawProjAll() {
    const ctx = _ctx;
    _proj.forEach(pr => {
      if (pr.type === 'quick') {
        ctx.shadowBlur = 8; ctx.shadowColor = '#ff4400';
        ctx.fillStyle = '#ff6600';
        ctx.fillRect(Math.round(pr.x) - 3, Math.round(pr.y) - 3, 6, 6);
        ctx.fillStyle = '#ffcc44';
        ctx.fillRect(Math.round(pr.x) - 1, Math.round(pr.y) - 1, 3, 3);
      } else if (pr.type === 'spread') {
        ctx.shadowBlur = 6; ctx.shadowColor = '#cc00ff';
        ctx.fillStyle = '#dd44ff';
        ctx.fillRect(Math.round(pr.x) - 2, Math.round(pr.y) - 2, 5, 5);
        ctx.fillStyle = '#ffaaff';
        ctx.fillRect(Math.round(pr.x), Math.round(pr.y) - 1, 2, 3);
      }
      ctx.shadowBlur = 0;
    });
  }

  function _drawPlayer() {
    const ctx  = _ctx;
    const p    = _player;
    const sg   = _playerStats?.swordGrade  || null;
    const hg   = _playerStats?.shieldGrade || null;
    const ag   = _playerStats?.armorGrade  || null;
    const bg   = _playerStats?.bootsGrade  || null;
    const helg = _playerStats?.helmetGrade || null;
    const flash = p.flashTimer > 0;

    function gc(g) {
      if (g === 'supreme') return { b: '#ffaa00', s: '#ffe566', d: '#aa6600' };
      if (g === 'high')    return { b: '#d4a520', s: '#fff8a0', d: '#8b6914' };
      if (g === 'mid')     return { b: '#6a70f0', s: '#c0c4ff', d: '#3a40a0' };
      return { b: '#909090', s: '#d8d8d8', d: '#505050' };
    }

    const SK = '#f5c89a', SKD = '#c8885a';
    const CL = '#3a5090', CLD = '#1e3268';

    ctx.save();
    ctx.translate(Math.round(p.x), Math.round(p.y));
    if (!p.facingRight) { ctx.translate(p.w, 0); ctx.scale(-1, 1); }
    ctx.globalAlpha = p.state === 'hurt' ? 0.45 : 1.0;

    // 그림자
    if (p.onGround) {
      ctx.fillStyle = 'rgba(0,0,0,0.32)';
      ctx.beginPath(); ctx.ellipse(8, 24, 9, 2.5, 0, 0, Math.PI * 2); ctx.fill();
    }

    // 걷기 모션: 다리 전체를 유닛으로 이동
    const walking = p.state === 'walk';
    const wf = _walkFrame;
    // 뒷다리: 프레임0=뒤로(-X,+Y), 프레임1=앞으로(+X,-Y)
    const bLX = walking ? (wf === 0 ? -3 : 3) : 0;
    const bLY = walking ? (wf === 0 ? 2 : -1) : 0;
    // 앞다리: 뒷다리의 반대 위상
    const fLX = walking ? (wf === 0 ? 3 : -3) : 0;
    const fLY = walking ? (wf === 0 ? -1 : 2) : 0;

    const LB = ag ? gc(ag).b : CL;
    const LD = ag ? gc(ag).d : CLD;

    // ── 뒷다리 (전체 유닛 이동) ──
    ctx.fillStyle = LB; ctx.fillRect(2 + bLX, 14 + bLY, 5, 9);
    ctx.fillStyle = LD; ctx.fillRect(1 + bLX, 22 + bLY, 6, 2);
    if (bg) {
      const bc = gc(bg);
      ctx.fillStyle = bc.b; ctx.fillRect(0 + bLX, 23 + bLY, 8, 3);
      ctx.fillStyle = bc.s; ctx.fillRect(1 + bLX, 23 + bLY, 3, 1);
    } else {
      ctx.fillStyle = SKD; ctx.fillRect(1 + bLX, 23 + bLY, 6, 3);
    }

    // ── 방패 (뒤쪽) ──
    if (hg) {
      const sc = gc(hg);
      ctx.fillStyle = sc.d; ctx.fillRect(-9, 1, 9, 18);
      ctx.fillStyle = sc.b; ctx.fillRect(-8, 2, 7, 16);
      ctx.fillStyle = sc.s; ctx.fillRect(-7, 4, 2, 10);
      ctx.fillStyle = sc.d; ctx.fillRect(-8, 9, 7, 1);
      ctx.fillStyle = sc.s; ctx.fillRect(-6, 2, 2, 3);
    }

    // ── 몸통 ──
    if (ag) {
      const ac = gc(ag);
      ctx.fillStyle = ac.b; ctx.fillRect(0, 2, 15, 14);
      ctx.fillStyle = ac.d;
      ctx.fillRect(0, 2, 15, 2);
      ctx.fillRect(0, 12, 15, 2);
      ctx.fillRect(7, 4, 2, 7);
      ctx.fillStyle = ac.s;
      ctx.fillRect(1, 4, 5, 5);
      ctx.fillRect(9, 4, 5, 5);
      // 견갑
      ctx.fillStyle = ac.b;
      ctx.fillRect(-3, 0, 6, 5); ctx.fillRect(12, 0, 6, 5);
      ctx.fillStyle = ac.d;
      ctx.fillRect(-3, 0, 6, 1); ctx.fillRect(12, 0, 6, 1);
      ctx.fillStyle = ac.s;
      ctx.fillRect(-1, 1, 2, 2); ctx.fillRect(13, 1, 2, 2);
      // 벨트 버클
      ctx.fillStyle = '#c89820'; ctx.fillRect(6, 12, 4, 3);
      ctx.fillStyle = '#fff8a0'; ctx.fillRect(7, 13, 2, 1);
    } else {
      ctx.fillStyle = CL;  ctx.fillRect(0, 3, 14, 12);
      ctx.fillStyle = CLD; ctx.fillRect(0, 3, 14, 2);
      ctx.fillStyle = CLD; ctx.fillRect(0, 11, 14, 2);
      ctx.fillStyle = '#5a6aac'; ctx.fillRect(2, 5, 4, 5);
    }

    // ── 앞다리 (전체 유닛 이동) ──
    ctx.fillStyle = LB; ctx.fillRect(9 + fLX, 14 + fLY, 5, 9);
    ctx.fillStyle = LD; ctx.fillRect(8 + fLX, 22 + fLY, 7, 2);
    if (bg) {
      const bc = gc(bg);
      ctx.fillStyle = bc.b; ctx.fillRect(8 + fLX, 23 + fLY, 8, 3);
      ctx.fillStyle = bc.s; ctx.fillRect(9 + fLX, 23 + fLY, 3, 1);
    } else {
      ctx.fillStyle = SKD; ctx.fillRect(8 + fLX, 23 + fLY, 7, 3);
    }

    // ── 칼 팔 + 칼 ──
    const atkOff = p.state === 'attack' ? 5 : 0;
    ctx.fillStyle = ag ? gc(ag).b : SK;
    ctx.fillRect(13, 2, 5, 11);
    if (ag) { ctx.fillStyle = gc(ag).d; ctx.fillRect(13, 2, 5, 2); }

    if (sg) {
      const wc = gc(sg);
      ctx.fillStyle = '#2a1005'; ctx.fillRect(15, 8, 3, 7);
      ctx.fillStyle = wc.d; ctx.fillRect(9, 5, 14, 4);
      ctx.fillStyle = wc.b; ctx.fillRect(10, 6, 12, 2);
      ctx.fillStyle = wc.s; ctx.fillRect(11, 6, 10, 1);
      const bx = 15 + atkOff;
      ctx.fillStyle = '#9aacc8'; ctx.fillRect(bx, -20, 4, 27);
      ctx.fillStyle = '#d8ecff'; ctx.fillRect(bx + 1, -20, 2, 27);
      ctx.fillStyle = '#ffffff'; ctx.fillRect(bx + 1, -20, 1, 25);
      ctx.fillStyle = wc.b;     ctx.fillRect(bx, -20, 4, 3);
      ctx.fillStyle = wc.s;     ctx.fillRect(bx + 1, -20, 2, 2);
    } else {
      ctx.fillStyle = SK;  ctx.fillRect(14, 4, 5, 8);
      ctx.fillStyle = SKD; ctx.fillRect(14, 11, 5, 1);
    }

    // ── 목 ──
    ctx.fillStyle = SK; ctx.fillRect(5, 0, 6, 4);

    // ── 머리 ──
    ctx.fillStyle = SK;
    ctx.beginPath(); ctx.arc(8, -7, 8, 0, Math.PI * 2); ctx.fill();
    // 옆면 (윤곽) 약간 어둡게
    ctx.fillStyle = SKD;
    ctx.beginPath(); ctx.arc(8, -7, 8, Math.PI * 1.55, Math.PI * 1.85); ctx.fill();

    // ── 머리카락 ──
    ctx.fillStyle = '#160808';
    ctx.beginPath(); ctx.arc(8, -8, 8, Math.PI * 0.82, Math.PI * 1.92); ctx.fill();
    // 스파이크 2개
    ctx.fillStyle = '#160808';
    ctx.beginPath(); ctx.moveTo(13,-11); ctx.lineTo(17,-22); ctx.lineTo(15,-10); ctx.fill();
    ctx.beginPath(); ctx.moveTo(9,-13); ctx.lineTo(12,-24); ctx.lineTo(11,-12); ctx.fill();
    // 하이라이트
    ctx.fillStyle = '#3a1412';
    ctx.fillRect(6, -15, 4, 2);
    ctx.fillRect(10, -14, 3, 2);

    // ── 투구 ──
    if (helg) {
      const hc = gc(helg);
      ctx.fillStyle = hc.b;
      ctx.beginPath(); ctx.arc(8, -7, 9, Math.PI * 0.95, Math.PI * 2.05); ctx.fill();
      ctx.fillStyle = hc.d;
      ctx.fillRect(-1, -9, 18, 4);
      ctx.fillRect(13, -14, 4, 10);
      ctx.fillStyle = hc.s;
      ctx.fillRect(0, -14, 5, 8);
      ctx.fillStyle = hc.d; ctx.fillRect(5, -17, 4, 4);
      ctx.fillStyle = '#cc2020'; ctx.fillRect(5, -22, 4, 6);
      ctx.fillStyle = '#ff5555'; ctx.fillRect(6, -22, 2, 5);
    }

    // ── 얼굴 ──
    // 눈 (흰자 + 홍채 + 하이라이트)
    ctx.fillStyle = '#fff'; ctx.fillRect(10, -12, 6, 5);
    ctx.fillStyle = '#1a1440'; ctx.fillRect(11, -11, 3, 4);
    ctx.fillStyle = '#4466ff'; ctx.fillRect(11, -11, 2, 3); // 홍채 색
    ctx.fillStyle = '#fff';    ctx.fillRect(13, -11, 1, 2); // 하이라이트
    ctx.fillStyle = '#160808'; ctx.fillRect(10, -13, 7, 2); // 눈썹 (두껍게)
    ctx.fillStyle = SKD; ctx.fillRect(11, -7, 3, 2);       // 코
    // 입 (살짝 웃는 표정)
    ctx.fillStyle = '#8a4a2a';
    ctx.fillRect(9, -4, 5, 1);
    ctx.fillRect(13, -3, 2, 1);
    // 볼
    ctx.fillStyle = 'rgba(220,100,80,0.38)'; ctx.fillRect(13, -8, 5, 4);

    // ── 피격 플래시 ──
    if (flash) {
      ctx.fillStyle = 'rgba(255,50,50,0.55)';
      ctx.fillRect(-9, -28, p.w + 22, p.h + 28);
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  function _drawBoss() {
    const ctx = _ctx;
    const b   = _boss;
    const bob = Math.sin(_gameTime * 2.5) * 1.2;
    const flash = b.flashTimer > 0;
    const isCharge = b.state === 'charge';

    ctx.save();
    ctx.translate(Math.round(b.x), Math.round(b.y + bob));
    if (!b.facingRight) { ctx.translate(b.w, 0); ctx.scale(-1, 1); }
    if (flash) ctx.filter = 'brightness(4) saturate(0)';

    _drawSkeletonKnight(isCharge);

    ctx.filter = 'none';
    ctx.restore();
  }

  function _drawSkeletonKnight(isCharge) {
    const ctx = _ctx;
    const b   = _boss;
    const mg  = 0.5 + 0.5 * Math.sin(_gameTime * 4);
    const W = b.w, H = b.h;
    const bone = '#e0d8b0', darkBone = '#a09060';
    const eyeCol = isCharge ? `rgba(255,80,0,${0.8 + 0.2 * mg})` : `rgba(255,200,50,${0.6 + 0.4 * mg})`;

    // charge 오라
    if (isCharge) {
      ctx.shadowBlur = 14; ctx.shadowColor = '#ff6600';
      ctx.fillStyle = `rgba(255,100,0,${mg * 0.28})`;
      ctx.beginPath(); ctx.ellipse(W * 0.4, H * 0.5, W * 0.85, H * 0.8, 0, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;
    }

    // 방패 (앞쪽, 오른쪽)
    ctx.fillStyle = '#880010';
    ctx.fillRect(W - 5, H * 0.22, 9, H * 0.36);
    ctx.strokeStyle = '#cc3333'; ctx.lineWidth = 1;
    ctx.strokeRect(W - 5, H * 0.22, 9, H * 0.36);
    ctx.fillStyle = '#cc2222';
    ctx.beginPath(); ctx.moveTo(W - 1, H * 0.28); ctx.lineTo(W + 2, H * 0.4); ctx.lineTo(W - 1, H * 0.52); ctx.fill();

    // 뒷발·뒷다리 (뼈)
    ctx.fillStyle = darkBone; ctx.fillRect(W - 18, H - 7, 11, 7);
    ctx.fillStyle = bone;     ctx.fillRect(W - 17, H - 22, 8, 16);

    // 몸통 갑옷
    ctx.fillStyle = '#606075';
    ctx.fillRect(W * 0.08, H * 0.26, W * 0.56, H * 0.4);
    ctx.fillStyle = '#404055';
    ctx.fillRect(W * 0.08, H * 0.26, W * 0.56, 5);
    ctx.fillRect(W * 0.08, H * 0.52, W * 0.56, 4);
    ctx.strokeStyle = bone; ctx.lineWidth = 0.7;
    ctx.strokeRect(W * 0.14, H * 0.32, W * 0.44, H * 0.2);

    // 앞발·앞다리 (뼈)
    ctx.fillStyle = darkBone; ctx.fillRect(W * 0.06, H - 7, 13, 7);
    ctx.fillStyle = bone;     ctx.fillRect(W * 0.08, H - 24, 9, 18);

    // 칼 팔 (왼쪽, 앞으로 뻗음)
    ctx.fillStyle = darkBone;
    ctx.fillRect(W * 0.02, H * 0.29, 6, H * 0.26);
    // 칼날
    ctx.fillStyle = '#9090aa';
    ctx.fillRect(-11, H * 0.2, 4, H * 0.23);
    ctx.fillStyle = bone;
    ctx.fillRect(-2, H * 0.37, 13, 3); // 가드

    // 뒷팔
    ctx.fillStyle = darkBone;
    ctx.fillRect(W * 0.66, H * 0.29, 5, H * 0.24);

    // 목뼈
    ctx.fillStyle = darkBone;
    ctx.fillRect(W * 0.28, H * 0.2, W * 0.18, H * 0.08);

    // 해골 머리 (왼쪽 방향)
    ctx.fillStyle = bone;
    ctx.beginPath(); ctx.ellipse(W * 0.26, H * 0.11, W * 0.2, H * 0.14, 0, 0, Math.PI * 2); ctx.fill();
    // 아래턱
    ctx.beginPath(); ctx.ellipse(W * 0.26, H * 0.19, W * 0.14, H * 0.06, 0, 0, Math.PI * 2); ctx.fill();

    // 눈 (왼쪽 방향 한쪽)
    ctx.shadowBlur = 7; ctx.shadowColor = eyeCol;
    ctx.fillStyle = eyeCol;
    ctx.beginPath(); ctx.ellipse(W * 0.14, H * 0.1, 3.5, 4, 0, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;
    // 코구멍
    ctx.fillStyle = '#2a2000'; ctx.fillRect(W * 0.08, H * 0.135, 3, 2.5);

    // 이빨
    ctx.fillStyle = bone;
    [W * 0.13, W * 0.19, W * 0.25].forEach(tx => ctx.fillRect(tx, H * 0.2, 3.5, 4.5));
    ctx.fillStyle = darkBone;
    ctx.fillRect(W * 0.12, H * 0.2, W * 0.2, 2);

    // 왕관
    ctx.fillStyle = '#c8a020';
    ctx.fillRect(W * 0.08, H * 0.01, W * 0.26, 4);
    [W * 0.1, W * 0.18, W * 0.27].forEach(hx => {
      ctx.beginPath();
      ctx.moveTo(hx - 2.5, H * 0.02);
      ctx.lineTo(hx, -5 + Math.sin(_gameTime * 2) * 1.2);
      ctx.lineTo(hx + 2.5, H * 0.02);
      ctx.fill();
    });
  }

  function _drawHud() {
    const C   = CONFIG.RAID_ACTION;
    const ctx = _ctx;
    if (_phase === 'victory') {
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(0, 0, C.CANVAS_W, C.CANVAS_H);
      ctx.shadowBlur = 12; ctx.shadowColor = '#ffd700';
      ctx.fillStyle = '#ffd700';
      ctx.font = 'bold 10px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('VICTORY!', C.CANVAS_W / 2, C.CANVAS_H / 2 + 3);
      ctx.shadowBlur = 0; ctx.textAlign = 'left';
    } else if (_phase === 'defeat') {
      ctx.fillStyle = 'rgba(80,0,0,0.65)';
      ctx.fillRect(0, 0, C.CANVAS_W, C.CANVAS_H);
      ctx.shadowBlur = 10; ctx.shadowColor = '#ff4444';
      ctx.fillStyle = '#ff4444';
      ctx.font = 'bold 10px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('DEFEAT', C.CANVAS_W / 2, C.CANVAS_H / 2 + 3);
      ctx.shadowBlur = 0; ctx.textAlign = 'left';
    }

    // 패턴 예고 인디케이터 (charge 중)
    if (_boss.state === 'charge' && _boss.chargeTimer > 0) {
      const ratio = 1 - (_boss.chargeTimer / 0.45);
      const pulse = 0.6 + 0.4 * Math.sin(_gameTime * 20);
      ctx.fillStyle = `rgba(255,60,0,${pulse * 0.75})`;
      ctx.fillRect(0, C.CANVAS_H - 3, C.CANVAS_W * ratio, 3);
    }
  }

  function _updateHpUI() {
    const p = _player, b = _boss;
    const pBar = document.getElementById('raidact-player-hp');
    const bBar = document.getElementById('raidact-boss-hp');
    const pTxt = document.getElementById('raidact-player-hp-text');
    const bTxt = document.getElementById('raidact-boss-hp-text');
    if (pBar) pBar.style.width = Math.max(0, (p.hp / p.maxHp) * 100) + '%';
    if (bBar && b.maxHp) bBar.style.width = Math.max(0, (b.hp / b.maxHp) * 100) + '%';
    if (pTxt) pTxt.textContent = Math.max(0, Math.round(p.hp));
    if (bTxt) bTxt.textContent = b.maxHp ? Math.max(0, Math.round(b.hp)) : '-';
  }

  return { init, start, stop };
})();
