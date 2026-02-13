import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  StatusBar,
  Alert,
  RefreshControl,
  Image,
  Animated,
  Dimensions,
  Modal,
  TouchableWithoutFeedback,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { auth, db } from '../../firebase.config';
import { collection, query, where, getDocs, orderBy, updateDoc, doc, getDoc, onSnapshot } from 'firebase/firestore';

const { width } = Dimensions.get('window');

export default function StoreOrdersScreen({ navigation }) {
  const [orders, setOrders] = useState([]);
  const [allOrders, setAllOrders] = useState([]); // ✅ เพิ่ม state เพื่อเก็บออเดอร์ทั้งหมด
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState('pending');
  const [storeData, setStoreData] = useState(null);
  const [loading, setLoading] = useState(true);

  // Drawer states
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const slideAnim = useRef(new Animated.Value(-width * 0.85)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const defaultAvatar = Image.resolveAssetSource(require('../../assets/icon.png')).uri;

  const [stats, setStats] = useState({
    pending: 0,
    total: 0,
    revenue: 0
  });

  useEffect(() => {
    loadStoreData();
    loadOrders();
  }, [filter]);

  const loadStoreData = async () => {
    try {
      const user = auth.currentUser;
      if (!user) return;

      const storeDocRef = doc(db, 'stores', user.uid);
      const storeDoc = await getDoc(storeDocRef);
      
      if (storeDoc.exists()) {
        setStoreData(storeDoc.data());
      }
    } catch (error) {
      console.error('Error loading store data:', error);
    }
  };

  const loadOrders = async () => {
    try {
      const user = auth.currentUser;
      if (!user) {
        console.log('❌ No user logged in');
        setLoading(false);
        return;
      }

      console.log('🔍 Loading orders for storeId:', user.uid);
      console.log('🔍 Filter:', filter);

      // ✅ Query 1: ดึงออเดอร์ตาม filter ที่เลือก
      const q = query(
        collection(db, 'orders'),
        where('storeId', '==', user.uid),
        where('status', '==', filter),
        orderBy('createdAt', 'desc')
      );
      
      const querySnapshot = await getDocs(q);
      const ordersList = [];
      
      // ✅ ดึงข้อมูลชื่อลูกค้าจาก users collection
      for (const docSnap of querySnapshot.docs) {
        const data = docSnap.data();
        
        // ดึงชื่อลูกค้า
        let customerName = 'ลูกค้า';
        if (data.userId) {
          try {
            const customerDoc = await getDoc(doc(db, 'users', data.userId));
            if (customerDoc.exists()) {
              const customerData = customerDoc.data();
              customerName = customerData.username || customerData.displayName || `ลูกค้า ${data.userId.slice(0, 6)}`;
            }
          } catch (err) {
            console.log('Cannot fetch customer name:', err);
          }
        }
        
        console.log('📦 Found order:', {
          id: docSnap.id,
          storeId: data.storeId,
          status: data.status,
          foodName: data.foodName,
          customerName: customerName
        });
        
        ordersList.push({
          id: docSnap.id,
          ...data,
          customerName: customerName, // ✅ เพิ่มชื่อลูกค้า
        });
      }

      console.log(`✅ Loaded ${ordersList.length} orders with status: ${filter}`);
      setOrders(ordersList);

      // ✅ Query 2: ดึงออเดอร์ทั้งหมดเพื่อคำนวณ stats
      const qAll = query(
        collection(db, 'orders'),
        where('storeId', '==', user.uid)
      );
      
      const allSnapshot = await getDocs(qAll);
      const allOrdersList = [];
      
      allSnapshot.forEach((doc) => {
        allOrdersList.push({
          id: doc.id,
          ...doc.data(),
        });
      });

      console.log(`📊 Total orders in database: ${allOrdersList.length}`);
      setAllOrders(allOrdersList);

      // ✅ คำนวณ stats
      const pendingCount = allOrdersList.filter(o => o.status === 'pending').length;
      const totalRevenue = allOrdersList
        .filter(o => o.status === 'completed')
        .reduce((sum, o) => sum + (o.totalPrice || 0), 0);

      setStats({
        pending: pendingCount,
        total: allOrdersList.length,
        revenue: totalRevenue
      });

      console.log('📊 Stats:', {
        pending: pendingCount,
        total: allOrdersList.length,
        revenue: totalRevenue
      });

    } catch (error) {
      console.error('❌ Error loading orders:', error);
      console.error('Error code:', error.code);
      console.error('Error message:', error.message);
      
      // ✅ ถ้า error เกี่ยวกับ index ให้แจ้ง user
      if (error.code === 'failed-precondition' || error.message?.includes('index')) {
        Alert.alert(
          'ต้องสร้าง Database Index',
          'กรุณาติดต่อผู้พัฒนาระบบเพื่อสร้าง Firestore Index สำหรับ orders collection',
          [{ text: 'ตกลง' }]
        );
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadOrders();
  };

  const getFormattedOrderId = (orderId, type) => {
    if (!orderId) return 'N/A';
    const shortId = orderId.slice(0, 6).toUpperCase();
    const prefix = type === 'delivery' ? 'D' : 'P';
    return `${prefix}-${shortId}`;
  };

  const handleCopyOrderID = (orderId, type) => {
    const formattedId = getFormattedOrderId(orderId, type);
    Alert.alert('คัดลอกรหัสแล้ว', `รหัสออเดอร์: ${formattedId}`);
  };

  const handleCancelOrder = (orderId) => {
    Alert.alert(
      'ยกเลิกออเดอร์',
      'คุณแน่ใจหรือไม่ที่จะยกเลิกออเดอร์นี้?',
      [
        {
          text: 'ยกเลิก',
          style: 'cancel'
        },
        {
          text: 'ยืนยัน',
          style: 'destructive',
          onPress: async () => {
            try {
              await updateDoc(doc(db, 'orders', orderId), {
                status: 'cancelled'
              });
              loadOrders();
              Alert.alert('สำเร็จ', 'ยกเลิกออเดอร์แล้ว');
            } catch (error) {
              Alert.alert('ผิดพลาด', 'ไม่สามารถยกเลิกออเดอร์ได้');
            }
          }
        }
      ]
    );
  };

  const handleConfirmOrder = async (orderId) => {
    try {
      await updateDoc(doc(db, 'orders', orderId), {
        status: 'confirmed'
      });
      loadOrders();
      Alert.alert('สำเร็จ', 'ยืนยันออเดอร์แล้ว');
    } catch (error) {
      Alert.alert('ผิดพลาด', 'ไม่สามารถยืนยันออเดอร์ได้');
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
    Alert.alert(
      'ออกจากระบบ',
      'คุณต้องการออกจากระบบหรือไม่?',
      [
        { text: 'ยกเลิก', style: 'cancel' },
        {
          text: 'ออกจากระบบ',
          style: 'destructive',
          onPress: async () => {
            try {
              await auth.signOut();
              navigation.replace('SignIn');
            } catch (error) {
              console.error('Logout error:', error);
              Alert.alert('ข้อผิดพลาด', 'ไม่สามารถออกจากระบบได้');
            }
          }
        }
      ]
    );
  };

  const DrawerContent = () => (
    <View style={styles.drawerWrapper}>
      <View style={styles.drawerContent}>
        <View style={styles.drawerTopHeader}>
          <View style={styles.logoContainer}>
            <View style={styles.logoCircle}>
              <Ionicons name="leaf" size={24} color="#10b981" />
            </View>
            <View>
              <Text style={styles.appName}>Food Waste</Text>
              <Text style={styles.appSlogan}>ร้านค้า</Text>
            </View>
          </View>
          <TouchableOpacity onPress={toggleDrawer} style={styles.closeButton}>
            <Ionicons name="close" size={24} color="#1f2937" />
          </TouchableOpacity>
        </View>

        <View style={styles.profileCard}>
          <View style={styles.profileHeader}>
            <Image 
              source={storeData?.storeImage ? { uri: storeData.storeImage } : { uri: defaultAvatar }} 
              style={styles.drawerAvatar} 
            />
            <View style={{ flex: 1 }}>
              <Text style={styles.drawerName}>{storeData?.storeName || 'ร้านค้า'}</Text>
              <Text style={styles.drawerRole}>โหมด: ร้านค้า</Text>
            </View>
          </View>
          
          <View style={styles.modeContainer}>
            <TouchableOpacity 
              style={styles.modeButtonInactive}
              onPress={() => {
                toggleDrawer();
                navigation.navigate('Home');
              }}
            >
              <Ionicons name="cart-outline" size={16} color="#6b7280" />
              <Text style={styles.modeTextInactive}>โหมดลูกค้า</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.modeButtonActive}
              activeOpacity={1}
            >
              <Ionicons name="storefront" size={16} color="#fff" />
              <Text style={styles.modeTextActive}>โหมดร้านค้า</Text>
            </TouchableOpacity>
          </View>
        </View>

        <Text style={styles.sectionTitle}>เมนูหลัก</Text>
        
        <TouchableOpacity 
          style={styles.drawerMenuItem}
          onPress={() => {
            toggleDrawer();
            navigation.navigate('MyShop');
          }}
        >
          <View style={styles.menuIconBox}>
            <Ionicons name="home-outline" size={20} color="#10b981" />
          </View>
          <Text style={styles.drawerMenuText}>หน้าหลัก</Text>
          <Ionicons name="chevron-forward" size={18} color="#d1d5db" style={{marginLeft: 'auto'}} />
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.drawerMenuItem}
          onPress={() => {
            toggleDrawer();
            navigation.navigate('StoreOrders');
          }}
        >
          <View style={styles.menuIconBox}>
            <Ionicons name="receipt-outline" size={20} color="#f59e0b" />
          </View>
          <Text style={styles.drawerMenuText}>คำสั่งซื้อของร้าน</Text>
          <Ionicons name="chevron-forward" size={18} color="#d1d5db" style={{marginLeft: 'auto'}} />
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.drawerMenuItem}
          onPress={() => {
            toggleDrawer();
            Alert.alert('กำลังพัฒนา', 'ฟีเจอร์นี้กำลังอยู่ระหว่างการพัฒนา');
          }}
        >
          <View style={styles.menuIconBox}>
            <Ionicons name="notifications-outline" size={20} color="#3b82f6" />
          </View>
          <Text style={styles.drawerMenuText}>แจ้งเตือนร้านค้า</Text>
          <Ionicons name="chevron-forward" size={18} color="#d1d5db" style={{marginLeft: 'auto'}} />
        </TouchableOpacity>

        <Text style={styles.sectionTitle}>บัญชี</Text>

        <TouchableOpacity 
          style={styles.drawerMenuItem}
          onPress={() => {
            toggleDrawer();
            Alert.alert('กำลังพัฒนา', 'ฟีเจอร์นี้กำลังอยู่ระหว่างการพัฒนา');
          }}
        >
          <View style={styles.menuIconBox}>
            <Ionicons name="person-outline" size={20} color="#3b82f6" />
          </View>
          <Text style={styles.drawerMenuText}>โปรไฟล์</Text>
          <Ionicons name="chevron-forward" size={18} color="#d1d5db" style={{marginLeft: 'auto'}} />
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.drawerLogout}
          onPress={handleLogout}
        >
          <View style={[styles.menuIconBox, { backgroundColor: '#fee2e2' }]}>
            <Ionicons name="log-out-outline" size={20} color="#ef4444" />
          </View>
          <Text style={styles.drawerLogoutText}>ออกจากระบบ</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderOrderCard = ({ item }) => {
    const formattedId = getFormattedOrderId(item.id, item.orderType);
    const statusColors = {
      pending: '#f59e0b',
      confirmed: '#3b82f6',
      completed: '#10b981',
      cancelled: '#ef4444'
    };
    const statusTexts = {
      pending: 'รอยืนยัน',
      confirmed: 'ยืนยันแล้ว',
      completed: 'สำเร็จ',
      cancelled: 'ยกเลิก'
    };

    return (
      <View style={styles.orderCard}>
        <View style={styles.orderHeader}>
          <View>
            <TouchableOpacity onPress={() => handleCopyOrderID(item.id, item.orderType)}>
              <Text style={styles.orderId}>#{formattedId}</Text>
            </TouchableOpacity>
            <Text style={styles.orderTime}>
              {item.createdAt ? new Date(item.createdAt).toLocaleString('th-TH') : 'ไม่ระบุเวลา'}
            </Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: statusColors[item.status] + '20' }]}>
            <Text style={[styles.statusText, { color: statusColors[item.status] }]}>
              {statusTexts[item.status]}
            </Text>
          </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.orderDetails}>
          <View style={styles.detailsRow}>
            <View style={styles.detailItem}>
              <Ionicons name="person-outline" size={16} color="#6b7280" />
              <Text style={styles.detailText}>
                {item.customerName || `ลูกค้า ${item.userId?.slice(0, 8)}` || 'ไม่ระบุ'}
              </Text>
            </View>
            <View style={styles.detailItem}>
              <Ionicons 
                name={item.orderType === 'delivery' ? "bicycle" : "storefront"} 
                size={16} 
                color="#6b7280" 
              />
              <Text style={styles.detailText}>
                {item.orderType === 'delivery' ? 'จัดส่ง' : 'รับเอง'}
              </Text>
            </View>
          </View>

          <View style={styles.itemsContainer}>
            <Text style={styles.itemsTitle}>รายการอาหาร:</Text>
            {item.items && item.items.length > 0 ? (
              item.items.map((food, index) => (
                <View key={index} style={styles.itemRow}>
                  <Text style={styles.itemName}>{food.foodName} x{food.quantity}</Text>
                  <Text style={styles.itemPrice}>฿{food.price * food.quantity}</Text>
                </View>
              ))
            ) : (
              <View style={styles.itemRow}>
                <Text style={styles.itemName}>{item.foodName || 'ไม่ระบุ'}</Text>
                <Text style={styles.itemPrice}>฿{item.totalPrice || 0}</Text>
              </View>
            )}
          </View>

          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>ยอดรวม</Text>
            <Text style={styles.totalValue}>฿{item.totalPrice || 0}</Text>
          </View>

          {item.closingTime && (
            <View style={styles.expiredBox}>
              <Text style={styles.expiredText}>⏰ เวลารับสินค้า</Text>
              <Text style={styles.expiredTime}>ภายในวันนี้ ก่อน {item.closingTime} น.</Text>
            </View>
          )}
        </View>

        {item.status === 'pending' && (
          <View style={styles.actionButtons}>
            <TouchableOpacity 
              style={styles.cancelButton}
              onPress={() => handleCancelOrder(item.id)}
            >
              <Text style={styles.cancelButtonText}>ยกเลิก</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.confirmButton}
              onPress={() => handleConfirmOrder(item.id)}
            >
              <Text style={styles.confirmButtonText}>ยืนยันออเดอร์</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#10b981" />
        <Text style={{ marginTop: 16, color: '#6b7280' }}>กำลังโหลดคำสั่งซื้อ...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      
      <View style={styles.header}>
        <TouchableOpacity onPress={toggleDrawer} style={styles.menuButton}>
          <Ionicons name="menu" size={24} color="#1f2937" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>คำสั่งซื้อของร้าน</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.statsContainer}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{stats.pending}</Text>
          <Text style={styles.statLabel}>รอยืนยัน</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{stats.total}</Text>
          <Text style={styles.statLabel}>ทั้งหมด</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>฿{stats.revenue}</Text>
          <Text style={styles.statLabel}>รายได้</Text>
        </View>
      </View>

      <View style={styles.filterContainer}>
        {['pending', 'confirmed', 'completed', 'cancelled'].map(status => (
          <TouchableOpacity
            key={status}
            style={[styles.filterButton, filter === status && styles.filterButtonActive]}
            onPress={() => setFilter(status)}
          >
            <Text style={[styles.filterText, filter === status && styles.filterTextActive]}>
              {status === 'pending' && 'รอยืนยัน'}
              {status === 'confirmed' && 'ยืนยันแล้ว'}
              {status === 'completed' && 'สำเร็จ'}
              {status === 'cancelled' && 'ยกเลิก'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={orders}
        renderItem={renderOrderCard}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="receipt-outline" size={64} color="#d1d5db" />
            <Text style={styles.emptyText}>ไม่มีคำสั่งซื้อ</Text>
            <Text style={styles.emptySubtext}>
              {filter === 'pending' 
                ? 'ยังไม่มีคำสั่งซื้อที่รอยืนยัน' 
                : `ไม่มีคำสั่งซื้อที่${filter === 'confirmed' ? 'ยืนยันแล้ว' : filter === 'completed' ? 'สำเร็จ' : 'ยกเลิก'}`}
            </Text>
            {/* ✅ Debug info */}
            <Text style={styles.debugText}>
              Debug: ออเดอร์ทั้งหมดในระบบ = {allOrders.length}
            </Text>
          </View>
        }
      />

      <View style={styles.bottomNav}>
        <TouchableOpacity 
          style={styles.navItem}
          onPress={() => navigation.navigate('MyShop')}
        >
          <Ionicons name="home-outline" size={24} color="#9ca3af" />
          <Text style={styles.navLabel}>หน้าหลัก</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.navItem, styles.navItemActive]}
          onPress={() => {}}
        >
          <Ionicons name="list" size={24} color="#1f2937" />
          <Text style={[styles.navLabel, styles.navLabelActive]}>ออเดอร์</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.navItem}
          onPress={() => Alert.alert('กำลังพัฒนา')}
        >
          <Ionicons name="notifications-outline" size={24} color="#9ca3af" />
          <Text style={styles.navLabel}>แจ้งเตือน</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.navItem}
          onPress={() => Alert.alert('กำลังพัฒนา')}
        >
          <Ionicons name="person-outline" size={24} color="#9ca3af" />
          <Text style={styles.navLabel}>โปรไฟล์</Text>
        </TouchableOpacity>
      </View>

      <Modal
        visible={isDrawerOpen}
        transparent
        animationType="none"
        onRequestClose={toggleDrawer}
      >
        <TouchableWithoutFeedback onPress={toggleDrawer}>
          <Animated.View style={[styles.drawerOverlay, { opacity: fadeAnim }]}>
            <TouchableWithoutFeedback>
              <Animated.View style={[styles.drawerContainer, { transform: [{ translateX: slideAnim }] }]}>
                <DrawerContent />
              </Animated.View>
            </TouchableWithoutFeedback>
            <TouchableWithoutFeedback onPress={toggleDrawer}>
              <View style={styles.drawerBackdrop} />
            </TouchableWithoutFeedback>
          </Animated.View>
        </TouchableWithoutFeedback>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  header: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between', 
    paddingHorizontal: 20, 
    paddingTop: Platform.OS === 'ios' ? 60 : 50, 
    paddingBottom: 15, 
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  menuButton: { padding: 8 },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#1f2937' },
  statsContainer: { 
    flexDirection: 'row', 
    padding: 20, 
    gap: 10,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  statCard: { 
    flex: 1, 
    backgroundColor: '#f9fafb', 
    padding: 16, 
    borderRadius: 12, 
    alignItems: 'center' 
  },
  statValue: { fontSize: 24, fontWeight: 'bold', color: '#1f2937' },
  statLabel: { fontSize: 12, color: '#6b7280', marginTop: 4 },
  filterContainer: { 
    flexDirection: 'row', 
    paddingHorizontal: 20, 
    paddingVertical: 12,
    gap: 8,
    backgroundColor: '#fff',
  },
  filterButton: { 
    paddingHorizontal: 16, 
    paddingVertical: 8, 
    borderRadius: 20, 
    backgroundColor: '#f9fafb' 
  },
  filterButtonActive: { backgroundColor: '#1f2937' },
  filterText: { fontSize: 13, color: '#6b7280', fontWeight: '500' },
  filterTextActive: { color: '#fff' },
  listContent: { padding: 20, paddingBottom: 100 },
  orderCard: { 
    backgroundColor: '#fff', 
    borderRadius: 16, 
    padding: 16, 
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  orderHeader: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  orderId: { fontSize: 16, fontWeight: 'bold', color: '#1f2937' },
  orderTime: { fontSize: 12, color: '#9ca3af', marginTop: 4 },
  statusBadge: { 
    paddingHorizontal: 12, 
    paddingVertical: 6, 
    borderRadius: 12 
  },
  statusText: { fontSize: 12, fontWeight: '600' },
  divider: { height: 1, backgroundColor: '#f3f4f6', marginBottom: 12 },
  orderDetails: {},
  detailsRow: { marginBottom: 12 },
  detailItem: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 6,
    marginBottom: 8,
  },
  detailText: { fontSize: 13, color: '#6b7280' },
  itemsContainer: { 
    backgroundColor: '#f9fafb', 
    padding: 12, 
    borderRadius: 8,
    marginBottom: 12,
  },
  itemsTitle: { 
    fontSize: 13, 
    fontWeight: '600', 
    color: '#374151',
    marginBottom: 8,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  itemName: {
    fontSize: 14,
    color: '#374151',
    flex: 1,
  },
  itemPrice: {
    fontSize: 14,
    color: '#1f2937',
    fontWeight: '500',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 8,
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  totalLabel: {
    fontSize: 14,
    color: '#1f2937',
    fontWeight: '600',
  },
  totalValue: {
    fontSize: 14,
    color: '#1f2937',
    fontWeight: '600',
  },
  expiredBox: {
    backgroundColor: '#fef2f2',
    borderRadius: 8,
    padding: 12,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  expiredText: {
    fontSize: 13,
    color: '#dc2626',
    marginBottom: 4,
  },
  expiredTime: {
    fontSize: 12,
    color: '#ef4444',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#f3f4f6',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6b7280',
  },
  confirmButton: {
    flex: 1,
    backgroundColor: '#1f2937',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  confirmButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#6b7280',
    marginTop: 20,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#9ca3af',
    textAlign: 'center',
  },
  debugText: {
    fontSize: 12,
    color: '#3b82f6',
    marginTop: 16,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  bottomNav: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  navItemActive: {
    borderBottomWidth: 2,
    borderBottomColor: '#1f2937',
  },
  navLabel: {
    fontSize: 11,
    color: '#9ca3af',
  },
  navLabelActive: {
    color: '#1f2937',
    fontWeight: '600',
  },
  // Drawer styles
  drawerOverlay: { 
    flex: 1, 
    flexDirection: 'row' 
  },
  drawerBackdrop: { 
    flex: 1, 
    backgroundColor: 'rgba(0,0,0,0.5)' 
  },
  drawerContainer: { 
    position: 'absolute', 
    left: 0, 
    top: 0, 
    bottom: 0, 
    width: width * 0.80, 
    backgroundColor: '#fff', 
    shadowColor: "#000", 
    shadowOffset: { width: 2, height: 0 }, 
    shadowOpacity: 0.25, 
    shadowRadius: 3.84, 
    elevation: 5 
  },
  drawerWrapper: { 
    flex: 1, 
    paddingTop: Platform.OS === 'ios' ? 30 : 30 
  },
  drawerContent: { 
    flex: 1, 
    paddingHorizontal: 20 
  },
  drawerTopHeader: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    marginBottom: 15 
  },
  logoContainer: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 10 
  },
  logoCircle: { 
    width: 40, 
    height: 40, 
    borderRadius: 20, 
    backgroundColor: '#f0fdf4', 
    alignItems: 'center', 
    justifyContent: 'center' 
  },
  appName: { 
    fontSize: 16, 
    fontWeight: 'bold', 
    color: '#1f2937' 
  },
  appSlogan: { 
    fontSize: 12, 
    color: '#6b7280' 
  },
  closeButton: { 
    width: 36, 
    height: 36, 
    borderRadius: 18, 
    backgroundColor: '#f3f4f6', 
    alignItems: 'center', 
    justifyContent: 'center' 
  },
  profileCard: { 
    backgroundColor: '#fff', 
    borderRadius: 16, 
    padding: 15, 
    borderWidth: 1, 
    borderColor: '#f3f4f6', 
    shadowColor: '#000', 
    shadowOffset: { width: 0, height: 2 }, 
    shadowOpacity: 0.05, 
    shadowRadius: 3, 
    elevation: 2, 
    marginBottom: 20 
  },
  profileHeader: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 15,
    marginBottom: 15 
  },
  modeContainer: { 
    flexDirection: 'row', 
    gap: 10 
  },
  modeButtonActive: { 
    flex: 1, 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'center', 
    gap: 5, 
    paddingVertical: 8, 
    backgroundColor: '#10b981', 
    borderRadius: 8 
  },
  modeButtonInactive: { 
    flex: 1, 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'center', 
    gap: 5, 
    paddingVertical: 8, 
    backgroundColor: '#f3f4f6', 
    borderRadius: 8 
  },
  modeTextActive: { 
    fontSize: 11, 
    fontWeight: 'bold', 
    color: '#fff' 
  },
  modeTextInactive: { 
    fontSize: 11, 
    color: '#6b7280' 
  },
  drawerAvatar: { 
    width: 50, 
    height: 50, 
    borderRadius: 25, 
    borderWidth: 1, 
    borderColor: '#10b981', 
    backgroundColor: '#f3f4f6' 
  },
  drawerName: { 
    fontSize: 16, 
    fontWeight: 'bold', 
    color: '#1f2937' 
  },
  drawerRole: { 
    fontSize: 13, 
    color: '#6b7280' 
  },
  sectionTitle: { 
    fontSize: 14, 
    color: '#9ca3af', 
    marginBottom: 10, 
    marginLeft: 5, 
    marginTop: 5 
  },
  drawerMenuItem: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: '#fff', 
    paddingVertical: 12, 
    paddingHorizontal: 5, 
    marginBottom: 5 
  },
  menuIconBox: { 
    width: 36, 
    height: 36, 
    borderRadius: 18, 
    backgroundColor: '#f9fafb', 
    alignItems: 'center', 
    justifyContent: 'center', 
    marginRight: 15 
  },
  drawerMenuText: { 
    fontSize: 15, 
    color: '#1f2937', 
    fontWeight: '500' 
  },
  drawerLogout: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 15, 
    marginTop: 30, 
    paddingHorizontal: 5, 
    marginBottom: 30 
  },
  drawerLogoutText: { 
    fontSize: 15, 
    color: '#ef4444', 
    fontWeight: 'bold' 
  },
});