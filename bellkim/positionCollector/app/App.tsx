import React, { useState } from 'react';
import { SafeAreaView, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import NicknameScreen from './src/screens/NicknameScreen';
import HomeScreen from './src/screens/HomeScreen';
import HistoryScreen from './src/screens/HistoryScreen';

const Tab = createBottomTabNavigator();

export default function App() {
  const [nickname, setNickname] = useState<string | null>(null);

  if (!nickname) {
    return (
      <SafeAreaView style={styles.safe}>
        <NicknameScreen onSelect={setNickname} />
        <StatusBar style="auto" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <NavigationContainer>
        <Tab.Navigator
          screenOptions={{
            headerShown: false,
            tabBarActiveTintColor: '#2196F3',
          }}
        >
          <Tab.Screen name="Home" options={{ title: '수집' }}>
            {() => (
              <HomeScreen
                nickname={nickname}
                onChangeNickname={() => setNickname(null)}
              />
            )}
          </Tab.Screen>
          <Tab.Screen name="History" options={{ title: '기록' }}>
            {() => <HistoryScreen nickname={nickname} />}
          </Tab.Screen>
        </Tab.Navigator>
      </NavigationContainer>
      <StatusBar style="auto" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
});
