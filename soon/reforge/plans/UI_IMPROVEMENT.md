# Reforge 게임 UI 개선 계획

## Context

Reforge 강화 게임의 3가지 UX 개선 요청:
1. 강화 확률/비용을 팝업으로 볼 수 있는 버튼 추가 (현재는 강화 선택 시에만 확인 가능)
2. 로컬스토리지 기반이라 의미 없는 플레이타임 제거
3. 전체적인 여백 축소 (너무 느슨한 레이아웃)

---

## 변경 파일 요약

| 파일 | 변경 유형 |
|------|-----------|
| `index.html` | 타이머/플레이타임 요소 삭제, 팝업 버튼 및 팝업 HTML 추가 |
| `style.css` | 여백 값 12개 축소, 불필요 규칙 삭제, 팝업 스타일 추가 |
| `js/uiManager.js` | 타이머 함수 삭제, 랭킹/게임오버 함수 변경, 팝업 함수 추가 |
| `js/rankingSystem.js` | addRanking 간소화, formatTime/getStars 삭제 |
| `js/main.js` | 타이머 호출 제거, 플레이타임 계산 제거, bindProbInfo 호출 추가 |

---

## 변경 1: 강화 정보 팝업 버튼

### 구현 위치

- `index.html`: #enhance-panel 바로 다음 형제 요소로 📊 강화 정보 버튼 래퍼 삽입
- `index.html`: 기존 모달들 다음에 팝업 HTML 추가
- `js/uiManager.js`: 팝업 함수 5개 추가, bindProbInfo() 공개
- `js/main.js`: init() 안에서 UIManager.bindProbInfo() 호출 한 줄 추가
- `style.css`: 팝업 스타일 블록 추가

### index.html 변경

라인 45 (`</div>` — enhance-panel 닫힘) 다음에 삽입:
```html
<div class="enhance-info-btn-wrap">
  <button id="btn-prob-info" class="btn-sm">📊 강화 정보</button>
</div>
```

기존 `#box-open-modal` 닫힘 태그 다음에 팝업 HTML 삽입:
```html
<!-- 강화 정보 팝업 -->
<div id="prob-info-modal" class="prob-info-overlay">
  <div class="prob-info-card">
    <div class="prob-info-header">
      <span>📊 강화 정보</span>
      <button id="prob-info-close" class="btn-sm">✕ 닫기</button>
    </div>
    <div class="prob-info-tabs">
      <button class="prob-tab-btn active" data-grade="high">상급</button>
      <button class="prob-tab-btn" data-grade="mid">중급</button>
      <button class="prob-tab-btn" data-grade="low">하급</button>
    </div>
    <div id="prob-info-table"></div>
  </div>
</div>
```

### uiManager.js 변경

모듈 내부에 추가할 함수들:

```js
function _probInfoMaxLevel(grade) {
  const startIdx = CONFIG.GRADE_START_INDEX[grade];
  const firstOnePercent = Math.max(0, CONFIG.PROB_TABLE.length - 1 - startIdx);
  return Math.min(20, firstOnePercent + 5);
}

function _buildProbTable(grade) {
  const maxLevel = _probInfoMaxLevel(grade);
  let rows = '';
  for (let lv = 0; lv < maxLevel; lv++) {
    const prob = getProbability(grade, lv);
    const cost = getEnhanceCost(grade, lv);
    const probClass = prob <= 30 ? 'text-danger' : 'text-success';
    rows += `<tr>
      <td>+${lv} → +${lv + 1}</td>
      <td class="${probClass}">${prob}%</td>
      <td>${formatGold(cost)}</td>
    </tr>`;
  }
  return `<table class="prob-table">
    <thead><tr><th>레벨</th><th>확률</th><th>비용</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
}

function _switchProbTab(grade) {
  document.querySelectorAll('.prob-tab-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.grade === grade);
  });
  document.getElementById('prob-info-table').innerHTML = _buildProbTable(grade);
}

function openProbInfoModal() {
  const defaultGrade = (_selectedSlotKey && _state && _state[_selectedSlotKey])
    ? _state[_selectedSlotKey].grade : 'high';
  _switchProbTab(defaultGrade);
  document.getElementById('prob-info-modal').classList.add('active');
}

function bindProbInfo() {
  document.getElementById('btn-prob-info').addEventListener('click', openProbInfoModal);
  document.getElementById('prob-info-close').addEventListener('click', () => {
    document.getElementById('prob-info-modal').classList.remove('active');
  });
  document.getElementById('prob-info-modal').addEventListener('click', function(e) {
    if (e.target === this) this.classList.remove('active');
  });
  document.querySelectorAll('.prob-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => _switchProbTab(btn.dataset.grade));
  });
}
```

return 블록에 `bindProbInfo` 추가.

### main.js 변경

`init()` 안에 `UIManager.bindProbInfo()` 한 줄 추가 (bindTabs() 다음).

### style.css 추가 (파일 말미)

- `.prob-info-overlay`: `display:none` / `.active`시 `display:flex`, fixed 오버레이
- `.prob-info-card`: bg-card, 최대 너비 420px, 최대 높이 80vh, `overflow-y: auto`
- `.prob-info-header`, `.prob-info-tabs`, `.prob-tab-btn`, `.prob-table` 스타일
- `.enhance-info-btn-wrap`: `margin-bottom: 12px`

---

## 변경 2: 플레이타임 제거

### index.html 변경

- 라인 14 삭제: `.header-timer` div 전체
- 라인 96 삭제: `.gameover-time` div 전체

### js/rankingSystem.js 변경

- `addRanking(state, playTimeMs)` → `addRanking(state)`: playTimeMs 제거, 날짜만 저장, 최신순 정렬
- `formatTime`, `getStars` 함수 삭제
- `return { addRanking }` 만 남김

```js
function addRanking(state) {
  const entry = { date: new Date().toISOString().slice(0, 10) };
  state.rankings.unshift(entry);
  if (state.rankings.length > CONFIG.MAX_RANKINGS) {
    state.rankings = state.rankings.slice(0, CONFIG.MAX_RANKINGS);
  }
}
```

### js/uiManager.js 변경

- `getElapsed`, `formatElapsed`, `startTimer`, `stopTimer` 함수 삭제
- `renderRanking(state, currentPlayTime)` → `renderRanking(state)`: isCurrent/stars 로직 제거, rank-time/rank-stars span 제거, 날짜만 표시
- `showGameOver(state, playTimeMs)` → `showGameOver(state)`: stopTimer 호출 제거, gameover-time 업데이트 코드 제거
- return 블록에서 `startTimer`, `stopTimer` 제거

### js/main.js 변경

- `init()`: `UIManager.startTimer(state)` 라인 삭제
- `init()` 내 gameOver 복원 분기: elapsed 계산 삭제, `UIManager.showGameOver(state)` 로 변경
- `handleEnhance` 내 목표 달성 처리: playTimeMs, state.endTime, `RankingSystem.addRanking(state)`, `UIManager.showGameOver(state)` 로 변경
- `handleNewGame()`: `UIManager.startTimer(state)` 삭제

### style.css 변경

- `.header-timer` 규칙 블록 삭제
- `.gameover-time` 규칙 블록 삭제
- `.rank-time`, `.rank-stars` 규칙 삭제

---

## 변경 3: UI 여백 축소

`style.css` 속성값 변경 (12개):

| 선택자 | 속성 | 현재 | 변경 |
|--------|------|------|------|
| `.game-header` | gap | 20px | 12px |
| `.tab-content` | padding | 20px | 14px |
| `.slots-wrap` | gap | 16px | 12px |
| `.slots-wrap` | margin-bottom | 20px | 12px |
| `.slot-card` | padding | 16px | 12px |
| `.slot-card` | gap | 12px | 8px |
| `.enhance-panel` | padding | 16px | 12px |
| `.enhance-panel` | margin-bottom | 20px | 12px |
| `.enhance-info` | gap | 20px | 10px |
| `.enhance-modal-card` | padding | 40px 56px 32px | 28px 32px 20px |
| `.box-modal-card` | padding | 48px 40px 32px | 28px 24px 20px |
| `.ranking-box` | margin-bottom | 24px | 16px |

---

## 검증 방법

1. `index.html`을 브라우저에서 직접 열기
2. 장비/강화 탭에서 📊 강화 정보 버튼 클릭 → 팝업 확인, 등급 탭 전환 확인
3. 장비 장착 후 강화 선택 → 팝업 클릭 시 해당 등급 탭이 기본 활성화 확인
4. 헤더에 타이머 없음 확인
5. 강화합 40 달성 후 게임 오버 화면에서 플레이타임 없이 날짜만 표시된 랭킹 확인
6. 전체적인 레이아웃이 이전보다 compact해졌는지 시각 확인
