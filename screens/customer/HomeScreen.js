import React, { useState, useEffect, useCallback, useRef } from 'react'; // ✅ ต้องอยู่ตรงนี้
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
  TouchableWithoutFeedback,
  Alert,
  Platform // ✅ Platform ต้องอยู่ใน react-native
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { auth, db } from '../../firebase.config';
import { doc, collection, getDocs, query, where, onSnapshot, setDoc, deleteDoc, getDoc } from 'firebase/firestore';
import { useFocusEffect } from '@react-navigation/native';

const { width } = Dimensions.get('window');

export default function HomeScreen({ navigation }) {
  const [userData, setUserData] = useState(null);
  const [foodItems, setFoodItems] = useState([]);
  const [filteredFood, setFilteredFood] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isCheckingRole, setIsCheckingRole] = useState(true);

  const [favoriteStoreIds, setFavoriteStoreIds] = useState([]);
  const [cartCount, setCartCount] = useState(0);
  const [storesData, setStoresData] = useState({});
  const [currentTime, setCurrentTime] = useState(new Date());

  const scrollRef = useRef(null);
  const [showScrollTop, setShowScrollTop] = useState(false);

  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const slideAnim = useRef(new Animated.Value(-width * 0.85)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const defaultAvatar = Image.resolveAssetSource(require('../../assets/icon.png')).uri;

  useEffect(() => {
    let unsubscribeUser;
    let unsubscribeFav;
    let unsubscribeCart;

    const unsubscribeAuth = auth.onAuthStateChanged((user) => {
      if (user) {
        unsubscribeUser = onSnapshot(doc(db, 'users', user.uid), (docSnapshot) => {
          if (docSnapshot.exists()) {
            const data = docSnapshot.data();
            setUserData(data);
            if (data.currentRole === 'admin') navigation.replace('AdminHome');
            else setIsCheckingRole(false);
          } else setIsCheckingRole(false);
        });

        unsubscribeFav = onSnapshot(collection(db, 'users', user.uid, 'favorites'), (s) => {
            setFavoriteStoreIds(s.docs.map(d => d.id));
        });

        unsubscribeCart = onSnapshot(collection(db, 'users', user.uid, 'cart'), (s) => {
          let total = 0; s.forEach(doc => total += (doc.data().quantity || 1)); setCartCount(total);
        });
      } else {
        setIsCheckingRole(false);
        setUserData(null);
        setFavoriteStoreIds([]);
        setCartCount(0);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeUser) unsubscribeUser();
      if (unsubscribeFav) unsubscribeFav();
      if (unsubscribeCart) unsubscribeCart();
    };
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (!isCheckingRole) fetchFoodItems();
    }, [isCheckingRole])
  );

  const fetchFoodItems = async () => {
    try {
        const q = query(collection(db, 'food_items'), where('quantity', '>', 0));
        const snapshot = await getDocs(q);
        const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setFoodItems(items);
        setFilteredFood(items);

        const uniqueStoreIds = [...new Set(items.map(item => item.storeId || item.userId).filter(id => id))];
        const storesInfo = {};

        await Promise.all(uniqueStoreIds.map(async (targetId) => {
            try {
                let storeDoc = await getDoc(doc(db, 'stores', targetId));
                if (storeDoc.exists()) {
                    storesInfo[targetId] = storeDoc.data();
                } else {
                    storeDoc = await getDoc(doc(db, 'users', targetId));
                    if (storeDoc.exists()) {
                        storesInfo[targetId] = storeDoc.data();
                    }
                }
            } catch (e) { console.error("Store fetch error:", e); }
        }));
        setStoresData(storesInfo);
    } catch (error) {
        console.error('Error fetching foods:', error);
    } finally {
        setLoading(false);
        setRefreshing(false);
    }
  };

  const onRefresh = () => { setRefreshing(true); fetchFoodItems(); };

  const handleSearch = (text) => {
    setSearchQuery(text);
    if (text) {
      const lower = text.toLowerCase();
      setFilteredFood(foodItems.filter(i => (i.name||'').toLowerCase().includes(lower) || (i.storeName||'').toLowerCase().includes(lower)));
    } else setFilteredFood(foodItems);
  };

  const handleToggleFavorite = async (targetStoreId, targetStoreName) => {
    const user = auth.currentUser;
    if (!user) { Alert.alert('กรุณาเข้าสู่ระบบ'); return; }
    const favRef = doc(db, 'users', user.uid, 'favorites', targetStoreId);
    try {
        if (favoriteStoreIds.includes(targetStoreId)) await deleteDoc(favRef);
        else await setDoc(favRef, { storeId: targetStoreId, storeName: targetStoreName || 'ร้านค้า', savedAt: new Date().toISOString() });
    } catch (error) { console.error("Error:", error); }
  };

  const getStoreStatus = (storeId) => {
      const store = storesData[storeId];
      const closeTimeStr = store?.closeTime || store?.closingTime;
      const openTimeStr = store?.openTime;
      if (!closeTimeStr) return { text: "เปิดอยู่", color: "#10b981", isOpen: true };

      const now = currentTime;
      const openDate = new Date();
      const closeDate = new Date();

      if (typeof closeTimeStr === 'string' && closeTimeStr.includes(':')) {
          const [hours, minutes] = closeTimeStr.split(':').map(Number);
          closeDate.setHours(hours, minutes, 0, 0);
      }
      if (openTimeStr && typeof openTimeStr === 'string' && openTimeStr.includes(':')) {
          const [openH, openM] = openTimeStr.split(':').map(Number);
          openDate.setHours(openH, openM, 0, 0);
      } else openDate.setHours(0, 0, 0, 0);

      if (now < openDate) return { text: `เปิด ${openTimeStr} น.`, color: "#ef4444", isOpen: false };
      if (now > closeDate) return { text: "ปิดแล้ว", color: "#ef4444", isOpen: false };

      const diffMs = closeDate - now;
      const totalMinutesLeft = Math.floor(diffMs / (1000 * 60));
      if (totalMinutesLeft > 30) return { text: "เปิดอยู่", color: "#10b981", isOpen: true };

      const fmt = (n) => n < 10 ? `0${n}` : n;
      const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
      const diffSecs = Math.floor((diffMs % (1000 * 60)) / 1000);
      return { text: `ปิดใน ${fmt(diffMins)}:${fmt(diffSecs)}`, color: "#f59e0b", isOpen: true };
  };

  const handleScroll = (event) => {
    const offsetY = event.nativeEvent.contentOffset.y;
    if (offsetY > 120) setShowScrollTop(true);
    else setShowScrollTop(false);
  };

  const scrollToTop = () => {
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  };

  const toggleDrawer = () => {
    if (isDrawerOpen) {
      Animated.parallel([
        Animated.timing(slideAnim, { toValue: -width * 0.85, duration: 300, useNativeDriver: true }),
        Animated.timing(fadeAnim, { toValue: 0, duration: 300, useNativeDriver: true })
      ]).start(() => setIsDrawerOpen(false));
    } else {
      setIsDrawerOpen(true);
      Animated.parallel([
        Animated.timing(slideAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
        Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true })
      ]).start();
    }
  };

  const handleLogout = async () => { await auth.signOut(); };
  const handleSwitchToStore = () => { toggleDrawer(); if (userData?.currentRole === 'store' || userData?.currentRole === 'admin') navigation.navigate('MyShop'); else navigation.navigate('RegisterStoreStep1'); };

  const renderFoodCard = (item) => {
      const originalPrice = Number(item.originalPrice) || 0;
      const discountPrice = Number(item.discountPrice) || Number(item.price) || 0;
      const discountPercent = originalPrice > 0 ? Math.round(((originalPrice - discountPrice) / originalPrice) * 100) : 0;
      const realStoreId = item.storeId || item.userId;
      const storeInfo = storesData[realStoreId] || {};
      const displayStoreName = storeInfo.storeName || item.storeName || storeInfo.username || 'ร้านค้า';
      const isFav = favoriteStoreIds.includes(realStoreId);
      const status = getStoreStatus(realStoreId);

      return (
        <TouchableOpacity
            key={item.id}
            style={[styles.cardContainer, !status.isOpen && { opacity: 0.6 }]}
            // ✅ ส่งชื่อร้านที่ถูกต้องไปยังหน้า FoodDetail ด้วย
            onPress={() => status.isOpen ? navigation.navigate('FoodDetail', { food: { ...item, storeName: displayStoreName } }) : Alert.alert("ร้านปิดแล้ว", "...") }
            activeOpacity={0.9}
          >
          <View style={styles.cardImageContainer}>
            {item.imageUrl ? <Image source={{ uri: item.imageUrl }} style={styles.cardImage} /> : <View style={styles.cardImagePlaceholder}><Ionicons name="fast-food" size={30} color="#ccc" /></View>}
          </View>
          <View style={styles.cardInfo}>
            <View style={styles.cardStoreRow}><Ionicons name="storefront" size={14} color="#1f2937" /><Text style={styles.cardStoreName} numberOfLines={1}>{displayStoreName}</Text></View>
            <Text style={styles.cardFoodName} numberOfLines={1}>{item.name}</Text>
            <View style={styles.cardPriceRow}>
               <Text style={styles.cardDiscountPrice}>฿{discountPrice}</Text>
               {originalPrice > discountPrice && <Text style={styles.cardOriginalPrice}>฿{originalPrice}</Text>}
               {discountPercent > 0 && <View style={styles.discountTag}><Text style={styles.discountTagText}>-{discountPercent}%</Text></View>}
            </View>
            <View style={styles.cardMetaRow}>
               <View style={styles.metaItem}><Ionicons name="location-outline" size={12} color="#6b7280" /><Text style={styles.cardMetaText}> 0.8 กม.</Text></View>
               <Text style={styles.separator}>•</Text>
               <View style={styles.metaItem}><Ionicons name="time-outline" size={12} color={status.color} /><Text style={[styles.cardMetaText, { color: status.color, fontWeight: 'bold' }]}> {status.text}</Text></View>
               <Text style={styles.separator}>•</Text>
               <View style={styles.metaItem}><Text style={styles.cardMetaText}>เหลือ {item.quantity}</Text></View>
            </View>
          </View>
          <TouchableOpacity style={styles.heartIcon} onPress={() => handleToggleFavorite(realStoreId, displayStoreName)}>
              <Ionicons name={isFav ? "heart" : "heart-outline"} size={22} color={isFav ? "#ef4444" : "#9ca3af"} />
          </TouchableOpacity>
        </TouchableOpacity>
      );
  };

  const DrawerContent = () => (
    <View style={styles.drawerWrapper}>
      <ScrollView style={styles.drawerContent} showsVerticalScrollIndicator={false}>
        <View style={styles.drawerTopHeader}>
           <View style={styles.logoContainer}>
              <View style={styles.logoCircle}><Ionicons name="leaf" size={20} color="#10b981" /></View>
              <View><Text style={styles.appName}>Food Waste</Text><Text style={styles.appSlogan}>รักษ์โลกด้วยมือเรา</Text></View>
           </View>
           <TouchableOpacity onPress={toggleDrawer} style={styles.closeButton}><Ionicons name="close" size={24} color="#6b7280" /></TouchableOpacity>
        </View>
        <View style={styles.profileCard}>
          <View style={styles.profileHeader}>
            <Image source={userData?.profileImage ? { uri: userData.profileImage } : { uri: defaultAvatar }} style={styles.drawerAvatar} />
            <View><Text style={styles.drawerName}>{userData?.username || 'User'}</Text><Text style={styles.drawerRole}>โหมด: ลูกค้า</Text></View>
          </View>
          <View style={styles.modeContainer}>
              <TouchableOpacity style={styles.modeButtonActive}><Ionicons name="cart" size={14} color="#fff" /><Text style={styles.modeTextActive}>โหมดลูกค้า</Text></TouchableOpacity>
              <TouchableOpacity style={styles.modeButtonInactive} onPress={handleSwitchToStore}><Ionicons name="storefront-outline" size={14} color="#6b7280" /><Text style={styles.modeTextInactive}>{userData?.currentRole === 'store' ? 'โหมดร้านค้า' : 'สมัครร้านค้า'}</Text></TouchableOpacity>
          </View>
        </View>
        <Text style={styles.sectionTitle}>เมนูหลัก</Text>
        <TouchableOpacity style={styles.drawerMenuItem} onPress={() => toggleDrawer()}><View style={styles.menuIconBox}><Ionicons name="home-outline" size={20} color="#10b981" /></View><Text style={styles.drawerMenuText}>หน้าหลัก</Text><Ionicons name="chevron-forward" size={18} color="#d1d5db" style={{marginLeft: 'auto'}} /></TouchableOpacity>
        <TouchableOpacity style={styles.drawerMenuItem} onPress={() => { toggleDrawer(); navigation.navigate('Orders'); }}><View style={styles.menuIconBox}><Ionicons name="receipt-outline" size={20} color="#f59e0b" /></View><Text style={styles.drawerMenuText}>คำสั่งซื้อของฉัน</Text><Ionicons name="chevron-forward" size={18} color="#d1d5db" style={{marginLeft: 'auto'}} /></TouchableOpacity>
        <TouchableOpacity style={styles.drawerMenuItem} onPress={() => { toggleDrawer(); navigation.navigate('FavoriteStores'); }}><View style={styles.menuIconBox}><Ionicons name="heart-outline" size={20} color="#ef4444" /></View><Text style={styles.drawerMenuText}>ร้านโปรด</Text><Ionicons name="chevron-forward" size={18} color="#d1d5db" style={{marginLeft: 'auto'}} /></TouchableOpacity>
        <TouchableOpacity style={styles.drawerMenuItem} onPress={() => { toggleDrawer(); navigation.navigate('Notifications'); }}><View style={styles.menuIconBox}><Ionicons name="notifications-outline" size={20} color="#3b82f6" /></View><Text style={styles.drawerMenuText}>แจ้งเตือน</Text><Ionicons name="chevron-forward" size={18} color="#d1d5db" style={{marginLeft: 'auto'}} /></TouchableOpacity>
        <Text style={styles.sectionTitle}>บัญชี</Text>
        <TouchableOpacity style={styles.drawerMenuItem} onPress={() => { toggleDrawer(); navigation.navigate('Profile'); }}><View style={styles.menuIconBox}><Ionicons name="person-outline" size={20} color="#6366f1" /></View><Text style={styles.drawerMenuText}>โปรไฟล์</Text><Ionicons name="chevron-forward" size={18} color="#d1d5db" style={{marginLeft: 'auto'}} /></TouchableOpacity>
        <TouchableOpacity style={styles.drawerLogout} onPress={handleLogout}><View style={[styles.menuIconBox, { backgroundColor: '#fee2e2' }]}><Ionicons name="log-out-outline" size={20} color="#ef4444" /></View><Text style={styles.drawerLogoutText}>ออกจากระบบ</Text></TouchableOpacity>
        <View style={{height: 50}} />
      </ScrollView>
    </View>
  );

  if (isCheckingRole) return (<View style={styles.center}><ActivityIndicator size="large" color="#10b981" /></View>);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      <View style={styles.header}>
        <View style={styles.headerLeft}>
            <TouchableOpacity style={styles.menuButton} onPress={toggleDrawer}><Ionicons name="menu" size={30} color="#1f2937" /></TouchableOpacity>
            <TouchableOpacity style={styles.profileTextButton} onPress={() => navigation.navigate('Profile')} activeOpacity={0.6}><Text style={styles.greeting}>สวัสดี, {userData?.username || 'User'}</Text></TouchableOpacity>
        </View>
        <View style={styles.headerRight}>
            <TouchableOpacity style={styles.cartHeaderButton} onPress={() => navigation.navigate('Cart')}>
                <Ionicons name="cart-outline" size={26} color="#1f2937" />
                {cartCount > 0 && (
                  <View style={styles.cartBadgeSmall}>
                      <Text style={styles.cartBadgeTextSmall}>{cartCount}</Text>
                  </View>
                )}
            </TouchableOpacity>
            <TouchableOpacity onPress={() => navigation.navigate('Profile')}><Image source={userData?.profileImage ? { uri: userData.profileImage } : { uri: defaultAvatar }} style={styles.avatar} /></TouchableOpacity>
        </View>
      </View>

      <ScrollView
        ref={scrollRef}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color="#9ca3af" />
          <TextInput
            style={styles.searchInput}
            placeholder="ค้นหาร้านอาหารหรือเมนู"
            value={searchQuery}
            onChangeText={handleSearch}
          />
        </View>
        <View style={styles.sectionHeader}><Text style={styles.sectionTitleMain}>สั่งอาหารของคุณ 🔥</Text></View>
        {loading ? <ActivityIndicator size="large" color="#10b981" style={{marginTop: 20}} /> : <View style={styles.listContainer}>{filteredFood.map(renderFoodCard)}</View>}
        {!loading && filteredFood.length === 0 && (<View style={styles.emptyState}><Ionicons name="basket-outline" size={60} color="#d1d5db" /><Text style={styles.emptyText}>ไม่พบรายการอาหาร</Text></View>)}
        <View style={{height: 120}} />
      </ScrollView>

      {/* ✅ ปุ่มเลื่อนขึ้นบนสุด: ทรงสี่เหลี่ยมผืนผ้า ตรงกลางล่าง */}
      {showScrollTop && (
        <TouchableOpacity style={styles.scrollTopButton} onPress={scrollToTop} activeOpacity={0.8}>
           <Ionicons name="arrow-up" size={18} color="#fff" />
           <Text style={styles.scrollTopText}>กลับไปด้านบน</Text>
        </TouchableOpacity>
      )}

      <View style={styles.bottomNav}>
        <TouchableOpacity style={styles.navItem}><Ionicons name="home" size={24} color="#10b981" /><Text style={styles.navLabelActive}>หน้าหลัก</Text></TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={() => navigation.navigate('Orders')}><Ionicons name="receipt-outline" size={24} color="#9ca3af" /><Text style={styles.navLabel}>ออเดอร์</Text></TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={() => navigation.navigate('Notifications')}><Ionicons name="notifications-outline" size={24} color="#9ca3af" /><Text style={styles.navLabel}>แจ้งเตือน</Text></TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={() => navigation.navigate('Profile')}><Ionicons name="person-outline" size={24} color="#9ca3af" /><Text style={styles.navLabel}>โปรไฟล์</Text></TouchableOpacity>
      </View>

      {isDrawerOpen && (<Modal transparent visible={isDrawerOpen} animationType="none"><View style={styles.drawerOverlay}><TouchableWithoutFeedback onPress={toggleDrawer}><View style={styles.drawerBackdrop} /></TouchableWithoutFeedback><Animated.View style={[styles.drawerContainer, { transform: [{ translateX: slideAnim }] }]}><DrawerContent /></Animated.View></View></Modal>)}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 60 : 60, // ✅ เท่าหน้า Home
    paddingBottom: 15,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
    zIndex: 10
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 15 },
  menuButton: { padding: 4 },
  profileTextButton: { paddingVertical: 4 },
  greeting: { fontSize: 20, fontWeight: 'bold', color: '#1f2937' },
  avatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#f3f4f6', borderWidth: 1, borderColor: '#e5e7eb' },
  cartHeaderButton: { padding: 5, position: 'relative' },
  cartBadgeSmall: { position: 'absolute', top: -2, right: -2, backgroundColor: '#ef4444', minWidth: 16, height: 16, borderRadius: 8, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#fff' },
  cartBadgeTextSmall: { color: '#fff', fontSize: 9, fontWeight: 'bold' },
  searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', paddingHorizontal: 15, paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: '#e5e7eb', marginBottom: 20 },
  searchInput: { flex: 1, marginLeft: 10, fontSize: 15, color: '#374151' },
  content: { flex: 1, paddingHorizontal: 20, paddingTop: 15 },
  sectionHeader: { marginBottom: 15 },
  sectionTitleMain: { fontSize: 18, fontWeight: 'bold', color: '#1f2937' },
  listContainer: { paddingBottom: 20 },
  cardContainer: { flexDirection: 'row', backgroundColor: '#fff', borderRadius: 16, padding: 12, marginBottom: 15, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2, borderWidth: 1, borderColor: '#f3f4f6', alignItems: 'center' },
  cardImageContainer: { width: 90, height: 90, borderRadius: 12, backgroundColor: '#f3f4f6', overflow: 'hidden', marginRight: 15 },
  cardImage: { width: '100%', height: '100%' },
  cardImagePlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  cardInfo: { flex: 1 },
  cardStoreRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  cardStoreName: { fontSize: 12, color: '#6b7280', marginLeft: 4 },
  cardFoodName: { fontSize: 16, fontWeight: 'bold', color: '#1f2937', marginBottom: 6 },
  cardPriceRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  cardDiscountPrice: { fontSize: 18, fontWeight: 'bold', color: '#ef4444' },
  cardOriginalPrice: { fontSize: 12, color: '#9ca3af', textDecorationLine: 'line-through' },
  discountTag: { backgroundColor: '#fee2e2', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  discountTagText: { fontSize: 10, color: '#ef4444', fontWeight: 'bold' },
  cardMetaRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', marginTop: 4 },
  metaItem: { flexDirection: 'row', alignItems: 'center' },
  cardMetaText: { fontSize: 11, color: '#6b7280', marginLeft: 2 },
  separator: { fontSize: 11, color: '#d1d5db', marginHorizontal: 6 },
  heartIcon: { padding: 5, position: 'absolute', top: 10, right: 10 },
  emptyState: { alignItems: 'center', marginTop: 50 },
  emptyText: { color: '#9ca3af', fontSize: 16, marginTop: 10 },
  bottomNav: { flexDirection: 'row', backgroundColor: '#fff', paddingVertical: 10, paddingHorizontal: 20, borderTopWidth: 1, borderTopColor: '#f3f4f6', position: 'absolute', bottom: 0, left: 0, right: 0 },
  navItem: { flex: 1, alignItems: 'center' },
  navLabel: { fontSize: 10, color: '#9ca3af', marginTop: 4 },
  navLabelActive: { fontSize: 10, color: '#10b981', fontWeight: 'bold', marginTop: 4 },
  scrollTopButton: { position: 'absolute', bottom: 85, alignSelf: 'center', backgroundColor: '#1f2937', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 30, elevation: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 5, zIndex: 100 },
  scrollTopText: { color: '#fff', fontSize: 13, fontWeight: 'bold', marginLeft: 8 },
  drawerOverlay: { flex: 1, flexDirection: 'row' },
  drawerBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  drawerContainer: { position: 'absolute', left: 0, top: 0, bottom: 0, width: width * 0.80, backgroundColor: '#fff', shadowColor: "#000", shadowOffset: { width: 2, height: 0 }, shadowOpacity: 0.25, shadowRadius: 3.84, elevation: 5 },
  drawerWrapper: { flex: 1, paddingTop: Platform.OS === 'ios' ? 30 : 30 }, // ✅ ปรับให้สูงขึ้น
  drawerContent: { flex: 1, paddingHorizontal: 20 },
  drawerTopHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 }, // ✅ ลดระยะห่าง
  logoContainer: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logoCircle: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#f0fdf4', alignItems: 'center', justifyContent: 'center' },
  appName: { fontSize: 16, fontWeight: 'bold', color: '#1f2937' },
  appSlogan: { fontSize: 12, color: '#6b7280' },
  closeButton: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#f3f4f6', alignItems: 'center', justifyContent: 'center' },
  profileCard: { backgroundColor: '#fff', borderRadius: 16, padding: 15, borderWidth: 1, borderColor: '#f3f4f6', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 2, marginBottom: 20 },
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
  drawerMenuItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', paddingVertical: 12, paddingHorizontal: 5, marginBottom: 5 },
  menuIconBox: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#f9fafb', alignItems: 'center', justifyContent: 'center', marginRight: 15 },
  drawerMenuText: { fontSize: 15, color: '#1f2937', fontWeight: '500' },
  drawerLogout: { flexDirection: 'row', alignItems: 'center', gap: 15, marginTop: 30, paddingHorizontal: 5, marginBottom: 30 },
  drawerLogoutText: { fontSize: 15, color: '#ef4444', fontWeight: 'bold' },
});