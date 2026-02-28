import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, StatusBar, Platform, Image,
  RefreshControl, ActivityIndicator, Animated, Dimensions, Modal, TouchableWithoutFeedback
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { auth, db } from '../../firebase.config';
import { collection, query, where, doc, onSnapshot } from 'firebase/firestore';

const { width } = Dimensions.get('window');

export default function OrdersScreen({ navigation }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [userData, setUserData] = useState(null);

  const [unreadCount, setUnreadCount] = useState(0); // 🔴 เพิ่ม state แจ้งเตือน

  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const slideAnim = useRef(new Animated.Value(-width * 0.85)).current;

  const defaultAvatar = Image.resolveAssetSource(require('../../assets/icon.png')).uri;

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) { setLoading(false); return; }

    const unsubUser = onSnapshot(doc(db, 'users', user.uid), (docSnap) => {
      if (docSnap.exists()) setUserData(docSnap.data());
    });

    const q = query(collection(db, 'orders'), where('userId', '==', user.uid));
    const unsubOrders = onSnapshot(q, (snapshot) => {
      const ordersData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      ordersData.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      setOrders(ordersData);
      setLoading(false); setRefreshing(false);
    }, (error) => { console.error('Error fetching orders:', error); setLoading(false); setRefreshing(false); });

    // 🔴 โค้ดดึงตัวเลขแจ้งเตือนแบบ Real-time
    const qNotif = query(collection(db, 'notifications'), where('userId', '==', user.uid), where('isRead', '==', false));
    const unsubNotif = onSnapshot(qNotif, (snapshot) => {
        setUnreadCount(snapshot.docs.length);
    });

    return () => { unsubUser(); unsubOrders(); unsubNotif(); };
  }, []);

  const onRefresh = () => { setRefreshing(true); setTimeout(() => { setRefreshing(false); }, 800); };

  const toggleDrawer = () => {
    if (isDrawerOpen) { Animated.timing(slideAnim, { toValue: -width * 0.85, duration: 300, useNativeDriver: true }).start(() => setIsDrawerOpen(false)); }
    else { setIsDrawerOpen(true); Animated.timing(slideAnim, { toValue: 0, duration: 300, useNativeDriver: true }).start(); }
  };

  const handleLogout = async () => { await auth.signOut(); };
  const handleSwitchToStore = () => { toggleDrawer(); if (userData?.currentRole === 'store' || userData?.currentRole === 'admin') { navigation.navigate('MyShop'); } else { navigation.navigate('RegisterStoreStep1'); } };

  const getStatusColor = (status) => {
    switch (status) { case 'completed': return '#059669'; case 'cancelled': return '#dc2626'; case 'pending': return '#d97706'; case 'confirmed': return '#2563eb'; default: return '#6b7280'; }
  };
  const getStatusBgColor = (status) => {
    switch (status) { case 'completed': return '#d1fae5'; case 'cancelled': return '#fee2e2'; case 'pending': return '#fef3c7'; case 'confirmed': return '#dbeafe'; default: return '#f3f4f6'; }
  };
  const getStatusText = (status) => {
    switch (status) { case 'completed': return 'รับของแล้ว'; case 'cancelled': return 'ยกเลิกแล้ว'; case 'pending': return 'รอดำเนินการ'; case 'confirmed': return 'ร้านกำลังเตรียม / จองสำเร็จ'; default: return status; }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const renderOrder = ({ item }) => {
    const statusColor = getStatusColor(item.status), statusBgColor = getStatusBgColor(item.status);
    let displayImage = null;
    if (item.items && item.items.length > 0 && item.items[0].imageUrl) displayImage = item.items[0].imageUrl;
    else if (item.imageUrl) displayImage = item.imageUrl;
    const shortId = item.id.slice(0, 6).toUpperCase(), prefix = item.orderType === 'delivery' ? 'D' : 'P', formattedId = `${prefix}-${shortId}`;

    return (
      <TouchableOpacity style={styles.orderCard} activeOpacity={0.8} onPress={() => navigation.navigate('OrderDetail', { order: item })}>
        <View style={styles.cardHeader}>
          <View style={styles.storeInfo}><Ionicons name="storefront-outline" size={18} color="#4b5563" style={{ marginRight: 6 }} /><Text style={styles.storeName} numberOfLines={1}>{item.storeName || 'ไม่ระบุร้านค้า'}</Text><Ionicons name="chevron-forward" size={14} color="#9ca3af" /></View>
          <View style={[styles.statusBadge, { backgroundColor: statusBgColor }]}><Text style={[styles.statusText, { color: statusColor }]}>{getStatusText(item.status)}</Text></View>
        </View>
        <View style={styles.divider} />
        <View style={styles.cardBody}>
          {displayImage ? (<Image source={{ uri: displayImage }} style={styles.foodImage} />) : (<View style={styles.imagePlaceholder}><Ionicons name="fast-food" size={24} color="#d1d5db" /></View>)}
          <View style={styles.orderInfo}>
            <Text style={styles.foodName} numberOfLines={2}>{item.foodName || 'รายการอาหาร'}</Text><Text style={styles.quantityText}>{item.quantity} รายการ</Text><Text style={styles.dateText}>{formatDate(item.createdAt)}</Text><Text style={styles.orderIdText}>#{formattedId}</Text>
          </View>
          <View style={styles.priceContainer}><Text style={styles.totalLabel}>ราคาสุทธิ</Text><Text style={styles.price}>฿{item.totalPrice}</Text></View>
        </View>
        {item.status === 'completed' && !item.isReviewed && (<View style={styles.pendingReviewBadge}><Ionicons name="star" size={14} color="#d97706" style={{ marginRight: 6 }} /><Text style={styles.pendingReviewText}>รอคุณให้คะแนนรีวิวร้านค้านี้</Text></View>)}
      </TouchableOpacity>
    );
  };

  const DrawerContent = () => (
    <View style={styles.drawerContent}>
      <View style={styles.drawerTopHeader}><View style={styles.logoContainer}><View style={styles.logoCircle}><Ionicons name="leaf" size={20} color="#10b981" /></View><View><Text style={styles.appName}>Food Waste</Text><Text style={styles.appSlogan}>รักษ์โลกด้วยมือเรา</Text></View></View><TouchableOpacity onPress={toggleDrawer} style={styles.closeButton}><Ionicons name="close" size={24} color="#6b7280" /></TouchableOpacity></View>
      <View style={styles.profileCard}>
        <View style={styles.profileHeader}><Image source={userData?.profileImage ? { uri: userData.profileImage } : { uri: defaultAvatar }} style={styles.drawerAvatar} /><View><Text style={styles.drawerName}>{userData?.username || 'User'}</Text><Text style={styles.drawerRole}>ลูกค้า (Customer)</Text></View></View>
        <View style={styles.modeContainer}>
            <TouchableOpacity style={styles.modeButtonActive}><Ionicons name="cart" size={14} color="#fff" /><Text style={styles.modeTextActive}>โหมดลูกค้า</Text></TouchableOpacity>
            <TouchableOpacity style={styles.modeButtonInactive} onPress={handleSwitchToStore}><Ionicons name="storefront-outline" size={14} color="#6b7280" /><Text style={styles.modeTextInactive}>{userData?.currentRole === 'store' || userData?.currentRole === 'admin' ? 'โหมดร้านค้า' : 'สมัครร้านค้า'}</Text></TouchableOpacity>
        </View>
      </View>
      <Text style={styles.sectionTitle}>เมนูหลัก</Text>
      <TouchableOpacity style={styles.drawerMenuItem} onPress={() => { toggleDrawer(); navigation.navigate('Home'); }}><View style={styles.menuIconBox}><Ionicons name="home-outline" size={20} color="#10b981" /></View><Text style={styles.drawerMenuText}>หน้าหลัก</Text><Ionicons name="chevron-forward" size={18} color="#d1d5db" style={{marginLeft: 'auto'}} /></TouchableOpacity>
      <TouchableOpacity style={styles.drawerMenuItem} onPress={() => toggleDrawer()}><View style={styles.menuIconBox}><Ionicons name="receipt-outline" size={20} color="#f59e0b" /></View><Text style={styles.drawerMenuText}>คำสั่งซื้อของฉัน</Text><Ionicons name="chevron-forward" size={18} color="#d1d5db" style={{marginLeft: 'auto'}} /></TouchableOpacity>
      <TouchableOpacity style={styles.drawerMenuItem} onPress={() => { toggleDrawer(); navigation.navigate('FavoriteStores'); }}><View style={styles.menuIconBox}><Ionicons name="heart-outline" size={20} color="#ef4444" /></View><Text style={styles.drawerMenuText}>ร้านโปรด</Text><Ionicons name="chevron-forward" size={18} color="#d1d5db" style={{marginLeft: 'auto'}} /></TouchableOpacity>
      <TouchableOpacity style={styles.drawerMenuItem} onPress={() => { toggleDrawer(); navigation.navigate('Notifications'); }}><View style={styles.menuIconBox}><Ionicons name="notifications-outline" size={20} color="#3b82f6" /></View><Text style={styles.drawerMenuText}>แจ้งเตือน</Text><Ionicons name="chevron-forward" size={18} color="#d1d5db" style={{marginLeft: 'auto'}} /></TouchableOpacity>
      <Text style={styles.sectionTitle}>บัญชี</Text>
      <TouchableOpacity style={styles.drawerMenuItem} onPress={() => { toggleDrawer(); navigation.navigate('Profile'); }}><View style={styles.menuIconBox}><Ionicons name="person-outline" size={20} color="#6366f1" /></View><Text style={styles.drawerMenuText}>โปรไฟล์</Text><Ionicons name="chevron-forward" size={18} color="#d1d5db" style={{marginLeft: 'auto'}} /></TouchableOpacity>
      <TouchableOpacity style={styles.drawerLogout} onPress={handleLogout}><View style={[styles.menuIconBox, { backgroundColor: '#fee2e2' }]}><Ionicons name="log-out-outline" size={20} color="#ef4444" /></View><Text style={styles.drawerLogoutText}>ออกจากระบบ</Text></TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      <View style={styles.header}>
        <View style={styles.headerLeft}>
            <TouchableOpacity style={styles.menuButton} onPress={toggleDrawer}><Ionicons name="menu" size={30} color="#1f2937" /></TouchableOpacity>
            <Text style={styles.headerTitle}>รายการคำสั่งซื้อ</Text>
        </View>
        <TouchableOpacity onPress={() => navigation.navigate('Profile')}><Image source={userData?.profileImage ? { uri: userData.profileImage } : { uri: defaultAvatar }} style={styles.avatar} /></TouchableOpacity>
      </View>

      {loading ? (<ActivityIndicator size="large" color="#10b981" style={{marginTop: 50}} />) : orders.length > 0 ? (
        <FlatList data={orders} renderItem={renderOrder} keyExtractor={item => item.id} contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />} />
      ) : (<View style={styles.emptyState}><Ionicons name="receipt-outline" size={80} color="#e5e7eb" /><Text style={styles.emptyText}>ยังไม่มีคำสั่งซื้อ</Text><Text style={styles.emptySubText}>คุณสามารถเลือกซื้ออาหารราคาพิเศษเพื่อช่วยลดขยะอาหารได้เลย!</Text></View>)}

      {/* 🔴 แถบเมนูด้านล่าง อัปเดตแจ้งเตือนแล้ว */}
      <View style={styles.bottomNav}>
        <TouchableOpacity style={styles.navItem} onPress={() => navigation.navigate('Home')}><Ionicons name="home-outline" size={24} color="#9ca3af" /><Text style={styles.navLabel}>หน้าหลัก</Text></TouchableOpacity>
        <TouchableOpacity style={styles.navItem}><Ionicons name="receipt" size={24} color="#10b981" /><Text style={styles.navLabelActive}>ออเดอร์</Text></TouchableOpacity>

        <TouchableOpacity style={styles.navItem} onPress={() => navigation.navigate('Notifications')}>
          <View style={{ position: 'relative' }}>
            <Ionicons name="notifications-outline" size={24} color="#9ca3af" />
            {unreadCount > 0 && (
              <View style={styles.notificationBadge}>
                <Text style={styles.notificationBadgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
              </View>
            )}
          </View>
          <Text style={styles.navLabel}>แจ้งเตือน</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.navItem} onPress={() => navigation.navigate('Profile')}><Ionicons name="person-outline" size={24} color="#9ca3af" /><Text style={styles.navLabel}>โปรไฟล์</Text></TouchableOpacity>
      </View>

      {isDrawerOpen && (<Modal transparent visible={isDrawerOpen} animationType="none"><View style={styles.drawerOverlay}><TouchableWithoutFeedback onPress={toggleDrawer}><View style={styles.drawerBackdrop} /></TouchableWithoutFeedback><Animated.View style={[styles.drawerContainer, { transform: [{ translateX: slideAnim }] }]}><DrawerContent /></Animated.View></View></Modal>)}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: Platform.OS === 'ios' ? 60 : 60, paddingBottom: 15, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f3f4f6', zIndex: 10 },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 15 },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#1f2937' },
  menuButton: { padding: 4, marginLeft: -4 },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#f3f4f6', borderWidth: 1, borderColor: '#e5e7eb' },
  listContent: { padding: 15, paddingBottom: 100 },
  orderCard: { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 15, borderWidth: 1, borderColor: '#f3f4f6', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 5, elevation: 2 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  storeInfo: { flexDirection: 'row', alignItems: 'center', flex: 1, paddingRight: 10 },
  storeName: { fontSize: 15, fontWeight: 'bold', color: '#1f2937' },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  statusText: { fontSize: 12, fontWeight: 'bold' },
  divider: { height: 1, backgroundColor: '#f3f4f6', marginBottom: 12 },
  cardBody: { flexDirection: 'row', alignItems: 'center' },
  foodImage: { width: 60, height: 60, borderRadius: 10, backgroundColor: '#f3f4f6', marginRight: 15 },
  imagePlaceholder: { width: 60, height: 60, borderRadius: 10, backgroundColor: '#f3f4f6', alignItems: 'center', justifyContent: 'center', marginRight: 15 },
  orderInfo: { flex: 1, justifyContent: 'center' },
  foodName: { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 4 },
  quantityText: { fontSize: 12, color: '#6b7280', marginBottom: 4 },
  dateText: { fontSize: 11, color: '#9ca3af', marginBottom: 2 },
  orderIdText: { fontSize: 10, color: '#d1d5db' },
  priceContainer: { alignItems: 'flex-end', justifyContent: 'center', paddingLeft: 10 },
  totalLabel: { fontSize: 11, color: '#6b7280', marginBottom: 2 },
  price: { fontSize: 16, fontWeight: 'bold', color: '#10b981' },
  pendingReviewBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fffbeb', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, marginTop: 15, borderWidth: 1, borderColor: '#fef3c7' },
  pendingReviewText: { fontSize: 12, color: '#d97706', fontWeight: '600' },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', marginTop: 80, paddingHorizontal: 40 },
  emptyText: { fontSize: 18, fontWeight: 'bold', color: '#4b5563', marginTop: 15, marginBottom: 8 },
  emptySubText: { fontSize: 14, color: '#9ca3af', textAlign: 'center', lineHeight: 20 },
  bottomNav: { flexDirection: 'row', backgroundColor: '#fff', paddingVertical: 10, paddingHorizontal: 20, borderTopWidth: 1, borderTopColor: '#f3f4f6', position: 'absolute', bottom: 0, left: 0, right: 0 },
  navItem: { flex: 1, alignItems: 'center' },
  navLabel: { fontSize: 10, color: '#9ca3af', marginTop: 4 },
  navLabelActive: { fontSize: 10, color: '#10b981', fontWeight: 'bold', marginTop: 4 },
  drawerOverlay: { flex: 1, flexDirection: 'row' },
  drawerBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  drawerContainer: { position: 'absolute', left: 0, top: 0, bottom: 0, width: width * 0.80, backgroundColor: '#fff', paddingTop: Platform.OS === 'ios' ? 50 : 30, shadowColor: "#000", shadowOffset: { width: 2, height: 0 }, shadowOpacity: 0.25, shadowRadius: 3.84, elevation: 5 },
  drawerContent: { flex: 1, paddingHorizontal: 20 },
  drawerTopHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
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

  // 🔴 เพิ่ม CSS จุดแดงแจ้งเตือน
  notificationBadge: { position: 'absolute', top: -4, right: -6, backgroundColor: '#ef4444', borderRadius: 10, minWidth: 18, height: 18, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#fff', paddingHorizontal: 4, zIndex: 5 },
  notificationBadgeText: { color: '#fff', fontSize: 10, fontWeight: 'bold' }
});