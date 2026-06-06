# Reforge 게임 추가 개발 계획

## Context

Reforge 장비 강화 게임에 5가지 개선사항을 추가한다. 도박장 UX 개선(다중 오픈, 이펙트, 중복 방지), 초기 자본 조정, 강화 비용 밸런스 조정이 목적이다.

---

## 변경 대상 파일

| 파일 | 경로 |
|------|------|
| config.js | `js/config.js` |
| uiManager.js | `js/uiManager.js` |
| main.js | `js/main.js` |
| style.css | `style.css` |

---

## 세부 구현 계획

### 1. 천원/만원 상자 최대 10개 한번에 오픈

**`js/config.js`** — `BOXES` 배열에서 `silver`, `gold`의 `maxCount` 수정:
```js
// Before
{ id: 'silver', ..., maxCount: 1 },
{ id: 'gold',   ..., maxCount: 1 },
// After
{ id: 'silver', ..., maxCount: 10 },
{ id: 'gold',   ..., maxCount: 10 },
```

**`js/uiManager.js`** — `renderGambling()` (L141-166): 무료 상자만 count input을 보여주던 조건(`box.id === 'free'`)을 제거하고 모든 상자에 count input 표시:
```js
// Before: ${box.id === 'free' ? `<div class="box-count-wrap">...</div>` : ''}
// After:  모든 박스에 count-input 표시
```

---

### 2. 초기 자본 0원

**`js/config.js`** L46:
```js
// Before
INITIAL_GOLD: 50000,
// After
INITIAL_GOLD: 0,
```

---

### 3. 상자 오픈 시각적 이펙트 추가

**`style.css`** — 3개 `@keyframes` 추가:
- `@keyframes boxShake` — 3초 흔들림 (translateX 기반)
- `@keyframes glowBurst` — 오픈 순간 scale + brightness 효과
- `@keyframes rewardPop` — 각 보상 숫자 순차 팝인 (scale 0→1 + translateY)

클래스:
- `.box-shaking` → `boxShake` 3초 적용
- `.box-opening` → `glowBurst` 0.4초 적용
- `.reward-item` → `rewardPop` 적용 (n번째 아이템마다 딜레이 +80ms)

**`js/uiManager.js`** — `showBoxResults(rewards)` (L180-187): 각 reward에 `.reward-item` 클래스 + `animation-delay` 인라인 스타일 추가

**`js/main.js`** — `handleOpenBox()` (L126-149):
- `playBoxShake()` 시작 전: 상자 행 요소에 `.box-shaking` 클래스 추가
- 콜백 진입 시: `.box-shaking` 제거, `.box-opening` 추가
- 0.4초 후: `.box-opening` 제거

---

### 4. 상자 오픈 중 중복 오픈 방지

**`js/main.js`** — 모듈 상단에 `let isOpening = false` 플래그 추가

`handleOpenBox()` 수정:
```js
window.handleOpenBox = function(boxId, count) {
  if (isOpening) return;          // 중복 방지
  isOpening = true;
  // 도박장 탭 내 모든 .btn-open-box 비활성화
  document.querySelectorAll('.btn-open-box').forEach(b => b.disabled = true);

  soundManager.playBoxShake(() => {
    // ... 기존 로직 ...
    isOpening = false;
    document.querySelectorAll('.btn-open-box').forEach(b => b.disabled = false);
  });
};
```

---

### 5. 강화 비용 밸런스 하향

현재 하드존 비용(`COST_HARD_PER_LEVEL`)이 Easy Zone의 **100배** (100만원)로 진입장벽이 너무 높음.

**`js/config.js`** L21-22:
```js
// Before
COST_EASY_PER_LEVEL: 10000,
COST_HARD_PER_LEVEL: 1000000,

// After
COST_EASY_PER_LEVEL: 5000,       // 50% 감소
COST_HARD_PER_LEVEL: 100000,     // 90% 감소 (Easy의 20배)
```

조정 근거:
- 만원 상자 기대 수익 ≈ 23,333원/개
- 조정 후 하드존 1레벨 비용(100,000원) = 만원 상자 약 4~5개 수익으로 충당 가능
- 조정 전(1,000,000원)은 만원 상자 43개 수익 필요 → 진입장벽 과도

---

## 검증 방법

1. `index.html`을 브라우저에서 열어 도박장 탭 진입
2. 천원 상자, 만원 상자에 count input이 표시되는지 확인
3. 각 상자 10개 선택 후 오픈 → 상자 흔들림 + 오픈 이펙트 확인
4. 오픈 중 버튼 중복 클릭 시 무시되는지 확인
5. 새 게임 시작 시 초기 골드가 0원인지 확인
6. 아이템 강화 탭에서 하드존 비용이 100,000원/레벨인지 확인
