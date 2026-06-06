import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Modal,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { loadPoints } from '../services/StorageService';
import { GpsPoint } from '../types';

interface Props {
  nickname: string;
  dateStr: string; // YYYY-MM-DD
}

export default function MapScreen({ nickname, dateStr }: Props) {
  const [points, setPoints] = useState<GpsPoint[]>([]);
  const [selected, setSelected] = useState<GpsPoint | null>(null);

  useEffect(() => {
    loadPoints(nickname, dateStr).then(setPoints);
  }, [nickname, dateStr]);

  // Leaflet.js + OSM을 WebView로 렌더링
  const html = buildMapHtml(points);

  return (
    <View style={styles.container}>
      <WebView
        style={styles.map}
        source={{ html }}
        onMessage={e => {
          const point = JSON.parse(e.nativeEvent.data) as GpsPoint;
          setSelected(point);
        }}
      />

      {selected && (
        <Modal transparent animationType="fade" onRequestClose={() => setSelected(null)}>
          <TouchableOpacity
            style={styles.overlay}
            activeOpacity={1}
            onPress={() => setSelected(null)}
          >
            <View style={styles.popup}>
              <Text style={styles.popupTitle}>수집 정보</Text>
              <Text style={styles.popupRow}>
                🕐 {new Date(selected.collected_at).toLocaleString('ko-KR')}
              </Text>
              <Text style={styles.popupRow}>
                📍 {selected.latitude.toFixed(6)}, {selected.longitude.toFixed(6)}
              </Text>
              <Text style={styles.popupRow}>
                정확도: ±{selected.accuracy.toFixed(1)}m
              </Text>
            </View>
          </TouchableOpacity>
        </Modal>
      )}
    </View>
  );
}

function buildMapHtml(points: GpsPoint[]): string {
  if (points.length === 0) {
    return `<html><body style="display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;color:#999;">
      <p>수집된 데이터가 없습니다.</p></body></html>`;
  }

  const center = points[Math.floor(points.length / 2)];
  const markers = points.map((p, i) => `
    var m${i} = L.circleMarker([${p.latitude}, ${p.longitude}], {
      radius: 6, color: '#2196F3', fillColor: '#2196F3', fillOpacity: 0.8
    }).addTo(map);
    m${i}.on('click', function() {
      window.ReactNativeWebView.postMessage(JSON.stringify(${JSON.stringify(p)}));
    });
  `).join('\n');

  const latlngs = points.map(p => `[${p.latitude}, ${p.longitude}]`).join(',');

  return `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>html,body,#map{height:100%;margin:0;padding:0;}</style>
</head>
<body>
  <div id="map"></div>
  <script>
    var map = L.map('map').setView([${center.latitude}, ${center.longitude}], 15);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors'
    }).addTo(map);

    // 폴리라인 (점 연결)
    L.polyline([${latlngs}], { color: '#2196F3', weight: 2, opacity: 0.7 }).addTo(map);

    // 마커
    ${markers}

    // 전체 경로에 맞게 줌
    map.fitBounds([[${points.map(p => `[${p.latitude},${p.longitude}]`).join(',')}]]);
  </script>
</body>
</html>`;
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },
  overlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center', alignItems: 'center',
  },
  popup: {
    backgroundColor: '#fff', borderRadius: 12,
    padding: 20, minWidth: 260, gap: 8,
  },
  popupTitle: { fontSize: 16, fontWeight: 'bold', marginBottom: 4 },
  popupRow: { fontSize: 14, color: '#333' },
});
