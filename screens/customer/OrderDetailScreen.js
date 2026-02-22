import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');

export default function OrderDetailScreen({ navigation, route }) {
  const { order } = route.params || {};
  const [isItemsExpanded, setIsItemsExpanded] = useState(false);

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

  const getFormattedOrderId = (orderId, type) => {
    if (!orderId) return 'N/A';
    const shortId = orderId.slice(0, 6).toUpperCase();
    const prefix = type === 'delivery' ? 'D' : 'P';
    return `${prefix}-${shortId}`;
  };

  const formattedId = getFormattedOrderId(order.id, order.orderType);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      <View style={styles.header}>
            <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
                <Ionicons name="chevron-back" size={24} color="#1f2937" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>ใบเสร็จคำสั่งซื้อ</Text>
            <View style={{width: 40}} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>

        <View style={styles.successSection}>
            <View style={[styles.successIconCircle, { backgroundColor: order.status === 'completed' ? '#10b981' : '#f59e0b' }]}>
                <Ionicons name={order.status === 'completed' ? "checkmark" : "time"} size={40} color="#fff" />
            </View>
            <Text style={styles.successTitle}>
              {order.status === 'completed' ? 'สั่งซื้อสำเร็จแล้ว!' : 'รอรับอาหาร...'}
            </Text>
            <Text style={styles.successSubtitle}>ขอบคุณที่ช่วยลดขยะอาหารกับเรา</Text>
        </View>

        <View style={styles.orderIdCard}>
            <Text style={styles.orderIdLabel}>
              Order ID ({order.orderType === 'delivery' ? 'จัดส่ง' : 'รับเอง'})
            </Text>
            <View style={styles.orderIdRow}>
                <Text style={styles.orderIdText}>{formattedId}</Text>
            </View>
        </View>

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

        {/* ✅ แสดงปุ่มรีวิวเมื่อร้านค้ายืนยันจนสถานะเป็น completed แล้วเท่านั้น (เอาปุ่มยืนยันของลูกค้าออก) */}
        {order.status === 'completed' && (
          !order.isReviewed ? (
            <TouchableOpacity
              style={styles.reviewButton}
              onPress={() => navigation.navigate('WriteReview', { order: order })}
            >
              <Ionicons name="star" size={20} color="#fff" />
              <Text style={styles.reviewButtonText}>ให้คะแนนรีวิวร้านค้านี้</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.reviewedBadge}>
              <Ionicons name="checkmark-circle" size={20} color="#10b981" />
              <Text style={styles.reviewedText}>คุณได้รีวิวออเดอร์นี้แล้ว ขอบคุณครับ!</Text>
            </View>
          )
        )}

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
  successIconCircle: { width: 70, height: 70, borderRadius: 35, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
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
  errorContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  errorText: { fontSize: 18, color: '#6b7280', marginTop: 15, marginBottom: 20 },
  backLink: { fontSize: 16, color: '#10b981', fontWeight: 'bold' },

  reviewButton: { backgroundColor: '#f59e0b', paddingVertical: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: 12, marginBottom: 15, gap: 8, elevation: 3 },
  reviewButtonText: { fontSize: 16, fontWeight: 'bold', color: '#fff' },
  reviewedBadge: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#ecfdf5', padding: 15, borderRadius: 12, marginBottom: 15, gap: 8, borderWidth: 1, borderColor: '#dcfce7' },
  reviewedText: { color: '#10b981', fontWeight: 'bold', fontSize: 14 },

  homeButton: { backgroundColor: '#fff', paddingVertical: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: 12, borderWidth: 1, borderColor: '#10b981' },
  homeButtonText: { fontSize: 16, fontWeight: 'bold', color: '#10b981' },
});