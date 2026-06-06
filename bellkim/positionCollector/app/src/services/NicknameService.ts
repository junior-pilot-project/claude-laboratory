import AsyncStorage from '@react-native-async-storage/async-storage';
import { NicknameStore } from '../types';

const KEY = 'nickname_store';

export async function loadNicknameStore(): Promise<NicknameStore | null> {
  const raw = await AsyncStorage.getItem(KEY);
  if (!raw) return null;
  return JSON.parse(raw) as NicknameStore;
}

export async function saveNicknameStore(store: NicknameStore): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(store));
}

export async function addNickname(nickname: string): Promise<NicknameStore> {
  const store = (await loadNicknameStore()) ?? { nicknames: [], current: '' };
  if (!store.nicknames.includes(nickname)) {
    store.nicknames.push(nickname);
  }
  store.current = nickname;
  await saveNicknameStore(store);
  return store;
}

export async function switchNickname(nickname: string): Promise<NicknameStore> {
  const store = (await loadNicknameStore()) ?? { nicknames: [], current: '' };
  store.current = nickname;
  await saveNicknameStore(store);
  return store;
}
