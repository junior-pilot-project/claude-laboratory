# 최상급 장비 제작 시스템

## Context

1% 확률 구간에서 게임이 루즈해지는 문제를 해결하기 위해, 레이드 파밍 → 강화연마제 획득 → 최상급 장비 제작이라는 새로운 목표 루프를 추가한다. 최상급 장비는 구매나 강화로는 절대 얻을 수 없고 오직 제작으로만 만들 수 있어, 레이드를 지속적으로 돌게 만드는 유인을 생성한다.

## 핵심 규칙

| 항목 | 내용 |
|------|------|
| 재료 | 상급칼 or 상급방패 +11 + 강화연마제 1개 |
| 성공 확률 | 10% |
| 성공 시 | +11 장비 소모 → 최상급 장비(+0) 생성 |
| 실패 시 | 강화연마제만 소모, +11 장비는 유지 |
| 강화연마제 드롭 | 하급 레이드 1%, 중급 10%, 상급 30% |

## 수정 파일

### 1. `js/config.js`

추가할 상수:
```js
// 등급명
GRADE_NAMES: { ..., supreme: '최상급' }

// 최상급 스탯 (상급 비교: atk=30 def=20 atkMult=3 defMult=3)
ITEM_GRADE_STATS.supreme = { atk: 80, def: 50, atkMult: 5, defMult: 5 }

// 최상급 시작 인덱스 (상급과 동일하게 0)
GRADE_START_INDEX.supreme = 0

// 제작 시스템
CRAFT: {
  SUCCESS_RATE: 10,          // 10%
  REQUIRED_ENHANCEMENT: 11,  // +11 필요
  WHETSTONE_COST: 1          // 연마제 1개
}

// 강화연마제 드롭률 (stage key 기준)
WHETSTONE_DROP_RATES: { easy: 1, normal: 10, hard: 30 }  // %
```

### 2. `js/gameState.js`

`defaultState`에 `whetstones: 0` 추가. `load()` 함수의 마이그레이션 처리 (기존 저장 데이터에 필드 없을 경우 기본값 0 적용).

### 3. `js/craftSystem.js` (신규 파일)

두 가지 함수 export:

```
rollWhetstoneDrops(state, stageKey)
  - CONFIG.WHETSTONE_DROP_RATES[stageKey] 확률로 state.whetstones++
  - 드롭 여부(boolean) 반환

craftSupreme(state, type)
  - 사전 검증: whetstones >= 1, 인벤토리/장착 중에 상급+type+enhancement==11 존재
  - state.whetstones -= 1
  - Math.random() * 100 < CONFIG.CRAFT.SUCCESS_RATE 이면 성공
    - 성공: +11 장비 인벤토리에서 제거(또는 unequip 후 제거), 최상급 아이템 생성 후 인벤토리 추가
    - 실패: 장비 그대로 유지
  - { success, item? } 반환
```

### 4. `js/main.js`

**handleRaidStart 수정** (전투 클리어 후 골드 지급 직후):
```js
// 기존: state.gold += stage.reward;
// 추가:
const dropped = CraftSystem.rollWhetstoneDrops(state, stage.key);
if (dropped) {
  // 드롭 메시지 표시: "강화연마제 획득!"
}
```

**handleCraftAttempt(type) 신규 추가** (`window.handleCraftAttempt`):
```js
const result = CraftSystem.craftSupreme(state, type);
GameState.save(state);
UIManager.renderCraft(state);
UIManager.renderInventory(state);
// 성공/실패 메시지 표시
```

### 5. `js/uiManager.js`

**renderCraft(state) 신규 함수**:
- 강화연마제 보유 수량 표시
- 칼/방패 각각 제작 패널:
  - 재료 충족 여부 표시 (상급+11 보유 여부, 연마제 수량)
  - 제작 시도 버튼 (`onclick="handleCraftAttempt('sword')"`)
- `UIManager`에 등록 후 탭 전환 시 호출

**grade 색상 추가** (최상급 표시용): CSS에 `.grade-supreme` 클래스 추가 → 금색 계열

### 6. `index.html`

탭 버튼 추가 (도박장↔레이드 사이):
```html
<button class="tab-btn" data-tab="craft">🔨 제작</button>
```

탭 콘텐츠 추가:
```html
<section class="tab-content" id="tab-craft"></section>
```

스크립트 로드 순서 추가 (raidSystem.js 다음):
```html
<script src="js/craftSystem.js"></script>
```

## 검증 방법

1. 브라우저에서 `index.html` 직접 열기
2. 상급 장비 구매 후 +11까지 강화 (또는 localStorage에서 직접 설정)
3. 레이드 반복 → 하급에서 드물게, 상급에서 자주 강화연마제 획득 확인
4. 제작 탭에서 재료 충족 시 버튼 활성화, 미충족 시 비활성화 확인
5. 성공(10%) 시 인벤토리에 최상급 장비 생성, 실패 시 연마제만 소모 확인
6. 최상급 장비 장착 후 레이드 전투에서 스탯 반영 확인