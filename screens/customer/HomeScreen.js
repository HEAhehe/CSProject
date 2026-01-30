import React, { useState, useEffect, useCallback, useRef } from 'react';
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
  ActivityIndicator,
  Animated,
  Dimensions,
  Modal,
  TouchableWithoutFeedback
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { auth, db } from '../../firebase.config';
import { doc, collection, getDocs, query, where, onSnapshot } from 'firebase/firestore';
import { useFocusEffect } from '@react-navigation/native';

const { width, height } = Dimensions.get('window');

export default function HomeScreen({ navigation }) {
  const [userData, setUserData] = useState(null);
  const [foodItems, setFoodItems] = useState([]);
  const [filteredFood, setFilteredFood] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // ตัวแปรเช็คสถานะก่อนโชว์หน้าจอ (แก้หน้าจอแวบ)
  const [isCheckingRole, setIsCheckingRole] = useState(true);

  // State สำหรับเมนู Drawer
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const slideAnim = useRef(new Animated.Value(-width * 0.85)).current;

  const defaultAvatar = Image.resolveAssetSource(require('../../assets/icon.png')).uri;

  // 1. Real-time User Data & Role Check
  useEffect(() => {
    const user = auth.currentUser;
    if (user) {
      const unsubscribe = onSnapshot(doc(db, 'users', user.uid), (docSnapshot) => {
        if (docSnapshot.exists()) {
          const data = docSnapshot.data();
          setUserData(data);

          // ✅ เช็ค currentRole (ชื่อฟิลด์ที่ถูกต้อง)
          if (data.currentRole === 'admin') {
            navigation.replace('AdminHome');
          } else {
            setIsCheckingRole(false);
          }
        } else {
            setIsCheckingRole(false);
        }
      });
      return () => unsubscribe();
    } else {
        setIsCheckingRole(false);
    }
  }, []);

  // 2. Fetch Food
  useFocusEffect(
    useCallback(() => {
      if (!isCheckingRole) {
          fetchFoodItems();
      }
    }, [isCheckingRole])
  );

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

  const toggleDrawer = () => {
    if (isDrawerOpen) {
      Animated.timing(slideAnim, {
        toValue: -width * 0.85,
        duration: 300,
        useNativeDriver: true,
      }).start(() => setIsDrawerOpen(false));
    } else {
      setIsDrawerOpen(true);
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  };

  const handleLogout = async () => {
    await auth.signOut();
  };

  // ✅ ฟังก์ชันสลับโหมด (แก้ไขใช้ currentRole)
  const handleSwitchToStore = () => {
    toggleDrawer();
    // เช็ค currentRole แทน role
    if (userData?.currentRole === 'store' || userData?.currentRole === 'admin') {
      navigation.navigate('StoreHome');
    } else {
      navigation.navigate('RegisterStoreStep1');
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

  // --- Drawer Content ---
  const DrawerContent = () => (
    <ScrollView style={styles.drawerContent} showsVerticalScrollIndicator={false}>

      <View style={styles.drawerTopHeader}>
         <View style={styles.logoContainer}>
            <View style={styles.logoCircle}>
                <Ionicons name="leaf" size={20} color="#10b981" />
            </View>
            <View>
                <Text style={styles.appName}>Food Waste</Text>
                <Text style={styles.appSlogan}>รักษ์โลกด้วยมือเรา</Text>
            </View>
         </View>
         <TouchableOpacity onPress={toggleDrawer} style={styles.closeButton}>
            <Ionicons name="close" size={24} color="#6b7280" />
         </TouchableOpacity>
      </View>

      <View style={styles.profileCard}>
        <View style={styles.profileHeader}>
          <Image
            source={userData?.profileImage ? { uri: userData.profileImage } : { uri: defaultAvatar }}
            style={styles.drawerAvatar}
          />
          <View>
            <Text style={styles.drawerName}>{userData?.username || 'User'}</Text>
            <Text style={styles.drawerRole}>โหมด: ลูกค้า</Text>
          </View>
        </View>

        {/* Mode Switcher */}
        <View style={styles.modeContainer}>
            <TouchableOpacity style={styles.modeButtonActive}>
              <Ionicons name="cart" size={14} color="#fff" />
              <Text style={styles.modeTextActive}>ลูกค้า</Text>
            </TouchableOpacity>

            {/* ✅ ปุ่มร้านค้า: เช็ค currentRole เพื่อเปลี่ยนข้อความ */}
            <TouchableOpacity
              style={styles.modeButtonInactive}
              onPress={handleSwitchToStore}
            >
              <Ionicons name="storefront-outline" size={14} color="#6b7280" />
              <Text style={styles.modeTextInactive}>
                {userData?.currentRole === 'store' ? 'กลับหน้าร้าน' : 'สมัครร้านค้า'}
              </Text>
            </TouchableOpacity>
        </View>
      </View>

      <Text style={styles.sectionTitle}>เมนูหลัก</Text>
      <TouchableOpacity style={styles.drawerMenuItem} onPress={() => toggleDrawer()}>
        <View style={styles.menuIconBox}><Ionicons name="home-outline" size={20} color="#10b981" /></View>
        <Text style={styles.drawerMenuText}>หน้าหลัก</Text>
        <Ionicons name="chevron-forward" size={18} color="#d1d5db" style={{marginLeft: 'auto'}} />
      </TouchableOpacity>

      <TouchableOpacity style={styles.drawerMenuItem} onPress={() => { toggleDrawer(); navigation.navigate('Orders'); }}>
        <View style={styles.menuIconBox}><Ionicons name="receipt-outline" size={20} color="#f59e0b" /></View>
        <Text style={styles.drawerMenuText}>คำสั่งซื้อของฉัน</Text>
        <Ionicons name="chevron-forward" size={18} color="#d1d5db" style={{marginLeft: 'auto'}} />
      </TouchableOpacity>

      <TouchableOpacity style={styles.drawerMenuItem} onPress={() => { toggleDrawer(); navigation.navigate('FavoriteStores'); }}>
        <View style={styles.menuIconBox}><Ionicons name="heart-outline" size={20} color="#ef4444" /></View>
        <Text style={styles.drawerMenuText}>ร้านโปรด</Text>
        <Ionicons name="chevron-forward" size={18} color="#d1d5db" style={{marginLeft: 'auto'}} />
      </TouchableOpacity>

      <TouchableOpacity style={styles.drawerMenuItem} onPress={() => { toggleDrawer(); navigation.navigate('Notifications'); }}>
        <View style={styles.menuIconBox}><Ionicons name="notifications-outline" size={20} color="#3b82f6" /></View>
        <Text style={styles.drawerMenuText}>แจ้งเตือน</Text>
        <Ionicons name="chevron-forward" size={18} color="#d1d5db" style={{marginLeft: 'auto'}} />
      </TouchableOpacity>

      <Text style={styles.sectionTitle}>บัญชี</Text>
      <TouchableOpacity style={styles.drawerMenuItem} onPress={() => { toggleDrawer(); navigation.navigate('Profile'); }}>
        <View style={styles.menuIconBox}><Ionicons name="person-outline" size={20} color="#6366f1" /></View>
        <Text style={styles.drawerMenuText}>โปรไฟล์</Text>
        <Ionicons name="chevron-forward" size={18} color="#d1d5db" style={{marginLeft: 'auto'}} />
      </TouchableOpacity>

      <TouchableOpacity style={styles.drawerLogout} onPress={handleLogout}>
        <View style={[styles.menuIconBox, { backgroundColor: '#fee2e2' }]}><Ionicons name="log-out-outline" size={20} color="#ef4444" /></View>
        <Text style={styles.drawerLogoutText}>ออกจากระบบ</Text>
      </TouchableOpacity>
      <View style={{height: 50}} />
    </ScrollView>
  );

  if (isCheckingRole) {
    return (
      <View style={{flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff'}}>
        <ActivityIndicator size="large" color="#10b981" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      <View style={styles.header}>
        <View style={styles.headerLeft}>
            <TouchableOpacity style={styles.menuButton} onPress={toggleDrawer}>
                <Ionicons name="menu" size={30} color="#1f2937" />
            </TouchableOpacity>
            <TouchableOpacity
                style={styles.profileTextButton}
                onPress={() => navigation.navigate('Profile')}
                activeOpacity={0.6}
            >
                <Text style={styles.greeting}>สวัสดี, {userData?.username || 'User'} 👋</Text>
                <Text style={styles.subGreeting}>ช่วยโลกด้วยมื้ออร่อย</Text>
            </TouchableOpacity>
        </View>
        <TouchableOpacity onPress={() => navigation.navigate('Profile')}>
           <Image
             source={userData?.profileImage ? { uri: userData.profileImage } : { uri: defaultAvatar }}
             style={styles.avatar}
           />
        </TouchableOpacity>
      </View>

      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color="#9ca3af" />
        <TextInput style={styles.searchInput} placeholder="ค้นหาเมนู..." value={searchQuery} onChangeText={handleSearch} />
      </View>

      <ScrollView style={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
         <View style={styles.banner}>
            <View style={styles.bannerTextContainer}>
              <Text style={styles.bannerTitle}>ลดขยะ = ลดโลกร้อน 🌱</Text>
              <Text style={styles.bannerSubtitle}>ช่วยลง Food waste กันเถอะ</Text>
            </View>
            <Ionicons name="leaf" size={60} color="#10b981" style={{opacity: 0.15, position: 'absolute', right: 10, bottom: -10}} />
         </View>

         <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>เมนูแนะนำใกล้คุณ 🔥</Text>
         </View>
         {loading ? <ActivityIndicator size="large" color="#10b981" style={{marginTop: 20}} /> :
          <View style={styles.grid}>{filteredFood.map(renderFoodCard)}</View>
         }
         {!loading && filteredFood.length === 0 && (
            <View style={styles.emptyState}>
                <Ionicons name="basket-outline" size={60} color="#d1d5db" />
                <Text style={styles.emptyText}>ไม่พบรายการอาหาร</Text>
            </View>
         )}
         <View style={{height: 100}} />
      </ScrollView>

      <View style={styles.bottomNav}>
        <TouchableOpacity style={styles.navItem}><Ionicons name="home" size={24} color="#10b981" /><Text style={styles.navLabelActive}>หน้าหลัก</Text></TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={() => navigation.navigate('Orders')}><Ionicons name="receipt-outline" size={24} color="#9ca3af" /><Text style={styles.navLabel}>ออเดอร์</Text></TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={() => navigation.navigate('Notifications')}><Ionicons name="notifications-outline" size={24} color="#9ca3af" /><Text style={styles.navLabel}>แจ้งเตือน</Text></TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={() => navigation.navigate('Profile')}><Ionicons name="person-outline" size={24} color="#9ca3af" /><Text style={styles.navLabel}>โปรไฟล์</Text></TouchableOpacity>
      </View>

      {isDrawerOpen && (
        <Modal transparent visible={isDrawerOpen} animationType="none">
          <View style={styles.drawerOverlay}>
            <TouchableWithoutFeedback onPress={toggleDrawer}>
              <View style={styles.drawerBackdrop} />
            </TouchableWithoutFeedback>
            <Animated.View style={[styles.drawerContainer, { transform: [{ translateX: slideAnim }] }]}>
              <DrawerContent />
            </Animated.View>
          </View>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 60, paddingBottom: 20, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f3f4f6', zIndex: 10 },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  menuButton: { padding: 4 },
  profileTextButton: { paddingVertical: 4, paddingHorizontal: 4, flex: 1 },
  greeting: { fontSize: 18, fontWeight: 'bold', color: '#1f2937' },
  subGreeting: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#f3f4f6', borderWidth: 1, borderColor: '#e5e7eb' },
  searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', marginHorizontal: 20, marginTop: 15, paddingHorizontal: 15, paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: '#e5e7eb' },
  searchInput: { flex: 1, marginLeft: 10, fontSize: 15, color: '#374151' },
  content: { flex: 1, padding: 20 },
  banner: { backgroundColor: '#fff', borderRadius: 16, padding: 20, marginBottom: 25, position: 'relative', overflow: 'hidden', borderWidth: 1, borderColor: '#e5e7eb', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  bannerTitle: { color: '#10b981', fontSize: 18, fontWeight: 'bold' },
  bannerSubtitle: { color: '#6b7280', fontSize: 13, marginTop: 5 },
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
  emptyState: { alignItems: 'center', marginTop: 50 },
  emptyText: { color: '#9ca3af', fontSize: 16, marginTop: 10 },
  bottomNav: { flexDirection: 'row', backgroundColor: '#fff', paddingVertical: 10, paddingHorizontal: 20, borderTopWidth: 1, borderTopColor: '#f3f4f6', position: 'absolute', bottom: 0, left: 0, right: 0 },
  navItem: { flex: 1, alignItems: 'center' },
  navLabel: { fontSize: 10, color: '#9ca3af', marginTop: 4 },
  navLabelActive: { fontSize: 10, color: '#10b981', fontWeight: 'bold', marginTop: 4 },
  drawerOverlay: { flex: 1, flexDirection: 'row' },
  drawerBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  drawerContainer: {
    position: 'absolute', left: 0, top: 0, bottom: 0,
    width: width * 0.80,
    backgroundColor: '#fff',
    paddingTop: 50,
    shadowColor: "#000", shadowOffset: { width: 2, height: 0 }, shadowOpacity: 0.25, shadowRadius: 3.84, elevation: 5
  },
  drawerContent: { flex: 1, paddingHorizontal: 20 },
  drawerTopHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  logoContainer: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logoCircle: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#f0fdf4', alignItems: 'center', justifyContent: 'center' },
  appName: { fontSize: 16, fontWeight: 'bold', color: '#1f2937' },
  appSlogan: { fontSize: 12, color: '#6b7280' },
  closeButton: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#f3f4f6', alignItems: 'center', justifyContent: 'center' },
  profileCard: {
    backgroundColor: '#fff', borderRadius: 16, padding: 15,
    borderWidth: 1, borderColor: '#f3f4f6',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 2,
    marginBottom: 20,
  },
  profileHeader: { flexDirection: 'row', alignItems: 'center', gap: 15, marginBottom: 15 },
  drawerAvatar: { width: 50, height: 50, borderRadius: 25, borderWidth: 1, borderColor: '#10b981', backgroundColor: '#f3f4f6' },
  drawerName: { fontSize: 16, fontWeight: 'bold', color: '#1f2937' },
  drawerRole: { fontSize: 13, color: '#6b7280' },
  modeContainer: { flexDirection: 'row', gap: 10 },
  modeButtonActive: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 8, backgroundColor: '#10b981', borderRadius: 8 },
  modeButtonInactive: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 8, backgroundColor: '#f3f4f6', borderRadius: 8 },
  modeTextActive: { fontSize: 11, fontWeight: 'bold', color: '#fff' },
  modeTextInactive: { fontSize: 11, color: '#6b7280' },
  sectionTitle: { fontSize: 14, color: '#9ca3af', marginBottom: 10, marginLeft: 5, marginTop: 5 },
  drawerMenuItem: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff', paddingVertical: 12, paddingHorizontal: 5,
    marginBottom: 5
  },
  menuIconBox: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#f9fafb', alignItems: 'center', justifyContent: 'center', marginRight: 15 },
  drawerMenuText: { fontSize: 15, color: '#1f2937', fontWeight: '500' },
  drawerLogout: { flexDirection: 'row', alignItems: 'center', gap: 15, marginTop: 30, paddingHorizontal: 5, marginBottom: 30 },
  drawerLogoutText: { fontSize: 15, color: '#ef4444', fontWeight: 'bold' },
});