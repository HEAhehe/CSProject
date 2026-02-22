import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  FlatList,
  Platform,
  Image,
  ActivityIndicator,
  Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { auth, db } from '../../firebase.config';
import { collection, onSnapshot, doc, deleteDoc, getDoc } from 'firebase/firestore';

export default function FavoriteStoresScreen({ navigation }) {
  const [favorites, setFavorites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());

  // อัปเดตเวลาปัจจุบันทุกๆ 1 นาที เพื่อเช็คสถานะร้าน
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  // ✅ ฟังก์ชันคำนวณสถานะ เปิด/ปิดร้าน (ย้ายขึ้นมาข้างบนเพื่อให้ใช้ตอน Sort ได้)
  const getStoreStatus = (store) => {
    if (!store) return { text: "ไม่มีข้อมูล", color: "#9ca3af", isOpen: false };

    let openTimeStr = "08:00";
    let closeTimeStr = "20:00";
    let isClosedToday = false;

    if (store.businessHours) {
        const daysMap = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
        const todayKey = daysMap[currentTime.getDay()];
        const todayHours = store.businessHours[todayKey];

        if (todayHours && todayHours.isOpen) {
            openTimeStr = todayHours.openTime || "08:00";
            closeTimeStr = todayHours.closeTime || "20:00";
        } else {
            isClosedToday = true;
        }
    } else {
        openTimeStr = store.openTime || "08:00";
        closeTimeStr = store.closeTime || store.closingTime || "20:00";
    }

    if (isClosedToday) return { text: "ปิดทำการวันนี้", color: "#ef4444", isOpen: false };

    const now = currentTime;
    const [oH, oM] = openTimeStr.split(':').map(Number);
    const [cH, cM] = closeTimeStr.split(':').map(Number);

    const openDate = new Date(); openDate.setHours(oH, oM, 0, 0);
    const closeDate = new Date(); closeDate.setHours(cH, cM, 0, 0);

    if (closeDate <= openDate) {
        if (now.getHours() < cH || (now.getHours() === cH && now.getMinutes() < cM)) {
            openDate.setDate(openDate.getDate() - 1);
        } else {
            closeDate.setDate(closeDate.getDate() + 1);
        }
    }

    if (now < openDate) return { text: `เปิด ${openTimeStr} น.`, color: "#f59e0b", isOpen: false };
    if (now > closeDate) return { text: "ปิดแล้ว", color: "#ef4444", isOpen: false };

    return { text: "เปิดอยู่", color: "#10b981", isOpen: true };
  };

  // ดึงข้อมูลร้านโปรดแบบ Real-time และไปดึงข้อมูลร้านเต็มๆ มาประกอบ
  useEffect(() => {
    const user = auth.currentUser;
    if (!user) {
        setLoading(false);
        return;
    }

    const favRef = collection(db, 'users', user.uid, 'favorites');
    const unsubscribe = onSnapshot(favRef, async (snapshot) => {
      const favList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      // ดึงรูปภาพและเวลาจาก Collection 'stores' มาประกอบ
      const enrichedFavs = await Promise.all(
        favList.map(async (fav) => {
          try {
            const storeDoc = await getDoc(doc(db, 'stores', fav.id));
            if (storeDoc.exists()) {
              return { ...fav, storeData: storeDoc.data() };
            }
          } catch (e) {
            console.error("Fetch store data error", e);
          }
          return fav;
        })
      );

      // ✅ จัดเรียงข้อมูล ให้ร้านที่เปิดอยู่ขึ้นก่อน ร้านที่ปิดอยู่ด้านล่าง
      const sortedFavs = enrichedFavs.sort((a, b) => {
        const statusA = getStoreStatus(a.storeData);
        const statusB = getStoreStatus(b.storeData);

        if (statusA.isOpen && !statusB.isOpen) return -1; // A เปิด B ปิด ให้ A ขึ้นก่อน
        if (!statusA.isOpen && statusB.isOpen) return 1;  // A ปิด B เปิด ให้ B ขึ้นก่อน
        return 0; // ถ้าเหมือนกันให้อยู่ลำดับเดิม
      });

      setFavorites(sortedFavs);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching favorites:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [currentTime]); // ใส่ currentTime เป็น dependency เผื่อเวลาเปลี่ยนสถานะจะได้เรียงใหม่

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

  const renderItem = ({ item }) => {
    const storeImage = item.storeData?.storeImage || item.storeImage;
    const status = getStoreStatus(item.storeData);

    return (
      <TouchableOpacity
          style={[styles.storeCard, !status.isOpen && { opacity: 0.6 }]} // ✅ ถ้าร้านปิดให้จางลงเล็กน้อยเหมือนหน้า Home
          activeOpacity={0.9}
          onPress={() => navigation.navigate('StoreDetail', { storeId: item.id })}
      >
        {/* แสดงรูปร้านค้าที่ดึงมาใหม่ */}
        {storeImage ? (
          <Image source={{ uri: storeImage }} style={styles.storeImage} />
        ) : (
          <View style={styles.storeIconContainer}>
            <Ionicons name="storefront" size={24} color="#10b981" />
          </View>
        )}

        <View style={styles.storeInfo}>
          <Text style={styles.storeName} numberOfLines={1}>{item.storeName || 'ชื่อร้านค้า'}</Text>

          {/* แสดงสถานะ เปิด/ปิดร้าน */}
          <View style={styles.statusContainer}>
             <View style={[styles.statusDot, { backgroundColor: status.color }]} />
             <Text style={[styles.statusText, { color: status.color }]}>{status.text}</Text>
          </View>

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
  };

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
          showsVerticalScrollIndicator={false}
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
    paddingHorizontal: 20, paddingTop: Platform.OS === 'ios' ? 60 : 40, paddingBottom: 15, backgroundColor: '#fff',
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
  storeImage: {
    width: 55, height: 55, borderRadius: 12,
    marginRight: 15, backgroundColor: '#f3f4f6',
    borderWidth: 1, borderColor: '#e5e7eb'
  },
  storeIconContainer: {
    width: 55, height: 55, borderRadius: 12, backgroundColor: '#ecfdf5',
    alignItems: 'center', justifyContent: 'center', marginRight: 15
  },

  storeInfo: { flex: 1, paddingRight: 10 },
  storeName: { fontSize: 16, fontWeight: 'bold', color: '#1f2937' },

  statusContainer: { flexDirection: 'row', alignItems: 'center', marginTop: 5 },
  statusDot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
  statusText: { fontSize: 12, fontWeight: 'bold' },

  storeSubtext: { fontSize: 11, color: '#9ca3af', marginTop: 4 },
  removeButton: { padding: 5, paddingLeft: 10 },

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