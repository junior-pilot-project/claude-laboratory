const BossCanvas = (() => {
  let canvas, ctx, rafId, idleT = 0;
  let currentStage = null, currentState = null;

  let _px = 0, _py = 0, _bx = 0, _by = 0;
  let _bossFlash = false, _playerFlash = false;
  let _defeatAlpha = 0, _defeated = false, _victory = false;
  let _queue = [], _cur = null;

  let _swordAngle = 0;
  let _slashAlpha = 0;
  let _impacts = [];
  let _proj = null;
  let _screenShakePower = 0, _shakeX = 0, _shakeY = 0;
  let _bossAtkAngle = 0;

  const ease = t => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;

  function getGY() { return canvas ? Math.floor(canvas.height * 0.75) : 195; }
  function getBossOff() { return currentStage?.id === 'hard' ? 76 : currentStage?.id === 'normal' ? 68 : 50; }

  function init(canvasId, stage, state) {
    if (rafId) cancelAnimationFrame(rafId);
    canvas = document.getElementById(canvasId);
    if (!canvas) return;
    ctx = canvas.getContext('2d');
    currentStage = stage;
    currentState = state;
    _px = _py = _bx = _by = 0;
    _bossFlash = _playerFlash = _defeated = _victory = false;
    _defeatAlpha = 0;
    _queue = []; _cur = null;
    _swordAngle = 0; _slashAlpha = 0;
    _impacts = []; _proj = null;
    _screenShakePower = _shakeX = _shakeY = 0;
    _bossAtkAngle = 0;
    rafId = requestAnimationFrame(loop);
  }

  function stop() {
    if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
  }

  function loop(ts) {
    idleT = ts * 0.001;
    tick();
    updateImpacts();
    updateShake();
    draw();
    rafId = requestAnimationFrame(loop);
  }

  function tick() {
    if (!_cur) {
      if (_queue.length) { _cur = _queue.shift(); _cur._t0 = performance.now(); }
      return;
    }
    const t = Math.min((performance.now() - _cur._t0) / _cur.dur, 1);
    _cur.fn(t);
    if (t >= 1) { _cur.end?.(); _cur = null; }
  }

  function qa(dur, fn, end) { _queue.push({ dur, fn, end }); }

  function updateImpacts() {
    for (let i = _impacts.length - 1; i >= 0; i--) {
      const p = _impacts[i];
      p.x += p.vx; p.y += p.vy;
      p.vy += 0.28;
      p.vx *= 0.9;
      p.life -= 0.055;
      if (p.life <= 0) _impacts.splice(i, 1);
    }
  }

  function updateShake() {
    if (_screenShakePower > 0.3) {
      _shakeX = (Math.random() - 0.5) * _screenShakePower * 2;
      _shakeY = (Math.random() - 0.5) * _screenShakePower * 1.2;
      _screenShakePower *= 0.70;
    } else {
      _screenShakePower = 0; _shakeX = _shakeY = 0;
    }
  }

  function spawnImpact(x, y, count, col) {
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i / count) + (Math.random() - 0.5) * 0.9;
      const spd = 2 + Math.random() * 5;
      _impacts.push({ x, y, vx: Math.cos(angle) * spd, vy: Math.sin(angle) * spd - 2, life: 1, col });
    }
  }

  // ── grade colors ──
  function gc(grade) {
    if (grade === 'high') return { b: '#d4a520', d: '#8b6914', s: '#fff8a0' };
    if (grade === 'mid')  return { b: '#6a70f0', d: '#3a40a0', s: '#c0c4ff' };
    return { b: '#909090', d: '#505050', s: '#d8d8d8' };
  }

  // ── draw ──
  function draw() {
    if (!canvas || !ctx) return;
    const W = canvas.width, H = canvas.height;
    const GY = getGY();
    ctx.clearRect(0, 0, W, H);

    ctx.save();
    ctx.translate(_shakeX, _shakeY);
    drawBg(W, H, GY);

    const cx = 80 + _px, cy = GY - 44 + _py;
    const bx = 310 + _bx, by = GY - getBossOff() + _by;
    const bob = Math.sin(idleT * 2) * 2;

    drawSlashTrail(cx, cy, bob);
    drawKnight(cx, cy, bob, _playerFlash, _defeated);
    drawBoss(bx, by, bob * -0.8, _bossFlash);
    drawProjectile();
    drawImpacts();

    if (_victory) {
      ctx.globalAlpha = 0.45 + 0.35 * Math.sin(idleT * 8);
      const g = ctx.createRadialGradient(cx, cy - 30, 4, cx, cy - 30, 50);
      g.addColorStop(0, '#ffd700'); g.addColorStop(1, 'transparent');
      ctx.fillStyle = g;
      ctx.fillRect(cx - 52, cy - 80, 104, 80);
      ctx.globalAlpha = 1;
    }
    ctx.restore();

    if (_defeatAlpha > 0) {
      ctx.globalAlpha = _defeatAlpha;
      ctx.fillStyle = '#500000';
      ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = 1;
    }
  }

  function drawBg(W, H, GY) {
    const sky = ctx.createLinearGradient(0, 0, 0, GY);
    sky.addColorStop(0, '#050510'); sky.addColorStop(1, '#150520');
    ctx.fillStyle = sky; ctx.fillRect(0, 0, W, GY);
    ctx.fillStyle = '#0d0d05'; ctx.fillRect(0, GY, W, H - GY);
    ctx.strokeStyle = '#2a2a10'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, GY); ctx.lineTo(W, GY); ctx.stroke();
    [[40,15],[90,8],[160,25],[230,12],[290,28],[350,9],[70,40],[200,42],[340,35]].forEach(([sx, sy]) => {
      ctx.globalAlpha = 0.35 + 0.45 * Math.sin(idleT * 1.8 + sx * 0.1);
      ctx.fillStyle = '#fff'; ctx.fillRect(sx, sy, 1.5, 1.5);
    });
    ctx.globalAlpha = 1;
  }

  function drawSlashTrail(x, y, bob) {
    if (_slashAlpha <= 0) return;
    const sg = currentState?.equippedSword?.grade;
    const c = sg === 'high' ? '#ffd700' : sg === 'mid' ? '#8888ff' : '#d0d0d0';
    ctx.save();
    ctx.translate(x + 16, y + bob + 4);
    for (let i = 1; i <= 4; i++) {
      const ta = _swordAngle - i * 0.32;
      const len = 30 - i * 2;
      ctx.globalAlpha = _slashAlpha * (5 - i) / 4 * 0.55;
      ctx.strokeStyle = i === 1 ? 'rgba(255,255,255,0.9)' : c;
      ctx.lineWidth = 5 - i;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.sin(ta) * len, -Math.cos(ta) * len);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  function drawImpacts() {
    _impacts.forEach(p => {
      ctx.globalAlpha = Math.max(0, p.life) * 0.85;
      ctx.fillStyle = p.col;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.life * 2.5, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = p.col; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx * 1.8, p.y - p.vy * 1.8); ctx.stroke();
    });
    ctx.globalAlpha = 1;
  }

  function drawProjectile() {
    if (!_proj) return;
    ctx.save();
    ctx.shadowBlur = 20; ctx.shadowColor = _proj.col;
    ctx.fillStyle = _proj.col; ctx.globalAlpha = 0.9;
    ctx.beginPath(); ctx.arc(_proj.x, _proj.y, _proj.size, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 6; ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.beginPath(); ctx.arc(_proj.x - 1.5, _proj.y - 1.5, 2.5, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0; ctx.strokeStyle = _proj.col; ctx.lineWidth = 2;
    ctx.globalAlpha = 0.35;
    ctx.beginPath(); ctx.moveTo(_proj.x, _proj.y); ctx.lineTo(_proj.x - _proj.dx * 14, _proj.y - _proj.dy * 14); ctx.stroke();
    ctx.shadowBlur = 0; ctx.globalAlpha = 1;
    ctx.restore();
  }

  function drawKnight(x, y, bob, flash, defeated) {
    ctx.save();
    ctx.translate(x, y + bob);
    if (defeated) ctx.rotate(0.3);
    if (flash) ctx.filter = 'brightness(2.5) sepia(1) saturate(4) hue-rotate(-30deg)';

    const sg   = currentState?.equippedSword?.grade;
    const hg   = currentState?.equippedShield?.grade;
    const ag   = currentState?.equippedArmor?.grade;
    const bg   = currentState?.equippedBoots?.grade;
    const helg = currentState?.equippedHelmet?.grade;
    const skin = '#e8b87a';
    const skinD = '#c8986a';

    if (!defeated) {
      ctx.fillStyle = 'rgba(0,0,0,0.22)';
      ctx.beginPath(); ctx.ellipse(5, 44, 18, 4, 0, 0, Math.PI * 2); ctx.fill();
    }

    // 뒷발·뒷다리
    ctx.fillStyle = skinD; ctx.fillRect(-4, 36, 12, 8);
    ctx.fillStyle = skin;  ctx.fillRect(-2, 18, 8, 20);
    if (bg) {
      const bc = gc(bg);
      ctx.fillStyle = bc.b; ctx.fillRect(-4, 40, 12, 4);
      ctx.fillStyle = bc.s; ctx.fillRect(-3, 40, 4, 2);
    }

    // 방패 (뒤쪽)
    if (hg) {
      const sc = gc(hg);
      ctx.fillStyle = sc.b; ctx.fillRect(-18, -8, 10, 22);
      ctx.fillStyle = sc.s; ctx.fillRect(-16, -2, 3, 10);
      ctx.strokeStyle = sc.d; ctx.lineWidth = 1.5; ctx.strokeRect(-18, -8, 10, 22);
    }

    // 몸통
    ctx.fillStyle = skin; ctx.fillRect(-6, -4, 22, 26);
    if (ag) {
      const ac = gc(ag);
      ctx.fillStyle = ac.b; ctx.fillRect(-6, -4, 22, 9);   // 어깨 플레이트
      ctx.fillStyle = ac.d; ctx.fillRect(-6,  5, 22, 3);   // 구분선
      ctx.fillStyle = ac.b; ctx.fillRect(-4,  8, 18, 12);  // 흉갑
      ctx.fillStyle = ac.s; ctx.fillRect(-1, 10, 6,  7);   // 광택
    }

    // 앞발·앞다리
    ctx.fillStyle = skinD; ctx.fillRect(8, 36, 14, 8);
    ctx.fillStyle = skin;  ctx.fillRect(9, 18, 9, 20);
    if (bg) {
      const bc = gc(bg);
      ctx.fillStyle = bc.b; ctx.fillRect(8, 40, 14, 4);
      ctx.fillStyle = bc.s; ctx.fillRect(9, 40, 5, 2);
    }

    // 칼 팔 (스윙 애니메이션)
    ctx.save();
    ctx.translate(16, 4);
    ctx.rotate(_swordAngle);
    ctx.fillStyle = skin; ctx.fillRect(-3, 0, 7, 16);
    if (sg) {
      const wc = gc(sg);
      ctx.fillStyle = '#4a2a10'; ctx.fillRect(-3, -5, 8, 5);
      ctx.fillStyle = wc.s;     ctx.fillRect(-2, -36, 4, 33);
      ctx.fillStyle = 'rgba(255,255,255,0.65)'; ctx.fillRect(-1, -36, 1.5, 33);
    }
    ctx.restore();

    // 목
    ctx.fillStyle = skin; ctx.fillRect(1, -12, 8, 10);

    // 머리 (귀여운 큰 원, 오른쪽 방향)
    ctx.fillStyle = skin;
    ctx.beginPath(); ctx.arc(8, -30, 20, 0, Math.PI * 2); ctx.fill();

    // 머리카락
    ctx.fillStyle = '#3a2010';
    ctx.beginPath(); ctx.arc(8, -30, 20, Math.PI * 1.05, Math.PI * 1.95); ctx.fill();
    ctx.fillRect(-10, -50, 10, 8);

    // 투구 (머리 위 반원 + 챙)
    if (helg) {
      const hc = gc(helg);
      ctx.fillStyle = hc.b;
      ctx.beginPath(); ctx.arc(8, -30, 22, Math.PI, 2 * Math.PI); ctx.fill();
      ctx.fillStyle = hc.d; ctx.fillRect(-13, -31, 44, 5);
      ctx.fillStyle = hc.s; ctx.fillRect( -2, -48, 8, 14);
    }

    // 눈 (한쪽, 오른쪽 방향)
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.ellipse(22, -34, 5.5, 6.5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#2a1a0a';
    ctx.beginPath(); ctx.arc(23, -33, 3.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(24, -35, 1.2, 0, Math.PI * 2); ctx.fill();

    // 볼
    ctx.fillStyle = 'rgba(240,130,100,0.4)';
    ctx.beginPath(); ctx.ellipse(26, -26, 4.5, 3, 0, 0, Math.PI * 2); ctx.fill();

    // 입 (미소)
    ctx.strokeStyle = '#7a4a2a'; ctx.lineWidth = 1.5; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(21, -22, 4, -0.1, Math.PI * 0.65); ctx.stroke();

    ctx.filter = 'none'; ctx.restore();
  }

  function drawGoblin(x, y, bob, flash) {
    ctx.save(); ctx.translate(x, y + bob);
    if (flash) ctx.filter = 'brightness(2.5) sepia(1) saturate(4) hue-rotate(-30deg)';

    const col = '#3d6b28', dark = '#1a3a10', skin = '#4d8a34';

    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.beginPath(); ctx.ellipse(0, 50, 20, 5, 0, 0, Math.PI * 2); ctx.fill();

    // 뒷발·뒷다리
    ctx.fillStyle = dark; ctx.fillRect(-16, 42, 14, 8);
    ctx.fillStyle = skin;  ctx.fillRect(-14, 22, 9, 22);

    // 몸통
    ctx.fillStyle = col; ctx.fillRect(-18, 0, 30, 24);
    ctx.fillStyle = '#5a3a1a'; ctx.fillRect(-18, 14, 30, 5);
    ctx.fillStyle = '#c8a832'; ctx.fillRect(-4, 14, 8, 5);

    // 앞발·앞다리
    ctx.fillStyle = dark; ctx.fillRect(4, 42, 16, 8);
    ctx.fillStyle = skin;  ctx.fillRect(5, 22, 9, 22);

    // 발톱 팔 (공격 모션, 왼쪽 어깨 피벗)
    ctx.save();
    ctx.translate(-22, 4);
    ctx.rotate(_bossAtkAngle);
    ctx.fillStyle = skin; ctx.fillRect(0, 0, 10, 20);
    ctx.fillStyle = '#c8a832';
    [0, 4, 8].forEach(ox => ctx.fillRect(ox, 18, 3, 8));
    ctx.restore();

    // 오른팔 (뒤)
    ctx.fillStyle = dark; ctx.fillRect(12, 2, 8, 18);

    // 목
    ctx.fillStyle = skin; ctx.fillRect(-6, -8, 10, 10);

    // 귀 (옆에서 하나만, 뾰족)
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.moveTo(-14, -10); ctx.lineTo(-30, -36 + Math.sin(idleT * 2) * 2); ctx.lineTo(-4, -4);
    ctx.fill();

    // 머리
    ctx.fillStyle = skin;
    ctx.beginPath(); ctx.ellipse(-4, -26, 18, 16, 0, 0, Math.PI * 2); ctx.fill();

    // 눈 (왼쪽 방향)
    ctx.fillStyle = '#ffee00';
    ctx.beginPath(); ctx.ellipse(-16, -28, 5, 6, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#000';
    ctx.beginPath(); ctx.ellipse(-16, -27, 2.5, 3.5, 0, 0, Math.PI * 2); ctx.fill();

    // 이빨
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.moveTo(-10, -14); ctx.lineTo(-8, -6); ctx.lineTo(-4, -14); ctx.fill();

    ctx.filter = 'none'; ctx.restore();
  }

  function drawOrc(x, y, bob, flash) {
    ctx.save(); ctx.translate(x, y + bob);
    if (flash) ctx.filter = 'brightness(2.5) sepia(1) saturate(4) hue-rotate(-30deg)';

    const col = '#6b8e23', dark = '#3a5010', skin = '#7aaa2a';

    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.beginPath(); ctx.ellipse(0, 68, 28, 7, 0, 0, Math.PI * 2); ctx.fill();

    // 뒷발·뒷다리
    ctx.fillStyle = '#4a4a4a'; ctx.fillRect(-20, 56, 18, 12);
    ctx.fillStyle = col;       ctx.fillRect(-18, 30, 12, 28);

    // 몸통 (갑옷)
    ctx.fillStyle = col; ctx.fillRect(-24, -14, 42, 46);
    ctx.fillStyle = '#3a3a3a';
    ctx.fillRect(-24, -14, 42, 7); ctx.fillRect(-24, 6, 42, 4); ctx.fillRect(-24, 18, 42, 4);

    // 앞발·앞다리
    ctx.fillStyle = '#4a4a4a'; ctx.fillRect(8, 56, 20, 12);
    ctx.fillStyle = col;       ctx.fillRect(10, 30, 12, 28);

    // 도끼 팔 (공격 모션)
    ctx.save();
    ctx.translate(-30, -10);
    ctx.rotate(_bossAtkAngle);
    ctx.fillStyle = col;      ctx.fillRect(0, 0, 16, 30);
    ctx.fillStyle = col;      ctx.fillRect(-2, 28, 18, 14);
    ctx.fillStyle = '#4a2a10'; ctx.fillRect(-10, 2, 7, 40);
    ctx.fillStyle = '#888';
    ctx.beginPath(); ctx.moveTo(-18, -6); ctx.lineTo(-4, 4); ctx.lineTo(-4, 22); ctx.lineTo(-18, 16); ctx.fill();
    ctx.restore();

    // 오른팔 (뒤)
    ctx.fillStyle = dark; ctx.fillRect(20, -10, 14, 32);

    // 목
    ctx.fillStyle = skin; ctx.fillRect(-8, -22, 14, 10);

    // 뿔 (옆에서 하나)
    ctx.fillStyle = '#8b7355';
    ctx.beginPath();
    ctx.moveTo(-20, -52); ctx.lineTo(-34, -78 + Math.sin(idleT * 1.5) * 2); ctx.lineTo(-8, -60);
    ctx.fill();

    // 머리
    ctx.fillStyle = skin;
    ctx.beginPath(); ctx.ellipse(-4, -42, 24, 22, 0, 0, Math.PI * 2); ctx.fill();

    // 눈 (왼쪽 방향)
    ctx.fillStyle = '#ff2200';
    ctx.beginPath(); ctx.ellipse(-20, -46, 6.5, 6, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#000';
    ctx.beginPath(); ctx.ellipse(-20, -45, 3, 3.5, 0, 0, Math.PI * 2); ctx.fill();

    // 엄니 (옆에서 하나)
    ctx.fillStyle = '#f5f5dc';
    ctx.beginPath(); ctx.moveTo(-4, -26); ctx.lineTo(-10, -10); ctx.lineTo(0, -20); ctx.fill();

    ctx.filter = 'none'; ctx.restore();
  }

  function drawDemon(x, y, bob, flash) {
    ctx.save(); ctx.translate(x, y + bob);
    if (flash) ctx.filter = 'brightness(2.5) sepia(1) saturate(4) hue-rotate(-30deg)';

    // 오라 (왼쪽 방향 중심)
    const aura = ctx.createRadialGradient(-4, -40, 6, -4, -40, 72);
    aura.addColorStop(0, 'rgba(180,0,0,0.18)'); aura.addColorStop(1, 'rgba(180,0,0,0)');
    ctx.fillStyle = aura;
    ctx.beginPath(); ctx.ellipse(-4, -40, 76, 72, 0, 0, Math.PI * 2); ctx.fill();

    ctx.fillStyle = 'rgba(80,0,0,0.38)';
    ctx.beginPath(); ctx.ellipse(0, 76, 34, 8, 0, 0, Math.PI * 2); ctx.fill();

    // 날개 (뒤쪽 한 장, 옆에서)
    const wf = Math.sin(idleT * 3) * 0.1;
    ctx.save(); ctx.translate(-16, -28); ctx.rotate(-wf);
    ctx.fillStyle = '#150008';
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.bezierCurveTo(-52, -62, -82, -18, -60, 32);
    ctx.bezierCurveTo(-40, 16, -16, 4, 0, 0); ctx.fill();
    ctx.strokeStyle = '#2a0015'; ctx.lineWidth = 1;
    [0.3, 0.6, 0.9].forEach(t2 => {
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-62 * t2, -38 + 46 * t2); ctx.stroke();
    });
    ctx.restore();

    // 뒷발·뒷다리
    ctx.fillStyle = '#100404'; ctx.fillRect(-20, 64, 16, 12);
    ctx.fillStyle = '#1e0808'; ctx.fillRect(-18, 36, 12, 30);

    // 몸통
    ctx.fillStyle = '#140614'; ctx.fillRect(-24, -22, 44, 60);
    ctx.strokeStyle = '#7a0000'; ctx.lineWidth = 2;
    [-8, 4, 18].forEach(ry => {
      ctx.beginPath(); ctx.moveTo(-24, ry); ctx.lineTo(20, ry); ctx.stroke();
    });
    ctx.fillStyle = '#7a0000'; ctx.beginPath(); ctx.ellipse(-4, 4, 8, 5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#cc0000'; ctx.beginPath(); ctx.ellipse(-4, 4, 4, 2.5, 0, 0, Math.PI * 2); ctx.fill();

    // 앞발·앞다리
    ctx.fillStyle = '#100404'; ctx.fillRect(8, 64, 16, 12);
    ctx.fillStyle = '#1e0808'; ctx.fillRect(10, 36, 12, 30);

    // 팔 (왼쪽, 오브)
    const mg = 0.6 + 0.4 * Math.sin(idleT * 4);
    ctx.fillStyle = '#1e0808'; ctx.fillRect(-28, -16, 12, 34);
    ctx.shadowBlur = 8; ctx.shadowColor = '#aa00cc';
    ctx.fillStyle = `rgba(140,0,200,${mg})`;
    ctx.beginPath(); ctx.arc(-28, 14, 10, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;

    // 팔 (오른쪽, 뒤)
    ctx.fillStyle = '#1e0808'; ctx.fillRect(20, -16, 10, 30);

    // 목
    ctx.fillStyle = '#1e0808'; ctx.fillRect(-8, -30, 12, 10);

    // 머리 (왼쪽 방향)
    ctx.fillStyle = '#140010';
    ctx.beginPath(); ctx.ellipse(-4, -50, 22, 20, 0, 0, Math.PI * 2); ctx.fill();

    // 뿔들 (앞쪽 2개만)
    ctx.fillStyle = '#7a0000';
    [[-14, -66], [-2, -74]].forEach(([hx, hy]) => {
      ctx.beginPath(); ctx.moveTo(hx - 4, -64); ctx.lineTo(hx - 4, hy + Math.sin(idleT * 2) * 1.5); ctx.lineTo(hx + 4, -64); ctx.fill();
    });

    // 눈 (왼쪽 방향)
    ctx.shadowBlur = 12; ctx.shadowColor = '#ff0000';
    ctx.fillStyle = '#ff2200';
    ctx.beginPath(); ctx.ellipse(-18, -52, 6.5, 5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#000'; ctx.fillRect(-19, -56, 2, 9);

    ctx.filter = 'none'; ctx.restore();
  }

  function drawBoss(x, y, bob, flash) {
    if (!currentStage) return;
    if (currentStage.id === 'easy') drawGoblin(x, y, bob, flash);
    else if (currentStage.id === 'normal') drawOrc(x, y, bob, flash);
    else drawDemon(x, y, bob, flash);
  }

  // ── animations ──
  function animateRound() {
    _queue = []; _cur = null;
    _px = _bx = _by = 0; _swordAngle = 0; _slashAlpha = 0;
    _bossFlash = false; _playerFlash = false;
    _proj = null; _impacts = [];
    _bossAtkAngle = 0;

    const GY = getGY();
    const bo = getBossOff();
    const sg = currentState?.equippedSword?.grade;
    const swordCol = gc(sg || 'low').s;
    const ibx = 295, iby = GY - bo + 10;
    const ipx = 88, ipy = GY - 20;

    qa(90, t => {
      _px = -ease(t) * 7;
      _swordAngle = -ease(t) * Math.PI * 0.62;
    }, null);

    qa(110, t => {
      _px = -7 + ease(t) * 33;
      _swordAngle = -Math.PI * 0.62 + ease(t) * Math.PI * 1.55;
      _slashAlpha = t < 0.5 ? t * 2 : (1 - t) * 2;
      if (t > 0.45 && !_bossFlash) {
        _bossFlash = true;
        spawnImpact(ibx, iby, 9, swordCol);
        _screenShakePower = 5;
      }
    }, () => { _px = 0; _swordAngle = 0; _slashAlpha = 0; _bossFlash = false; });

    qa(40, () => {}, null);

    const id = currentStage?.id;
    const atkCol = id === 'hard' ? '#dd44ff' : id === 'normal' ? '#c8a832' : '#7dcc5a';
    const atkShake = id === 'normal' ? 9 : id === 'hard' ? 7 : 4;
    let hitDone = false;

    if (id === 'hard') {
      qa(140, t => {
        _bx = -Math.sin(ease(t) * Math.PI) * 15;
        const pt = Math.min(t / 0.85, 1);
        _proj = {
          x: 310 - ease(pt) * 238,
          y: (GY - bo - 10) - Math.sin(pt * Math.PI) * 18,
          col: '#cc00ff', size: 7, dx: -1, dy: 0.2
        };
        _playerFlash = t > 0.5;
        if (t > 0.5 && !hitDone) {
          hitDone = true;
          spawnImpact(ipx, ipy, 9, atkCol);
          _screenShakePower = atkShake;
        }
      }, () => { _bx = 0; _by = 0; _playerFlash = false; _proj = null; });

    } else if (id === 'normal') {
      qa(50, t => {
        _bx = ease(t) * 15;
        _by = -ease(t) * 10;
        _bossAtkAngle = ease(t) * Math.PI * 0.55;
      }, null);
      qa(90, t => {
        _bx = 15 - ease(t) * 105;
        _by = -10 + ease(t) * 10;
        _bossAtkAngle = Math.PI * 0.55 - ease(t) * Math.PI * 1.35;
        _playerFlash = t > 0.5;
        if (t > 0.5 && !hitDone) {
          hitDone = true;
          spawnImpact(ipx, ipy, 8, atkCol);
          _screenShakePower = atkShake;
        }
      }, () => { _bx = 0; _by = 0; _bossAtkAngle = 0; _playerFlash = false; });

    } else {
      qa(50, t => {
        _bx = ease(t) * 12;
        _bossAtkAngle = -ease(t) * Math.PI * 0.55;
      }, null);
      qa(90, t => {
        _bx = 12 - ease(t) * 82;
        _bossAtkAngle = -Math.PI * 0.55 + ease(t) * Math.PI * 1.0;
        _playerFlash = t > 0.55;
        if (t > 0.55 && !hitDone) {
          hitDone = true;
          spawnImpact(ipx, ipy, 6, atkCol);
          _screenShakePower = atkShake;
        }
      }, () => { _bx = 0; _by = 0; _bossAtkAngle = 0; _playerFlash = false; });
    }
  }

  function animateVictory() {
    _queue = []; _cur = null; _victory = true;
    qa(500, t => { _py = -Math.sin(ease(t) * Math.PI) * 28; }, () => { _py = 0; });
  }

  function animateDefeat() {
    _queue = []; _cur = null; _defeated = true;
    qa(800, t => { _defeatAlpha = t * 0.55; }, () => { _defeatAlpha = 0.55; });
  }

  function reset() {
    _px = _py = _bx = _by = 0;
    _bossFlash = _playerFlash = _defeated = _victory = false;
    _defeatAlpha = 0;
    _queue = []; _cur = null;
    _swordAngle = 0; _slashAlpha = 0;
    _impacts = []; _proj = null;
    _screenShakePower = _shakeX = _shakeY = 0;
    _bossAtkAngle = 0;
  }

  return { init, stop, reset, animateRound, animateVictory, animateDefeat };
})();
