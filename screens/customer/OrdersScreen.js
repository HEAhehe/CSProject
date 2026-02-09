import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  StatusBar,
  Platform,
  Image,
  RefreshControl,
  ActivityIndicator,
  Animated,
  Dimensions,
  Modal,
  TouchableWithoutFeedback
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { auth, db } from '../../firebase.config';
import { collection, query, where, getDocs, orderBy, doc, onSnapshot } from 'firebase/firestore';
import { useFocusEffect } from '@react-navigation/native';

const { width } = Dimensions.get('window');

export default function OrdersScreen({ navigation }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [userData, setUserData] = useState(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const slideAnim = useRef(new Animated.Value(-width * 0.85)).current;

  const defaultAvatar = Image.resolveAssetSource(require('../../assets/icon.png')).uri;

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

  useFocusEffect(
    useCallback(() => {
      fetchOrders();
    }, [])
  );

  const fetchOrders = async () => {
    try {
      const user = auth.currentUser;
      if (!user) return;

      const q = query(
        collection(db, 'orders'),
        where('userId', '==', user.uid),
        orderBy('createdAt', 'desc')
      );

      const snapshot = await getDocs(q);
      const ordersData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      setOrders(ordersData);
    } catch (error) {
      console.error('Error fetching orders:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchOrders();
  };

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

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed': return '#10b981';
      case 'cancelled': return '#ef4444';
      case 'pending': return '#f59e0b';
      default: return '#6b7280';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'completed': return 'สำเร็จ';
      case 'cancelled': return 'ยกเลิก';
      case 'pending': return 'รอรับสินค้า';
      default: return status;
    }
  };

  // ✅ ฟังก์ชันจัดรูปแบบ ID สำหรับรายการ
  const getFormattedOrderId = (orderId, type) => {
    const shortId = orderId.slice(0, 6).toUpperCase();
    return type === 'delivery' ? `D-${shortId}` : `P-${shortId}`;
  };

  const renderOrder = ({ item }) => (
    <TouchableOpacity
      style={styles.orderCard}
      onPress={() => navigation.navigate('OrderDetail', { order: item })}
    >
      <View style={styles.cardHeader}>
        <View style={styles.storeInfo}>
          {/* ✅ แสดงรหัสย่อที่หัวมุม */}
          <View style={{backgroundColor: '#f3f4f6', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginRight: 8}}>
             <Text style={{fontWeight: 'bold', color: '#1f2937', fontSize: 12}}>
               {getFormattedOrderId(item.id, item.orderType)}
             </Text>
          </View>
          <Text style={styles.storeName}>{item.storeName || 'ไม่ระบุร้าน'}</Text>
        </View>
        <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
          {getStatusText(item.status || 'pending')}
        </Text>
      </View>

      <View style={styles.cardBody}>
        <View style={styles.imagePlaceholder}>
           <Ionicons name="fast-food" size={24} color="#d1d5db" />
        </View>
        <View style={styles.orderInfo}>
          <Text style={styles.foodName}>{item.foodName || 'รายการอาหาร'}</Text>
          <Text style={styles.quantity}>จำนวน: {item.quantity} ชิ้น</Text>
          <Text style={styles.date}>
            {item.createdAt ? new Date(item.createdAt).toLocaleDateString('th-TH') : '-'}
          </Text>
        </View>
        <Text style={styles.price}>฿{item.totalPrice}</Text>
      </View>
    </TouchableOpacity>
  );

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
      <TouchableOpacity style={styles.drawerMenuItem} onPress={() => toggleDrawer()}>
        <View style={styles.menuIconBox}><Ionicons name="receipt-outline" size={20} color="#f59e0b" /></View><Text style={styles.drawerMenuText}>คำสั่งซื้อของฉัน</Text><Ionicons name="chevron-forward" size={18} color="#d1d5db" style={{marginLeft: 'auto'}} />
      </TouchableOpacity>
      <TouchableOpacity style={styles.drawerMenuItem} onPress={() => { toggleDrawer(); navigation.navigate('FavoriteStores'); }}>
        <View style={styles.menuIconBox}><Ionicons name="heart-outline" size={20} color="#ef4444" /></View><Text style={styles.drawerMenuText}>ร้านโปรด</Text><Ionicons name="chevron-forward" size={18} color="#d1d5db" style={{marginLeft: 'auto'}} />
      </TouchableOpacity>
      <TouchableOpacity style={styles.drawerMenuItem} onPress={() => { toggleDrawer(); navigation.navigate('Notifications'); }}>
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

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      <View style={styles.header}>
        <View style={styles.headerLeft}>
            <TouchableOpacity style={styles.menuButton} onPress={toggleDrawer}>
                <Ionicons name="menu" size={30} color="#1f2937" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>รายการคำสั่งซื้อ</Text>
        </View>

        <TouchableOpacity onPress={() => navigation.navigate('Profile')}>
           <Image
             source={userData?.profileImage ? { uri: userData.profileImage } : { uri: defaultAvatar }}
             style={styles.avatar}
           />
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#10b981" style={{marginTop: 50}} />
      ) : orders.length > 0 ? (
        <FlatList
          data={orders}
          renderItem={renderOrder}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        />
      ) : (
        <View style={styles.emptyState}>
          <Ionicons name="receipt-outline" size={64} color="#d1d5db" />
          <Text style={styles.emptyText}>ยังไม่มีคำสั่งซื้อ</Text>
          <Text style={styles.emptySubText}>สั่งอาหารอร่อยๆ ช่วยโลกกันเถอะ!</Text>
        </View>
      )}

      <View style={styles.bottomNav}>
        <TouchableOpacity style={styles.navItem} onPress={() => navigation.navigate('Home')}>
          <Ionicons name="home-outline" size={24} color="#9ca3af" />
          <Text style={styles.navLabel}>หน้าหลัก</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.navItem}>
          <Ionicons name="receipt" size={24} color="#10b981" />
          <Text style={styles.navLabelActive}>ออเดอร์</Text>
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
   header: {
     flexDirection: 'row',
     justifyContent: 'space-between',
     alignItems: 'center',
     paddingHorizontal: 20,
     paddingTop: Platform.OS === 'ios' ? 60 : 60,
     paddingBottom: 15, // ✅ ลดลงเพื่อให้กระชับเท่าหน้า Home
     backgroundColor: '#fff',
     borderBottomWidth: 1,
     borderBottomColor: '#f3f4f6',
     zIndex: 10
   },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 15 },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#1f2937' },
  menuButton: { padding: 4 },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#f3f4f6', borderWidth: 1, borderColor: '#e5e7eb' },
  listContent: { padding: 20 },
  orderCard: { backgroundColor: '#fff', borderRadius: 12, padding: 15, marginBottom: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, elevation: 2 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  storeInfo: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  storeName: { fontSize: 14, fontWeight: '600', color: '#4b5563' },
  statusText: { fontSize: 12, fontWeight: 'bold' },
  cardBody: { flexDirection: 'row', alignItems: 'center' },
  imagePlaceholder: { width: 50, height: 50, borderRadius: 8, backgroundColor: '#f3f4f6', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  orderInfo: { flex: 1 },
  foodName: { fontSize: 16, fontWeight: 'bold', color: '#1f2937' },
  quantity: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  date: { fontSize: 10, color: '#9ca3af', marginTop: 4 },
  price: { fontSize: 16, fontWeight: 'bold', color: '#10b981' },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', marginTop: 50 },
  emptyText: { fontSize: 16, fontWeight: 'bold', color: '#6b7280', marginTop: 10 },
  emptySubText: { fontSize: 13, color: '#9ca3af', marginTop: 5 },
  bottomNav: { flexDirection: 'row', backgroundColor: '#fff', paddingVertical: 10, paddingHorizontal: 20, borderTopWidth: 1, borderTopColor: '#f3f4f6', position: 'absolute', bottom: 0, left: 0, right: 0 },
  navItem: { flex: 1, alignItems: 'center' },
  navLabel: { fontSize: 10, color: '#9ca3af', marginTop: 4 },
  navLabelActive: { fontSize: 10, color: '#10b981', fontWeight: 'bold', marginTop: 4 },
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