# Reforge-2 (Godot 4.6)

JS 프로토타입 강화게임 **Reforge**를 Godot 4.6(GL Compatibility, 웹 배포 대응)으로
포팅한 프로젝트. 1차 마일스톤은 **플레이 가능한 골드 순환 루프**를 구현한다:

> 방에서 시작 → 문으로 마을 진입 → **도박장**으로 시드 확보 → **장비 상점**에서
> 구매·강화(골드 소각) → 장착으로 **강화합** 누적 → 목표 **80** 달성 시 클리어.

전투(보스/레이드)와 제작(연마제)은 다음 단계로 보류. 자세한 경제 설계는
[`docs/BUSINESS.md`](docs/BUSINESS.md) 참고.

## 조작

| 키 | 동작 |
|----|------|
| `WASD` / 방향키 | 4방향 이동 |
| `E` / `Space` | 근접 상호작용(문/상점/도박장) |
| `F` / `J` | 공격 (사냥터) |
| `Q` | 물약 사용 (작은 것부터, 사냥터) |
| `Esc` | 팝업 닫기 |

## 프로젝트 구조

```
res://
├── project.godot            # 오토로드 · InputMap · 384x216 stretch · web 설정
├── autoload/
│   ├── GameConfig.gd         # 경제 상수 + 강화/박스 계산 (BUSINESS.md 포팅)
│   ├── GameState.gd          # 골드·인벤토리·장착·강화합·박스카운트 + 세이브/로드
│   └── SceneManager.gd       # 페이드 씬 전환 + 스폰포인트
├── data/Equipment.gd         # 장비 (type·grade·level)
├── scenes/
│   ├── Main.tscn/.gd         # 루트: World + HUD/팝업 CanvasLayer + 페이드
│   ├── actors/               # Player(4방향·피격/사망), Monster(접촉 데미지), Interactable
│   ├── world/                # Room(시작 방·부활), Town(2048x1280 마을),
│   │                         # EquipShop/Gamble/PotionShop 인테리어, HuntingGround,
│   │                         # DungeonRoom1-3+DungeonBossRoom (던전 런: 유한 웨이브
│   │                         # + 가시문 + 런 정산형 전리품 주머니)
│   └── ui/                   # game_theme.tres(Wood), HUD(포션 슬롯), ShopUI,
│                             # GamblingUI, PotionShopUI
├── assets/                   # zip에서 선별 추출 (tools/extract_assets.py)
├── tests/Tests.gd            # 헤드리스 로직 테스트
└── export_presets.cfg        # Web 프리셋 (no-thread → 특수 헤더 불필요)
```

## 실행 / 개발

Godot 4.6 에디터로 프로젝트를 열고 **F5**로 실행하거나, CLI로:

```bash
# 에셋 재추출 (zip → res://assets, 멱등)
python tools/extract_assets.py

# Franuka 팩 에셋 복사 (D:\Fantasy_RPG_assets → res://assets, 멱등)
python tools/copy_map_assets.py

# 맵 재생성 (인테리어 타일셋 → Room/상점 인테리어/Town → 사냥터 → 던전)
python tools/gen_interior_tileset.py
python tools/gen_maps_tscn.py
python tools/gen_hunt_tscn.py
python tools/gen_dungeon_tscn.py

# 에디터 없이 실행
"<godot>" .

# 로직 테스트 (헤드리스, 종료코드 = 실패 수)
"<godot>" --headless -- --test

# 런타임 스모크 (씬 전환 + 팝업 인스턴스화 검증)
"<godot>" --headless -- --smoke

# 시각 검증용 스크린샷 캡처 → build/shots/
"<godot>" -- --shot
```

## 웹 빌드

```bash
"<godot>" --headless --export-release "Web" build/web/index.html
python -m http.server 8000 -d build/web   # http://localhost:8000
```

> Web 프리셋은 **Thread Support 비활성**(GL Compatibility / 단일 스레드)이라
> COOP/COEP 헤더 없이 itch.io 등 정적 호스팅에 바로 올릴 수 있다.
> 빌드에는 Godot **Web 익스포트 템플릿** 설치가 필요하다
> (에디터 ▸ Project ▸ Manage Export Templates).

## 검증 현황

- `--test`: 경제 로직(확률표·2-Zone 비용·박스 기대값·구매/강화/장착/도박 한도·세이브/로드·목표)
  + 피격/사망(방어 완화 곡선·부활 회복) + 물약(구매/사용/퀵유즈/저장) 전부 통과.
- `--smoke`: 방→마을→상점 인테리어 3종 왕복, 상점(full/merchant/blacksmith)·도박·물약 팝업 인스턴스화 무오류.
- `--shot`: HUD/방/마을/인테리어 3종/상점/도박장/물약상점/사냥터(피격·포션 슬롯) 렌더링 시각 확인 완료.

## 에셋 / 라이선스

캐릭터·타일·UI는 **Ninja Adventure Asset Pack (CC0)**. 한글 폰트는
**Noto Sans KR (SIL OFL)**. `tools/extract_assets.py`가 zip에서 필요분만
`res://assets/`로 추출하므로 원본 zip은 빌드에 포함되지 않는다.

월드/인테리어/NPC/아이콘은 **Franuka** 의 Fantasy RPG 시리즈
(asset pack · Interior pack · Mining & Smithing pack · icon pack, **CC BY 4.0**
— 배포 시 franuka.itch.io 출처 표기 필요). `tools/copy_map_assets.py`가
`D:\Fantasy_RPG_assets`의 2x(32px) 스케일에서 필요분만 복사한다.
