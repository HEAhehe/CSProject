import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, StatusBar, Image, TextInput,
  ActivityIndicator, Animated, Dimensions, Modal, TouchableWithoutFeedback, Alert, Platform, FlatList
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { auth, db } from '../../firebase.config';
import { doc, collection, getDocs, query, where, onSnapshot, setDoc, deleteDoc, getDoc } from 'firebase/firestore';
import { useFocusEffect } from '@react-navigation/native';
import * as Location from 'expo-location';

const { width } = Dimensions.get('window');

// ค้นหาส่วนของ categories ใน HomeScreen.js แล้วแทนที่ด้วยชุดนี้ครับ
const categories = [
  { id: 'all', name: 'ทั้งหมด', icon: 'grid' },
  { id: 'อาหารสด', name: 'อาหารสด', icon: 'leaf' },
  { id: 'อาหารแห้ง', name: 'อาหารแห้ง', icon: 'cube' },
  { id: 'เครื่องดื่ม', name: 'เครื่องดื่ม', icon: 'cafe' },
  { id: 'ขนม/ของหวาน', name: 'ขนม/ของหวาน', icon: 'ice-cream' },
  { id: 'ผัก/ผลไม้', name: 'ผัก/ผลไม้', icon: 'nutrition' },
  { id: 'อาหารสำเร็จรูป', name: 'อาหารกล่อง', icon: 'restaurant' },
  { id: 'นม/ผลิตภัณฑ์นม', name: 'นม/เนย', icon: 'water' },
  { id: 'discount_50', name: 'ลด 50%+', icon: 'flame' },
  { id: 'under_50', name: 'ไม่เกิน 50.-', icon: 'pricetag' },
  { id: 'อื่นๆ', name: 'อื่นๆ', icon: 'ellipsis-horizontal' },
];

const calculateDistance = (lat1, lon1, lat2, lon2) => {
  if (!lat1 || !lon1 || !lat2 || !lon2) return null;
  const R = 6371;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return (R * c).toFixed(1);
};

export default function HomeScreen({ navigation }) {
  const [userData, setUserData] = useState(null);
  const [foodItems, setFoodItems] = useState([]);
  const [filteredFood, setFilteredFood] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const insets = useSafeAreaInsets();
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isCheckingRole, setIsCheckingRole] = useState(true);
  const [favoriteStoreIds, setFavoriteStoreIds] = useState([]);
  const [cartCount, setCartCount] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0); // 🔴 เพิ่ม state แจ้งเตือน
  const [storesData, setStoresData] = useState({});
  const [currentTime, setCurrentTime] = useState(new Date());
  const [userLocation, setUserLocation] = useState(null);
  const [closedStoreModalVisible, setClosedStoreModalVisible] = useState(false);
  const [closedStoreMessage, setClosedStoreMessage] = useState('');

  const scrollRef = useRef(null);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const slideAnim = useRef(new Animated.Value(-width * 0.85)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const defaultAvatar = Image.resolveAssetSource(require('../../assets/icon.png')).uri;

  useEffect(() => {
    (async () => {
      try {
        let { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') return;
        let location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        setUserLocation(location.coords);
      } catch (error) { console.log("Error getting location", error); }
    })();
  }, []);

  useEffect(() => {
    let unsubscribeUser, unsubscribeFav, unsubscribeCart, unsubscribeNotif; // 🔴 เพิ่มตัวแปรยกเลิก Notif

    const unsubscribeAuth = auth.onAuthStateChanged((user) => {
      if (user) {
        unsubscribeUser = onSnapshot(doc(db, 'users', user.uid), (docSnapshot) => {
          if (docSnapshot.exists()) {
            const data = docSnapshot.data();
            setUserData(data);
            if (data.currentRole === 'admin') navigation.replace('AdminHome');
            else setIsCheckingRole(false);
          } else setIsCheckingRole(false);
        });

        unsubscribeFav = onSnapshot(collection(db, 'users', user.uid, 'favorites'), (s) => setFavoriteStoreIds(s.docs.map(d => d.id)));
        unsubscribeCart = onSnapshot(collection(db, 'users', user.uid, 'cart'), (s) => {
          let total = 0; s.forEach(doc => total += (doc.data().quantity || 1)); setCartCount(total);
        });

        // 🔴 โค้ดดึงตัวเลขแจ้งเตือนแบบ Real-time
        const qNotif = query(collection(db, 'notifications'), where('userId', '==', user.uid), where('isRead', '==', false));
        unsubscribeNotif = onSnapshot(qNotif, (snapshot) => {
          setUnreadCount(snapshot.docs.length);
        });

      } else {
        setIsCheckingRole(false); setUserData(null); setFavoriteStoreIds([]); setCartCount(0); setUnreadCount(0);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeUser) unsubscribeUser();
      if (unsubscribeFav) unsubscribeFav();
      if (unsubscribeCart) unsubscribeCart();
      if (unsubscribeNotif) unsubscribeNotif();
    };
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  useFocusEffect(useCallback(() => { if (!isCheckingRole) fetchFoodItems(); }, [isCheckingRole]));

  const fetchFoodItems = async () => {
      try {
          const q = query(collection(db, 'food_items'), where('quantity', '>', 0));
          const snapshot = await getDocs(q);
          const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          setFoodItems(items);
          filterItems(items, searchQuery, selectedCategory, storesData);

          const uniqueStoreIds = [...new Set(items.map(item => item.storeId || item.userId).filter(id => id))];
          const storesInfo = {};

          await Promise.all(uniqueStoreIds.map(async (targetId) => {
              try {
                  let storeDoc = await getDoc(doc(db, 'stores', targetId));
                  if (storeDoc.exists()) storesInfo[targetId] = storeDoc.data();
                  else {
                      storeDoc = await getDoc(doc(db, 'users', targetId));
                      if (storeDoc.exists()) storesInfo[targetId] = storeDoc.data();
                  }
              } catch (e) { console.error("Store fetch error:", e); }
          }));

          setStoresData(storesInfo);
          filterItems(items, searchQuery, selectedCategory, storesInfo);
      } catch (error) { console.error('Error fetching foods:', error); }
      finally { setLoading(false); setRefreshing(false); }
  };

  const onRefresh = () => { setRefreshing(true); fetchFoodItems(); };

  const filterItems = (itemsList, text, categoryId, currentStoresData = storesData) => {
      let filtered = itemsList;
      if (text) {
        const lower = text.toLowerCase();
        filtered = filtered.filter(i => {
          const matchFoodName = (i.name || '').toLowerCase().includes(lower);
          const storeInfo = currentStoresData[i.storeId || i.userId] || {};
          const matchStoreName = (storeInfo.storeName || i.storeName || storeInfo.username || '').toLowerCase().includes(lower);
          return matchFoodName || matchStoreName;
        });
      }

      if (categoryId !== 'all') {
        if (categoryId === 'discount_50') {
          filtered = filtered.filter(i => {
            const op = Number(i.originalPrice) || 0, dp = Number(i.discountPrice) || Number(i.price) || 0;
            return op > 0 && (((op - dp) / op) * 100) >= 50;
          });
        } else if (categoryId === 'under_50') {
          filtered = filtered.filter(i => {
            const dp = Number(i.discountPrice) || Number(i.price) || 0;
            return dp > 0 && dp <= 50;
          });
        } else filtered = filtered.filter(i => i.category === categoryId);
      }
      setFilteredFood(filtered);
  };

  const handleSearch = (text) => { setSearchQuery(text); filterItems(foodItems, text, selectedCategory, storesData); };
  const handleCategorySelect = (categoryId) => { setSelectedCategory(categoryId); filterItems(foodItems, searchQuery, categoryId, storesData); };

  const handleToggleFavorite = async (targetStoreId, targetStoreName) => {
    const user = auth.currentUser;
    if (!user) { Alert.alert('กรุณาเข้าสู่ระบบ'); return; }
    const favRef = doc(db, 'users', user.uid, 'favorites', targetStoreId);
    try {
        if (favoriteStoreIds.includes(targetStoreId)) await deleteDoc(favRef);
        else await setDoc(favRef, { storeId: targetStoreId, storeName: targetStoreName || 'ร้านค้า', savedAt: new Date().toISOString() });
    } catch (error) { console.error("Error:", error); }
  };

  const getStoreStatus = useCallback((storeId) => {
      const store = storesData[storeId];
      if (!store) return { text: "ไม่มีข้อมูล", color: "#9ca3af", isOpen: false };
      const now = currentTime, daysMap = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'], currentDayIdx = now.getDay(), prevDayIdx = currentDayIdx === 0 ? 6 : currentDayIdx - 1;
      let todayHours = store.businessHours ? store.businessHours[daysMap[currentDayIdx]] : { isOpen: true, openTime: store.openTime || "08:00", closeTime: store.closeTime || store.closingTime || "20:00" };
      let prevDayHours = store.businessHours ? store.businessHours[daysMap[prevDayIdx]] : todayHours;

      const calculateStatusText = (oDate, cDate, n, oStr) => {
          if (n < oDate) return { text: `เปิด ${oStr} น.`, color: "#ef4444", isOpen: false };
          if (n > cDate) return { text: "ปิดแล้ว", color: "#ef4444", isOpen: false };
          const diffMs = cDate - n, totalMinutesLeft = Math.floor(diffMs / 60000);
          if (totalMinutesLeft > 30) return { text: "เปิดอยู่", color: "#10b981", isOpen: true };
          const fmt = (num) => num < 10 ? `0${num}` : num;
          return { text: `ปิดใน ${fmt(Math.floor((diffMs % 3600000) / 60000))}:${fmt(Math.floor((diffMs % 60000) / 1000))}`, color: "#f59e0b", isOpen: true };
      };

      if (prevDayHours && prevDayHours.isOpen) {
          const [poH, poM] = prevDayHours.openTime.split(':').map(Number), [pcH, pcM] = prevDayHours.closeTime.split(':').map(Number);
          if (pcH < poH || (pcH === poH && pcM < poM)) {
              if (now.getHours() < pcH || (now.getHours() === pcH && now.getMinutes() < pcM)) {
                  let oDate = new Date(); oDate.setDate(oDate.getDate() - 1); oDate.setHours(poH, poM, 0, 0);
                  let cDate = new Date(); cDate.setHours(pcH, pcM, 0, 0);
                  return calculateStatusText(oDate, cDate, now, prevDayHours.openTime);
              }
          }
      }
      if (todayHours && todayHours.isOpen) {
          const [toH, toM] = todayHours.openTime.split(':').map(Number), [tcH, tcM] = todayHours.closeTime.split(':').map(Number);
          let oDate = new Date(); oDate.setHours(toH, toM, 0, 0);
          let cDate = new Date(); cDate.setHours(tcH, tcM, 0, 0);
          if (tcH < toH || (tcH === toH && tcM < toM)) cDate.setDate(cDate.getDate() + 1);
          return calculateStatusText(oDate, cDate, now, todayHours.openTime);
      }
      return { text: "ปิดวันนี้", color: "#ef4444", isOpen: false };
  }, [storesData, currentTime]);

  const sortedFood = useMemo(() => {
    return [...filteredFood].sort((a, b) => {
      const statusA = getStoreStatus(a.storeId || a.userId), statusB = getStoreStatus(b.storeId || b.userId);
      if (statusA.isOpen && !statusB.isOpen) return -1;
      if (!statusA.isOpen && statusB.isOpen) return 1;
      return 0;
    });
  }, [filteredFood, getStoreStatus]);

  const handleScroll = (event) => setShowScrollTop(event.nativeEvent.contentOffset.y > 120);
  const scrollToTop = () => scrollRef.current?.scrollToOffset({ offset: 0, animated: true });

  const toggleDrawer = () => {
    if (isDrawerOpen) {
      Animated.parallel([Animated.timing(slideAnim, { toValue: -width * 0.85, duration: 300, useNativeDriver: true }), Animated.timing(fadeAnim, { toValue: 0, duration: 300, useNativeDriver: true })]).start(() => setIsDrawerOpen(false));
    } else {
      setIsDrawerOpen(true);
      Animated.parallel([Animated.timing(slideAnim, { toValue: 0, duration: 300, useNativeDriver: true }), Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true })]).start();
    }
  };

  const handleLogout = async () => { await auth.signOut(); };
  const handleSwitchToStore = () => { toggleDrawer(); if (userData?.currentRole === 'store' || userData?.currentRole === 'admin') navigation.navigate('MyShop'); else navigation.navigate('RegisterStoreStep1'); };

  const renderFoodCard = ({ item }) => {
      const originalPrice = Number(item.originalPrice) || 0, discountPrice = Number(item.discountPrice) || Number(item.price) || 0, discountPercent = originalPrice > 0 ? Math.round(((originalPrice - discountPrice) / originalPrice) * 100) : 0;
      const realStoreId = item.storeId || item.userId, storeInfo = storesData[realStoreId] || {}, displayStoreName = storeInfo.storeName || item.storeName || storeInfo.username || 'ร้านค้า', isFav = favoriteStoreIds.includes(realStoreId), status = getStoreStatus(realStoreId);
      let distanceDisplay = "กำลังหา...";
      if (userLocation && storeInfo.latitude && storeInfo.longitude) distanceDisplay = `${calculateDistance(userLocation.latitude, userLocation.longitude, storeInfo.latitude, storeInfo.longitude)} กม.`;
      else if (!userLocation) distanceDisplay = "รอ GPS"; else distanceDisplay = "ไม่ระบุพิกัด";

      return (
        <TouchableOpacity
            style={[styles.cardContainer, !status.isOpen && { opacity: 0.6 }]}
            onPress={() => {
              if (status.isOpen) navigation.navigate('FoodDetail', { food: { ...item, storeName: displayStoreName } });
              else { setClosedStoreMessage(`ร้าน "${displayStoreName}" ปิดให้บริการในขณะนี้\nกรุณาทำรายการใหม่ในเวลาทำการครับ`); setClosedStoreModalVisible(true); }
            }}
            activeOpacity={0.9}
          >
          <View style={styles.cardImageContainer}>
            {item.imageUrl ? <Image source={{ uri: item.imageUrl }} style={styles.cardImage} /> : <View style={styles.cardImagePlaceholder}><Ionicons name="fast-food" size={30} color="#ccc" /></View>}
          </View>
          <View style={styles.cardInfo}>
            <View style={styles.cardStoreRow}><Ionicons name="storefront" size={14} color="#1f2937" /><Text style={styles.cardStoreName} numberOfLines={1}>{displayStoreName}</Text></View>
            <Text style={styles.cardFoodName} numberOfLines={1}>{item.name}</Text>
            <View style={styles.cardPriceRow}>
               <Text style={styles.cardDiscountPrice}>฿{discountPrice}</Text>
               {originalPrice > discountPrice && <Text style={styles.cardOriginalPrice}>฿{originalPrice}</Text>}
               {discountPercent > 0 && <View style={styles.discountTag}><Text style={styles.discountTagText}>-{discountPercent}%</Text></View>}
            </View>
            <View style={styles.cardMetaRow}>
               <View style={styles.metaItem}><Ionicons name="location-outline" size={12} color="#6b7280" /><Text style={styles.cardMetaText}> {distanceDisplay}</Text></View>
               <Text style={styles.separator}>•</Text>
               <View style={styles.metaItem}><Ionicons name="time-outline" size={12} color={status.color} /><Text style={[styles.cardMetaText, { color: status.color, fontWeight: 'bold' }]}> {status.text}</Text></View>
               <Text style={styles.separator}>•</Text>
               <View style={styles.metaItem}><Text style={styles.cardMetaText}>เหลือ {item.quantity}</Text></View>
            </View>
          </View>
          <TouchableOpacity style={styles.heartIcon} onPress={() => handleToggleFavorite(realStoreId, displayStoreName)}>
              <Ionicons name={isFav ? "heart" : "heart-outline"} size={22} color={isFav ? "#ef4444" : "#9ca3af"} />
          </TouchableOpacity>
        </TouchableOpacity>
      );
  };

  const DrawerContent = () => (
    <View style={[styles.drawerWrapper, { paddingTop: Math.max(insets.top, 20) }]}>
      <ScrollView style={styles.drawerContent} showsVerticalScrollIndicator={false}>
        <View style={styles.drawerTopHeader}>
           <View style={styles.logoContainer}><View style={styles.logoCircle}><Ionicons name="leaf" size={20} color="#10b981" /></View><View><Text style={styles.appName}>Food Waste</Text><Text style={styles.appSlogan}>รักษ์โลกด้วยมือเรา</Text></View></View>
           <TouchableOpacity onPress={toggleDrawer} style={styles.closeButton}><Ionicons name="close" size={24} color="#6b7280" /></TouchableOpacity>
        </View>
        <View style={styles.profileCard}>
          <View style={styles.profileHeader}>
            <Image source={userData?.profileImage ? { uri: userData.profileImage } : { uri: defaultAvatar }} style={styles.drawerAvatar} />
            <View><Text style={styles.drawerName}>{userData?.username || 'User'}</Text><Text style={styles.drawerRole}>โหมด: ลูกค้า</Text></View>
          </View>
          <View style={styles.modeContainer}>
              <TouchableOpacity style={styles.modeButtonActive}><Ionicons name="cart" size={14} color="#fff" /><Text style={styles.modeTextActive}>โหมดลูกค้า</Text></TouchableOpacity>
              <TouchableOpacity style={styles.modeButtonInactive} onPress={handleSwitchToStore}><Ionicons name="storefront-outline" size={14} color="#6b7280" /><Text style={styles.modeTextInactive}>{userData?.currentRole === 'store' ? 'โหมดร้านค้า' : 'สมัครร้านค้า'}</Text></TouchableOpacity>
          </View>
        </View>
        <Text style={styles.sectionTitle}>เมนูหลัก</Text>
        <TouchableOpacity style={styles.drawerMenuItem} onPress={() => toggleDrawer()}><View style={styles.menuIconBox}><Ionicons name="home-outline" size={20} color="#10b981" /></View><Text style={styles.drawerMenuText}>หน้าหลัก</Text><Ionicons name="chevron-forward" size={18} color="#d1d5db" style={{marginLeft: 'auto'}} /></TouchableOpacity>
        <TouchableOpacity style={styles.drawerMenuItem} onPress={() => { toggleDrawer(); navigation.navigate('Orders'); }}><View style={styles.menuIconBox}><Ionicons name="receipt-outline" size={20} color="#f59e0b" /></View><Text style={styles.drawerMenuText}>คำสั่งซื้อของฉัน</Text><Ionicons name="chevron-forward" size={18} color="#d1d5db" style={{marginLeft: 'auto'}} /></TouchableOpacity>
        <TouchableOpacity style={styles.drawerMenuItem} onPress={() => { toggleDrawer(); navigation.navigate('FavoriteStores'); }}><View style={styles.menuIconBox}><Ionicons name="heart-outline" size={20} color="#ef4444" /></View><Text style={styles.drawerMenuText}>ร้านโปรด</Text><Ionicons name="chevron-forward" size={18} color="#d1d5db" style={{marginLeft: 'auto'}} /></TouchableOpacity>
        <TouchableOpacity style={styles.drawerMenuItem} onPress={() => { toggleDrawer(); navigation.navigate('Notifications'); }}><View style={styles.menuIconBox}><Ionicons name="notifications-outline" size={20} color="#3b82f6" /></View><Text style={styles.drawerMenuText}>แจ้งเตือน</Text><Ionicons name="chevron-forward" size={18} color="#d1d5db" style={{marginLeft: 'auto'}} /></TouchableOpacity>
        <Text style={styles.sectionTitle}>บัญชี</Text>
        <TouchableOpacity style={styles.drawerMenuItem} onPress={() => { toggleDrawer(); navigation.navigate('Profile'); }}><View style={styles.menuIconBox}><Ionicons name="person-outline" size={20} color="#6366f1" /></View><Text style={styles.drawerMenuText}>โปรไฟล์</Text><Ionicons name="chevron-forward" size={18} color="#d1d5db" style={{marginLeft: 'auto'}} /></TouchableOpacity>
        <TouchableOpacity style={styles.drawerLogout} onPress={handleLogout}><View style={[styles.menuIconBox, { backgroundColor: '#fee2e2' }]}><Ionicons name="log-out-outline" size={20} color="#ef4444" /></View><Text style={styles.drawerLogoutText}>ออกจากระบบ</Text></TouchableOpacity>
        <View style={{height: 50}} />
      </ScrollView>
    </View>
  );

  const ListHeader = () => (
    <>
      <TouchableOpacity style={styles.addressBar} onPress={() => navigation.navigate('AddressBook')} activeOpacity={0.7}>
        <View style={styles.addressIconBg}><Ionicons name="location" size={20} color="#ef4444" /></View>
        <View style={styles.addressTextContainer}>
          <Text style={styles.addressLabel}>จัดส่งที่</Text>
          <Text style={[styles.addressText, !userData?.addressTitle && { color: '#ef4444', fontStyle: 'italic', fontSize: 13 }]} numberOfLines={1}>{userData?.addressTitle ? userData.addressTitle : 'เพิ่มที่อยู่จัดส่ง (คลิก)'}</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
      </TouchableOpacity>
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color="#9ca3af" />
        <TextInput style={styles.searchInput} placeholder="ค้นหาร้านอาหารหรือเมนู" value={searchQuery} onChangeText={handleSearch} />
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoriesWrapper} contentContainerStyle={styles.categoriesContent}>
        {categories.map(cat => (
          <TouchableOpacity key={cat.id} style={[styles.categoryTag, selectedCategory === cat.id && styles.categoryTagActive, (cat.id === 'discount_50' || cat.id === 'under_50') && selectedCategory !== cat.id && { borderColor: '#ef4444', backgroundColor: '#fef2f2' }, (cat.id === 'discount_50' || cat.id === 'under_50') && selectedCategory === cat.id && { backgroundColor: '#ef4444', borderColor: '#ef4444' }]} onPress={() => handleCategorySelect(cat.id)}>
            <Ionicons name={cat.icon} size={16} color={selectedCategory === cat.id ? '#fff' : (cat.id === 'discount_50' || cat.id === 'under_50') ? '#ef4444' : '#6b7280'} />
            <Text style={[styles.categoryTagText, selectedCategory === cat.id && styles.categoryTagTextActive, (cat.id === 'discount_50' || cat.id === 'under_50') && selectedCategory !== cat.id && { color: '#ef4444' }]}>{cat.name}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
      <View style={styles.sectionHeader}><Text style={styles.sectionTitleMain}>สั่งอาหารของคุณ 🔥</Text></View>
      {loading && <ActivityIndicator size="large" color="#10b981" style={{marginTop: 20}} />}
    </>
  );

  const EmptyState = () => (!loading && sortedFood.length === 0 ? <View style={styles.emptyState}><Ionicons name="basket-outline" size={60} color="#d1d5db" /><Text style={styles.emptyText}>ไม่พบรายการอาหาร</Text></View> : null);

  if (isCheckingRole) return (<View style={styles.center}><ActivityIndicator size="large" color="#10b981" /></View>);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
     {/* 🟢 2. ดัน Header ลงมาไม่ให้ทับ Status Bar / รอยบาก */}
        <View style={[styles.header, { paddingTop: Math.max(insets.top, 20) + 10 }]}>
        <View style={styles.headerLeft}>
            <TouchableOpacity style={styles.menuButton} onPress={toggleDrawer}><Ionicons name="menu" size={30} color="#1f2937" /></TouchableOpacity>
            {/* เพิ่ม flex: 1 และ marginRight ให้ปุ่ม และใส่ numberOfLines ให้ Text */}
            <TouchableOpacity style={[styles.profileTextButton, { flex: 1, marginRight: 10 }]} onPress={() => navigation.navigate('Profile')} activeOpacity={0.6}>
                <Text style={styles.greeting} numberOfLines={1} ellipsizeMode="tail">สวัสดี, {userData?.username || 'User'}</Text>
            </TouchableOpacity>
        </View>
        <View style={styles.headerRight}>
            <TouchableOpacity style={styles.cartHeaderButton} onPress={() => navigation.navigate('Cart')}>
                <Ionicons name="cart-outline" size={26} color="#1f2937" />
                {cartCount > 0 && <View style={styles.cartBadgeSmall}><Text style={styles.cartBadgeTextSmall}>{cartCount}</Text></View>}
            </TouchableOpacity>
            <TouchableOpacity onPress={() => navigation.navigate('Profile')}><Image source={userData?.profileImage ? { uri: userData.profileImage } : { uri: defaultAvatar }} style={styles.avatar} /></TouchableOpacity>
        </View>
      </View>

      <FlatList
        ref={scrollRef} data={!loading ? sortedFood : []} keyExtractor={(item) => item.id} renderItem={renderFoodCard}
        onScroll={handleScroll} scrollEventThrottle={16} style={styles.content} showsVerticalScrollIndicator={false}
        refreshing={refreshing} onRefresh={onRefresh} ListHeaderComponent={ListHeader} ListEmptyComponent={EmptyState} ListFooterComponent={<View style={{ height: 120 }} />}
      />

      <Modal animationType="fade" transparent={true} visible={closedStoreModalVisible} onRequestClose={() => setClosedStoreModalVisible(false)}>
        <View style={styles.alertOverlay}>
          <View style={styles.alertBox}>
            <View style={styles.alertIconCircle}><Ionicons name="time" size={36} color="#ef4444" /></View>
            <Text style={styles.alertTitle}>ร้านปิดให้บริการ</Text>
            <Text style={styles.alertMessage}>{closedStoreMessage}</Text>
            <TouchableOpacity style={styles.alertButton} onPress={() => setClosedStoreModalVisible(false)} activeOpacity={0.8}><Text style={styles.alertButtonText}>ตกลง</Text></TouchableOpacity>
          </View>
        </View>
      </Modal>

      {showScrollTop && (
        <TouchableOpacity style={styles.scrollTopButton} onPress={scrollToTop} activeOpacity={0.8}>
           <Ionicons name="arrow-up" size={18} color="#fff" /><Text style={styles.scrollTopText}>กลับไปด้านบน</Text>
        </TouchableOpacity>
      )}

      {/* 🔴 แถบเมนูด้านล่าง อัปเดตแจ้งเตือนแล้ว */}
      {/* 🟢 3. ดัน Bottom Nav ขึ้นมาไม่ให้ทับขอบจอด้านล่าง (Home Indicator) */}
      <View style={[styles.bottomNav, { paddingBottom: Math.max(insets.bottom, 10) }]}>
        <TouchableOpacity style={styles.navItem}><Ionicons name="home" size={24} color="#10b981" /><Text style={styles.navLabelActive}>หน้าหลัก</Text></TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={() => navigation.navigate('Orders')}><Ionicons name="receipt-outline" size={24} color="#9ca3af" /><Text style={styles.navLabel}>ออเดอร์</Text></TouchableOpacity>

        <TouchableOpacity style={styles.navItem} onPress={() => navigation.navigate('Notifications')}>
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

        <TouchableOpacity style={styles.navItem} onPress={() => navigation.navigate('Profile')}><Ionicons name="person-outline" size={24} color="#9ca3af" /><Text style={styles.navLabel}>โปรไฟล์</Text></TouchableOpacity>
      </View>

      {isDrawerOpen && (<Modal transparent visible={isDrawerOpen} animationType="none"><View style={styles.drawerOverlay}><TouchableWithoutFeedback onPress={toggleDrawer}><View style={styles.drawerBackdrop} /></TouchableWithoutFeedback><Animated.View style={[styles.drawerContainer, { transform: [{ translateX: slideAnim }] }]}><DrawerContent /></Animated.View></View></Modal>)}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 15, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f3f4f6', zIndex: 10 },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 15 },
  menuButton: { padding: 4 },
  profileTextButton: { paddingVertical: 4 },
  greeting: { fontSize: 20, fontWeight: 'bold', color: '#1f2937' },
  avatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#f3f4f6', borderWidth: 1, borderColor: '#e5e7eb' },
  cartHeaderButton: { padding: 5, position: 'relative' },
  cartBadgeSmall: { position: 'absolute', top: -2, right: -2, backgroundColor: '#ef4444', minWidth: 16, height: 16, borderRadius: 8, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#fff' },
  cartBadgeTextSmall: { color: '#fff', fontSize: 9, fontWeight: 'bold' },
  addressBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', paddingHorizontal: 15, paddingVertical: 12, borderRadius: 12, marginBottom: 15, borderWidth: 1, borderColor: '#e5e7eb', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.03, shadowRadius: 3, elevation: 1 },
  addressIconBg: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#fef2f2', alignItems: 'center', justifyContent: 'center' },
  addressTextContainer: { flex: 1, marginLeft: 12, marginRight: 10 },
  addressLabel: { fontSize: 11, color: '#6b7280', marginBottom: 2 },
  addressText: { fontSize: 16, fontWeight: 'bold', color: '#1f2937' },
  searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', paddingHorizontal: 15, paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: '#e5e7eb', marginBottom: 15 },
  searchInput: { flex: 1, marginLeft: 10, fontSize: 15, color: '#374151' },
  categoriesWrapper: { marginHorizontal: -20, marginBottom: 20 },
  categoriesContent: { paddingHorizontal: 20, paddingRight: 30, alignItems: 'center' },
  categoryTag: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, marginRight: 10, gap: 6, borderWidth: 1, borderColor: '#e5e7eb' },
  categoryTagActive: { backgroundColor: '#10b981', borderColor: '#10b981' },
  categoryTagText: { fontSize: 13, color: '#6b7280', fontWeight: '500' },
  categoryTagTextActive: { color: '#fff', fontWeight: 'bold' },
  content: { flex: 1, paddingHorizontal: 20, paddingTop: 15 },
  sectionHeader: { marginBottom: 15 },
  sectionTitleMain: { fontSize: 18, fontWeight: 'bold', color: '#1f2937' },
  listContainer: { paddingBottom: 20 },
  cardContainer: { flexDirection: 'row', backgroundColor: '#fff', borderRadius: 16, padding: 12, marginBottom: 15, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2, borderWidth: 1, borderColor: '#f3f4f6', alignItems: 'center' },
  cardImageContainer: { width: 90, height: 90, borderRadius: 12, backgroundColor: '#f3f4f6', overflow: 'hidden', marginRight: 15 },
  cardImage: { width: '100%', height: '100%' },
  cardImagePlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  cardInfo: { flex: 1 },
  cardStoreRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  cardStoreName: { fontSize: 12, color: '#6b7280', marginLeft: 4 },
  cardFoodName: { fontSize: 16, fontWeight: 'bold', color: '#1f2937', marginBottom: 6 },
  cardPriceRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  cardDiscountPrice: { fontSize: 18, fontWeight: 'bold', color: '#ef4444' },
  cardOriginalPrice: { fontSize: 12, color: '#9ca3af', textDecorationLine: 'line-through' },
  discountTag: { backgroundColor: '#fee2e2', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  discountTagText: { fontSize: 10, color: '#ef4444', fontWeight: 'bold' },
  cardMetaRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', marginTop: 4 },
  metaItem: { flexDirection: 'row', alignItems: 'center' },
  cardMetaText: { fontSize: 11, color: '#6b7280', marginLeft: 2 },
  separator: { fontSize: 11, color: '#d1d5db', marginHorizontal: 6 },
  heartIcon: { padding: 5, position: 'absolute', top: 10, right: 10 },
  emptyState: { alignItems: 'center', marginTop: 50 },
  emptyText: { color: '#9ca3af', fontSize: 16, marginTop: 10 },
  bottomNav: { flexDirection: 'row', backgroundColor: '#fff', paddingVertical: 10, paddingHorizontal: 20, borderTopWidth: 1, borderTopColor: '#f3f4f6', position: 'absolute', bottom: 0, left: 0, right: 0 },
  navItem: { flex: 1, alignItems: 'center' },
  navLabel: { fontSize: 10, color: '#9ca3af', marginTop: 4 },
  navLabelActive: { fontSize: 10, color: '#10b981', fontWeight: 'bold', marginTop: 4 },
  scrollTopButton: { position: 'absolute', bottom: 85, alignSelf: 'center', backgroundColor: '#1f2937', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 30, elevation: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 5, zIndex: 100 },
  scrollTopText: { color: '#fff', fontSize: 13, fontWeight: 'bold', marginLeft: 8 },
  drawerOverlay: { flex: 1, flexDirection: 'row' },
  drawerBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  drawerContainer: { position: 'absolute', left: 0, top: 0, bottom: 0, width: width * 0.80, backgroundColor: '#fff', shadowColor: "#000", shadowOffset: { width: 2, height: 0 }, shadowOpacity: 0.25, shadowRadius: 3.84, elevation: 5 },
  drawerWrapper: { flex: 1 },
  drawerContent: { flex: 1, paddingHorizontal: 20 },
  drawerTopHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
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
  sectionTitle: { fontSize: 14, color: '#9ca3af', marginBottom: 10, marginLeft: 5, marginTop: 5 },
  drawerMenuItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', paddingVertical: 12, paddingHorizontal: 5, marginBottom: 5 },
  menuIconBox: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#f9fafb', alignItems: 'center', justifyContent: 'center', marginRight: 15 },
  drawerMenuText: { fontSize: 15, color: '#1f2937', fontWeight: '500' },
  drawerLogout: { flexDirection: 'row', alignItems: 'center', gap: 15, marginTop: 30, paddingHorizontal: 5, marginBottom: 30 },
  drawerLogoutText: { fontSize: 15, color: '#ef4444', fontWeight: 'bold' },
  alertOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  alertBox: { backgroundColor: '#fff', borderRadius: 24, padding: 25, alignItems: 'center', width: '85%', shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.1, shadowRadius: 10, elevation: 10 },
  alertIconCircle: { width: 70, height: 70, borderRadius: 35, backgroundColor: '#fee2e2', justifyContent: 'center', alignItems: 'center', marginBottom: 15 },
  alertTitle: { fontSize: 20, fontWeight: 'bold', color: '#1f2937', marginBottom: 10, textAlign: 'center' },
  alertMessage: { fontSize: 14, color: '#6b7280', textAlign: 'center', marginBottom: 25, lineHeight: 22 },
  alertButton: { backgroundColor: '#111827', paddingVertical: 14, borderRadius: 12, width: '100%', alignItems: 'center' },
  alertButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  // 🔴 เพิ่ม CSS จุดแดงแจ้งเตือน
  notificationBadge: { position: 'absolute', top: -4, right: -6, backgroundColor: '#ef4444', borderRadius: 10, minWidth: 18, height: 18, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#fff', paddingHorizontal: 4, zIndex: 5 },
  notificationBadgeText: { color: '#fff', fontSize: 10, fontWeight: 'bold' }
});