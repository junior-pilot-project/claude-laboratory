let state = { interval: 60, routes: [] };
let editingIndex = null;

function renderRoutes() {
  const list = document.getElementById('route-list');
  if (state.routes.length === 0) {
    list.innerHTML = '<div class="empty-msg">등록된 노선이 없습니다. 노선 추가 버튼을 눌러주세요.</div>';
    return;
  }
  list.innerHTML = state.routes.map((r, i) => {
    const timeStr = r.timeRange ? `${r.timeRange.start} ~ ${r.timeRange.end}` : '';
    return `
      <div class="route-item">
        <div class="route-info">
          <span class="site-badge site-${r.site}">${r.site}</span>
          <div>
            <div class="route-main">${r.from} → ${r.to}</div>
            <div class="route-sub">${r.date}${timeStr ? ' · ' + timeStr : ''}</div>
          </div>
        </div>
        <div class="route-actions">
          <button class="btn btn-ghost" onclick="openEdit(${i})">수정</button>
          <button class="btn btn-danger" onclick="deleteRoute(${i})">삭제</button>
        </div>
      </div>`;
  }).join('');
}

async function loadConfig() {
  const res = await fetch('/api/config');
  const data = await res.json();
  state.interval = data.interval ?? 60;
  state.routes = data.routes ?? [];
  document.getElementById('interval').value = state.interval;
  renderRoutes();
}

loadConfig();

// ── 모달 ──────────────────────────────────────────
function openModal() {
  document.getElementById('modal').classList.add('open');
}

function closeModal() {
  document.getElementById('modal').classList.remove('open');
  clearModalErrors();
}

function clearModalErrors() {
  ['f-site','f-date','f-from','f-to','f-time-start','f-time-end'].forEach(id => {
    document.getElementById(id).classList.remove('error');
  });
}

function openAdd() {
  editingIndex = null;
  document.getElementById('modal-title').textContent = '노선 추가';
  document.getElementById('f-site').value = 'kobus';
  document.getElementById('f-date').value = '';
  document.getElementById('f-from').value = '';
  document.getElementById('f-to').value = '';
  document.getElementById('f-time-start').value = '';
  document.getElementById('f-time-end').value = '';
  openModal();
}

function openEdit(index) {
  editingIndex = index;
  const r = state.routes[index];
  document.getElementById('modal-title').textContent = '노선 수정';
  document.getElementById('f-site').value = r.site;
  document.getElementById('f-date').value = r.date;
  document.getElementById('f-from').value = r.from;
  document.getElementById('f-to').value = r.to;
  document.getElementById('f-time-start').value = r.timeRange?.start ?? '';
  document.getElementById('f-time-end').value = r.timeRange?.end ?? '';
  openModal();
}

function saveModal() {
  const site   = document.getElementById('f-site').value;
  const date   = document.getElementById('f-date').value.trim();
  const from   = document.getElementById('f-from').value.trim();
  const to     = document.getElementById('f-to').value.trim();
  const tStart = document.getElementById('f-time-start').value;
  const tEnd   = document.getElementById('f-time-end').value;

  let valid = true;
  clearModalErrors();
  if (!date) { document.getElementById('f-date').classList.add('error'); valid = false; }
  if (!from) { document.getElementById('f-from').classList.add('error'); valid = false; }
  if (!to)   { document.getElementById('f-to').classList.add('error');   valid = false; }
  if ((tStart && !tEnd) || (!tStart && tEnd)) {
    document.getElementById('f-time-start').classList.add('error');
    document.getElementById('f-time-end').classList.add('error');
    valid = false;
  }
  if (!valid) return;

  const route = { site, from, to, date };
  if (tStart && tEnd) route.timeRange = { start: tStart, end: tEnd };

  if (editingIndex === null) {
    state.routes.push(route);
  } else {
    state.routes[editingIndex] = route;
  }
  renderRoutes();
  closeModal();
}

// ── 삭제 ──────────────────────────────────────────
function deleteRoute(index) {
  state.routes.splice(index, 1);
  renderRoutes();
}

// ── 토스트 ────────────────────────────────────────
function showToast(msg, type = 'success') {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = `toast ${type} show`;
  setTimeout(() => { el.className = 'toast'; }, 2800);
}

// ── 저장 ──────────────────────────────────────────
async function saveConfig() {
  const intervalEl = document.getElementById('interval');
  const intervalVal = parseInt(intervalEl.value, 10);
  const errEl = document.getElementById('interval-error');

  if (isNaN(intervalVal) || intervalVal < 60) {
    intervalEl.classList.add('error');
    errEl.style.display = 'block';
    return;
  }
  intervalEl.classList.remove('error');
  errEl.style.display = 'none';

  state.interval = intervalVal;

  try {
    const res = await fetch('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(state),
    });
    if (!res.ok) throw new Error('서버 오류');
    showToast('✅ config.json 저장 완료!');
  } catch {
    showToast('❌ 저장 실패. 서버를 확인하세요.', 'error');
  }
}

// ── 이벤트 바인딩 ─────────────────────────────────
document.getElementById('btn-add').addEventListener('click', openAdd);
document.getElementById('modal-close').addEventListener('click', closeModal);
document.getElementById('modal-cancel').addEventListener('click', closeModal);
document.getElementById('modal-save').addEventListener('click', saveModal);
document.getElementById('modal').addEventListener('click', e => {
  if (e.target === document.getElementById('modal')) closeModal();
});
document.getElementById('btn-save').addEventListener('click', saveConfig);
document.getElementById('interval').addEventListener('input', () => {
  const val = parseInt(document.getElementById('interval').value, 10);
  const valid = !isNaN(val) && val >= 60;
  document.getElementById('interval').classList.toggle('error', !valid);
  document.getElementById('interval-error').style.display = valid ? 'none' : 'block';
});
