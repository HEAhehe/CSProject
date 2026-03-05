import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Platform, StatusBar, ScrollView,
  ActivityIndicator, Alert, Linking, Image
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { db, auth } from '../../firebase.config';
import { doc, getDoc } from 'firebase/firestore';
import * as Clipboard from 'expo-clipboard';

export default function StoreNotificationDetailScreen({ navigation, route }) {
  const { notification } = route.params || {};
  const [orderData, setOrderData] = useState(null);
  const [storeData, setStoreData] = useState(null);
  const [loadingData, setLoadingData] = useState(false);

  useEffect(() => {
    const fetchContextData = async () => {
      setLoadingData(true);
      try {
        const user = auth.currentUser;
        if (user) {
           const sSnap = await getDoc(doc(db, 'stores', user.uid));
           if (sSnap.exists()) setStoreData(sSnap.data());
        }

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
      case 'new_review': return { name: 'star-outline', color: '#f59e0b', bg: '#fffbeb' };
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

  // 🟢 ฟังก์ชันนี้แหละที่หายไปรอบก่อน (สำหรับการโทรออก)
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

  // 🟢 และฟังก์ชันนี้ (สำหรับเปิดแผนที่)
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

  const getIconForDetailKey = (key) => {
    const lowerKey = key.toLowerCase();
    if (lowerKey.includes('ชื่อร้าน')) return 'storefront-outline';
    if (lowerKey.includes('เจ้าของ')) return 'person-outline';
    if (lowerKey.includes('เบอร์')) return 'call-outline';
    if (lowerKey.includes('ที่อยู่') || lowerKey.includes('โลเคชั่น')) return 'location-outline';
    if (lowerKey.includes('รายละเอียด')) return 'document-text-outline';
    if (lowerKey.includes('จัดส่ง')) return 'bicycle-outline';
    if (lowerKey.includes('เวลา')) return 'time-outline';
    return 'information-circle-outline';
  };

  const parseAndFillBusinessHours = (hoursString) => {
    if (!hoursString) return '';

    const defaultDays = [
      { label: 'จันทร์', time: 'ปิดทำการ', match: ['จันทร์', 'mon'] },
      { label: 'อังคาร', time: 'ปิดทำการ', match: ['อังคาร', 'tue'] },
      { label: 'พุธ', time: 'ปิดทำการ', match: ['พุธ', 'wed'] },
      { label: 'พฤหัสบดี', time: 'ปิดทำการ', match: ['พฤหัส', 'thu'] },
      { label: 'ศุกร์', time: 'ปิดทำการ', match: ['ศุกร์', 'fri'] },
      { label: 'เสาร์', time: 'ปิดทำการ', match: ['เสาร์', 'sat'] },
      { label: 'อาทิตย์', time: 'ปิดทำการ', match: ['อาทิตย์', 'sun'] }
    ];

    const lines = String(hoursString).split(/[\n,]/).map(l => l.trim()).filter(l => l);

    lines.forEach(line => {
        let dayPart = '';
        let timePart = '';
        const colonIndex = line.indexOf(':');
        if (colonIndex !== -1) {
            dayPart = line.substring(0, colonIndex).trim().toLowerCase();
            timePart = line.substring(colonIndex + 1).trim();
        } else {
            const spaceIndex = line.indexOf(' ');
            if (spaceIndex !== -1) {
                dayPart = line.substring(0, spaceIndex).trim().toLowerCase();
                timePart = line.substring(spaceIndex + 1).trim();
            } else {
                dayPart = line.toLowerCase();
                timePart = 'เปิดทำการ';
            }
        }

        const targetDay = defaultDays.find(d => d.match.some(m => dayPart.includes(m)));
        if (targetDay) {
            if (timePart !== '' && timePart !== '-' && !timePart.includes('ปิด')) {
                targetDay.time = timePart;
            }
        }
    });

    return defaultDays.map(d => `${d.label}: ${d.time}`).join('\n');
  };

  const getProcessedDetails = (rawDetails) => {
    if (!rawDetails) return [];

    const isRejected = notification.type === 'store_edit_rejected';

    let oldMapped = {};
    if (storeData) {
        oldMapped['ชื่อร้านค้า'] = storeData.storeName || '';
        oldMapped['เจ้าของร้าน'] = storeData.storeOwner || '';
        oldMapped['เบอร์โทรศัพท์'] = storeData.phoneNumber || storeData.phone || '';
        oldMapped['ที่อยู่'] = storeData.location || '';
        oldMapped['รายละเอียดร้าน'] = storeData.storeDetails || '';

        let del = storeData.deliveryMethod;
        oldMapped['การจัดส่ง'] = del === 'pickup' ? 'รับที่ร้าน' : del === 'delivery' ? 'เดลิเวอรี่' : del === 'both' ? 'ทั้งสองแบบ' : '';
        oldMapped['รูปร้านค้า'] = storeData.storeImage || '';

        if (storeData.businessHours) {
           const daysOfWeek = [
              { id: 'mon', label: 'จันทร์' }, { id: 'tue', label: 'อังคาร' }, { id: 'wed', label: 'พุธ' },
              { id: 'thu', label: 'พฤหัสบดี' }, { id: 'fri', label: 'ศุกร์' }, { id: 'sat', label: 'เสาร์' }, { id: 'sun', label: 'อาทิตย์' }
          ];
          oldMapped['เวลาทำการ'] = daysOfWeek.map(d => {
              return storeData.businessHours[d.id]?.isOpen ? `${d.label}: ${storeData.businessHours[d.id].openTime}-${storeData.businessHours[d.id].closeTime}` : `${d.label}: ปิดทำการ`;
          }).join('\n');
        } else {
            oldMapped['เวลาทำการ'] = '';
        }
    }

    let items = [];
    Object.entries(rawDetails).forEach(([key, val]) => {
      let newKey = key;
      if (newKey.includes('ชื่อร้าน')) newKey = 'ชื่อร้านค้า';
      if (newKey.includes('ที่อยู่')) newKey = 'ที่อยู่';
      if (newKey.includes('เบอร์โทร')) newKey = 'เบอร์โทรศัพท์';

      let isImage = false;
      if (newKey.includes('รูป') || newKey === 'storeImage') {
         isImage = true;
         newKey = 'รูปร้านค้า';
      }

      let newVal = val;
      if (newKey.includes('เวลาทำการ')) {
        newVal = parseAndFillBusinessHours(String(val));
      }

      let oldVal = oldMapped[newKey] || '';
      if (newKey.includes('เวลาทำการ') && oldVal !== '') {
          oldVal = parseAndFillBusinessHours(String(oldVal));
      }

      if (isRejected && String(oldVal) === String(newVal)) {
          return;
      }

      items.push({
          key: newKey,
          oldVal: isImage ? oldVal : String(oldVal),
          newVal: isImage ? newVal : String(newVal),
          isImage: isImage
      });
    });

    const keyWeight = { 'รูปร้านค้า': 0, 'ชื่อร้านค้า': 1, 'รายละเอียดร้าน': 2, 'เจ้าของร้าน': 3, 'เบอร์โทรศัพท์': 4, 'ที่อยู่': 5, 'เวลาทำการ': 6, 'การจัดส่ง': 7 };
    items.sort((a, b) => (keyWeight[a.key] || 99) - (keyWeight[b.key] || 99));

    return items;
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
    buttonText = '⚙️ ไปหน้าแก้ไขข้อมูลร้านค้า'; buttonColor = '#f59e0b'; actionTarget = 'store_settings';
  } else if (notification.type === 'store_edit_approved') {
    buttonText = '✅ กลับสู่หน้าหลักร้านค้า'; buttonColor = '#10b981'; actionTarget = 'myshop';
  }
  // 🟢 เพิ่มบล็อกนี้ สำหรับแจ้งเตือนรีวิว
  else if (notification.type === 'new_review') {
    buttonText = '⭐ ไปดูหน้ารีวิวของร้าน'; buttonColor = '#f59e0b'; actionTarget = 'store_reviews';
  }

  const handleActionButton = () => {
    if (actionTarget === 'store_orders') navigation.navigate('StoreOrders');
    else if (actionTarget === 'store_settings') navigation.navigate('StoreSettings');
    // 🟢 เพิ่มเงื่อนไขนำทางไปหน้า Dashboard พร้อมส่ง Param "tab"
    else if (actionTarget === 'store_reviews') navigation.navigate('StoreDashboard', { tab: 'reviews' });
    else navigation.navigate('MyShop');
  };

  const processedStoreDetails = !loadingData ? getProcessedDetails(notification.details) : [];
  const isRejectedType = notification.type === 'store_edit_rejected';

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
            {/* 🔴 สาเหตุที่ปฏิเสธ หรือ สาเหตุการยกเลิกออเดอร์ (แสดงเสมอถ้ามี) */}
            {notification.cancelReason && (
              <View style={styles.detailSection}>
                <Text style={styles.sectionLabel}>
                  {notification.type === 'order_cancelled_by_customer' ? 'สาเหตุการยกเลิกออเดอร์' : 'สาเหตุที่ไม่อนุมัติ'}
                </Text>
                <View style={[styles.detailCard, { borderColor: '#fca5a5', backgroundColor: '#fef2f2' }]}>
                   <View style={styles.infoRowColumn}>
                      <View style={{flexDirection: 'row', alignItems: 'center', marginBottom: 6}}>
                         <Ionicons name={notification.type === 'order_cancelled_by_customer' ? "close-circle" : "warning"} size={18} color="#ef4444" style={{marginRight: 6}} />
                         <Text style={[styles.infoLabel, { color: '#ef4444', fontWeight: 'bold', fontSize: 15 }]}>
                           {notification.type === 'order_cancelled_by_customer' ? 'ลูกค้าระบุว่า:' : 'แอดมินแจ้งว่า:'}
                         </Text>
                      </View>
                      <Text style={[styles.infoValueTextBox, { backgroundColor: '#ffffff', color: '#991b1b', fontSize: 15, fontWeight: '500' }]}>
                        {notification.cancelReason}
                      </Text>
                   </View>
                </View>
              </View>
            )}

            {/* 🟢 ข้อมูลที่ขอแก้ไขร้านค้า (Store Update) */}
            {(notification.type === 'store_edit_approved' || notification.type === 'store_edit_rejected') && (
               <View style={styles.detailSection}>
                 <Text style={styles.sectionLabel}>ข้อมูลที่คุณส่งคำขอแก้ไข</Text>
                 <View style={styles.detailCard}>

                    {processedStoreDetails.length > 0 ? (
                        processedStoreDetails.map((item, index, array) => {
                           const isTimeSection = item.key.includes('เวลา');

                           const renderTextValue = (val, isOld = false) => {
                               if (!val || val === '') val = '-';
                               if (isTimeSection) {
                                  return val.split('\n').map((line, idx) => {
                                      const colonIndex = line.indexOf(':');
                                      if (colonIndex !== -1) {
                                          const day = line.substring(0, colonIndex).trim();
                                          const time = line.substring(colonIndex + 1).trim();
                                          const isClosed = time.includes('ปิด');
                                          return (
                                              <View key={idx} style={{ flexDirection: 'row', marginBottom: 2 }}>
                                                  <Text style={[styles.longTextContent, { width: 75, color: '#6b7280', textDecorationLine: isOld ? 'line-through' : 'none' }]}>{day}</Text>
                                                  <Text style={[styles.longTextContent, { fontWeight: '600', color: isClosed ? '#ef4444' : '#1f2937', textDecorationLine: isOld ? 'line-through' : 'none' }]}>{time}</Text>
                                              </View>
                                          );
                                      }
                                      return <Text key={idx} style={[styles.longTextContent, isOld && {textDecorationLine: 'line-through'}]}>{line}</Text>;
                                  })
                               }
                               return <Text style={[styles.longTextContent, isOld && {textDecorationLine: 'line-through'}]}>{val}</Text>;
                           };

                           return (
                             <View key={index} style={{ marginBottom: index === array.length - 1 ? 0 : 20 }}>
                                 <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                                     <Ionicons name={getIconForDetailKey(item.key)} size={16} color="#10b981" style={{ marginRight: 6 }} />
                                     <Text style={[styles.infoLabel, { fontWeight: '600', color: '#4b5563' }]}>{item.key}</Text>
                                 </View>

                                 {isRejectedType ? (
                                     item.isImage ? (
                                         <View style={{flexDirection: 'row', gap: 10, marginTop: 4}}>
                                             <View style={{flex: 1}}>
                                                 <Text style={{fontSize: 12, color: '#ef4444', marginBottom: 4, textAlign: 'center'}}>รูปเดิม</Text>
                                                 <View style={[styles.imagePreviewBox, {opacity: 0.6}]}>
                                                     {item.oldVal ? <Image source={{ uri: item.oldVal }} style={styles.storeImagePreview} /> : <View style={styles.centerIcon}><Ionicons name="image-outline" size={24} color="#9ca3af" /></View>}
                                                 </View>
                                             </View>
                                             <View style={{flex: 1}}>
                                                 <Text style={{fontSize: 12, color: '#10b981', marginBottom: 4, textAlign: 'center', fontWeight: 'bold'}}>รูปที่ขอแก้ไข</Text>
                                                 <View style={[styles.imagePreviewBox, {borderColor: '#10b981', borderWidth: 2}]}>
                                                     {item.newVal ? <Image source={{ uri: item.newVal }} style={styles.storeImagePreview} /> : <View style={styles.centerIcon}><Ionicons name="image-outline" size={24} color="#9ca3af" /></View>}
                                                 </View>
                                             </View>
                                         </View>
                                     ) : (
                                         <View style={styles.changedBox}>
                                             <View style={styles.oldRow}>
                                                 <Ionicons name="close-circle" size={16} color="#ef4444" style={{marginTop: 2}} />
                                                 <View style={{flex: 1}}>
                                                    <Text style={{fontSize: 11, color: '#ef4444', marginBottom: 2}}>ข้อมูลเดิม</Text>
                                                    <View style={styles.diffOldContent}>
                                                        {renderTextValue(item.oldVal, true)}
                                                    </View>
                                                 </View>
                                             </View>

                                             <View style={styles.arrowRow}>
                                                 <Ionicons name="arrow-down" size={16} color="#9ca3af" />
                                             </View>

                                             <View style={styles.newRow}>
                                                 <Ionicons name="checkmark-circle" size={16} color="#10b981" style={{marginTop: 2}} />
                                                 <View style={{flex: 1}}>
                                                    <Text style={{fontSize: 11, color: '#10b981', marginBottom: 2, fontWeight: 'bold'}}>ข้อมูลที่ขอเปลี่ยนใหม่</Text>
                                                    <View style={styles.diffNewContent}>
                                                        {renderTextValue(item.newVal, false)}
                                                    </View>
                                                 </View>
                                             </View>
                                         </View>
                                     )
                                 ) : (
                                     item.isImage ? (
                                         <View style={styles.imageContainer}>
                                             <Image source={{ uri: item.newVal }} style={styles.storeImagePreview} resizeMode="cover" />
                                         </View>
                                     ) : (
                                         <View style={styles.longTextContainer}>
                                             {renderTextValue(item.newVal, false)}
                                         </View>
                                     )
                                 )}

                                 {index < array.length - 1 && <View style={[styles.divider, { marginTop: 20, marginBottom: 0 }]} />}
                             </View>
                           );
                        })
                    ) : (
                        <Text style={{ fontSize: 13, color: '#6b7280', textAlign: 'center', marginVertical: 10, lineHeight: 20 }}>
                            {isRejectedType ? 'ไม่มีข้อมูลใหม่ที่แตกต่างจากข้อมูลเดิมของร้าน' : 'ไม่มีข้อมูลสรุปแนบมาในการแจ้งเตือนนี้'}
                        </Text>
                    )}
                 </View>
               </View>
            )}

            {/* 🌟 แสดงข้อมูลรีวิว (ถ้าเป็นการแจ้งเตือนรีวิว) */}
            {notification.type === 'new_review' && (
              <View style={styles.detailSection}>
                <Text style={styles.sectionLabel}>รายละเอียดรีวิวจากลูกค้า</Text>
                <View style={[styles.detailCard, { borderColor: '#fde68a', backgroundColor: '#fffbeb' }]}>
                   <View style={styles.infoRowColumn}>
                      <Text style={styles.infoLabel}>คะแนนที่ได้รับ</Text>
                      <View style={{ flexDirection: 'row', marginTop: 4 }}>
                        {[1, 2, 3, 4, 5].map((star) => (
                          <Ionicons key={star} name="star" size={24} color={star <= notification.rating ? "#f59e0b" : "#e5e7eb"} style={{ marginRight: 2 }} />
                        ))}
                      </View>
                   </View>

                   {notification.comment ? (
                     <>
                       <View style={styles.divider} />
                       <View style={styles.infoRowColumn}>
                         <Text style={styles.infoLabel}>ความคิดเห็น</Text>
                         <Text style={[styles.infoValueTextBox, { backgroundColor: '#ffffff' }]}>{notification.comment}</Text>
                       </View>
                     </>
                   ) : null}

                   {/* 🟢 แสดงเลขออเดอร์อ้างอิงภายในตารางรีวิวเลย */}
                   <View style={styles.divider} />
                   <View style={styles.infoRow}>
                     <Text style={styles.infoLabel}>อ้างอิงจากออเดอร์</Text>
                     <Text style={[styles.infoValueDark, { fontSize: 15, fontWeight: '700', color: '#1f2937' }]}>
                       {formatOrderId(notification.orderId, orderData?.orderType || notification.orderType)}
                     </Text>
                   </View>
                </View>
              </View>
            )}

            {/* 📋 ส่วนแสดงข้อมูลออเดอร์และลูกค้า (จะถูกซ่อนถ้าเป็นการแจ้งเตือนรีวิว) */}
            {notification.orderId && notification.type !== 'new_review' && (
              <>
                <View style={styles.detailSection}>
                  <Text style={styles.sectionLabel}>ข้อมูลคำสั่งซื้อเบื้องต้น</Text>
                  <View style={styles.detailCard}>
                    <View style={styles.infoRow}>
                      <Text style={styles.infoLabel}>หมายเลขออเดอร์</Text>
                      <Text style={[styles.infoValueDark, { fontSize: 16, fontWeight: '700' }]}>{formatOrderId(notification.orderId, orderData?.orderType)}</Text>
                    </View>

                    {/* ถ้าดึงข้อมูลออเดอร์เจอ ค่อยแสดงรายละเอียด */}
                    {orderData ? (
                        <>
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

                            {orderData.note && (
                              <>
                                <View style={styles.divider} />
                                <View style={styles.infoRowColumn}>
                                  <Text style={styles.infoLabel}>หมายเหตุจากลูกค้า</Text>
                                  <Text style={styles.infoValueTextBox}>{orderData.note}</Text>
                                </View>
                              </>
                            )}
                        </>
                    ) : (
                        /* ถ้าดึงข้อมูลออเดอร์ไม่เจอ (ถูกลบไปแล้ว) */
                        <>
                            <View style={styles.divider} />
                            <View style={{flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 5, marginBottom: 5}}>
                               <Ionicons name="information-circle" size={16} color="#9ca3af" />
                               <Text style={{fontSize: 13, color: '#6b7280', textAlign: 'center'}}>
                                   ไม่สามารถดึงรายละเอียดอื่นๆ ได้ (ออเดอร์อาจถูกลบไปแล้ว)
                               </Text>
                            </View>
                        </>
                    )}
                  </View>
                </View>

                {/* ข้อมูลลูกค้า แสดงเฉพาะเมื่อมี orderData */}
                {orderData && (
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
                )}
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

  imageContainer: { width: '100%', height: 150, borderRadius: 10, overflow: 'hidden', borderWidth: 1, borderColor: '#e5e7eb' },
  storeImagePreview: { width: '100%', height: '100%' },
  imagePreviewBox: { width: '100%', height: 100, borderRadius: 8, overflow: 'hidden', borderWidth: 1, borderColor: '#e5e7eb', backgroundColor: '#f3f4f6' },
  centerIcon: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  longTextContainer: { backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 8, padding: 12, marginLeft: 22 },
  longTextContent: { fontSize: 13, color: '#374151', lineHeight: 22 },

  changedBox: { backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12, padding: 12, marginLeft: 22 },
  oldRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  diffOldContent: { opacity: 0.6 },
  arrowRow: { paddingLeft: 24, marginVertical: 6 },
  newRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  diffNewContent: { },

  infoRowColumn: { flexDirection: 'column', alignItems: 'flex-start', gap: 2, width: '100%' },
  infoLabel: { fontSize: 13, color: '#6b7280' },
  infoValueTextBox: { fontSize: 14, color: '#4b5563', backgroundColor: '#e5e7eb', padding: 12, borderRadius: 8, width: '100%', lineHeight: 22, marginTop: 6 },
  divider: { height: 1, backgroundColor: '#e5e7eb', marginVertical: 14 },

  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginVertical: 4 },
  infoValueDark: { fontSize: 14, color: '#1f2937', fontWeight: '500', marginTop: 4 },
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