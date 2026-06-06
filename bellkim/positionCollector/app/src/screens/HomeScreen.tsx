import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, TextInput, Alert,
} from 'react-native';
import { startCollection, stopCollection, isCollecting } from '../services/GpsService';

interface Props {
  nickname: string;
  onChangeNickname: () => void;
}

export default function HomeScreen({ nickname, onChangeNickname }: Props) {
  const [collecting, setCollecting] = useState(false);
  const [interval, setIntervalMin] = useState('10');

  const handleToggle = async () => {
    if (collecting) {
      stopCollection();
      setCollecting(false);
    } else {
      const min = parseInt(interval, 10);
      if (isNaN(min) || min < 1 || min > 1440) {
        Alert.alert('수집 간격은 1분 ~ 1440분(24시간) 사이로 입력하세요.');
        return;
      }
      try {
        await startCollection(nickname, min);
        setCollecting(true);
      } catch (e: any) {
        Alert.alert('오류', e.message);
      }
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.nicknameLabel}>현재 닉네임</Text>
        <Text style={styles.nickname}>{nickname}</Text>
        <TouchableOpacity onPress={onChangeNickname}>
          <Text style={styles.changeBtn}>변경</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>수집 간격 (분)</Text>
        <TextInput
          style={styles.intervalInput}
          value={interval}
          onChangeText={setIntervalMin}
          keyboardType="number-pad"
          editable={!collecting}
        />
        <Text style={styles.hint}>최소 1분 / 기본 10분 / 최대 1440분</Text>
      </View>

      <TouchableOpacity
        style={[styles.btn, collecting ? styles.btnStop : styles.btnStart]}
        onPress={handleToggle}
      >
        <Text style={styles.btnText}>
          {collecting ? '■  수집 중지' : '▶  수집 시작'}
        </Text>
      </TouchableOpacity>

      {collecting && (
        <Text style={styles.status}>
          백그라운드에서 {interval}분 간격으로 수집 중...
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, backgroundColor: '#fff' },
  header: {
    flexDirection: 'row', alignItems: 'center',
    gap: 8, marginBottom: 32,
  },
  nicknameLabel: { color: '#666', fontSize: 14 },
  nickname: { fontSize: 16, fontWeight: 'bold', flex: 1 },
  changeBtn: { color: '#2196F3', fontSize: 14 },
  card: {
    backgroundColor: '#f5f5f5', borderRadius: 12,
    padding: 20, marginBottom: 24,
  },
  cardTitle: { fontSize: 14, color: '#666', marginBottom: 8 },
  intervalInput: {
    fontSize: 32, fontWeight: 'bold',
    borderBottomWidth: 2, borderColor: '#2196F3',
    paddingVertical: 4, textAlign: 'center',
  },
  hint: { fontSize: 12, color: '#999', textAlign: 'center', marginTop: 8 },
  btn: {
    padding: 18, borderRadius: 12,
    alignItems: 'center',
  },
  btnStart: { backgroundColor: '#2196F3' },
  btnStop: { backgroundColor: '#f44336' },
  btnText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  status: {
    marginTop: 16, textAlign: 'center',
    color: '#4CAF50', fontSize: 14,
  },
});
