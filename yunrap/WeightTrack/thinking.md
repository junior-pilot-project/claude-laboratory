# WeightTrack 개발 일지

샤오미 체중계 BLE 앱을 만들면서 겪은 문제들과 해결 과정을 기록합니다.

---

## 1. 월간 기록 뷰 개발

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

## 2. 백그라운드 BLE 스캔

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
