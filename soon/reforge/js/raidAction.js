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
      hp: C.PLAYER_HP, maxHp: C.PLAYER_HP,
      facingRight: true,
      state: 'idle', stateTimer: 0,
      attackCooldown: 0, flashTimer: 0,
      atk: ps.atk, def: ps.def,
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

    if (p.state !== 'attack') {
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

    soundManager.playRaidAttack();
    const pCX = p.x + p.w / 2;
    const bCX = b.x + b.w / 2;
    if (Math.abs(pCX - bCX) <= C.ATTACK_RANGE + p.w / 2 + b.w / 2) {
      b.hp = Math.max(0, b.hp - Math.max(1, p.atk));
      b.flashTimer = 0.1;
      b.state = 'hurt'; b.stateTimer = 0.1;
      soundManager.playRaidBossHit();
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
    const ctx = _ctx;
    const p   = _player;
    const flash = p.flashTimer > 0;
    const sg = _playerStats?.swordGrade || null;
    const hg = _playerStats?.shieldGrade || null;

    ctx.save();
    ctx.translate(Math.round(p.x), Math.round(p.y));
    if (!p.facingRight) { ctx.translate(p.w, 0); ctx.scale(-1, 1); }
    ctx.globalAlpha = p.state === 'hurt' ? 0.5 : 1.0;

    if (p.onGround) {
      ctx.fillStyle = 'rgba(0,0,0,0.22)';
      ctx.fillRect(2, p.h, 12, 2);
    }
    const lo = (p.state === 'walk' && _walkFrame === 1) ? 1 : 0;

    // 맨발 (살색)
    ctx.fillStyle = '#c8a070';
    ctx.fillRect(2, p.h - 4, 5, 4);
    ctx.fillRect(9, p.h - 4 - lo, 5, 4);
    // 다리 (바지)
    ctx.fillStyle = '#5a4a3a';
    ctx.fillRect(3, p.h - 12, 4, 8);
    ctx.fillRect(9, p.h - 12 - lo, 4, 8);
    // 몸통 (맨몸 살색)
    ctx.fillStyle = '#c8a070'; ctx.fillRect(2, 7, 12, 9);

    // 방패 (착용 시에만)
    if (hg) {
      const sc = hg === 'high' ? '#d4a520' : hg === 'mid' ? '#6a70f0' : '#909090';
      const ss = hg === 'high' ? '#fff8a0' : hg === 'mid' ? '#c0c4ff' : '#d8d8d8';
      ctx.fillStyle = sc; ctx.fillRect(-1, 7, 4, 9);
      ctx.fillStyle = ss; ctx.fillRect(0, 9, 1, 5);
    }

    // 칼 (착용 시에만)
    if (sg) {
      const atkOff = p.state === 'attack' ? 5 : 0;
      const wc = sg === 'high' ? '#d4a520' : sg === 'mid' ? '#6a70f0' : '#909090';
      ctx.fillStyle = '#8a6030'; ctx.fillRect(12, 12, 2, 4);   // 손잡이
      ctx.fillStyle = '#4a2a10'; ctx.fillRect(10, 10, 6, 3);   // 가드
      ctx.fillStyle = wc; ctx.fillRect(13 + atkOff, 1, 2, 10); // 날
      ctx.fillStyle = '#fff'; ctx.fillRect(14 + atkOff, 1, 1, 10); // 광택
    }

    // 목 (살색)
    ctx.fillStyle = '#c8a070'; ctx.fillRect(6, 3, 4, 5);
    // 머리 (맨머리 살색)
    ctx.fillStyle = '#c8a070'; ctx.fillRect(4, -6, 8, 9);
    // 눈
    ctx.fillStyle = '#4a2a0a'; ctx.fillRect(5, -4, 2, 2); ctx.fillRect(9, -4, 2, 2);
    // 머리카락
    ctx.fillStyle = '#3a2010'; ctx.fillRect(4, -6, 8, 3);

    if (flash) {
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      ctx.fillRect(-1, -6, p.w + 2, p.h + 6);
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

    _drawDemonBoss(isCharge);

    ctx.filter = 'none';
    ctx.restore();
  }

  function _drawDemonBoss(isCharge) {
    const ctx = _ctx;
    const b   = _boss;
    const mg  = 0.6 + 0.4 * Math.sin(_gameTime * 4);
    const W = b.w, H = b.h;

    // 오라 (charge 중이면 더 밝게)
    if (isCharge) {
      ctx.shadowBlur = 18; ctx.shadowColor = '#ff0044';
      ctx.fillStyle = `rgba(255,0,60,${mg * 0.35})`;
      ctx.beginPath(); ctx.ellipse(W / 2, H / 2, W * 0.9, H * 0.85, 0, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;
    }

    // 날개
    ctx.fillStyle = '#150008'; ctx.globalAlpha = 0.85;
    ctx.fillRect(-13, 4, 14, H * 0.55); ctx.fillRect(W - 1, 4, 14, H * 0.55);
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#2a0015';
    ctx.fillRect(-11, 6, 1, H * 0.4); ctx.fillRect(-7, 4, 1, H * 0.5);
    ctx.fillRect(W, 6, 1, H * 0.4); ctx.fillRect(W + 4, 4, 1, H * 0.5);

    // 발굽
    ctx.fillStyle = '#100404';
    ctx.fillRect(4, H - 6, 10, 6); ctx.fillRect(W - 14, H - 6, 10, 6);
    // 다리
    ctx.fillStyle = '#1e0808';
    ctx.fillRect(6, H - 20, 8, 16); ctx.fillRect(W - 14, H - 20, 8, 16);
    // 몸통
    ctx.fillStyle = '#140614'; ctx.fillRect(3, H * 0.28, W - 6, H * 0.42);
    ctx.strokeStyle = '#7a0000'; ctx.lineWidth = 1;
    [0.36, 0.48, 0.58].forEach(ry => {
      ctx.beginPath(); ctx.moveTo(3, H * ry); ctx.lineTo(W - 3, H * ry); ctx.stroke();
    });
    // 시길
    ctx.fillStyle = '#cc0000';
    ctx.beginPath(); ctx.ellipse(W / 2, H * 0.44, 6, 3, 0, 0, Math.PI * 2); ctx.fill();

    // 팔
    ctx.fillStyle = '#1e0808';
    ctx.fillRect(-2, H * 0.3, 6, H * 0.28); ctx.fillRect(W - 4, H * 0.3, 6, H * 0.28);
    // 오브 (charge 중이면 더 크게 맥동)
    const orbSz = isCharge ? (8 + 4 * mg) : (6 + 2 * mg);
    ctx.shadowBlur = isCharge ? 14 : 6;
    ctx.shadowColor = '#aa00cc';
    ctx.fillStyle = `rgba(140,0,200,${mg})`;
    ctx.beginPath(); ctx.arc(-2 + orbSz / 4, H * 0.44, orbSz / 2, 0, Math.PI * 2); ctx.fill();
    ctx.shadowColor = '#cc0066';
    ctx.fillStyle = `rgba(200,0,100,${mg})`;
    ctx.beginPath(); ctx.arc(W + 2 - orbSz / 4, H * 0.44, orbSz / 2, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;

    // 목
    ctx.fillStyle = '#140010'; ctx.fillRect(W * 0.35, H * 0.16, W * 0.3, H * 0.14);
    // 머리
    ctx.fillStyle = '#140010'; ctx.fillRect(W * 0.12, 0, W * 0.76, H * 0.28);
    // 뿔
    ctx.fillStyle = '#7a0000';
    [[W * 0.15, -8], [W * 0.35, -12], [W * 0.5, -14], [W * 0.65, -12], [W * 0.85, -8]].forEach(([hx, hy]) => {
      ctx.fillRect(hx - 3, H * 0.02 + hy + Math.sin(_gameTime * 2 + hx) * 0.8, 5, -hy);
    });
    // 눈
    ctx.shadowBlur = 8; ctx.shadowColor = '#ff0000';
    ctx.fillStyle = '#ff2200';
    ctx.fillRect(W * 0.18, H * 0.08, W * 0.2, 4);
    ctx.fillRect(W * 0.62, H * 0.08, W * 0.2, 4);
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#000';
    ctx.fillRect(W * 0.22, H * 0.09, W * 0.1, 2);
    ctx.fillRect(W * 0.66, H * 0.09, W * 0.1, 2);
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
