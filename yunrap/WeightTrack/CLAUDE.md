# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Run

- **빌드/실행**: Xcode에서 실기기 선택 후 ▶ — 시뮬레이터는 BLE 스캔 불가, 반드시 실제 iPhone 필요
- **타겟**: iOS 16.0+, Swift 5.0
- **권한**: `Info.plist`에 `NSBluetoothAlwaysUsageDescription` 필수 (이미 설정됨)

## 아키텍처

앱은 세 레이어로 구성됩니다.

```
BluetoothManager (ObservableObject)
    ↓ @Published liveReading / stableReading / history
ContentView (SwiftUI)
    └── WeightReading (Value type)
```

**BluetoothManager** — BLE 핵심 로직 전부 담당. `CBCentralManager`를 백그라운드 큐(`userInitiated`)에서 돌리고, UI 업데이트는 항상 `DispatchQueue.main.async`로 전환. 스캔은 `allowDuplicates: true` 필수 — 이 옵션 없으면 체중계가 보내는 연속 광고 패킷을 한 번만 받음.

**패킷 파싱 규칙** (`BluetoothManager.parseAdvertisement`):
- 대상 UUID: `0x181D` (Weight Scale 표준 서비스)
- `data[0]` control byte: bit7=무게 제거됨, bit5=측정 확정
- `data[1..2]` little-endian raw weight → `/200.0` = kg (Mi Scale v1은 jin 단위 인코딩)
- 값이 실제 몸무게의 2배로 나오면 `/200.0`을 `/100.0`으로 변경

**상태 흐름**:
1. 체중계 올라섬 → `liveReading` 업데이트 (파란 링, 숫자 변동)
2. 측정 확정 → `stableReading` 저장 + `history`에 추가 (초록 링 + "확정" 배지)
3. 내려섬 (bit7=1) → `liveReading = nil` (링 회색으로)

**ContentView** — `BluetoothManager`를 `@StateObject`로 소유. UI는 `liveReading` 유무와 `isStabilized`로만 분기. 히스토리는 최대 20개 유지.
