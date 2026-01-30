import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  ScrollView
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function FavoriteStoresScreen({ navigation }) {
  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#1f2937" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>ร้านโปรด</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Empty State (ยังไม่มีข้อมูล) */}
      <View style={styles.emptyState}>
        <View style={styles.iconContainer}>
          <Ionicons name="heart-dislike-outline" size={60} color="#d1d5db" />
        </View>
        <Text style={styles.emptyTitle}>ยังไม่มีร้านโปรด</Text>
        <Text style={styles.emptySubtitle}>
          กดหัวใจที่ร้านค้าที่คุณชอบเพื่อบันทึกไว้ที่นี่
        </Text>

        <TouchableOpacity
          style={styles.exploreButton}
          onPress={() => navigation.navigate('Home')}
        >
          <Text style={styles.exploreText}>ค้นหาร้านค้า</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 50, paddingBottom: 15, backgroundColor: '#fff',
  },
  backButton: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: '#f3f4f6',
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontSize: 18, fontWeight: '600', color: '#1f2937' },
  emptyState: {
    flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40,
  },
  iconContainer: {
    width: 100, height: 100, borderRadius: 50, backgroundColor: '#f3f4f6',
    alignItems: 'center', justifyContent: 'center', marginBottom: 20,
  },
  emptyTitle: { fontSize: 20, fontWeight: 'bold', color: '#1f2937', marginBottom: 10 },
  emptySubtitle: { fontSize: 14, color: '#6b7280', textAlign: 'center', marginBottom: 30 },
  exploreButton: {
    paddingHorizontal: 30, paddingVertical: 12, backgroundColor: '#10b981',
    borderRadius: 25, shadowColor: '#10b981', shadowOpacity: 0.3, shadowRadius: 5, elevation: 5
  },
  exploreText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
});