import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Alert,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { db, auth } from '../../firebase.config';
import { doc, updateDoc, increment } from 'firebase/firestore';

const { width } = Dimensions.get('window');

export default function OrderDetailScreen({ navigation, route }) {
  const { order } = route.params || {};
  const [loading, setLoading] = useState(false);
  const [isItemsExpanded, setIsItemsExpanded] = useState(false);

  // ป้องกันกรณีไม่มีข้อมูล Order ส่งมา
  if (!order) {
    return (
      <View style={styles.container}>
        <View style={styles.errorContainer}>
            <Ionicons name="alert-circle-outline" size={60} color="#ccc" />
            <Text style={styles.errorText}>ไม่พบข้อมูลคำสั่งซื้อ</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Home')}>
                <Text style={styles.backLink}>กลับหน้าหลัก</Text>
            </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ✅ ฟังก์ชันยืนยันการรับอาหาร (เพิ่มแต้มลดขยะอาหาร)
  const handleConfirmReceived = async () => {
    Alert.alert(
      'ยืนยันการได้รับอาหาร',
      'คุณได้รับอาหารและช่วยลดขยะอาหารเรียบร้อยแล้วใช่หรือไม่? ระบบจะบันทึกสถิติการลดขยะให้คุณทันที',
      [
        { text: 'ยกเลิก', style: 'cancel' },
        {
          text: 'ยืนยัน',
          onPress: async () => {
            setLoading(true);
            try {
              const user = auth.currentUser;
              // คำนวณน้ำหนักสะสม (ชิ้นละ 0.4 kg)
              const orderWeight = (order.quantity || 1) * 0.4;

              // 1. อัปเดตสถานะออเดอร์เป็น completed
              const orderRef = doc(db, 'orders', order.id);
              await updateDoc(orderRef, { status: 'completed' });

              // 2. อัปเดตยอดสะสมไปที่ Profile ของผู้ใช้
              const userRef = doc(db, 'users', user.uid);
              await updateDoc(userRef, {
                totalWeightSaved: increment(orderWeight)
              });

              Alert.alert('สำเร็จ!', `คุณช่วยโลกโดยการลดขยะอาหารไปได้ ${orderWeight.toFixed(1)} kg 🌍`);
              navigation.navigate('Home');
            } catch (error) {
              console.error(error);
              Alert.alert('เกิดข้อผิดพลาด', 'ไม่สามารถบันทึกข้อมูลได้');
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
  };

  const getFormattedOrderId = (orderId, type) => {
    if (!orderId) return 'N/A';
    const shortId = orderId.slice(0, 6).toUpperCase();
    const prefix = type === 'delivery' ? 'D' : 'P';
    return `${prefix}-${shortId}`;
  };

  const formattedId = getFormattedOrderId(order.id, order.orderType);

  const getTimeDisplay = () => {
      if (order.closingTime) {
          return `ภายในวันนี้ ก่อน ${order.closingTime} น.`;
      }
      return "ภายในวันนี้ ก่อน 20:00 น.";
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      {/* Header */}
      <View style={styles.header}>
            <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
                <Ionicons name="chevron-back" size={24} color="#1f2937" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>ใบเสร็จคำสั่งซื้อ</Text>
            <View style={{width: 40}} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>

        {/* Success Banner */}
        <View style={styles.successSection}>
            <View style={styles.successIconCircle}>
                <Ionicons name="checkmark" size={40} color="#fff" />
            </View>
            <Text style={styles.successTitle}>สั่งซื้อสำเร็จ!</Text>
            <Text style={styles.successSubtitle}>ขอบคุณที่ช่วยลดขยะอาหารกับเรา</Text>
        </View>

        {/* Order ID Card */}
        <View style={styles.orderIdCard}>
            <Text style={styles.orderIdLabel}>
              Order ID ({order.orderType === 'delivery' ? 'จัดส่ง' : 'รับเอง'})
            </Text>
            <View style={styles.orderIdRow}>
                <Text style={styles.orderIdText}>{formattedId}</Text>
            </View>
        </View>

        {/* Details Section */}
        <View style={styles.detailsSection}>
            <Text style={styles.sectionHeader}>รายละเอียด</Text>

            <TouchableOpacity
                style={[styles.detailRow, isItemsExpanded && styles.detailRowActive]}
                onPress={() => setIsItemsExpanded(!isItemsExpanded)}
            >
                <View style={styles.iconBox}>
                    <Ionicons name="restaurant-outline" size={20} color="#10b981" />
                </View>
                <View style={styles.detailTextContainer}>
                    <Text style={styles.detailMainText}>{order.foodName}</Text>
                    <Text style={styles.detailSubText}>{order.quantity} รายการ (แตะเพื่อดูรายละเอียด)</Text>
                </View>
                <Ionicons name={isItemsExpanded ? "chevron-up" : "chevron-down"} size={20} color="#9ca3af" />
            </TouchableOpacity>

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
                    <Text style={styles.detailSubText}>ชำระเงินปลายทาง / ที่หน้าร้าน</Text>
                </View>
            </View>

            <View style={styles.detailRow}>
                <View style={styles.iconBox}><Ionicons name="storefront-outline" size={20} color="#555" /></View>
                <View style={styles.detailTextContainer}>
                    <Text style={styles.detailMainText}>{order.storeName}</Text>
                    <Text style={[styles.detailSubText, {color: order.orderType === 'delivery' ? '#ef4444' : '#10b981', fontWeight: 'bold'}]}>
                        {order.orderType === 'delivery' ? '🚚 บริการจัดส่ง (Delivery)' : '🛍️ รับเองที่ร้าน (Pickup)'}
                    </Text>
                </View>
            </View>
        </View>

        {/* ✅ ปุ่มยืนยันการรับสินค้า */}
        {order.status !== 'completed' && (
          <TouchableOpacity
            style={styles.confirmButton}
            onPress={handleConfirmReceived}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="checkmark-circle-outline" size={24} color="#fff" />
                <Text style={styles.confirmButtonText}>ฉันได้รับอาหารเรียบร้อยแล้ว</Text>
              </>
            )}
          </TouchableOpacity>
        )}

        {/* Home Button */}
        <TouchableOpacity style={styles.homeButton} onPress={() => navigation.navigate('Home')}>
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
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 50, paddingBottom: 15, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#1f2937' },
  backButton: { padding: 5 },
  content: { flex: 1, paddingHorizontal: 20 },
  successSection: { alignItems: 'center', marginVertical: 20 },
  successIconCircle: { width: 70, height: 70, borderRadius: 35, backgroundColor: '#10b981', alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  successTitle: { fontSize: 22, fontWeight: 'bold', color: '#1f2937' },
  successSubtitle: { fontSize: 14, color: '#6b7280' },
  orderIdCard: { backgroundColor: '#fff', borderRadius: 16, padding: 20, alignItems: 'center', marginBottom: 20, borderWidth: 1, borderColor: '#e5e7eb' },
  orderIdLabel: { fontSize: 14, color: '#6b7280', marginBottom: 8 },
  orderIdRow: { backgroundColor: '#f3f4f6', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10 },
  orderIdText: { fontSize: 20, fontWeight: 'bold', color: '#1f2937' },
  detailsSection: { marginBottom: 20 },
  sectionHeader: { fontSize: 16, fontWeight: 'bold', color: '#374151', marginBottom: 12 },
  detailRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', padding: 15, borderRadius: 12, marginBottom: 10, borderWidth: 1, borderColor: '#f3f4f6' },
  detailRowActive: { borderBottomLeftRadius: 0, borderBottomRightRadius: 0, marginBottom: 0 },
  iconBox: { width: 40, alignItems: 'center', marginRight: 10 },
  detailTextContainer: { flex: 1 },
  detailMainText: { fontSize: 15, fontWeight: 'bold', color: '#1f2937' },
  detailSubText: { fontSize: 13, color: '#6b7280' },
  expandedItemsBox: { backgroundColor: '#fafafa', padding: 15, marginBottom: 10, borderBottomLeftRadius: 12, borderBottomRightRadius: 12, borderWidth: 1, borderColor: '#f3f4f6' },
  itemSmallRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  itemSmallName: { fontSize: 14, color: '#374151', flex: 1 },
  itemSmallQty: { fontSize: 14, color: '#6b7280', marginHorizontal: 10 },
  itemSmallPrice: { fontSize: 14, fontWeight: '600', color: '#10b981' },
  confirmButton: { backgroundColor: '#10b981', paddingVertical: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: 12, marginBottom: 15, gap: 10, elevation: 3 },
  confirmButtonText: { fontSize: 16, fontWeight: 'bold', color: '#fff' },
  homeButton: { backgroundColor: '#fff', paddingVertical: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: 12, borderWidth: 1, borderColor: '#10b981' },
  homeButtonText: { fontSize: 16, fontWeight: 'bold', color: '#10b981' },
});