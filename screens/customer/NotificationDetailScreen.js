import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Platform, StatusBar, ScrollView,
  ActivityIndicator, Image, Linking, Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { db } from '../../firebase.config';
import { doc, getDoc } from 'firebase/firestore';

export default function NotificationDetailScreen({ navigation, route }) {
  const { notification } = route.params || {};
  const [orderData, setOrderData] = useState(null);
  const [storeData, setStoreData] = useState(null);
  const [foodData, setFoodData] = useState(null);
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
            let storeSnap = await getDoc(doc(db, 'stores', notification.userId));
            if (storeSnap.exists()) {
              setStoreData({ id: storeSnap.id, ...storeSnap.data() });
            } else {
              storeSnap = await getDoc(doc(db, 'users', notification.userId));
              if (storeSnap.exists()) setStoreData({ id: storeSnap.id, ...storeSnap.data() });
            }
          }
        }
        else if (notification?.type === 'new_food_item' && notification?.foodId) {
          const foodSnap = await getDoc(doc(db, 'food_items', notification.foodId));
          if (foodSnap.exists()) {
            const fetchedFood = { id: foodSnap.id, ...foodSnap.data() };
            setFoodData(fetchedFood);

            // 🔴 ดึงข้อมูลร้านค้ามาด้วย เพื่อเอามาเช็คว่าร้านเปิดหรือปิดอยู่
            const storeIdToFetch = notification.storeId || fetchedFood.storeId || fetchedFood.userId;
            if (storeIdToFetch) {
              let storeSnap = await getDoc(doc(db, 'stores', storeIdToFetch));
              if (storeSnap.exists()) {
                setStoreData({ id: storeSnap.id, ...storeSnap.data() });
              } else {
                storeSnap = await getDoc(doc(db, 'users', storeIdToFetch));
                if (storeSnap.exists()) setStoreData({ id: storeSnap.id, ...storeSnap.data() });
              }
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

  // 🔴 ฟังก์ชันเช็คว่าตอนนี้ร้านเปิดอยู่หรือไม่ (รองรับเปิดข้ามคืน)
  const checkIsStoreOpen = () => {
    if (loadingData) return true; // ถือว่าเปิดไว้ก่อนระหว่างโหลด จะได้ไม่กระพริบ
    if (!storeData) return false;

    const now = new Date();
    const daysMap = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
    const currentDayIdx = now.getDay();
    const prevDayIdx = currentDayIdx === 0 ? 6 : currentDayIdx - 1;

    let todayHours = storeData.businessHours
      ? storeData.businessHours[daysMap[currentDayIdx]]
      : { isOpen: true, openTime: storeData.openTime || "08:00", closeTime: storeData.closeTime || storeData.closingTime || "20:00" };

    let prevDayHours = storeData.businessHours
      ? storeData.businessHours[daysMap[prevDayIdx]]
      : todayHours;

    // เช็คกรณีเปิดข้ามคืนมาจากเมื่อวาน
    if (prevDayHours && prevDayHours.isOpen) {
      const [poH, poM] = prevDayHours.openTime.split(':').map(Number);
      const [pcH, pcM] = prevDayHours.closeTime.split(':').map(Number);
      if (pcH < poH || (pcH === poH && pcM < poM)) {
         if (now.getHours() < pcH || (now.getHours() === pcH && now.getMinutes() < pcM)) {
             return true;
         }
      }
    }

    // เช็คเวลาของวันนี้
    if (todayHours && todayHours.isOpen) {
      const [toH, toM] = todayHours.openTime.split(':').map(Number);
      const [tcH, tcM] = todayHours.closeTime.split(':').map(Number);

      let oDate = new Date(); oDate.setHours(toH, toM, 0, 0);
      let cDate = new Date(); cDate.setHours(tcH, tcM, 0, 0);

      if (tcH < toH || (tcH === toH && tcM < toM)) {
         cDate.setDate(cDate.getDate() + 1);
      }

      return now >= oDate && now <= cDate;
    }

    return false;
  };

  const getNotificationTheme = (type) => {
    switch (type) {
      case 'order_confirmed': return { name: 'restaurant-outline', color: '#3b82f6', bg: '#eff6ff' };
      case 'order_completed': return { name: 'checkmark-circle-outline', color: '#10b981', bg: '#f0fdf4' };
      case 'order_cancelled': return { name: 'close-circle-outline', color: '#ef4444', bg: '#fef2f2' };
      case 'store_approved': return { name: 'storefront-outline', color: '#10b981', bg: '#f0fdf4' };
      case 'store_rejected': return { name: 'warning-outline', color: '#ef4444', bg: '#fef2f2' };
      case 'new_food_item': return { name: 'fast-food-outline', color: '#f59e0b', bg: '#fffbeb' };
      case 'promo': return { name: 'flash-outline', color: '#f59e0b', bg: '#fffbeb' };
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
    }
    return msg.trim();
  };

  const theme = getNotificationTheme(notification.type);
  const isStoreOpen = checkIsStoreOpen();

// 🔴 ตั้งค่าปุ่มกดตามสถานะร้านค้า
  let buttonText = 'กลับสู่หน้าหลัก';
  let buttonColor = '#1f2937';
  let actionTarget = 'home';

  if (notification.type === 'new_food_item') {
    if (foodData) {
      if (isStoreOpen) {
        buttonText = '🛒 กดสั่งซื้อเลย';
        buttonColor = '#10b981';
        actionTarget = 'buy';
      } else {
        buttonText = '🏪 ร้านปิดอยู่ (ไปดูหน้าร้าน)';
        buttonColor = '#f59e0b';
        actionTarget = 'store';
      }
    } else if (notification.foodId) {
      buttonText = loadingData ? 'กำลังโหลดข้อมูล...' : '❌ ไม่พบสินค้า (อาจถูกลบไปแล้ว)';
      buttonColor = '#ef4444';
      actionTarget = 'none';
    } else {
      buttonText = '🍱 ดูเมนูของร้าน';
      buttonColor = '#9ca3af';
      actionTarget = 'store';
    }
  }
  // 🟢 เพิ่มบล็อกนี้ สำหรับแจ้งเตือนรับอาหารสำเร็จ
  else if (notification.type === 'order_completed') {
    if (orderData) {
      if (!orderData.isReviewed) {
        buttonText = '⭐ เขียนรีวิวให้ออเดอร์นี้';
        buttonColor = '#f59e0b'; // สีส้มเด่นๆ
        actionTarget = 'review';
      } else {
        buttonText = '👁️ ดูรีวิวของคุณที่หน้าร้านค้า';
        buttonColor = '#3b82f6'; // สีฟ้า
        actionTarget = 'view_review';
      }
    } else {
      buttonText = loadingData ? 'กำลังโหลดข้อมูล...' : '❌ ไม่พบข้อมูลออเดอร์';
      buttonColor = '#ef4444';
      actionTarget = 'none';
    }
  }

  const handleActionButton = () => {
    if (actionTarget === 'buy') {
      navigation.navigate('FoodDetail', { food: { ...foodData, storeName: notification.storeName } });
    } else if (actionTarget === 'store') {
      navigation.navigate('StoreDetail', { storeId: notification.storeId });
    } else if (actionTarget === 'review') {
      navigation.navigate('WriteReview', { order: orderData });
    } else if (actionTarget === 'view_review') {
      // พาไปที่หน้าร้านค้า ลูกค้าจะสามารถกดแท็บ "รีวิว" เพื่อดูรีวิวตัวเองได้
      navigation.navigate('StoreDetail', { storeId: orderData.storeId || notification.storeId });
    } else if (actionTarget === 'home') {
      navigation.navigate('Home');
    }
  };

  const displayImage = foodData?.imageUrl || notification.foodImage;

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
          <View style={[styles.iconWrapper, { backgroundColor: theme.bg }]}><Ionicons name={theme.name} size={32} color={theme.color} /></View>
          <Text style={styles.dateText}>{formatDate(notification.createdAt)}</Text>
          <Text style={styles.titleText}>{notification.title}</Text>
          <Text style={styles.messageText}>{getCleanMessage()}</Text>
        </View>

        {notification.type === 'new_food_item' && (
          <View style={styles.newFoodCard}>
            {displayImage ? (
              <Image source={{ uri: displayImage }} style={styles.newFoodImage} />
            ) : (
              <View style={styles.newFoodImagePlaceholder}><Ionicons name="fast-food-outline" size={36} color="#f59e0b" /></View>
            )}
            <View style={styles.newFoodInfo}>
              <Text style={styles.newFoodLabel}>เมนูใหม่จากร้านโปรดของคุณ</Text>
              <Text style={styles.newFoodName}>{notification.foodName}</Text>
              <Text style={styles.newFoodStore}>🏪 {notification.storeName}</Text>

              {notification.foodId ? (
                <View style={{ flexDirection: 'row', alignItems: 'baseline', marginTop: 6, gap: 6 }}>
                  <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#10b981' }}>
                    ฿{foodData?.discountPrice || notification.price}
                  </Text>
                  {(foodData?.originalPrice || notification.originalPrice) > 0 && (
                    <Text style={{ fontSize: 12, color: '#9ca3af', textDecorationLine: 'line-through' }}>
                      ฿{foodData?.originalPrice || notification.originalPrice}
                    </Text>
                  )}
                </View>
              ) : null}
            </View>
          </View>
        )}

        {notification.type === 'new_food_item' && foodData && (
          <View style={styles.detailSection}>
            <Text style={styles.sectionLabel}>ข้อมูลสินค้าเบื้องต้น</Text>
            <View style={styles.detailCard}>

              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>หมวดหมู่</Text>
                <Text style={styles.infoValueDark}>{foodData.category || '-'}</Text>
              </View>
              <View style={styles.divider} />

              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>จำนวนที่ลงขาย</Text>
                <Text style={[styles.infoValueDark, { color: '#f59e0b', fontWeight: 'bold' }]}>
                  {foodData.quantity} {foodData.unit || foodData.sellingUnit || 'รายการ'}
                </Text>
              </View>

              {foodData.expiryDate ? (
                <>
                  <View style={styles.divider} />
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>ควรบริโภคก่อน</Text>
                    <Text style={[styles.infoValueDark, { color: '#ef4444' }]}>{foodData.expiryDate}</Text>
                  </View>
                </>
              ) : null}

              {foodData.description ? (
                <>
                  <View style={styles.divider} />
                  <View style={styles.infoRowColumn}>
                    <Text style={styles.infoLabel}>รายละเอียดสินค้า</Text>
                    <Text style={styles.infoValueTextBox}>{foodData.description}</Text>
                  </View>
                </>
              ) : null}

              {foodData.pickupNote ? (
                <>
                  <View style={styles.divider} />
                  <View style={styles.infoRowColumn}>
                    <Text style={styles.infoLabel}>หมายเหตุการรับสินค้า</Text>
                    <Text style={styles.infoValueTextBox}>{foodData.pickupNote}</Text>
                  </View>
                </>
              ) : null}

            </View>
          </View>
        )}

{/* 🟢 ส่วนแสดงรายละเอียดออเดอร์เมื่อรับอาหารสำเร็จ */}
        {notification.type === 'order_completed' && orderData && (
          <View style={[styles.detailSection, { marginTop: 10 }]}>
            <Text style={styles.sectionLabel}>สรุปรายการสั่งซื้อของคุณ</Text>
            <View style={styles.detailCard}>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>หมายเลขออเดอร์</Text>
                <Text style={styles.infoValueDark}>#{orderData.id.slice(0, 6).toUpperCase()}</Text>
              </View>
              <View style={styles.divider} />

              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>ร้านค้า</Text>
                <Text style={styles.infoValueDark}>{orderData.storeName || notification.storeName}</Text>
              </View>
              <View style={styles.divider} />

              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>ประเภทการรับ</Text>
                <Text style={[styles.infoValueDark, { color: orderData.orderType === 'delivery' ? '#0284c7' : '#10b981', fontWeight: 'bold' }]}>
                  {orderData.orderType === 'delivery' ? '🛵 จัดส่ง' : '🛍️ รับที่ร้าน'}
                </Text>
              </View>
              <View style={styles.divider} />

              <Text style={[styles.infoLabel, { marginBottom: 8 }]}>รายการอาหาร:</Text>
              {orderData.items && orderData.items.length > 0 ? (
                orderData.items.map((item, index) => (
                  <View key={index} style={[styles.infoRow, { marginVertical: 2 }]}>
                    <Text style={styles.infoValueDark}>{item.quantity}x {item.foodName || item.name}</Text>
                    <Text style={styles.infoValueDark}>฿{item.price * item.quantity}</Text>
                  </View>
                ))
              ) : (
                <View style={styles.infoRow}>
                  <Text style={styles.infoValueDark}>1x {orderData.foodName || 'รายการอาหาร'}</Text>
                  <Text style={styles.infoValueDark}>฿{orderData.totalPrice}</Text>
                </View>
              )}

              <View style={styles.divider} />

              <View style={styles.infoRow}>
                <Text style={[styles.infoLabel, { fontWeight: 'bold', color: '#1f2937' }]}>ยอดรวมทั้งสิ้น</Text>
                <Text style={[styles.infoValueDark, { color: '#ef4444', fontSize: 16, fontWeight: 'bold' }]}>
                  ฿{orderData.totalPrice}
                </Text>
              </View>
            </View>
          </View>
        )}
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: buttonColor }, actionTarget === 'none' && { opacity: 0.5 }]}
          onPress={handleActionButton}
          disabled={actionTarget === 'none'}
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
  footer: { paddingHorizontal: 24, paddingBottom: Platform.OS === 'ios' ? 30 : 20, paddingTop: 10, backgroundColor: '#ffffff' },
  actionButton: { paddingVertical: 16, borderRadius: 12, alignItems: 'center' },
  actionButtonText: { color: '#ffffff', fontSize: 15, fontWeight: '600', letterSpacing: 0.5 },
  newFoodCard: { flexDirection: 'row', backgroundColor: '#fffbeb', borderWidth: 1, borderColor: '#fde68a', borderRadius: 16, padding: 16, marginBottom: 25, alignItems: 'center', gap: 14 },
  newFoodImage: { width: 72, height: 72, borderRadius: 12, backgroundColor: '#e5e7eb' },
  newFoodImagePlaceholder: { width: 72, height: 72, borderRadius: 12, backgroundColor: '#fef3c7', alignItems: 'center', justifyContent: 'center' },
  newFoodInfo: { flex: 1 },
  newFoodLabel: { fontSize: 11, color: '#d97706', fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4 },
  newFoodName: { fontSize: 16, fontWeight: '800', color: '#1f2937', marginBottom: 4 },
  newFoodStore: { fontSize: 13, color: '#6b7280' },
  emptyText: { color: '#6b7280', fontSize: 16 },
  detailSection: { width: '100%' },
  sectionLabel: { fontSize: 13, color: '#9ca3af', fontWeight: '600', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 1 },
  detailCard: { backgroundColor: '#f9fafb', borderRadius: 16, padding: 20, borderWidth: 1, borderColor: '#f3f4f6' },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginVertical: 4 },
  infoLabel: { fontSize: 14, color: '#6b7280' },
  infoValueDark: { fontSize: 14, color: '#1f2937', fontWeight: '500' },
  divider: { height: 1, backgroundColor: '#e5e7eb', marginVertical: 14 },
  infoRowColumn: { flexDirection: 'column', alignItems: 'flex-start', gap: 8 },
  infoValueTextBox: { fontSize: 13, color: '#4b5563', backgroundColor: '#e5e7eb', padding: 12, borderRadius: 8, width: '100%', lineHeight: 22 },
});