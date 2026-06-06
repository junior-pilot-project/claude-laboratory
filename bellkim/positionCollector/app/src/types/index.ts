// GPS 포인트 스키마 (OSM / Google Maps 공통)
export interface GpsPoint {
  collected_at: string; // ISO 8601 with timezone
  latitude: number;
  longitude: number;
  accuracy: number; // 오차 반경 (미터)
}

// 닉네임 스토리지
export interface NicknameStore {
  nicknames: string[];
  current: string;
}

// 수집 설정
export interface CollectionConfig {
  intervalMinutes: number; // 1 ~ 1440 (24시간)
  isCollecting: boolean;
}
