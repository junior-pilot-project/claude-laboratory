import * as Location from 'expo-location';
import { appendPoint } from './StorageService';
import { GpsPoint } from '../types';

let _timer: ReturnType<typeof setInterval> | null = null;
let _taskRegistered = false;

const BACKGROUND_TASK = 'POSITION_COLLECTOR_TASK';

// 백그라운드 태스크 등록 (앱 최초 실행 시 1회)
export async function registerBackgroundTask(): Promise<void> {
  if (_taskRegistered) return;

  const { status: fg } = await Location.requestForegroundPermissionsAsync();
  const { status: bg } = await Location.requestBackgroundPermissionsAsync();

  if (fg !== 'granted' || bg !== 'granted') {
    throw new Error('위치 권한이 필요합니다.');
  }
  _taskRegistered = true;
}

// 수집 시작
export async function startCollection(
  nickname: string,
  intervalMinutes: number,
  onPoint?: (point: GpsPoint) => void
): Promise<void> {
  if (_timer) return; // 이미 실행 중

  await registerBackgroundTask();

  const collect = async () => {
    try {
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      const point: GpsPoint = {
        collected_at: new Date(loc.timestamp).toISOString(),
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
        accuracy: loc.coords.accuracy ?? 0,
      };

      await appendPoint(nickname, point);
      onPoint?.(point);
    } catch {
      // GPS 유실 → 스킵
    }
  };

  // 즉시 1회 수집 후 interval 반복
  await collect();
  _timer = setInterval(collect, intervalMinutes * 60 * 1000);
}

// 수집 중지
export function stopCollection(): void {
  if (_timer) {
    clearInterval(_timer);
    _timer = null;
  }
}

export function isCollecting(): boolean {
  return _timer !== null;
}
