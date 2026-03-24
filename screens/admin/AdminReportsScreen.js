import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  RefreshControl,
  ActivityIndicator
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { db } from '../../firebase.config';
import { collection, getDocs } from 'firebase/firestore';
// ✅ 1. Import SafeArea
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function AdminReportsScreen({ navigation }) {
  // ✅ 2. ดึง insets
  const insets = useSafeAreaInsets();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // ตัวเลือกช่วงเวลา
  const periods = [
    { label: 'วันนี้', value: 'today' },
    { label: '7 วัน', value: 'week' },
    { label: 'เดือนนี้', value: 'month' },
    { label: 'ทั้งหมด', value: 'all' }
  ];
  const [selectedPeriod, setSelectedPeriod] = useState('all');

  const [stats, setStats] = useState({
    totalUsers: 0,
    totalStores: 0,
    totalOrders: 0,
    totalRevenue: 0,
    // เพิ่มตัวแปรสำหรับ Waste
    totalWasteSaved: 0, // หน่วย kg
    totalCo2Saved: 0,   // หน่วย kgCO2e
  });

  const [topStores, setTopStores] = useState([]);

  useFocusEffect(
    useCallback(() => {
      fetchReportData();
    }, [selectedPeriod])
  );

  const fetchReportData = async () => {
    try {
      // 1. ดึงข้อมูล User & Store
      const usersSnapshot = await getDocs(collection(db, 'users'));
      const allUsers = usersSnapshot.docs.map(doc => doc.data());
      const totalUsers = usersSnapshot.size;
      const totalStores = allUsers.filter(u => u.currentRole === 'store').length;

      // 2. ดึงข้อมูล Orders และคำนวณ
      let totalRevenue = 0;
      let totalOrders = 0;
      let totalWasteSaved = 0; // ตัวแปรสะสมขยะ
      const storePerformance = {};

      try {
        const ordersSnapshot = await getDocs(collection(db, 'orders'));

        // กำหนดช่วงเวลา
        const now = new Date();
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        const startOfWeek = new Date(startOfDay);
        startOfWeek.setDate(startOfWeek.getDate() - 7);

        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

        ordersSnapshot.forEach(doc => {
          const order = doc.data();
          const orderDate = order.createdAt ? new Date(order.createdAt) : new Date(0);

          // เช็คเงื่อนไขเวลา
          let isTimeMatch = true;
          if (selectedPeriod === 'today') isTimeMatch = orderDate >= startOfDay;
          else if (selectedPeriod === 'week') isTimeMatch = orderDate >= startOfWeek;
          else if (selectedPeriod === 'month') isTimeMatch = orderDate >= startOfMonth;

          // เช็คสถานะ (completed)
          const isCompleted = order.status === 'completed' || !order.status;

          if (isCompleted && isTimeMatch) {
            const price = Number(order.totalPrice) || Number(order.price) || 0;
            totalRevenue += price;
            totalOrders += 1;

            // --- 🧮 ส่วนคำนวณ Waste (สูตร) ---
            // สมมติ: 1 ออเดอร์ = อาหารประมาณ 0.5 kg (หรือถ้าใน order มี field 'weight' ก็ใช้ได้เลย)
            // สูตร: waste = จำนวนออเดอร์ * 0.5
            const estimatedWeight = 0.5;
            totalWasteSaved += estimatedWeight;

            // เก็บสถิติรายร้าน
            const storeId = order.storeId || 'unknown';
            const storeName = order.storeName || order.restaurantName || 'ไม่ระบุร้าน';

            if (!storePerformance[storeId]) {
              storePerformance[storeId] = {
                name: storeName,
                revenue: 0,
                orders: 0
              };
            }
            storePerformance[storeId].revenue += price;
            storePerformance[storeId].orders += 1;
          }
        });
      } catch (e) {
        console.log('ยังไม่มี collection orders หรือดึงข้อมูลผิดพลาด', e);
      }

      // --- 🌍 คำนวณ Carbon Footprint ---
      // สูตร: 1 kg Food Waste = 2.53 kg CO2e (ค่าโดยประมาณ)
      const totalCo2Saved = totalWasteSaved * 2.53;

      // 3. จัดอันดับ Top 5 ร้านค้า
      const sortedStores = Object.values(storePerformance)
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 5)
        .map((store, index) => ({
          rank: index + 1,
          ...store
        }));

      setStats({
        totalUsers,
        totalStores,
        totalOrders,
        totalRevenue,
        totalWasteSaved: parseFloat(totalWasteSaved.toFixed(2)), // ทศนิยม 2 ตำแหน่ง
        totalCo2Saved: parseFloat(totalCo2Saved.toFixed(2)),
      });

      setTopStores(sortedStores);

    } catch (error) {
      console.error('Error fetching report:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchReportData();
  };

  // --- Components ---

  const FilterTabs = () => (
    <View style={styles.filterContainer}>
      {periods.map((item) => (
        <TouchableOpacity
          key={item.value}
          style={[styles.filterChip, selectedPeriod === item.value && styles.filterChipActive]}
          onPress={() => setSelectedPeriod(item.value)}
        >
          <Text style={[styles.filterText, selectedPeriod === item.value && styles.filterTextActive]}>
            {item.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  const SummaryCard = ({ icon, title, value, color }) => (
    <View style={styles.summaryCard}>
      <View style={[styles.iconBox, { backgroundColor: `${color}15` }]}>
        <Ionicons name={icon} size={22} color={color} />
      </View>
      <View style={styles.summaryContent}>
        <Text style={styles.summaryValue}>{value}</Text>
        <Text style={styles.summaryTitle}>{title}</Text>
      </View>
    </View>
  );

  // การ์ด Impact แบบใหม่
  const ImpactCard = ({ icon, title, value, unit, color, bgColor }) => (
    <View style={[styles.impactCard, { backgroundColor: bgColor, borderColor: color }]}>
        <View style={styles.impactHeader}>
            <Ionicons name={icon} size={24} color={color} />
            <Text style={[styles.impactTitle, { color }]}>{title}</Text>
        </View>
        <Text style={[styles.impactValue, { color }]}>
            {value} <Text style={styles.impactUnit}>{unit}</Text>
        </Text>
        <Text style={styles.impactSub}>ช่วยโลกได้จากการลดขยะอาหาร</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#f9fafb" />

      {/* Header */}
      {/* ✅ 3. ดัน Header ลง */}
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 15) }]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="chevron-back" size={24} color="#1f2937" />
        </TouchableOpacity>
        <View>
          <Text style={styles.headerTitle}>สถิติและรายงาน</Text>
          <Text style={styles.headerSubtitle}>ภาพรวมประสิทธิภาพระบบ</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={styles.content}
        // ✅ 4. เพิ่มระยะล่างของ ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 90 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Filter Section */}
        <FilterTabs />

        {/* 🌍 Waste Impact Section (NEW) */}
        <View style={styles.sectionContainer}>
             <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>🌱 ผลลัพธ์ทางสิ่งแวดล้อม</Text>
             </View>
             <View style={styles.row}>
                <View style={{flex: 1}}>
                    <ImpactCard
                        icon="leaf"
                        title="ลดขยะอาหาร"
                        value={stats.totalWasteSaved}
                        unit="kg"
                        color="#15803d" // สีเขียวเข้ม
                        bgColor="#f0fdf4"
                    />
                </View>
                <View style={{width: 12}} />
                <View style={{flex: 1}}>
                    <ImpactCard
                        icon="cloud-done"
                        title="ลดคาร์บอน"
                        value={stats.totalCo2Saved}
                        unit="kgCO₂"
                        color="#0e7490" // สีฟ้าเข้ม
                        bgColor="#ecfeff"
                    />
                </View>
             </View>
        </View>

        {/* Dashboard Grid */}
        <View style={styles.gridContainer}>
          {/* Revenue (Full Width) */}
          <View style={[styles.summaryCard, styles.revenueCard]}>
            <View style={styles.revenueHeader}>
              <View style={[styles.iconBox, { backgroundColor: '#dcfce7' }]}>
                <Ionicons name="wallet" size={24} color="#16a34a" />
              </View>
              <Text style={styles.revenueLabel}>รายได้รวม</Text>
            </View>
            <Text style={styles.revenueValue}>฿ {stats.totalRevenue.toLocaleString()}</Text>
          </View>

          {/* Small Cards */}
          <View style={styles.row}>
            <SummaryCard
              icon="receipt"
              title="คำสั่งซื้อ"
              value={stats.totalOrders}
              color="#2563eb"
            />
            <SummaryCard
              icon="storefront"
              title="ร้านค้า"
              value={stats.totalStores}
              color="#d97706"
            />
          </View>

          <View style={styles.row}>
            <SummaryCard
              icon="people"
              title="ผู้ใช้งาน"
              value={stats.totalUsers}
              color="#6366f1"
            />
            <SummaryCard
              icon="trending-up"
              title="เฉลี่ย/บิล"
              value={`฿${stats.totalOrders > 0 ? (stats.totalRevenue / stats.totalOrders).toFixed(0) : 0}`}
              color="#db2777"
            />
          </View>
        </View>

        {/* Top 5 Table */}
        <View style={styles.sectionContainer}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>🏆 5 อันดับร้านค้าขายดี</Text>
          </View>

          <View style={styles.tableCard}>
            {/* Table Head */}
            <View style={styles.tableHeader}>
              <Text style={[styles.th, { flex: 0.8, textAlign: 'center' }]}>#</Text>
              <Text style={[styles.th, { flex: 3 }]}>ร้านค้า</Text>
              <Text style={[styles.th, { flex: 1.5, textAlign: 'center' }]}>ออเดอร์</Text>
              <Text style={[styles.th, { flex: 2, textAlign: 'right' }]}>ยอดขาย</Text>
            </View>
            <View style={styles.divider} />

            {/* Table Body */}
            {topStores.length > 0 ? (
              topStores.map((store, index) => (
                <View key={index}>
                  <View style={styles.tableRow}>
                    <View style={styles.rankContainer}>
                      {index < 3 ? (
                        <Ionicons
                          name="medal"
                          size={20}
                          color={index === 0 ? '#f59e0b' : index === 1 ? '#9ca3af' : '#b45309'}
                        />
                      ) : (
                        <Text style={styles.rankText}>{store.rank}</Text>
                      )}
                    </View>
                    <Text style={[styles.td, { flex: 3, fontWeight: '500' }]} numberOfLines={1}>{store.name}</Text>
                    <Text style={[styles.td, { flex: 1.5, textAlign: 'center' }]}>{store.orders}</Text>
                    <Text style={[styles.tdRevenue, { flex: 2, textAlign: 'right' }]}>{store.revenue.toLocaleString()}</Text>
                  </View>
                  {index < topStores.length - 1 && <View style={styles.rowDivider} />}
                </View>
              ))
            ) : (
              <View style={styles.emptyState}>
                <Text style={styles.emptyText}>ไม่มีข้อมูลการขายในช่วงเวลานี้</Text>
              </View>
            )}
          </View>
        </View>
      </ScrollView>

      {/* Bottom Nav */}
      {/* ✅ 5. ดัน Bottom Nav ขึ้น */}
      <View style={[styles.bottomNav, { paddingBottom: Math.max(insets.bottom, 8) }]}>
        <TouchableOpacity style={styles.navItem} onPress={() => navigation.navigate('AdminHome')}>
          <Ionicons name="home-outline" size={24} color="#9ca3af" />
          <Text style={styles.navLabel}>หน้าหลัก</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.navItem} onPress={() => navigation.navigate('AdminUsers')}>
          <Ionicons name="people-outline" size={24} color="#9ca3af" />
          <Text style={styles.navLabel}>บัญชี</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.navItem} onPress={() => navigation.navigate('AdminReports')}>
          <Ionicons name="stats-chart" size={24} color="#1f2937" />
          <Text style={styles.navLabelActive}>รายงาน</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.navItem} onPress={() => navigation.navigate('AdminProfile')}>
          <Ionicons name="person-outline" size={24} color="#9ca3af" />
          <Text style={styles.navLabel}>โปรไฟล์</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  // 🟢 ลบ paddingTop ออก
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingBottom: 15, backgroundColor: '#fff',
    borderBottomWidth: 1, borderBottomColor: '#f3f4f6'
  },
  backButton: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: '#f3f4f6',
    alignItems: 'center', justifyContent: 'center'
  },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#1f2937', textAlign: 'center' },
  headerSubtitle: { fontSize: 12, color: '#6b7280', textAlign: 'center' },
  content: { flex: 1, padding: 20 },

  // Filter
  filterContainer: {
    flexDirection: 'row', backgroundColor: '#fff', padding: 4, borderRadius: 12,
    marginBottom: 20, borderWidth: 1, borderColor: '#e5e7eb'
  },
  filterChip: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 8 },
  filterChipActive: { backgroundColor: '#1f2937', shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 2 },
  filterText: { fontSize: 13, color: '#6b7280', fontWeight: '500' },
  filterTextActive: { color: '#fff', fontWeight: '600' },

  // Impact Section (New)
  sectionContainer: { marginBottom: 20 },
  sectionHeader: { marginBottom: 12 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#1f2937' },

  impactCard: {
    padding: 16, borderRadius: 16, borderWidth: 1,
    alignItems: 'flex-start', minHeight: 120, justifyContent: 'space-between'
  },
  impactHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  impactTitle: { fontSize: 14, fontWeight: '600' },
  impactValue: { fontSize: 24, fontWeight: '800' },
  impactUnit: { fontSize: 14, fontWeight: '500' },
  impactSub: { fontSize: 11, color: '#64748b', marginTop: 4 },

  // Grid
  gridContainer: { gap: 12, marginBottom: 25 },
  row: { flexDirection: 'row', gap: 12 },

  // Cards
  summaryCard: {
    flex: 1, backgroundColor: '#fff', padding: 16, borderRadius: 16,
    borderWidth: 1, borderColor: '#e5e7eb',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.02, shadowRadius: 8, elevation: 1
  },
  revenueCard: { padding: 20, backgroundColor: '#fff', borderLeftWidth: 4, borderLeftColor: '#16a34a' },
  revenueHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, gap: 10 },
  revenueLabel: { fontSize: 14, color: '#6b7280', fontWeight: '500' },
  revenueValue: { fontSize: 28, fontWeight: '700', color: '#1f2937' },

  iconBox: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  summaryValue: { fontSize: 20, fontWeight: '700', color: '#1f2937' },
  summaryTitle: { fontSize: 12, color: '#6b7280', marginTop: 2 },

  // Table
  tableCard: {
    backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: '#e5e7eb',
    overflow: 'hidden'
  },
  tableHeader: {
    flexDirection: 'row', backgroundColor: '#f9fafb', paddingVertical: 12, paddingHorizontal: 16
  },
  th: { fontSize: 12, fontWeight: '600', color: '#6b7280' },
  tableRow: {
    flexDirection: 'row', paddingVertical: 14, paddingHorizontal: 16, alignItems: 'center'
  },
  td: { fontSize: 13, color: '#1f2937' },
  tdRevenue: { fontSize: 13, color: '#10b981', fontWeight: '600' },
  divider: { height: 1, backgroundColor: '#e5e7eb' },
  rowDivider: { height: 1, backgroundColor: '#f3f4f6', marginLeft: 50 },

  rankContainer: { flex: 0.8, alignItems: 'center' },
  rankText: { fontSize: 13, fontWeight: '600', color: '#6b7280' },

  emptyState: { padding: 30, alignItems: 'center' },
  emptyText: { color: '#9ca3af', fontStyle: 'italic' },

  // Bottom Nav
  // 🟢 เปลี่ยน paddingVertical เป็น paddingTop
  bottomNav: {
    flexDirection: 'row', backgroundColor: '#fff', paddingTop: 8,
    paddingHorizontal: 16, borderTopWidth: 1, borderTopColor: '#f3f4f6',
    position: 'absolute', bottom: 0, left: 0, right: 0
  },
  navItem: { flex: 1, alignItems: 'center', paddingVertical: 8 },
  navLabel: { fontSize: 11, color: '#9ca3af', marginTop: 4 },
  navLabelActive: { fontSize: 11, color: '#1f2937', fontWeight: '600', marginTop: 4 },
});