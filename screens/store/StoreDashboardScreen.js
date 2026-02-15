import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Image,
  RefreshControl,
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  Modal,
  TouchableWithoutFeedback,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { auth, db } from '../../firebase.config';
import { collection, getDocs, query, where, doc, getDoc, orderBy } from 'firebase/firestore';

const { width } = Dimensions.get('window');

export default function StoreDashboardScreen({ navigation }) {
  const [storeData, setStoreData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('overview'); // overview, orders, reviews
  const [selectedMonth, setSelectedMonth] = useState('วันนี้');
  const [selectedYear, setSelectedYear] = useState('สัปดาห์นี้');

  // Statistics
  const [stats, setStats] = useState({
    totalRevenue: 0,
    totalOrders: 0,
    completedOrders: 0,
    completionRate: 0,
    averageRating: 0,
  });

  // Data
  const [topProducts, setTopProducts] = useState([]);
  const [recentOrders, setRecentOrders] = useState([]);

  // Drawer states
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const slideAnim = useRef(new Animated.Value(-width * 0.85)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const defaultAvatar = Image.resolveAssetSource(require('../../assets/icon.png')).uri;

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      const user = auth.currentUser;
      if (!user) {
        navigation.replace('SignIn');
        return;
      }

      // Load store data
      const storeDocRef = doc(db, 'stores', user.uid);
      const storeDoc = await getDoc(storeDocRef);
      
      if (storeDoc.exists()) {
        setStoreData(storeDoc.data());
      }

      // Load orders statistics
      await loadOrderStats(user.uid);

      // Load top products
      await loadTopProducts(user.uid);

      // Load recent orders
      await loadRecentOrders(user.uid);

    } catch (error) {
      console.error('Error loading dashboard:', error);
      Alert.alert('ข้อผิดพลาด', 'ไม่สามารถโหลดข้อมูลได้');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const loadOrderStats = async (userId) => {
    try {
      // Query all orders for this store
      const ordersQuery = query(
        collection(db, 'orders'),
        where('storeId', '==', userId)
      );
      const ordersSnapshot = await getDocs(ordersQuery);
      const orders = ordersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      // Calculate statistics
      const totalOrders = orders.length;
      const completedOrders = orders.filter(o => o.status === 'completed').length;
      const totalRevenue = orders
        .filter(o => o.status === 'completed')
        .reduce((sum, o) => sum + (o.totalPrice || 0), 0);
      const completionRate = totalOrders > 0 ? Math.round((completedOrders / totalOrders) * 100) : 0;

      // Calculate average rating (from completed orders)
      const ordersWithRating = orders.filter(o => o.rating && o.rating > 0);
      const averageRating = ordersWithRating.length > 0
        ? (ordersWithRating.reduce((sum, o) => sum + o.rating, 0) / ordersWithRating.length).toFixed(1)
        : 0;

      setStats({
        totalRevenue,
        totalOrders,
        completedOrders,
        completionRate,
        averageRating: parseFloat(averageRating),
      });

    } catch (error) {
      console.error('Error loading order stats:', error);
    }
  };

  const loadTopProducts = async (userId) => {
    try {
      const productsQuery = query(
        collection(db, 'food_items'),
        where('userId', '==', userId)
      );
      const productsSnapshot = await getDocs(productsQuery);
      const products = productsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      // Sort by quantity sold (assuming we track this)
      const sortedProducts = products
        .map(p => ({
          ...p,
          soldCount: p.initialQuantity ? (p.initialQuantity - p.quantity) : 0
        }))
        .sort((a, b) => b.soldCount - a.soldCount)
        .slice(0, 4);

      setTopProducts(sortedProducts);
    } catch (error) {
      console.error('Error loading top products:', error);
    }
  };

  const loadRecentOrders = async (userId) => {
    try {
      const ordersQuery = query(
        collection(db, 'orders'),
        where('storeId', '==', userId),
        orderBy('createdAt', 'desc')
      );
      const ordersSnapshot = await getDocs(ordersQuery);
      
      const ordersList = [];
      for (const docSnap of ordersSnapshot.docs.slice(0, 10)) {
        const data = docSnap.data();
        
        // Get customer name
        let customerName = 'ลูกค้า';
        if (data.userId) {
          try {
            const customerDoc = await getDoc(doc(db, 'users', data.userId));
            if (customerDoc.exists()) {
              const customerData = customerDoc.data();
              customerName = customerData.username || customerData.displayName || 'ลูกค้า';
            }
          } catch (err) {
            console.log('Cannot fetch customer name:', err);
          }
        }
        
        ordersList.push({
          id: docSnap.id,
          ...data,
          customerName,
        });
      }

      setRecentOrders(ordersList);
    } catch (error) {
      console.error('Error loading recent orders:', error);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadDashboardData();
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
              <Text style={styles.appName}>ครัวคุณแม่</Text>
              <Text style={styles.appSlogan}>Dashboard ร้านค้า</Text>
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
            <Ionicons name="list-outline" size={20} color="#1f2937" />
          </View>
          <Text style={styles.drawerMenuText}>สินค้าของฉัน</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.drawerMenuItem}
          onPress={() => {
            toggleDrawer();
            navigation.navigate('StoreOrders');
          }}
        >
          <View style={styles.menuIconBox}>
            <Ionicons name="receipt-outline" size={20} color="#1f2937" />
          </View>
          <Text style={styles.drawerMenuText}>ออเดอร์</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.drawerMenuItem}
          onPress={() => {
            toggleDrawer();
            navigation.navigate('Profile');
          }}
        >
          <View style={styles.menuIconBox}>
            <Ionicons name="person-outline" size={20} color="#1f2937" />
          </View>
          <Text style={styles.drawerMenuText}>โปรไฟล์</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.drawerLogout}
          onPress={handleLogout}
        >
          <View style={styles.menuIconBox}>
            <Ionicons name="log-out-outline" size={20} color="#ef4444" />
          </View>
          <Text style={styles.drawerLogoutText}>ออกจากระบบ</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#10b981" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#f9fafb" />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity onPress={toggleDrawer} style={styles.menuButton}>
            <Ionicons name="menu" size={24} color="#1f2937" />
          </TouchableOpacity>
          <View>
            <Text style={styles.headerTitle}>ครัวคุณแม่</Text>
            <Text style={styles.headerSubtitle}>Dashboard ร้านค้า</Text>
          </View>
        </View>
        <TouchableOpacity onPress={() => navigation.navigate('Notifications')}>
          <Ionicons name="notifications-outline" size={24} color="#1f2937" />
        </TouchableOpacity>
      </View>

      {/* Tab Navigation */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'overview' && styles.tabActive]}
          onPress={() => setActiveTab('overview')}
        >
          <Ionicons
            name="stats-chart"
            size={20}
            color={activeTab === 'overview' ? '#1f2937' : '#9ca3af'}
          />
          <Text style={[styles.tabText, activeTab === 'overview' && styles.tabTextActive]}>
            ภาพรวม
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === 'orders' && styles.tabActive]}
          onPress={() => setActiveTab('orders')}
        >
          <Ionicons
            name="receipt"
            size={20}
            color={activeTab === 'orders' ? '#1f2937' : '#9ca3af'}
          />
          <Text style={[styles.tabText, activeTab === 'orders' && styles.tabTextActive]}>
            รายงาน
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === 'reviews' && styles.tabActive]}
          onPress={() => setActiveTab('reviews')}
        >
          <Ionicons
            name="star"
            size={20}
            color={activeTab === 'reviews' ? '#1f2937' : '#9ca3af'}
          />
          <Text style={[styles.tabText, activeTab === 'reviews' && styles.tabTextActive]}>
            รีวิว
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {activeTab === 'overview' && (
          <>
            {/* Date Filters */}
            <View style={styles.filtersRow}>
              <TouchableOpacity style={styles.filterButton}>
                <Text style={styles.filterLabel}>เลือกเดือน</Text>
                <View style={styles.filterValueContainer}>
                  <Text style={styles.filterValue}>{selectedMonth}</Text>
                  <Ionicons name="chevron-down" size={16} color="#1f2937" />
                </View>
              </TouchableOpacity>

              <TouchableOpacity style={styles.filterButton}>
                <Text style={styles.filterLabel}>เลือกปี</Text>
                <View style={styles.filterValueContainer}>
                  <Text style={styles.filterValue}>{selectedYear}</Text>
                  <Ionicons name="chevron-down" size={16} color="#1f2937" />
                </View>
              </TouchableOpacity>
            </View>

            {/* Stats Cards */}
            <View style={styles.statsGrid}>
              <View style={styles.statCard}>
                <View style={styles.statIconContainer}>
                  <Ionicons name="cash-outline" size={24} color="#10b981" />
                </View>
                <Text style={styles.statValue}>฿ {stats.totalRevenue.toLocaleString()}</Text>
                <Text style={styles.statLabel}>รายได้</Text>
              </View>

              <View style={styles.statCard}>
                <View style={styles.statIconContainer}>
                  <Ionicons name="receipt-outline" size={24} color="#f59e0b" />
                </View>
                <Text style={styles.statValue}>{stats.totalOrders}</Text>
                <Text style={styles.statLabel}>ออเดอร์</Text>
              </View>
            </View>

            <View style={styles.statsGrid}>
              <View style={styles.statCard}>
                <View style={styles.statPercentBadge}>
                  <Text style={styles.statPercent}>{stats.completionRate}%</Text>
                </View>
                <Text style={styles.statValue}>{stats.completedOrders}</Text>
                <Text style={styles.statLabel}>สำเร็จ</Text>
              </View>

              <View style={styles.statCard}>
                <View style={styles.statRatingBadge}>
                  <Ionicons name="star" size={14} color="#f59e0b" />
                  <Text style={styles.statRating}>{stats.averageRating}</Text>
                </View>
                <Text style={styles.statValue}>{stats.averageRating.toFixed(1)}</Text>
                <Text style={styles.statLabel}>คะแนนเฉลี่ย</Text>
              </View>
            </View>

            {/* Top Products Section */}
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle2}>สินค้ายอดนิยม</Text>
              <TouchableOpacity onPress={() => navigation.navigate('MyShop')}>
                <Text style={styles.seeAllText}>ดูทั้งหมด</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.productsContainer}>
              {topProducts.map((product, index) => (
                <View key={product.id} style={styles.productRow}>
                  <View style={styles.productRank}>
                    <Text style={styles.productRankText}>#{index + 1}</Text>
                  </View>
                  <View style={styles.productInfo}>
                    <Text style={styles.productName} numberOfLines={1}>
                      {product.name}
                    </Text>
                    <Text style={styles.productSales}>
                      ขายได้ {product.soldCount} ชุด
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          </>
        )}

        {activeTab === 'orders' && (
          <>
            {/* Filters */}
            <View style={styles.filtersRow}>
              <TouchableOpacity style={styles.filterButton}>
                <Text style={styles.filterLabel}>เลือกเดือน</Text>
                <View style={styles.filterValueContainer}>
                  <Text style={styles.filterValue}>{selectedMonth}</Text>
                  <Ionicons name="chevron-down" size={16} color="#1f2937" />
                </View>
              </TouchableOpacity>

              <TouchableOpacity style={styles.filterButton}>
                <Text style={styles.filterLabel}>เลือกปี</Text>
                <View style={styles.filterValueContainer}>
                  <Text style={styles.filterValue}>{selectedYear}</Text>
                  <Ionicons name="chevron-down" size={16} color="#1f2937" />
                </View>
              </TouchableOpacity>
            </View>

            {/* Stats Summary */}
            <View style={styles.statsGrid}>
              <View style={styles.statCard}>
                <View style={styles.statIconContainer}>
                  <Ionicons name="cash-outline" size={24} color="#10b981" />
                </View>
                <Text style={styles.statValue}>฿ {stats.totalRevenue.toLocaleString()}</Text>
                <Text style={styles.statLabel}>รายได้</Text>
              </View>

              <View style={styles.statCard}>
                <View style={styles.statIconContainer}>
                  <Ionicons name="receipt-outline" size={24} color="#f59e0b" />
                </View>
                <Text style={styles.statValue}>{stats.totalOrders}</Text>
                <Text style={styles.statLabel}>ออเดอร์</Text>
              </View>
            </View>

            <View style={styles.statCard}>
              <View style={styles.statPercentBadge}>
                <Text style={styles.statPercent}>{stats.completionRate}%</Text>
              </View>
              <Text style={styles.statValue}>{stats.completedOrders}</Text>
              <Text style={styles.statLabel}>สำเร็จ</Text>
            </View>

            {/* Orders Table */}
            <View style={styles.tableContainer}>
              <View style={styles.tableHeader}>
                <Text style={[styles.tableHeaderText, { flex: 2 }]}>ชื่อเมนู</Text>
                <Text style={[styles.tableHeaderText, { flex: 1, textAlign: 'center' }]}>ขายได้</Text>
                <Text style={[styles.tableHeaderText, { flex: 1, textAlign: 'right' }]}>รายได้</Text>
              </View>

              {recentOrders.map((order) => (
                <View key={order.id} style={styles.tableRow}>
                  <Text style={[styles.tableCell, { flex: 2 }]} numberOfLines={1}>
                    {order.foodName || 'ไม่ระบุ'}
                  </Text>
                  <Text style={[styles.tableCell, { flex: 1, textAlign: 'center' }]}>
                    {order.quantity || 0} จาน
                  </Text>
                  <Text style={[styles.tableCell, { flex: 1, textAlign: 'right' }]}>
                    ฿ {(order.totalPrice || 0).toLocaleString()}
                  </Text>
                </View>
              ))}
            </View>
          </>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Bottom Navigation */}
      <View style={styles.bottomNav}>
        <TouchableOpacity
          style={styles.navItem}
          onPress={() => navigation.navigate('MyShop')}
        >
          <Ionicons name="storefront-outline" size={24} color="#9ca3af" />
          <Text style={styles.navLabel}>ร้านค้าของฉัน</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navItem}
          onPress={() => navigation.navigate('StoreOrders')}
        >
          <Ionicons name="list-outline" size={24} color="#9ca3af" />
          <Text style={styles.navLabel}>ออเดอร์</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.navItem}>
          <Ionicons name="notifications-outline" size={24} color="#9ca3af" />
          <Text style={styles.navLabel}>แจ้งเตือน</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navItem}
          onPress={() => navigation.navigate('Profile')}
        >
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
        <TouchableWithoutFeedback onPress={toggleDrawer}>
          <View style={styles.drawerOverlay}>
            <Animated.View style={[styles.drawerBackdrop, { opacity: fadeAnim }]} />
            <TouchableWithoutFeedback>
              <Animated.View style={[styles.drawerContainer, { transform: [{ translateX: slideAnim }] }]}>
                <DrawerContent />
              </Animated.View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
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
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 50 : 40,
    paddingBottom: 15,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 15,
  },
  menuButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#6b7280',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    paddingVertical: 10,
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: '#f9fafb',
  },
  tabActive: {
    backgroundColor: '#e5e7eb',
  },
  tabText: {
    fontSize: 13,
    color: '#9ca3af',
    fontWeight: '500',
  },
  tabTextActive: {
    color: '#1f2937',
    fontWeight: '600',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  filtersRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  filterButton: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  filterLabel: {
    fontSize: 11,
    color: '#6b7280',
    marginBottom: 4,
  },
  filterValueContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  filterValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#f3f4f6',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  statIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#f0fdf4',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  statValue: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#6b7280',
  },
  statPercentBadge: {
    backgroundColor: '#f0fdf4',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 8,
  },
  statPercent: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#10b981',
  },
  statRatingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#fffbeb',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 8,
  },
  statRating: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#f59e0b',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 15,
  },
  sectionTitle2: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  seeAllText: {
    fontSize: 13,
    color: '#10b981',
    fontWeight: '600',
  },
  productsContainer: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#f3f4f6',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  productRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  productRank: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f9fafb',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  productRankText: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#6b7280',
  },
  productInfo: {
    flex: 1,
  },
  productName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 2,
  },
  productSales: {
    fontSize: 12,
    color: '#6b7280',
  },
  tableContainer: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginTop: 20,
    borderWidth: 1,
    borderColor: '#f3f4f6',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  tableHeader: {
    flexDirection: 'row',
    paddingBottom: 12,
    borderBottomWidth: 2,
    borderBottomColor: '#e5e7eb',
    marginBottom: 8,
  },
  tableHeaderText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#6b7280',
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  tableCell: {
    fontSize: 13,
    color: '#1f2937',
  },
  bottomNav: {
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
  navLabel: {
    fontSize: 11,
    color: '#9ca3af',
  },
  // Drawer Styles
  drawerOverlay: {
    flex: 1,
    flexDirection: 'row',
  },
  drawerBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  drawerContainer: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: width * 0.80,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 2, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  drawerWrapper: {
    flex: 1,
    paddingTop: Platform.OS === 'ios' ? 50 : 40,
  },
  drawerContent: {
    flex: 1,
    paddingHorizontal: 20,
  },
  drawerTopHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  logoCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f0fdf4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  appName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  appSlogan: {
    fontSize: 12,
    color: '#6b7280',
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
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
    marginBottom: 20,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 15,
    marginBottom: 15,
  },
  drawerAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 1,
    borderColor: '#10b981',
    backgroundColor: '#f3f4f6',
  },
  drawerName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  drawerRole: {
    fontSize: 13,
    color: '#6b7280',
  },
  modeContainer: {
    flexDirection: 'row',
    gap: 10,
  },
  modeButtonActive: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 8,
    backgroundColor: '#10b981',
    borderRadius: 8,
  },
  modeButtonInactive: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 8,
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
  },
  modeTextActive: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#fff',
  },
  modeTextInactive: {
    fontSize: 11,
    color: '#6b7280',
  },
  sectionTitle: {
    fontSize: 13,
    color: '#9ca3af',
    marginBottom: 12,
    marginLeft: 5,
    marginTop: 10,
  },
  drawerMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingVertical: 12,
    paddingHorizontal: 5,
    marginBottom: 8,
    borderRadius: 8,
  },
  menuIconBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f9fafb',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 15,
  },
  drawerMenuText: {
    fontSize: 15,
    color: '#1f2937',
    fontWeight: '500',
  },
  drawerLogout: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 15,
    marginTop: 30,
    paddingHorizontal: 5,
    marginBottom: 30,
  },
  drawerLogoutText: {
    fontSize: 15,
    color: '#ef4444',
    fontWeight: 'bold',
  },
});