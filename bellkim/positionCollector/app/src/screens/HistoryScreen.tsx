import React, { useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  FlatList, Alert,
} from 'react-native';
import * as Sharing from 'expo-sharing';
import { listDates, getFilePath } from '../services/StorageService';
import MapScreen from './MapScreen';

type Tab = 'daily' | 'monthly' | 'yearly';

interface Props {
  nickname: string;
}

export default function HistoryScreen({ nickname }: Props) {
  const [tab, setTab] = useState<Tab>('daily');
  const [dates, setDates] = useState<string[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  useEffect(() => {
    listDates(nickname).then(d => setDates(d.slice().reverse())); // 최신순
  }, [nickname]);

  const handleShare = async (dateStr: string) => {
    const available = await Sharing.isAvailableAsync();
    if (!available) {
      Alert.alert('이 기기에서는 공유가 지원되지 않습니다.');
      return;
    }
    const path = getFilePath(nickname, dateStr);
    await Sharing.shareAsync(path, {
      mimeType: 'application/json',
      dialogTitle: `${dateStr} 위치 데이터 공유`,
    });
  };

  // 탭에 따른 그룹핑
  const grouped = groupDates(dates, tab);

  if (selectedDate) {
    return (
      <View style={styles.container}>
        <View style={styles.mapHeader}>
          <TouchableOpacity onPress={() => setSelectedDate(null)}>
            <Text style={styles.backBtn}>← 목록</Text>
          </TouchableOpacity>
          <Text style={styles.mapTitle}>{selectedDate}</Text>
          <TouchableOpacity onPress={() => handleShare(selectedDate)}>
            <Text style={styles.shareBtn}>공유</Text>
          </TouchableOpacity>
        </View>
        <MapScreen nickname={nickname} dateStr={selectedDate} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* 상단 탭 */}
      <View style={styles.tabs}>
        {(['daily', 'monthly', 'yearly'] as Tab[]).map(t => (
          <TouchableOpacity
            key={t}
            style={[styles.tab, tab === t && styles.tabActive]}
            onPress={() => setTab(t)}
          >
            <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
              {t === 'daily' ? '일별' : t === 'monthly' ? '월별' : '연별'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* 날짜 목록 */}
      <FlatList
        data={grouped}
        keyExtractor={item => item.key}
        renderItem={({ item }) => (
          <View>
            {item.header && (
              <Text style={styles.groupHeader}>{item.header}</Text>
            )}
            {item.dates.map(d => (
              <TouchableOpacity
                key={d}
                style={styles.dateItem}
                onPress={() => setSelectedDate(d)}
              >
                <Text style={styles.dateText}>{formatDate(d, tab)}</Text>
                <TouchableOpacity onPress={() => handleShare(d)}>
                  <Text style={styles.shareIcon}>↑ 공유</Text>
                </TouchableOpacity>
              </TouchableOpacity>
            ))}
          </View>
        )}
        ListEmptyComponent={
          <Text style={styles.empty}>수집된 데이터가 없습니다.</Text>
        }
      />
    </View>
  );
}

// 탭별 그룹핑
function groupDates(dates: string[], tab: Tab) {
  if (tab === 'daily') {
    return [{ key: 'all', header: null, dates }];
  }

  const map = new Map<string, string[]>();
  for (const d of dates) {
    const key = tab === 'monthly' ? d.slice(0, 7) : d.slice(0, 4);
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(d);
  }

  return Array.from(map.entries()).map(([key, ds]) => ({
    key,
    header: key,
    dates: ds,
  }));
}

function formatDate(dateStr: string, tab: Tab): string {
  if (tab === 'daily') return dateStr;
  const [y, m, d] = dateStr.split('-');
  return `${y}년 ${m}월 ${d}일`;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  tabs: { flexDirection: 'row', borderBottomWidth: 1, borderColor: '#eee' },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center' },
  tabActive: { borderBottomWidth: 2, borderColor: '#2196F3' },
  tabText: { fontSize: 14, color: '#999' },
  tabTextActive: { color: '#2196F3', fontWeight: 'bold' },
  groupHeader: {
    fontSize: 13, color: '#999',
    paddingHorizontal: 16, paddingVertical: 8,
    backgroundColor: '#f9f9f9',
  },
  dateItem: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderColor: '#f0f0f0',
  },
  dateText: { flex: 1, fontSize: 15 },
  shareIcon: { color: '#2196F3', fontSize: 13 },
  empty: { textAlign: 'center', color: '#999', marginTop: 60 },
  mapHeader: {
    flexDirection: 'row', alignItems: 'center',
    padding: 12, borderBottomWidth: 1, borderColor: '#eee',
  },
  backBtn: { color: '#2196F3', fontSize: 15, marginRight: 12 },
  mapTitle: { flex: 1, fontSize: 15, fontWeight: 'bold' },
  shareBtn: { color: '#2196F3', fontSize: 15 },
});
