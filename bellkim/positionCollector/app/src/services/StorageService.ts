import * as FileSystem from 'expo-file-system';
import { GpsPoint, NicknameStore } from '../types';

const BASE_DIR = `${FileSystem.documentDirectory}positionCollector/`;

// 날짜 문자열 (YYYY-MM-DD)
function toDateString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

// 닉네임 폴더 경로
function nicknameDir(nickname: string): string {
  return `${BASE_DIR}${nickname}/`;
}

// 날짜별 파일 경로
function filePath(nickname: string, dateStr: string): string {
  return `${nicknameDir(nickname)}${dateStr}.json`;
}

// 폴더 보장 생성
async function ensureDir(dir: string): Promise<void> {
  const info = await FileSystem.getInfoAsync(dir);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
  }
}

// 포인트 저장 (하루치 파일에 append)
export async function appendPoint(nickname: string, point: GpsPoint): Promise<void> {
  await ensureDir(nicknameDir(nickname));
  const dateStr = toDateString(new Date(point.collected_at));
  const path = filePath(nickname, dateStr);

  const info = await FileSystem.getInfoAsync(path);
  let points: GpsPoint[] = [];

  if (info.exists) {
    const raw = await FileSystem.readAsStringAsync(path);
    try {
      points = JSON.parse(raw);
    } catch {
      points = [];
    }
  }

  points.push(point);
  await FileSystem.writeAsStringAsync(path, JSON.stringify(points, null, 2));
}

// 특정 날짜 포인트 조회
export async function loadPoints(nickname: string, dateStr: string): Promise<GpsPoint[]> {
  const path = filePath(nickname, dateStr);
  const info = await FileSystem.getInfoAsync(path);
  if (!info.exists) return [];

  const raw = await FileSystem.readAsStringAsync(path);
  try {
    return JSON.parse(raw) as GpsPoint[];
  } catch {
    return [];
  }
}

// 닉네임의 모든 날짜 목록 (YYYY-MM-DD 정렬)
export async function listDates(nickname: string): Promise<string[]> {
  const dir = nicknameDir(nickname);
  const info = await FileSystem.getInfoAsync(dir);
  if (!info.exists) return [];

  const files = await FileSystem.readDirectoryAsync(dir);
  return files
    .filter(f => f.endsWith('.json'))
    .map(f => f.replace('.json', ''))
    .sort();
}

// 파일 경로 반환 (외부 공유용)
export function getFilePath(nickname: string, dateStr: string): string {
  return filePath(nickname, dateStr);
}
