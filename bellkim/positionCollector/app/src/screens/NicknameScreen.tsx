import React, { useEffect, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  FlatList, StyleSheet, Alert,
} from 'react-native';
import { addNickname, loadNicknameStore, switchNickname } from '../services/NicknameService';
import { NicknameStore } from '../types';

interface Props {
  onSelect: (nickname: string) => void;
}

export default function NicknameScreen({ onSelect }: Props) {
  const [store, setStore] = useState<NicknameStore | null>(null);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadNicknameStore().then(s => {
      setStore(s);
      setLoading(false);
    });
  }, []);

  const handleAdd = async () => {
    const name = input.trim();
    if (!name) return;
    if (name.length > 20) {
      Alert.alert('닉네임은 20자 이하로 입력해주세요.');
      return;
    }
    const updated = await addNickname(name);
    setStore(updated);
    setInput('');
    onSelect(name);
  };

  const handleSelect = async (name: string) => {
    const updated = await switchNickname(name);
    setStore(updated);
    onSelect(name);
  };

  if (loading) return null;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>positionCollector</Text>
      <Text style={styles.subtitle}>닉네임을 선택하거나 새로 추가하세요</Text>

      {store && store.nicknames.length > 0 && (
        <FlatList
          data={store.nicknames}
          keyExtractor={item => item}
          style={styles.list}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.item} onPress={() => handleSelect(item)}>
              <Text style={styles.itemText}>{item}</Text>
            </TouchableOpacity>
          )}
        />
      )}

      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          placeholder="새 닉네임 입력"
          value={input}
          onChangeText={setInput}
          maxLength={20}
          returnKeyType="done"
          onSubmitEditing={handleAdd}
        />
        <TouchableOpacity style={styles.addBtn} onPress={handleAdd}>
          <Text style={styles.addBtnText}>추가</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, justifyContent: 'center', backgroundColor: '#fff' },
  title: { fontSize: 28, fontWeight: 'bold', textAlign: 'center', marginBottom: 8 },
  subtitle: { fontSize: 14, color: '#666', textAlign: 'center', marginBottom: 32 },
  list: { marginBottom: 24, maxHeight: 300 },
  item: {
    padding: 16, backgroundColor: '#f5f5f5',
    borderRadius: 8, marginBottom: 8,
  },
  itemText: { fontSize: 16 },
  inputRow: { flexDirection: 'row', gap: 8 },
  input: {
    flex: 1, borderWidth: 1, borderColor: '#ddd',
    borderRadius: 8, padding: 12, fontSize: 16,
  },
  addBtn: {
    backgroundColor: '#2196F3', borderRadius: 8,
    paddingHorizontal: 16, justifyContent: 'center',
  },
  addBtnText: { color: '#fff', fontWeight: 'bold' },
});
