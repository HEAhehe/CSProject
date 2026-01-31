import React, { useState, useCallback } from 'react';
// ... imports เหมือนเดิม ...
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, StatusBar, Image, TextInput, RefreshControl, ActivityIndicator
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { auth, db } from '../../firebase.config';
import { doc, getDoc, collection, getDocs, query, where } from 'firebase/firestore';
import { useFocusEffect } from '@react-navigation/native';

export default function HomeScreen({ navigation }) {
  // ... state และ functions เดิม ...
  const [userData, setUserData] = useState(null);
  const [foodItems, setFoodItems] = useState([]);
  const [filteredFood, setFilteredFood] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('home');

  useFocusEffect(
    useCallback(() => {
      navigation.replace('MyShop');
      loadUserData();
      fetchFoodItems();
    }, [navigation])
  );

  const loadUserData = async () => {
    try {
      const user = auth.currentUser;
      if (user) {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          const data = userDoc.data();
          setUserData(data);

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
      // ... (โค้ด renderFoodCard เดิม)
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

  // ⚠️ เอา navigation.navigate('RegisterStoreStep1') ตรงนี้ออกแล้วครับ!

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      {/* ... ส่วน UI เดิมทั้งหมด ... */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.greeting}>สวัสดี, {userData?.username || 'User'} 👋</Text>
            <Text style={styles.username}>หิวไหมวันนี้?</Text>
          </View>
          <TouchableOpacity onPress={() => navigation.navigate('Profile')}>
             {userData?.profileImage ? <Image source={{ uri: userData.profileImage }} style={styles.avatar} /> : <View style={styles.avatarPlaceholder}><Ionicons name="person" size={24} color="#fff" /></View>}
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color="#9ca3af" />
        <TextInput style={styles.searchInput} placeholder="ค้นหาเมนู..." value={searchQuery} onChangeText={handleSearch} />
      </View>

      <ScrollView style={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => {setRefreshing(true); fetchFoodItems();}} />}>
         {/* ... เนื้อหา Banner และ Grid ... */}
         {loading ? <ActivityIndicator size="large" color="#10b981" /> :
          <View style={styles.grid}>{filteredFood.map(renderFoodCard)}</View>
         }
         <View style={{height: 100}} />
      </ScrollView>

      {/* Bottom Nav */}
      <View style={styles.bottomNav}>
        <TouchableOpacity 
          style={styles.navItem} 
          onPress={() => setActiveTab('home')}
        >
          <Ionicons 
            name={activeTab === 'home' ? "storefront" : "storefront-outline"} 
            size={24} 
            color={activeTab === 'home' ? "#10b981" : "#9ca3af"} 
          />
          <Text style={[styles.navLabel, activeTab === 'home' && styles.navLabelActive]}>
            ร้านค้าของฉัน
          </Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.navItem} 
          onPress={() => navigation.navigate('MyShop')}
        >
          <Ionicons 
            name="list-outline" 
            size={24} 
            color="#9ca3af" 
          />
          <Text style={styles.navLabel}>ออเดอร์</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.navItem} 
          onPress={() => navigation.navigate('Notifications')}
        >
          <Ionicons 
            name="notifications-outline" 
            size={24} 
            color="#9ca3af" 
          />
          <Text style={styles.navLabel}>แจ้งเตือน</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.navItem} 
          onPress={() => navigation.navigate('Profile')}
        >
          <Ionicons 
            name="person-outline" 
            size={24} 
            color="#9ca3af" 
          />
          <Text style={styles.navLabel}>โปรไฟล์</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ... styles เดิม ...
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  header: { padding: 20, paddingTop: 50, backgroundColor: '#fff' },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  greeting: { fontSize: 16, color: '#6b7280' },
  username: { fontSize: 24, fontWeight: 'bold', color: '#1f2937' },
  avatar: { width: 45, height: 45, borderRadius: 22.5 },
  avatarPlaceholder: { width: 45, height: 45, borderRadius: 22.5, backgroundColor: '#d1d5db', alignItems: 'center', justifyContent: 'center' },
  searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', margin: 20, padding: 12, borderRadius: 12 },
  searchInput: { flex: 1, marginLeft: 10 },
  content: { flex: 1, padding: 20 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  foodCard: { width: '48%', backgroundColor: '#fff', borderRadius: 12, marginBottom: 15, paddingBottom: 10 },
  imageContainer: { height: 120, backgroundColor: '#f3f4f6', borderRadius: 12 },
  foodImage: { width: '100%', height: '100%', borderRadius: 12 },
  placeholderImage: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  foodInfo: { padding: 8 },
  foodName: { fontSize: 14, fontWeight: 'bold' },
  storeRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 4 },
  storeName: { fontSize: 12, color: '#6b7280', marginLeft: 4 },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  price: { fontSize: 16, fontWeight: 'bold', color: '#10b981' },
  originalPrice: { fontSize: 12, color: '#9ca3af', textDecorationLine: 'line-through' },
  quantityText: { fontSize: 10, color: '#6b7280', marginTop: 4 },
  discountBadge: { position: 'absolute', top: 5, right: 5, backgroundColor: '#ef4444', padding: 4, borderRadius: 4 },
  discountText: { color: '#fff', fontSize: 10, fontWeight: 'bold' },
  bottomNav: { flexDirection: 'row', padding: 10, backgroundColor: '#fff', position: 'absolute', bottom: 0, width: '100%' },
  navItem: { flex: 1, alignItems: 'center' },
  navLabel: { fontSize: 10, color: '#9ca3af' },
  navLabelActive: { color: '#10b981', fontWeight: '600' },
});