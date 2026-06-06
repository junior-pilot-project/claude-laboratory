# SDD · positionCollector

**버전:** 1.0  
**작성일:** 2026-06-06  
**작성자:** bellkim  

---

## 1. 시스템 개요

### 목적
모바일 기기의 GPS 하드웨어를 통해 사용자의 위치를 일정 시간 단위로 수집하고, 수집된 데이터를 기기 로컬에 저장한 뒤 지도 위에 동선으로 시각화하는 앱.

### 범위
- GPS 위치 수집 (포그라운드 + 백그라운드)
- 로컬 JSON 파일 저장 (닉네임 / 날짜별 분류)
- 지도 시각화 (포인트 + 연결선)
- 일별 / 월별 / 연별 탭 조회
- JSON 파일 외부 공유

### 제약 조건
- 백엔드 없음 — 모든 데이터는 기기 로컬에만 저장
- 지도: OpenStreetMap (MapLibre) 우선, 추후 Google Maps SDK로 마이그레이션 가능하도록 지도 레이어 추상화
- 플랫폼: Android 우선, iOS 추후 지원
- 개발 환경: Mac + React Native + Expo

---

## 2. 아키텍처 설계

### 레이어 구조

```
┌─────────────────────────────────────┐
│           UI Layer                  │
│  (화면, 탭, 지도, 닉네임 선택)         │
├─────────────────────────────────────┤
│         Service Layer               │
│  GpsService  │  StorageService      │
│  MapService  │  ShareService        │
├─────────────────────────────────────┤
│         Map Adapter Layer           │
│  IMapProvider (인터페이스)            │
│  MapLibreAdapter │ GoogleMapsAdapter │
├─────────────────────────────────────┤
│       Native / OS Layer             │
│  expo-location │ expo-file-system   │
│  expo-sharing                       │
└─────────────────────────────────────┘
```

### 핵심 설계 원칙
- **지도 레이어 추상화**: `IMapProvider` 인터페이스를 통해 OSM ↔ Google Maps 교체 시 UI/데이터 레이어 코드 변경 없음
- **데이터 포맷 고정**: 지도 공급자에 무관하게 동일한 JSON 스키마 사용

---

## 3. 데이터 설계

### GPS 포인트 스키마

```json
{
  "collected_at": "2026-06-06T14:30:00+09:00",
  "latitude": 37.5665,
  "longitude": 126.9780,
  "accuracy": 5.0
}
```

| 필드 | 타입 | 설명 |
|---|---|---|
| `collected_at` | ISO 8601 문자열 | 수집 시각 (타임존 포함) |
| `latitude` | number | 위도 |
| `longitude` | number | 경도 |
| `accuracy` | number | GPS 오차 반경 (미터) |

### 파일 저장 구조

```
Documents/positionCollector/
  {nickname}/
    2026-06-06.json   ← 해당 날짜의 포인트 배열
    2026-06-07.json
    ...
```

### 날짜별 JSON 파일 포맷

```json
[
  {
    "collected_at": "2026-06-06T09:00:00+09:00",
    "latitude": 37.5665,
    "longitude": 126.9780,
    "accuracy": 3.2
  },
  {
    "collected_at": "2026-06-06T09:10:00+09:00",
    "latitude": 37.5670,
    "longitude": 126.9785,
    "accuracy": 4.1
  }
]
```

---

## 4. 기능 명세

### 4-1. 닉네임 관리

- **최초 실행**: 닉네임 입력 화면 표시 → 입력 후 저장 → 메인 화면 진입
- **재실행**: 등록된 닉네임 목록 표시 → 선택 → 선택된 닉네임으로 수집 진행
- **닉네임 추가**: 설정 화면에서 새 닉네임 추가 가능
- **닉네임 전환**: 설정 또는 메인 화면에서 전환 가능
- **저장**: `AsyncStorage`에 닉네임 목록 및 현재 선택된 닉네임 저장

### 4-2. GPS 수집

| 항목 | 값 |
|---|---|
| 최소 간격 | 1분 |
| 기본 간격 | 10분 |
| 최대 간격 | 24시간 |
| 백그라운드 수집 | 지원 (expo-location Background Location) |
| GPS 유실 처리 | 해당 포인트 스킵 (직선 연결) |
| 수집 제어 | 수동 시작 / 중지 버튼 |

수집 흐름:
1. 사용자가 시작 버튼 탭
2. `GpsService.start(interval, nickname)` 호출
3. 지정 간격마다 현재 위치 조회
4. 성공 시 → 해당 날짜 JSON 파일에 포인트 append
5. 실패(GPS 유실) 시 → 해당 회차 스킵, 다음 주기에 재시도
6. 사용자가 중지 버튼 탭 → 수집 종료

### 4-3. 지도 시각화

- 선택된 날짜의 포인트를 수집 순서대로 지도에 마커로 표시
- 인접 포인트를 순서대로 직선으로 연결 (폴리라인)
- GPS 유실 구간도 직선 연결 (유실 표시 없음)
- 마커 탭 시 팝업: 수집 시각, 위도, 경도 표시
- 지도 공급자: `IMapProvider` 인터페이스로 추상화

### 4-4. 탭 분류 (상단 탭)

```
[일별] [월별] [연별]
```

| 탭 | 동작 |
|---|---|
| 일별 | 날짜 선택 → 해당 날 동선 지도 표시 |
| 월별 | 연/월 선택 → 해당 월의 날짜 목록 → 날짜 선택 → 동선 지도 표시 |
| 연별 | 연도 선택 → 월 목록 → 날짜 목록 → 동선 지도 표시 |

### 4-5. 외부 공유

- 선택된 날짜의 JSON 파일을 `expo-sharing`을 통해 외부 앱(카카오톡, 메일 등)으로 공유
- 추후 Google My Maps 업로드 용도로 활용 가능

---

## 5. 기술 스택

| 항목 | 선택 | 비고 |
|---|---|---|
| 프레임워크 | React Native + Expo | EAS Build로 Android 빌드 |
| 지도 (현재) | MapLibre (`@maplibre/maplibre-react-native`) | OSM 벡터 타일 |
| 지도 (추후) | Google Maps SDK (`react-native-maps`) | IMapProvider 교체만으로 전환 |
| GPS | `expo-location` | 백그라운드 위치 지원 |
| 파일 저장 | `expo-file-system` | 로컬 Document 폴더 |
| 파일 공유 | `expo-sharing` | 외부 앱 공유 |
| 닉네임 저장 | `@react-native-async-storage/async-storage` | 앱 설정값 저장 |
| 언어 | TypeScript | |

---

## 6. 화면 구성 (UI Flow)

```
앱 실행
  ├─ 최초 실행 → [닉네임 입력 화면] → 저장 → [메인 화면]
  └─ 재실행    → [닉네임 선택 화면] → 선택 → [메인 화면]

[메인 화면]
  ├─ 현재 닉네임 표시
  ├─ 수집 시작 / 중지 버튼
  ├─ 수집 간격 설정 (슬라이더 또는 입력)
  └─ 상단 탭: [일별] [월별] [연별]
       └─ 지도 화면 (포인트 + 폴리라인)
            └─ 마커 탭 → 팝업 (수집 시각, 위경도)

[설정 화면]
  ├─ 닉네임 추가 / 전환
  └─ JSON 파일 공유
```

---

## 7. 완료 조건 (랄프루프용)

```
- 앱 실행 시 닉네임 입력/선택 화면 정상 동작
- GPS 수집 시작/중지 버튼 동작
- 백그라운드 상태에서 지정 간격으로 포인트 수집 및 JSON 저장
- 저장된 JSON이 {nickname}/YYYY-MM-DD.json 구조로 생성
- 지도에 포인트 마커 및 폴리라인 정상 표시
- 마커 탭 시 수집 시각, 위경도 팝업 표시
- 일별/월별/연별 탭 전환 정상 동작
- JSON 파일 외부 공유 동작
```

---

## 8. 마이그레이션 가이드 (OSM → Google Maps)

1. `IMapProvider` 구현체 `GoogleMapsAdapter` 작성
2. `MapLibreAdapter` → `GoogleMapsAdapter` 교체 (한 줄)
3. Google Maps API 키 발급 및 환경변수 등록
4. 데이터 포맷 변경 없음 (동일한 lat/lng JSON 사용)
