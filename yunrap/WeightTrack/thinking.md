# WeightTrack 개발 일지

샤오미 체중계 BLE 앱을 만들면서 겪은 문제들과 해결 과정을 기록합니다.

---

## 1. 체중계에 올라가도 아무 반응이 없음

**문제**
앱을 실행하고 체중계에 올라가도 화면에 아무런 변화가 없었다.

**원인 파악 과정**
- 콘솔 로그가 아무것도 안 뜸 → 스캔 자체가 시작 안 됐을 가능성
- `centralManagerDidUpdateState`에 로그 추가해서 블루투스 상태 확인 시도
- 실기기가 아닌 시뮬레이터로 실행했을 가능성 점검 (시뮬레이터는 BLE 불가)

**해결**
진단용 로그를 추가하고 실기기로 실행하여 상태 파악.

---

## 2. 개발자 모드 활성화 문제

**문제**
iPhone을 Xcode에 연결했지만 개발자 모드가 활성화되지 않아 실기기 빌드 불가.

**원인**
iOS 16부터 개발자 모드를 수동으로 활성화해야 함.

**해결 방법**
1. iPhone을 Mac에 USB 연결
2. Xcode → Window → Devices and Simulators에서 기기 인식 확인
3. iPhone 설정 → 개인정보 보호 및 보안 → 개발자 모드 → 켜기
4. 재시동 후 팝업에서 "켜기" 탭

---

## 3. BLE 스캔은 되는데 체중계를 못 찾음

**문제**
콘솔에 아무것도 안 떠서 체중계 신호 자체를 못 받는 상황.

**원인**
`scanForPeripherals(withServices: [scaleServiceUUID])`로 UUID 필터를 걸면 해당 UUID를 광고하지 않는 기기는 아예 발견이 안 됨.

**해결**
임시로 `withServices: nil`로 변경해 모든 BLE 기기를 스캔하도록 수정 → 콘솔에 `MI_SCALE` 감지 확인.

```
[BLE] Found: MI_SCALE | RSSI: -62
[BLE]   ServiceUUIDs: [Weight Scale]
[BLE]   ServiceData[Weight Scale]: 82 00 00 B2 08 01 03 06 3A 36
```

체중계가 `0x181D (Weight Scale)` UUID로 정상 광고 중임을 확인.

---

## 4. 체중계가 페어링이 필요한지 혼동

**문제**
샤오미 체중계가 iPhone과 블루투스 페어링이 되어야 작동하는 건지 혼동.

**정리**
샤오미 체중계는 BLE **Advertisement 방식**으로 동작. 체중계가 일방적으로 신호를 뿌리고 앱이 수신만 하면 됨. 페어링/연결 과정 없음.

---

## 5. 로그가 계속 찍히는 이유

**문제**
체중계에 아무도 안 올라가 있는데도 BLE 로그가 계속 출력됨.

**원인**
체중계는 항상 BLE 신호를 브로드캐스트함. `byte[0] = 0x82`는 `bit7 = 1` 즉 "체중 제거됨(아무도 없음)" 상태. 앱이 계속 수신 대기하는 것이 정상 동작.

---

## 6. Xcode 프로젝트 파일 손상

**문제**
새 Swift 파일(`WeightStore.swift`, `MonthlyView.swift`)을 외부에서 생성하면 Xcode 프로젝트에 자동 추가가 안 됨. `project.pbxproj`를 수동 편집했는데 UUID 충돌로 프로젝트가 손상됨.

```
The project 'WeightTrack' is damaged and cannot be opened.
Exception: -[XCBuildConfiguration group]: unrecognized selector sent to instance
```

**원인**
`project.pbxproj`에서 새 파일 UUID로 사용한 값이 이미 기존 `XCBuildConfiguration`에서 쓰이던 UUID와 충돌.

**해결**
`git checkout WeightTrack.xcodeproj/project.pbxproj`로 복구 후, 기존 UUID 패턴(`A~C` 범위)과 겹치지 않는 `D`로 시작하는 UUID를 사용해 재등록.

```
D1E2F3A4... /* WeightStore.swift */
D2E3F4A5... /* MonthlyView.swift */
```

---

## 7. 월간 기록 뷰 개발

**목표**
매일 측정한 체중을 월별로 확인할 수 있는 UI.

**구현 내용**
- `WeightReading`에 `Codable` 추가 → UserDefaults에 JSON으로 영구 저장
- `WeightStore` 클래스 → 저장/불러오기 담당
- `MonthlyView` → 처음에는 리스트 형식으로 개발, 이후 캘린더 그리드로 변경
- `ContentView` → TabView로 "측정" / "기록" 탭 분리

**캘린더 UI 최종 형태**
- 7×N 그리드, 측정한 날은 초록색 셀에 체중 표시
- 오늘 날짜는 파란 테두리
- 좌우 화살표로 월 이동
- 하단에 최저/평균/최고 요약

---

## 8. 백그라운드 BLE 스캔

**목표**
앱 화면을 끄고 홈화면 상태에서도 체중계 측정 가능하게.

**해결**
- `Info.plist`에 `UIBackgroundModes: bluetooth-central` 추가
- 백그라운드 진입 시 `allowDuplicates: false`로 스캔 재시작 (iOS 백그라운드 BLE 제한)
- 포그라운드 복귀 시 `allowDuplicates: true`로 전환해 실시간 업데이트 복원
- `CBCentralManagerOptionRestoreIdentifierKey`로 iOS가 앱을 재시작할 때 BLE 상태 복원
- 측정 확정 시 로컬 푸시 알림 ("68.5 kg 기록됐습니다")

**한계**
사용자가 앱을 스와이프로 강제 종료하면 BLE 스캔도 완전히 중단됨. iOS 정책상 회피 불가.

**대안**
iOS 단축어 자동화로 매일 아침 지정 시간에 앱 자동 실행.

---

## 현재 앱 구조

```
ContentView (TabView)
 ├── 측정 탭
 │    └── BluetoothManager → 실시간 체중 표시
 └── 기록 탭
      └── MonthlyView → 캘린더 그리드

BluetoothManager
 ├── CoreBluetooth → BLE 스캔 및 패킷 파싱
 ├── WeightStore → UserDefaults 영구 저장
 └── UserNotifications → 백그라운드 알림
```
