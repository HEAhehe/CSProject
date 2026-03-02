import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, StatusBar, Image,
  RefreshControl, ActivityIndicator, Alert, Animated, Dimensions,
  Modal, TouchableWithoutFeedback, Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { auth, db } from '../../firebase.config';
import { collection, getDocs, query, where, deleteDoc, doc, updateDoc, getDoc, writeBatch, onSnapshot } from 'firebase/firestore';
import { useFocusEffect } from '@react-navigation/native';

const { width } = Dimensions.get('window');

export default function MyShopScreen({ navigation }) {
  const [storeData, setStoreData] = useState(null);
  const [activeListings, setActiveListings] = useState([]);
  const [soldListings, setSoldListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState({ posted: 0, sold: 0, revenue: 0 });
  const [statusChecked, setStatusChecked] = useState(false);
  const [isStoreOpen, setIsStoreOpen] = useState(false);
  const [username, setUsername] = useState('');

  const [unreadNotifCount, setUnreadNotifCount] = useState(0);

  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const slideAnim = useRef(new Animated.Value(-width * 0.85)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const defaultAvatar = Image.resolveAssetSource(require('../../assets/icon.png')).uri;

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;
    const q = query(
      collection(db, 'store_notifications'),
      where('storeId', '==', user.uid),
      where('isRead', '==', false)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setUnreadNotifCount(snapshot.size);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const loadUsername = async () => {
      try {
        const user = auth.currentUser;
        if (!user) return;
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          const data = userDoc.data();
          setUsername(data.username || data.displayName || user.displayName || 'Username');
        } else {
          setUsername(user.displayName || 'Username');
        }
      } catch (e) {
        setUsername(auth.currentUser?.displayName || 'Username');
      }
    };
    loadUsername();
  }, []);

  useFocusEffect(
    useCallback(() => {
      setStatusChecked(false);
      setStoreData(null);
      setLoading(true);
      checkAuthAndLoadData();
    }, [])
  );

  const checkAuthAndLoadData = async () => {
    try {
      const user = auth.currentUser;
      if (!user) {
        Alert.alert('ต้องเข้าสู่ระบบ', 'กรุณาเข้าสู่ระบบเพื่อดำเนินการต่อ', [{ text: 'ตกลง', onPress: () => navigation.replace('SignIn') }]);
        return;
      }
      try {
        await user.reload();
        await user.getIdToken(true);
      } catch (tokenError) {
        if (tokenError.code === 'auth/invalid-credential' || tokenError.code === 'auth/user-token-expired') {
          await auth.signOut();
          Alert.alert('เซสชันหมดอายุ', 'กรุณาเข้าสู่ระบบใหม่อีกครั้ง', [{ text: 'ตกลง', onPress: () => navigation.replace('SignIn') }]);
          return;
        }
      }
      await loadStoreData();
      await loadListings();
    } catch (error) {
      setLoading(false);
    }
  };

  const checkStoreOpenStatus = (businessHours) => {
    if (!businessHours) return false;
    const dayMap = { 0: 'sun', 1: 'mon', 2: 'tue', 3: 'wed', 4: 'thu', 5: 'fri', 6: 'sat' };
    const now = new Date();
    const dayKey = dayMap[now.getDay()];
    const todayHours = businessHours[dayKey];

    if (!todayHours || !todayHours.isOpen) return false;

    const { openTime, closeTime } = todayHours;
    if (!openTime || !closeTime) return false;

    const [openH, openM] = openTime.split(':').map(Number);
    const [closeH, closeM] = closeTime.split(':').map(Number);

    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const openMinutes = openH * 60 + openM;
    const closeMinutes = closeH * 60 + closeM;

    if (closeMinutes < openMinutes) {
      return currentMinutes >= openMinutes || currentMinutes < closeMinutes;
    }
    return currentMinutes >= openMinutes && currentMinutes < closeMinutes;
  };

  const loadStoreData = async () => {
    try {
      const user = auth.currentUser;
      if (!user) return;

      const storeDocRef = doc(db, 'stores', user.uid);
      const storeDoc = await getDoc(storeDocRef);

      if (storeDoc.exists()) {
        const storeInfo = storeDoc.data();
        if (storeInfo.status === 'approved') {
          setStoreData(storeInfo);
          setIsStoreOpen(checkStoreOpenStatus(storeInfo.businessHours));
          setStatusChecked(true);
        } else if (storeInfo.status === 'pending') {
          if (!statusChecked) {
            setStatusChecked(true);
            Alert.alert('รอการอนุมัติ', 'ร้านค้าของคุณอยู่ระหว่างการตรวจสอบ กรุณารอการอนุมัติ', [{ text: 'ตกลง', onPress: () => navigation.goBack() }]);
          }
        } else if (storeInfo.status === 'rejected') {
          if (!statusChecked) {
            setStatusChecked(true);
            Alert.alert('ถูกปฏิเสธ', storeInfo.rejectReason || 'ร้านค้าของคุณไม่ได้รับการอนุมัติ', [{ text: 'ตกลง', onPress: () => navigation.goBack() }]);
          }
        }
      } else {
        const approvalQuery = query(collection(db, 'approval_requests'), where('userId', '==', user.uid), where('type', '==', 'store_registration'));
        const approvalSnapshot = await getDocs(approvalQuery);

        if (!approvalSnapshot.empty) {
          if (!statusChecked) {
            setStatusChecked(true);
            Alert.alert('รอการอนุมัติ', 'ร้านค้าของคุณอยู่ระหว่างการตรวจสอบ กรุณารอการอนุมัติ', [{ text: 'ตกลง', onPress: () => navigation.goBack() }]);
          }
        } else {
          if (!statusChecked) {
            setStatusChecked(true);
            Alert.alert('ยังไม่มีร้านค้า', 'คุณยังไม่ได้สมัครเป็นร้านค้า ต้องการสมัครหรือไม่?', [
              { text: 'ยกเลิก', onPress: () => navigation.goBack(), style: 'cancel' },
              { text: 'สมัคร', onPress: () => navigation.navigate('RegisterStoreStep1') }
            ]);
          }
        }
      }
    } catch (error) {
      Alert.alert('ข้อผิดพลาด', 'ไม่สามารถโหลดข้อมูลร้านค้าได้');
    }
  };

  const loadListings = async () => {
    try {
      const user = auth.currentUser;
      if (!user) return;

      const q = query(collection(db, 'food_items'), where('userId', '==', user.uid));
      const snapshot = await getDocs(q);
      const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      const active = items.filter(item => item.quantity > 0);
      setActiveListings(active);

      const ordersQuery = query(collection(db, 'orders'), where('storeId', '==', user.uid), where('status', '==', 'completed'));
      const ordersSnapshot = await getDocs(ordersQuery);
      const completedOrders = ordersSnapshot.docs.map(doc => doc.data());

      const totalSoldCount = completedOrders.reduce((sum, order) => sum + (order.items || []).reduce((s, item) => s + (item.quantity || 1), 0), 0);
      const totalRevenue = completedOrders.reduce((sum, order) => sum + (Number(order.totalPrice) || 0), 0);

      setStats({ posted: active.length, sold: totalSoldCount, revenue: totalRevenue });
    } catch (error) {
      console.log('Error loading listings', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleDeleteListing = async (itemId) => {
    Alert.alert('ลบรายการ', 'คุณต้องการลบรายการนี้ใช่หรือไม่?', [
      { text: 'ยกเลิก', style: 'cancel' },
      { text: 'ลบ', style: 'destructive', onPress: async () => { await deleteDoc(doc(db, 'food_items', itemId)); loadListings(); } }
    ]);
  };

  const formatExpiryDate = (dateString) => {
    if (!dateString) return 'ไม่ระบุ';
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return dateString;
      return `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getFullYear()} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')} น.`;
    } catch (error) { return dateString; }
  };

  const renderListingCard = (item) => {
    const originalPrice = Number(item.originalPrice) || 0;
    const discountPrice = Number(item.discountPrice) || Number(item.price) || 0;
    const discountPercent = originalPrice > 0 ? Math.round(((originalPrice - discountPrice) / originalPrice) * 100) : 0;

    return (
      <View key={item.id} style={styles.listingCard}>
        <View style={styles.imageWrap}>
          {item.imageUrl ? (
            <Image source={{ uri: item.imageUrl }} style={styles.cardImage} />
          ) : (
            <View style={styles.noImage}><Ionicons name="image-outline" size={30} color="#9ca3af" /></View>
          )}
          {discountPercent > 0 && (
            <View style={styles.discountTag}>
              <Text style={styles.discountTagText}>-{discountPercent}%</Text>
            </View>
          )}
        </View>

        <View style={styles.cardDetails}>
          <Text style={styles.cardTitle} numberOfLines={1}>{item.name}</Text>
          <View style={styles.priceContainer}>
            <Text style={styles.newPrice}>{discountPrice} ฿</Text>
            {originalPrice > 0 && <Text style={styles.oldPrice}>{originalPrice} ฿</Text>}
          </View>

          <View style={styles.tagsContainer}>
            <View style={styles.tag}>
              <Ionicons name="cube-outline" size={12} color="#6b7280" />
              <Text style={styles.tagText}>{item.quantity} {item.unit}</Text>
            </View>
            {item.expiryDate && (
              <View style={styles.tag}>
                <Ionicons name="time-outline" size={12} color="#6b7280" />
                <Text style={styles.tagText}>{formatExpiryDate(item.expiryDate)?.split(' ')[0]}</Text>
              </View>
            )}
          </View>
        </View>

        {/* ส่วนปุ่มจัดการ - ปรับ UI ให้เรียบร้อยขึ้นและมีมิติ */}
        <View style={styles.actionContainer}>
          <TouchableOpacity style={[styles.actionBtn, styles.editBtn]} onPress={() => navigation.navigate('CreateListing', { editItem: item })}>
            <Ionicons name="pencil-outline" size={16} color="#4b5563" />
            <Text style={styles.editBtnText}>แก้ไข</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionBtn, styles.deleteBtn]} onPress={() => handleDeleteListing(item.id)}>
            <Ionicons name="trash-outline" size={16} color="#ef4444" />
            <Text style={styles.deleteBtnText}>ลบ</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const handleRefresh = () => {
    setRefreshing(true);
    setStatusChecked(false);
    setStoreData(null);
    checkAuthAndLoadData();
  };

  const toggleDrawer = () => {
    if (isDrawerOpen) {
      Animated.parallel([
        Animated.timing(slideAnim, { toValue: -width * 0.85, duration: 250, useNativeDriver: true }),
        Animated.timing(fadeAnim, { toValue: 0, duration: 250, useNativeDriver: true })
      ]).start(() => setIsDrawerOpen(false));
    } else {
      setIsDrawerOpen(true);
      Animated.parallel([
        Animated.timing(slideAnim, { toValue: 0, duration: 250, useNativeDriver: true }),
        Animated.timing(fadeAnim, { toValue: 1, duration: 250, useNativeDriver: true })
      ]).start();
    }
  };

  const DrawerContent = () => (
    <ScrollView contentContainerStyle={styles.drawerScrollContent} showsVerticalScrollIndicator={false}>
      <View style={styles.drawerContentPadding}>
        <View style={styles.drawerTopHeader}>
          <View style={styles.logoContainer}>
            <View style={styles.logoCircle}><Ionicons name="leaf" size={24} color="#10b981" /></View>
            <View><Text style={styles.appName}>Food Waste</Text><Text style={styles.appSlogan}>ร้านค้า</Text></View>
          </View>
          <TouchableOpacity onPress={toggleDrawer} style={styles.closeButton}>
            <Ionicons name="close" size={24} color="#1f2937" />
          </TouchableOpacity>
        </View>

        <View style={styles.profileCard}>
          <View style={styles.profileHeader}>
            <Image source={storeData?.storeImage ? { uri: storeData.storeImage } : { uri: defaultAvatar }} style={styles.drawerAvatar} />
            <View style={{ flex: 1 }}>
              <Text style={styles.drawerName}>{username}</Text>
              <Text style={styles.drawerRole}>โหมด: ร้านค้า</Text>
            </View>
          </View>
          <View style={styles.modeContainer}>
            <TouchableOpacity style={styles.modeButtonInactive} onPress={() => { toggleDrawer(); navigation.navigate('Home'); }}>
              <Ionicons name="cart-outline" size={16} color="#6b7280" />
              <Text style={styles.modeTextInactive}>โหมดลูกค้า</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.modeButtonActive} activeOpacity={1}>
              <Ionicons name="storefront" size={16} color="#fff" />
              <Text style={styles.modeTextActive}>โหมดร้านค้า</Text>
            </TouchableOpacity>
          </View>
        </View>

        <Text style={styles.sectionLabel}>เมนูหลัก</Text>
        <TouchableOpacity style={styles.drawerMenuItem} onPress={() => { toggleDrawer(); navigation.navigate('MyShop'); }}>
          <View style={[styles.menuIconBox, { backgroundColor: '#dcfce7' }]}><Ionicons name="storefront-outline" size={20} color="#10b981" /></View>
          <Text style={styles.drawerMenuText}>หน้าหลักร้านค้า</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.drawerMenuItem} onPress={() => { toggleDrawer(); navigation.navigate('StoreOrders'); }}>
          <View style={[styles.menuIconBox, { backgroundColor: '#f3f4f6' }]}><Ionicons name="receipt-outline" size={20} color="#4b5563" /></View>
          <Text style={styles.drawerMenuText}>คำสั่งซื้อของร้าน</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.drawerMenuItem} onPress={() => { toggleDrawer(); navigation.navigate('StoreDashboard'); }}>
          <View style={[styles.menuIconBox, { backgroundColor: '#f3f4f6' }]}><Ionicons name="bar-chart-outline" size={20} color="#4b5563" /></View>
          <Text style={styles.drawerMenuText}>แดชบอร์ด</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.drawerMenuItem} onPress={() => { toggleDrawer(); navigation.navigate('StoreNotifications'); }}>
          <View style={[styles.menuIconBox, { backgroundColor: '#f3f4f6' }]}><Ionicons name="notifications-outline" size={20} color="#4b5563" /></View>
          <Text style={styles.drawerMenuText}>การแจ้งเตือนร้านค้า</Text>
        </TouchableOpacity>

        <Text style={styles.sectionLabel}>ตั้งค่า</Text>
        <TouchableOpacity style={styles.drawerMenuItem} onPress={() => { toggleDrawer(); navigation.navigate('StoreProfile'); }}>
          <View style={[styles.menuIconBox, { backgroundColor: '#f3f4f6' }]}><Ionicons name="person-outline" size={20} color="#4b5563" /></View>
          <Text style={styles.drawerMenuText}>โปรไฟล์</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.drawerMenuItem} onPress={() => { toggleDrawer(); navigation.navigate('StoreSettings'); }}>
          <View style={[styles.menuIconBox, { backgroundColor: '#f3f4f6' }]}><Ionicons name="settings-outline" size={20} color="#4b5563" /></View>
          <Text style={styles.drawerMenuText}>แก้ไขข้อมูลร้านค้า</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.drawerLogout} onPress={async () => { await auth.signOut(); navigation.replace('SignIn'); }}>
          <Ionicons name="log-out-outline" size={20} color="#ef4444" style={{marginRight: 10}}/>
          <Text style={styles.logoutText}>ออกจากระบบ</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />

      {/* Header - เสริมเงาด้านล่าง */}
      <View style={styles.header}>
        <TouchableOpacity onPress={toggleDrawer} style={styles.iconCircle}>
          <Ionicons name="menu-outline" size={24} color="#1f2937" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>ร้านค้าของฉัน</Text>
        <TouchableOpacity onPress={() => navigation.navigate('StoreProfile')}>
          <Image source={storeData?.storeImage ? { uri: storeData.storeImage } : { uri: defaultAvatar }} style={styles.avatar} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={{ paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#10b981" />}
      >

        {/* ชื่อร้านค้าและสถานะ */}
        <View style={styles.storeBanner}>
          <Text style={styles.greeting}>สวัสดี, 👋</Text>
          <View style={styles.storeNameRow}>
            <Text style={styles.storeName}>{storeData?.storeName || 'ร้านค้าของคุณ'}</Text>
            <View style={[styles.statusBadge, isStoreOpen ? styles.statusOpen : styles.statusClosed]}>
              <View style={[styles.statusDot, { backgroundColor: isStoreOpen ? '#10b981' : '#ef4444' }]} />
              <Text style={[styles.statusText, { color: isStoreOpen ? '#065f46' : '#991b1b' }]}>{isStoreOpen ? 'เปิด' : 'ปิด'}</Text>
            </View>
          </View>
        </View>

        {/* สถิติแบบการ์ด - เสริมเงาให้มีมิติ */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Ionicons name="albums-outline" size={20} color="#10b981" style={styles.statIcon} />
            <Text style={styles.statValue}>{stats.posted}</Text>
            <Text style={styles.statLabel}>โพสต์</Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="bag-check-outline" size={20} color="#10b981" style={styles.statIcon} />
            <Text style={styles.statValue}>{stats.sold}</Text>
            <Text style={styles.statLabel}>ขายแล้ว</Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="cash-outline" size={20} color="#10b981" style={styles.statIcon} />
            <Text style={styles.statValue}>{stats.revenue} ฿</Text>
            <Text style={styles.statLabel}>รายได้</Text>
          </View>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>สินค้าที่ลงขาย</Text>
        </View>

        {/* รายการสินค้า - เสริมเงาให้เหมือนหน้าออเดอร์ */}
        <View style={styles.listContainer}>
            {loading ? (
              <ActivityIndicator size="small" color="#10b981" style={{ marginTop: 40 }} />
            ) : activeListings.length > 0 ? (
              activeListings.map(renderListingCard)
            ) : (
              <View style={styles.emptyState}>
                <Ionicons name="cube-outline" size={48} color="#d1d5db" />
                <Text style={styles.emptyStateText}>ยังไม่มีสินค้าในร้าน</Text>
                <TouchableOpacity style={styles.addFirstBtn} onPress={() => navigation.navigate('CreateListing')}>
                  <Text style={styles.addFirstBtnText}>+ ลงขายสินค้าชิ้นแรก</Text>
                </TouchableOpacity>
              </View>
            )}
        </View>

      </ScrollView>

      {/* Floating Action Button - ปรับเงาให้กลมกลืน */}
      {storeData?.status === 'approved' && (
        <TouchableOpacity style={styles.fab} onPress={() => navigation.navigate('CreateListing')}>
          <Ionicons name="add" size={30} color="#fff" />
        </TouchableOpacity>
      )}

      {/* Bottom Nav - เสริมเงาด้านบน */}
      <View style={styles.bottomNav}>
        <TouchableOpacity style={styles.navItem}>
          <Ionicons name="storefront" size={24} color="#1f2937" />
          <Text style={styles.navLabelActive}>ร้านค้า</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={() => navigation.navigate('StoreOrders')}>
          <Ionicons name="receipt-outline" size={24} color="#9ca3af" />
          <Text style={styles.navLabel}>ออเดอร์</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={() => navigation.navigate('StoreNotifications')}>
          <View style={{ position: 'relative' }}>
            <Ionicons name="notifications-outline" size={24} color="#9ca3af" />
            {unreadNotifCount > 0 && (
              <View style={styles.notifBadge}>
                <Text style={styles.notifBadgeText}>{unreadNotifCount > 99 ? '99+' : unreadNotifCount}</Text>
              </View>
            )}
          </View>
          <Text style={styles.navLabel}>แจ้งเตือน</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={() => navigation.navigate('StoreProfile')}>
          <Ionicons name="person-outline" size={24} color="#9ca3af" />
          <Text style={styles.navLabel}>โปรไฟล์</Text>
        </TouchableOpacity>
      </View>

      {/* Drawer */}
      {isDrawerOpen && (
        <Modal transparent visible={isDrawerOpen} animationType="none">
          <View style={styles.drawerOverlay}>
            <TouchableWithoutFeedback onPress={toggleDrawer}>
              <Animated.View style={[styles.drawerBackdrop, { opacity: fadeAnim }]} />
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
  container: { flex: 1, backgroundColor: '#fafafa' }, // พื้นหลังเทาอ่อนมากๆ เพื่อให้การ์ดขาวเด่น
  content: { flex: 1 },

  // Header 🟢 เสริมเงา
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 15, paddingTop: Platform.OS === 'ios' ? 60 : 50, paddingBottom: 15,
    backgroundColor: '#ffffff',
    // Shadow สำหรับมิติ
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
    elevation: 2,
    zIndex: 10,
  },
  iconCircle: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f9fafb' },
  headerTitle: { fontSize: 16, fontWeight: '700', color: '#1f2937' },
  avatar: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#f3f4f6' },

  // Store Banner
  storeBanner: { padding: 20 },
  greeting: { fontSize: 13, color: '#6b7280' },
  storeNameRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
  storeName: { fontSize: 22, fontWeight: 'bold', color: '#1f2937' },
  statusBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  statusOpen: { backgroundColor: '#dcfce7' },
  statusClosed: { backgroundColor: '#fee2e2' },
  statusDot: { width: 6, height: 6, borderRadius: 3, marginRight: 5 },
  statusText: { fontSize: 12, fontWeight: '700' },

  // Stats - 🟡 เสริมเงาให้มิติ
  statsRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 15, marginBottom: 20 },
  statCard: {
    flex: 1, backgroundColor: '#ffffff', padding: 15, borderRadius: 12,
    borderWidth: 1, borderColor: '#f3f4f6',
    alignItems: 'center',
    // Shadow ให้การ์ดลอยขึ้น
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
  },
  statIcon: { marginBottom: 8 },
  statValue: { fontSize: 18, fontWeight: '700', color: '#1f2937' },
  statLabel: { fontSize: 11, color: '#9ca3af', marginTop: 2 },

  sectionHeader: { paddingHorizontal: 20, marginBottom: 15 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#1f2937' },

  // รายการสินค้า - 🔴 ปรับโครงสร้างและเสริมเงาให้เหมือนหน้าออเดอร์
  listContainer: { paddingHorizontal: 15 },
  listingCard: {
    backgroundColor: '#ffffff', borderRadius: 12, marginBottom: 15,
    borderWidth: 1, borderColor: '#f3f4f6',
    overflow: 'hidden',
    // Shadow เหมือนหน้าออเดอร์
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 4,
  },
  imageWrap: { height: 140, backgroundColor: '#f3f4f6', position: 'relative' },
  cardImage: { width: '100%', height: '100%' },
  noImage: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  discountTag: { position: 'absolute', top: 10, right: 10, backgroundColor: '#ef4444', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  discountTagText: { fontSize: 11, fontWeight: 'bold', color: '#fff' },

  cardDetails: { padding: 15, paddingBottom: 10 },
  cardTitle: { fontSize: 15, fontWeight: '600', color: '#1f2937', marginBottom: 4 },
  priceContainer: { flexDirection: 'row', alignItems: 'flex-end', marginBottom: 10 },
  newPrice: { fontSize: 18, fontWeight: 'bold', color: '#10b981', marginRight: 8 },
  oldPrice: { fontSize: 12, color: '#9ca3af', textDecorationLine: 'line-through', marginBottom: 2 },

  tagsContainer: { flexDirection: 'row', gap: 8 },
  tag: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#f9fafb', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, borderWidth: 1, borderColor: '#f3f4f6' },
  tagText: { fontSize: 11, color: '#6b7280', fontWeight: '500' },

  // ส่วนปุ่มจัดการแบบใหม่
  actionContainer: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: '#f3f4f6', marginTop: 10 },
  actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, gap: 5 },
  editBtn: { borderRightWidth: 1, borderRightColor: '#f3f4f6' },
  deleteBtn: { },
  editBtnText: { fontSize: 13, color: '#4b5563', fontWeight: '600' },
  deleteBtnText: { fontSize: 13, color: '#ef4444', fontWeight: '600' },

  emptyState: { alignItems: 'center', marginTop: 40 },
  emptyStateText: { fontSize: 14, color: '#9ca3af', marginTop: 10 },
  addFirstBtn: { marginTop: 15, backgroundColor: '#10b981', paddingHorizontal: 15, paddingVertical: 10, borderRadius: 8 },
  addFirstBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },

  // FAB - 🟢 ปรับเงาให้กลมกลืน
  fab: {
    position: 'absolute', bottom: 90, right: 20,
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: '#10b981', alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', // ปรับเป็นสีดำเพื่อให้เงาดูจริง
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 6,
  },

  // Bottom Nav - 🟡 เสริมเงาด้านบน
  bottomNav: {
    flexDirection: 'row', backgroundColor: '#fff', paddingVertical: 12,
    position: 'absolute', bottom: 0, width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 }, // เงาชี้ขึ้นบน
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 8,
  },
  navItem: { flex: 1, alignItems: 'center' },
  navLabel: { fontSize: 10, color: '#9ca3af', marginTop: 4 },
  navLabelActive: { fontSize: 10, color: '#1f2937', fontWeight: 'bold', marginTop: 4 },
  notifBadge: { position: 'absolute', top: -4, right: -6, backgroundColor: '#ef4444', borderRadius: 10, minWidth: 18, height: 18, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#fff', paddingHorizontal: 4, zIndex: 5 },
  notifBadgeText: { color: '#fff', fontSize: 10, fontWeight: 'bold' },

  // Drawer
  drawerOverlay: { flex: 1, flexDirection: 'row' },
  drawerBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  drawerContainer: {
    position: 'absolute', left: 0, top: 0, bottom: 0,
    width: width * 0.85, backgroundColor: '#fff',
    // 🟠 เสริมเงาด้านขวาเมื่อเปิด
    shadowColor: '#000',
    shadowOffset: { width: 4, height: 0 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 10,
  },
  drawerScrollContent: { flexGrow: 1, paddingTop: Platform.OS === 'ios' ? 50 : 30, paddingBottom: 40 },
  drawerContentPadding: { paddingHorizontal: 20 },
  drawerTopHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  logoContainer: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logoCircle: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#f0fdf4', alignItems: 'center', justifyContent: 'center' },
  appName: { fontSize: 16, fontWeight: '700', color: '#1f2937' },
  appSlogan: { fontSize: 12, color: '#6b7280' },
  closeButton: { padding: 4 },
  profileCard: { backgroundColor: '#f9fafb', borderRadius: 16, padding: 15, marginBottom: 20 },
  profileHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  drawerAvatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#e5e7eb' },
  drawerName: { fontSize: 16, fontWeight: '700', color: '#1f2937' },
  drawerRole: { fontSize: 12, color: '#6b7280' },
  modeContainer: { flexDirection: 'row', gap: 8 },
  modeButtonActive: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 8, backgroundColor: '#1f2937', borderRadius: 8 },
  modeButtonInactive: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 8, backgroundColor: '#e5e7eb', borderRadius: 8 },
  modeTextActive: { fontSize: 11, fontWeight: '700', color: '#fff' },
  modeTextInactive: { fontSize: 11, color: '#4b5563', fontWeight: '600' },
  sectionLabel: { fontSize: 11, color: '#9ca3af', fontWeight: '700', letterSpacing: 1, marginTop: 10, marginBottom: 8 },
  drawerMenuItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, marginBottom: 2 },
  menuIconBox: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  drawerMenuText: { fontSize: 14, color: '#1f2937', fontWeight: '500' },
  drawerLogout: { flexDirection: 'row', alignItems: 'center', marginTop: 20, paddingVertical: 12 },
  logoutText: { fontSize: 14, color: '#ef4444', fontWeight: '600' },
});