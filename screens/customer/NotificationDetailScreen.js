import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  StatusBar,
  ScrollView,
  SafeAreaView,
  ActivityIndicator,
  Image,
  Linking,
  Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { db } from '../../firebase.config';
import { doc, getDoc } from 'firebase/firestore';

export default function NotificationDetailScreen({ navigation, route }) {
  const { notification } = route.params || {};
  const [orderData, setOrderData] = useState(null);
  const [storeData, setStoreData] = useState(null);
  const [loadingData, setLoadingData] = useState(false);

  useEffect(() => {
    const fetchContextData = async () => {
      setLoadingData(true);
      try {
        if (notification?.orderId) {
          const orderSnap = await getDoc(doc(db, 'orders', notification.orderId));
          if (orderSnap.exists()) {
            setOrderData({ id: orderSnap.id, ...orderSnap.data() });
          }
        }
        else if (notification?.type === 'store_approved' || notification?.type === 'store_rejected') {
          if (notification?.userId) {
            const storeSnap = await getDoc(doc(db, 'stores', notification.userId));
            if (storeSnap.exists()) {
              setStoreData({ id: storeSnap.id, ...storeSnap.data() });
            }
          }
        }
      } catch (error) {
        console.error("Error fetching context data:", error);
      } finally {
        setLoadingData(false);
      }
    };

    if (notification) {
      fetchContextData();
    }
  }, [notification]);

  if (!notification) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyText}>ไม่พบข้อมูลการแจ้งเตือน</Text>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginTop: 20 }}>
          <Text style={{ color: '#1f2937', fontWeight: 'bold' }}>กลับ</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const getNotificationTheme = (type) => {
    switch (type) {
      case 'order_confirmed': return { name: 'restaurant-outline', color: '#3b82f6', bg: '#eff6ff' };
      case 'order_completed': return { name: 'checkmark-circle-outline', color: '#10b981', bg: '#f0fdf4' };
      case 'order_cancelled': return { name: 'close-circle-outline', color: '#ef4444', bg: '#fef2f2' };
      case 'store_approved': return { name: 'storefront-outline', color: '#10b981', bg: '#f0fdf4' };
      case 'store_rejected': return { name: 'warning-outline', color: '#ef4444', bg: '#fef2f2' };
      case 'promo': return { name: 'flash-outline', color: '#f59e0b', bg: '#fffbeb' };
      default: return { name: 'notifications-outline', color: '#6b7280', bg: '#f3f4f6' };
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleDateString('th-TH', {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit'
    }) + ' น.';
  };

  const getCleanMessage = () => {
    if (notification.type === 'order_confirmed') {
      const type = orderData?.orderType || notification?.orderType;
      if (type === 'delivery') {
        return 'ร้านกำลังเตรียมอาหาร และจะดำเนินการจัดส่งให้คุณตามที่อยู่ที่ระบุไว้ 🛵';
      } else if (type === 'pickup') {
        return 'ร้านกำลังเตรียมอาหาร แวะมารับที่หน้าร้านตามเวลาทำการได้เลย 🛍️';
      }
    }

    let msg = notification.message || '';
    if (notification.orderId) {
      const shortId = notification.orderId.slice(0, 6).toUpperCase();
      msg = msg.replace(new RegExp(`ออเดอร์\\s*#?${shortId}\\s*`, 'g'), '');
      msg = msg.replace(new RegExp(`ออร์เดอร์\\s*#?${shortId}\\s*`, 'g'), '');
      msg = msg.replace(new RegExp(`#?${shortId}\\s*`, 'g'), '');
    }
    return msg.trim();
  };

  // ✅ ฟังก์ชันอัจฉริยะ: ดึงเฉพาะเหตุผล ลบวงเล็บ และข้อความขยะทิ้ง
  const getCancelReason = () => {
    if (orderData?.cancelReason) return orderData.cancelReason;

    let msg = notification.message || '';

    // แบบที่ 1: ดักจับแบบมีวงเล็บ เช่น "(เหตุผล: xxxx) บลาๆๆ"
    const matchParens = msg.match(/\((?:เหตุผล|สาเหตุ):\s*(.*?)\)/);
    if (matchParens && matchParens[1]) {
      return matchParens[1].trim();
    }

    // แบบที่ 2: ดักจับแบบไม่มีวงเล็บ เช่น "เหตุผล: xxxx กรุณา..."
    const matchNoParens = msg.match(/(?:เหตุผล|สาเหตุ):\s*(.*)/);
    if (matchNoParens && matchNoParens[1]) {
      let reason = matchNoParens[1].trim();
      // ตัดคำว่า "กรุณา..." ที่ชอบต่อท้ายออกไป
      reason = reason.replace(/กรุณา.*/, '').trim();
      reason = reason.replace(/\)$/, '').trim(); // เผื่อวงเล็บหลงเหลือ
      return reason;
    }

    return getCleanMessage();
  };

  const getFormattedOrderId = () => {
    if (!notification?.orderId) return '-';
    const shortId = notification.orderId.slice(0, 6).toUpperCase();
    const type = orderData?.orderType || notification?.orderType;
    if (type === 'delivery') return `D-${shortId}`;
    if (type === 'pickup') return `P-${shortId}`;
    return shortId;
  };

  const renderBusinessHours = (businessHours) => {
    if (!businessHours) return <Text style={styles.infoValueDark}>ไม่ระบุเวลาทำการ</Text>;
    const daysOrder = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
    const daysMap = { mon: 'จันทร์', tue: 'อังคาร', wed: 'พุธ', thu: 'พฤหัสฯ', fri: 'ศุกร์', sat: 'เสาร์', sun: 'อาทิตย์' };

    return daysOrder.map((dayKey) => {
      const dayData = businessHours[dayKey];
      if (!dayData) return null;
      return (
        <View key={dayKey} style={styles.businessHourRow}>
          <Text style={styles.businessHourDay}>{daysMap[dayKey]}</Text>
          <Text style={[styles.businessHourTime, !dayData?.isOpen && { color: '#ef4444' }]}>
            {dayData?.isOpen ? `${dayData.openTime} - ${dayData.closeTime} น.` : 'ปิดทำการ'}
          </Text>
        </View>
      );
    });
  };

  const handleOpenMap = () => {
    if (storeData?.latitude && storeData?.longitude) {
      const url = Platform.select({
        ios: `maps:0,0?q=${storeData.latitude},${storeData.longitude}`,
        android: `geo:0,0?q=${storeData.latitude},${storeData.longitude}(${storeData.storeName || 'ร้านค้า'})`
      });
      Linking.openURL(url).catch(() => Alert.alert('ผิดพลาด', 'ไม่สามารถเปิดแผนที่ได้'));
    } else if (storeData?.address || storeData?.location) {
      const query = encodeURIComponent(storeData.address || storeData.location);
      const url = Platform.select({
        ios: `maps:0,0?q=${query}`,
        android: `geo:0,0?q=${query}`
      });
      Linking.openURL(url).catch(() => Alert.alert('ผิดพลาด', 'ไม่สามารถเปิดแผนที่ได้'));
    } else {
      Alert.alert('แจ้งเตือน', 'ไม่มีข้อมูลพิกัดหรือที่อยู่สำหรับเปิดแผนที่');
    }
  };

  const theme = getNotificationTheme(notification.type);

  const handleActionButton = () => {
    if (notification.type === 'order_completed' && orderData && !orderData.isReviewed) {
      navigation.navigate('WriteReview', { order: orderData });
    } else if (notification.type.includes('order')) {
      if (orderData) {
        navigation.navigate('OrderDetail', { order: orderData });
      } else {
        navigation.navigate('Orders');
      }
    } else if (notification.type === 'store_approved') {
      navigation.navigate('MyShop');
    } else if (notification.type === 'store_rejected') {
      navigation.navigate('RegisterStoreStep1');
    } else {
      navigation.navigate('Home');
    }
  };

  let buttonText = 'กลับสู่หน้าหลัก';
  if (notification.type === 'order_completed' && orderData) {
    buttonText = orderData.isReviewed ? 'ดูรายการคำสั่งซื้อ' : '⭐ รีวิวร้านค้านี้';
  } else if (notification.type.includes('order')) {
    buttonText = 'ดูสถานะคำสั่งซื้อ';
  } else if (notification.type === 'store_approved') {
    buttonText = '🏪 ไปยังหน้าร้านค้าของฉัน';
  } else if (notification.type === 'store_rejected') {
    buttonText = '👤 สมัครใหม่อีกครั้ง';
  } else if (notification.type.includes('promo')) {
    buttonText = 'ไปช้อปเลย';
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={28} color="#1f2937" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>รายละเอียด</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

        <View style={styles.notificationHeader}>
          <View style={[styles.iconWrapper, { backgroundColor: theme.bg }]}>
            <Ionicons name={theme.name} size={32} color={theme.color} />
          </View>
          <Text style={styles.dateText}>{formatDate(notification.createdAt)}</Text>
          <Text style={styles.titleText}>{notification.title}</Text>

          {notification.type !== 'order_cancelled' && notification.type !== 'store_rejected' && (
             <Text style={styles.messageText}>{getCleanMessage()}</Text>
          )}
        </View>

        {/* 🚨 กล่อง Alert สีแดงที่จัด Layout ใหม่ให้สวยและเป็นสัดส่วน */}
        {(notification.type === 'order_cancelled' || notification.type === 'store_rejected') && (
          <View style={styles.reasonAlertBox}>
            <View style={styles.reasonAlertHeader}>
              <Ionicons name="warning" size={22} color="#ef4444" />
              <Text style={styles.reasonAlertTitle}>
                {notification.type === 'order_cancelled' ? 'เหตุผลการยกเลิก' : 'เหตุผลที่ไม่อนุมัติ'}
              </Text>
            </View>
            <View style={styles.reasonAlertContent}>
              <Text style={styles.reasonAlertText}>
                {getCancelReason()}
              </Text>
            </View>
          </View>
        )}

        {notification.type === 'store_approved' && (
          <View style={styles.storeGuidelineBox}>
            <View style={styles.guidelineIconCircle}>
                <Ionicons name="bulb-outline" size={24} color="#f59e0b" />
            </View>
            <View style={{ flex: 1, marginLeft: 15 }}>
              <Text style={styles.storeGuidelineTitle}>ขั้นตอนต่อไป</Text>
              <Text style={styles.storeGuidelineText}>
                คุณสามารถสลับเป็นโหมดร้านค้า และเริ่มเพิ่มเมนูอาหารเพื่อกอบกู้โลกจาก Food Waste ได้ทันที!
              </Text>
            </View>
          </View>
        )}

        {notification.type === 'store_rejected' && (
          <View style={[styles.storeGuidelineBox, { backgroundColor: '#fef2f2', borderColor: '#fecaca' }]}>
            <View style={[styles.guidelineIconCircle, { backgroundColor: '#fee2e2' }]}>
                <Ionicons name="refresh" size={24} color="#ef4444" />
            </View>
            <View style={{ flex: 1, marginLeft: 15 }}>
              <Text style={[styles.storeGuidelineTitle, { color: '#b91c1c' }]}>ขั้นตอนต่อไป</Text>
              <Text style={[styles.storeGuidelineText, { color: '#991b1b' }]}>
                กรุณากลับไปตรวจสอบข้อมูล แก้ไข และส่งคำขอเข้ามาใหม่
              </Text>
            </View>
          </View>
        )}

        {notification.orderId && (
          <View style={styles.detailSection}>
            <Text style={styles.sectionLabel}>ข้อมูลอ้างอิงออเดอร์</Text>

            <View style={styles.detailCard}>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>หมายเลขคำสั่งซื้อ</Text>
                <Text style={styles.infoValueDark}>#{getFormattedOrderId()}</Text>
              </View>

              {loadingData ? (
                <ActivityIndicator size="small" color="#1f2937" style={{ marginVertical: 20 }} />
              ) : orderData ? (
                <>
                  <View style={styles.divider} />

                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>ร้านค้า</Text>
                    <Text style={styles.infoValueDark}>{orderData.storeName}</Text>
                  </View>

                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>ประเภท</Text>
                    <Text style={[styles.infoValueDark, { color: orderData.orderType === 'delivery' ? '#0284c7' : '#10b981' }]}>
                      {orderData.orderType === 'delivery' ? '🛵 จัดส่ง (Delivery)' : '🛍️ รับที่ร้าน (Pickup)'}
                    </Text>
                  </View>

                  {orderData.orderType === 'delivery' ? (
                    <View style={styles.infoRowAddress}>
                      <Text style={styles.infoLabel}>ที่อยู่จัดส่ง</Text>
                      <Text style={styles.addressValueText} numberOfLines={3}>
                        {orderData.customerAddress || 'ไม่ระบุที่อยู่จัดส่ง'}
                      </Text>
                    </View>
                  ) : (
                    <View style={styles.infoRow}>
                      <Text style={styles.infoLabel}>เวลารับอาหาร</Text>
                      <Text style={[styles.infoValueDark, { color: '#f59e0b' }]}>
                        ภายในวันนี้ ก่อน {orderData.closingTime || '20:00'} น.
                      </Text>
                    </View>
                  )}

                  <View style={styles.orderItemsContainer}>
                    {orderData.items && orderData.items.map((item, index) => (
                      <View key={index} style={styles.itemRow}>
                        <Text style={styles.itemNameText}>{item.quantity}x  {item.foodName}</Text>
                        <Text style={styles.itemPriceText}>฿{item.price * item.quantity}</Text>
                      </View>
                    ))}
                  </View>

                  <View style={styles.divider} />

                  <View style={styles.infoRow}>
                    <Text style={styles.totalLabel}>ยอดรวมสุทธิ</Text>
                    <Text style={[styles.totalValue, notification.type === 'order_cancelled' && {color: '#ef4444'}]}>
                       ฿{orderData.totalPrice}
                    </Text>
                  </View>
                </>
              ) : (
                <Text style={styles.notFoundText}>ไม่สามารถโหลดรายละเอียดเพิ่มเติมได้</Text>
              )}
            </View>
          </View>
        )}

        {(notification.type === 'store_approved' || notification.type === 'store_rejected') && (
          <View style={styles.detailSection}>
            <Text style={styles.sectionLabel}>ข้อมูลร้านค้าของคุณ</Text>

            <View style={styles.detailCard}>
              {loadingData ? (
                <ActivityIndicator size="small" color="#1f2937" style={{ marginVertical: 20 }} />
              ) : storeData ? (
                <>
                  {storeData.storeImage ? (
                    <Image source={{ uri: storeData.storeImage }} style={styles.storeCoverImage} />
                  ) : null}

                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>ชื่อร้าน</Text>
                    <Text style={styles.infoValueDark}>{storeData.storeName || '-'}</Text>
                  </View>

                  {storeData.storeDetails || storeData.description ? (
                    <View style={styles.infoRowAddress}>
                      <Text style={styles.infoLabel}>รายละเอียด</Text>
                      <Text style={styles.addressValueText}>
                        {storeData.storeDetails || storeData.description}
                      </Text>
                    </View>
                  ) : null}

                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>เบอร์ติดต่อ</Text>
                    <Text style={styles.infoValueDark}>{storeData.phoneNumber || '-'}</Text>
                  </View>

                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>การจัดส่ง</Text>
                    <Text style={[styles.infoValueDark, { color: '#0284c7' }]}>
                      {storeData.deliveryMethod === 'both' ? 'จัดส่ง & รับที่ร้าน' :
                       storeData.deliveryMethod === 'delivery' ? 'จัดส่งเท่านั้น' :
                       storeData.deliveryMethod === 'pickup' ? 'รับที่ร้านเท่านั้น' : 'ไม่ระบุ'}
                    </Text>
                  </View>

                  <View style={styles.divider} />

                  <TouchableOpacity style={styles.infoRowAddressClickable} onPress={handleOpenMap} activeOpacity={0.7}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                      <Text style={[styles.infoLabel, { color: '#0369a1', fontWeight: 'bold' }]}>ที่ตั้งร้าน</Text>
                      <Ionicons name="map" size={14} color="#0284c7" style={{ marginLeft: 6 }} />
                    </View>
                    <Text style={styles.addressValueClickable} numberOfLines={3}>
                      {storeData.address || storeData.location || 'ไม่ระบุที่อยู่'}
                    </Text>
                    <Text style={styles.clickHintText}>(แตะเพื่อเปิดดูในแผนที่)</Text>
                  </TouchableOpacity>

                  <View style={styles.divider} />

                  <View style={{ marginTop: 5 }}>
                    <Text style={[styles.infoLabel, { marginBottom: 12, fontWeight: 'bold', color: '#1f2937' }]}>
                      <Ionicons name="time-outline" size={14} /> เวลาทำการ
                    </Text>
                    {renderBusinessHours(storeData.businessHours)}
                  </View>
                </>
              ) : (
                <Text style={styles.notFoundText}>ไม่พบข้อมูลร้านค้าในระบบ</Text>
              )}
            </View>
          </View>
        )}

      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[
            styles.actionButton,
            notification.type === 'order_completed' && orderData && !orderData.isReviewed && { backgroundColor: '#10b981' },
            notification.type === 'store_approved' && { backgroundColor: '#10b981' }
          ]}
          onPress={handleActionButton}
        >
          <Text style={styles.actionButtonText}>{buttonText}</Text>
        </TouchableOpacity>
      </View>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#ffffff' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: Platform.OS === 'ios' ? 10 : 20, paddingBottom: 15, backgroundColor: '#ffffff' },
  backButton: { width: 40, height: 40, justifyContent: 'center' },
  headerTitle: { fontSize: 16, fontWeight: '600', color: '#1f2937', letterSpacing: 0.5 },
  content: { flex: 1 },
  scrollContent: { paddingHorizontal: 24, paddingTop: 20, paddingBottom: 40 },
  notificationHeader: { alignItems: 'center', marginBottom: 25 },
  iconWrapper: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  dateText: { fontSize: 12, color: '#9ca3af', marginBottom: 12 },
  titleText: { fontSize: 20, fontWeight: '700', color: '#1f2937', textAlign: 'center', marginBottom: 8, letterSpacing: 0.2 },
  messageText: { fontSize: 15, color: '#6b7280', lineHeight: 24, textAlign: 'center' },

  // ✅ จัด Layout กล่องเหตุผลใหม่
  reasonAlertBox: { backgroundColor: '#fef2f2', borderWidth: 1, borderColor: '#fecaca', borderRadius: 16, paddingHorizontal: 20, paddingTop: 15, paddingBottom: 20, marginBottom: 25, width: '100%' },
  reasonAlertHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 12, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#fecaca' },
  reasonAlertTitle: { fontSize: 16, fontWeight: 'bold', color: '#ef4444', marginLeft: 8 },
  reasonAlertContent: { alignItems: 'center' },
  reasonAlertText: { fontSize: 16, color: '#991b1b', lineHeight: 24, textAlign: 'center', fontWeight: '500' },

  storeGuidelineBox: { flexDirection: 'row', backgroundColor: '#fffbeb', borderWidth: 1, borderColor: '#fde68a', borderRadius: 16, padding: 20, marginBottom: 30, alignItems: 'center' },
  guidelineIconCircle: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#fef3c7', alignItems: 'center', justifyContent: 'center' },
  storeGuidelineTitle: { fontSize: 15, fontWeight: 'bold', color: '#d97706', marginBottom: 4 },
  storeGuidelineText: { fontSize: 14, color: '#92400e', lineHeight: 22 },

  detailSection: { width: '100%' },
  sectionLabel: { fontSize: 13, color: '#9ca3af', fontWeight: '600', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 1 },
  detailCard: { backgroundColor: '#f9fafb', borderRadius: 16, padding: 20, borderWidth: 1, borderColor: '#f3f4f6' },

  storeCoverImage: { width: '100%', height: 160, borderRadius: 12, marginBottom: 20, backgroundColor: '#e5e7eb' },

  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginVertical: 6 },
  infoRowAddress: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginVertical: 6 },
  addressValueText: { fontSize: 13, color: '#1f2937', fontWeight: '500', flex: 1, textAlign: 'right', marginLeft: 15, lineHeight: 22 },

  infoRowAddressClickable: { backgroundColor: '#f0f9ff', padding: 12, borderRadius: 10, marginTop: 4, marginBottom: 6, borderWidth: 1, borderColor: '#bae6fd' },
  addressValueClickable: { fontSize: 13, color: '#0369a1', fontWeight: '500', lineHeight: 22 },
  clickHintText: { fontSize: 11, color: '#0ea5e9', marginTop: 6, fontStyle: 'italic' },

  infoLabel: { fontSize: 14, color: '#6b7280' },
  infoValueDark: { fontSize: 14, color: '#1f2937', fontWeight: '500' },

  businessHourRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  businessHourDay: { fontSize: 13, color: '#6b7280' },
  businessHourTime: { fontSize: 13, color: '#1f2937', fontWeight: '500' },

  divider: { height: 1, backgroundColor: '#e5e7eb', marginVertical: 16 },
  orderItemsContainer: { marginTop: 10, paddingLeft: 10, borderLeftWidth: 2, borderLeftColor: '#e5e7eb' },
  itemRow: { flexDirection: 'row', justifyContent: 'space-between', marginVertical: 4 },
  itemNameText: { fontSize: 14, color: '#4b5563' },
  itemPriceText: { fontSize: 14, color: '#4b5563', fontWeight: '500' },
  totalLabel: { fontSize: 15, color: '#1f2937', fontWeight: '600' },
  totalValue: { fontSize: 18, color: '#10b981', fontWeight: 'bold' },
  emptyText: { color: '#6b7280', fontSize: 16 },
  notFoundText: { color: '#9ca3af', fontSize: 13, textAlign: 'center', marginTop: 15, fontStyle: 'italic' },
  footer: { paddingHorizontal: 24, paddingBottom: Platform.OS === 'ios' ? 30 : 20, paddingTop: 10, backgroundColor: '#ffffff' },
  actionButton: { backgroundColor: '#1f2937', paddingVertical: 16, borderRadius: 12, alignItems: 'center' },
  actionButtonText: { color: '#ffffff', fontSize: 15, fontWeight: '600', letterSpacing: 0.5 }
});