import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, StatusBar, ActivityIndicator, Modal
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { auth, db } from '../../firebase.config';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';

export default function StoreImpactHistoryScreen({ navigation, route }) {
  const initialTab = route.params?.initialTab || 'food';
  const insets = useSafeAreaInsets();

  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [totalImpact, setTotalImpact] = useState(0);
  const [activeTab, setActiveTab] = useState(initialTab);
  const [infoModalVisible, setInfoModalVisible] = useState(false);

  useEffect(() => { fetchHistory(); }, []);

  const fetchHistory = async () => {
    try {
      const user = auth.currentUser;
      if (!user) return;

      // 🟢 ดึงข้อมูลออเดอร์ที่สถานะ completed และเป็นของร้านค้านี้ (storeId)
      const q = query(collection(db, 'orders'), where('storeId', '==', user.uid), where('status', '==', 'completed'));
      const snapshot = await getDocs(q);

      const historyData = [];
      let calculatedTotal = 0;

      for (const document of snapshot.docs) {
        const data = document.data();
        const rawWeight = data.totalOrderWeight || 0;
        const weightSaved = Math.round(rawWeight * 100) / 100;
        calculatedTotal += weightSaved;

        // หาชื่อลูกค้ามาแสดง (ถ้ามี)
        let customerName = 'ลูกค้า';
        if (data.userId) {
          try {
             const userDoc = await getDoc(doc(db, 'users', data.userId));
             if (userDoc.exists()) {
                 customerName = userDoc.data().username || userDoc.data().displayName || 'ลูกค้า';
             }
          } catch(e) { console.log('Error fetching user info'); }
        }

        historyData.push({ id: document.id, ...data, weightSaved: weightSaved, customerName });
      }

      historyData.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      setTotalImpact(calculatedTotal);
      setHistory(historyData);
    } catch (error) {
      console.error('Error fetching store impact history:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (isoString) => {
    if (!isoString) return '-';
    const date = new Date(isoString);
    return date.toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const formatOrderId = (id) => {
      if(!id) return '';
      return id.substring(0, 6).toUpperCase();
  };

  const isFood = activeTab === 'food';
  const themeColor = isFood ? '#10b981' : '#3b82f6';
  const themeBg = isFood ? '#f0fdf4' : '#eff6ff';
  const displayTotal = isFood ? totalImpact : totalImpact * 2.5;
  const multiplier = isFood ? 1 : 2.5;

  const renderHistoryCard = ({ item }) => {
    const impactValue = (item.weightSaved * multiplier).toFixed(2);
    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.dateText}>{formatDate(item.createdAt)}</Text>
          <View style={[styles.impactBadge, { borderColor: themeColor + '30', backgroundColor: themeBg }]}>
            <Ionicons name={isFood ? "leaf-outline" : "cloud-done-outline"} size={14} color={themeColor} />
            <Text style={[styles.impactBadgeText, { color: themeColor }]}>{impactValue} kg</Text>
          </View>
        </View>

        {/* 🟢 อัปเดต: ทำชื่อลูกค้าเป็นป้ายกำกับ (Pill Badge) สีเทาอ่อน */}
        <View style={styles.orderInfoRow}>
           <Text style={styles.orderId}>ออเดอร์ #{formatOrderId(item.id)}</Text>
           <View style={styles.customerBadge}>
              <Text style={styles.customerNameText}>{item.customerName}</Text>
           </View>
        </View>

        <View style={styles.itemsContainer}>
          {item.items && item.items.map((food, index) => (
            <View key={index} style={styles.foodRow}>
              <Text style={styles.foodQty}>{food.quantity}x</Text>
              <Text style={styles.foodName} numberOfLines={1}>{food.foodName}</Text>
            </View>
          ))}
        </View>
        <View style={styles.cardFooter}>
          <Text style={styles.totalPriceLabel}>ยอดขาย</Text>
          <Text style={styles.totalPriceValue}>฿{item.totalPrice}</Text>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      <View style={[styles.header, { paddingTop: Math.max(insets.top, 15) }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back-outline" size={24} color="#1f2937" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>สถิติการกอบกู้อาหารของร้าน</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.tabContainer}>
        <TouchableOpacity style={[styles.tabButton, isFood && styles.tabButtonActiveFood]} onPress={() => setActiveTab('food')}>
          <Ionicons name="leaf" size={16} color={isFood ? '#fff' : '#6b7280'} />
          <Text style={[styles.tabText, isFood && styles.tabTextActive]}>ขยะอาหาร</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tabButton, !isFood && styles.tabButtonActiveCO2]} onPress={() => setActiveTab('co2')}>
          <Ionicons name="cloud-done" size={16} color={!isFood ? '#fff' : '#6b7280'} />
          <Text style={[styles.tabText, !isFood && styles.tabTextActive]}>ลด CO2</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.summarySection}>
        <View style={styles.summaryTitleRow}>
            <Text style={styles.summaryTitle}>{isFood ? "ปริมาณขยะอาหารที่ร้านคุณช่วยลดได้" : "ปริมาณก๊าซคาร์บอนที่ร้านคุณช่วยลดได้"}</Text>
            <TouchableOpacity onPress={() => setInfoModalVisible(true)} style={styles.infoButton}>
                <Ionicons name="information-circle-outline" size={18} color="#9ca3af" />
            </TouchableOpacity>
        </View>
        <View style={styles.summaryValueRow}>
            <Text style={[styles.summaryValue, { color: themeColor }]}>{displayTotal.toFixed(2)}</Text>
            <Text style={styles.summaryUnit}> กก.</Text>
        </View>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={themeColor} style={{ marginTop: 50 }} />
      ) : (
        <FlatList
          data={history}
          renderItem={renderHistoryCard}
          keyExtractor={item => item.id}
          contentContainerStyle={[styles.listContent, { paddingBottom: Math.max(insets.bottom, 40) + 50 }]}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="receipt-outline" size={48} color="#d1d5db" />
              <Text style={styles.emptyText}>ยังไม่มีประวัติการขายสำเร็จ</Text>
            </View>
          }
        />
      )}

      <Modal visible={infoModalVisible} transparent={true} animationType="fade" onRequestClose={() => setInfoModalVisible(false)}>
          <View style={styles.modalOverlay}>
              <View style={styles.modalBox}>
                  <View style={styles.modalIconCircle}><Ionicons name="earth" size={40} color="#10b981" /></View>
                  <Text style={styles.modalTitle}>ตัวเลขนี้มาจากไหน?</Text>
                  <Text style={styles.modalText}>
                     การคำนวณของเราอ้างอิงจาก <Text style={styles.boldText}>"ค่าเฉลี่ยมาตรฐาน"</Text> ของอาหาร 1 มื้อ (ประมาณ 400 กรัม)
                     และปริมาณอาหาร 1 กก. ที่ถูกทิ้ง จะสร้างก๊าซคาร์บอน (CO2) โดยเฉลี่ย 2.5 กก.
                  </Text>
                  <View style={styles.warningBox}>
                      <Ionicons name="alert-circle" size={16} color="#d97706" />
                      <Text style={styles.warningText}>
                          ข้อมูลนี้สะท้อนถึงผลกระทบเชิงบวกที่ร้านค้าของคุณมอบให้กับโลกใบนี้ ขอบคุณที่ร่วมเป็นส่วนหนึ่งในการลด Food Waste นะครับ!
                      </Text>
                  </View>
                  <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setInfoModalVisible(false)}>
                      <Text style={styles.modalCloseBtnText}>เข้าใจแล้ว</Text>
                  </TouchableOpacity>
              </View>
          </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 15, backgroundColor: '#fff' },
  backButton: { padding: 8, marginLeft: -8 },
  headerTitle: { fontSize: 16, fontWeight: '600', color: '#1f2937' },
  tabContainer: { flexDirection: 'row', marginHorizontal: 20, backgroundColor: '#f3f4f6', borderRadius: 12, padding: 4, marginBottom: 20 },
  tabButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, borderRadius: 10, gap: 6 },
  tabButtonActiveFood: { backgroundColor: '#10b981', elevation: 2, shadowColor: '#10b981', shadowOpacity: 0.3, shadowRadius: 3, shadowOffset: { width: 0, height: 2 } },
  tabButtonActiveCO2: { backgroundColor: '#3b82f6', elevation: 2, shadowColor: '#3b82f6', shadowOpacity: 0.3, shadowRadius: 3, shadowOffset: { width: 0, height: 2 } },
  tabText: { fontSize: 14, fontWeight: '500', color: '#6b7280' },
  tabTextActive: { color: '#fff', fontWeight: 'bold' },

  summarySection: { paddingVertical: 15, alignItems: 'center', backgroundColor: '#fff', borderBottomWidth: 1, borderColor: '#f9fafb' },
  summaryTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 8 },
  summaryTitle: { fontSize: 13, color: '#6b7280', letterSpacing: 0.5 },
  infoButton: { padding: 2 },
  summaryValueRow: { flexDirection: 'row', alignItems: 'baseline' },
  summaryValue: { fontSize: 42, fontWeight: '300' },
  summaryUnit: { fontSize: 16, fontWeight: '500', color: '#9ca3af' },

  listContent: { padding: 20 },
  card: { backgroundColor: '#fff', paddingVertical: 18, borderBottomWidth: 1, borderColor: '#f3f4f6', marginBottom: 10 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  dateText: { fontSize: 13, color: '#9ca3af' },
  impactBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, borderWidth: 1 },
  impactBadgeText: { fontSize: 12, fontWeight: '600' },

  orderInfoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  orderId: { fontSize: 14, fontWeight: '700', color: '#1f2937' },

  // 🟢 สไตล์ใหม่สำหรับป้ายกำกับชื่อลูกค้า
  customerBadge: {
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb'
  },
  customerNameText: {
    fontSize: 12,
    color: '#4b5563',
    fontWeight: '600'
  },

  itemsContainer: { marginBottom: 15, backgroundColor: '#f9fafb', padding: 10, borderRadius: 8 },
  foodRow: { flexDirection: 'row', marginBottom: 6 },
  foodQty: { fontSize: 14, color: '#10b981', width: 30, fontWeight: '600' },
  foodName: { fontSize: 14, color: '#4b5563', flex: 1 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 10, borderTopWidth: 1, borderColor: '#f9fafb' },
  totalPriceLabel: { fontSize: 13, color: '#6b7280' },
  totalPriceValue: { fontSize: 15, fontWeight: '700', color: '#1f2937' },
  emptyState: { alignItems: 'center', marginTop: 80 },
  emptyText: { fontSize: 15, color: '#9ca3af', marginTop: 15 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalBox: { backgroundColor: '#fff', borderRadius: 20, padding: 25, alignItems: 'center', width: '90%', shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.1, shadowRadius: 10, elevation: 10 },
  modalIconCircle: { width: 70, height: 70, borderRadius: 35, backgroundColor: '#f0fdf4', justifyContent: 'center', alignItems: 'center', marginBottom: 15 },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: '#1f2937', marginBottom: 15 },
  modalText: { fontSize: 14, color: '#4b5563', textAlign: 'center', lineHeight: 22, marginBottom: 15 },
  boldText: { fontWeight: 'bold', color: '#10b981' },
  warningBox: { flexDirection: 'row', backgroundColor: '#fef3c7', padding: 12, borderRadius: 10, gap: 8, marginBottom: 25 },
  warningText: { flex: 1, fontSize: 12, color: '#d97706', lineHeight: 18 },
  modalCloseBtn: { backgroundColor: '#111827', width: '100%', paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  modalCloseBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 15 }
});