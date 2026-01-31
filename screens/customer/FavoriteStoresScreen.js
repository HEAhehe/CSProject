import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  FlatList,
  Image,
  ActivityIndicator,
  Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { auth, db } from '../../firebase.config';
import { collection, onSnapshot, doc, deleteDoc } from 'firebase/firestore';

export default function FavoriteStoresScreen({ navigation }) {
  const [favorites, setFavorites] = useState([]);
  const [loading, setLoading] = useState(true);

  // ดึงข้อมูลร้านโปรดแบบ Real-time
  useEffect(() => {
    const user = auth.currentUser;
    if (user) {
      const favRef = collection(db, 'users', user.uid, 'favorites');
      const unsubscribe = onSnapshot(favRef, (snapshot) => {
        const favList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setFavorites(favList);
        setLoading(false);
      }, (error) => {
        console.error("Error fetching favorites:", error);
        setLoading(false);
      });
      return () => unsubscribe();
    } else {
        setLoading(false);
    }
  }, []);

  // ฟังก์ชันลบร้านโปรด
  const handleRemoveFavorite = async (storeId, storeName) => {
    Alert.alert(
        'ลบร้านโปรด',
        `ต้องการลบ "${storeName}" ออกจากรายการโปรด?`,
        [
            { text: 'ยกเลิก', style: 'cancel' },
            {
                text: 'ลบ',
                style: 'destructive',
                onPress: async () => {
                    const user = auth.currentUser;
                    if(user) {
                        await deleteDoc(doc(db, 'users', user.uid, 'favorites', storeId));
                    }
                }
            }
        ]
    );
  };

  const renderItem = ({ item }) => (
    <TouchableOpacity style={styles.storeCard} activeOpacity={0.9}>
      <View style={styles.storeIconContainer}>
        <Ionicons name="storefront" size={24} color="#10b981" />
      </View>
      <View style={styles.storeInfo}>
        <Text style={styles.storeName}>{item.storeName || 'ชื่อร้านค้า'}</Text>
        <Text style={styles.storeSubtext}>บันทึกเมื่อ: {new Date(item.savedAt).toLocaleDateString('th-TH')}</Text>
      </View>
      <TouchableOpacity
        style={styles.removeButton}
        onPress={() => handleRemoveFavorite(item.id, item.storeName)}
      >
        <Ionicons name="heart" size={24} color="#ef4444" />
      </TouchableOpacity>
    </TouchableOpacity>
  );

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
        <Text style={styles.headerTitle}>ร้านโปรด ({favorites.length})</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Content */}
      {loading ? (
        <ActivityIndicator size="large" color="#10b981" style={{ marginTop: 50 }} />
      ) : favorites.length > 0 ? (
        <FlatList
          data={favorites}
          renderItem={renderItem}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContent}
        />
      ) : (
        /* Empty State */
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
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 50, paddingBottom: 15, backgroundColor: '#fff',
    borderBottomWidth: 1, borderBottomColor: '#f3f4f6'
  },
  backButton: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: '#f3f4f6',
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontSize: 18, fontWeight: '600', color: '#1f2937' },

  listContent: { padding: 20 },
  storeCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff', borderRadius: 12, padding: 15, marginBottom: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, elevation: 2
  },
  storeIconContainer: {
    width: 50, height: 50, borderRadius: 25, backgroundColor: '#ecfdf5',
    alignItems: 'center', justifyContent: 'center', marginRight: 15
  },
  storeInfo: { flex: 1 },
  storeName: { fontSize: 16, fontWeight: 'bold', color: '#1f2937' },
  storeSubtext: { fontSize: 12, color: '#6b7280', marginTop: 4 },
  removeButton: { padding: 5 },

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