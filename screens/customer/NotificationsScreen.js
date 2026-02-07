import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Platform,
  StatusBar,
  RefreshControl,
  Image,
  Animated,
  Dimensions,
  Modal,
  TouchableWithoutFeedback
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { auth, db } from '../../firebase.config';
import { collection, query, where, getDocs, orderBy, updateDoc, doc, onSnapshot } from 'firebase/firestore';

const { width } = Dimensions.get('window');

export default function NotificationsScreen({ navigation }) {
  const [notifications, setNotifications] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState('all'); // all, unread, read

  // State สำหรับ User และ Drawer
  const [userData, setUserData] = useState(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const slideAnim = useRef(new Animated.Value(-width * 0.85)).current;

  const defaultAvatar = Image.resolveAssetSource(require('../../assets/icon.png')).uri;

  // 1. โหลดข้อมูล User เรียลไทม์
  useEffect(() => {
    const user = auth.currentUser;
    if (user) {
      const unsubscribe = onSnapshot(doc(db, 'users', user.uid), (doc) => {
        if (doc.exists()) {
          setUserData(doc.data());
        }
      });
      return () => unsubscribe();
    }
  }, []);

  // 2. โหลดแจ้งเตือน
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
        querySnapshot.forEach((doc) => {
          items.push({ id: doc.id, ...doc.data() });
        });

        setNotifications(items);
      }
    } catch (error) {
      console.error('Error loading notifications:', error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadNotifications();
    setRefreshing(false);
  };

  const markAsRead = async (notificationId) => {
    try {
      await updateDoc(doc(db, 'notifications', notificationId), { isRead: true });
      loadNotifications();
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  // --- Drawer Logic ---
  const toggleDrawer = () => {
    if (isDrawerOpen) {
      Animated.timing(slideAnim, { toValue: -width * 0.85, duration: 300, useNativeDriver: true }).start(() => setIsDrawerOpen(false));
    } else {
      setIsDrawerOpen(true);
      Animated.timing(slideAnim, { toValue: 0, duration: 300, useNativeDriver: true }).start();
    }
  };

  const handleLogout = async () => {
    await auth.signOut();
  };

  // --- Drawer Content ---
  const DrawerContent = () => (
    <View style={styles.drawerContent}>
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
          <View><Text style={styles.drawerName}>{userData?.username || 'User'}</Text><Text style={styles.drawerRole}>ลูกค้า (Customer)</Text></View>
        </View>
        <View style={styles.modeContainer}>
            <TouchableOpacity style={styles.modeButtonActive}><Ionicons name="cart" size={14} color="#fff" /><Text style={styles.modeTextActive}>ลูกค้า</Text></TouchableOpacity>
            <TouchableOpacity style={styles.modeButtonInactive} onPress={() => { toggleDrawer(); navigation.navigate('RegisterStoreStep1'); }}><Ionicons name="storefront-outline" size={14} color="#6b7280" /><Text style={styles.modeTextInactive}>ร้านค้า</Text></TouchableOpacity>
        </View>
      </View>

      <Text style={styles.sectionTitle}>เมนูหลัก</Text>
      <TouchableOpacity style={styles.drawerMenuItem} onPress={() => { toggleDrawer(); navigation.navigate('Home'); }}>
        <View style={styles.menuIconBox}><Ionicons name="home-outline" size={20} color="#10b981" /></View><Text style={styles.drawerMenuText}>หน้าหลัก</Text><Ionicons name="chevron-forward" size={18} color="#d1d5db" style={{marginLeft: 'auto'}} />
      </TouchableOpacity>
      <TouchableOpacity style={styles.drawerMenuItem} onPress={() => { toggleDrawer(); navigation.navigate('Orders'); }}>
        <View style={styles.menuIconBox}><Ionicons name="receipt-outline" size={20} color="#f59e0b" /></View><Text style={styles.drawerMenuText}>คำสั่งซื้อของฉัน</Text><Ionicons name="chevron-forward" size={18} color="#d1d5db" style={{marginLeft: 'auto'}} />
      </TouchableOpacity>
      <TouchableOpacity style={styles.drawerMenuItem} onPress={() => { toggleDrawer(); navigation.navigate('FavoriteStores'); }}>
        <View style={styles.menuIconBox}><Ionicons name="heart-outline" size={20} color="#ef4444" /></View><Text style={styles.drawerMenuText}>ร้านโปรด</Text><Ionicons name="chevron-forward" size={18} color="#d1d5db" style={{marginLeft: 'auto'}} />
      </TouchableOpacity>
      <TouchableOpacity style={styles.drawerMenuItem} onPress={() => toggleDrawer()}>
        <View style={styles.menuIconBox}><Ionicons name="notifications-outline" size={20} color="#3b82f6" /></View><Text style={styles.drawerMenuText}>แจ้งเตือน</Text><Ionicons name="chevron-forward" size={18} color="#d1d5db" style={{marginLeft: 'auto'}} />
      </TouchableOpacity>

      <Text style={styles.sectionTitle}>บัญชี</Text>
      <TouchableOpacity style={styles.drawerMenuItem} onPress={() => { toggleDrawer(); navigation.navigate('Profile'); }}>
        <View style={styles.menuIconBox}><Ionicons name="person-outline" size={20} color="#6366f1" /></View><Text style={styles.drawerMenuText}>โปรไฟล์</Text><Ionicons name="chevron-forward" size={18} color="#d1d5db" style={{marginLeft: 'auto'}} />
      </TouchableOpacity>
      <TouchableOpacity style={styles.drawerLogout} onPress={handleLogout}>
        <View style={[styles.menuIconBox, { backgroundColor: '#fee2e2' }]}><Ionicons name="log-out-outline" size={20} color="#ef4444" /></View><Text style={styles.drawerLogoutText}>ออกจากระบบ</Text>
      </TouchableOpacity>
    </View>
  );

  // --- Helpers for Notifications ---
  const getNotificationIcon = (type) => {
    switch (type) {
      case 'expiry_warning': return { name: 'warning', color: '#f59e0b', bg: '#fef3c7' };
      case 'donation_request': return { name: 'heart', color: '#ef4444', bg: '#fee2e2' };
      case 'donation_accepted': return { name: 'checkmark-circle', color: '#10b981', bg: '#dcfce7' };
      case 'message': return { name: 'chatbubble', color: '#3b82f6', bg: '#dbeafe' };
      default: return { name: 'notifications', color: '#6b7280', bg: '#f3f4f6' };
    }
  };

  const getTimeAgo = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now - date);
    const diffMinutes = Math.ceil(diffTime / (1000 * 60));
    if (diffMinutes < 60) return `${diffMinutes} นาทีที่แล้ว`;
    const diffHours = Math.ceil(diffTime / (1000 * 60 * 60));
    if (diffHours < 24) return `${diffHours} ชั่วโมงที่แล้ว`;
    return date.toLocaleDateString('th-TH');
  };

  const filteredNotifications = notifications.filter(notif => {
    if (filter === 'all') return true;
    if (filter === 'unread') return !notif.isRead;
    if (filter === 'read') return notif.isRead;
    return true;
  });

  const renderNotification = ({ item }) => {
    const icon = getNotificationIcon(item.type);
    return (
      <TouchableOpacity
        style={[styles.notificationCard, !item.isRead && styles.notificationCardUnread]}
        onPress={() => markAsRead(item.id)}
        activeOpacity={0.7}
      >
        <View style={[styles.iconContainer, { backgroundColor: icon.bg }]}>
          <Ionicons name={icon.name} size={24} color={icon.color} />
        </View>
        <View style={styles.notificationContent}>
          <View style={styles.notificationHeader}>
            <Text style={styles.notificationTitle} numberOfLines={1}>{item.title}</Text>
            {!item.isRead && <View style={styles.unreadDot} />}
          </View>
          <Text style={styles.notificationMessage} numberOfLines={2}>{item.message}</Text>
          <Text style={styles.notificationTime}>{getTimeAgo(item.createdAt)}</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color="#d1d5db" />
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      {/* Header Updated */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
            <TouchableOpacity style={styles.menuButton} onPress={toggleDrawer}>
                <Ionicons name="menu" size={30} color="#1f2937" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>การแจ้งเตือน</Text>
        </View>
        <TouchableOpacity onPress={() => navigation.navigate('Profile')}>
           <Image
             source={userData?.profileImage ? { uri: userData.profileImage } : { uri: defaultAvatar }}
             style={styles.avatar}
           />
        </TouchableOpacity>
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterContainer}>
        <TouchableOpacity style={[styles.filterTab, filter === 'all' && styles.filterTabActive]} onPress={() => setFilter('all')}>
          <Text style={[styles.filterText, filter === 'all' && styles.filterTextActive]}>ทั้งหมด</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.filterTab, filter === 'unread' && styles.filterTabActive]} onPress={() => setFilter('unread')}>
          <Text style={[styles.filterText, filter === 'unread' && styles.filterTextActive]}>ยังไม่อ่าน</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.filterTab, filter === 'read' && styles.filterTabActive]} onPress={() => setFilter('read')}>
          <Text style={[styles.filterText, filter === 'read' && styles.filterTextActive]}>อ่านแล้ว</Text>
        </TouchableOpacity>
      </View>

      {/* List */}
      {filteredNotifications.length > 0 ? (
        <FlatList
          data={filteredNotifications}
          renderItem={renderNotification}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        />
      ) : (
        <View style={styles.emptyState}>
          <Ionicons name="notifications-off-outline" size={80} color="#d1d5db" />
          <Text style={styles.emptyText}>ไม่มีการแจ้งเตือน</Text>
        </View>
      )}

      {/* Bottom Nav */}
      <View style={styles.bottomNav}>
        <TouchableOpacity style={styles.navItem} onPress={() => navigation.navigate('Home')}>
          <Ionicons name="home-outline" size={24} color="#9ca3af" />
          <Text style={styles.navLabel}>หน้าหลัก</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={() => navigation.navigate('Orders')}>
          <Ionicons name="receipt-outline" size={24} color="#9ca3af" />
          <Text style={styles.navLabel}>ออเดอร์</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem}>
          <Ionicons name="notifications" size={24} color="#10b981" />
          <Text style={styles.navLabelActive}>แจ้งเตือน</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={() => navigation.navigate('Profile')}>
          <Ionicons name="person-outline" size={24} color="#9ca3af" />
          <Text style={styles.navLabel}>โปรไฟล์</Text>
        </TouchableOpacity>
      </View>

      {/* Drawer Overlay */}
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
  // Header Style
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 60 : 60, // ✅ ปรับให้เท่ากัน
    paddingBottom: 15,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
    zIndex: 10
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 15 },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#1f2937' },
  menuButton: { padding: 4 },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#f3f4f6', borderWidth: 1, borderColor: '#e5e7eb' },

  filterContainer: { flexDirection: 'row', paddingHorizontal: 20, paddingVertical: 15, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  filterTab: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, marginRight: 8, backgroundColor: '#f9fafb' },
  filterTabActive: { backgroundColor: '#10b981' },
  filterText: { fontSize: 13, color: '#6b7280', fontWeight: '500' },
  filterTextActive: { color: '#fff' },

  listContent: { padding: 20, paddingBottom: 100 },
  notificationCard: { flexDirection: 'row', backgroundColor: '#fff', padding: 15, borderRadius: 15, marginBottom: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  notificationCardUnread: { borderLeftWidth: 4, borderLeftColor: '#10b981' },
  iconContainer: { width: 50, height: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  notificationContent: { flex: 1 },
  notificationHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  notificationTitle: { flex: 1, fontSize: 15, fontWeight: '600', color: '#1f2937' },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#10b981', marginLeft: 8 },
  notificationMessage: { fontSize: 13, color: '#6b7280', lineHeight: 18, marginBottom: 6 },
  notificationTime: { fontSize: 11, color: '#9ca3af' },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', marginTop: 50 },
  emptyText: { fontSize: 18, fontWeight: '600', color: '#6b7280', marginTop: 20 },

  bottomNav: { flexDirection: 'row', backgroundColor: '#fff', paddingVertical: 10, paddingHorizontal: 20, borderTopWidth: 1, borderTopColor: '#f3f4f6', position: 'absolute', bottom: 0, left: 0, right: 0 },
  navItem: { flex: 1, alignItems: 'center' },
  navLabel: { fontSize: 10, color: '#9ca3af', marginTop: 4 },
  navLabelActive: { fontSize: 10, color: '#10b981', fontWeight: 'bold', marginTop: 4 },

  // Drawer Styles (Consistent)
  drawerOverlay: { flex: 1, flexDirection: 'row' },
  drawerBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  drawerContainer: { position: 'absolute', left: 0, top: 0, bottom: 0, width: width * 0.85, backgroundColor: '#fff', paddingTop: 50, shadowColor: "#000", shadowOffset: { width: 2, height: 0 }, shadowOpacity: 0.25, shadowRadius: 3.84, elevation: 5 },
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
});