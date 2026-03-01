import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, Platform, StatusBar,
  RefreshControl, Image, Animated, Dimensions, Modal, TouchableWithoutFeedback,
  ScrollView, Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { auth, db } from '../../firebase.config';
import {
  collection, query, where, updateDoc, doc,
  onSnapshot, getDoc, writeBatch, getDocs
} from 'firebase/firestore';

const { width } = Dimensions.get('window');

export default function StoreNotificationsScreen({ navigation }) {
  const [notifications, setNotifications] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState('all');
  const [storeData, setStoreData] = useState(null);
  const [username, setUsername] = useState('');
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const slideAnim = useRef(new Animated.Value(-width * 0.85)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const defaultAvatar = Image.resolveAssetSource(require('../../assets/icon.png')).uri;

  useEffect(() => {
    loadStoreData();

    const user = auth.currentUser;
    if (!user) return;

    const q = query(
      collection(db, 'store_notifications'),
      where('storeId', '==', user.uid)
    );

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      try {
        const items = snapshot.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        // 🔴 ดึงประเภทออเดอร์ (orderType) มาเพื่อแสดง Tag จัดส่ง/รับที่ร้าน
        const enrichedItems = await Promise.all(items.map(async (item) => {
          if (item.orderId && !item.orderType) {
            try {
              const orderSnap = await getDoc(doc(db, 'orders', item.orderId));
              if (orderSnap.exists()) {
                return { ...item, orderType: orderSnap.data().orderType };
              }
            } catch (e) {
              console.log("Error fetching order type", e);
            }
          }
          return item;
        }));

        setNotifications(enrichedItems);
      } catch (error) {
        console.error('Error processing notifications:', error);
      }
    });

    return () => unsubscribe();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadStoreData();
    setRefreshing(false);
  };

  const loadStoreData = async () => {
    try {
      const user = auth.currentUser;
      if (!user) return;
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (userDoc.exists()) {
        const data = userDoc.data();
        setUsername(data.username || data.displayName || user.displayName || 'Username');
      }
      const storeDoc = await getDoc(doc(db, 'stores', user.uid));
      if (storeDoc.exists()) setStoreData(storeDoc.data());
    } catch (error) {
      console.error('Error loading store data:', error);
    }
  };

  const markAsRead = async (notificationId) => {
    try {
      await updateDoc(doc(db, 'store_notifications', notificationId), { isRead: true });
      setNotifications(prev =>
        prev.map(n => n.id === notificationId ? { ...n, isRead: true } : n)
      );
    } catch (error) {
      console.error('Error marking as read:', error);
    }
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

  const handleLogout = async () => {
    Alert.alert('ออกจากระบบ', 'คุณต้องการออกจากระบบหรือไม่?', [
      { text: 'ยกเลิก', style: 'cancel' },
      { text: 'ออกจากระบบ', style: 'destructive', onPress: async () => { await auth.signOut(); navigation.replace('SignIn'); } }
    ]);
  };

  const handleDeleteStore = () => {
    Alert.alert(
      'ยกเลิกการเป็นร้านค้า',
      'คุณแน่ใจหรือไม่? ข้อมูลร้านค้าและสินค้าทั้งหมดจะถูกลบอย่างถาวร ไม่สามารถกู้คืนได้',
      [
        { text: 'ไม่ใช่', style: 'cancel' },
        {
          text: 'ยืนยันลบ',
          style: 'destructive',
          onPress: async () => {
            try {
              const user = auth.currentUser;
              if (!user) return;
              const batch = writeBatch(db);
              batch.delete(doc(db, 'stores', user.uid));
              const approvalSnap = await getDocs(query(collection(db, 'approval_requests'), where('userId', '==', user.uid)));
              approvalSnap.forEach(d => batch.delete(d.ref));
              const foodSnap = await getDocs(query(collection(db, 'food_items'), where('userId', '==', user.uid)));
              foodSnap.forEach(d => batch.delete(d.ref));
              batch.update(doc(db, 'users', user.uid), { currentRole: 'customer' });
              await batch.commit();
              toggleDrawer();
              Alert.alert('สำเร็จ', 'ลบข้อมูลร้านค้าเรียบร้อยแล้ว', [
                { text: 'ตกลง', onPress: () => navigation.replace('Home') }
              ]);
            } catch (error) {
              console.error('Error deleting store:', error);
              Alert.alert('ผิดพลาด', 'ไม่สามารถลบข้อมูลร้านค้าได้ กรุณาลองใหม่อีกครั้ง');
            }
          }
        }
      ]
    );
  };

  // ─── Helper Functions ──────────────────────────────────────────

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'new_order':
        return { name: 'receipt', color: '#10b981', bg: '#dcfce7' };
      case 'order_cancelled_by_customer':
        return { name: 'close-circle', color: '#ef4444', bg: '#fee2e2' };
      case 'store_edit_approved':
        return { name: 'checkmark-circle', color: '#10b981', bg: '#dcfce7' };
      case 'store_edit_rejected':
        return { name: 'warning', color: '#ef4444', bg: '#fee2e2' };
      default:
        return { name: 'notifications', color: '#6b7280', bg: '#f3f4f6' };
    }
  };

  const getTimeAgo = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const diffTime = Math.abs(new Date() - date);
    const diffMinutes = Math.floor(diffTime / 60000);
    if (diffMinutes < 1) return 'เมื่อสักครู่';
    if (diffMinutes < 60) return `${diffMinutes} นาทีที่แล้ว`;
    const diffHours = Math.floor(diffTime / 3600000);
    if (diffHours < 24) return `${diffHours} ชั่วโมงที่แล้ว`;
    return date.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' });
  };

  // 🔴 เติม P- หรือ D- เข้าไปใน Badge แบบฝั่งลูกค้า
  const formatOrderId = (orderId, orderType) => {
    if (!orderId) return '';
    const shortId = orderId.slice(0, 6).toUpperCase();
    if (orderType === 'delivery') return `D-${shortId}`;
    if (orderType === 'pickup') return `P-${shortId}`;
    return shortId;
  };

  const filteredNotifications = notifications.filter(n => {
    if (filter === 'all') return true;
    if (filter === 'unread') return !n.isRead;
    if (filter === 'read') return n.isRead;
    return true;
  });

  const unreadCount = notifications.filter(n => !n.isRead).length;

  // 🔴 ฟังก์ชันสกัดข้อความ เพื่อลบ "ออเดอร์ #XXXXXX" ออกจากข้อความแจ้งเตือน (กันการซ้ำซ้อน)
  const renderFormattedMessage = (item) => {
      let msg = item.message || '';

      // ลบคำว่า ออเดอร์ / ออเดอร์ ตามด้วย #ไอดี ทิ้งไปเลย (gi = ไม่สนพิมพ์เล็กพิมพ์ใหญ่)
      if (item.orderId) {
        const shortId = item.orderId.slice(0, 6);
        const regex1 = new RegExp(`ออเดอร์\\s*#?${shortId}\\s*`, 'gi');
        const regex2 = new RegExp(`#?${shortId}\\s*`, 'gi');

        msg = msg.replace(regex1, ''); // ลบ "ออเดอร์ #TAGCYX "
        msg = msg.replace(regex2, ''); // เผื่อเหลือแค่ "#TAGCYX "
      }

      let reasonText = null;
      let mainText = msg.trim();

      if (item.cancelReason) {
        reasonText = item.cancelReason;
      }

      if (reasonText) {
         return (
           <View>
             {mainText !== '' && <Text style={styles.notificationMessage} numberOfLines={1}>{mainText}</Text>}
             <Text style={styles.reasonHighlightText} numberOfLines={1}>สาเหตุ: {reasonText}</Text>
           </View>
         );
      }

      return <Text style={styles.notificationMessage} numberOfLines={2}>{mainText}</Text>;
    };

  // ─── Render Notification Card ──────────────────────────────────

  const renderNotification = ({ item }) => {
    const icon = getNotificationIcon(item.type);
    return (
      <TouchableOpacity
        style={[styles.notificationCard, !item.isRead && styles.notificationCardUnread]}
        onPress={() => {
          markAsRead(item.id);
          navigation.navigate('StoreNotificationDetail', { notification: item });
        }}
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

          {/* 🔴 เรียกใช้ renderFormattedMessage แทน */}
          {renderFormattedMessage(item)}

          <View style={styles.notificationFooter}>
            {item.orderId ? (
              <View style={styles.badgeRow}>
                {/* Badge ออเดอร์ */}
                <View style={styles.orderIdBadge}>
                  <Ionicons name="receipt-outline" size={10} color="#6b7280" style={{ marginRight: 4 }} />
                  <Text style={styles.orderIdText}>#{formatOrderId(item.orderId, item.orderType)}</Text>
                </View>

                {/* 🔴 Badge ประเภท จัดส่ง/รับที่ร้าน เหมือนฝั่งลูกค้าเป๊ะๆ */}
                {item.orderType && (
                  <View style={[styles.typeBadge, item.orderType === 'delivery' ? styles.badgeDelivery : styles.badgePickup]}>
                    <Ionicons name={item.orderType === 'delivery' ? 'bicycle' : 'storefront'} size={10} color={item.orderType === 'delivery' ? '#0284c7' : '#10b981'} style={{marginRight: 4}} />
                    <Text style={[styles.typeText, item.orderType === 'delivery' ? styles.textDelivery : styles.textPickup]}>
                      {item.orderType === 'delivery' ? 'จัดส่ง' : 'รับที่ร้าน'}
                    </Text>
                  </View>
                )}
              </View>
            ) : <View style={{ flex: 1 }} />}
            <Text style={styles.notificationTime}>{getTimeAgo(item.createdAt)}</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  // ─── Drawer ────────────────────────────────────────────────────

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
          <View style={[styles.menuIconBox, { backgroundColor: '#d1fae5' }]}><Ionicons name="home-outline" size={20} color="#10b981" /></View>
          <Text style={styles.drawerMenuText}>หน้าหลัก</Text>
          <Ionicons name="chevron-forward" size={18} color="#9ca3af" style={{ marginLeft: 'auto' }} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.drawerMenuItem} onPress={() => { toggleDrawer(); navigation.navigate('StoreOrders'); }}>
          <View style={[styles.menuIconBox, { backgroundColor: '#fef3c7' }]}><Ionicons name="receipt-outline" size={20} color="#f59e0b" /></View>
          <Text style={styles.drawerMenuText}>คำสั่งซื้อของร้าน</Text>
          <Ionicons name="chevron-forward" size={18} color="#9ca3af" style={{ marginLeft: 'auto' }} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.drawerMenuItem} onPress={() => { toggleDrawer(); navigation.navigate('StoreDashboard'); }}>
          <View style={[styles.menuIconBox, { backgroundColor: '#eff6ff' }]}><Ionicons name="bar-chart-outline" size={20} color="#3b82f6" /></View>
          <Text style={styles.drawerMenuText}>แดชบอร์ด</Text>
          <Ionicons name="chevron-forward" size={18} color="#9ca3af" style={{ marginLeft: 'auto' }} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.drawerMenuItem} onPress={() => toggleDrawer()}>
          <View style={[styles.menuIconBox, { backgroundColor: '#dcfce7' }]}><Ionicons name="notifications-outline" size={20} color="#10b981" /></View>
          <Text style={styles.drawerMenuText}>การแจ้งเตือนร้านค้า</Text>
          <Ionicons name="chevron-forward" size={18} color="#9ca3af" style={{ marginLeft: 'auto' }} />
        </TouchableOpacity>

        <Text style={styles.sectionLabel}>บัญชี</Text>
        <TouchableOpacity style={styles.drawerMenuItem} onPress={() => { toggleDrawer(); navigation.navigate('StoreProfile'); }}>
          <View style={[styles.menuIconBox, { backgroundColor: '#f3e8ff' }]}><Ionicons name="person-outline" size={20} color="#a855f7" /></View>
          <Text style={styles.drawerMenuText}>โปรไฟล์</Text>
          <Ionicons name="chevron-forward" size={18} color="#9ca3af" style={{ marginLeft: 'auto' }} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.drawerMenuItem} onPress={() => { toggleDrawer(); navigation.navigate('StoreSettings'); }}>
          <View style={[styles.menuIconBox, { backgroundColor: '#f3f4f6' }]}><Ionicons name="settings-outline" size={20} color="#6b7280" /></View>
          <Text style={styles.drawerMenuText}>แก้ไขข้อมูลร้านค้า</Text>
          <Ionicons name="chevron-forward" size={18} color="#9ca3af" style={{ marginLeft: 'auto' }} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.drawerMenuItem} onPress={handleDeleteStore}>
          <View style={[styles.menuIconBox, { backgroundColor: '#fee2e2' }]}><Ionicons name="close-circle-outline" size={20} color="#ef4444" /></View>
          <Text style={styles.drawerMenuText}>ยกเลิกการเป็นร้านค้า</Text>
          <Ionicons name="chevron-forward" size={18} color="#9ca3af" style={{ marginLeft: 'auto' }} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.drawerLogout} onPress={handleLogout}>
          <View style={[styles.menuIconBox, { backgroundColor: '#fee2e2' }]}>
            <Ionicons name="log-out-outline" size={20} color="#ef4444" />
          </View>
          <Text style={styles.drawerLogoutText}>ออกจากระบบ</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );

  // ─── Main Render ───────────────────────────────────────────────

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#10b981" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={toggleDrawer} style={styles.menuButton}>
          <Ionicons name="menu" size={26} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>การแจ้งเตือน</Text>
        <TouchableOpacity onPress={() => navigation.navigate('StoreProfile')}>
          <Image
            source={storeData?.storeImage ? { uri: storeData.storeImage } : { uri: defaultAvatar }}
            style={styles.headerAvatar}
          />
        </TouchableOpacity>
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterContainer}>
        {['all', 'unread', 'read'].map(f => (
          <TouchableOpacity
            key={f}
            style={[styles.filterTab, filter === f && styles.filterTabActive]}
            onPress={() => setFilter(f)}
          >
            <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>
              {f === 'all' ? 'ทั้งหมด' : f === 'unread' ? 'ยังไม่อ่าน' : 'อ่านแล้ว'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Notification List */}
      {filteredNotifications.length > 0 ? (
        <FlatList
          data={filteredNotifications}
          renderItem={renderNotification}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#10b981" colors={['#10b981']} />}
        />
      ) : (
        <View style={styles.emptyState}>
          <Ionicons name="notifications-off-outline" size={80} color="#d1d5db" />
          <Text style={styles.emptyText}>ไม่มีการแจ้งเตือน</Text>
        </View>
      )}

      {/* Bottom Nav */}
      <View style={styles.bottomNav}>
        <TouchableOpacity style={styles.navItem} onPress={() => navigation.navigate('MyShop')}>
          <Ionicons name="storefront-outline" size={24} color="#9ca3af" />
          <Text style={styles.navLabel}>ร้านค้าของฉัน</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={() => navigation.navigate('StoreOrders')}>
          <Ionicons name="list-outline" size={24} color="#9ca3af" />
          <Text style={styles.navLabel}>ออเดอร์</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem}>
          <View style={{ position: 'relative' }}>
            <Ionicons name="notifications" size={24} color="#10b981" />
            {unreadCount > 0 && (
              <View style={styles.notificationBadge}>
                <Text style={styles.notificationBadgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
              </View>
            )}
          </View>
          <Text style={[styles.navLabel, styles.navLabelActive]}>แจ้งเตือน</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={() => navigation.navigate('StoreProfile')}>
          <Ionicons name="person-outline" size={24} color="#9ca3af" />
          <Text style={styles.navLabel}>โปรไฟล์</Text>
        </TouchableOpacity>
      </View>

      {/* Drawer */}
      <Modal visible={isDrawerOpen} transparent animationType="none" onRequestClose={toggleDrawer}>
        <View style={styles.drawerOverlay}>
          <TouchableWithoutFeedback onPress={toggleDrawer}>
            <Animated.View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(0,0,0,0.5)', opacity: fadeAnim }]} />
          </TouchableWithoutFeedback>
          <Animated.View style={[styles.drawerContainer, { transform: [{ translateX: slideAnim }] }]}>
            <DrawerContent />
          </Animated.View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },

  // ─── Header ───────────────────────────────────────────────────
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 60 : 50,
    paddingBottom: 15,
    backgroundColor: '#10b981',
  },
  menuButton: { padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#fff', letterSpacing: 1 },
  headerAvatar: { width: 36, height: 36, borderRadius: 18, borderWidth: 2, borderColor: '#fff', backgroundColor: '#d1fae5' },

  // ─── Filter ───────────────────────────────────────────────────
  filterContainer: {
    flexDirection: 'row', paddingHorizontal: 20, paddingVertical: 12,
    backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f3f4f6', gap: 8,
  },
  filterTab: {
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20,
    backgroundColor: '#f9fafb', borderWidth: 1, borderColor: '#e5e7eb',
  },
  filterTabActive: { backgroundColor: '#10b981', borderColor: '#10b981' },
  filterText: { fontSize: 13, color: '#6b7280', fontWeight: '500' },
  filterTextActive: { color: '#fff', fontWeight: 'bold' },

  // ─── List ─────────────────────────────────────────────────────
  listContent: { padding: 16, paddingBottom: 100 },
  notificationCard: {
    flexDirection: 'row', backgroundColor: '#fff', padding: 14, borderRadius: 16,
    marginBottom: 12, borderWidth: 1, borderColor: '#f3f4f6',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  notificationCardUnread: { backgroundColor: '#f0fdf4', borderColor: '#dcfce7' },
  iconContainer: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center', marginRight: 14, flexShrink: 0,
  },
  notificationContent: { flex: 1 },
  notificationHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  notificationTitle: { flex: 1, fontSize: 14, fontWeight: 'bold', color: '#1f2937' },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#ef4444', marginLeft: 8 },
  notificationMessage: { fontSize: 13, color: '#4b5563', lineHeight: 20, marginBottom: 4 },
  reasonHighlightText: { fontSize: 13, color: '#ef4444', fontWeight: '500', marginTop: 2, marginBottom: 4 },
  notificationFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },

  // 🔴 สไตล์สำหรับ Badge ให้เหมือนฝั่งลูกค้า 🔴
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  orderIdBadge: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#f9fafb', paddingHorizontal: 6, paddingVertical: 3,
    borderRadius: 6, borderWidth: 1, borderColor: '#e5e7eb',
  },
  orderIdText: { fontSize: 10, fontWeight: 'bold', color: '#4b5563' },
  typeBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 6, paddingVertical: 3, borderRadius: 6, borderWidth: 1 },
  badgeDelivery: { backgroundColor: '#e0f2fe', borderColor: '#bae6fd' },
  badgePickup: { backgroundColor: '#dcfce7', borderColor: '#bbf7d0' },
  typeText: { fontSize: 10, fontWeight: 'bold' },
  textDelivery: { color: '#0284c7' },
  textPickup: { color: '#10b981' },

  notificationTime: { fontSize: 11, color: '#9ca3af', fontWeight: '500' },

  // ─── Empty ────────────────────────────────────────────────────
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', marginTop: 80 },
  emptyText: { fontSize: 16, fontWeight: '600', color: '#9ca3af', marginTop: 15 },

  // ─── Bottom Nav ───────────────────────────────────────────────
  bottomNav: {
    flexDirection: 'row', backgroundColor: '#fff',
    paddingVertical: 10, paddingHorizontal: 20,
    borderTopWidth: 1, borderTopColor: '#f3f4f6',
    position: 'absolute', bottom: 0, left: 0, right: 0,
  },
  navItem: { flex: 1, alignItems: 'center', gap: 4 },
  navLabel: { fontSize: 10, color: '#9ca3af', marginTop: 2 },
  navLabelActive: { color: '#10b981', fontWeight: 'bold' },
  notificationBadge: {
    position: 'absolute', top: -4, right: -6, backgroundColor: '#ef4444',
    borderRadius: 10, minWidth: 18, height: 18, justifyContent: 'center',
    alignItems: 'center', borderWidth: 1, borderColor: '#fff', paddingHorizontal: 4, zIndex: 5,
  },
  notificationBadgeText: { color: '#fff', fontSize: 10, fontWeight: 'bold' },

  // ─── Drawer ───────────────────────────────────────────────────
  drawerOverlay: { flex: 1 },
  drawerContainer: {
    position: 'absolute', left: 0, top: 0, bottom: 0, width: width * 0.85,
    backgroundColor: '#fff', shadowColor: '#000',
    shadowOffset: { width: 2, height: 0 }, shadowOpacity: 0.25, shadowRadius: 3.84, elevation: 5,
  },
  drawerScrollContent: { flexGrow: 1, paddingTop: Platform.OS === 'ios' ? 50 : 30, paddingBottom: 40 },
  drawerContentPadding: { paddingHorizontal: 20 },
  drawerTopHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  logoContainer: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logoCircle: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#f0fdf4', alignItems: 'center', justifyContent: 'center' },
  appName: { fontSize: 16, fontWeight: 'bold', color: '#1f2937' },
  appSlogan: { fontSize: 12, color: '#6b7280' },
  closeButton: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#f3f4f6', alignItems: 'center', justifyContent: 'center' },
  profileCard: { backgroundColor: '#fff', borderRadius: 16, padding: 15, borderWidth: 1, borderColor: '#f3f4f6', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 2, marginBottom: 20 },
  profileHeader: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 14 },
  drawerAvatar: { width: 52, height: 52, borderRadius: 26, borderWidth: 2, borderColor: '#10b981', backgroundColor: '#d1fae5' },
  drawerName: { fontSize: 16, fontWeight: '700', color: '#1f2937' },
  drawerRole: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  modeContainer: { flexDirection: 'row', gap: 8 },
  modeButtonActive: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 9, backgroundColor: '#10b981', borderRadius: 10 },
  modeButtonInactive: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 9, backgroundColor: '#f3f4f6', borderRadius: 10 },
  modeTextActive: { fontSize: 11, fontWeight: '700', color: '#fff' },
  modeTextInactive: { fontSize: 11, color: '#6b7280', fontWeight: '600' },
  sectionLabel: { fontSize: 11, color: '#9ca3af', fontWeight: '700', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 8, marginLeft: 4, marginTop: 8 },
  drawerMenuItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 5, marginBottom: 4 },
  menuIconBox: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#ecfdf5', alignItems: 'center', justifyContent: 'center', marginRight: 14 },
  drawerMenuText: { fontSize: 14, color: '#1f2937', fontWeight: '600', flex: 1 },
  drawerLogout: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 16, marginBottom: 30, paddingHorizontal: 5 },
  drawerLogoutText: { fontSize: 14, color: '#ef4444', fontWeight: '700' },
});