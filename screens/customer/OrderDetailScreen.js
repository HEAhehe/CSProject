import React, { useState } from 'react'; // ✅ เพิ่ม useState สำหรับ Dropdown
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function OrderDetailScreen({ navigation, route }) {
  const { order } = route.params || {};

  // ✅ State สำหรับคุมการ กาง/หุบ รายการสินค้า
  const [isItemsExpanded, setIsItemsExpanded] = useState(false);

  if (!order) {
    return (
      <View style={styles.container}>
        <Text style={{textAlign: 'center', marginTop: 100}}>ไม่พบข้อมูลคำสั่งซื้อ</Text>
        <TouchableOpacity onPress={() => navigation.navigate('Home')}><Text style={{textAlign: 'center', color: 'blue'}}>กลับหน้าหลัก</Text></TouchableOpacity>
      </View>
    );
  }

  // ✅ ฟังก์ชันจัดรูปแบบ ID (D- สำหรับ Delivery, P- สำหรับ Pickup)
  const getFormattedOrderId = (orderId, type) => {
    if (!orderId) return 'N/A';
    const shortId = orderId.slice(0, 6).toUpperCase();
    const prefix = type === 'delivery' ? 'D' : 'P';
    return `${prefix}-${shortId}`;
  };

  const formattedId = getFormattedOrderId(order.id, order.orderType);

  const handleCopyOrderID = () => {
    Alert.alert('คัดลอกรหัสแล้ว', `รหัสออเดอร์: ${formattedId}`);
  };

  const getPickupTimeDisplay = () => {
      if (order.closingTime) {
          return `ภายในวันนี้ ก่อน ${order.closingTime} น.`;
      }
      return "ภายในวันนี้ ก่อน 20:00 น.";
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      {/* ✅ Header: จัดหัวข้อให้อยู่กึ่งกลางหน้าจอ */}
      <View style={styles.header}>
            <View style={{width: 40}} />
            <Text style={styles.headerTitle}>ใบเสร็จการจอง</Text>
            <View style={{width: 40}} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>

        <View style={styles.successSection}>
            <View style={styles.successIconCircle}>
                <Ionicons name="checkmark" size={40} color="#fff" />
            </View>
            <Text style={styles.successTitle}>จองสำเร็จ!</Text>
            <Text style={styles.successSubtitle}>เตรียมรับอาหารอร่อยได้เลย</Text>
        </View>

        {/* บัตรแสดง Order ID */}
        <View style={styles.orderIdCard}>
            <Text style={styles.orderIdLabel}>
              Order ID ({order.orderType === 'delivery' ? 'จัดส่ง' : 'รับเอง'})
            </Text>
            <TouchableOpacity style={styles.orderIdRow} onPress={handleCopyOrderID}>
                <Text style={styles.orderIdText}>{formattedId}</Text>
                <Ionicons name="copy-outline" size={18} color="#6b7280" />
            </TouchableOpacity>
        </View>

        <View style={styles.detailsSection}>
            <Text style={styles.sectionHeader}>รายละเอียด</Text>

            {/* ✅ รายการอาหารแบบ Dropdown (คลิกเพื่อกางออก) */}
            <TouchableOpacity
                style={[styles.detailRow, isItemsExpanded && styles.detailRowActive]}
                onPress={() => setIsItemsExpanded(!isItemsExpanded)}
                activeOpacity={0.7}
            >
                <View style={styles.iconBox}>
                    <Ionicons name="restaurant-outline" size={20} color="#10b981" />
                </View>
                <View style={styles.detailTextContainer}>
                    <Text style={styles.detailMainText}>{order.foodName}</Text>
                    <Text style={styles.detailSubText}>
                        {order.quantity} รายการ (คลิกเพื่อดูทั้งหมด)
                    </Text>
                </View>
                <Ionicons
                    name={isItemsExpanded ? "chevron-up" : "chevron-down"}
                    size={20}
                    color="#9ca3af"
                />
            </TouchableOpacity>

            {/* ✅ ส่วนที่กางออกมาแสดงรายการสินค้าทั้งหมด */}
            {isItemsExpanded && order.items && (
                <View style={styles.expandedItemsBox}>
                    {order.items.map((item, index) => (
                        <View key={index} style={styles.itemSmallRow}>
                            <Text style={styles.itemSmallName}>• {item.foodName}</Text>
                            <Text style={styles.itemSmallQty}>x{item.quantity}</Text>
                            <Text style={styles.itemSmallPrice}>฿{item.price * item.quantity}</Text>
                        </View>
                    ))}
                </View>
            )}

            <View style={styles.detailRow}>
                <View style={styles.iconBox}><Ionicons name="cash-outline" size={20} color="#555" /></View>
                <View style={styles.detailTextContainer}>
                    <Text style={styles.detailMainText}>ยอดชำระรวม : {order.totalPrice} ฿</Text>
                    <Text style={styles.detailSubText}>ชำระที่หน้าร้าน</Text>
                </View>
            </View>

            <View style={styles.detailRow}>
                <View style={styles.iconBox}><Ionicons name="storefront-outline" size={20} color="#555" /></View>
                <View style={styles.detailTextContainer}>
                    <Text style={styles.detailMainText}>{order.storeName}</Text>
                    <Text style={styles.detailSubText}>
                        {order.orderType === 'delivery' ? 'บริการจัดส่ง' : 'ไปรับที่ร้าน'}
                    </Text>
                </View>
            </View>

            <View style={styles.detailRow}>
                <View style={styles.iconBox}><Ionicons name="time-outline" size={20} color="#555" /></View>
                <View style={styles.detailTextContainer}>
                    <Text style={styles.detailMainText}>เวลารับสินค้า</Text>
                    <Text style={styles.detailSubText}>{getPickupTimeDisplay()}</Text>
                </View>
            </View>
        </View>

        <View style={styles.infoBox}>
            <Ionicons name="information-circle-outline" size={24} color="#000" />
            <Text style={styles.infoBoxText}>นำ Order ID นี้ไปแสดงหน้าร้านเพื่อรับอาหาร</Text>
        </View>

        <TouchableOpacity style={styles.mapButton}>
            <Ionicons name="navigate" size={20} color="#1f2937" />
            <Text style={styles.mapButtonText}>ดูเส้นทาง</Text>
        </TouchableOpacity>

        {/* ปุ่มกลับหน้าหลัก */}
        <TouchableOpacity
            style={styles.homeButton}
            onPress={() => navigation.navigate('Home')}
        >
            <Ionicons name="home" size={20} color="#10b981" style={{ marginRight: 8 }} />
            <Text style={styles.homeButtonText}>กลับไปหน้าหลัก</Text>
        </TouchableOpacity>

        <View style={{height: 50}} />
      </ScrollView>
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
    paddingTop: 50,
    paddingBottom: 15,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6'
  },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#1f2937' },
  content: { flex: 1, paddingHorizontal: 20 },
  successSection: { alignItems: 'center', marginVertical: 20 },
  successIconCircle: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#333', alignItems: 'center', justifyContent: 'center', marginBottom: 15 },
  successTitle: { fontSize: 24, fontWeight: 'bold', color: '#000' },
  successSubtitle: { fontSize: 14, color: '#666', marginTop: 5 },
  orderIdCard: { backgroundColor: '#fff', borderRadius: 16, padding: 20, alignItems: 'center', marginBottom: 20, borderWidth: 1, borderColor: '#10b981', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 5, elevation: 2 },
  orderIdLabel: { fontSize: 14, color: '#666', marginBottom: 5 },
  orderIdRow: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#f3f4f6', paddingHorizontal: 15, paddingVertical: 8, borderRadius: 8 },
  orderIdText: { fontSize: 20, fontWeight: 'bold', color: '#000' },
  detailsSection: { marginBottom: 20 },
  sectionHeader: { fontSize: 16, fontWeight: 'bold', color: '#666', marginBottom: 10, textAlign: 'center' },
  detailRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', padding: 15, borderRadius: 12, marginBottom: 10 },
  detailRowActive: { borderBottomLeftRadius: 0, borderBottomRightRadius: 0, marginBottom: 0 },
  iconBox: { width: 40, alignItems: 'center' },
  detailTextContainer: { flex: 1 },
  detailMainText: { fontSize: 16, fontWeight: 'bold', color: '#333' },
  detailSubText: { fontSize: 13, color: '#888', marginTop: 2 },

  // ✅ สไตล์สำหรับ Dropdown ที่กางออกมา
  expandedItemsBox: {
    backgroundColor: '#fff',
    padding: 15,
    marginBottom: 10,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
    borderWidth: 1,
    borderTopWidth: 0,
    borderColor: '#f3f4f6',
    borderStyle: 'dashed'
  },
  itemSmallRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5 },
  itemSmallName: { fontSize: 14, color: '#374151', flex: 1 },
  itemSmallQty: { fontSize: 14, color: '#6b7280', marginHorizontal: 10 },
  itemSmallPrice: { fontSize: 14, fontWeight: '600', color: '#10b981' },

  infoBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', padding: 15, borderRadius: 12, borderWidth: 1, borderColor: '#f59e0b', marginBottom: 20, gap: 10 },
  infoBoxText: { fontSize: 14, color: '#333', flex: 1 },
  mapButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#e5e7eb', paddingVertical: 15, borderRadius: 12, marginBottom: 10, gap: 10 },
  mapButtonText: { fontSize: 16, fontWeight: 'bold', color: '#1f2937' },
  homeButton: {
    backgroundColor: '#fff',
    paddingVertical: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#10b981',
    marginTop: 5,
    shadowColor: '#10b981',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2
  },
  homeButtonText: { fontSize: 16, fontWeight: 'bold', color: '#10b981' },
});