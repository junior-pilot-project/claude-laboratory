# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 게임 개요

장비(칼/방패)를 강화해 강화합 40 달성을 목표로 하는 웹 기반 도박+강화 루프 게임. 빌드 도구, 서버, 패키지 관리자 없이 `index.html`을 브라우저에서 직접 열어서 실행한다.

## 실행 방법

```
index.html을 브라우저에서 직접 열기 (서버 불필요)
```

테스트도 동일하게 브라우저에서 직접 실행 후 수동 검증. 자동화 테스트 없음.

## 아키텍처

### JS 로드 순서 (의존성 순서로 고정)

`index.html` 하단에 스크립트가 순서대로 로드된다. **이 순서를 바꾸면 안 된다.**

```
config.js → gameState.js → itemSystem.js → gamblingSystem.js
→ rankingSystem.js → soundManager.js → raidSystem.js → raidCanvas.js
→ uiManager.js → main.js
```

### 모듈 패턴

ES 모듈이 아닌 전역 변수 방식. 각 JS 파일은 전역에 객체를 노출한다:
- `CONFIG` — 모든 게임 상수 (유일한 밸런스 조정 지점)
- `GameState` — localStorage 읽기/쓰기, 상태 초기화
- `ItemSystem` — 강화 시도, 아이템 구매/장착
- `GamblingSystem` — 랜덤박스 오픈
- `RankingSystem` — 랭킹 저장/정렬
- `soundManager` — Web Audio API 인스턴스
- `RaidSystem` — 전투 시뮬레이션, 스테이지 잠금 판정
- `RaidCanvas` — Canvas 2D 전투 시각화 (캐릭터/보스 렌더링 + 애니메이션 큐)
- `UIManager` — 전체 DOM 렌더링
- `state` (main.js) — 현재 게임 상태 (전역)

`uiManager.js`에서 DOM 이벤트 핸들러는 `window.handleXxx` 형태로 `main.js`에 정의된 전역 함수를 직접 호출한다.

### 데이터 흐름

```
사용자 클릭
  → main.js의 window.handleXxx 함수
  → System 모듈로 상태(state) 변경
  → GameState.save(state) (localStorage)
  → UIManager.render/update (DOM 반영)
```

레이드 전투는 별도 흐름:
```
레이드 시작 버튼
  → RaidSystem.simulateBattle() — 전투 결과 미리 계산 (라운드 배열)
  → 500ms 인터벌로 라운드별 순차 실행
  → RaidCanvas.animateRound() — Canvas 애니메이션 큐에 적재
  → 전투 종료 시 골드 지급 + GameState.save()
```

### 강화 비용 공식 (`config.js`)

- **Easy Zone** (확률 > 30%): `(currentLevel + 1) × COST_EASY_PER_LEVEL`
- **Hard Zone** (확률 ≤ 30%): `lastEasyCost + relativeHardLevel × COST_HARD_PER_LEVEL`

등급별 확률 시작점: 상급 index 0 (100%), 중급 index 4 (60%), 하급 index 9 (10%). Hard Zone은 `PROB_TABLE[7] = 30`이 기준이므로 하급은 0레벨부터 Hard Zone.

### 레이드 시스템

스테이지 3종 (모두 `CONFIG.RAID_STAGES`에서 관리):

| 스테이지 | 보스 | 보스 HP | 공격력 | 보상 | 잠금 해제 조건 |
|---------|------|--------|--------|------|--------------|
| 하급 | 고블린 | 100 | 12 | 30,000G | 없음 |
| 중급 | 오크 | 300 | 35 | 100,000G | 강화합 10 |
| 상급 | 데몬 | 700 | 80 | 300,000G | 강화합 20 |

전투는 최대 `RAID_ROUNDS(10)` 라운드. 플레이어 HP는 `RAID_PLAYER_HP(100)`. 방어력(def)은 보스 공격력에서 차감된다.

### Canvas 애니메이션 시스템 (`raidCanvas.js`)

- **애니메이션 큐**: `qa(dur, fn, end)` 로 클립을 적재, `tick()`이 순차 실행
- **주요 상태 변수**:
  - `_px/_py` — 플레이어 오프셋
  - `_bx/_by` — 보스 바디 오프셋
  - `_swordAngle` — 플레이어 칼 스윙 각도
  - `_bossAtkAngle` — 보스 무기 스윙 각도 (고블린 왼팔·오크 도끼 공유)
  - `_proj` — 투사체 (데몬 화염구)
  - `_screenShakePower` — 히트 시 화면 흔들림
- **라운드 애니메이션 타이밍** (총 380ms < 500ms 인터벌):
  - 플레이어 와인드업 90ms → 플레이어 공격 110ms → 간격 40ms → 보스 반격 140ms (와인드업 50ms + 타격 90ms)
- **보스별 반격 모션**:
  - 고블린: 왼팔+발톱 와인드업(-0.55 rad) → 할퀴기 스윙(+0.45 rad) + 돌진
  - 오크: 도끼 와인드업(+0.55 rad) → 내리치기(-0.8 rad) + 돌진
  - 데몬: 투사체(화염구) 발사

### 사운드 시스템

Web Audio API로 코드만으로 사운드 생성. 외부 오디오 파일 없음. `AudioContext`는 브라우저 정책상 첫 사용자 클릭 시 초기화(`soundManager.init()` 호출 필요). `playBoxShake(callback)`은 3초 후 callback을 실행하는 비동기 흐름이므로 상자 오픈 로직이 여기에 의존한다.

### localStorage 스키마

키: `reforge_game`
```json
{
  "gold": 0,
  "startTime": 1749200000000,
  "endTime": null,
  "gameOver": false,
  "equippedSword": { "id": "uuid", "grade": "high", "enhancement": 5 },
  "equippedShield": null,
  "inventory": [{ "id": "uuid", "type": "shield", "grade": "mid", "enhancement": 2 }],
  "rankings": [{ "playTime": 1122000, "date": "2026-06-06" }]
}
```

## 밸런스 조정

모든 수치는 `js/config.js`에서만 수정한다:
- `COST_EASY_PER_LEVEL`, `COST_HARD_PER_LEVEL` — 강화 비용
- `ITEM_PRICES` — 상점 아이템 가격
- `BOXES[].maxReward`, `BOXES[].maxCount` — 랜덤박스 보상/개수 한도
- `INITIAL_GOLD` — 게임 시작 초기 골드
- `GOAL` — 목표 강화합 (현재 40)
- `RAID_STAGES[].bossHp`, `bossAtk`, `reward`, `unlock` — 레이드 스테이지 밸런스
