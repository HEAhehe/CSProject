import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Image,
  RefreshControl,
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  Modal,
  TouchableWithoutFeedback,
  Platform
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
  const [activeTab, setActiveTab] = useState('active');
  const [stats, setStats] = useState({ posted: 0, sold: 0, revenue: 0 });
  const [statusChecked, setStatusChecked] = useState(false);
  const [isStoreOpen, setIsStoreOpen] = useState(false);
  const [username, setUsername] = useState('');

  const [unreadNotifCount, setUnreadNotifCount] = useState(0);

  // Drawer states
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const slideAnim = useRef(new Animated.Value(-width * 0.85)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const defaultAvatar = Image.resolveAssetSource(require('../../assets/icon.png')).uri;

  // ─── Real-time unread notification count ──────────────────────
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

  // โหลด username จาก users collection
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
      // ✅ รีเซ็ตทุกอย่างเมื่อเข้าหน้าใหม่
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
        Alert.alert(
          'ต้องเข้าสู่ระบบ',
          'กรุณาเข้าสู่ระบบเพื่อดำเนินการต่อ',
          [
            {
              text: 'ตกลง',
              onPress: () => navigation.replace('SignIn')
            }
          ]
        );
        return;
      }

      // ✅ Reload user และ refresh token
      try {
        await user.reload();
        await user.getIdToken(true);
        console.log('✅ Token refreshed successfully');
      } catch (tokenError) {
        console.error('❌ Token refresh error:', tokenError);
        
        if (tokenError.code === 'auth/invalid-credential' || 
            tokenError.code === 'auth/user-token-expired') {
          
          await auth.signOut();
          Alert.alert(
            'เซสชันหมดอายุ',
            'กรุณาเข้าสู่ระบบใหม่อีกครั้ง',
            [
              {
                text: 'ตกลง',
                onPress: () => navigation.replace('SignIn')
              }
            ]
          );
          return;
        }
      }

      await loadStoreData();
      await loadListings();
      
    } catch (error) {
      console.error('Error in checkAuthAndLoadData:', error);
      setLoading(false);
    }
  };

  const checkStoreOpenStatus = (businessHours) => {
    if (!businessHours) return false;

    const dayMap = {
      0: 'sun', 1: 'mon', 2: 'tue', 3: 'wed', 4: 'thu', 5: 'fri', 6: 'sat'
    };

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

    // รองรับกรณีข้ามเที่ยงคืน เช่น 22:00 - 02:00
    if (closeMinutes < openMinutes) {
      return currentMinutes >= openMinutes || currentMinutes < closeMinutes;
    }

    return currentMinutes >= openMinutes && currentMinutes < closeMinutes;
  };

  const loadStoreData = async () => {
    try {
      const user = auth.currentUser;
      if (!user) return;

      console.log('🔍 Loading store data for userId:', user.uid);

      // ✅ ดึงข้อมูลร้านค้าจาก stores collection แบบ real-time (ไม่ cache)
      const storeDocRef = doc(db, 'stores', user.uid);
      const storeDoc = await getDoc(storeDocRef);
      
      if (storeDoc.exists()) {
        const storeInfo = storeDoc.data();
        console.log('📦 Store data loaded:', {
          status: storeInfo.status,
          storeName: storeInfo.storeName
        });
        
        // ✅ ตรวจสอบสถานะล่าสุด
        if (storeInfo.status === 'approved') {
          console.log('✅ Store is APPROVED');
          setStoreData(storeInfo);
          setIsStoreOpen(checkStoreOpenStatus(storeInfo.businessHours));
          setStatusChecked(true);
          
        } else if (storeInfo.status === 'pending') {
          console.log('⏳ Store is PENDING');
          if (!statusChecked) {
            setStatusChecked(true);
            Alert.alert(
              'รอการอนุมัติ',
              'ร้านค้าของคุณอยู่ระหว่างการตรวจสอบ กรุณารอการอนุมัติจากผู้ดูแลระบบ',
              [
                {
                  text: 'ตกลง',
                  onPress: () => navigation.goBack()
                }
              ]
            );
          }
        } else if (storeInfo.status === 'rejected') {
          console.log('❌ Store is REJECTED');
          if (!statusChecked) {
            setStatusChecked(true);
            Alert.alert(
              'คำขออนุมัติถูกปฏิเสธ',
              storeInfo.rejectReason || 'ร้านค้าของคุณไม่ได้รับการอนุมัติ กรุณาติดต่อผู้ดูแลระบบ',
              [
                {
                  text: 'ตกลง',
                  onPress: () => navigation.goBack()
                }
              ]
            );
          }
        }
      } else {
        console.log('❌ Store document does NOT exist');
        
        // ✅ ตรวจสอบว่ามี approval_request หรือไม่
        const approvalQuery = query(
          collection(db, 'approval_requests'), 
          where('userId', '==', user.uid),
          where('type', '==', 'store_registration')
        );
        const approvalSnapshot = await getDocs(approvalQuery);
        
        if (!approvalSnapshot.empty) {
          // มี request อยู่แล้ว แต่ยังไม่มี store document = กำลังรอสร้าง
          console.log('⏳ Has approval request but no store document yet');
          if (!statusChecked) {
            setStatusChecked(true);
            Alert.alert(
              'รอการอนุมัติ',
              'ร้านค้าของคุณอยู่ระหว่างการตรวจสอบ กรุณารอการอนุมัติจากผู้ดูแลระบบ',
              [
                {
                  text: 'ตกลง',
                  onPress: () => navigation.goBack()
                }
              ]
            );
          }
        } else {
          // ไม่มีทั้ง store document และ approval request = ยังไม่เคยสมัคร
          console.log('📝 No store, no request - needs to register');
          if (!statusChecked) {
            setStatusChecked(true);
            Alert.alert(
              'ยังไม่มีร้านค้า',
              'คุณยังไม่ได้สมัครเป็นร้านค้า ต้องการสมัครหรือไม่?',
              [
                {
                  text: 'ยกเลิก',
                  onPress: () => navigation.goBack(),
                  style: 'cancel'
                },
                {
                  text: 'สมัคร',
                  onPress: () => navigation.navigate('RegisterStoreStep1')
                }
              ]
            );
          }
        }
      }
    } catch (error) {
      console.error('Error loading store data:', error);
      
      if (error.code === 'auth/invalid-credential' || 
          error.code === 'auth/user-token-expired') {
        
        await auth.signOut();
        Alert.alert(
          'เซสชันหมดอายุ',
          'กรุณาเข้าสู่ระบบใหม่อีกครั้ง',
          [
            {
              text: 'ตกลง',
              onPress: () => navigation.replace('SignIn')
            }
          ]
        );
      } else {
        Alert.alert('ข้อผิดพลาด', 'ไม่สามารถโหลดข้อมูลร้านค้าได้');
      }
    }
  };

  const loadListings = async () => {
    try {
      const user = auth.currentUser;
      if (!user) return;

      // ดึงสินค้าของร้าน
      const q = query(collection(db, 'food_items'), where('userId', '==', user.uid));
      const snapshot = await getDocs(q);
      const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      const active = items.filter(item => item.quantity > 0);
      const sold = items.filter(item => item.quantity === 0);

      setActiveListings(active);
      setSoldListings(sold);

      // ดึงออเดอร์ที่ "สำเร็จ" (ลูกค้ารับของแล้ว) เพื่อคำนวณยอดขายและรายได้จริง
      const ordersQuery = query(
        collection(db, 'orders'),
        where('storeId', '==', user.uid),
        where('status', '==', 'completed')
      );
      const ordersSnapshot = await getDocs(ordersQuery);
      const completedOrders = ordersSnapshot.docs.map(doc => doc.data());

      // รวมจำนวนสินค้าที่ขายได้ (นับจาก items ในแต่ละออเดอร์)
      const totalSoldCount = completedOrders.reduce((sum, order) => {
        const itemsCount = (order.items || []).reduce((s, item) => s + (item.quantity || 1), 0);
        return sum + itemsCount;
      }, 0);

      // รวมรายได้จากออเดอร์ที่สำเร็จ
      const totalRevenue = completedOrders.reduce((sum, order) => {
        return sum + (Number(order.totalPrice) || 0);
      }, 0);

      setStats({
        posted: active.length,
        sold: totalSoldCount,
        revenue: totalRevenue,
      });
    } catch (error) {
      console.error('Error loading listings:', error);
      
      if (error.code === 'auth/invalid-credential' || 
          error.code === 'auth/user-token-expired') {
        
        await auth.signOut();
        Alert.alert(
          'เซสชันหมดอายุ',
          'กรุณาเข้าสู่ระบบใหม่อีกครั้ง',
          [
            {
              text: 'ตกลง',
              onPress: () => navigation.replace('SignIn')
            }
          ]
        );
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleDeleteListing = async (itemId) => {
    Alert.alert(
      'ลบรายการ',
      'คุณต้องการลบรายการนี้ใช่หรือไม่?',
      [
        { text: 'ยกเลิก', style: 'cancel' },
        {
          text: 'ลบ',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteDoc(doc(db, 'food_items', itemId));
              Alert.alert('สำเร็จ', 'ลบรายการเรียบร้อย');
              loadListings();
            } catch (error) {
              console.error('Error deleting:', error);
              Alert.alert('ผิดพลาด', 'ไม่สามารถลบรายการได้');
            }
          }
        }
      ]
    );
  };

  const handleMarkAsSold = async (itemId) => {
    try {
      await updateDoc(doc(db, 'food_items', itemId), { quantity: 0 });
      Alert.alert('สำเร็จ', 'ทำเครื่องหมายขายแล้ว');
      loadListings();
    } catch (error) {
      console.error('Error marking as sold:', error);
      Alert.alert('ผิดพลาด', 'ไม่สามารถอัปเดตได้');
    }
  };

  const formatExpiryDate = (dateString) => {
    if (!dateString) return 'ไม่ระบุ';
    
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return dateString;
      
      const day = date.getDate().toString().padStart(2, '0');
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const year = date.getFullYear();
      const hours = date.getHours().toString().padStart(2, '0');
      const minutes = date.getMinutes().toString().padStart(2, '0');
      
      return `${day}/${month}/${year} ${hours}:${minutes} น.`;
    } catch (error) {
      return dateString;
    }
  };

  const renderListingCard = (item) => {
    const originalPrice = Number(item.originalPrice) || 0;
    const discountPrice = Number(item.discountPrice) || Number(item.price) || 0;
    const discountPercent = originalPrice > 0 ? Math.round(((originalPrice - discountPrice) / originalPrice) * 100) : 0;

    return (
      <View key={item.id} style={styles.listingCard}>
        {/* Image Section */}
        <View style={styles.listingImageContainer}>
          {item.imageUrl ? (
            <Image source={{ uri: item.imageUrl }} style={styles.listingImage} />
          ) : (
            <View style={styles.placeholderImage}>
              <Ionicons name="image-outline" size={36} color="#2d4a3e" />
            </View>
          )}
          {discountPercent > 0 && (
            <View style={styles.discountBadge}>
              <Text style={styles.discountBadgeText}>-{discountPercent}%</Text>
            </View>
          )}
        </View>

        {/* Info Section */}
        <View style={styles.cardBody}>
          <Text style={styles.listingName} numberOfLines={1}>{item.name}</Text>

          <View style={styles.priceRow}>
            {originalPrice > 0 && (
              <Text style={styles.originalPrice}>{originalPrice} ฿</Text>
            )}
            <Text style={styles.finalPrice}>{discountPrice} ฿</Text>
          </View>

          <View style={styles.cardMeta}>
            <View style={styles.metaChip}>
              <Ionicons name="layers-outline" size={12} color="#10b981" />
              <Text style={styles.metaText}>{item.quantity} {item.unit}</Text>
            </View>
            {item.category ? (
              <View style={[styles.metaChip, { backgroundColor: '#eff6ff', borderColor: '#bfdbfe' }]}>
                <Ionicons name="pricetag-outline" size={12} color="#3b82f6" />
                <Text style={[styles.metaText, { color: '#3b82f6' }]}>{item.category}</Text>
              </View>
            ) : null}
            {item.expiryDate ? (
              <View style={[styles.metaChip, { backgroundColor: '#1a2030' }]}>
                <Ionicons name="time-outline" size={12} color="#60a5fa" />
                <Text style={[styles.metaText, { color: '#60a5fa' }]}>
                  {formatExpiryDate(item.expiryDate)?.split(' ')[0]}
                </Text>
              </View>
            ) : null}
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.cardButtons}>
          <TouchableOpacity
            style={styles.editBtn}
            onPress={() => navigation.navigate('CreateListing', { editItem: item })}
            activeOpacity={0.75}
          >
            <Ionicons name="pencil-outline" size={15} color="#10b981" />
            <Text style={styles.editBtnText}>แก้ไข</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.deleteBtn}
            onPress={() => handleDeleteListing(item.id)}
            activeOpacity={0.75}
          >
            <Ionicons name="trash-outline" size={15} color="#f87171" />
            <Text style={styles.deleteBtnText}>ลบ</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const handleRefresh = () => {
    console.log('🔄 Manual refresh triggered');
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

  // Drawer functions
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
    Alert.alert(
      'ออกจากระบบ',
      'คุณต้องการออกจากระบบหรือไม่?',
      [
        { text: 'ยกเลิก', style: 'cancel' },
        {
          text: 'ออกจากระบบ',
          style: 'destructive',
          onPress: async () => {
            try {
              await auth.signOut();
              navigation.replace('SignIn');
            } catch (error) {
              console.error('Logout error:', error);
              Alert.alert('ข้อผิดพลาด', 'ไม่สามารถออกจากระบบได้');
            }
          }
        }
      ]
    );
  };

  const DrawerContent = () => (
    <ScrollView contentContainerStyle={styles.drawerScrollContent} showsVerticalScrollIndicator={false}>
      <View style={styles.drawerContentPadding}>

        {/* Header */}
        <View style={styles.drawerTopHeader}>
          <View style={styles.logoContainer}>
            <View style={styles.logoCircle}>
              <Ionicons name="leaf" size={24} color="#10b981" />
            </View>
            <View>
              <Text style={styles.appName}>Food Waste</Text>
              <Text style={styles.appSlogan}>ร้านค้า</Text>
            </View>
          </View>
          <TouchableOpacity onPress={toggleDrawer} style={styles.closeButton}>
            <Ionicons name="close" size={24} color="#1f2937" />
          </TouchableOpacity>
        </View>

        {/* Profile Card */}
        <View style={styles.profileCard}>
          <View style={styles.profileHeader}>
            <Image
              source={storeData?.storeImage ? { uri: storeData.storeImage } : { uri: defaultAvatar }}
              style={styles.drawerAvatar}
            />
            <View style={{ flex: 1 }}>
              <Text style={styles.drawerName}>{username}</Text>
              <Text style={styles.drawerRole}>โหมด: ร้านค้า</Text>
            </View>
          </View>

          {/* Mode Switcher */}
          <View style={styles.modeContainer}>
            <TouchableOpacity
              style={styles.modeButtonInactive}
              onPress={() => { toggleDrawer(); navigation.navigate('Home'); }}
            >
              <Ionicons name="cart-outline" size={16} color="#6b7280" />
              <Text style={styles.modeTextInactive}>โหมดลูกค้า</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.modeButtonActive} activeOpacity={1}>
              <Ionicons name="storefront" size={16} color="#fff" />
              <Text style={styles.modeTextActive}>โหมดร้านค้า</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Main Menu */}
        <Text style={styles.sectionLabel}>เมนูหลัก</Text>
        <TouchableOpacity style={styles.drawerMenuItem} onPress={() => { toggleDrawer(); navigation.navigate('MyShop'); }}>
          <View style={[styles.menuIconBox, { backgroundColor: '#d1fae5' }]}><Ionicons name="home-outline" size={20} color="#10b981" /></View>
          <Text style={styles.drawerMenuText}>หน้าหลัก</Text>
          <Ionicons name="chevron-forward" size={18} color="#9ca3af" style={{ marginLeft: 'auto' }} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.drawerMenuItem} onPress={() => { toggleDrawer(); navigation.navigate('StoreOrders'); }}>
          <View style={[styles.menuIconBox, { backgroundColor: '#fef3c7' }]}><Ionicons name="receipt-outline" size={20} color="#f59e0b" /></View>
          <Text style={styles.drawerMenuText}>คำสั่งซื้อของร้าน</Text>
          <Ionicons name="chevron-forward" size={18} color="#9ca3af" style={{ marginLeft: 'auto' }} />
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


        {/* Account Menu */}
        <Text style={styles.sectionLabel}>บัญชี</Text>
        <TouchableOpacity style={styles.drawerMenuItem} onPress={() => { toggleDrawer(); navigation.navigate('StoreProfile'); }}>
          <View style={[styles.menuIconBox, { backgroundColor: '#f3e8ff' }]}><Ionicons name="person-outline" size={20} color="#a855f7" /></View>
          <Text style={styles.drawerMenuText}>โปรไฟล์</Text>
          <Ionicons name="chevron-forward" size={18} color="#9ca3af" style={{ marginLeft: 'auto' }} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.drawerMenuItem} onPress={() => { toggleDrawer(); navigation.navigate('StoreSettings'); }}>
          <View style={[styles.menuIconBox, { backgroundColor: '#f3f4f6' }]}><Ionicons name="settings-outline" size={20} color="#6b7280" /></View>
          <Text style={styles.drawerMenuText}>แก้ไขข้อมูลร้านค้า</Text>
          <Ionicons name="chevron-forward" size={18} color="#9ca3af" style={{ marginLeft: 'auto' }} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.drawerMenuItem} onPress={handleDeleteStore}>
          <View style={[styles.menuIconBox, { backgroundColor: '#fee2e2' }]}><Ionicons name="close-circle-outline" size={20} color="#ef4444" /></View>
          <Text style={styles.drawerMenuText}>ยกเลิกการเป็นร้านค้า</Text>
          <Ionicons name="chevron-forward" size={18} color="#9ca3af" style={{ marginLeft: 'auto' }} />
        </TouchableOpacity>

        {/* Store Status Card */}
        <View style={styles.storeStatusCard}>
          <View style={styles.storeStatusHeader}>
            <View style={styles.storeIconCircle}><Ionicons name="storefront" size={20} color="#10b981" /></View>
            <View>
              <Text style={styles.storeStatusName}>{storeData?.storeName || 'ชื่อร้านค้า'}</Text>
              <Text style={styles.storeStatusText}>สถานะ: {isStoreOpen ? 'เปิดทำการ' : 'ปิดทำการ'}</Text>
            </View>
          </View>
          <View style={styles.storeStatRow}>
            <View style={styles.storeStatBox}>
              <Text style={styles.storeStatBoxTitle}>สินค้าโพสต์</Text>
              <Text style={styles.storeStatBoxValue}>{stats.posted} รายการ</Text>
            </View>
            <View style={styles.storeStatBox}>
              <Text style={styles.storeStatBoxTitle}>ยอดขายสะสม</Text>
              <Text style={styles.storeStatBoxValue}>{stats.sold} ชิ้น</Text>
            </View>
          </View>
        </View>

        {/* Logout */}
        <TouchableOpacity style={styles.drawerLogout} onPress={handleLogout}>
          <View style={[styles.menuIconBox, { backgroundColor: '#fee2e2' }]}>
            <Ionicons name="log-out-outline" size={20} color="#ef4444" />
          </View>
          <Text style={styles.drawerLogoutText}>ออกจากระบบ</Text>
        </TouchableOpacity>

      </View>
    </ScrollView>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#10b981" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={toggleDrawer} style={styles.menuButton}>
          <View style={styles.menuIconWrapper}>
            <View style={styles.menuLine} />
            <View style={styles.menuLine} />
            <View style={styles.menuLine} />
          </View>
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <View style={styles.logoLeafWrap}>
            <Ionicons name="leaf" size={14} color="#10b981" />
          </View>
          <Text style={styles.headerTitle}>ร้านค้าของฉัน</Text>
        </View>

        <TouchableOpacity onPress={() => navigation.navigate('StoreProfile')}>
          <Image
            source={storeData?.storeImage ? { uri: storeData.storeImage } : { uri: defaultAvatar }}
            style={styles.headerAvatar}
          />
        </TouchableOpacity>
      </View>

      {/* Store Name Banner */}
      <View style={styles.bannerRow}>
        <View>
          <Text style={styles.bannerGreet}>สวัสดี 👋</Text>
          <Text style={styles.bannerName}>{storeData?.storeName || 'ร้านค้าของคุณ'}</Text>
        </View>
        <View style={[styles.statusBadge, !isStoreOpen && styles.statusBadgeClosed]}>
          <View style={[styles.statusDot, !isStoreOpen && styles.statusDotClosed]} />
          <Text style={styles.statusText}>{isStoreOpen ? 'เปิดอยู่' : 'ปิดอยู่'}</Text>
        </View>
      </View>

      {/* Stats Row */}
      <View style={styles.statsRow}>
        <View style={[styles.statCard]}>
          <Ionicons name="cube-outline" size={18} color="#10b981" />
          <Text style={styles.statNumber}>{stats.posted}</Text>
          <Text style={styles.statLabel}>โพสต์</Text>
        </View>
        <View style={[styles.statCard]}>
          <Ionicons name="checkmark-circle-outline" size={18} color="#10b981" />
          <Text style={[styles.statNumber]}>{stats.sold}</Text>
          <Text style={styles.statLabel}>ขายแล้ว</Text>
        </View>
        <View style={[styles.statCard]}>
          <Ionicons name="cash-outline" size={18} color="#10b981" />
          <Text style={[styles.statNumber]}>{stats.revenue}฿</Text>
          <Text style={styles.statLabel}>รายได้</Text>
        </View>
      </View>

      {/* Section Header */}
      <View style={styles.sectionHeader}>
        <View style={styles.sectionAccent} />
        <Text style={styles.sectionTitle}>สินค้าที่ขายอยู่</Text>
        <Text style={styles.sectionCount}>{activeListings.length} รายการ</Text>
      </View>

      {/* Listings */}
      <ScrollView
        style={styles.content}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 20 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={['#10b981']}
            tintColor="#10b981"
          />
        }
      >
        {loading ? (
          <View style={{ alignItems: 'center', marginTop: 60 }}>
            <ActivityIndicator size="large" color="#10b981" />
            <Text style={{ color: '#6b7280', marginTop: 12, fontSize: 13 }}>กำลังโหลด...</Text>
          </View>
        ) : activeListings.length > 0 ? (
          activeListings.map(renderListingCard)
        ) : (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconWrap}>
              <Ionicons name="basket-outline" size={44} color="#10b981" />
            </View>
            <Text style={styles.emptyStateText}>ยังไม่มีสินค้า</Text>
            <Text style={styles.emptyStateSubtext}>กดปุ่ม + NEW POST เพื่อเพิ่มสินค้า</Text>
          </View>
        )}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* NEW POST Button */}
      {storeData?.status === 'approved' && (
        <TouchableOpacity
          style={styles.newPostButton}
          onPress={() => navigation.navigate('CreateListing')}
          activeOpacity={0.85}
        >
          <View style={styles.newPostInner}>
            <Ionicons name="add" size={22} color="#fff" />
            <Text style={styles.newPostButtonText}>โพสต์</Text>
          </View>
        </TouchableOpacity>
      )}

      {/* Bottom Nav */}
      <View style={styles.bottomNav}>
        <TouchableOpacity style={styles.navItem}>
          <Ionicons name="storefront" size={24} color="#1f2937" />
          <Text style={[styles.navLabel, styles.navLabelActive]}>ร้านค้าของฉัน</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={() => navigation.navigate('StoreOrders')}>
          <Ionicons name="list-outline" size={24} color="#9ca3af" />
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

      {/* Drawer Modal */}
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
  // ─── Layout ────────────────────────────────────────────────────
  container: {
    flex: 1,
    backgroundColor: '#f0fdf8',
  },

  // ─── Header ────────────────────────────────────────────────────
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 58 : 50,
    paddingBottom: 14,
    backgroundColor: '#10b981',
    zIndex: 10,
  },
  menuButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuIconWrapper: { gap: 4, alignItems: 'flex-start' },
  menuLine: { width: 20, height: 2.5, backgroundColor: '#fff', borderRadius: 2 },
  headerCenter: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  logoLeafWrap: {
    width: 28,
    height: 28,
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 3,
  },
  headerAvatar: { width: 36, height: 36, borderRadius: 18, borderWidth: 2, borderColor: '#10b981', backgroundColor: '#d1fae5' },

  // ─── Banner ────────────────────────────────────────────────────
  bannerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 14,
    backgroundColor: '#10b981',
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    marginBottom: 4,
  },
  bannerGreet: { fontSize: 13, color: 'rgba(255,255,255,0.75)', marginBottom: 2 },
  bannerName: { fontSize: 22, fontWeight: '800', color: '#fff', letterSpacing: -0.5 },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  statusBadgeClosed: {
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  statusDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#fff' },
  statusDotClosed: { backgroundColor: '#fca5a5' },
  statusText: { fontSize: 12, color: '#fff', fontWeight: '700' },

  // ─── Stats ─────────────────────────────────────────────────────
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  statCard: {
    flex: 1,
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 10,
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#fff',
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  statNumber: {
    fontSize: 20,
    fontWeight: '800',
    color: '#10b981',
    marginTop: 2,
  },
  statLabel: { fontSize: 11, color: '#6b7280', fontWeight: '500' },

  // ─── Section Header ────────────────────────────────────────────
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 10,
    gap: 10,
  },
  sectionAccent: {
    width: 4,
    height: 18,
    backgroundColor: '#10b981',
    borderRadius: 2,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1f2937',
    flex: 1,
    letterSpacing: 0.3,
  },
  sectionCount: {
    fontSize: 12,
    color: '#fff',
    backgroundColor: '#10b981',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 20,
    fontWeight: '700',
  },

  // ─── Content ───────────────────────────────────────────────────
  content: { flex: 1 },

  // ─── Listing Card ──────────────────────────────────────────────
  listingCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    marginBottom: 12,
    overflow: 'hidden',
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  listingImageContainer: {
    width: '100%',
    height: 160,
    backgroundColor: '#d1fae5',
    position: 'relative',
  },
  listingImage: { width: '100%', height: '100%' },
  placeholderImage: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#d1fae5',
  },
  discountBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: '#10b981',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  discountBadgeText: { fontSize: 12, fontWeight: '800', color: '#fff' },

  cardBody: { padding: 14, gap: 8 },
  listingName: { fontSize: 16, fontWeight: '700', color: '#1f2937', letterSpacing: -0.2 },

  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  originalPrice: {
    fontSize: 13,
    color: '#9ca3af',
    textDecorationLine: 'line-through',
  },
  finalPrice: { fontSize: 18, fontWeight: '800', color: '#10b981' },

  cardMeta: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  metaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#ecfdf5',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#a7f3d0',
  },
  metaText: { fontSize: 11, color: '#059669', fontWeight: '600' },

  cardButtons: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  editBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 13,
    borderRightWidth: 1,
    borderRightColor: '#f3f4f6',
    backgroundColor: '#f9fafb',
  },
  editBtnText: { fontSize: 13, fontWeight: '700', color: '#10b981' },
  deleteBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 13,
    backgroundColor: '#f9fafb',
  },
  deleteBtnText: { fontSize: 13, fontWeight: '700', color: '#ef4444' },

  // ─── Bottom Nav ────────────────────────────────────────────────
  bottomNav: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderTopWidth: 1, borderTopColor: '#f3f4f6',
    paddingVertical: 12, paddingHorizontal: 20,
  },
  navItem: { flex: 1, alignItems: 'center', gap: 4 },
  navLabel: { fontSize: 11, color: '#9ca3af' },
  navLabelActive: { color: '#1f2937', fontWeight: '600' },
  notifBadge: {
    position: 'absolute', top: -4, right: -8,
    backgroundColor: '#ef4444', borderRadius: 10,
    minWidth: 18, height: 18,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1.5, borderColor: '#fff',
    paddingHorizontal: 4, zIndex: 5,
  },
  notifBadgeText: { color: '#fff', fontSize: 10, fontWeight: 'bold' },

  // ─── New Post Button ───────────────────────────────────────────
  newPostButton: {
    marginHorizontal: 16,
    marginBottom: 80,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#10b981',
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 8,
  },
  newPostInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 15,
  },
  newPostButtonText: { fontSize: 15, fontWeight: '800', color: '#fff', letterSpacing: 1.5 },

  // ─── Empty State ───────────────────────────────────────────────
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    gap: 10,
  },
  emptyIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#d1fae5',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#10b981',
    marginBottom: 8,
  },
  emptyStateText: { fontSize: 16, fontWeight: '700', color: '#1f2937' },
  emptyStateSubtext: { fontSize: 13, color: '#6b7280' },

  // ─── Drawer ────────────────────────────────────────────────────
  drawerOverlay: { flex: 1, flexDirection: 'row' },
  drawerBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' },
  drawerContainer: {
    position: 'absolute',
    left: 0, top: 0, bottom: 0,
    width: width * 0.85,
    backgroundColor: '#fff',
    shadowColor: '#10b981',
    shadowOffset: { width: 4, height: 0 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 20,
    borderRightWidth: 1,
    borderRightColor: '#d1fae5',
  },
  drawerScrollContent: {
    flexGrow: 1,
    paddingTop: Platform.OS === 'ios' ? 50 : 30,
    paddingBottom: 40,
  },
  drawerContentPadding: { paddingHorizontal: 20 },
  drawerWrapper: {
    flex: 1,
    paddingTop: Platform.OS === 'ios' ? 55 : 40,
  },
  drawerContent: { flex: 1, paddingHorizontal: 20 },
  drawerTopHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  logoContainer: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  logoCircle: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: '#f0fdf4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  appName: { fontSize: 16, fontWeight: '800', color: '#1f2937' },
  appSlogan: { fontSize: 12, color: '#6b7280' },
  closeButton: {
    width: 36, height: 36, borderRadius: 12,
    backgroundColor: '#f3f4f6',
    alignItems: 'center', justifyContent: 'center',
  },
  profileCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 15,
    borderWidth: 1,
    borderColor: '#f3f4f6',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
    marginBottom: 20,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 14,
  },
  modeContainer: { flexDirection: 'row', gap: 8 },
  modeButtonActive: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 5, paddingVertical: 9, backgroundColor: '#10b981', borderRadius: 10,
  },
  modeButtonInactive: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 5, paddingVertical: 9, backgroundColor: '#f3f4f6', borderRadius: 10,
  },
  modeTextActive: { fontSize: 11, fontWeight: '700', color: '#fff' },
  modeTextInactive: { fontSize: 11, color: '#6b7280', fontWeight: '600' },
  drawerAvatar: {
    width: 52, height: 52, borderRadius: 26,
    borderWidth: 2, borderColor: '#10b981',
    backgroundColor: '#d1fae5',
  },
  drawerName: { fontSize: 16, fontWeight: '700', color: '#1f2937' },
  drawerRole: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  sectionLabel: {
    fontSize: 11, color: '#9ca3af', fontWeight: '700',
    letterSpacing: 1.5, textTransform: 'uppercase',
    marginBottom: 8, marginLeft: 4, marginTop: 8,
  },
  drawerMenuItem: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 10, paddingHorizontal: 5,
    marginBottom: 4,
  },
  menuIconBox: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: '#ecfdf5',
    alignItems: 'center', justifyContent: 'center', marginRight: 14,
  },
  drawerMenuText: { fontSize: 14, color: '#1f2937', fontWeight: '600', flex: 1 },
  storeStatusCard: {
    backgroundColor: '#f9fafb',
    borderRadius: 16, padding: 16,
    marginTop: 15, marginBottom: 20,
    borderWidth: 1, borderColor: '#f3f4f6',
  },
  storeStatusHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  storeIconCircle: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#d1fae5',
    alignItems: 'center', justifyContent: 'center',
  },
  storeStatusName: { fontSize: 15, fontWeight: 'bold', color: '#1f2937' },
  storeStatusText: { fontSize: 12, color: '#10b981', marginTop: 2, fontWeight: '600' },
  storeStatRow: { flexDirection: 'row', gap: 10 },
  storeStatBox: {
    flex: 1, backgroundColor: '#fff', paddingVertical: 12,
    borderRadius: 12, alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 2, elevation: 1,
  },
  storeStatBoxTitle: { fontSize: 11, color: '#6b7280', marginBottom: 4 },
  storeStatBoxValue: { fontSize: 14, color: '#1f2937', fontWeight: 'bold' },
  drawerLogout: {
    flexDirection: 'row', alignItems: 'center',
    gap: 14, marginTop: 16, marginBottom: 30,
    paddingHorizontal: 12, paddingVertical: 12,
    backgroundColor: '#fff1f2', borderRadius: 12,
    borderWidth: 1, borderColor: '#fecdd3',
  },
  drawerLogoutText: { fontSize: 14, color: '#ef4444', fontWeight: '700' },
});