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
import { collection, getDocs, query, where, doc, getDoc } from 'firebase/firestore';

const { width } = Dimensions.get('window');

export default function StoreDashboardScreen({ navigation }) {
  const [storeData, setStoreData] = useState(null);
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('overview'); // overview, orders, reviews
  const [selectedPeriod, setSelectedPeriod] = useState('today'); // today, week, month, all
  const [showPeriodModal, setShowPeriodModal] = useState(false);
  const [allOrders, setAllOrders] = useState([]);

  // Report table filters (month + year)
  const [reportMonth, setReportMonth] = useState(new Date().getMonth()); // 0-11
  const [reportYear, setReportYear] = useState(new Date().getFullYear());
  const [showMonthModal, setShowMonthModal] = useState(false);
  const [showYearModal, setShowYearModal] = useState(false);

  const monthNames = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
  const currentYear = new Date().getFullYear();
  const yearOptions = [currentYear, currentYear - 1, currentYear - 2];

  const filteredTableOrders = allOrders.filter(o => {
    const d = o.createdAt?.toDate ? o.createdAt.toDate() : new Date(o.createdAt ?? 0);
    return d.getMonth() === reportMonth && d.getFullYear() === reportYear;
  });

  const tableRevenue = filteredTableOrders
    .filter(o => o.status === 'completed' || o.status === 'confirmed')
    .reduce((sum, o) => sum + (Number(o.totalPrice) || 0), 0);

  const periodOptions = [
    { key: 'today', label: 'วันนี้' },
    { key: 'week', label: 'สัปดาห์นี้' },
    { key: 'month', label: 'เดือนนี้' },
    { key: 'all', label: 'ทั้งหมด' },
  ];

  const getPeriodLabel = () => periodOptions.find(p => p.key === selectedPeriod)?.label || 'วันนี้';

  // Statistics
  const [stats, setStats] = useState({
    totalRevenue: 0,
    confirmedRevenue: 0,
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

  useEffect(() => {
    if (allOrders.length >= 0) {
      calculateStats(allOrders, selectedPeriod);
    }
  }, [selectedPeriod, allOrders]);

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

      // Load user data
      const userDocRef = doc(db, 'users', user.uid);
      const userDoc = await getDoc(userDocRef);
      if (userDoc.exists()) {
        setUserData(userDoc.data());
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

  const filterOrdersByPeriod = (orders, period) => {
    const now = new Date();
    return orders.filter(o => {
      const createdAt = o.createdAt?.toDate ? o.createdAt.toDate() : new Date(o.createdAt);
      if (!createdAt || isNaN(createdAt)) return period === 'all';
      if (period === 'today') {
        return createdAt.toDateString() === now.toDateString();
      } else if (period === 'week') {
        const weekAgo = new Date(now); weekAgo.setDate(weekAgo.getDate() - 7);
        return createdAt >= weekAgo;
      } else if (period === 'month') {
        return createdAt.getMonth() === now.getMonth() && createdAt.getFullYear() === now.getFullYear();
      }
      return true; // 'all'
    });
  };

  const calculateStats = (orders, period = selectedPeriod) => {
    const filtered = filterOrdersByPeriod(orders, period);
    const totalOrders = filtered.length;
    const completedOrders = filtered.filter(o => o.status === 'completed').length;
    // รายได้จาก completed + confirmed (ยืนยันแล้วรอรับ)
    const totalRevenue = filtered
      .filter(o => o.status === 'completed' || o.status === 'confirmed')
      .reduce((sum, o) => sum + (Number(o.totalPrice) || 0), 0);
    const confirmedRevenue = filtered
      .filter(o => o.status === 'confirmed')
      .reduce((sum, o) => sum + (Number(o.totalPrice) || 0), 0);
    const completionRate = totalOrders > 0 ? Math.round((completedOrders / totalOrders) * 100) : 0;
    const ordersWithRating = filtered.filter(o => o.rating && o.rating > 0);
    const averageRating = ordersWithRating.length > 0
      ? (ordersWithRating.reduce((sum, o) => sum + o.rating, 0) / ordersWithRating.length).toFixed(1)
      : 0;
    setStats({ totalRevenue, confirmedRevenue, totalOrders, completedOrders, completionRate, averageRating: parseFloat(averageRating) });
  };

  const loadOrderStats = async (userId) => {
    try {
      const ordersQuery = query(collection(db, 'orders'), where('storeId', '==', userId));
      const ordersSnapshot = await getDocs(ordersQuery);
      const orders = ordersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setAllOrders(orders);
      calculateStats(orders, selectedPeriod); // pass period explicitly to avoid stale closure
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
      // ไม่ใช้ orderBy ร่วมกับ where เพื่อหลีกเลี่ยง Firestore composite index error
      const ordersQuery = query(
        collection(db, 'orders'),
        where('storeId', '==', userId)
      );
      const ordersSnapshot = await getDocs(ordersQuery);

      // Sort ใน JavaScript แทน
      const sortedDocs = ordersSnapshot.docs.sort((a, b) => {
        const aTime = a.data().createdAt?.toDate?.() ?? new Date(a.data().createdAt ?? 0);
        const bTime = b.data().createdAt?.toDate?.() ?? new Date(b.data().createdAt ?? 0);
        return bTime - aTime;
      });

      const ordersList = [];
      for (const docSnap of sortedDocs.slice(0, 10)) {
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
              {storeData?.storeImage
                ? <Image source={{ uri: storeData.storeImage }} style={{ width: 40, height: 40, borderRadius: 20 }} />
                : <Ionicons name="storefront" size={24} color="#10b981" />
              }
            </View>
            <View>
              <Text style={styles.appName}>{storeData?.storeName || 'ร้านค้าของฉัน'}</Text>
              <Text style={styles.appSlogan}>
                {storeData?.category || 'Dashboard ร้านค้า'}
              </Text>
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
              <Text style={styles.drawerRole}>
                เจ้าของ: {userData?.username || userData?.displayName || 'ผู้ใช้'}
              </Text>
              {storeData?.phone ? (
                <Text style={[styles.drawerRole, { fontSize: 11 }]}>
                  <Ionicons name="call-outline" size={11} color="#6b7280" /> {storeData.phone}
                </Text>
              ) : null}
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
            <Text style={styles.headerTitle}>{storeData?.storeName || 'ร้านค้าของฉัน'}</Text>
            <Text style={styles.headerSubtitle}>
              {storeData?.category ? `${storeData.category} · ` : ''}Dashboard ร้านค้า
            </Text>
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
            {/* Period Filter */}
            <View style={styles.filtersRow}>
              <TouchableOpacity style={styles.filterButton} onPress={() => setShowPeriodModal(true)}>
                <Text style={styles.filterLabel}>ช่วงเวลา</Text>
                <View style={styles.filterValueContainer}>
                  <Text style={styles.filterValue}>{getPeriodLabel()}</Text>
                  <Ionicons name="chevron-down" size={16} color="#1f2937" />
                </View>
              </TouchableOpacity>

              {/* Revenue highlight */}
              <View style={[styles.filterButton, { backgroundColor: '#f0fdf4', borderColor: '#10b981', borderWidth: 1 }]}>
                <Text style={[styles.filterLabel, { color: '#10b981' }]}>รายได้ {getPeriodLabel()}</Text>
                <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#10b981' }}>
                  ฿{stats.totalRevenue.toLocaleString()}
                </Text>
              </View>
            </View>

            {/* Period Modal */}
            <Modal visible={showPeriodModal} transparent animationType="fade" onRequestClose={() => setShowPeriodModal(false)}>
              <TouchableWithoutFeedback onPress={() => setShowPeriodModal(false)}>
                <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' }}>
                  <TouchableWithoutFeedback>
                    <View style={{ backgroundColor: '#fff', borderRadius: 16, padding: 20, width: width * 0.7 }}>
                      <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#1f2937', marginBottom: 15 }}>เลือกช่วงเวลา</Text>
                      {periodOptions.map(opt => (
                        <TouchableOpacity
                          key={opt.key}
                          onPress={() => { setSelectedPeriod(opt.key); setShowPeriodModal(false); }}
                          style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' }}
                        >
                          <Ionicons
                            name={selectedPeriod === opt.key ? 'radio-button-on' : 'radio-button-off'}
                            size={20} color={selectedPeriod === opt.key ? '#10b981' : '#9ca3af'}
                          />
                          <Text style={{ marginLeft: 12, fontSize: 15, color: selectedPeriod === opt.key ? '#10b981' : '#1f2937', fontWeight: selectedPeriod === opt.key ? '600' : '400' }}>
                            {opt.label}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </TouchableWithoutFeedback>
                </View>
              </TouchableWithoutFeedback>
            </Modal>

            {/* Stats Cards */}
            <View style={styles.statsGrid}>
              <View style={[styles.statCard, { borderLeftWidth: 3, borderLeftColor: '#10b981' }]}>
                <View style={styles.statIconContainer}>
                  <Ionicons name="cash-outline" size={24} color="#10b981" />
                </View>
                <Text style={styles.statValue}>฿{stats.totalRevenue.toLocaleString()}</Text>
                <Text style={styles.statLabel}>รายได้</Text>
                {stats.confirmedRevenue > 0 && (
                  <Text style={{ fontSize: 10, color: '#f59e0b', marginTop: 2 }}>
                    รอรับ ฿{stats.confirmedRevenue.toLocaleString()}
                  </Text>
                )}
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
            {/* ── Revenue Hero Card ── */}
            <View style={rStyles.heroCard}>
              <View style={rStyles.heroTop}>
                <View>
                  <Text style={rStyles.heroLabel}>รายได้ทั้งหมด</Text>
                  <Text style={rStyles.heroValue}>฿{stats.totalRevenue.toLocaleString()}</Text>
                </View>
                <View style={rStyles.heroIcon}>
                  <Ionicons name="trending-up" size={28} color="#10b981" />
                </View>
              </View>
              <View style={rStyles.heroStats}>
                <View style={rStyles.heroStatItem}>
                  <Text style={rStyles.heroStatNum}>{stats.totalOrders}</Text>
                  <Text style={rStyles.heroStatLbl}>ออเดอร์</Text>
                </View>
                <View style={rStyles.heroStatDivider} />
                <View style={rStyles.heroStatItem}>
                  <Text style={rStyles.heroStatNum}>{stats.completedOrders}</Text>
                  <Text style={rStyles.heroStatLbl}>สำเร็จ</Text>
                </View>
                <View style={rStyles.heroStatDivider} />
                <View style={rStyles.heroStatItem}>
                  <Text style={rStyles.heroStatNum}>{stats.completionRate}%</Text>
                  <Text style={rStyles.heroStatLbl}>อัตราสำเร็จ</Text>
                </View>
              </View>
            </View>

            {/* ── Report Section Header ── */}
            <View style={rStyles.sectionRow}>
              <Text style={rStyles.sectionTitle}>รายงานรายเดือน</Text>
              <View style={rStyles.filterPills}>
                <TouchableOpacity style={rStyles.pill} onPress={() => setShowMonthModal(true)}>
                  <Ionicons name="calendar-outline" size={13} color="#10b981" />
                  <Text style={rStyles.pillText}>{monthNames[reportMonth]}</Text>
                  <Ionicons name="chevron-down" size={12} color="#10b981" />
                </TouchableOpacity>
                <TouchableOpacity style={rStyles.pill} onPress={() => setShowYearModal(true)}>
                  <Text style={rStyles.pillText}>{reportYear}</Text>
                  <Ionicons name="chevron-down" size={12} color="#10b981" />
                </TouchableOpacity>
              </View>
            </View>

            {/* ── Revenue for selected month ── */}
            <View style={rStyles.monthRevenueRow}>
              <View style={rStyles.monthRevLeft}>
                <Text style={rStyles.monthRevLabel}>รายได้ {monthNames[reportMonth]} {reportYear}</Text>
                <Text style={rStyles.monthRevValue}>฿{tableRevenue.toLocaleString()}</Text>
              </View>
              <View style={rStyles.monthRevRight}>
                <Text style={rStyles.monthRevCount}>{filteredTableOrders.length} ออเดอร์</Text>
              </View>
            </View>

            {/* Month Modal */}
            <Modal visible={showMonthModal} transparent animationType="fade" onRequestClose={() => setShowMonthModal(false)}>
              <TouchableWithoutFeedback onPress={() => setShowMonthModal(false)}>
                <View style={rStyles.modalOverlay}>
                  <TouchableWithoutFeedback>
                    <View style={rStyles.modalBox}>
                      <Text style={rStyles.modalTitle}>เลือกเดือน</Text>
                      <View style={rStyles.monthGrid}>
                        {monthNames.map((m, i) => (
                          <TouchableOpacity
                            key={i}
                            onPress={() => { setReportMonth(i); setShowMonthModal(false); }}
                            style={[rStyles.monthChip, reportMonth === i && rStyles.monthChipActive]}
                          >
                            <Text style={[rStyles.monthChipText, reportMonth === i && rStyles.monthChipTextActive]}>
                              {m}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>
                  </TouchableWithoutFeedback>
                </View>
              </TouchableWithoutFeedback>
            </Modal>

            {/* Year Modal */}
            <Modal visible={showYearModal} transparent animationType="fade" onRequestClose={() => setShowYearModal(false)}>
              <TouchableWithoutFeedback onPress={() => setShowYearModal(false)}>
                <View style={rStyles.modalOverlay}>
                  <TouchableWithoutFeedback>
                    <View style={[rStyles.modalBox, { width: width * 0.55 }]}>
                      <Text style={rStyles.modalTitle}>เลือกปี</Text>
                      {yearOptions.map(y => (
                        <TouchableOpacity
                          key={y}
                          onPress={() => { setReportYear(y); setShowYearModal(false); }}
                          style={rStyles.yearRow}
                        >
                          <View style={[rStyles.yearRadio, reportYear === y && rStyles.yearRadioActive]}>
                            {reportYear === y && <View style={rStyles.yearRadioDot} />}
                          </View>
                          <Text style={[rStyles.yearText, reportYear === y && rStyles.yearTextActive]}>{y}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </TouchableWithoutFeedback>
                </View>
              </TouchableWithoutFeedback>
            </Modal>

            {/* ── Orders Table ── */}
            <View style={rStyles.tableCard}>
              {/* Table Header */}
              <View style={rStyles.tableHead}>
                <Text style={[rStyles.tableHeadCell, { flex: 2 }]}>เมนู</Text>
                <Text style={[rStyles.tableHeadCell, { flex: 1, textAlign: 'center' }]}>จำนวน</Text>
                <Text style={[rStyles.tableHeadCell, { flex: 1, textAlign: 'right' }]}>รายได้</Text>
              </View>

              {filteredTableOrders.length === 0 ? (
                <View style={rStyles.emptyState}>
                  <View style={rStyles.emptyIcon}>
                    <Ionicons name="receipt-outline" size={32} color="#10b981" />
                  </View>
                  <Text style={rStyles.emptyTitle}>ยังไม่มีออเดอร์</Text>
                  <Text style={rStyles.emptySubtitle}>ไม่พบข้อมูลใน{monthNames[reportMonth]} {reportYear}</Text>
                </View>
              ) : (
                filteredTableOrders.map((order, index) => (
                  <View key={order.id} style={[rStyles.tableRow, index % 2 === 0 && rStyles.tableRowAlt]}>
                    <View style={{ flex: 2, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <View style={rStyles.rowDot} />
                      <Text style={rStyles.tableCell} numberOfLines={1}>{order.foodName || 'ไม่ระบุ'}</Text>
                    </View>
                    <View style={{ flex: 1, alignItems: 'center' }}>
                      <View style={rStyles.qtyBadge}>
                        <Text style={rStyles.qtyText}>{order.quantity || 0}</Text>
                      </View>
                    </View>
                    <Text style={[rStyles.tableCell, rStyles.priceCell, { flex: 1, textAlign: 'right' }]}>
                      ฿{(order.totalPrice || 0).toLocaleString()}
                    </Text>
                  </View>
                ))
              )}

              {filteredTableOrders.length > 0 && (
                <View style={rStyles.tableFoot}>
                  <Text style={rStyles.tableFootLabel}>รวมทั้งหมด</Text>
                  <Text style={rStyles.tableFootValue}>฿{tableRevenue.toLocaleString()}</Text>
                </View>
              )}
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

// ─── Report Tab Styles ───────────────────────────────────────────
const rStyles = StyleSheet.create({
  // Hero card
  heroCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#e6faf4',
  },
  heroTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  heroLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 4,
    letterSpacing: 0.5,
  },
  heroValue: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#064e3b',
    letterSpacing: -0.5,
  },
  heroIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#f0fdf4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroStats: {
    flexDirection: 'row',
    backgroundColor: '#f9fafb',
    borderRadius: 14,
    padding: 14,
  },
  heroStatItem: {
    flex: 1,
    alignItems: 'center',
  },
  heroStatDivider: {
    width: 1,
    backgroundColor: '#e5e7eb',
    marginVertical: 4,
  },
  heroStatNum: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  heroStatLbl: {
    fontSize: 11,
    color: '#9ca3af',
    marginTop: 2,
  },
  // Section header
  sectionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  filterPills: {
    flexDirection: 'row',
    gap: 8,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#a7f3d0',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  pillText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#10b981',
  },
  // Month revenue summary
  monthRevenueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f0fdf4',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#a7f3d0',
  },
  monthRevLeft: {},
  monthRevLabel: {
    fontSize: 11,
    color: '#059669',
    marginBottom: 2,
  },
  monthRevValue: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#064e3b',
  },
  monthRevRight: {
    backgroundColor: '#fff',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  monthRevCount: {
    fontSize: 12,
    fontWeight: '600',
    color: '#10b981',
  },
  // Table card
  tableCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#f3f4f6',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
    marginBottom: 20,
  },
  tableHead: {
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#064e3b',
  },
  tableHeadCell: {
    fontSize: 12,
    fontWeight: '700',
    color: '#a7f3d0',
    letterSpacing: 0.3,
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 13,
    paddingHorizontal: 16,
  },
  tableRowAlt: {
    backgroundColor: '#fafafa',
  },
  rowDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#d1fae5',
  },
  tableCell: {
    fontSize: 13,
    color: '#374151',
  },
  priceCell: {
    fontWeight: '600',
    color: '#1f2937',
  },
  qtyBadge: {
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  qtyText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
  },
  tableFoot: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderTopWidth: 2,
    borderTopColor: '#f3f4f6',
    backgroundColor: '#f9fafb',
  },
  tableFootLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6b7280',
  },
  tableFootValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#10b981',
  },
  // Empty state
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#f0fdf4',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 4,
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#9ca3af',
    textAlign: 'center',
  },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalBox: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 22,
    width: width * 0.78,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 16,
  },
  monthGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  monthChip: {
    width: '30%',
    paddingVertical: 11,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  monthChipActive: {
    backgroundColor: '#10b981',
    borderColor: '#059669',
  },
  monthChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
  },
  monthChipTextActive: {
    color: '#fff',
  },
  yearRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
    gap: 12,
  },
  yearRadio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#d1d5db',
    alignItems: 'center',
    justifyContent: 'center',
  },
  yearRadioActive: {
    borderColor: '#10b981',
  },
  yearRadioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#10b981',
  },
  yearText: {
    fontSize: 15,
    color: '#6b7280',
  },
  yearTextActive: {
    color: '#10b981',
    fontWeight: '700',
  },
});

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