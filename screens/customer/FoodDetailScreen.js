import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Image,
  Platform,
  Dimensions,
  ActivityIndicator,
  Linking,
  Modal,
  Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { db, auth } from '../../firebase.config';
import {
  collection,
  addDoc,
  doc,
  onSnapshot,
  runTransaction,
  getDoc,
  query,
  where,
  getDocs,
  setDoc,
  deleteDoc,
  updateDoc,
  increment
} from 'firebase/firestore';
import * as Location from 'expo-location';

const { width } = Dimensions.get('window');

const calculateDistance = (lat1, lon1, lat2, lon2) => {
  if (!lat1 || !lon1 || !lat2 || !lon2) return null;
  const R = 6371;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;
  return distance.toFixed(1);
};

export default function FoodDetailScreen({ navigation, route }) {
  const { food } = route.params;
  const [loading, setLoading] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false);
  const [quantity, setQuantity] = useState(1);

  const [storeData, setStoreData] = useState(null);
  const [activeClosingTime, setActiveClosingTime] = useState('20:00');
  const [isCurrentlyOpen, setIsCurrentlyOpen] = useState(true);
  const [storeName, setStoreName] = useState(food.storeName || "กำลังโหลด...");
  const [closingTimeDisplay, setClosingTimeDisplay] = useState("กำลังโหลด...");
  const [currentTime, setCurrentTime] = useState(new Date());

  const [storeDeliveryMethod, setStoreDeliveryMethod] = useState('pickup');
  const [selectedMethod, setSelectedMethod] = useState('pickup');

  const [actualStoreId, setActualStoreId] = useState(null);
  const [userLocation, setUserLocation] = useState(null);
  const [distanceDisplay, setDistanceDisplay] = useState('กำลังหาพิกัด...');

  const [syncRating, setSyncRating] = useState(0);
  const [syncReviewCount, setSyncReviewCount] = useState(0);

  const [currentUserData, setCurrentUserData] = useState(null);

  const [alertVisible, setAlertVisible] = useState(false);
  const [alertConfig, setAlertConfig] = useState({
    title: '',
    message: '',
    type: 'error',
    onConfirm: null,
    showCancel: false,
    onCancel: null,
    confirmText: 'ตกลง',
    cancelText: 'ยกเลิก'
  });

  const sellingUnit = food.sellingUnit || food.unit || 'ชุด';
  const description = food.description || null;
  const originalPrice = Number(food.originalPrice) || 0;
  const price = Number(food.discountPrice) || Number(food.price) || 0;
  const discountPercent = originalPrice > 0 ? Math.round(((originalPrice - price) / originalPrice) * 100) : 0;
  const targetStoreIdForNav = actualStoreId || food.userId || food.storeId;

  const showCustomAlert = (title, message, type = 'error', options = {}) => {
      setAlertConfig({
        title,
        message,
        type,
        showCancel: false,
        confirmText: 'ตกลง',
        cancelText: 'ยกเลิก',
        onConfirm: null,
        onCancel: null,
        ...options
      });
      setAlertVisible(true);
    };

  useEffect(() => {
    (async () => {
      try {
        let { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          return;
        }
        let location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        setUserLocation(location.coords);
      } catch (error) {
        console.log('หาพิกัด GPS ไม่สำเร็จ');
      }
    })();
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const user = auth.currentUser;
    if(user) {
        const unsubUser = onSnapshot(doc(db, 'users', user.uid), doc => {
            if(doc.exists()) {
                setCurrentUserData(doc.data());
            }
        });
        return unsubUser;
    }
  }, []);

  useEffect(() => {
    const user = auth.currentUser;
    const targetStoreId = food.storeId;
    const targetUserId = food.userId || food.userID;

    const fetchStoreData = async () => {
        try {
            let sData = null;
            let realStoreId = targetStoreId;

            if (targetStoreId) {
                const docSnap = await getDoc(doc(db, 'stores', targetStoreId));
                if (docSnap.exists()) sData = docSnap.data();
            }

            if (!sData && targetUserId) {
                const q = query(collection(db, 'stores'), where('userId', '==', targetUserId));
                const querySnap = await getDocs(q);
                if (!querySnap.empty) {
                    sData = querySnap.docs[0].data();
                    realStoreId = querySnap.docs[0].id;
                }
            }

            if (!realStoreId && targetUserId) realStoreId = targetUserId;
            setActualStoreId(realStoreId);

            if (sData) {
                setStoreData(sData);
                setStoreName(sData.storeName || food.storeName);
                const method = sData.deliveryMethod || 'pickup';
                setStoreDeliveryMethod(method);
                if (method !== 'both') setSelectedMethod(method);
            }

            if (user && realStoreId) {
                const favRef = doc(db, 'users', user.uid, 'favorites', realStoreId);
                onSnapshot(favRef, (docSnapshot) => setIsFavorite(docSnapshot.exists()));
            }
        } catch (error) {
            console.error("❌ Error fetching store data:", error);
        }
    };
    fetchStoreData();
  }, [food]);

  useEffect(() => {
    if (!targetStoreIdForNav) return;

    const reviewsQuery = query(
      collection(db, 'reviews'),
      where('storeId', '==', targetStoreIdForNav)
    );

    const unsubscribe = onSnapshot(reviewsQuery, (snapshot) => {
      const reviews = snapshot.docs.map(doc => doc.data());
      const count = reviews.length;

      if (count > 0) {
        const totalRating = reviews.reduce((acc, curr) => acc + (curr.rating || 0), 0);
        setSyncRating(totalRating / count);
        setSyncReviewCount(count);
      } else {
        setSyncRating(0);
        setSyncReviewCount(0);
      }
    });

    return () => unsubscribe();
  }, [targetStoreIdForNav]);

  // ✅ ปรับปรุงการคำนวณระยะทาง ให้เช็คจาก "ที่อยู่จัดส่ง" เป็นหลักก่อน
  useEffect(() => {
    const targetLat = currentUserData?.latitude || userLocation?.latitude;
    const targetLng = currentUserData?.longitude || userLocation?.longitude;

    if (targetLat && targetLng && storeData?.latitude && storeData?.longitude) {
      const dist = calculateDistance(
        targetLat,
        targetLng,
        storeData.latitude,
        storeData.longitude
      );
      setDistanceDisplay(`${dist} กม.`);
    } else if (storeData && (!storeData.latitude || !storeData.longitude)) {
      setDistanceDisplay('ร้านไม่ระบุพิกัด');
    } else if (!targetLat || !targetLng) {
      setDistanceDisplay('รอระบุที่อยู่/GPS');
    }
  }, [userLocation, storeData, currentUserData]);

  useEffect(() => {
    if (!storeData) return;

    const calculateTimeLeft = () => {
        const now = currentTime;
        const daysMap = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
        const currentDayIdx = now.getDay();
        const prevDayIdx = currentDayIdx === 0 ? 6 : currentDayIdx - 1;

        let todayHours, prevDayHours;
        if (storeData.businessHours) {
            todayHours = storeData.businessHours[daysMap[currentDayIdx]];
            prevDayHours = storeData.businessHours[daysMap[prevDayIdx]];
        } else {
            const defaultHours = { isOpen: true, openTime: storeData.openTime || "08:00", closeTime: storeData.closeTime || storeData.closingTime || "20:00" };
            todayHours = defaultHours;
            prevDayHours = defaultHours;
        }

        let oDate, cDate, activeOpenStr, activeCloseStr;
        let shiftFound = false;

        if (prevDayHours && prevDayHours.isOpen) {
            const [poH, poM] = prevDayHours.openTime.split(':').map(Number);
            const [pcH, pcM] = prevDayHours.closeTime.split(':').map(Number);
            if (pcH < poH || (pcH === poH && pcM < poM)) {
                const nowH = now.getHours();
                const nowM = now.getMinutes();
                if (nowH < pcH || (nowH === pcH && nowM < pcM)) {
                    oDate = new Date(); oDate.setDate(oDate.getDate() - 1); oDate.setHours(poH, poM, 0, 0);
                    cDate = new Date(); cDate.setHours(pcH, pcM, 0, 0);
                    activeOpenStr = prevDayHours.openTime;
                    activeCloseStr = prevDayHours.closeTime;
                    shiftFound = true;
                }
            }
        }

        if (!shiftFound && todayHours && todayHours.isOpen) {
            const [toH, toM] = todayHours.openTime.split(':').map(Number);
            const [tcH, tcM] = todayHours.closeTime.split(':').map(Number);
            oDate = new Date(); oDate.setHours(toH, toM, 0, 0);
            cDate = new Date(); cDate.setHours(tcH, tcM, 0, 0);
            if (tcH < toH || (tcH === toH && tcM < toM)) cDate.setDate(cDate.getDate() + 1);
            activeOpenStr = todayHours.openTime;
            activeCloseStr = todayHours.closeTime;
            shiftFound = true;
        }

        if (!shiftFound) {
            setClosingTimeDisplay("วันนี้ร้านปิดทำการ 😴");
            setIsCurrentlyOpen(false);
            return;
        }

        if (now < oDate) {
            setClosingTimeDisplay(`เปิด ${activeOpenStr} น.\n(ยังไม่เปิด ❌)`);
            setIsCurrentlyOpen(false);
            return;
        }

        if (now > cDate) {
            setClosingTimeDisplay(`${activeCloseStr} น.\n(ปิดแล้ว 😴)`);
            setIsCurrentlyOpen(false);
            return;
        }

        setIsCurrentlyOpen(true);
        setActiveClosingTime(activeCloseStr);

        const diffMs = cDate - now;
        const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));
        const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
        const diffSecs = Math.floor((diffMs % (1000 * 60)) / 1000);
        const fmt = (n) => n < 10 ? `0${n}` : n;
        let countdownText = `${fmt(diffMins)}:${fmt(diffSecs)} นาที`;
        if (diffHrs > 0) countdownText = `${diffHrs} ชม. ${diffMins} นาที`;
        setClosingTimeDisplay(`${activeCloseStr} น.\n(อีก ${countdownText})`);
    };
    calculateTimeLeft();
  }, [storeData, currentTime]);

  const openInGoogleMaps = () => {
    if (storeData?.latitude && storeData?.longitude) {
      const url = Platform.select({
        ios: `maps:0,0?q=${storeData.latitude},${storeData.longitude}`,
        android: `geo:0,0?q=${storeData.latitude},${storeData.longitude}(${storeName})`
      });
      Linking.openURL(url).catch(() => showCustomAlert("ผิดพลาด", "ไม่สามารถเปิดแผนที่ได้"));
    } else {
      const address = storeData?.location || "Pakkret, Nonthaburi";
      const url = Platform.select({
        ios: `maps:0,0?q=${address}`,
        android: `geo:0,0?q=${address}`
      });
      Linking.openURL(url).catch(() => showCustomAlert("ผิดพลาด", "ไม่สามารถเปิดแผนที่ได้"));
    }
  };

  const handleToggleFavorite = async () => {
    const user = auth.currentUser;
    if (!user) {
      showCustomAlert('แจ้งเตือน', 'กรุณาเข้าสู่ระบบเพื่อบันทึกร้านโปรด');
      return;
    }
    if (!targetStoreIdForNav) return;
    try {
      const favRef = doc(db, 'users', user.uid, 'favorites', targetStoreIdForNav);
      if (isFavorite) {
        await deleteDoc(favRef);
      } else {
        await setDoc(favRef, {
          storeId: targetStoreIdForNav,
          storeName: storeName || 'ร้านค้า',
          savedAt: new Date().toISOString()
        });
      }
    } catch (error) {
      console.error("Error toggling favorite store:", error);
    }
  };

  const getCalculatedWeightInKg = () => {
      let itemWeightInKg = 0.4;
      if (food.measureValue) {
          const val = Number(food.measureValue);
          if (food.measureUnit === 'g' || food.measureUnit === 'กรัม') {
              itemWeightInKg = val / 1000;
          } else {
              itemWeightInKg = val;
          }
      }
      return itemWeightInKg;
  };

  const handleAddToCart = async () => {
        if (!isCurrentlyOpen) return showCustomAlert('ร้านปิดให้บริการ', `ร้าน "${storeName}" ปิดให้บริการในขณะนี้\nไม่สามารถเพิ่มลงตะกร้าได้`, 'error');
        const user = auth.currentUser;
        if (!user) return showCustomAlert('แจ้งเตือน', 'กรุณาเข้าสู่ระบบเพื่อทำรายการ');
        if (!targetStoreIdForNav) return showCustomAlert('ผิดพลาด', 'ไม่สามารถระบุร้านค้าได้');

        setLoading(true);
        try {
          const cartRef = collection(db, 'users', user.uid, 'cart');

          const q = query(
            cartRef,
            where('foodId', '==', food.id),
            where('deliveryMethod', '==', selectedMethod)
          );

          const querySnapshot = await getDocs(q);
          const actualWeight = getCalculatedWeightInKg();

          if (!querySnapshot.empty) {
            const existingDoc = querySnapshot.docs[0];
            const currentQty = existingDoc.data().quantity || 0;

            await updateDoc(doc(db, 'users', user.uid, 'cart', existingDoc.id), {
               quantity: currentQty + quantity,
               weight: actualWeight
            });

          } else {
            // 🛡️ ดักจับ undefined และ fallback ให้ครอบคลุม
            const newCartItem = {
                foodId: food.id || 'unknown_id',
                foodName: food.name || food.foodName || 'ไม่ระบุชื่ออาหาร',
                price: price || 0,
                originalPrice: originalPrice || 0,
                quantity: quantity || 1,
                unit: sellingUnit || 'ชุด',
                weight: actualWeight || 0.4,
                storeName: storeName || 'ไม่ระบุชื่อร้าน',
                storeId: targetStoreIdForNav || 'unknown_store',
                imageUrl: food.imageUrl || null, // บังคับ null ถ้ารูปไม่มี
                deliveryMethod: selectedMethod || 'pickup',
                addedAt: new Date().toISOString()
            };

            // ใช้ท่าไม้ตายสลัด undefined ก่อนส่งเข้า Firestore
            const cleanCartItem = JSON.parse(JSON.stringify(newCartItem));
            await addDoc(cartRef, cleanCartItem);
          }

          showCustomAlert('สำเร็จ!', 'เพิ่มอาหารลงตะกร้าเรียบร้อยแล้ว', 'success', {
            showCancel: true,
            confirmText: 'ไปตะกร้า',
            cancelText: 'ซื้อต่อ',
            onConfirm: () => navigation.navigate('Cart')
          });
        } catch (e) {
          console.error(e);
          showCustomAlert('ผิดพลาด', 'ไม่สามารถเพิ่มลงตะกร้าได้ กรุณาลองใหม่');
        }
        finally { setLoading(false); }
      };

  const increaseQty = () => { if (quantity < food.quantity) setQuantity(quantity + 1); };
  const decreaseQty = () => { if (quantity > 1) setQuantity(quantity - 1); };

  const handleBookNow = async () => {
      if (!isCurrentlyOpen) return showCustomAlert('ร้านปิดให้บริการ', `ร้าน "${storeName}" ปิดให้บริการในขณะนี้\nไม่สามารถสั่งอาหารได้`, 'error');
      const user = auth.currentUser;
      if (!user) return showCustomAlert('แจ้งเตือน', 'กรุณาเข้าสู่ระบบเพื่อทำรายการ');
      if (!targetStoreIdForNav) return showCustomAlert('ผิดพลาด', 'ไม่สามารถระบุร้านค้าได้');

      setLoading(true);
      let createdOrderData = null;

      try {
        const newOrderRef = doc(collection(db, 'orders'));
        const orderId = newOrderRef.id;

        const actualWeight = getCalculatedWeightInKg();
        const orderWeight = actualWeight * quantity;

        await runTransaction(db, async (transaction) => {
          const foodRef = doc(db, 'food_items', food.id);
          const foodDoc = await transaction.get(foodRef);
          if (!foodDoc.exists()) throw "สินค้าถูกลบไปแล้ว";
          if (foodDoc.data().quantity < quantity) throw "สินค้าหมดพอดี กรุณาลดจำนวน";
          transaction.update(foodRef, { quantity: foodDoc.data().quantity - quantity });

          // 🛡️ ดักจับ undefined และ fallback ให้ครอบคลุม
          const orderData = {
            id: orderId,
            userId: user.uid,
            storeId: targetStoreIdForNav || 'unknown_store',
            storeName: storeName || 'ร้านค้า',
            items: [{
                foodId: food.id || 'unknown_id',
                foodName: food.name || food.foodName || 'ไม่ระบุชื่ออาหาร',
                quantity: quantity || 1,
                price: price || 0,
                unit: sellingUnit || 'ชุด',
                weight: actualWeight || 0.4,
                imageUrl: food.imageUrl || null
            }],
            foodName: food.name || food.foodName || 'ไม่ระบุชื่ออาหาร',
            totalPrice: (price || 0) * (quantity || 1),
            quantity: quantity || 1,
            totalOrderWeight: orderWeight || 0,
            status: 'pending',
            orderType: selectedMethod || 'pickup',
            customerAddressTitle: currentUserData?.addressTitle || null,
            customerAddress: currentUserData?.address || null,
            customerLat: currentUserData?.latitude || null,
            customerLng: currentUserData?.longitude || null,
            customerPhone: currentUserData?.phone || null,
            closingTime: activeClosingTime || '20:00',
            createdAt: new Date().toISOString()
          };

          // ใช้ท่าไม้ตายสลัด undefined
          const cleanOrderData = JSON.parse(JSON.stringify(orderData));
          createdOrderData = cleanOrderData;
          transaction.set(newOrderRef, cleanOrderData);
        });

        const userRef = doc(db, 'users', user.uid);
        await updateDoc(userRef, {
            totalWeightSaved: increment(orderWeight)
        });

        setLoading(false);
        showCustomAlert('สำเร็จ!', `สั่งอาหารเรียบร้อยแล้ว 🌍`, 'success', {
            onConfirm: () => {
                setAlertVisible(false);
                navigation.replace('OrderDetail', { order: createdOrderData });
            }
        });
      } catch (error) {
        setLoading(false);
        showCustomAlert('จองไม่สำเร็จ', typeof error === 'string' ? error : 'เกิดข้อผิดพลาดในการจอง');
      }
    };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />
      <View style={styles.imageContainer}>
         {food.imageUrl ? <Image source={{ uri: food.imageUrl }} style={styles.foodImage} /> : <View style={styles.placeholderImage}><Ionicons name="fast-food" size={80} color="#ccc" /></View>}
         <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
             <Ionicons name="chevron-back" size={24} color="#000" />
         </TouchableOpacity>
         <TouchableOpacity style={styles.favoriteButton} onPress={handleToggleFavorite}>
             <Ionicons name={isFavorite ? "heart" : "heart-outline"} size={24} color={isFavorite ? "#ef4444" : "#000"} />
         </TouchableOpacity>
         {discountPercent > 0 && <View style={styles.discountBadge}><Text style={styles.discountText}>ลด {discountPercent}%</Text><Ionicons name="flame" size={16} color="#e51c23" /></View>}
      </View>

      <ScrollView style={styles.contentContainer} showsVerticalScrollIndicator={false}>
         <View style={styles.headerSection}>
            <View style={styles.titleRow}>
                <View style={{flex: 1, paddingRight: 10}}>
                  <Text style={styles.foodName}>{food.name}</Text>
                </View>
                <View style={styles.priceBlock}>
                  <Text style={styles.currentPrice}>{price} ฿</Text>
                  {originalPrice > price && <Text style={styles.originalPrice}>{originalPrice} ฿</Text>}
                </View>
            </View>

            <TouchableOpacity
                style={styles.storeRow}
                activeOpacity={0.7}
                onPress={() => {
                    if (targetStoreIdForNav) {
                        navigation.navigate('StoreDetail', {
                          storeId: targetStoreIdForNav,
                          initialTab: 'menu'
                        });
                    } else {
                        showCustomAlert('แจ้งเตือน', 'ไม่พบข้อมูลร้านค้า', 'warning');
                    }
                }}
            >
                <Ionicons name="storefront-outline" size={16} color="#10b981" />
                <Text style={[styles.storeName, { color: '#10b981', textDecorationLine: 'underline' }]}>
                    {storeName}
                </Text>
                <Ionicons name="chevron-forward" size={14} color="#10b981" />
            </TouchableOpacity>

            <View style={styles.ratingRow}>
                <Ionicons name="star" size={14} color="#f59e0b" />
                <Text style={styles.ratingText}>
                    {syncReviewCount > 0 ? syncRating.toFixed(1) : 'ยังไม่มีคะแนน'}
                </Text>
                {syncReviewCount > 0 && (
                    <Text style={styles.reviewCountText}>({syncReviewCount} รีวิว)</Text>
                )}
            </View>
          </View>

          {description ? (
            <View style={styles.descriptionBox}>
              <Text style={styles.descriptionTitle}>รายละเอียด</Text>
              <Text style={styles.descriptionText}>{description}</Text>
            </View>
          ) : (
            <View style={styles.sectionDivider} />
          )}

          <Text style={styles.subHeader}>วิธีรับสินค้า</Text>
          {storeDeliveryMethod === 'both' ? (
            <View style={styles.methodRow}>
              <TouchableOpacity
                style={[styles.methodBtn, selectedMethod === 'pickup' && styles.methodBtnActive]}
                onPress={() => setSelectedMethod('pickup')}
              >
                  <Ionicons name="storefront" size={18} color={selectedMethod === 'pickup' ? '#fff' : '#10b981'} />
                  <Text style={[styles.methodBtnText, selectedMethod === 'pickup' && styles.methodBtnTextActive]}>รับที่ร้าน</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.methodBtn, selectedMethod === 'delivery' && styles.methodBtnActive]}
                onPress={() => {
                  if (!currentUserData?.address) {
                    showCustomAlert(
                      'ไม่สามารถเลือกได้',
                      'กรุณาระบุที่อยู่จัดส่งที่หน้าโฮม (Home) ของคุณก่อนเลือกวิธีนี้',
                      'warning'
                    );
                    return;
                  }
                  setSelectedMethod('delivery');
                }}
              >
                  <Ionicons name="bicycle" size={18} color={selectedMethod === 'delivery' ? '#fff' : '#10b981'} />
                  <Text style={[styles.methodBtnText, selectedMethod === 'delivery' && styles.methodBtnTextActive]}>จัดส่ง</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.singleMethodBadge}>
              <Ionicons name={storeDeliveryMethod === 'delivery' ? "bicycle" : "storefront"} size={20} color="#10b981" />
              <Text style={styles.singleMethodText}>
                {storeDeliveryMethod === 'delivery' ? "จัดส่งเท่านั้น (Delivery Only)" : "รับเองที่ร้านเท่านั้น (Pickup Only)"}
              </Text>
            </View>
          )}

         <View style={styles.divider} />
         <View style={styles.quantitySection}>
            <Text style={[styles.sectionTitle, { fontWeight: 'bold' }]}>จำนวน ({sellingUnit})</Text>
            <View style={styles.qtyControl}>
                <TouchableOpacity style={styles.qtyButton} onPress={decreaseQty}><Ionicons name="remove" size={24} color="#000" /></TouchableOpacity>
                <Text style={styles.qtyText}>{quantity}</Text>
                <TouchableOpacity style={styles.qtyButton} onPress={increaseQty}><Ionicons name="add" size={24} color="#000" /></TouchableOpacity>
            </View>
         </View>

         <View style={styles.statsContainer}>
            <View style={styles.statItem}>
              <Ionicons name="cube-outline" size={20} color="#333" />
              <Text style={styles.statLabel}>คงเหลือ</Text>
              <Text style={styles.statValue}>{food.quantity} {sellingUnit}</Text>
            </View>
            <View style={styles.statItem}>
              <Ionicons name="time-outline" size={20} color="#333" />
              <Text style={styles.statLabel}>รับได้ถึง</Text>
              <Text style={styles.statValueTime}>{closingTimeDisplay}</Text>
            </View>
            <View style={styles.statItem}>
              <Ionicons name="location-outline" size={20} color="#333" />
              <Text style={styles.statLabel}>ระยะทาง</Text>
              <Text style={styles.statValue}>{distanceDisplay}</Text>
            </View>
         </View>

         <View style={styles.locationSection}>
             <Text style={[styles.sectionTitle, { fontWeight: 'bold' }]}>
                 <Ionicons name="location-outline" size={18} color="#000" /> ที่อยู่ร้าน
             </Text>
             <View style={styles.mapBox}>
                 <View style={styles.mapIconCircle}>
                     <Ionicons name="location" size={32} color="#ef4444" />
                     <Text style={styles.mapStoreName}>{storeName}</Text>
                 </View>
             </View>
             <Text style={styles.addressText}>{storeData?.location || "กำลังโหลดที่อยู่..."}</Text>
             <TouchableOpacity style={styles.mapsBtn} onPress={openInGoogleMaps}>
                 <Ionicons name="navigate" size={20} color="#333" />
                 <Text style={styles.mapsBtnText}>เปิด Google Maps</Text>
             </TouchableOpacity>
         </View>
         <View style={{height: 150}} />
      </ScrollView>

      <Modal animationType="fade" transparent={true} visible={alertVisible} onRequestClose={() => setAlertVisible(false)}>
        <View style={styles.alertOverlay}>
          <View style={styles.alertBox}>
            <View style={[styles.alertIconCircle,
              alertConfig.type === 'success' ? { backgroundColor: '#dcfce7' } :
              alertConfig.type === 'warning' ? { backgroundColor: '#fef3c7' } : { backgroundColor: '#fee2e2' }
            ]}>
              <Ionicons
                name={
                  alertConfig.type === 'success' ? "checkmark" :
                  alertConfig.type === 'warning' ? "warning" : "close"
                }
                size={36}
                color={
                  alertConfig.type === 'success' ? '#10b981' :
                  alertConfig.type === 'warning' ? '#f59e0b' : '#ef4444'
                }
              />
            </View>
            <Text style={styles.alertTitle}>{alertConfig.title}</Text>
            <Text style={styles.alertMessage}>{alertConfig.message}</Text>
            <View style={styles.alertButtonGroup}>
              {alertConfig.showCancel && (
                <TouchableOpacity style={[styles.alertButton, { backgroundColor: '#f3f4f6', flex: 1, marginRight: 10 }]} onPress={() => { setAlertVisible(false); if (alertConfig.onCancel) alertConfig.onCancel(); }}>
                  <Text style={[styles.alertButtonText, { color: '#4b5563' }]}>{alertConfig.cancelText}</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={[
                  styles.alertButton,
                  alertConfig.type === 'success' ? { backgroundColor: '#10b981' } :
                  alertConfig.type === 'warning' ? { backgroundColor: '#f59e0b' } : { backgroundColor: '#111827' },
                  alertConfig.showCancel && { flex: 1 }
                ]}
                onPress={() => { setAlertVisible(false); if (alertConfig.onConfirm) alertConfig.onConfirm(); }}>
                <Text style={styles.alertButtonText}>{alertConfig.confirmText}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <View style={styles.bottomBar}>
         <View style={styles.totalPriceContainer}>
             <Text style={styles.totalLabel}>ยอดรวม</Text>
             <Text style={styles.totalPrice}>{price * quantity} ฿</Text>
         </View>
         <View style={styles.buttonGroup}>
             <TouchableOpacity style={[styles.cartButton, !isCurrentlyOpen && {backgroundColor: '#9ca3af'}]} onPress={handleAddToCart} disabled={loading || !isCurrentlyOpen}>
                 <Ionicons name="cart-outline" size={24} color="#fff" />
             </TouchableOpacity>
             <TouchableOpacity style={[styles.bookButton, !isCurrentlyOpen && {backgroundColor: '#9ca3af'}]} onPress={handleBookNow} disabled={loading || !isCurrentlyOpen}>
                 <Text style={styles.bookButtonText}>{loading ? '...' : ( !isCurrentlyOpen ? 'ร้านปิด' : 'จองเลย' )}</Text>
             </TouchableOpacity>
         </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  imageContainer: { width: '100%', height: 280, backgroundColor: '#f0f0f0' },
  foodImage: { width: '100%', height: '100%' },
  placeholderImage: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  backButton: { position: 'absolute', top: 50, left: 20, width: 40, height: 40, borderRadius: 20, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  favoriteButton: { position: 'absolute', top: 50, right: 20, width: 40, height: 40, borderRadius: 20, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 3, elevation: 3 },
  discountBadge: { position: 'absolute', bottom: 30, right: 20, backgroundColor: '#e0e0e0', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, borderRadius: 20, gap: 5 },
  discountText: { fontWeight: 'bold', fontSize: 14 },
  contentContainer: { flex: 1, borderTopLeftRadius: 30, borderTopRightRadius: 30, backgroundColor: '#fff', marginTop: -20, paddingTop: 25, paddingHorizontal: 20 },
  headerSection: { marginBottom: 10 },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  foodName: { fontSize: 24, fontWeight: 'bold', color: '#000' },
  priceBlock: { alignItems: 'flex-end' },
  currentPrice: { fontSize: 24, fontWeight: 'bold', color: '#ef4444' },
  originalPrice: { fontSize: 14, color: '#999', textDecorationLine: 'line-through' },
  storeRow: { flexDirection: 'row', alignItems: 'center', marginTop: 10, gap: 5 },
  storeName: { fontSize: 14, color: '#666' },
  ratingRow: { flexDirection: 'row', alignItems: 'center', marginTop: 5, gap: 4, marginLeft: 2 },
  ratingText: { fontSize: 13, fontWeight: 'bold', color: '#6b7280' },
  reviewCountText: { fontSize: 12, color: '#9ca3af' },
  descriptionBox: { marginTop: 15, marginBottom: 15, padding: 15, backgroundColor: '#f9fafb', borderRadius: 12, borderWidth: 1, borderColor: '#f3f4f6' },
  descriptionTitle: { fontSize: 14, fontWeight: 'bold', color: '#374151', marginBottom: 6 },
  descriptionText: { fontSize: 13, color: '#4b5563', lineHeight: 20 },
  sectionDivider: { height: 1, backgroundColor: '#f3f4f6', marginVertical: 15 },
  subHeader: { fontSize: 16, fontWeight: 'bold', marginBottom: 12 },
  methodRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  methodBtn: { flex: 1, flexDirection: 'row', padding: 12, borderRadius: 12, backgroundColor: '#f3f4f6', justifyContent: 'center', alignItems: 'center', gap: 8 },
  methodBtnActive: { backgroundColor: '#10b981' },
  methodBtnText: { fontWeight: 'bold', color: '#10b981' },
  methodBtnTextActive: { color: '#fff' },
  singleMethodBadge: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f0fdf4', padding: 15, borderRadius: 12, borderWidth: 1, borderColor: '#dcfce7', marginBottom: 20, gap: 10 },
  singleMethodText: { fontSize: 14, fontWeight: '600', color: '#16a34a', textAlign: 'center' },
  quantitySection: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  qtyControl: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f3f4f6', borderRadius: 25, padding: 5 },
  qtyButton: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  qtyText: { fontSize: 18, fontWeight: 'bold', marginHorizontal: 20 },
  divider: { height: 1, backgroundColor: '#f0f0f0', marginVertical: 15 },
  statsContainer: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: '#f9f9f9', padding: 15, borderRadius: 12 },
  statItem: { alignItems: 'center', flex: 1 },
  statLabel: { fontSize: 10, color: '#888', marginTop: 4 },
  statValue: { fontSize: 13, fontWeight: '600', color: '#000', marginTop: 2 },
  statValueTime: { fontSize: 11, fontWeight: '600', textAlign: 'center', marginTop: 2 },
  locationSection: { marginTop: 25 },
  sectionTitle: { fontSize: 16 },
  mapBox: { width: '100%', height: 160, backgroundColor: '#fff', borderRadius: 15, borderWidth: 1, borderColor: '#e5e7eb', alignItems: 'center', justifyContent: 'center', marginTop: 10 },
  mapIconCircle: { alignItems: 'center' },
  mapStoreName: { fontSize: 12, color: '#6b7280', marginTop: 4 },
  addressText: { fontSize: 13, color: '#9ca3af', marginTop: 10, textAlign: 'left', paddingHorizontal: 5 },
  mapsBtn: { flexDirection: 'row', backgroundColor: '#e5e7eb', padding: 15, borderRadius: 12, marginTop: 15, justifyContent: 'center', alignItems: 'center', gap: 10 },
  mapsBtnText: { fontWeight: 'bold', color: '#1f2937' },
  bottomBar: { flexDirection: 'row', alignItems: 'center', padding: 20, paddingBottom: Platform.OS === 'ios' ? 35 : 20, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#f0f0f0', gap: 15, position: 'absolute', bottom: 0, left: 0, right: 0, elevation: 20, shadowColor: '#000', shadowOffset: { width: 0, height: -3 }, shadowOpacity: 0.1, shadowRadius: 5 },
  totalPriceContainer: { flex: 1 },
  totalLabel: { fontSize: 12, color: '#888' },
  totalPrice: { fontSize: 20, fontWeight: 'bold', color: '#1f2937' },
  buttonGroup: { flexDirection: 'row', gap: 10 },
  cartButton: { width: 50, height: 50, borderRadius: 12, backgroundColor: '#333', alignItems: 'center', justifyContent: 'center' },
  bookButton: { width: 140, height: 50, borderRadius: 12, backgroundColor: '#10b981', alignItems: 'center', justifyContent: 'center' },
  bookButtonText: { fontSize: 16, fontWeight: 'bold', color: '#fff' },
  alertOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  alertBox: { backgroundColor: '#fff', borderRadius: 24, padding: 25, alignItems: 'center', width: '85%', shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.1, shadowRadius: 10, elevation: 10 },
  alertIconCircle: { width: 70, height: 70, borderRadius: 35, justifyContent: 'center', alignItems: 'center', marginBottom: 15 },
  alertTitle: { fontSize: 20, fontWeight: 'bold', color: '#1f2937', marginBottom: 10, textAlign: 'center' },
  alertMessage: { fontSize: 14, color: '#6b7280', textAlign: 'center', marginBottom: 25, lineHeight: 22 },
  alertButtonGroup: { flexDirection: 'row', width: '100%', gap: 10 },
  alertButton: { paddingVertical: 14, borderRadius: 12, width: '100%', alignItems: 'center', justifyContent: 'center' },
  alertButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
});