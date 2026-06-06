# 레이드 탭 추가 계획

## Context

현재 게임은 강화 → 목표 달성(강화합 40)만 있어 반복 플레이 동기가 약하다. 장비를 강화하면 실질적으로 더 강해진다는 피드백이 없기 때문에 강화의 재미가 반감된다. 레이드 탭을 추가해 "강화할수록 더 강한 보스를 잡을 수 있다"는 성장감을 부여하고, 보스 클리어 골드를 강화 자금으로 순환시켜 게임 루프를 풍부하게 만든다.

## 최종 설계 요약

- **진행 방식**: 자동 전투 (5초, 10라운드 × 0.5초 간격)
- **패배 조건**: 없음 (클리어 여부만 존재 — 보스 HP가 0이 되면 클리어, 아니면 실패)
- **입장료**: 없음
- **보상**: 골드 (스테이지별 차등) + 반복 가능
- **스테이지 잠금**: 강화합 기반

---

## 스탯 공식

### 플레이어 공격력 (ATK) — 장착 칼 기준
| 등급 | 기본값 | 강화치 배율 |
|------|--------|------------|
| 하급 | 5      | ×1         |
| 중급 | 15     | ×2         |
| 상급 | 30     | ×3         |

미장착 시 ATK = 1

### 플레이어 방어력 (DEF) — 장착 방패 기준
| 등급 | 기본값 | 강화치 배율 |
|------|--------|------------|
| 하급 | 3      | ×1         |
| 중급 | 10     | ×2         |
| 상급 | 20     | ×3         |

미장착 시 DEF = 0

---

## 보스 스펙 & 스테이지 설정

| 스테이지 | 보스 HP | 보스 ATK | 보상 골드 | 잠금 해제 조건 |
|----------|---------|----------|----------|--------------|
| 하급     | 100     | 12       | 30,000   | 항상 가능     |
| 중급     | 300     | 35       | 100,000  | 강화합 ≥ 10  |
| 상급     | 700     | 80       | 300,000  | 강화합 ≥ 20  |

**전투 공식:**
- 플레이어 HP = 100 (고정)
- 라운드당: 플레이어가 ATK만큼 보스 공격 → 보스가 max(0, 보스ATK - DEF)만큼 반격
- 최대 10라운드 (보스 HP > 0이면 전투 종료 = 실패)
- 보스 HP ≤ 0 → 클리어

---

## 구현 파일 목록

### 1. `js/config.js` — 상수 추가
```js
ITEM_GRADE_STATS: {
  low:  { atk: 5,  def: 3,  atkMult: 1, defMult: 1 },
  mid:  { atk: 15, def: 10, atkMult: 2, defMult: 2 },
  high: { atk: 30, def: 20, atkMult: 3, defMult: 3 },
},
RAID_STAGES: [
  { id: 'easy',   label: '하급', bossHp: 100, bossAtk: 12, reward: 30000,  unlock: 0  },
  { id: 'normal', label: '중급', bossHp: 300, bossAtk: 35, reward: 100000, unlock: 10 },
  { id: 'hard',   label: '상급', bossHp: 700, bossAtk: 80, reward: 300000, unlock: 20 },
],
RAID_ROUNDS: 10,
RAID_PLAYER_HP: 100,
```

### 2. `js/raidSystem.js` — 신규 파일

핵심 함수:
- `getPlayerStats(state)` — 장착 아이템에서 ATK/DEF 계산
- `simulateBattle(playerStats, stage)` — 10라운드 전투 시뮬레이션, 라운드별 HP 스냅샷 반환
- `isStageUnlocked(stage, state)` — `getTotalEnhancement(state) >= stage.unlock`

### 3. `index.html` — 탭 + 섹션 추가
- 탭 버튼: `<button class="tab-btn" data-tab="raid">⚔️ 레이드</button>`
- `<section class="tab-content" id="tab-raid">` 내부:
  - 내 스탯 박스 (ATK / DEF 수치)
  - 스테이지 3개 카드 (잠금/해제 시각적 표시, 보스 HP·ATK·보상 정보)
  - 전투 진행 영역 (HP 바 2개: 플레이어 / 보스, 라운드 로그)
  - 결과 메시지 영역
- `<script src="js/raidSystem.js">` 추가 — uiManager.js 앞에 로드

### 4. `js/uiManager.js` — renderRaid(state) 추가

- `renderRaid(state)` — 내 스탯, 스테이지 카드 (잠금/해제), 선택된 스테이지 전투 영역 렌더링
- `render(state)` 분기에 `else if (activeTab === 'raid') renderRaid(state);` 추가
- `_selectedRaidStage` private 변수로 선택 스테이지 관리

### 5. `js/main.js` — 핸들러 추가

```js
window.handleRaidSelectStage = function(stageId) { ... }  // 스테이지 선택

window.handleRaidStart = function(stageId) {
  // 1. 이미 진행 중이면 무시 (isRaiding 플래그)
  // 2. RaidSystem.simulateBattle() 즉시 계산
  // 3. 0.5초마다 HP 바 업데이트 (10라운드)
  // 4. 5초 후: 클리어면 state.gold += reward, GameState.save(state), UIManager.render(state), 결과 표시
}
```

---

## 전투 UI 흐름 (5초 자동 전투)

1. 스테이지 카드 클릭 → 하이라이트 + 전투 영역 전환
2. "전투 시작" 버튼 클릭
3. 버튼 비활성화 + 전투 로그 영역 초기화
4. `setInterval(500ms × 10)` — 라운드별 HP 바 애니메이션 + 로그 출력
5. 전투 종료:
   - 클리어: "🏆 클리어! +{reward}G" 메시지 + 골드 지급
   - 실패: "💀 전투 실패..." 메시지
6. 버튼 재활성화

---

## 검증 방법

1. `index.html`을 브라우저에서 열고 레이드 탭 확인
2. 장비 미장착 상태로 하급 도전 → ATK=1 × 10 = 10 < 보스HP 100 → 실패 확인
3. 하급 칼+10 장착 시 ATK = 5+10 = 15 × 10 = 150 > 100 → 클리어 + 30,000G 지급 확인
4. 강화합 10 미만 시 중급 버튼 잠김 확인, 10 이상 시 해제 확인
5. 상급 강화합 20 미만/이상 잠금/해제 확인
6. 전투 중 버튼 중복 클릭 방지 확인
7. 게임 새 시작 후 상태 초기화 확인 (gold만 영향)
