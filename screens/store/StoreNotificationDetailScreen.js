import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Platform, StatusBar, ScrollView,
  ActivityIndicator, Alert, Linking
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { db } from '../../firebase.config';
import { doc, getDoc } from 'firebase/firestore';
import * as Clipboard from 'expo-clipboard';

export default function StoreNotificationDetailScreen({ navigation, route }) {
  const { notification } = route.params || {};
  const [orderData, setOrderData] = useState(null);
  const [loadingData, setLoadingData] = useState(false);

  useEffect(() => {
    const fetchContextData = async () => {
      setLoadingData(true);
      try {
        if (notification?.orderId) {
          const orderSnap = await getDoc(doc(db, 'orders', notification.orderId));
          if (orderSnap.exists()) {
            let fetchedOrder = { id: orderSnap.id, ...orderSnap.data() };

            if (fetchedOrder.userId) {
              const userSnap = await getDoc(doc(db, 'users', fetchedOrder.userId));
              if (userSnap.exists()) {
                const userData = userSnap.data();
                fetchedOrder.customerName = fetchedOrder.customerName || fetchedOrder.userName || userData.username || userData.name || userData.displayName;

                let phoneDb = fetchedOrder.customerPhone || fetchedOrder.phone;
                if (!phoneDb || phoneDb === 'ไม่ระบุเบอร์โทร') {
                   phoneDb = userData.phoneNumber || userData.phone || '';
                }
                fetchedOrder.displayPhone = phoneDb;
                fetchedOrder.deliveryAddress = fetchedOrder.deliveryAddress || userData.defaultAddress || userData.address;
              }
            }
            setOrderData(fetchedOrder);
          }
        }
      } catch (error) {
        console.error("Error fetching context data:", error);
      } finally {
        setLoadingData(false);
      }
    };

    if (notification) fetchContextData();
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
      case 'new_order': return { name: 'receipt-outline', color: '#10b981', bg: '#dcfce7' };
      case 'order_cancelled_by_customer': return { name: 'close-circle-outline', color: '#ef4444', bg: '#fef2f2' };
      case 'store_edit_approved': return { name: 'checkmark-circle-outline', color: '#10b981', bg: '#dcfce7' };
      case 'store_edit_rejected': return { name: 'warning-outline', color: '#ef4444', bg: '#fef2f2' };
      default: return { name: 'notifications-outline', color: '#6b7280', bg: '#f3f4f6' };
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleDateString('th-TH', {
      year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    }) + ' น.';
  };

  const getCleanMessage = () => {
    let msg = notification.message || '';
    if (notification.orderId) {
      const shortId = notification.orderId.slice(0, 6).toUpperCase();
      msg = msg.replace(new RegExp(`ออเดอร์\\s*#?${shortId}\\s*`, 'g'), '');
      msg = msg.replace(new RegExp(`#?${shortId}\\s*`, 'g'), '');
    }
    return msg.trim();
  };

  const formatOrderId = (orderId, orderType) => {
    if (!orderId) return '';
    const shortId = orderId.slice(0, 6).toUpperCase();
    if (orderType === 'delivery') return `#D-${shortId}`;
    if (orderType === 'pickup') return `#P-${shortId}`;
    return `#${shortId}`;
  };

  const handlePhoneAction = (phone) => {
    if (!phone) return;
    Alert.alert(
      'จัดการเบอร์โทรศัพท์', phone,
      [
        { text: 'ยกเลิก', style: 'cancel' },
        { text: 'คัดลอกเบอร์', onPress: async () => { await Clipboard.setStringAsync(phone); Alert.alert('สำเร็จ', 'คัดลอกเบอร์โทรศัพท์เรียบร้อยแล้ว'); } },
        { text: 'โทรออก', onPress: () => Linking.openURL(`tel:${phone}`) }
      ]
    );
  };

  const openMap = () => {
    const lat = orderData?.customerLat || orderData?.deliveryLocation?.latitude;
    const lng = orderData?.customerLng || orderData?.deliveryLocation?.longitude;

    if (lat && lng) {
      const url = Platform.OS === 'ios' ? `maps://0,0?q=${lat},${lng}` : `geo:0,0?q=${lat},${lng}`;
      Linking.canOpenURL(url).then(supported => {
        if (supported) Linking.openURL(url);
        else Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${lat},${lng}`);
      });
      return;
    }

    const fullAddress = orderData?.customerAddress || orderData?.deliveryAddress;
    if (fullAddress && typeof fullAddress === 'string') {
      Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullAddress)}`);
    } else {
      Alert.alert('แจ้งเตือน', 'ไม่พบข้อมูลที่อยู่หรือพิกัดสำหรับเปิดแผนที่');
    }
  };

  const theme = getNotificationTheme(notification.type);
  let buttonText = 'กลับสู่หน้าหลักร้านค้า';
  let buttonColor = '#1f2937';
  let actionTarget = 'myshop';

  if (notification.type === 'new_order') {
    buttonText = '📋 ไปที่หน้าออเดอร์'; buttonColor = '#10b981'; actionTarget = 'store_orders';
  } else if (notification.type === 'order_cancelled_by_customer') {
    buttonText = '📋 ดูประวัติออเดอร์'; buttonColor = '#ef4444'; actionTarget = 'store_orders';
  } else if (notification.type === 'store_edit_rejected') {
    buttonText = '⚙️ ไปที่หน้าแก้ไขข้อมูลร้านค้า'; buttonColor = '#f59e0b'; actionTarget = 'store_settings';
  } else if (notification.type === 'store_edit_approved') {
    buttonText = '✅ กลับสู่หน้าหลักร้านค้า'; buttonColor = '#10b981'; actionTarget = 'myshop';
  }

  const handleActionButton = () => {
    if (actionTarget === 'store_orders') navigation.navigate('StoreOrders');
    else if (actionTarget === 'store_settings') navigation.navigate('StoreSettings');
    else navigation.navigate('MyShop');
  };

  const orderItems = orderData?.items || orderData?.cart || orderData?.cartItems || [];
  const displayPhone = orderData?.displayPhone;
  const isPhoneValid = displayPhone && displayPhone !== '' && displayPhone !== 'ไม่ระบุเบอร์โทร';
  const customerName = orderData?.customerName || '-';

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={28} color="#1f2937" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>รายละเอียดแจ้งเตือน</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.notificationHeader}>
          <View style={[styles.iconWrapper, { backgroundColor: theme.bg }]}><Ionicons name={theme.name} size={32} color={theme.color} /></View>
          <Text style={styles.dateText}>{formatDate(notification.createdAt)}</Text>
          <Text style={styles.titleText}>{notification.title}</Text>
          {getCleanMessage() !== '' && <Text style={styles.messageText}>{getCleanMessage()}</Text>}
        </View>

        {loadingData ? (
          <ActivityIndicator size="small" color="#10b981" style={{ marginTop: 20 }} />
        ) : (
          <>
            {/* 🟢 ส่วนที่เพิ่มใหม่: แสดงข้อมูลที่ขอแก้ไข สำหรับแจ้งเตือนการอนุมัติ/ปฏิเสธร้านค้า */}
            {(notification.type === 'store_edit_approved' || notification.type === 'store_edit_rejected') && (
               <View style={styles.detailSection}>
                 <Text style={styles.sectionLabel}>สรุปข้อมูลที่ส่งคำขอแก้ไข</Text>
                 <View style={styles.detailCard}>
                    {notification.details && Object.keys(notification.details).length > 0 ? (
                        Object.entries(notification.details).map(([key, value], index, array) => (
                           <View key={index}>
                               <View style={styles.infoRowColumn}>
                                   <Text style={styles.infoLabel}>{key}</Text>
                                   <Text style={styles.infoValueDark}>{value || '-'}</Text>
                               </View>
                               {index < array.length - 1 && <View style={styles.divider} />}
                           </View>
                        ))
                    ) : (
                        // 🛡️ ถ้าฐานข้อมูลไม่มีรายละเอียดแนบมาด้วย จะแสดงข้อความนี้แทน
                        <Text style={{ fontSize: 13, color: '#ef4444', textAlign: 'center', marginVertical: 10, lineHeight: 20 }}>
                            ไม่มีข้อมูลสรุปแนบมาในการแจ้งเตือนนี้ {'\n'}(อาจเป็นคำขอเก่า หรือแคชของระบบทำงานขัดข้อง)
                        </Text>
                    )}
                 </View>
               </View>
            )}

            {/* ส่วนแสดงสาเหตุการปฏิเสธของร้านค้า */}
            {notification.cancelReason && !notification.orderId && (
              <View style={styles.detailSection}>
                <Text style={styles.sectionLabel}>รายละเอียดเพิ่มเติม</Text>
                <View style={[styles.detailCard, { borderColor: '#fca5a5', backgroundColor: '#fef2f2' }]}>
                   <View style={styles.infoRowColumn}>
                      <Text style={[styles.infoLabel, { color: '#ef4444' }]}>สาเหตุที่ไม่อนุมัติ</Text>
                      <Text style={[styles.infoValueTextBox, { backgroundColor: '#ffffff', color: '#991b1b' }]}>
                        {notification.cancelReason}
                      </Text>
                   </View>
                </View>
              </View>
            )}

            {/* ส่วนแสดงข้อมูลออเดอร์ (คงเดิม) */}
            {notification.orderId && orderData && (
              <>
                <View style={styles.detailSection}>
                  <Text style={styles.sectionLabel}>ข้อมูลคำสั่งซื้อเบื้องต้น</Text>
                  <View style={styles.detailCard}>
                    <View style={styles.infoRow}>
                      <Text style={styles.infoLabel}>หมายเลขออเดอร์</Text>
                      <Text style={[styles.infoValueDark, { fontSize: 16, fontWeight: '700' }]}>{formatOrderId(orderData.id, orderData.orderType)}</Text>
                    </View>
                    <View style={styles.divider} />
                    <View style={styles.infoRow}>
                      <Text style={styles.infoLabel}>ประเภท</Text>
                      <Text style={[styles.infoValueDark, { color: orderData.orderType === 'delivery' ? '#0284c7' : '#10b981', fontWeight: 'bold' }]}>
                        {orderData.orderType === 'delivery' ? '🛵 จัดส่ง (Delivery)' : '🛍️ รับที่ร้าน (Pickup)'}
                      </Text>
                    </View>
                    <View style={styles.divider} />
                    <View style={styles.infoRow}>
                      <Text style={styles.infoLabel}>ยอดรวม</Text>
                      <Text style={[styles.infoValueDark, { color: '#1f2937', fontWeight: 'bold' }]}>฿{orderData.totalAmount || orderData.totalPrice}</Text>
                    </View>

                    {orderItems.length > 0 && (
                      <>
                        <View style={styles.divider} />
                        <Text style={[styles.infoLabel, { marginBottom: 10 }]}>รายการสินค้า:</Text>
                        {orderItems.map((item, index) => (
                          <View key={index} style={styles.itemRow}>
                            <Text style={styles.itemName}>• {item.name || item.foodName || 'สินค้า'}</Text>
                            <Text style={styles.itemQty}>x{item.quantity || 1}</Text>
                          </View>
                        ))}
                      </>
                    )}

                    {notification.cancelReason && (
                      <>
                        <View style={styles.divider} />
                        <View style={styles.infoRowColumn}>
                          <Text style={[styles.infoLabel, { color: '#ef4444' }]}>สาเหตุการยกเลิกออเดอร์</Text>
                          <Text style={[styles.infoValueTextBox, { backgroundColor: '#fef2f2', color: '#991b1b' }]}>{notification.cancelReason}</Text>
                        </View>
                      </>
                    )}
                    {orderData.note && (
                      <>
                        <View style={styles.divider} />
                        <View style={styles.infoRowColumn}>
                          <Text style={styles.infoLabel}>หมายเหตุจากลูกค้า</Text>
                          <Text style={styles.infoValueTextBox}>{orderData.note}</Text>
                        </View>
                      </>
                    )}
                  </View>
                </View>

                <View style={styles.detailSection}>
                  <Text style={styles.sectionLabel}>ข้อมูลลูกค้า</Text>
                  <View style={styles.detailCard}>
                    <View style={styles.infoRow}>
                      <Text style={styles.infoLabel}>ชื่อลูกค้า</Text>
                      <Text style={styles.infoValueDark}>{customerName}</Text>
                    </View>
                    <View style={styles.divider} />
                    <View style={styles.infoRow}>
                      <Text style={styles.infoLabel}>เบอร์โทรศัพท์</Text>
                      {isPhoneValid ? (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                          <Text style={styles.infoValueDark}>{displayPhone}</Text>
                          <TouchableOpacity onPress={() => handlePhoneAction(displayPhone)} style={styles.actionIconBadge}>
                            <Ionicons name="call" size={14} color="#ffffff" />
                          </TouchableOpacity>
                        </View>
                      ) : (
                        <Text style={[styles.infoValueDark, { color: '#9ca3af' }]}>ไม่ระบุเบอร์โทร</Text>
                      )}
                    </View>

                    {orderData.orderType === 'delivery' && (
                      <>
                        <View style={styles.divider} />
                        <View style={styles.infoRowColumn}>
                          <Text style={styles.infoLabel}>ที่อยู่จัดส่ง</Text>
                          <View style={styles.addressDisplayBox}>
                            <Text style={styles.addressTitleText}>{orderData.customerAddressTitle || 'ที่อยู่จัดส่ง'}</Text>
                            <Text style={styles.addressFullText}>{orderData.customerAddress || orderData.deliveryAddress || 'ไม่ระบุรายละเอียดที่อยู่'}</Text>
                          </View>
                          <TouchableOpacity style={styles.mapButtonNav} onPress={openMap}>
                            <Ionicons name="map-outline" size={18} color="#0369a1" />
                            <Text style={styles.mapButtonNavText}>เปิดดูในแผนที่</Text>
                            <Ionicons name="chevron-forward" size={16} color="#0369a1" style={{ marginLeft: 'auto' }} />
                          </TouchableOpacity>
                        </View>
                      </>
                    )}
                  </View>
                </View>
              </>
            )}
          </>
        )}
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity style={[styles.actionButton, { backgroundColor: buttonColor }]} onPress={handleActionButton}>
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
  footer: { paddingHorizontal: 24, paddingBottom: Platform.OS === 'ios' ? 30 : 20, paddingTop: 10, backgroundColor: '#ffffff' },
  actionButton: { paddingVertical: 16, borderRadius: 12, alignItems: 'center' },
  actionButtonText: { color: '#ffffff', fontSize: 15, fontWeight: '600', letterSpacing: 0.5 },
  emptyText: { color: '#6b7280', fontSize: 16 },
  detailSection: { width: '100%', marginBottom: 20 },
  sectionLabel: { fontSize: 13, color: '#9ca3af', fontWeight: '600', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 1 },
  detailCard: { backgroundColor: '#f9fafb', borderRadius: 16, padding: 20, borderWidth: 1, borderColor: '#f3f4f6' },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginVertical: 4 },
  infoLabel: { fontSize: 13, color: '#6b7280' },
  infoValueDark: { fontSize: 14, color: '#1f2937', fontWeight: '500', marginTop: 4 },
  divider: { height: 1, backgroundColor: '#e5e7eb', marginVertical: 14 },
  infoRowColumn: { flexDirection: 'column', alignItems: 'flex-start', gap: 2, width: '100%' },
  infoValueTextBox: { fontSize: 14, color: '#4b5563', backgroundColor: '#e5e7eb', padding: 12, borderRadius: 8, width: '100%', lineHeight: 22, marginTop: 6 },
  itemRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginVertical: 4, paddingLeft: 10 },
  itemName: { fontSize: 14, color: '#374151', flex: 1, paddingRight: 10 },
  itemQty: { fontSize: 14, fontWeight: 'bold', color: '#10b981' },
  actionIconBadge: { backgroundColor: '#10b981', width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', shadowColor: '#10b981', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 3, elevation: 2 },
  addressDisplayBox: { backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 8, padding: 12, width: '100%', marginBottom: 5, marginTop: 5 },
  addressTitleText: { fontSize: 14, fontWeight: 'bold', color: '#1f2937', marginBottom: 4 },
  addressFullText: { fontSize: 14, color: '#4b5563', lineHeight: 22 },
  mapButtonNav: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f0f9ff', borderWidth: 1, borderColor: '#bae6fd', paddingVertical: 10, paddingHorizontal: 12, borderRadius: 8, width: '100%', gap: 8 },
  mapButtonNavText: { fontSize: 14, color: '#0369a1', fontWeight: '600' }
});