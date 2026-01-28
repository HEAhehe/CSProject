import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Image,
  TextInput,
  RefreshControl,
  ActivityIndicator
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { auth, db } from '../../firebase.config'; // ✅ แก้คำว่า from ให้ถูกต้องแล้ว
import { doc, getDoc, collection, getDocs, query, where } from 'firebase/firestore';
import { useFocusEffect } from '@react-navigation/native';

export default function HomeScreen({ navigation }) {
  const [userData, setUserData] = useState(null);
  const [foodItems, setFoodItems] = useState([]);
  const [filteredFood, setFilteredFood] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      loadUserData();
      fetchFoodItems();
    }, [])
  );

  const loadUserData = async () => {
    try {
      const user = auth.currentUser;
      if (user) {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          const data = userDoc.data();
          setUserData(data);

          // ถ้าเป็น Admin ดีดไปหน้า Admin
          if (data.currentRole === 'admin') {
            navigation.replace('AdminHome');
          }
        }
      }
    } catch (error) {
      console.error('Error loading user:', error);
    }
  };

  const fetchFoodItems = async () => {
    try {
        const q = query(collection(db, 'food_items'), where('quantity', '>', 0));
        const snapshot = await getDocs(q);
        const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setFoodItems(items);
        setFilteredFood(items);
    } catch (error) {
        console.error('Error fetching foods:', error);
    } finally {
        setLoading(false);
        setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchFoodItems();
  };

  const handleSearch = (text) => {
    setSearchQuery(text);
    if (text) {
      const lowerText = text.toLowerCase();
      const filtered = foodItems.filter(item =>
        (item.name || '').toLowerCase().includes(lowerText) ||
        (item.storeName || '').toLowerCase().includes(lowerText)
      );
      setFilteredFood(filtered);
    } else {
      setFilteredFood(foodItems);
    }
  };

  const renderFoodCard = (item) => {
      const originalPrice = Number(item.originalPrice) || 0;
      const discountPrice = Number(item.discountPrice) || Number(item.price) || 0;
      const discountPercent = originalPrice > 0 ? Math.round(((originalPrice - discountPrice) / originalPrice) * 100) : 0;

      return (
        <TouchableOpacity key={item.id} style={styles.foodCard} onPress={() => navigation.navigate('FoodDetail', { food: item, store: { name: item.storeName || 'ร้านค้า' } })}>
          <View style={styles.imageContainer}>
            {item.imageUrl ? <Image source={{ uri: item.imageUrl }} style={styles.foodImage} /> : <View style={styles.placeholderImage}><Ionicons name="fast-food" size={40} color="#d1d5db" /></View>}
            {discountPercent > 0 && <View style={styles.discountBadge}><Text style={styles.discountText}>-{discountPercent}%</Text></View>}
          </View>
          <View style={styles.foodInfo}>
            <Text style={styles.foodName} numberOfLines={1}>{item.name}</Text>
            <View style={styles.storeRow}><Ionicons name="storefront-outline" size={14} color="#6b7280" /><Text style={styles.storeName}>{item.storeName || 'ไม่ระบุร้าน'}</Text></View>
            <View style={styles.priceRow}><Text style={styles.price}>฿{discountPrice}</Text>{originalPrice > discountPrice && <Text style={styles.originalPrice}>฿{originalPrice}</Text>}</View>
            <Text style={styles.quantityText}>เหลือ: {item.quantity}</Text>
          </View>
        </TouchableOpacity>
      );
  };

  // ✅ เอา navigation.navigate('RegisterStoreStep1') ออกไปแล้ว

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>สวัสดี, {userData?.username || 'User'} 👋</Text>
          <Text style={styles.subGreeting}>วันนี้คุณอยากช่วยโลกด้วยเมนูไหน?</Text>
        </View>
        <TouchableOpacity onPress={() => navigation.navigate('Profile')}>
           {userData?.profileImage ? <Image source={{ uri: userData.profileImage }} style={styles.avatar} /> : <View style={styles.avatarPlaceholder}><Ionicons name="person" size={24} color="#fff" /></View>}
        </TouchableOpacity>
      </View>

      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color="#9ca3af" />
        <TextInput style={styles.searchInput} placeholder="ค้นหาเมนู..." value={searchQuery} onChangeText={handleSearch} />
      </View>

      <ScrollView style={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>

         <View style={styles.banner}>
            <View style={styles.bannerTextContainer}>
              <Text style={styles.bannerTitle}>ลดขยะ = ลดโลกร้อน</Text>
              <Text style={styles.bannerSubtitle}>สั่งอาหารส่วนเกิน ลดสูงสุด 50%</Text>
            </View>
            <Ionicons name="leaf" size={60} color="#10b981" style={{opacity: 0.2, position: 'absolute', right: 10, bottom: -10}} />
         </View>

         <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>เมนูแนะนำใกล้คุณ 🔥</Text>
         </View>

         {loading ? <ActivityIndicator size="large" color="#10b981" style={{marginTop: 20}} /> :
          <View style={styles.grid}>{filteredFood.map(renderFoodCard)}</View>
         }

         {!loading && filteredFood.length === 0 && (
            <View style={styles.emptyState}>
                <Text style={styles.emptyText}>ไม่พบรายการอาหาร</Text>
            </View>
         )}

         <View style={{height: 100}} />
      </ScrollView>

      <View style={styles.bottomNav}>
        <TouchableOpacity style={styles.navItem}>
          <Ionicons name="home" size={24} color="#10b981" />
          <Text style={styles.navLabelActive}>หน้าหลัก</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.navItem} onPress={() => navigation.navigate('Orders')}>
          <Ionicons name="receipt-outline" size={24} color="#9ca3af" />
          <Text style={styles.navLabel}>ออเดอร์</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.navItem} onPress={() => navigation.navigate('Notifications')}>
          <Ionicons name="notifications-outline" size={24} color="#9ca3af" />
          <Text style={styles.navLabel}>แจ้งเตือน</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.navItem} onPress={() => navigation.navigate('Profile')}>
          <Ionicons name="person-outline" size={24} color="#9ca3af" />
          <Text style={styles.navLabel}>โปรไฟล์</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 60, paddingBottom: 20, backgroundColor: '#fff' },
  greeting: { fontSize: 20, fontWeight: 'bold', color: '#1f2937' },
  subGreeting: { fontSize: 13, color: '#6b7280', marginTop: 4 },
  avatar: { width: 45, height: 45, borderRadius: 22.5 },
  avatarPlaceholder: { width: 45, height: 45, borderRadius: 22.5, backgroundColor: '#d1d5db', alignItems: 'center', justifyContent: 'center' },
  searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', marginHorizontal: 20, marginTop: 10, paddingHorizontal: 15, paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: '#f3f4f6' },
  searchInput: { flex: 1, marginLeft: 10, fontSize: 15 },
  content: { flex: 1, padding: 20 },
  banner: { backgroundColor: '#1f2937', borderRadius: 16, padding: 20, marginBottom: 25, position: 'relative', overflow: 'hidden' },
  bannerTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  bannerSubtitle: { color: '#d1d5db', fontSize: 13, marginTop: 5 },
  sectionHeader: { marginBottom: 15 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#1f2937' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  foodCard: { width: '48%', backgroundColor: '#fff', borderRadius: 12, marginBottom: 15, shadowColor: '#000', shadowOpacity: 0.05, elevation: 3 },
  imageContainer: { height: 120, backgroundColor: '#f3f4f6', borderTopLeftRadius: 12, borderTopRightRadius: 12, overflow: 'hidden' },
  foodImage: { width: '100%', height: '100%' },
  placeholderImage: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  discountBadge: { position: 'absolute', top: 8, right: 8, backgroundColor: '#ef4444', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
  discountText: { color: '#fff', fontSize: 10, fontWeight: 'bold' },
  foodInfo: { padding: 10 },
  foodName: { fontSize: 14, fontWeight: 'bold', color: '#1f2937' },
  storeRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 4, gap: 4 },
  storeName: { fontSize: 12, color: '#6b7280' },
  priceRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 6, marginVertical: 4 },
  price: { fontSize: 16, fontWeight: 'bold', color: '#10b981' },
  originalPrice: { fontSize: 12, color: '#9ca3af', textDecorationLine: 'line-through' },
  quantityText: { fontSize: 11, color: '#6b7280' },
  emptyState: { alignItems: 'center', marginTop: 30 },
  emptyText: { color: '#9ca3af', fontSize: 16 },
  bottomNav: { flexDirection: 'row', backgroundColor: '#fff', paddingVertical: 10, paddingHorizontal: 20, borderTopWidth: 1, borderTopColor: '#f3f4f6', position: 'absolute', bottom: 0, left: 0, right: 0 },
  navItem: { flex: 1, alignItems: 'center' },
  navLabel: { fontSize: 10, color: '#9ca3af', marginTop: 4 },
  navLabelActive: { fontSize: 10, color: '#10b981', fontWeight: 'bold', marginTop: 4 },
});