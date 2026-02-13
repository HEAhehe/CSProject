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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { auth, db } from '../../firebase.config';
import { collection, query, where, getDocs, orderBy, updateDoc, doc, getDoc } from 'firebase/firestore';

const { width } = Dimensions.get('window');

export default function StoreOrdersScreen({ navigation }) {
  const [orders, setOrders] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState('pending'); // pending, confirmed, completed, cancelled
  const [storeData, setStoreData] = useState(null);

  // Drawer states
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const slideAnim = useRef(new Animated.Value(-width * 0.85)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const defaultAvatar = Image.resolveAssetSource(require('../../assets/icon.png')).uri;

  // Mock stats data - ในการใช้งานจริงควรดึงจาก Firebase
  const [stats, setStats] = useState({
    pending: 2,
    total: 8,
    revenue: 320
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
      if (user) {
        // ดึงข้อมูลออเดอร์จาก Firebase
        const q = query(
          collection(db, 'orders'),
          where('storeId', '==', user.uid),
          where('status', '==', filter),
          orderBy('createdAt', 'desc')
        );
        
        const querySnapshot = await getDocs(q);
        const ordersList = [];
        
        querySnapshot.forEach((doc) => {
          ordersList.push({
            id: doc.id,
            ...doc.data(),
          });
        });
        
        setOrders(ordersList);
      }
    } catch (error) {
      console.error('Error loading orders:', error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadOrders();
    setRefreshing(false);
  };

  // ฟังก์ชันจัดรูปแบบ Order ID
  const getFormattedOrderId = (orderId, type) => {
    if (!orderId) return 'N/A';
    const shortId = orderId.slice(0, 6).toUpperCase();
    const prefix = type === 'delivery' ? 'D' : 'P';
    return `${prefix}-${shortId}`;
  };

  // คัดลอก Order ID
  const handleCopyOrderID = (orderId, type) => {
    const formattedId = getFormattedOrderId(orderId, type);
    Alert.alert('คัดลอกรหัสแล้ว', `รหัสออเดอร์: ${formattedId}`);
  };

  // ยกเลิกออเดอร์
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

  // ยืนยันออเดอร์
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

  // Drawer functions
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
        {/* Header */}
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

        {/* Profile Card */}
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
          
          {/* Mode Switcher */}
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

        {/* Menu Section */}
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

        {/* Logout */}
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
    const isExpired = filter === 'cancelled' && item.cancelReason;

    return (
      <View style={styles.orderCard}>
        {/* Header */}
        <View style={styles.orderHeader}>
          <View style={styles.orderHeaderLeft}>
            <View style={styles.avatarCircle}>
              <Ionicons name="person" size={24} color="#6b7280" />
            </View>
            <View>
              <Text style={styles.orderTitle}>{item.customerName || 'ชื่อลูกค้า'}</Text>
              <Text style={styles.orderSubtitle}>
                #{formattedId}
              </Text>
            </View>
          </View>
          <TouchableOpacity 
            onPress={() => handleCopyOrderID(item.id, item.orderType)}
            style={styles.copyButton}
          >
            <Text style={styles.copyButtonText}>สถานะออเดอร์</Text>
          </TouchableOpacity>
        </View>

        {/* Items List */}
        <View style={styles.itemsBox}>
          {item.items && item.items.map((orderItem, index) => (
            <View key={index} style={styles.itemRow}>
              <Text style={styles.itemName}>{orderItem.foodName} - x{orderItem.quantity} (ที่เหลือ)</Text>
              <Text style={styles.itemPrice}>ราคา</Text>
            </View>
          ))}
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>ยอดรวม</Text>
            <Text style={styles.totalValue}>ราคารวม</Text>
          </View>
        </View>

        {/* Order Details */}
        <View style={styles.detailsRow}>
          <View style={styles.detailItem}>
            <Ionicons name="time-outline" size={16} color="#6b7280" />
            <Text style={styles.detailText}>
              รับภายใน: {item.pickupTime || 'xx.xx - xx.xx น.'}
            </Text>
          </View>
        </View>

        <View style={styles.detailsRow}>
          <View style={styles.detailItem}>
            <Ionicons name="location-outline" size={16} color="#6b7280" />
            <Text style={styles.detailText}>{item.storeName || 'รับที่ร้าน'}</Text>
          </View>
        </View>

        <View style={styles.detailsRow}>
          <View style={styles.detailItem}>
            <Ionicons name="call-outline" size={16} color="#6b7280" />
            <Text style={styles.detailText}>
              เบอร์โทร: {item.phoneNumber || 'xxx-xxx-xxxx'}
            </Text>
          </View>
        </View>

        {/* Expired Warning (for cancelled tab) */}
        {isExpired && (
          <View style={styles.expiredBox}>
            <Text style={styles.expiredText}>
              เหตุผล: {item.cancelReason || 'ลูกค้ามารับของไม่ทันเวลา'}
            </Text>
            <Text style={styles.expiredTime}>
              ยกเลิกเมื่อ: {item.cancelledAt || 'xx.xx น.'}
            </Text>
          </View>
        )}

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          {filter === 'pending' && (
            <>
              <TouchableOpacity 
                style={styles.cancelButton}
                onPress={() => handleCancelOrder(item.id)}
              >
                <Text style={styles.cancelButtonText}>ยกเลิกออเดอร์</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.confirmButton}
                onPress={() => handleConfirmOrder(item.id)}
              >
                <Text style={styles.confirmButtonText}>
                  {filter === 'confirmed' ? 'ลูกค้ารับของแล้ว' : 'ยืนยันออเดอร์'}
                </Text>
              </TouchableOpacity>
            </>
          )}
          {filter === 'confirmed' && (
            <TouchableOpacity 
              style={styles.confirmButton}
              onPress={() => handleConfirmOrder(item.id)}
            >
              <Text style={styles.confirmButtonText}>ลูกค้ารับของแล้ว</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      
      {/* Header with Hamburger */}
      <View style={styles.header}>
        <TouchableOpacity onPress={toggleDrawer} style={styles.menuButton}>
          <Ionicons name="menu" size={24} color="#1f2937" />
        </TouchableOpacity>
        
        <View style={styles.headerCenter}>
          <Ionicons name="storefront" size={24} color="#1f2937" />
          <Text style={styles.headerTitle}>ORDER</Text>
        </View>
        
        <TouchableOpacity style={styles.profileButton} onPress={() => navigation.navigate('Profile')}>
          <Ionicons name="person" size={24} color="#1f2937" />
        </TouchableOpacity>
      </View>

      {/* Today's Stats */}
      <View style={styles.statsSection}>
        <View style={styles.statsHeader}>
          <Ionicons name="stats-chart" size={20} color="#1f2937" />
          <Text style={styles.statsTitle}>Today's Stats</Text>
        </View>
        
        <View style={styles.statsCards}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{stats.pending}</Text>
            <Text style={styles.statLabel}>รอดำเนินการ</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{stats.total}</Text>
            <Text style={styles.statLabel}>ทั้งหมด</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{stats.revenue} ฿</Text>
            <Text style={styles.statLabel}>รายได้</Text>
          </View>
        </View>
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterContainer}>
        <TouchableOpacity
          style={[styles.filterTab, filter === 'pending' && styles.filterTabActive]}
          onPress={() => setFilter('pending')}
        >
          <Text style={[styles.filterText, filter === 'pending' && styles.filterTextActive]}>
            รอดำเนินการ
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.filterTab, filter === 'confirmed' && styles.filterTabActive]}
          onPress={() => setFilter('confirmed')}
        >
          <Text style={[styles.filterText, filter === 'confirmed' && styles.filterTextActive]}>
            จองแล้ว
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.filterTab, filter === 'completed' && styles.filterTabActive]}
          onPress={() => setFilter('completed')}
        >
          <Text style={[styles.filterText, filter === 'completed' && styles.filterTextActive]}>
            สำเร็จ
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.filterTab, filter === 'cancelled' && styles.filterTabActive]}
          onPress={() => setFilter('cancelled')}
        >
          <Text style={[styles.filterText, filter === 'cancelled' && styles.filterTextActive]}>
            ยกเลิก
          </Text>
        </TouchableOpacity>
      </View>

      {/* Orders List */}
      <FlatList
        data={orders}
        renderItem={renderOrderCard}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="receipt-outline" size={80} color="#d1d5db" />
            <Text style={styles.emptyText}>ไม่มีออเดอร์</Text>
            <Text style={styles.emptySubtext}>
              {filter === 'pending' ? 'ยังไม่มีออเดอร์ใหม่' : 'ไม่มีออเดอร์ในหมวดหมู่นี้'}
            </Text>
          </View>
        }
      />

      {/* Bottom Navigation */}
      <View style={styles.bottomNav}>
        <TouchableOpacity style={styles.navItem}>
          <Ionicons name="storefront" size={24} color="#1f2937" />
          <Text style={styles.navLabel}>ร้านค้าของฉัน</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={[styles.navItem, styles.navItemActive]}>
          <Ionicons name="receipt" size={24} color="#1f2937" />
          <Text style={[styles.navLabel, styles.navLabelActive]}>ออเดอร์</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.navItem}>
          <Ionicons name="notifications-outline" size={24} color="#9ca3af" />
          <Text style={styles.navLabel}>แจ้งเตือน</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.navItem}>
          <Ionicons name="person-outline" size={24} color="#9ca3af" />
          <Text style={styles.navLabel}>โปรไฟล์</Text>
        </TouchableOpacity>
      </View>

      {/* Drawer Modal */}
      <Modal
        visible={isDrawerOpen}
        transparent
        animationType="none"
        onRequestClose={toggleDrawer}
      >
        <View style={styles.drawerOverlay}>
          <TouchableWithoutFeedback onPress={toggleDrawer}>
            <Animated.View style={[styles.drawerBackdrop, { opacity: fadeAnim }]} />
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
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 15,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  menuButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
  },
  statsSection: {
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    paddingVertical: 15,
  },
  statsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 15,
  },
  statsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
  },
  statsCards: {
    flexDirection: 'row',
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#f3f4f6',
    borderRadius: 12,
    padding: 15,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#6b7280',
  },
  filterContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
    gap: 8,
  },
  filterTab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  filterTabActive: {
    backgroundColor: '#fff',
    borderColor: '#1f2937',
  },
  filterText: {
    fontSize: 13,
    color: '#6b7280',
    fontWeight: '500',
  },
  filterTextActive: {
    color: '#1f2937',
    fontWeight: '600',
  },
  listContent: {
    padding: 20,
    paddingBottom: 100,
  },
  orderCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  orderHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatarCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  orderTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
  },
  orderSubtitle: {
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 2,
  },
  copyButton: {
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  copyButtonText: {
    fontSize: 12,
    color: '#1f2937',
    fontWeight: '500',
  },
  itemsBox: {
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
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
  detailsRow: {
    marginBottom: 8,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  detailText: {
    fontSize: 13,
    color: '#6b7280',
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