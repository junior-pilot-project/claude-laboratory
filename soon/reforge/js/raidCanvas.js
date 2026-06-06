const RaidCanvas = (() => {
  let canvas, ctx, rafId, idleT = 0;
  let currentStage = null, currentState = null;

  let _px = 0, _py = 0, _bx = 0;
  let _bossFlash = false, _playerFlash = false;
  let _defeatAlpha = 0, _defeated = false, _victory = false;
  let _queue = [], _cur = null;

  const ease = t => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;

  function init(canvasId, stage, state) {
    if (rafId) cancelAnimationFrame(rafId);
    canvas = document.getElementById(canvasId);
    if (!canvas) return;
    ctx = canvas.getContext('2d');
    currentStage = stage;
    currentState = state;
    _px = _py = _bx = 0;
    _bossFlash = _playerFlash = _defeated = _victory = false;
    _defeatAlpha = 0;
    _queue = []; _cur = null;
    rafId = requestAnimationFrame(loop);
  }

  function stop() {
    if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
  }

  function loop(ts) {
    idleT = ts * 0.001;
    tick();
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
    const GY = Math.floor(H * 0.75);
    ctx.clearRect(0, 0, W, H);
    drawBg(W, H, GY);

    const cx = 80 + _px, cy = GY - 44 + _py;
    const bossOff = currentStage?.id === 'hard' ? 76 : currentStage?.id === 'normal' ? 68 : 50;
    const bx = 310 + _bx, by = GY - bossOff;
    const bob = Math.sin(idleT * 2) * 2;

    drawKnight(cx, cy, bob, _playerFlash, _defeated);
    drawBoss(bx, by, bob * -0.8, _bossFlash);

    if (_victory) {
      ctx.globalAlpha = 0.45 + 0.35 * Math.sin(idleT * 8);
      const g = ctx.createRadialGradient(cx, cy - 30, 4, cx, cy - 30, 50);
      g.addColorStop(0, '#ffd700'); g.addColorStop(1, 'transparent');
      ctx.fillStyle = g;
      ctx.fillRect(cx - 52, cy - 80, 104, 80);
      ctx.globalAlpha = 1;
    }
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

  function drawKnight(x, y, bob, flash, defeated) {
    ctx.save(); ctx.translate(x, y + bob);
    if (defeated) ctx.rotate(0.4);
    if (flash) ctx.filter = 'brightness(2.5) sepia(1) saturate(4) hue-rotate(-30deg)';

    const sg = currentState?.equippedSword?.grade;
    const hg = currentState?.equippedShield?.grade;
    const ac = gc(sg || hg || 'low');

    if (!defeated) {
      ctx.fillStyle = 'rgba(0,0,0,0.22)';
      ctx.beginPath(); ctx.ellipse(0, 44, 20, 5, 0, 0, Math.PI * 2); ctx.fill();
    }

    // boots
    ctx.fillStyle = '#2a1a0a';
    ctx.fillRect(-11, 34, 10, 10); ctx.fillRect(1, 34, 10, 10);
    // legs
    ctx.fillStyle = ac.d;
    ctx.fillRect(-10, 18, 8, 18); ctx.fillRect(2, 18, 8, 18);
    // torso
    ctx.fillStyle = ac.b; ctx.fillRect(-13, -6, 26, 26);
    ctx.fillStyle = ac.d; ctx.fillRect(-13, 6, 26, 3); ctx.fillRect(-1, -6, 2, 26);

    // shield
    if (hg) {
      const sc = gc(hg);
      ctx.fillStyle = sc.b; ctx.fillRect(-26, -8, 14, 22);
      ctx.fillStyle = sc.s; ctx.fillRect(-20, -3, 2, 10);
      ctx.strokeStyle = sc.d; ctx.lineWidth = 1; ctx.strokeRect(-26, -8, 14, 22);
    } else {
      ctx.fillStyle = '#9a6a3a'; ctx.fillRect(-21, 0, 8, 16);
    }

    // sword
    if (sg) {
      const wc = gc(sg);
      ctx.fillStyle = '#4a2a10'; ctx.fillRect(13, 6, 5, 14);
      ctx.fillStyle = wc.d; ctx.fillRect(9, 6, 13, 4);
      ctx.fillStyle = wc.s; ctx.fillRect(16, -22, 4, 28);
      ctx.fillStyle = 'rgba(255,255,255,0.65)'; ctx.fillRect(17, -22, 1, 28);
    } else {
      ctx.fillStyle = '#9a6a3a'; ctx.fillRect(13, 0, 8, 16);
    }

    // neck
    ctx.fillStyle = '#c8a070'; ctx.fillRect(-4, -11, 8, 7);
    // helmet
    ctx.fillStyle = ac.b;
    ctx.beginPath(); ctx.arc(0, -22, 14, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = ac.d; ctx.fillRect(-11, -26, 22, 7);
    // visor
    ctx.fillStyle = '#00ffaa'; ctx.fillRect(-8, -25, 16, 3);
    // plume
    ctx.fillStyle = '#cc2244';
    ctx.beginPath();
    ctx.moveTo(-3, -36); ctx.lineTo(0, -46 + Math.sin(idleT * 2.5) * 2); ctx.lineTo(3, -36);
    ctx.fill();

    ctx.filter = 'none'; ctx.restore();
  }

  function drawGoblin(x, y, bob, flash) {
    ctx.save(); ctx.translate(x, y + bob);
    if (flash) ctx.filter = 'brightness(2.5) sepia(1) saturate(4) hue-rotate(-30deg)';

    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.beginPath(); ctx.ellipse(0, 50, 22, 6, 0, 0, Math.PI * 2); ctx.fill();

    ctx.fillStyle = '#1a2c10';
    ctx.fillRect(-17, 40, 13, 10); ctx.fillRect(4, 40, 13, 10);
    ctx.fillStyle = '#2d4a1e';
    ctx.fillRect(-14, 18, 10, 24); ctx.fillRect(4, 18, 10, 24);
    ctx.fillStyle = '#3d6b28'; ctx.fillRect(-18, -10, 36, 30);
    ctx.fillStyle = '#5a3a1a'; ctx.fillRect(-18, 15, 36, 6);
    ctx.fillStyle = '#c8a832'; ctx.fillRect(-4, 15, 8, 6);
    ctx.fillStyle = '#3d6b28';
    ctx.fillRect(-32, -8, 15, 20); ctx.fillRect(17, -8, 15, 20);
    ctx.fillStyle = '#c8a832';
    [-32,-27,-22].forEach(cx2 => ctx.fillRect(cx2, 10, 3, 7));
    [17,22,27].forEach(cx2 => ctx.fillRect(cx2+12, 10, 3, 7));

    ctx.fillStyle = '#3d6b28'; ctx.fillRect(-5, -17, 10, 9);
    ctx.fillStyle = '#4d8a34';
    ctx.beginPath(); ctx.ellipse(0, -33, 20, 18, 0, 0, Math.PI * 2); ctx.fill();

    // ears
    ctx.fillStyle = '#3d6b28';
    ctx.beginPath();
    ctx.moveTo(-18,-33); ctx.lineTo(-32,-52+Math.sin(idleT*2)*1.5); ctx.lineTo(-8,-26); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(18,-33); ctx.lineTo(32,-52+Math.sin(idleT*2)*1.5); ctx.lineTo(8,-26); ctx.fill();

    ctx.fillStyle = '#ffee00';
    ctx.beginPath(); ctx.ellipse(-8,-36,6,7,0,0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(8,-36,6,7,0,0,Math.PI*2); ctx.fill();
    ctx.fillStyle = '#000';
    ctx.beginPath(); ctx.ellipse(-8,-35,2.5,4,0,0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(8,-35,2.5,4,0,0,Math.PI*2); ctx.fill();

    ctx.fillStyle = '#111'; ctx.fillRect(-8,-24,16,5);
    ctx.fillStyle = '#fff'; [-7,-3,1,5].forEach(tx => ctx.fillRect(tx,-24,3,3));

    ctx.filter = 'none'; ctx.restore();
  }

  function drawOrc(x, y, bob, flash) {
    ctx.save(); ctx.translate(x, y + bob);
    if (flash) ctx.filter = 'brightness(2.5) sepia(1) saturate(4) hue-rotate(-30deg)';

    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.beginPath(); ctx.ellipse(0, 68, 32, 8, 0, 0, Math.PI*2); ctx.fill();

    ctx.fillStyle = '#4a4a4a';
    ctx.fillRect(-23,54,21,14); ctx.fillRect(2,54,21,14);
    ctx.fillStyle = '#556b2f';
    ctx.fillRect(-20,26,16,30); ctx.fillRect(4,26,16,30);
    ctx.fillStyle = '#6b8e23'; ctx.fillRect(-28,-16,56,44);
    ctx.fillStyle = '#3a3a3a';
    ctx.fillRect(-28,-16,56,7); ctx.fillRect(-28,5,56,4); ctx.fillRect(-28,18,56,4);
    ctx.fillStyle = '#555';
    ctx.beginPath(); ctx.arc(-28,-10,13,0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(28,-10,13,0,Math.PI*2); ctx.fill();
    ctx.fillStyle = '#6b8e23';
    ctx.fillRect(-46,-14,20,34); ctx.fillRect(26,-14,20,34);
    ctx.fillStyle = '#556b2f';
    ctx.fillRect(-48,18,22,15); ctx.fillRect(26,18,22,15);

    // axe
    ctx.fillStyle = '#4a2a10'; ctx.fillRect(-58,-10,8,38);
    ctx.fillStyle = '#777';
    ctx.beginPath(); ctx.moveTo(-66,-22); ctx.lineTo(-50,-10); ctx.lineTo(-50,8); ctx.lineTo(-66,4); ctx.fill();

    ctx.fillStyle = '#6b8e23'; ctx.fillRect(-9,-24,18,10);
    ctx.fillStyle = '#7a9e2a';
    ctx.beginPath(); ctx.ellipse(0,-44,28,22,0,0,Math.PI*2); ctx.fill();

    ctx.fillStyle = '#8b7355';
    ctx.beginPath(); ctx.moveTo(-18,-57); ctx.lineTo(-30,-80+Math.sin(idleT*1.5)*2); ctx.lineTo(-4,-63); ctx.fill();
    ctx.beginPath(); ctx.moveTo(18,-57); ctx.lineTo(30,-80+Math.sin(idleT*1.5)*2); ctx.lineTo(4,-63); ctx.fill();

    ctx.fillStyle = '#ff2200';
    ctx.beginPath(); ctx.ellipse(-11,-48,7,6,0,0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(11,-48,7,6,0,0,Math.PI*2); ctx.fill();
    ctx.fillStyle = '#000';
    ctx.beginPath(); ctx.ellipse(-11,-47,3,4,0,0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(11,-47,3,4,0,0,Math.PI*2); ctx.fill();

    ctx.fillStyle = '#f5f5dc';
    ctx.beginPath(); ctx.moveTo(-6,-32); ctx.lineTo(-12,-18); ctx.lineTo(-2,-25); ctx.fill();
    ctx.beginPath(); ctx.moveTo(6,-32); ctx.lineTo(12,-18); ctx.lineTo(2,-25); ctx.fill();

    ctx.filter = 'none'; ctx.restore();
  }

  function drawDemon(x, y, bob, flash) {
    ctx.save(); ctx.translate(x, y + bob);
    if (flash) ctx.filter = 'brightness(2.5) sepia(1) saturate(4) hue-rotate(-30deg)';

    // aura
    const aura = ctx.createRadialGradient(0,-40,8,0,-40,75);
    aura.addColorStop(0,'rgba(180,0,0,0.18)'); aura.addColorStop(1,'rgba(180,0,0,0)');
    ctx.fillStyle = aura;
    ctx.beginPath(); ctx.ellipse(0,-40,80,75,0,0,Math.PI*2); ctx.fill();

    ctx.fillStyle = 'rgba(80,0,0,0.38)';
    ctx.beginPath(); ctx.ellipse(0,76,38,9,0,0,Math.PI*2); ctx.fill();

    // wings
    const wf = Math.sin(idleT * 3) * 0.12;
    [1, -1].forEach(dir => {
      ctx.save(); ctx.scale(dir, 1); ctx.rotate(dir * wf);
      ctx.fillStyle = '#150008';
      ctx.beginPath(); ctx.moveTo(12,-28); ctx.bezierCurveTo(55,-75,88,-35,68,12); ctx.bezierCurveTo(50,6,25,-5,12,-28); ctx.fill();
      ctx.strokeStyle = '#2a0015'; ctx.lineWidth = 1;
      [0.3,0.6,0.9].forEach(t2 => {
        ctx.beginPath(); ctx.moveTo(12,-28); ctx.lineTo(12+56*t2,-28-28*(1-t2)+35*t2); ctx.stroke();
      });
      ctx.restore();
    });

    // hooves
    ctx.fillStyle = '#100404';
    [-20,-12,2,10].forEach(hx => ctx.fillRect(hx,66,9,10));
    ctx.fillStyle = '#1e0808';
    ctx.fillRect(-18,30,14,38); ctx.fillRect(4,30,14,38);
    ctx.fillStyle = '#140614'; ctx.fillRect(-24,-22,48,54);

    ctx.strokeStyle = '#7a0000'; ctx.lineWidth = 2;
    [-8,4,16].forEach(ry => { ctx.beginPath(); ctx.moveTo(-24,ry); ctx.lineTo(24,ry); ctx.stroke(); });

    // chest sigil
    ctx.fillStyle = '#7a0000'; ctx.beginPath(); ctx.ellipse(0,-4,9,5,0,0,Math.PI*2); ctx.fill();
    ctx.fillStyle = '#cc0000'; ctx.beginPath(); ctx.ellipse(0,-4,4,2.5,0,0,Math.PI*2); ctx.fill();

    ctx.fillStyle = '#1e0808';
    ctx.fillRect(-38,-18,16,34); ctx.fillRect(22,-18,16,34);

    const mg = 0.6 + 0.4 * Math.sin(idleT * 4);
    ctx.shadowBlur = 8; ctx.shadowColor = '#aa00cc';
    ctx.fillStyle = `rgba(140,0,200,${mg})`; ctx.beginPath(); ctx.arc(-32,16,11,0,Math.PI*2); ctx.fill();
    ctx.shadowColor = '#cc0066';
    ctx.fillStyle = `rgba(200,0,100,${mg})`; ctx.beginPath(); ctx.arc(32,16,11,0,Math.PI*2); ctx.fill();
    ctx.shadowBlur = 0;

    ctx.fillStyle = '#1e0808'; ctx.fillRect(-7,-30,14,10);
    ctx.fillStyle = '#140010';
    ctx.beginPath(); ctx.ellipse(0,-50,26,22,0,0,Math.PI*2); ctx.fill();

    // crown horns
    ctx.fillStyle = '#7a0000';
    [[-17,-65],[-7,-76],[0,-80],[7,-76],[17,-65]].forEach(([hx,hy]) => {
      ctx.beginPath(); ctx.moveTo(hx-4,-63); ctx.lineTo(hx,hy+Math.sin(idleT*2)*1.5); ctx.lineTo(hx+4,-63); ctx.fill();
    });

    ctx.shadowBlur = 12; ctx.shadowColor = '#ff0000';
    ctx.fillStyle = '#ff2200';
    ctx.beginPath(); ctx.ellipse(-10,-53,7,5,0,0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(10,-53,7,5,0,0,Math.PI*2); ctx.fill();
    ctx.shadowBlur = 0;

    ctx.fillStyle = '#000'; ctx.fillRect(-11,-57,2,9); ctx.fillRect(9,-57,2,9);

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

    // player lunges → boss flashes
    qa(140, t => {
      _px = Math.sin(ease(t) * Math.PI) * 22;
      _bossFlash = t > 0.5;
    }, () => { _px = 0; _bossFlash = false; });

    // brief gap
    qa(40, () => {}, null);

    // boss retaliates → player flashes
    qa(140, t => {
      _bx = -Math.sin(ease(t) * Math.PI) * 18;
      _playerFlash = t > 0.5;
    }, () => { _bx = 0; _playerFlash = false; });
  }

  function animateVictory() {
    _queue = []; _cur = null; _victory = true;
    qa(500, t => { _py = -Math.sin(ease(t) * Math.PI) * 28; }, () => { _py = 0; });
  }

  function animateDefeat() {
    _queue = []; _cur = null; _defeated = true;
    qa(800, t => { _defeatAlpha = t * 0.55; }, () => { _defeatAlpha = 0.55; });
  }

  return { init, stop, animateRound, animateVictory, animateDefeat };
})();
