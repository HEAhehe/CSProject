import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, StatusBar, Image,
  RefreshControl, ActivityIndicator, Alert, Animated, Dimensions,
  Modal, TouchableWithoutFeedback, Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { auth, db } from '../../firebase.config';
import { collection, getDocs, query, where, deleteDoc, doc, updateDoc, getDoc, writeBatch, onSnapshot } from 'firebase/firestore';
import { useFocusEffect } from '@react-navigation/native';

const { width } = Dimensions.get('window');

export default function MyShopScreen({ navigation }) {
  const [storeData, setStoreData] = useState(null);
  const [activeListings, setActiveListings] = useState([]);
  const [soldListings, setSoldListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState({ posted: 0, sold: 0, revenue: 0 });
  const [statusChecked, setStatusChecked] = useState(false);
  const [isStoreOpen, setIsStoreOpen] = useState(false);
  const [username, setUsername] = useState('');

  const [unreadNotifCount, setUnreadNotifCount] = useState(0);

  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const slideAnim = useRef(new Animated.Value(-width * 0.85)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const defaultAvatar = Image.resolveAssetSource(require('../../assets/icon.png')).uri;

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;
    const q = query(
      collection(db, 'store_notifications'),
      where('storeId', '==', user.uid),
      where('isRead', '==', false)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setUnreadNotifCount(snapshot.size);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const loadUsername = async () => {
      try {
        const user = auth.currentUser;
        if (!user) return;
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          const data = userDoc.data();
          setUsername(data.username || data.displayName || user.displayName || 'Username');
        } else {
          setUsername(user.displayName || 'Username');
        }
      } catch (e) {
        setUsername(auth.currentUser?.displayName || 'Username');
      }
    };
    loadUsername();
  }, []);

  useFocusEffect(
    useCallback(() => {
      setStatusChecked(false);
      setStoreData(null);
      setLoading(true);
      checkAuthAndLoadData();
    }, [])
  );

  const checkAuthAndLoadData = async () => {
    try {
      const user = auth.currentUser;
      if (!user) {
        Alert.alert('ต้องเข้าสู่ระบบ', 'กรุณาเข้าสู่ระบบเพื่อดำเนินการต่อ', [{ text: 'ตกลง', onPress: () => navigation.replace('SignIn') }]);
        return;
      }
      try {
        await user.reload();
        await user.getIdToken(true);
      } catch (tokenError) {
        if (tokenError.code === 'auth/invalid-credential' || tokenError.code === 'auth/user-token-expired') {
          await auth.signOut();
          Alert.alert('เซสชันหมดอายุ', 'กรุณาเข้าสู่ระบบใหม่อีกครั้ง', [{ text: 'ตกลง', onPress: () => navigation.replace('SignIn') }]);
          return;
        }
      }
      await loadStoreData();
      await loadListings();
    } catch (error) {
      setLoading(false);
    }
  };

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

    if (closeMinutes < openMinutes) {
      return currentMinutes >= openMinutes || currentMinutes < closeMinutes;
    }
    return currentMinutes >= openMinutes && currentMinutes < closeMinutes;
  };

  const loadStoreData = async () => {
    try {
      const user = auth.currentUser;
      if (!user) return;

      const storeDocRef = doc(db, 'stores', user.uid);
      const storeDoc = await getDoc(storeDocRef);

      if (storeDoc.exists()) {
        const storeInfo = storeDoc.data();
        if (storeInfo.status === 'approved') {
          setStoreData(storeInfo);
          setIsStoreOpen(checkStoreOpenStatus(storeInfo.businessHours));
          setStatusChecked(true);
        } else if (storeInfo.status === 'pending') {
          if (!statusChecked) {
            setStatusChecked(true);
            Alert.alert('รอการอนุมัติ', 'ร้านค้าของคุณอยู่ระหว่างการตรวจสอบ กรุณารอการอนุมัติ', [{ text: 'ตกลง', onPress: () => navigation.goBack() }]);
          }
        } else if (storeInfo.status === 'rejected') {
          if (!statusChecked) {
            setStatusChecked(true);
            Alert.alert('ถูกปฏิเสธ', storeInfo.rejectReason || 'ร้านค้าของคุณไม่ได้รับการอนุมัติ', [{ text: 'ตกลง', onPress: () => navigation.goBack() }]);
          }
        }
      } else {
        const approvalQuery = query(collection(db, 'approval_requests'), where('userId', '==', user.uid), where('type', '==', 'store_registration'));
        const approvalSnapshot = await getDocs(approvalQuery);

        if (!approvalSnapshot.empty) {
          if (!statusChecked) {
            setStatusChecked(true);
            Alert.alert('รอการอนุมัติ', 'ร้านค้าของคุณอยู่ระหว่างการตรวจสอบ กรุณารอการอนุมัติ', [{ text: 'ตกลง', onPress: () => navigation.goBack() }]);
          }
        } else {
          if (!statusChecked) {
            setStatusChecked(true);
            Alert.alert('ยังไม่มีร้านค้า', 'คุณยังไม่ได้สมัครเป็นร้านค้า ต้องการสมัครหรือไม่?', [
              { text: 'ยกเลิก', onPress: () => navigation.goBack(), style: 'cancel' },
              { text: 'สมัคร', onPress: () => navigation.navigate('RegisterStoreStep1') }
            ]);
          }
        }
      }
    } catch (error) {
      Alert.alert('ข้อผิดพลาด', 'ไม่สามารถโหลดข้อมูลร้านค้าได้');
    }
  };

  const loadListings = async () => {
    try {
      const user = auth.currentUser;
      if (!user) return;

      const q = query(collection(db, 'food_items'), where('userId', '==', user.uid));
      const snapshot = await getDocs(q);
      const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      const active = items.filter(item => item.quantity > 0);
      setActiveListings(active);

      const ordersQuery = query(collection(db, 'orders'), where('storeId', '==', user.uid), where('status', '==', 'completed'));
      const ordersSnapshot = await getDocs(ordersQuery);
      const completedOrders = ordersSnapshot.docs.map(doc => doc.data());

      const totalSoldCount = completedOrders.reduce((sum, order) => sum + (order.items || []).reduce((s, item) => s + (item.quantity || 1), 0), 0);
      const totalRevenue = completedOrders.reduce((sum, order) => sum + (Number(order.totalPrice) || 0), 0);

      setStats({ posted: active.length, sold: totalSoldCount, revenue: totalRevenue });
    } catch (error) {
      console.log('Error loading listings', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleDeleteListing = async (itemId) => {
    Alert.alert('ลบรายการ', 'คุณต้องการลบรายการนี้ใช่หรือไม่?', [
      { text: 'ยกเลิก', style: 'cancel' },
      { text: 'ลบ', style: 'destructive', onPress: async () => { await deleteDoc(doc(db, 'food_items', itemId)); loadListings(); } }
    ]);
  };

  const formatExpiryDate = (dateString) => {
    if (!dateString) return 'ไม่ระบุ';
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return dateString;
      return `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getFullYear()} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')} น.`;
    } catch (error) { return dateString; }
  };

  const renderListingCard = (item) => {
    const originalPrice = Number(item.originalPrice) || 0;
    const discountPrice = Number(item.discountPrice) || Number(item.price) || 0;
    const discountPercent = originalPrice > 0 ? Math.round(((originalPrice - discountPrice) / originalPrice) * 100) : 0;
    const hasImpact = item.foodWasteSaved > 0 || item.co2Saved > 0;

    return (
      <View key={item.id} style={styles.listingCard}>

        {/* รูปสินค้า */}
        <View style={styles.imageWrap}>
          {item.imageUrl ? (
            <Image source={{ uri: item.imageUrl }} style={styles.cardImage} />
          ) : (
            <View style={styles.noImage}><Ionicons name="image-outline" size={36} color="#d1d5db" /></View>
          )}
          {/* Overlay gradient ด้านล่างรูป */}
          {item.imageUrl && <View style={styles.imageOverlay} />}

          {discountPercent > 0 && (
            <View style={styles.discountTag}>
              <Text style={styles.discountTagText}>-{discountPercent}%</Text>
            </View>
          )}

          {/* Eco impact bar ซ้อนบนรูป ด้านล่าง — แสดงเฉพาะที่มีข้อมูล */}
          {hasImpact && (
            <View style={styles.ecoOverlayBar}>
              {item.foodWasteSaved > 0 && (
                <View style={styles.ecoOverlayItem}>
                  <Ionicons name="leaf" size={12} color="#fff" />
                  <Text style={styles.ecoOverlayText}>
                    {Number(item.foodWasteSaved).toFixed(1)} kg
                  </Text>
                </View>
              )}
              {item.foodWasteSaved > 0 && item.co2Saved > 0 && (
                <View style={styles.ecoOverlayDivider} />
              )}
              {item.co2Saved > 0 && (
                <View style={styles.ecoOverlayItem}>
                  <Ionicons name="cloud-done" size={12} color="#fff" />
                  <Text style={styles.ecoOverlayText}>
                    CO2 -{Number(item.co2Saved).toFixed(1)} kg
                  </Text>
                </View>
              )}
            </View>
          )}
        </View>

        {/* รายละเอียด */}
        <View style={styles.cardDetails}>
          <Text style={styles.cardTitle} numberOfLines={1}>{item.name}</Text>

          <View style={styles.priceContainer}>
            <Text style={styles.newPrice}>{discountPrice} ฿</Text>
            {originalPrice > 0 && <Text style={styles.oldPrice}>{originalPrice} ฿</Text>}
          </View>

          <View style={styles.tagsContainer}>
            <View style={styles.tag}>
              <Ionicons name="cube-outline" size={12} color="#6b7280" />
              <Text style={styles.tagText}>{item.quantity} {item.unit}</Text>
            </View>
            {item.expiryDate && (
              <View style={styles.tag}>
                <Ionicons name="time-outline" size={12} color="#6b7280" />
                <Text style={styles.tagText}>{formatExpiryDate(item.expiryDate)?.split(' ')[0]}</Text>
              </View>
            )}
          </View>

          {/* Impact detail row ใต้ tags */}
          {hasImpact && (
            <View style={styles.impactDetailRow}>
              {item.foodWasteSaved > 0 && (
                <View style={styles.impactDetailChip}>
                  <View style={styles.impactDetailIconWrap}>
                    <Ionicons name="leaf" size={13} color="#10b981" />
                  </View>
                  <View>
                    <Text style={styles.impactDetailVal}>{Number(item.foodWasteSaved).toFixed(1)} kg</Text>
                    <Text style={styles.impactDetailLbl}>ลดขยะอาหาร</Text>
                  </View>
                </View>
              )}
              {item.co2Saved > 0 && (
                <View style={[styles.impactDetailChip, styles.impactDetailChipBlue]}>
                  <View style={[styles.impactDetailIconWrap, styles.impactDetailIconBlue]}>
                    <Ionicons name="cloud-done" size={13} color="#3b82f6" />
                  </View>
                  <View>
                    <Text style={[styles.impactDetailVal, { color: '#3b82f6' }]}>{Number(item.co2Saved).toFixed(1)} kg</Text>
                    <Text style={styles.impactDetailLbl}>ลด CO2</Text>
                  </View>
                </View>
              )}
            </View>
          )}
        </View>

        {/* ปุ่มแก้ไข / ลบ */}
        <View style={styles.actionContainer}>
          <TouchableOpacity style={[styles.actionBtn, styles.editBtn]} onPress={() => navigation.navigate('CreateListing', { editItem: item })}>
            <Ionicons name="pencil-outline" size={15} color="#4b5563" />
            <Text style={styles.editBtnText}>แก้ไข</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionBtn, styles.deleteBtn]} onPress={() => handleDeleteListing(item.id)}>
            <Ionicons name="trash-outline" size={15} color="#ef4444" />
            <Text style={styles.deleteBtnText}>ลบ</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const handleRefresh = () => {
    setRefreshing(true);
    setStatusChecked(false);
    setStoreData(null);
    checkAuthAndLoadData();
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
              batch.delete(doc(db, 'stores', user.uid));
              const approvalSnap = await getDocs(query(collection(db, 'approval_requests'), where('userId', '==', user.uid)));
              approvalSnap.forEach(d => batch.delete(d.ref));
              const foodSnap = await getDocs(query(collection(db, 'food_items'), where('userId', '==', user.uid)));
              foodSnap.forEach(d => batch.delete(d.ref));
              batch.update(doc(db, 'users', user.uid), { currentRole: 'customer' });
              await batch.commit();
              toggleDrawer();
              Alert.alert('สำเร็จ', 'ลบข้อมูลร้านค้าเรียบร้อยแล้ว', [{ text: 'ตกลง', onPress: () => navigation.replace('Home') }]);
            } catch (error) {
              Alert.alert('ผิดพลาด', 'ไม่สามารถลบข้อมูลร้านค้าได้ กรุณาลองใหม่อีกครั้ง');
            }
          }
        }
      ]
    );
  };

  const handleLogout = async () => {
    Alert.alert('ออกจากระบบ', 'คุณต้องการออกจากระบบหรือไม่?', [
      { text: 'ยกเลิก', style: 'cancel' },
      { text: 'ออกจากระบบ', style: 'destructive', onPress: async () => { await auth.signOut(); navigation.replace('SignIn'); } }
    ]);
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

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />

      {/* Header - เสริมเงาด้านล่าง */}
      <View style={styles.header}>
        <TouchableOpacity onPress={toggleDrawer} style={styles.iconCircle}>
          <Ionicons name="menu-outline" size={24} color="#1f2937" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>ร้านค้าของฉัน</Text>
        <TouchableOpacity onPress={() => navigation.navigate('StoreProfile')}>
          <Image source={storeData?.storeImage ? { uri: storeData.storeImage } : { uri: defaultAvatar }} style={styles.avatar} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={{ paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#10b981" />}
      >

        {/* ชื่อร้านค้าและสถานะ */}
        <View style={styles.storeBanner}>
          <Text style={styles.greeting}>สวัสดี, 👋</Text>
          <View style={styles.storeNameRow}>
            <Text style={styles.storeName}>{storeData?.storeName || 'ร้านค้าของคุณ'}</Text>
            <View style={[styles.statusBadge, isStoreOpen ? styles.statusOpen : styles.statusClosed]}>
              <View style={[styles.statusDot, { backgroundColor: isStoreOpen ? '#10b981' : '#ef4444' }]} />
              <Text style={[styles.statusText, { color: isStoreOpen ? '#065f46' : '#991b1b' }]}>{isStoreOpen ? 'เปิด' : 'ปิด'}</Text>
            </View>
          </View>
        </View>

        {/* สถิติแบบการ์ด - เสริมเงาให้มีมิติ */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Ionicons name="albums-outline" size={20} color="#10b981" style={styles.statIcon} />
            <Text style={styles.statValue}>{stats.posted}</Text>
            <Text style={styles.statLabel}>โพสต์</Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="bag-check-outline" size={20} color="#10b981" style={styles.statIcon} />
            <Text style={styles.statValue}>{stats.sold}</Text>
            <Text style={styles.statLabel}>ขายแล้ว</Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="cash-outline" size={20} color="#10b981" style={styles.statIcon} />
            <Text style={styles.statValue}>{stats.revenue} ฿</Text>
            <Text style={styles.statLabel}>รายได้</Text>
          </View>
        </View>

        {/* 🌿 Eco Impact */}
        <View style={styles.ecoCard}>
          <View style={styles.ecoRow}>
            <View style={styles.ecoItem}>
              <Ionicons name="leaf" size={15} color="#10b981" />
              <Text style={styles.ecoNum}>
                {storeData?.totalFoodSaved ? Number(storeData.totalFoodSaved).toFixed(1) : '0.0'}{' '}
                <Text style={styles.ecoUnit}>kg</Text>
              </Text>
              <Text style={styles.ecoLabel}>ลดขยะอาหาร</Text>
            </View>
            <View style={styles.ecoSep} />
            <View style={styles.ecoItem}>
              <Ionicons name="cloud-done" size={15} color="#6366f1" />
              <Text style={[styles.ecoNum, { color: '#6366f1' }]}>
                {storeData?.totalCO2Saved ? Number(storeData.totalCO2Saved).toFixed(1) : '0.0'}{' '}
                <Text style={styles.ecoUnit}>kg</Text>
              </Text>
              <Text style={styles.ecoLabel}>ลด CO₂ สะสม</Text>
            </View>
          </View>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>สินค้าที่ลงขาย</Text>
        </View>

        {/* รายการสินค้า - เสริมเงาให้เหมือนหน้าออเดอร์ */}
        <View style={styles.listContainer}>
            {loading ? (
              <ActivityIndicator size="small" color="#10b981" style={{ marginTop: 40 }} />
            ) : activeListings.length > 0 ? (
              activeListings.map(renderListingCard)
            ) : (
              <View style={styles.emptyState}>
                <Ionicons name="cube-outline" size={48} color="#d1d5db" />
                <Text style={styles.emptyStateText}>ยังไม่มีสินค้าในร้าน</Text>
                <TouchableOpacity style={styles.addFirstBtn} onPress={() => navigation.navigate('CreateListing')}>
                  <Text style={styles.addFirstBtnText}>+ ลงขายสินค้าชิ้นแรก</Text>
                </TouchableOpacity>
              </View>
            )}
        </View>

      </ScrollView>

      {/* Floating Action Button - ปรับเงาให้กลมกลืน */}
      {storeData?.status === 'approved' && (
        <TouchableOpacity style={styles.fab} onPress={() => navigation.navigate('CreateListing')}>
          <Ionicons name="add" size={30} color="#fff" />
        </TouchableOpacity>
      )}

      {/* Bottom Nav - เสริมเงาด้านบน */}
      <View style={styles.bottomNav}>
        <TouchableOpacity style={styles.navItem}>
          <Ionicons name="storefront" size={24} color="#1f2937" />
          <Text style={styles.navLabelActive}>ร้านค้า</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={() => navigation.navigate('StoreOrders')}>
          <Ionicons name="receipt-outline" size={24} color="#9ca3af" />
          <Text style={styles.navLabel}>ออเดอร์</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={() => navigation.navigate('StoreNotifications')}>
          <View style={{ position: 'relative' }}>
            <Ionicons name="notifications-outline" size={24} color="#9ca3af" />
            {unreadNotifCount > 0 && (
              <View style={styles.notifBadge}>
                <Text style={styles.notifBadgeText}>{unreadNotifCount > 99 ? '99+' : unreadNotifCount}</Text>
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

      {/* Drawer */}
      {isDrawerOpen && (
        <Modal transparent visible={isDrawerOpen} animationType="none">
          <View style={styles.drawerOverlay}>
            <TouchableWithoutFeedback onPress={toggleDrawer}>
              <Animated.View style={[styles.drawerBackdrop, { opacity: fadeAnim }]} />
            </TouchableWithoutFeedback>
            <Animated.View style={[styles.drawerContainer, { transform: [{ translateX: slideAnim }] }]}>
              <DrawerContent />
            </Animated.View>
          </View>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fafafa' }, // พื้นหลังเทาอ่อนมากๆ เพื่อให้การ์ดขาวเด่น
  content: { flex: 1 },

  // Header 🟢 เสริมเงา
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 15, paddingTop: Platform.OS === 'ios' ? 60 : 50, paddingBottom: 15,
    backgroundColor: '#ffffff',
    // Shadow สำหรับมิติ
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
    elevation: 2,
    zIndex: 10,
  },
  iconCircle: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f9fafb' },
  headerTitle: { fontSize: 16, fontWeight: '700', color: '#1f2937' },
  avatar: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#f3f4f6' },

  // Store Banner
  storeBanner: { padding: 20 },
  greeting: { fontSize: 13, color: '#6b7280' },
  storeNameRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
  storeName: { fontSize: 22, fontWeight: 'bold', color: '#1f2937' },
  statusBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  statusOpen: { backgroundColor: '#dcfce7' },
  statusClosed: { backgroundColor: '#fee2e2' },
  statusDot: { width: 6, height: 6, borderRadius: 3, marginRight: 5 },
  statusText: { fontSize: 12, fontWeight: '700' },

  // Stats - 🟡 เสริมเงาให้มิติ
  statsRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 15, marginBottom: 20 },
  statCard: {
    flex: 1, backgroundColor: '#ffffff', padding: 15, borderRadius: 12,
    borderWidth: 1, borderColor: '#f3f4f6',
    alignItems: 'center',
    // Shadow ให้การ์ดลอยขึ้น
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
  },
  statIcon: { marginBottom: 8 },
  statValue: { fontSize: 18, fontWeight: '700', color: '#1f2937' },
  statLabel: { fontSize: 11, color: '#9ca3af', marginTop: 2 },

  // Eco Impact — minimal
  ecoCard: {
    marginHorizontal: 15,
    marginBottom: 20,
    borderRadius: 14,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  ecoRow: {
    flexDirection: 'row',
    paddingVertical: 16,
    paddingHorizontal: 8,
  },
  ecoItem: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  ecoSep: {
    width: 1,
    backgroundColor: '#f3f4f6',
    marginVertical: 4,
  },
  ecoNum: {
    fontSize: 22,
    fontWeight: '700',
    color: '#10b981',
    letterSpacing: -0.5,
  },
  ecoUnit: {
    fontSize: 13,
    fontWeight: '500',
  },
  ecoLabel: {
    fontSize: 11,
    color: '#9ca3af',
    fontWeight: '400',
  },

  sectionHeader: { paddingHorizontal: 20, marginBottom: 15 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#1f2937' },

  // รายการสินค้า - 🔴 ปรับโครงสร้างและเสริมเงาให้เหมือนหน้าออเดอร์
  listContainer: { paddingHorizontal: 15 },
  listingCard: {
    backgroundColor: '#ffffff', borderRadius: 12, marginBottom: 15,
    borderWidth: 1, borderColor: '#f3f4f6',
    overflow: 'hidden',
    // Shadow เหมือนหน้าออเดอร์
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 4,
  },
  imageWrap: { height: 150, backgroundColor: '#f3f4f6', position: 'relative', overflow: 'hidden' },
  cardImage: { width: '100%', height: '100%' },
  imageOverlay: {
    position: 'absolute', bottom: 0, left: 0, right: 0, height: 60,
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  noImage: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f9fafb' },
  discountTag: { position: 'absolute', top: 10, right: 10, backgroundColor: '#ef4444', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  discountTagText: { fontSize: 11, fontWeight: '800', color: '#fff', letterSpacing: 0.5 },

  // Eco overlay bar on image
  ecoOverlayBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 7, paddingHorizontal: 12, gap: 10,
    backgroundColor: 'rgba(16, 185, 129, 0.82)',
  },
  ecoOverlayItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  ecoOverlayText: { fontSize: 12, fontWeight: '700', color: '#fff', letterSpacing: 0.2 },
  ecoOverlayDivider: { width: 1, height: 14, backgroundColor: 'rgba(255,255,255,0.4)' },

  // Impact detail chips inside card
  impactDetailRow: {
    flexDirection: 'row', gap: 8, marginTop: 10,
  },
  impactDetailChip: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#f0fdf4', borderRadius: 10,
    paddingVertical: 8, paddingHorizontal: 10,
    borderWidth: 1, borderColor: '#bbf7d0',
  },
  impactDetailChipBlue: {
    backgroundColor: '#eff6ff', borderColor: '#bfdbfe',
  },
  impactDetailIconWrap: {
    width: 28, height: 28, borderRadius: 8,
    backgroundColor: '#d1fae5',
    alignItems: 'center', justifyContent: 'center',
  },
  impactDetailIconBlue: {
    backgroundColor: '#dbeafe',
  },
  impactDetailVal: {
    fontSize: 13, fontWeight: '800', color: '#059669', letterSpacing: -0.3,
  },
  impactDetailLbl: {
    fontSize: 10, color: '#6b7280', fontWeight: '500', marginTop: 1,
  },

  cardDetails: { padding: 15, paddingBottom: 10 },
  cardTitle: { fontSize: 15, fontWeight: '600', color: '#1f2937', marginBottom: 4 },
  priceContainer: { flexDirection: 'row', alignItems: 'flex-end', marginBottom: 10 },
  newPrice: { fontSize: 18, fontWeight: 'bold', color: '#10b981', marginRight: 8 },
  oldPrice: { fontSize: 12, color: '#9ca3af', textDecorationLine: 'line-through', marginBottom: 2 },

  tagsContainer: { flexDirection: 'row', gap: 8 },
  tag: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#f9fafb', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, borderWidth: 1, borderColor: '#f3f4f6' },
  tagText: { fontSize: 11, color: '#6b7280', fontWeight: '500' },

  // ส่วนปุ่มจัดการแบบใหม่
  actionContainer: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: '#f3f4f6', marginTop: 10 },
  actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, gap: 5 },
  editBtn: { borderRightWidth: 1, borderRightColor: '#f3f4f6' },
  deleteBtn: { },
  editBtnText: { fontSize: 13, color: '#4b5563', fontWeight: '600' },
  deleteBtnText: { fontSize: 13, color: '#ef4444', fontWeight: '600' },

  emptyState: { alignItems: 'center', marginTop: 40 },
  emptyStateText: { fontSize: 14, color: '#9ca3af', marginTop: 10 },
  addFirstBtn: { marginTop: 15, backgroundColor: '#10b981', paddingHorizontal: 15, paddingVertical: 10, borderRadius: 8 },
  addFirstBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },

  // FAB - 🟢 ปรับเงาให้กลมกลืน
  fab: {
    position: 'absolute', bottom: 90, right: 20,
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: '#10b981', alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', // ปรับเป็นสีดำเพื่อให้เงาดูจริง
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 6,
  },

  // Bottom Nav - 🟡 เสริมเงาด้านบน
  bottomNav: {
    flexDirection: 'row', backgroundColor: '#fff', paddingVertical: 12,
    position: 'absolute', bottom: 0, width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 }, // เงาชี้ขึ้นบน
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 8,
  },
  navItem: { flex: 1, alignItems: 'center' },
  navLabel: { fontSize: 10, color: '#9ca3af', marginTop: 4 },
  navLabelActive: { fontSize: 10, color: '#1f2937', fontWeight: 'bold', marginTop: 4 },
  notifBadge: { position: 'absolute', top: -4, right: -6, backgroundColor: '#ef4444', borderRadius: 10, minWidth: 18, height: 18, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#fff', paddingHorizontal: 4, zIndex: 5 },
  notifBadgeText: { color: '#fff', fontSize: 10, fontWeight: 'bold' },

  // Drawer
  drawerOverlay: { flex: 1, flexDirection: 'row' },
  drawerBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
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
});