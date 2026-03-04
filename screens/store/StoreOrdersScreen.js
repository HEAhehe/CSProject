import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  StatusBar,
  Alert,
  RefreshControl,
  Image,
  Animated,
  Dimensions,
  Modal,
  TouchableWithoutFeedback,
  Platform,
  ActivityIndicator,
  ScrollView,
  TextInput,
  KeyboardAvoidingView,
  Linking
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { auth, db } from '../../firebase.config';
import { collection, query, where, updateDoc, doc, getDoc, getDocs, increment, runTransaction, onSnapshot, writeBatch, setDoc } from 'firebase/firestore';
import * as Clipboard from 'expo-clipboard';

const { width } = Dimensions.get('window');

export default function StoreOrdersScreen({ navigation }) {
  const [orders, setOrders] = useState([]);
  const [allOrders, setAllOrders] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState('pending');
  const [storeData, setStoreData] = useState(null);
  const [isStoreOpen, setIsStoreOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [username, setUsername] = useState('');

  const [unreadCount, setUnreadCount] = useState(0);

  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const slideAnim = useRef(new Animated.Value(-width * 0.85)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const [cancelModalVisible, setCancelModalVisible] = useState(false);
  const seenOrderIds = useRef(null); // null = ยังไม่ initialise รอบแรก
  const [cancelOrderId, setCancelOrderId] = useState(null);
  const [cancelReason, setCancelReason] = useState('');

  const [phoneModalVisible, setPhoneModalVisible] = useState(false);
  const [selectedPhone, setSelectedPhone] = useState('');

  const defaultAvatar = Image.resolveAssetSource(require('../../assets/icon.png')).uri;
  const defaultUserAvatar = 'https://cdn-icons-png.flaticon.com/512/847/847969.png';

  const [stats, setStats] = useState({
    pending: 0,
    total: 0,
    revenue: 0,
    completedToday: 0,
    completedTotal: 0,
    posted: 0,
    sold: 0
  });

  const checkStoreOpenStatus = (businessHours) => {
    if (!businessHours) return false;
    const dayMap = { 0: 'sun', 1: 'mon', 2: 'tue', 3: 'wed', 4: 'thu', 5: 'fri', 6: 'sat' };
    const now = new Date();
    const dayKey = dayMap[now.getDay()];
    const todayHours = businessHours[dayKey];
    if (!todayHours || !todayHours.isOpen) return false;
    const { openTime, closeTime } = todayHours;
    if (!openTime || !closeTime) return false;
    const [openH, openM] = openTime.split(':').map(Number);
    const [closeH, closeM] = closeTime.split(':').map(Number);
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const openMinutes = openH * 60 + openM;
    const closeMinutes = closeH * 60 + closeM;
    if (closeMinutes < openMinutes) return currentMinutes >= openMinutes || currentMinutes < closeMinutes;
    return currentMinutes >= openMinutes && currentMinutes < closeMinutes;
  };

  const loadStoreData = async () => {
    try {
      const user = auth.currentUser;
      if (!user) return;
      // โหลด username จาก users collection
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (userDoc.exists()) {
        const data = userDoc.data();
        setUsername(data.username || data.displayName || user.displayName || 'Username');
      } else {
        setUsername(user.displayName || 'Username');
      }
      const storeDocRef = doc(db, 'stores', user.uid);
      const storeDoc = await getDoc(storeDocRef);
      if (storeDoc.exists()) {
        const storeInfo = storeDoc.data();
        setStoreData(storeInfo);
        setIsStoreOpen(checkStoreOpenStatus(storeInfo.businessHours));
      }

      const foodSnap = await getDocs(query(collection(db, 'food_items'), where('userId', '==', user.uid)));
      const posted = foodSnap.docs.filter(d => d.data().quantity > 0).length;
      setStats(prev => ({ ...prev, posted }));
    } catch (error) {
      console.error('Error loading store data:', error);
    }
  };

  useEffect(() => {
    loadStoreData();

    const user = auth.currentUser;
    if (!user) {
      setLoading(false);
      return;
    }

    const q = query(collection(db, 'orders'), where('storeId', '==', user.uid));

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const allOrdersList = [];
      const uniqueUserIds = new Set();

      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        allOrdersList.push({ id: docSnap.id, ...data });
        if (data.userId) uniqueUserIds.add(data.userId);
      });

      const usersData = {};
      await Promise.all(
        Array.from(uniqueUserIds).map(async (uid) => {
          try {
            const uDoc = await getDoc(doc(db, 'users', uid));
            if (uDoc.exists()) usersData[uid] = uDoc.data();
          } catch (e) {
            console.log('Error fetching user:', e);
          }
        })
      );

      const enrichedOrders = allOrdersList.map(order => {
        const uData = usersData[order.userId];
        return {
          ...order,
          customerName: uData?.username || uData?.displayName || `ลูกค้า ${order.userId?.slice(0, 6)}`,
          customerAvatar: uData?.profileImage || defaultUserAvatar,
          // ✅ ดึงเบอร์จาก users collection ก่อนเสมอ เพราะเป็นข้อมูลล่าสุด
          // ถ้าลูกค้าเปลี่ยนเบอร์ในโปรไฟล์ จะสะท้อนที่นี่ทันที
          // ใช้ค่าจาก order เป็น fallback กรณี uData หาไม่เจอ (เช่น ลบบัญชีแล้ว)
          customerPhone: uData?.phoneNumber || uData?.phone || uData?.tel || uData?.mobile || uData?.contactPhone || order.customerPhone || order.phone || order.phoneNumber || null,
          customerAddress: order.customerAddress || uData?.address || 'ไม่ระบุที่อยู่',
          customerAddressTitle: order.customerAddressTitle || uData?.addressTitle || ''
        };
      });

      enrichedOrders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      setAllOrders(enrichedOrders);

      // ─── ตรวจจับออเดอร์ใหม่ และเขียน store_notifications ───
      const currentIds = new Set(allOrdersList.map(o => o.id));
      if (seenOrderIds.current === null) {
        // รอบแรก — จำ id ปัจจุบันทั้งหมดไว้ ไม่ส่ง notification
        seenOrderIds.current = currentIds;
      } else {
        // รอบถัดไป — หา id ที่เพิ่งเข้ามาใหม่
        const newOrders = allOrdersList.filter(
          o => !seenOrderIds.current.has(o.id) && o.status === 'pending'
        );
        for (const newOrder of newOrders) {
          try {
            const notifId = `new_order_${newOrder.id}`;
            await setDoc(doc(db, 'store_notifications', notifId), {
              storeId: user.uid,
              title: 'มีออเดอร์ใหม่เข้ามา! 🛒',
              message: `ออเดอร์ #${newOrder.id.slice(0, 6).toUpperCase()} รายการสินค้า ${(newOrder.items || []).length} รายการ รวม ฿${newOrder.totalPrice || 0}`,
              type: 'new_order',
              orderId: newOrder.id,
              isRead: false,
              createdAt: new Date().toISOString()
            }, { merge: false });
          } catch (e) {
            console.error('Error writing new order notification:', e);
          }
        }
        // อัปเดต seenOrderIds ให้รวม id ใหม่ทั้งหมด
        seenOrderIds.current = currentIds;
      }

      const pendingCount = enrichedOrders.filter(o => o.status === 'pending').length;
      const completedOrders = enrichedOrders.filter(o => o.status === 'completed');
      const totalRevenue = completedOrders.reduce((sum, o) => sum + (Number(o.totalPrice) || 0), 0);

      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);

      const completedTodayCount = completedOrders.filter(o => {
        if (!o.createdAt) return false;
        const orderDate = new Date(o.createdAt);
        return orderDate >= startOfToday;
      }).length;

      const soldCount = completedOrders.reduce((sum, o) => sum + (o.items || []).reduce((s, item) => s + (item.quantity || 1), 0), 0);
      setStats(prev => ({
        ...prev,
        pending: pendingCount,
        total: enrichedOrders.length,
        revenue: totalRevenue,
        completedToday: completedTodayCount,
        completedTotal: completedOrders.length,
        sold: soldCount
      }));

      setLoading(false);
    });

    const qNotif = query(collection(db, 'store_notifications'), where('storeId', '==', user.uid), where('isRead', '==', false));
    const unsubscribeNotif = onSnapshot(qNotif, (snapshot) => { setUnreadCount(snapshot.size); });

    return () => { unsubscribe(); unsubscribeNotif(); };
  }, []);

  useEffect(() => {
    const filtered = allOrders.filter(o => o.status === filter);
    setOrders(filtered);
  }, [filter, allOrders]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadStoreData();
    setTimeout(() => setRefreshing(false), 800);
  };

  const getFormattedOrderId = (orderId, type) => {
    if (!orderId) return 'N/A';
    const shortId = orderId.slice(0, 6).toUpperCase();
    const prefix = type === 'delivery' ? 'D' : 'P';
    return `${prefix}-${shortId}`;
  };

  const handleCancelClick = (orderId) => {
    setCancelOrderId(orderId);
    setCancelReason('');
    setCancelModalVisible(true);
  };

  const submitCancelOrder = async () => {
    if (!cancelReason.trim()) {
      Alert.alert('แจ้งเตือน', 'กรุณาระบุเหตุผลในการยกเลิก');
      return;
    }

    setLoading(true);
    try {
      setCancelModalVisible(false);

      await runTransaction(db, async (transaction) => {
          const orderRef = doc(db, 'orders', cancelOrderId);
          const orderDoc = await transaction.get(orderRef);

          if (!orderDoc.exists()) throw "ไม่พบคำสั่งซื้อนี้ในระบบ";

          const items = orderDoc.data().items || [];
          const orderWeight = orderDoc.data().totalOrderWeight || 0;
          const userId = orderDoc.data().userId;

          const foodDocsToUpdate = [];
          for (let item of items) {
              const foodRef = doc(db, 'food_items', item.foodId);
              const foodDoc = await transaction.get(foodRef);
              if (foodDoc.exists()) {
                  foodDocsToUpdate.push({ ref: foodRef, returnQty: item.quantity });
              }
          }

          let userRef = null;
          let userDoc = null;
          if (userId && orderWeight > 0) {
              userRef = doc(db, 'users', userId);
              userDoc = await transaction.get(userRef);
          }

          for (let fData of foodDocsToUpdate) {
              transaction.update(fData.ref, {
                  quantity: increment(fData.returnQty)
              });
          }

          if (userDoc && userDoc.exists()) {
              transaction.update(userRef, {
                  totalWeightSaved: increment(-orderWeight)
              });
          }

          transaction.update(orderRef, {
              status: 'cancelled',
              cancelReason: cancelReason.trim(),
              cancelledBy: 'store',
              cancelledAt: new Date().toISOString()
          });

          if (userId) {
              const notifRef = doc(collection(db, 'notifications'));
              transaction.set(notifRef, {
                  userId: userId,
                  title: 'ออเดอร์ถูกยกเลิก ❌',
                  message: `ร้านค้ายกเลิกออเดอร์ (เหตุผล: ${cancelReason.trim()})`,
                  type: 'order_cancelled',
                  orderId: cancelOrderId,
                  isRead: false,
                  createdAt: new Date().toISOString()
              });
          }
      });

      Alert.alert('สำเร็จ', 'ยกเลิกออเดอร์ คืนสต็อกสินค้า และแจ้งลูกค้าเรียบร้อยแล้ว');
    } catch (error) {
      console.error("Cancel by Store Error:", error);
      Alert.alert('ผิดพลาด', typeof error === 'string' ? error : 'ไม่สามารถยกเลิกออเดอร์ได้');
      setLoading(false);
    }
  };

  // ✅ ปรับฟังก์ชันให้รับ orderType เพื่อแยกข้อความแจ้งเตือน
  const handleConfirmOrder = async (orderId, userId, orderType) => {
    try {
      await updateDoc(doc(db, 'orders', orderId), { status: 'confirmed' });

      // 🔔 ตรวจสอบประเภทออเดอร์ เพื่อสร้างประโยคที่ถูกต้อง
      let notifMessage = 'ร้านกำลังเตรียมอาหารให้คุณ 🍳';
      if (orderType === 'delivery') {
         notifMessage = 'ร้านกำลังเตรียมอาหาร และจะดำเนินการจัดส่งให้คุณตามที่อยู่ที่ระบุไว้ 🛵';
      } else { // กรณีเป็น pickup
         notifMessage = 'ร้านกำลังเตรียมอาหาร แวะมารับที่หน้าร้านตามเวลาทำการได้เลย 🛍️';
      }

      if (userId) {
        const { addDoc, collection } = require('firebase/firestore');
        await addDoc(collection(db, 'notifications'), {
          userId: userId,
          title: 'ร้านค้ายืนยันออเดอร์แล้ว 🍳',
          message: notifMessage,
          type: 'order_confirmed',
          orderId: orderId,
          isRead: false,
          createdAt: new Date().toISOString()
        });
      }

      Alert.alert('สำเร็จ', 'ยืนยันออเดอร์และส่งแจ้งเตือนแล้ว');
    } catch (error) {
      console.error(error);
      Alert.alert('ผิดพลาด', 'ไม่สามารถยืนยันออเดอร์ได้');
    }
  };

  const handleCompleteOrder = (orderId, userId, totalOrderWeight) => {
      Alert.alert(
        'ลูกค้ารับของแล้ว',
        'ยืนยันว่าลูกค้ามารับอาหารเรียบร้อยแล้วใช่หรือไม่?',
        [
          { text: 'ยกเลิก', style: 'cancel' },
          {
            text: 'ยืนยัน',
            style: 'default',
            onPress: async () => {
              try {
                await updateDoc(doc(db, 'orders', orderId), { status: 'completed' });

                // 🌿 อัปเดต totalFoodSaved และ totalCO2Saved ของร้านค้า
                const user = auth.currentUser;
                if (user && totalOrderWeight > 0) {
                  const CO2_COEFFICIENT = 2.5;
                  const co2Saved = totalOrderWeight * CO2_COEFFICIENT;
                  await updateDoc(doc(db, 'stores', user.uid), {
                    totalFoodSaved: increment(totalOrderWeight),
                    totalCO2Saved: increment(co2Saved),
                  });
                }

                // 🔔 คำพูดน่ารักๆ สำหรับตอนลูกค้าได้รับของเรียบร้อย
                if (userId) {
                  const { addDoc, collection } = require('firebase/firestore');
                  await addDoc(collection(db, 'notifications'), {
                    userId: userId,
                    title: 'รับอาหารสำเร็จ! 🌍',
                    message: 'อาหารมื้ออร่อยของคุณส่งมอบเรียบร้อยแล้ว! ขอบคุณที่ร่วมเป็นส่วนหนึ่งในการลดขยะอาหารและช่วยดูแลโลกของเรา ฝากแวะมารีวิวเพื่อเป็นกำลังใจให้ร้านค้าด้วยนะ 💚',
                    type: 'order_completed',
                    orderId: orderId,
                    isRead: false,
                    createdAt: new Date().toISOString()
                  });
                }

                Alert.alert('สำเร็จ!', 'อัปเดตสถานะเป็น "รับของแล้ว" เรียบร้อย');
              } catch (error) {
                Alert.alert('ผิดพลาด', 'ไม่สามารถอัปเดตสถานะได้');
              }
            }
          }
        ]
      );
    };

  const handlePhonePress = (phone) => {
    if (!phone || phone === 'ไม่ระบุเบอร์โทร') return;
    setSelectedPhone(phone);
    setPhoneModalVisible(true);
  };

  const copyPhone = async () => {
    await Clipboard.setStringAsync(selectedPhone);
    setPhoneModalVisible(false);
    Alert.alert('สำเร็จ', 'คัดลอกเบอร์โทรศัพท์แล้ว');
  };

  const callPhone = () => {
    Linking.openURL(`tel:${selectedPhone}`);
    setPhoneModalVisible(false);
  };

  const openGoogleMaps = (lat, lng, address) => {
    if (lat && lng) {
      const url = Platform.select({ ios: `maps:0,0?q=${lat},${lng}`, android: `geo:0,0?q=${lat},${lng}` });
      Linking.openURL(url).catch(() => Alert.alert('ผิดพลาด', 'ไม่สามารถเปิดแผนที่ได้'));
    } else if (address && address !== 'ไม่ระบุที่อยู่') {
      const url = Platform.select({ ios: `maps:0,0?q=${address}`, android: `geo:0,0?q=${address}` });
      Linking.openURL(url).catch(() => Alert.alert('ผิดพลาด', 'ไม่สามารถเปิดแผนที่ได้'));
    } else {
      Alert.alert('แจ้งเตือน', 'ลูกค้าไม่ได้ระบุพิกัดหรือที่อยู่ไว้');
    }
  };

  const handleDeleteStore = () => {
    Alert.alert(
      'ยกเลิกการเป็นร้านค้า',
      'คุณแน่ใจหรือไม่? ข้อมูลร้านค้าและสินค้าทั้งหมดจะถูกลบอย่างถาวร ไม่สามารถกู้คืนได้',
      [
        { text: 'ไม่ใช่', style: 'cancel' },
        {
          text: 'ยืนยันลบ',
          style: 'destructive',
          onPress: async () => {
            try {
              const user = auth.currentUser;
              if (!user) return;

              const batch = writeBatch(db);

              // ลบ store document
              batch.delete(doc(db, 'stores', user.uid));

              // ลบ approval_requests ที่เกี่ยวข้อง
              const approvalSnap = await getDocs(
                query(collection(db, 'approval_requests'), where('userId', '==', user.uid))
              );
              approvalSnap.forEach(d => batch.delete(d.ref));

              // ลบสินค้าทั้งหมดของร้าน
              const foodSnap = await getDocs(
                query(collection(db, 'food_items'), where('userId', '==', user.uid))
              );
              foodSnap.forEach(d => batch.delete(d.ref));

              // รีเซ็ต currentRole ของ user กลับเป็น customer
              batch.update(doc(db, 'users', user.uid), { currentRole: 'customer' });

              await batch.commit();

              toggleDrawer();
              Alert.alert('สำเร็จ', 'ลบข้อมูลร้านค้าเรียบร้อยแล้ว', [
                { text: 'ตกลง', onPress: () => navigation.replace('Home') }
              ]);
            } catch (error) {
              console.error('Error deleting store:', error);
              Alert.alert('ผิดพลาด', 'ไม่สามารถลบข้อมูลร้านค้าได้ กรุณาลองใหม่อีกครั้ง');
            }
          }
        }
      ]
    );
  };

  const toggleDrawer = () => {
    if (isDrawerOpen) {
      Animated.parallel([
        Animated.timing(slideAnim, { toValue: -width * 0.85, duration: 250, useNativeDriver: true }),
        Animated.timing(fadeAnim, { toValue: 0, duration: 250, useNativeDriver: true })
      ]).start(() => setIsDrawerOpen(false));
    } else {
      setIsDrawerOpen(true);
      Animated.parallel([
        Animated.timing(slideAnim, { toValue: 0, duration: 250, useNativeDriver: true }),
        Animated.timing(fadeAnim, { toValue: 1, duration: 250, useNativeDriver: true })
      ]).start();
    }
  };

  const handleLogout = async () => {
    Alert.alert('ออกจากระบบ', 'คุณต้องการออกจากระบบหรือไม่?', [
      { text: 'ยกเลิก', style: 'cancel' },
      { text: 'ออกจากระบบ', style: 'destructive', onPress: async () => { await auth.signOut(); navigation.replace('SignIn'); } }
    ]);
  };

  const DrawerContent = () => {

    return (
      <ScrollView contentContainerStyle={styles.drawerScrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.drawerContentPadding}>

          <View style={styles.drawerTopHeader}>
            <View style={styles.logoContainer}>
              <View style={styles.logoCircle}><Ionicons name="leaf" size={24} color="#10b981" /></View>
              <View><Text style={styles.appName}>Food Waste</Text><Text style={styles.appSlogan}>ร้านค้า</Text></View>
            </View>
            <TouchableOpacity onPress={toggleDrawer} style={styles.closeButton}><Ionicons name="close" size={24} color="#1f2937" /></TouchableOpacity>
          </View>

          <View style={styles.profileCard}>
            <View style={styles.profileHeader}>
              <Image source={storeData?.storeImage ? { uri: storeData.storeImage } : { uri: defaultAvatar }} style={styles.drawerAvatar} />
              <View style={{ flex: 1 }}>
                <Text style={styles.drawerName}>{username}</Text>
                <Text style={styles.drawerRole}>โหมด: ร้านค้า</Text>
              </View>
            </View>
            <View style={styles.modeContainer}>
              <TouchableOpacity style={styles.modeButtonInactive} onPress={() => { toggleDrawer(); navigation.navigate('Home'); }}>
                <Ionicons name="cart-outline" size={16} color="#6b7280" />
                <Text style={styles.modeTextInactive}>โหมดลูกค้า</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modeButtonActive} activeOpacity={1}>
                <Ionicons name="storefront" size={16} color="#fff" />
                <Text style={styles.modeTextActive}>โหมดร้านค้า</Text>
              </TouchableOpacity>
            </View>
          </View>

          <Text style={styles.sectionTitle}>เมนูหลัก</Text>
          <TouchableOpacity style={styles.drawerMenuItem} onPress={() => { toggleDrawer(); navigation.navigate('MyShop'); }}>
            <View style={[styles.menuIconBox, {backgroundColor: '#d1fae5'}]}><Ionicons name="home-outline" size={20} color="#10b981" /></View>
            <Text style={styles.drawerMenuText}>หน้าหลัก</Text>
            <Ionicons name="chevron-forward" size={18} color="#9ca3af" style={{marginLeft: 'auto'}} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.drawerMenuItem} onPress={() => { toggleDrawer(); navigation.navigate('StoreOrders'); }}>
            <View style={[styles.menuIconBox, {backgroundColor: '#fef3c7'}]}><Ionicons name="receipt-outline" size={20} color="#f59e0b" /></View>
            <Text style={styles.drawerMenuText}>คำสั่งซื้อของร้าน</Text>
            <Ionicons name="chevron-forward" size={18} color="#9ca3af" style={{marginLeft: 'auto'}} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.drawerMenuItem} onPress={() => { toggleDrawer(); navigation.navigate('StoreDashboard'); }}>
                    <View style={[styles.menuIconBox, { backgroundColor: '#eff6ff' }]}><Ionicons name="bar-chart-outline" size={20} color="#3b82f6" /></View>
                    <Text style={styles.drawerMenuText}>แดชบอร์ด</Text>
                    <Ionicons name="chevron-forward" size={18} color="#9ca3af" style={{ marginLeft: 'auto' }} />
                  </TouchableOpacity>
          
           <TouchableOpacity style={styles.drawerMenuItem} onPress={() => { toggleDrawer(); navigation.navigate('StoreNotifications'); }}>
                    <View style={[styles.menuIconBox, { backgroundColor: '#eff6ff' }]}><Ionicons name="notifications-outline" size={20} color="#3b82f6" /></View>
                    <Text style={styles.drawerMenuText}>การแจ้งเตือนร้านค้า</Text>
                    <Ionicons name="chevron-forward" size={18} color="#9ca3af" style={{ marginLeft: 'auto' }} />
                  </TouchableOpacity>

          <Text style={styles.sectionTitle}>บัญชี</Text>
          <TouchableOpacity style={styles.drawerMenuItem} onPress={() => { toggleDrawer(); navigation.navigate('StoreProfile'); }}>
            <View style={[styles.menuIconBox, {backgroundColor: '#f3e8ff'}]}><Ionicons name="person-outline" size={20} color="#a855f7" /></View>
            <Text style={styles.drawerMenuText}>โปรไฟล์</Text>
            <Ionicons name="chevron-forward" size={18} color="#9ca3af" style={{marginLeft: 'auto'}} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.drawerMenuItem} onPress={() => { toggleDrawer(); navigation.navigate('StoreSettings'); }}>
            <View style={[styles.menuIconBox, {backgroundColor: '#f3f4f6'}]}><Ionicons name="settings-outline" size={20} color="#6b7280" /></View>
            <Text style={styles.drawerMenuText}>แก้ไขข้อมูลร้านค้า</Text>
            <Ionicons name="chevron-forward" size={18} color="#9ca3af" style={{marginLeft: 'auto'}} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.drawerMenuItem} onPress={handleDeleteStore}>
            <View style={[styles.menuIconBox, {backgroundColor: '#fee2e2'}]}><Ionicons name="close-circle-outline" size={20} color="#ef4444" /></View>
            <Text style={styles.drawerMenuText}>ยกเลิกการเป็นร้านค้า</Text>
            <Ionicons name="chevron-forward" size={18} color="#9ca3af" style={{marginLeft: 'auto'}} />
          </TouchableOpacity>

          <View style={styles.storeStatusCardSoft}>
            <View style={styles.storeStatusHeaderSoft}>
              <View style={styles.storeIconCircle}><Ionicons name="storefront" size={20} color="#10b981" /></View>
              <View>
                <Text style={styles.storeStatusNameSoft}>{storeData?.storeName || 'ชื่อร้านค้า'}</Text>
                <Text style={styles.storeStatusTextSoft}>สถานะ: {isStoreOpen ? 'เปิดทำการ' : 'ปิดทำการ'}</Text>
              </View>
            </View>
            <View style={styles.storeStatRowSoft}>
              <View style={styles.storeStatBoxSoft}>
                <Text style={styles.storeStatBoxTitleSoft}>สินค้าที่ลงขาย</Text>
                <Text style={styles.storeStatBoxValueSoft}>{stats.posted} รายการ</Text>
              </View>
              <View style={styles.storeStatBoxSoft}>
                <Text style={styles.storeStatBoxTitleSoft}>ขายแล้ว</Text>
                <Text style={styles.storeStatBoxValueSoft}>{stats.sold} ชิ้น</Text>
              </View>
            </View>
          </View>

          <TouchableOpacity style={styles.drawerLogout} onPress={handleLogout}>
            <View style={[styles.menuIconBox, { backgroundColor: '#fee2e2' }]}><Ionicons name="log-out-outline" size={20} color="#ef4444" /></View>
            <Text style={styles.drawerLogoutText}>ออกจากระบบ</Text>
          </TouchableOpacity>

        </View>
      </ScrollView>
    );
  };

  const renderOrderCard = ({ item }) => {
    const formattedId = getFormattedOrderId(item.id, item.orderType);
    const statusTexts = { pending: 'รอดำเนินการ', confirmed: 'จองแล้ว', completed: 'สำเร็จ', cancelled: 'ยกเลิก' };

    return (
      <View style={styles.uiCard}>
        <View style={styles.uiCardHeader}>
          <View style={styles.uiCustomerInfo}>
            <Image source={{ uri: item.customerAvatar }} style={styles.uiAvatar} />
            <View>
              <Text style={styles.uiCustomerName}>{item.customerName}</Text>
              <Text style={styles.uiOrderId}>#{formattedId}</Text>
            </View>
          </View>
          <View style={styles.uiStatusBadge}>
            <Text style={styles.uiStatusText}>{statusTexts[item.status]}</Text>
          </View>
        </View>

        <View style={styles.uiItemsBox}>
          {item.items && item.items.length > 0 ? (
            item.items.map((food, index) => (
              <View key={index} style={styles.uiItemRow}>
                <Text style={styles.uiItemName}>{food.foodName} - x{food.quantity}(ชิ้น)</Text>
                <Text style={styles.uiItemPrice}>฿{food.price * food.quantity}</Text>
              </View>
            ))
          ) : (
            <View style={styles.uiItemRow}>
              <Text style={styles.uiItemName}>{item.foodName || 'รายการอาหาร'}</Text>
              <Text style={styles.uiItemPrice}>฿{item.totalPrice || 0}</Text>
            </View>
          )}

          <View style={styles.uiDivider} />
          <View style={styles.uiTotalRow}>
            <Text style={styles.uiTotalLabel}>ยอดรวม</Text>
            <Text style={styles.uiTotalPrice}>฿{item.totalPrice || 0}</Text>
          </View>
        </View>

        <View style={styles.uiInfoSection}>
          <View style={styles.uiInfoRow}>
            <Ionicons name="time-outline" size={16} color="#4b5563" />
            <Text style={styles.uiInfoText}>รับของ: ภายในวันนี้ ก่อน {item.closingTime || '20:00'} น.</Text>
          </View>

          {item.orderType === 'delivery' ? (
            <TouchableOpacity style={[styles.uiInfoRow, { alignItems: 'flex-start' }]} onPress={() => openGoogleMaps(item.customerLat, item.customerLng, item.customerAddress)}>
              <Ionicons name="location-outline" size={16} color="#4b5563" style={{ marginTop: 2 }} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.uiInfoText, { color: '#4b5563', fontWeight: 'bold' }]}>จัดส่งที่: {item.customerAddressTitle ? item.customerAddressTitle : 'ที่อยู่จัดส่ง'}</Text>
                <Text style={[styles.uiInfoText, { color: '#4b5563', fontSize: 13, marginTop: 4, lineHeight: 20 }]}>{item.customerAddress}</Text>
              </View>
            </TouchableOpacity>
          ) : (
            <View style={styles.uiInfoRow}>
              <Ionicons name="storefront-outline" size={16} color="#4b5563" />
              <Text style={styles.uiInfoText}>🛍️ ลูกค้ามารับที่ร้าน</Text>
            </View>
          )}

          <TouchableOpacity style={styles.uiInfoRow} onPress={() => handlePhonePress(item.customerPhone)}>
            <Ionicons name="call-outline" size={16} color={item.customerPhone ? '#10b981' : '#9ca3af'} />
            <Text style={[styles.uiInfoText, item.customerPhone && { color: '#10b981', fontWeight: '700' }]}>
              {item.customerPhone ? item.customerPhone : 'ไม่ระบุเบอร์โทร'}
            </Text>
            {item.customerPhone && (
              <View style={styles.phoneCallBadge}>
                <Text style={styles.phoneCallBadgeText}>โทร</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.uiActionArea}>
          {item.status === 'pending' && (
            <View style={styles.uiButtonGroup}>
              <TouchableOpacity style={styles.uiBtnCancel} onPress={() => handleCancelClick(item.id)}>
                <Text style={styles.uiBtnTextDark}>ยกเลิกออเดอร์</Text>
              </TouchableOpacity>
              {/* ✅ แนบ item.orderType ส่งเข้าไปด้วย */}
              <TouchableOpacity style={styles.uiBtnConfirm} onPress={() => handleConfirmOrder(item.id, item.userId, item.orderType)}>
                <Text style={styles.uiBtnTextDark}>ยืนยันออเดอร์</Text>
              </TouchableOpacity>
            </View>
          )}
          {item.status === 'confirmed' && (
            <View style={styles.uiButtonGroup}>
              <TouchableOpacity style={styles.uiBtnCancel} onPress={() => handleCancelClick(item.id)}><Text style={styles.uiBtnTextDark}>ยกเลิกออเดอร์</Text></TouchableOpacity>
              <TouchableOpacity style={styles.uiBtnConfirm} onPress={() => handleCompleteOrder(item.id, item.userId, item.totalOrderWeight)}><Text style={styles.uiBtnTextDark}>ลูกค้ารับของแล้ว</Text></TouchableOpacity>
            </View>
          )}

          {item.status === 'cancelled' && (
            <View style={[
                styles.uiCancelReasonBox,
                item.cancelledBy === 'store' && { backgroundColor: '#f9fafb', borderColor: '#e5e7eb' }
            ]}>
               <Text style={[
                   styles.uiCancelReasonLabel,
                   item.cancelledBy === 'store' && { color: '#4b5563' }
               ]}>
                 {item.cancelledBy === 'customer' ? '🧑 ลูกค้ายกเลิก' :
                  item.cancelledBy === 'store' ? '🏪 ร้านค้ายกเลิกเอง' :
                  '⚠️ ถูกยกเลิก'}
               </Text>
               <Text style={[
                   styles.uiCancelReasonText,
                   item.cancelledBy === 'store' && { color: '#6b7280' }
               ]}>
                 เหตุผล: {item.cancelReason || 'ไม่ระบุเหตุผล'}
               </Text>
            </View>
          )}
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#10b981" />
        <Text style={{ marginTop: 16, color: '#6b7280' }}>กำลังโหลดคำสั่งซื้อ...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#f9fafb" />

      <View style={styles.header}>
        <TouchableOpacity onPress={toggleDrawer} style={styles.menuButton}>
          <Ionicons name="menu" size={26} color="#1f2937" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>ออเดอร์</Text>
        <TouchableOpacity onPress={() => navigation.navigate('StoreProfile')}>
          <Image
            source={storeData?.storeImage ? { uri: storeData.storeImage } : { uri: defaultAvatar }}
            style={styles.headerAvatar}
          />
        </TouchableOpacity>
      </View>

      <ScrollView stickyHeaderIndices={[2]} showsVerticalScrollIndicator={false}>
        <View style={styles.statsHeaderContainer}>
            <Ionicons name="stats-chart" size={20} color="#1f2937" />
            <Text style={styles.statsTitleText}>สถิติ</Text>
        </View>

        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{stats.pending}</Text>
            <Text style={styles.statLabel}>รอดำเนินการ</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{stats.total}</Text>
            <Text style={styles.statLabel}>ทั้งหมด</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{stats.revenue} ฿</Text>
            <Text style={styles.statLabel}>รายได้</Text>
          </View>
        </View>

        <View style={styles.filterWrapper}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterContainer}>
            {['pending', 'confirmed', 'completed', 'cancelled'].map(status => (
              <TouchableOpacity
                key={status}
                style={[styles.filterButton, filter === status && styles.filterButtonActive]}
                onPress={() => setFilter(status)}
              >
                <Text style={[styles.filterText, filter === status && styles.filterTextActive]}>
                  {status === 'pending' && 'รอดำเนินการ'}
                  {status === 'confirmed' && 'จองแล้ว'}
                  {status === 'completed' && 'สำเร็จ'}
                  {status === 'cancelled' && 'ยกเลิก'}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        <View style={styles.listContainer}>
            {orders.length > 0 ? (
                orders.map(item => <React.Fragment key={item.id}>{renderOrderCard({item})}</React.Fragment>)
            ) : (
                <View style={styles.emptyState}>
                    <Ionicons name="receipt-outline" size={64} color="#d1d5db" />
                    <Text style={styles.emptyText}>ไม่มีคำสั่งซื้อ</Text>
                </View>
            )}
            <View style={{ height: 100 }} />
        </View>
      </ScrollView>

      <Modal visible={cancelModalVisible} transparent={true} animationType="fade" onRequestClose={() => setCancelModalVisible(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
          <View style={styles.cancelModalBox}>
            <View style={styles.cancelIconCircle}><Ionicons name="warning" size={32} color="#ef4444" /></View>
            <Text style={styles.cancelModalTitle}>ระบุเหตุผลการยกเลิก</Text>
            <Text style={styles.cancelModalSubtitle}>กรุณาระบุเหตุผลให้ลูกค้าทราบ</Text>
            <TextInput style={styles.reasonInput} placeholder="เช่น อาหารหมด..." placeholderTextColor="#9ca3af" multiline numberOfLines={3} value={cancelReason} onChangeText={setCancelReason} />
            <View style={styles.modalButtonGroup}>
              <TouchableOpacity style={styles.modalBtnCancel} onPress={() => setCancelModalVisible(false)}><Text style={styles.modalBtnCancelText}>ปิด</Text></TouchableOpacity>
              <TouchableOpacity style={styles.modalBtnSubmit} onPress={submitCancelOrder}><Text style={styles.modalBtnSubmitText}>ยืนยันยกเลิก</Text></TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={phoneModalVisible} transparent={true} animationType="fade" onRequestClose={() => setPhoneModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.phoneModalBox}>
            <View style={styles.phoneIconCircle}><Ionicons name="call" size={32} color="#10b981" /></View>
            <Text style={styles.phoneModalTitle}>ติดต่อลูกค้า</Text>
            <Text style={styles.phoneModalNumber}>{selectedPhone}</Text>
            <View style={styles.phoneButtonGroup}>
              <TouchableOpacity style={styles.phoneBtnAction} onPress={copyPhone}><Ionicons name="copy-outline" size={20} color="#4b5563" /><Text style={styles.phoneBtnActionText}>คัดลอกเบอร์</Text></TouchableOpacity>
              <TouchableOpacity style={[styles.phoneBtnAction, { backgroundColor: '#10b981' }]} onPress={callPhone}><Ionicons name="call-outline" size={20} color="#fff" /><Text style={[styles.phoneBtnActionText, { color: '#fff' }]}>โทรออก</Text></TouchableOpacity>
            </View>
            <TouchableOpacity style={styles.phoneBtnClose} onPress={() => setPhoneModalVisible(false)}><Text style={styles.phoneBtnCloseText}>ปิด</Text></TouchableOpacity>
          </View>
        </View>
      </Modal>

      <View style={styles.bottomNav}>
        <TouchableOpacity style={styles.navItem} onPress={() => navigation.navigate('MyShop')}>
          <Ionicons name="storefront-outline" size={24} color="#9ca3af" />
          <Text style={styles.navLabel}>ร้านค้าของฉัน</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem}>
          <Ionicons name="list" size={24} color="#1f2937" />
          <Text style={[styles.navLabel, styles.navLabelActive]}>ออเดอร์</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.navItem} onPress={() => navigation.navigate('StoreNotifications')}>
          <View style={{ position: 'relative' }}>
            <Ionicons name="notifications-outline" size={24} color="#9ca3af" />
            {unreadCount > 0 && (
              <View style={styles.notificationBadge}>
                <Text style={styles.notificationBadgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
              </View>
            )}
          </View>
          <Text style={styles.navLabel}>แจ้งเตือน</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.navItem} onPress={() => navigation.navigate('StoreProfile')}>
          <Ionicons name="person-outline" size={24} color="#9ca3af" />
          <Text style={styles.navLabel}>โปรไฟล์</Text>
        </TouchableOpacity>
      </View>

      <Modal visible={isDrawerOpen} transparent animationType="none" onRequestClose={toggleDrawer}>
        <View style={styles.drawerOverlay}>
          <TouchableWithoutFeedback onPress={toggleDrawer}>
            <Animated.View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(0,0,0,0.5)', opacity: fadeAnim }]} />
          </TouchableWithoutFeedback>
          <Animated.View style={[styles.drawerContainer, { transform: [{ translateX: slideAnim }] }]}>
            <DrawerContent />
          </Animated.View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: Platform.OS === 'ios' ? 60 : 50, paddingBottom: 15, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  menuButton: { padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#1f2937', letterSpacing: 1 },
  headerProfileIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#f3f4f6', alignItems: 'center', justifyContent: 'center' },
  headerAvatar: { width: 36, height: 36, borderRadius: 18, borderWidth: 2, borderColor: '#10b981', backgroundColor: '#d1fae5' },
  statsHeaderContainer: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, marginTop: 15, marginBottom: 10, gap: 8 },
  statsTitleText: { fontSize: 16, fontWeight: 'bold', color: '#1f2937' },
  filterWrapper: { backgroundColor: '#f9fafb', paddingVertical: 10, zIndex: 10 },
  filterContainer: { paddingHorizontal: 20, gap: 10, flexDirection: 'row' },
  filterButton: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e5e7eb' },
  filterButtonActive: { borderColor: '#1f2937', backgroundColor: '#1f2937' },
  filterText: { fontSize: 13, color: '#6b7280', fontWeight: '500' },
  filterTextActive: { color: '#fff', fontWeight: 'bold' },
  statsContainer: { flexDirection: 'row', paddingHorizontal: 20, gap: 12, marginBottom: 10 },
  statCard: { flex: 1, backgroundColor: '#fff', paddingVertical: 16, borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: '#f3f4f6', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1 },
  statValue: { fontSize: 18, fontWeight: 'bold', color: '#1f2937' },
  statLabel: { fontSize: 11, color: '#6b7280', marginTop: 4 },
  listContainer: { paddingHorizontal: 20, paddingTop: 10 },
  uiCard: { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2, borderWidth: 1, borderColor: '#f3f4f6' },
  uiCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 15 },
  uiCustomerInfo: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  uiAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#f3f4f6' },
  uiCustomerName: { fontSize: 16, fontWeight: 'bold', color: '#1f2937' },
  uiOrderId: { fontSize: 12, color: '#9ca3af', marginTop: 2 },
  uiStatusBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: '#e5e7eb' },
  uiStatusText: { fontSize: 12, color: '#4b5563', fontWeight: '600' },
  uiItemsBox: { backgroundColor: '#f9fafb', borderRadius: 12, padding: 15, marginBottom: 15, borderWidth: 1, borderColor: '#f3f4f6' },
  uiItemRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  uiItemName: { fontSize: 14, color: '#374151', flex: 1 },
  uiItemPrice: { fontSize: 14, color: '#1f2937', fontWeight: '500' },
  uiDivider: { height: 1, backgroundColor: '#e5e7eb', marginVertical: 10 },
  uiTotalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  uiTotalLabel: { fontSize: 14, color: '#374151', fontWeight: 'bold' },
  uiTotalPrice: { fontSize: 16, color: '#10b981', fontWeight: 'bold' },
  uiInfoSection: { marginBottom: 15, gap: 8 },
  uiInfoRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 2 },
  uiInfoText: { fontSize: 13, color: '#4b5563' },
  uiActionArea: { marginTop: 5 },
  uiButtonGroup: { flexDirection: 'row', gap: 10 },
  uiBtnCancel: { flex: 1, backgroundColor: '#f3f4f6', paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  uiBtnConfirm: { flex: 1, backgroundColor: '#f3f4f6', paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  uiBtnTextDark: { fontSize: 14, fontWeight: '600', color: '#374151' },
  uiCancelReasonBox: { backgroundColor: '#fef2f2', borderRadius: 10, padding: 12, borderWidth: 1, borderColor: '#fecaca', marginTop: 10 },
  uiCancelReasonLabel: { fontSize: 14, fontWeight: 'bold', color: '#ef4444', marginBottom: 4 },
  uiCancelReasonText: { fontSize: 13, color: '#ef4444', lineHeight: 20 },
  emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60 },
  emptyText: { fontSize: 16, fontWeight: 'bold', color: '#9ca3af', marginTop: 15 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  cancelModalBox: { width: '90%', backgroundColor: '#fff', borderRadius: 24, padding: 24, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.15, shadowRadius: 20, elevation: 10 },
  cancelIconCircle: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#fef2f2', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  cancelModalTitle: { fontSize: 20, fontWeight: 'bold', color: '#1f2937', marginBottom: 8, textAlign: 'center' },
  cancelModalSubtitle: { fontSize: 14, color: '#6b7280', marginBottom: 20, textAlign: 'center' },
  reasonInput: { width: '100%', backgroundColor: '#f9fafb', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12, padding: 16, fontSize: 14, color: '#1f2937', height: 100, textAlignVertical: 'top', marginBottom: 24 },
  modalButtonGroup: { flexDirection: 'row', gap: 12, width: '100%' },
  modalBtnCancel: { flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: '#f3f4f6', alignItems: 'center' },
  modalBtnCancelText: { fontSize: 15, fontWeight: 'bold', color: '#4b5563' },
  modalBtnSubmit: { flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: '#ef4444', alignItems: 'center' },
  modalBtnSubmitText: { fontSize: 15, fontWeight: 'bold', color: '#fff' },
  phoneModalBox: { width: '85%', backgroundColor: '#fff', borderRadius: 24, padding: 24, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.15, shadowRadius: 20, elevation: 10 },
  phoneIconCircle: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#f0fdf4', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  phoneModalTitle: { fontSize: 18, fontWeight: 'bold', color: '#1f2937', marginBottom: 8 },
  phoneModalNumber: { fontSize: 24, fontWeight: 'bold', color: '#10b981', marginBottom: 24, letterSpacing: 1 },
  phoneButtonGroup: { flexDirection: 'row', gap: 12, width: '100%', marginBottom: 16 },
  phoneBtnAction: { flex: 1, paddingVertical: 12, borderRadius: 12, backgroundColor: '#f3f4f6', alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8 },
  phoneBtnActionText: { fontSize: 14, fontWeight: 'bold', color: '#4b5563' },
  phoneCallBadge: {
    marginLeft: 'auto',
    backgroundColor: '#10b981',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  phoneCallBadgeText: { fontSize: 11, fontWeight: '700', color: '#fff' },
  phoneBtnClose: { width: '100%', paddingVertical: 12, borderRadius: 12, alignItems: 'center' },
  phoneBtnCloseText: { fontSize: 15, fontWeight: 'bold', color: '#9ca3af' },
  bottomNav: { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#f3f4f6', paddingVertical: 12, paddingHorizontal: 20 },
  navItem: { flex: 1, alignItems: 'center', gap: 4 },
  navItemActive: { borderBottomWidth: 2, borderBottomColor: '#1f2937' },
  navLabel: { fontSize: 11, color: '#9ca3af' },
  navLabelActive: { color: '#1f2937', fontWeight: '600' },
  drawerOverlay: { flex: 1, flexDirection: 'row' },
  drawerContainer: { position: 'absolute', left: 0, top: 0, bottom: 0, width: width * 0.85, backgroundColor: '#fff', shadowColor: "#000", shadowOffset: { width: 2, height: 0 }, shadowOpacity: 0.25, shadowRadius: 3.84, elevation: 5 },
  drawerScrollContent: { flexGrow: 1, paddingTop: Platform.OS === 'ios' ? 50 : 30, paddingBottom: 40 },
  drawerContentPadding: { paddingHorizontal: 20 },
  drawerTopHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  logoContainer: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logoCircle: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#f0fdf4', alignItems: 'center', justifyContent: 'center' },
  appName: { fontSize: 16, fontWeight: 'bold', color: '#1f2937' },
  appSlogan: { fontSize: 12, color: '#6b7280' },
  closeButton: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#f3f4f6', alignItems: 'center', justifyContent: 'center' },
  profileCard: { backgroundColor: '#fff', borderRadius: 16, padding: 15, borderWidth: 1, borderColor: '#f3f4f6', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 2, marginBottom: 20 },
  profileHeader: { flexDirection: 'row', alignItems: 'center', gap: 15, marginBottom: 15 },
  drawerAvatar: { width: 50, height: 50, borderRadius: 25, borderWidth: 1, borderColor: '#10b981', backgroundColor: '#f3f4f6' },
  drawerName: { fontSize: 16, fontWeight: 'bold', color: '#1f2937' },
  drawerRole: { fontSize: 13, color: '#6b7280' },
  modeContainer: { flexDirection: 'row', gap: 10 },
  modeButtonActive: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 8, backgroundColor: '#10b981', borderRadius: 8 },
  modeButtonInactive: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 8, backgroundColor: '#f3f4f6', borderRadius: 8 },
  modeTextActive: { fontSize: 11, fontWeight: 'bold', color: '#fff' },
  modeTextInactive: { fontSize: 11, color: '#6b7280' },
  sectionTitle: { fontSize: 14, color: '#9ca3af', marginBottom: 10, marginLeft: 5, marginTop: 5, fontWeight: 'bold' },
  drawerMenuItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', paddingVertical: 10, paddingHorizontal: 5, marginBottom: 5 },
  menuIconBox: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#f9fafb', alignItems: 'center', justifyContent: 'center', marginRight: 15 },
  drawerMenuText: { fontSize: 15, color: '#1f2937', fontWeight: '500' },
  storeStatusCardSoft: { backgroundColor: '#f9fafb', borderRadius: 16, padding: 16, marginTop: 15, marginBottom: 20, borderWidth: 1, borderColor: '#f3f4f6' },
  storeStatusHeaderSoft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  storeIconCircle: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#d1fae5', alignItems: 'center', justifyContent: 'center' },
  storeStatusNameSoft: { fontSize: 15, fontWeight: 'bold', color: '#1f2937' },
  storeStatusTextSoft: { fontSize: 12, color: '#10b981', marginTop: 2, fontWeight: '600' },
  storeStatRowSoft: { flexDirection: 'row', gap: 10, marginTop: 15 },
  storeStatBoxSoft: { flex: 1, backgroundColor: '#fff', paddingVertical: 12, borderRadius: 12, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1 },
  storeStatBoxTitleSoft: { fontSize: 11, color: '#6b7280', marginBottom: 4 },
  storeStatBoxValueSoft: { fontSize: 14, color: '#1f2937', fontWeight: 'bold' },
  drawerLogout: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 5, marginTop: 10, marginBottom: 20 },
  drawerLogoutText: { fontSize: 15, color: '#ef4444', fontWeight: 'bold' },
  notificationBadge: { position: 'absolute', top: -4, right: -6, backgroundColor: '#ef4444', borderRadius: 10, minWidth: 18, height: 18, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#fff', paddingHorizontal: 4, zIndex: 5 },
  notificationBadgeText: { color: '#fff', fontSize: 10, fontWeight: 'bold' }
});