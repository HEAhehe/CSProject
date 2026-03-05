import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, Platform, StatusBar, RefreshControl, Image,
  Animated, Dimensions, Modal, TouchableWithoutFeedback, ScrollView
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { auth, db } from '../../firebase.config';
import { collection, query, where, getDocs, orderBy, updateDoc, doc, onSnapshot, getDoc } from 'firebase/firestore';

const { width } = Dimensions.get('window');

export default function NotificationsScreen({ navigation }) {
  const [notifications, setNotifications] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState('all');

  const [userData, setUserData] = useState(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const slideAnim = useRef(new Animated.Value(-width * 0.85)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const defaultAvatar = Image.resolveAssetSource(require('../../assets/icon.png')).uri;

  useEffect(() => {
    const user = auth.currentUser;
    if (user) {
      const unsubscribe = onSnapshot(doc(db, 'users', user.uid), (docSnap) => {
        if (docSnap.exists()) {
          setUserData(docSnap.data());
        }
      });
      return () => unsubscribe();
    }
  }, []);

  useEffect(() => {
    loadNotifications();
  }, []);

  const loadNotifications = async () => {
    try {
      const user = auth.currentUser;
      if (user) {
        const q = query(
          collection(db, 'notifications'),
          where('userId', '==', user.uid),
          orderBy('createdAt', 'desc')
        );

        const querySnapshot = await getDocs(q);
        const items = [];
        querySnapshot.forEach((docSnap) => {
          items.push({ id: docSnap.id, ...docSnap.data() });
        });

        await Promise.all(items.map(async (item) => {
          if (item.orderId) {
            try {
              const orderSnap = await getDoc(doc(db, 'orders', item.orderId));
              if (orderSnap.exists()) {
                const orderData = orderSnap.data();
                item.orderType = orderData.orderType;
                // 🟢 ดึงข้อมูลสถานะการรีวิวมาเก็บไว้ใน item แจ้งเตือนด้วย
                item.isReviewed = orderData.isReviewed || false;
              }
            } catch (e) {
              console.log("Error fetching order type for notification", e);
            }
          }
        }));

        setNotifications(items);
      }
    } catch (error) { console.error('Error loading notifications:', error); }
  };

  const onRefresh = async () => { setRefreshing(true); await loadNotifications(); setRefreshing(false); };

  const markAsRead = async (notificationId) => {
    try {
      await updateDoc(doc(db, 'notifications', notificationId), { isRead: true });
      setNotifications(prev => prev.map(notif => notif.id === notificationId ? { ...notif, isRead: true } : notif));
    } catch (error) { console.error('Error marking notification as read:', error); }
  };

  const toggleDrawer = () => {
    if (isDrawerOpen) { Animated.parallel([Animated.timing(slideAnim, { toValue: -width * 0.85, duration: 300, useNativeDriver: true }), Animated.timing(fadeAnim, { toValue: 0, duration: 300, useNativeDriver: true })]).start(() => setIsDrawerOpen(false)); }
    else { setIsDrawerOpen(true); Animated.parallel([Animated.timing(slideAnim, { toValue: 0, duration: 300, useNativeDriver: true }), Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true })]).start(); }
  };

  const handleLogout = async () => { await auth.signOut(); };
  const handleSwitchToStore = () => { toggleDrawer(); if (userData?.currentRole === 'store' || userData?.currentRole === 'admin') { navigation.navigate('MyShop'); } else { navigation.navigate('RegisterStoreStep1'); } };

  const DrawerContent = () => (
    <View style={styles.drawerWrapper}>
      <ScrollView style={styles.drawerContent} showsVerticalScrollIndicator={false}>
        <View style={styles.drawerTopHeader}>
           <View style={styles.logoContainer}><View style={styles.logoCircle}><Ionicons name="leaf" size={20} color="#10b981" /></View><View><Text style={styles.appName}>Food Waste</Text><Text style={styles.appSlogan}>รักษ์โลกด้วยมือเรา</Text></View></View>
           <TouchableOpacity onPress={toggleDrawer} style={styles.closeButton}><Ionicons name="close" size={24} color="#6b7280" /></TouchableOpacity>
        </View>
        <View style={styles.profileCard}>
          <View style={styles.profileHeader}><Image source={userData?.profileImage ? { uri: userData.profileImage } : { uri: defaultAvatar }} style={styles.drawerAvatar} /><View><Text style={styles.drawerName}>{userData?.username || 'User'}</Text><Text style={styles.drawerRole}>โหมด: ลูกค้า</Text></View></View>
          <View style={styles.modeContainer}>
              <TouchableOpacity style={styles.modeButtonActive}><Ionicons name="cart" size={14} color="#fff" /><Text style={styles.modeTextActive}>โหมดลูกค้า</Text></TouchableOpacity>
              <TouchableOpacity style={styles.modeButtonInactive} onPress={handleSwitchToStore}><Ionicons name="storefront-outline" size={14} color="#6b7280" /><Text style={styles.modeTextInactive}>{userData?.currentRole === 'store' ? 'โหมดร้านค้า' : 'สมัครร้านค้า'}</Text></TouchableOpacity>
          </View>
        </View>
        <Text style={styles.sectionTitle}>เมนูหลัก</Text>
        <TouchableOpacity style={styles.drawerMenuItem} onPress={() => { toggleDrawer(); navigation.navigate('Home'); }}><View style={styles.menuIconBox}><Ionicons name="home-outline" size={20} color="#10b981" /></View><Text style={styles.drawerMenuText}>หน้าหลัก</Text><Ionicons name="chevron-forward" size={18} color="#d1d5db" style={{marginLeft: 'auto'}} /></TouchableOpacity>
        <TouchableOpacity style={styles.drawerMenuItem} onPress={() => { toggleDrawer(); navigation.navigate('Orders'); }}><View style={styles.menuIconBox}><Ionicons name="receipt-outline" size={20} color="#f59e0b" /></View><Text style={styles.drawerMenuText}>คำสั่งซื้อของฉัน</Text><Ionicons name="chevron-forward" size={18} color="#d1d5db" style={{marginLeft: 'auto'}} /></TouchableOpacity>
        <TouchableOpacity style={styles.drawerMenuItem} onPress={() => { toggleDrawer(); navigation.navigate('FavoriteStores'); }}><View style={styles.menuIconBox}><Ionicons name="heart-outline" size={20} color="#ef4444" /></View><Text style={styles.drawerMenuText}>ร้านโปรด</Text><Ionicons name="chevron-forward" size={18} color="#d1d5db" style={{marginLeft: 'auto'}} /></TouchableOpacity>
        <TouchableOpacity style={styles.drawerMenuItem} onPress={() => toggleDrawer()}><View style={styles.menuIconBox}><Ionicons name="notifications-outline" size={20} color="#3b82f6" /></View><Text style={styles.drawerMenuText}>แจ้งเตือน</Text><Ionicons name="chevron-forward" size={18} color="#d1d5db" style={{marginLeft: 'auto'}} /></TouchableOpacity>
        <Text style={styles.sectionTitle}>บัญชี</Text>
        <TouchableOpacity style={styles.drawerMenuItem} onPress={() => { toggleDrawer(); navigation.navigate('Profile'); }}><View style={styles.menuIconBox}><Ionicons name="person-outline" size={20} color="#6366f1" /></View><Text style={styles.drawerMenuText}>โปรไฟล์</Text><Ionicons name="chevron-forward" size={18} color="#d1d5db" style={{marginLeft: 'auto'}} /></TouchableOpacity>
        <TouchableOpacity style={styles.drawerLogout} onPress={handleLogout}><View style={[styles.menuIconBox, { backgroundColor: '#fee2e2' }]}><Ionicons name="log-out-outline" size={20} color="#ef4444" /></View><Text style={styles.drawerLogoutText}>ออกจากระบบ</Text></TouchableOpacity>
        <View style={{height: 50}} />
      </ScrollView>
    </View>
  );

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'order_confirmed': return { name: 'restaurant', color: '#3b82f6', bg: '#dbeafe' };
      case 'order_completed': return { name: 'checkmark-circle', color: '#10b981', bg: '#dcfce7' };
      case 'order_cancelled': return { name: 'close-circle', color: '#ef4444', bg: '#fee2e2' };
      case 'store_approved': return { name: 'storefront', color: '#10b981', bg: '#dcfce7' };
      case 'store_rejected': return { name: 'warning', color: '#ef4444', bg: '#fee2e2' };
      case 'new_food_item': return { name: 'fast-food', color: '#f59e0b', bg: '#fef3c7' };
      case 'promo': return { name: 'flash', color: '#f59e0b', bg: '#fef3c7' };
      default: return { name: 'notifications', color: '#6b7280', bg: '#f3f4f6' };
    }
  };

  const getTimeAgo = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString), diffTime = Math.abs(new Date() - date), diffMinutes = Math.floor(diffTime / 60000);
    if (diffMinutes < 1) return 'เมื่อสักครู่';
    if (diffMinutes < 60) return `${diffMinutes} นาทีที่แล้ว`;
    const diffHours = Math.floor(diffTime / 3600000);
    if (diffHours < 24) return `${diffHours} ชั่วโมงที่แล้ว`;
    return date.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' });
  };

  const formatOrderId = (orderId, orderType) => {
    if (!orderId) return '';
    const shortId = orderId.slice(0, 6).toUpperCase();
    if (orderType === 'delivery') return `D-${shortId}`;
    if (orderType === 'pickup') return `P-${shortId}`;
    return shortId;
  };

  const filteredNotifications = notifications.filter(notif => {
    if (filter === 'all') return true;
    if (filter === 'unread') return !notif.isRead;
    if (filter === 'read') return notif.isRead;
    return true;
  });

  const unreadCount = notifications.filter(n => !n.isRead).length;

  const renderFormattedMessage = (item) => {
    if (item.type === 'order_confirmed') {
      let overrideMsg = 'ร้านกำลังเตรียมอาหารให้คุณ 🍳';
      if (item.orderType === 'delivery') overrideMsg = 'ร้านกำลังเตรียมอาหาร และจะดำเนินการจัดส่งให้คุณ 🛵';
      if (item.orderType === 'pickup') overrideMsg = 'ร้านกำลังเตรียมอาหาร แวะมารับที่หน้าร้านได้เลย 🛍️';
      return <Text style={styles.notificationMessage} numberOfLines={1}>{overrideMsg}</Text>;
    }

    let msg = item.message || '';

    if (item.orderId) {
      const shortId = item.orderId.slice(0, 6).toUpperCase();
      msg = msg.replace(new RegExp(`ออเดอร์\\s*#?${shortId}\\s*`, 'g'), '');
      msg = msg.replace(new RegExp(`ออเดอร์\\s*#?${shortId}\\s*`, 'g'), '');
      msg = msg.replace(new RegExp(`#?${shortId}\\s*`, 'g'), '');
    }

    // ✅ ฟังก์ชันอัจฉริยะแบบเดียวกับหน้ารายละเอียด
    const matchParens = msg.match(/\((?:เหตุผล|สาเหตุ):\s*(.*?)\)/);
    const matchNoParens = msg.match(/(?:เหตุผล|สาเหตุ):\s*(.*)/);

    let reasonText = null;
    let mainText = msg;

    if (matchParens && matchParens[1]) {
        reasonText = matchParens[1].trim();
        mainText = msg.replace(matchParens[0], '').trim();
    } else if (matchNoParens && matchNoParens[1]) {
        reasonText = matchNoParens[1].replace(/กรุณา.*/, '').trim().replace(/\)$/, '');
        mainText = msg.replace(matchNoParens[0], '').trim();
    }

    if (reasonText) {
       if (item.type === 'order_cancelled' || item.type === 'store_rejected') {
           return (
             <Text style={styles.reasonHighlightText} numberOfLines={1}>
                สาเหตุ: {reasonText}
             </Text>
           );
       }
       return (
         <View>
           {mainText !== '' && <Text style={styles.notificationMessage} numberOfLines={1}>{mainText}</Text>}
           <Text style={styles.reasonHighlightText} numberOfLines={1}>เหตุผล: {reasonText}</Text>
         </View>
       );
    }

    return <Text style={styles.notificationMessage} numberOfLines={1}>{msg.trim()}</Text>;
  };

  const renderNotification = ({ item }) => {
    const icon = getNotificationIcon(item.type);
    return (
      <TouchableOpacity
        style={[styles.notificationCard, !item.isRead && styles.notificationCardUnread]}
        onPress={() => {
          markAsRead(item.id);
          navigation.navigate('NotificationDetail', { notification: item });
        }}
        activeOpacity={0.7}
      >
        <View style={[styles.iconContainer, { backgroundColor: icon.bg }]}><Ionicons name={icon.name} size={24} color={icon.color} /></View>
        <View style={styles.notificationContent}>
          <View style={styles.notificationHeader}>
            <Text style={styles.notificationTitle} numberOfLines={1}>{item.title}</Text>
            {!item.isRead && <View style={styles.unreadDot} />}
          </View>

          {renderFormattedMessage(item)}

          <View style={styles.notificationFooter}>
            {item.orderId ? (
              <View style={styles.badgeRow}>
                <View style={styles.orderIdBadge}>
                  <Ionicons name="receipt-outline" size={10} color="#6b7280" style={{marginRight: 4}} />
                  <Text style={styles.orderIdText}>#{formatOrderId(item.orderId, item.orderType)}</Text>
                </View>

                {item.orderType && (
                  <View style={[styles.typeBadge, item.orderType === 'delivery' ? styles.badgeDelivery : styles.badgePickup]}>
                    <Ionicons name={item.orderType === 'delivery' ? 'bicycle' : 'storefront'} size={10} color={item.orderType === 'delivery' ? '#0284c7' : '#10b981'} style={{marginRight: 4}} />
                    <Text style={[styles.typeText, item.orderType === 'delivery' ? styles.textDelivery : styles.textPickup]}>
                      {item.orderType === 'delivery' ? 'จัดส่ง' : 'รับที่ร้าน'}
                    </Text>
                  </View>
                )}

                {/* 🟢 ป้ายเตือนว่า "ยังไม่ได้รีวิว" */}
                {item.type === 'order_completed' && item.isReviewed === false && (
                  <View style={[styles.typeBadge, { backgroundColor: '#fef3c7', borderColor: '#fde68a' }]}>
                    <Ionicons name="star" size={10} color="#d97706" style={{marginRight: 4}} />
                    <Text style={[styles.typeText, { color: '#d97706' }]}>
                      ยังไม่รีวิว
                    </Text>
                  </View>
                )}
              </View>
            ) : (
              <View style={{ flex: 1 }} />
            )}
            <Text style={styles.notificationTime}>{getTimeAgo(item.createdAt)}</Text>
          </View>

        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      <View style={styles.header}>
        <View style={styles.headerLeft}><TouchableOpacity style={styles.menuButton} onPress={toggleDrawer}><Ionicons name="menu" size={30} color="#1f2937" /></TouchableOpacity><Text style={styles.headerTitle}>การแจ้งเตือน</Text></View>
        <TouchableOpacity onPress={() => navigation.navigate('Profile')}><Image source={userData?.profileImage ? { uri: userData.profileImage } : { uri: defaultAvatar }} style={styles.avatar} /></TouchableOpacity>
      </View>

      <View style={styles.filterContainer}>
        <TouchableOpacity style={[styles.filterTab, filter === 'all' && styles.filterTabActive]} onPress={() => setFilter('all')}><Text style={[styles.filterText, filter === 'all' && styles.filterTextActive]}>ทั้งหมด</Text></TouchableOpacity>
        <TouchableOpacity style={[styles.filterTab, filter === 'unread' && styles.filterTabActive]} onPress={() => setFilter('unread')}><Text style={[styles.filterText, filter === 'unread' && styles.filterTextActive]}>ยังไม่อ่าน</Text></TouchableOpacity>
        <TouchableOpacity style={[styles.filterTab, filter === 'read' && styles.filterTabActive]} onPress={() => setFilter('read')}><Text style={[styles.filterText, filter === 'read' && styles.filterTextActive]}>อ่านแล้ว</Text></TouchableOpacity>
      </View>

      {filteredNotifications.length > 0 ? (
        <FlatList data={filteredNotifications} renderItem={renderNotification} keyExtractor={(item) => item.id} contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />} />
      ) : (<View style={styles.emptyState}><Ionicons name="notifications-off-outline" size={80} color="#d1d5db" /><Text style={styles.emptyText}>ไม่มีการแจ้งเตือน</Text></View>)}

      <View style={styles.bottomNav}>
        <TouchableOpacity style={styles.navItem} onPress={() => navigation.navigate('Home')}><Ionicons name="home-outline" size={24} color="#9ca3af" /><Text style={styles.navLabel}>หน้าหลัก</Text></TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={() => navigation.navigate('Orders')}><Ionicons name="receipt-outline" size={24} color="#9ca3af" /><Text style={styles.navLabel}>ออเดอร์</Text></TouchableOpacity>

        <TouchableOpacity style={styles.navItem}>
          <View style={{ position: 'relative' }}>
            <Ionicons name="notifications" size={24} color="#10b981" />
            {unreadCount > 0 && (
              <View style={styles.notificationBadge}>
                <Text style={styles.notificationBadgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
              </View>
            )}
          </View>
          <Text style={styles.navLabelActive}>แจ้งเตือน</Text>
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
  filterContainer: { flexDirection: 'row', paddingHorizontal: 20, paddingVertical: 15, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  filterTab: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, marginRight: 8, backgroundColor: '#f9fafb', borderWidth: 1, borderColor: '#e5e7eb' },
  filterTabActive: { backgroundColor: '#1f2937', borderColor: '#1f2937' },
  filterText: { fontSize: 13, color: '#6b7280', fontWeight: '500' },
  filterTextActive: { color: '#fff', fontWeight: 'bold' },

  listContent: { padding: 16, paddingBottom: 100 },
  notificationCard: { flexDirection: 'column', backgroundColor: '#fff', padding: 12, borderRadius: 16, marginBottom: 12, borderWidth: 1, borderColor: '#f3f4f6', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  notificationCardUnread: { backgroundColor: '#f0fdf4', borderColor: '#dcfce7' },
  iconContainer: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', position: 'absolute', top: 12, left: 12 },
  notificationContent: { flex: 1, marginLeft: 52, justifyContent: 'center' },
  notificationHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 2 },
  notificationTitle: { flex: 1, fontSize: 14, fontWeight: 'bold', color: '#1f2937' },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#ef4444', marginLeft: 8 },

  notificationMessage: { fontSize: 13, color: '#4b5563', lineHeight: 20 },
  reasonHighlightText: { fontSize: 13, color: '#ef4444', fontWeight: '500', marginTop: 2 },

  notificationFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  orderIdBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f9fafb', paddingHorizontal: 6, paddingVertical: 3, borderRadius: 6, borderWidth: 1, borderColor: '#e5e7eb' },
  orderIdText: { fontSize: 10, fontWeight: 'bold', color: '#4b5563' },
  typeBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 6, paddingVertical: 3, borderRadius: 6, borderWidth: 1 },
  badgeDelivery: { backgroundColor: '#e0f2fe', borderColor: '#bae6fd' },
  badgePickup: { backgroundColor: '#dcfce7', borderColor: '#bbf7d0' },
  typeText: { fontSize: 10, fontWeight: 'bold' },
  textDelivery: { color: '#0284c7' },
  textPickup: { color: '#10b981' },

  notificationTime: { fontSize: 11, color: '#9ca3af', fontWeight: '500' },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', marginTop: 80 },
  emptyText: { fontSize: 16, fontWeight: '600', color: '#9ca3af', marginTop: 15 },
  bottomNav: { flexDirection: 'row', backgroundColor: '#fff', paddingVertical: 10, paddingHorizontal: 20, borderTopWidth: 1, borderTopColor: '#f3f4f6', position: 'absolute', bottom: 0, left: 0, right: 0 },
  navItem: { flex: 1, alignItems: 'center' },
  navLabel: { fontSize: 10, color: '#9ca3af', marginTop: 4 },
  navLabelActive: { fontSize: 10, color: '#10b981', fontWeight: 'bold', marginTop: 4 },
  drawerOverlay: { flex: 1, flexDirection: 'row' },
  drawerBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  drawerContainer: { position: 'absolute', left: 0, top: 0, bottom: 0, width: width * 0.80, backgroundColor: '#fff', shadowColor: "#000", shadowOffset: { width: 2, height: 0 }, shadowOpacity: 0.25, shadowRadius: 3.84, elevation: 5 },
  drawerWrapper: { flex: 1, paddingTop: Platform.OS === 'ios' ? 30 : 30 },
  drawerContent: { flex: 1, paddingHorizontal: 20 },
  drawerTopHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
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
  notificationBadge: { position: 'absolute', top: -4, right: -6, backgroundColor: '#ef4444', borderRadius: 10, minWidth: 18, height: 18, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#fff', paddingHorizontal: 4, zIndex: 5 },
  notificationBadgeText: { color: '#fff', fontSize: 10, fontWeight: 'bold' }
});