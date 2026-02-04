import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Alert,
  Clipboard
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function OrderDetailScreen({ navigation, route }) {
  const { order } = route.params || {};

  if (!order) {
    return (
      <View style={styles.container}>
        <Text style={{textAlign: 'center', marginTop: 100}}>ไม่พบข้อมูลคำสั่งซื้อ</Text>
        <TouchableOpacity onPress={() => navigation.navigate('Home')}><Text style={{textAlign: 'center', color: 'blue'}}>กลับหน้าหลัก</Text></TouchableOpacity>
      </View>
    );
  }

  const getFormattedOrderId = (orderId, type) => {
    if (!orderId) return 'N/A';
    const shortId = orderId.slice(0, 6).toUpperCase();
    const prefix = type === 'delivery' ? 'D' : 'P';
    return `${prefix}-${shortId}`;
  };

  const formattedId = getFormattedOrderId(order.id, order.orderType);

  const handleCopyOrderID = () => {
    Alert.alert('คัดลอกแล้ว', `Order ID: ${formattedId}`);
  };

  // ✅ แปลงเวลา closingTime ให้เป็นข้อความสวยๆ
  const getPickupTimeDisplay = () => {
      if (order.closingTime) {
          return `ภายในวันนี้ ก่อน ${order.closingTime} น.`;
      }
      return "ภายในวันนี้ ก่อน 20:00 น."; // Fallback
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.navigate('Home')}>
          <Ionicons name="home-outline" size={24} color="#1f2937" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>ใบเสร็จการจอง</Text>
        <View style={{width: 40}} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>

        <View style={styles.successSection}>
            <View style={styles.successIconCircle}>
                <Ionicons name="checkmark" size={40} color="#fff" />
            </View>
            <Text style={styles.successTitle}>จองสำเร็จ!</Text>
            <Text style={styles.successSubtitle}>เตรียมไปรับอาหารอร่อยได้เลย</Text>
        </View>

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

            <View style={styles.detailRow}>
                <View style={styles.iconBox}><Ionicons name="restaurant-outline" size={20} color="#555" /></View>
                <View style={styles.detailTextContainer}>
                    <Text style={styles.detailMainText}>{order.foodName}</Text>
                    <Text style={styles.detailSubText}>จำนวน {order.quantity} ชุด</Text>
                </View>
            </View>

            <View style={styles.detailRow}>
                <View style={styles.iconBox}><Ionicons name="cash-outline" size={20} color="#555" /></View>
                <View style={styles.detailTextContainer}>
                    <Text style={styles.detailMainText}>ยอดชำระ : {order.totalPrice} ฿</Text>
                    <Text style={styles.detailSubText}>ชำระที่หน้าร้าน</Text>
                </View>
            </View>

            <View style={styles.detailRow}>
                <View style={styles.iconBox}><Ionicons name="storefront-outline" size={20} color="#555" /></View>
                <View style={styles.detailTextContainer}>
                    <Text style={styles.detailMainText}>{order.storeName}</Text>
                    <Text style={styles.detailSubText}>ไปรับที่ร้าน</Text>
                </View>
            </View>

            <View style={styles.detailRow}>
                <View style={styles.iconBox}><Ionicons name="time-outline" size={20} color="#555" /></View>
                <View style={styles.detailTextContainer}>
                    <Text style={styles.detailMainText}>เวลารับสินค้า</Text>
                    {/* ✅ แสดงเวลาจริงที่รับมาจาก FoodDetail */}
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

        {/* ✅ ปุ่มล่างสุดมีกรอบ (ตามคำขอ) */}
        <TouchableOpacity
            style={styles.ordersButton}
            onPress={() => navigation.navigate('Orders')}
        >
            <Text style={styles.ordersButtonText}>ดูรายการคำสั่งซื้อของฉัน</Text>
        </TouchableOpacity>

        <View style={{height: 50}} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 50, paddingBottom: 15 },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#1f2937' },
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
  iconBox: { width: 40, alignItems: 'center' },
  detailTextContainer: { flex: 1 },
  detailMainText: { fontSize: 16, fontWeight: 'bold', color: '#333' },
  detailSubText: { fontSize: 13, color: '#888', marginTop: 2 },
  infoBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', padding: 15, borderRadius: 12, borderWidth: 1, borderColor: '#f59e0b', marginBottom: 20, gap: 10 },
  infoBoxText: { fontSize: 14, color: '#333', flex: 1 },
  mapButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#e5e7eb', paddingVertical: 15, borderRadius: 12, marginBottom: 10, gap: 10 },
  mapButtonText: { fontSize: 16, fontWeight: 'bold', color: '#1f2937' },

  // ✅ Style สำหรับปุ่มล่างสุด (มีกรอบ)
  ordersButton: {
    backgroundColor: '#fff',
    paddingVertical: 15,
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1, // เส้นขอบ
    borderColor: '#10b981', // สีเขียว
    marginTop: 5
  },
  ordersButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#10b981' // ตัวอักษรสีเขียว
  },
});