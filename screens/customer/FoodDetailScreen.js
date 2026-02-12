import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Image,
  Alert,
  Platform,
  Dimensions,
  ActivityIndicator,
  Linking
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
  getDocs
} from 'firebase/firestore';

const { width } = Dimensions.get('window');

export default function FoodDetailScreen({ navigation, route }) {
  const { food } = route.params;
  const [loading, setLoading] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false);
  const [quantity, setQuantity] = useState(1);

  const [storeData, setStoreData] = useState(null);
  const [storeClosingTime, setStoreClosingTime] = useState(null);
  const [storeOpenTime, setStoreOpenTime] = useState(null);
  const [storeName, setStoreName] = useState(food.storeName || "กำลังโหลด...");
  const [closingTimeDisplay, setClosingTimeDisplay] = useState("กำลังโหลด...");
  const [currentTime, setCurrentTime] = useState(new Date());

  const [storeDeliveryMethod, setStoreDeliveryMethod] = useState('pickup');
  const [selectedMethod, setSelectedMethod] = useState('pickup');

  const originalPrice = Number(food.originalPrice) || 0;
  const price = Number(food.discountPrice) || Number(food.price) || 0;
  const discountPercent = originalPrice > 0 ? Math.round(((originalPrice - price) / originalPrice) * 100) : 0;

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
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

            if (sData) {
                setStoreData(sData);
                setStoreName(sData.storeName || food.storeName);
                setStoreClosingTime(sData.closeTime || sData.closingTime || "20:00");
                setStoreOpenTime(sData.openTime || "08:00");

                const method = sData.deliveryMethod || 'pickup';
                setStoreDeliveryMethod(method);

                if (method !== 'both') {
                    setSelectedMethod(method);
                }
            }

            if (user && realStoreId) {
                const favRef = doc(db, 'users', user.uid, 'favorites', realStoreId);
                onSnapshot(favRef, (docSnapshot) => setIsFavorite(docSnapshot.exists()));
            }
        } catch (error) {
            console.error("Error fetching store data:", error);
        }
    };
    fetchStoreData();
  }, [food]);

  useEffect(() => {
    if (!storeClosingTime) return;
    const calculateTimeLeft = () => {
      const now = currentTime;
      const openDate = new Date();
      const closeDate = new Date();

      if (typeof storeClosingTime === 'string' && storeClosingTime.includes(':')) {
          const [h, m] = storeClosingTime.split(':').map(Number);
          closeDate.setHours(h, m, 0, 0);
      }
      if (typeof storeOpenTime === 'string' && storeOpenTime.includes(':')) {
          const [h, m] = storeOpenTime.split(':').map(Number);
          openDate.setHours(h, m, 0, 0);
      } else {
          openDate.setHours(0, 0, 0, 0);
      }

      if (now < openDate) {
          setClosingTimeDisplay(`เปิด ${storeOpenTime} น.\n(ยังไม่เปิด ❌)`);
          return;
      }
      if (now > closeDate) {
        setClosingTimeDisplay(`${storeClosingTime} น.\n(ปิดแล้ว 😴)`);
        return;
      }

      const diffMs = closeDate - now;
      const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));
      const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
      const diffSecs = Math.floor((diffMs % (1000 * 60)) / 1000);

      const fmt = (n) => n < 10 ? `0${n}` : n;
      let countdownText = `${fmt(diffMins)}:${fmt(diffSecs)} นาที`;
      if (diffHrs > 0) countdownText = `${diffHrs} ชม. ${diffMins} นาที`;

      setClosingTimeDisplay(`${storeClosingTime} น.\n(อีก ${countdownText})`);
    };
    calculateTimeLeft();
  }, [storeClosingTime, storeOpenTime, currentTime]);

  const openInGoogleMaps = () => {
    const address = storeData?.location || "Pakkret, Nonthaburi";
    const url = Platform.select({
      ios: `maps:0,0?q=${address}`,
      android: `geo:0,0?q=${address}`
    });
    Linking.openURL(url).catch(() => Alert.alert("ไม่สามารถเปิดแผนที่ได้"));
  };

  const handleAddToCart = async () => {
    const user = auth.currentUser;
    if (!user) return Alert.alert('กรุณาเข้าสู่ระบบ');
    setLoading(true);
    try {
      await addDoc(collection(db, 'users', user.uid, 'cart'), {
          foodId: food.id, foodName: food.name, price: price, originalPrice: originalPrice,
          quantity: quantity, storeName: storeName, storeId: food.storeId || food.userId,
          imageUrl: food.imageUrl, deliveryMethod: selectedMethod, addedAt: new Date().toISOString()
      });
      Alert.alert('สำเร็จ', 'เพิ่มลงตะกร้าแล้ว', [
        { text: 'ซื้อต่อ' },
        { text: 'ไปตะกร้า', onPress: () => navigation.navigate('Cart') }
      ]);
    } catch (e) { Alert.alert('ผิดพลาด', 'เพิ่มลงตะกร้าไม่ได้'); }
    finally { setLoading(false); }
  };

  const increaseQty = () => { if (quantity < food.quantity) setQuantity(quantity + 1); };
  const decreaseQty = () => { if (quantity > 1) setQuantity(quantity - 1); };

  const handleBookNow = async () => {
    const user = auth.currentUser;
    if (!user) return Alert.alert('กรุณาเข้าสู่ระบบ');

    setLoading(true);
    try {
      const newOrderRef = doc(collection(db, 'orders'));
      const orderId = newOrderRef.id;

      await runTransaction(db, async (transaction) => {
        const foodRef = doc(db, 'food_items', food.id);
        const foodDoc = await transaction.get(foodRef);
        if (!foodDoc.exists()) throw "สินค้าถูกลบไปแล้ว";
        if (foodDoc.data().quantity < quantity) throw "สินค้าหมดพอดี";

        transaction.update(foodRef, { quantity: foodDoc.data().quantity - quantity });
        transaction.set(newOrderRef, {
          id: orderId,
          userId: user.uid,
          storeId: food.storeId || food.userId,
          storeName: storeName,
          items: [{ foodId: food.id, foodName: food.name, quantity, price }],
          foodName: food.name,
          totalPrice: price * quantity,
          quantity: quantity,
          status: 'pending',
          orderType: selectedMethod,
          closingTime: storeClosingTime || '20:00',
          createdAt: new Date().toISOString()
        });
      });

      setLoading(false);
      navigation.replace('OrderDetail', {
          order: {
              id: orderId,
              foodName: food.name,
              storeName: storeName,
              totalPrice: price * quantity,
              quantity: quantity,
              status: 'pending',
              orderType: selectedMethod,
              closingTime: storeClosingTime,
              items: [{ foodName: food.name, quantity, price }]
          }
      });
    } catch (error) {
      setLoading(false);
      Alert.alert('จองไม่สำเร็จ', error);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />
      <View style={styles.imageContainer}>
         {food.imageUrl ? <Image source={{ uri: food.imageUrl }} style={styles.foodImage} /> : <View style={styles.placeholderImage}><Ionicons name="fast-food" size={80} color="#ccc" /></View>}
         <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}><Ionicons name="chevron-back" size={24} color="#000" /></TouchableOpacity>
         {discountPercent > 0 && <View style={styles.discountBadge}><Text style={styles.discountText}>ลด {discountPercent}%</Text><Ionicons name="flame" size={16} color="#e51c23" /></View>}
      </View>

      <ScrollView style={styles.contentContainer} showsVerticalScrollIndicator={false}>
         <View style={styles.headerSection}>
            <View style={styles.titleRow}>
                <Text style={styles.foodName}>{food.name}</Text>
                <View style={styles.priceBlock}><Text style={styles.currentPrice}>{price} ฿</Text>{originalPrice > price && <Text style={styles.originalPrice}>{originalPrice} ฿</Text>}</View>
            </View>
            <View style={styles.storeRow}><Ionicons name="storefront-outline" size={16} color="#666" /><Text style={styles.storeName}>{storeName}</Text></View>
         </View>

          <View style={styles.sectionDivider} />
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
                onPress={() => setSelectedMethod('delivery')}
              >
                  <Ionicons name="bicycle" size={18} color={selectedMethod === 'delivery' ? '#fff' : '#10b981'} />
                  <Text style={[styles.methodBtnText, selectedMethod === 'delivery' && styles.methodBtnTextActive]}>จัดส่ง</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.singleMethodBadge}>
              <Ionicons
                name={storeDeliveryMethod === 'delivery' ? "bicycle" : "storefront"}
                size={20}
                color="#10b981"
              />
              <Text style={styles.singleMethodText}>
                {storeDeliveryMethod === 'delivery' ? "จัดส่งเท่านั้น (Delivery Only)" : "รับเองที่ร้านเท่านั้น (Pickup Only)"}
              </Text>
            </View>
          )}

         <View style={styles.divider} />

         <View style={styles.quantitySection}>
            <Text style={[styles.sectionTitle, { fontWeight: 'bold' }]}>จำนวน</Text>
            <View style={styles.qtyControl}>
                <TouchableOpacity style={styles.qtyButton} onPress={decreaseQty}><Ionicons name="remove" size={24} color="#000" /></TouchableOpacity>
                <Text style={styles.qtyText}>{quantity}</Text>
                <TouchableOpacity style={styles.qtyButton} onPress={increaseQty}><Ionicons name="add" size={24} color="#000" /></TouchableOpacity>
            </View>
         </View>

         <View style={styles.statsContainer}>
            <View style={styles.statItem}><Ionicons name="restaurant-outline" size={20} color="#333" /><Text style={styles.statLabel}>คงเหลือ</Text><Text style={styles.statValue}>{food.quantity} ชุด</Text></View>
            <View style={styles.statItem}><Ionicons name="time-outline" size={20} color="#333" /><Text style={styles.statLabel}>รับได้ถึง</Text><Text style={styles.statValueTime}>{closingTimeDisplay}</Text></View>
            <View style={styles.statItem}><Ionicons name="location-outline" size={20} color="#333" /><Text style={styles.statLabel}>ระยะทาง</Text><Text style={styles.statValue}>0.8 Km</Text></View>
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

             <TouchableOpacity
                 style={styles.mapsBtn}
                 onPress={openInGoogleMaps}
             >
                 <Ionicons name="navigate" size={20} color="#333" />
                 <Text style={styles.mapsBtnText}>เปิด Google Maps</Text>
             </TouchableOpacity>
         </View>

         {/* ✅ เพิ่มพื้นที่ว่างด้านล่างสุดของ ScrollView เพื่อไม่ให้ปุ่มทับข้อมูล */}
         <View style={{height: 150}} />
      </ScrollView>

      {/* ✅ กู้คืน Bottom Bar ที่มีทั้งปุ่มตะกร้าและปุ่มจอง */}
      <View style={styles.bottomBar}>
         <View style={styles.totalPriceContainer}>
             <Text style={styles.totalLabel}>ยอดรวม</Text>
             <Text style={styles.totalPrice}>{price * quantity} ฿</Text>
         </View>
         <View style={styles.buttonGroup}>
             <TouchableOpacity style={styles.cartButton} onPress={handleAddToCart} disabled={loading}>
                 <Ionicons name="cart-outline" size={24} color="#fff" />
             </TouchableOpacity>
             <TouchableOpacity style={styles.bookButton} onPress={handleBookNow} disabled={loading}>
                 <Text style={styles.bookButtonText}>{loading ? '...' : 'จองเลย'}</Text>
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
  discountBadge: { position: 'absolute', bottom: 30, right: 20, backgroundColor: '#e0e0e0', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, borderRadius: 20, gap: 5 },
  discountText: { fontWeight: 'bold', fontSize: 14 },
  contentContainer: { flex: 1, borderTopLeftRadius: 30, borderTopRightRadius: 30, backgroundColor: '#fff', marginTop: -20, paddingTop: 25, paddingHorizontal: 20 },
  headerSection: { marginBottom: 20 },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between' },
  foodName: { fontSize: 24, fontWeight: 'bold', color: '#000', flex: 1 },
  currentPrice: { fontSize: 24, fontWeight: 'bold', color: '#ef4444' },
  originalPrice: { fontSize: 14, color: '#999', textDecorationLine: 'line-through' },
  storeRow: { flexDirection: 'row', alignItems: 'center', marginTop: 5, gap: 5 },
  storeName: { fontSize: 14, color: '#666' },
  sectionDivider: { height: 1, backgroundColor: '#f3f4f6', marginVertical: 15 },
  subHeader: { fontSize: 16, fontWeight: 'bold', marginBottom: 12 },
  methodRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  methodBtn: { flex: 1, flexDirection: 'row', padding: 12, borderRadius: 12, backgroundColor: '#f3f4f6', justifyContent: 'center', alignItems: 'center', gap: 8 },
  methodBtnActive: { backgroundColor: '#10b981' },
  methodBtnText: { fontWeight: 'bold', color: '#10b981' },
  methodBtnTextActive: { color: '#fff' },
  singleMethodBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f0fdf4',
    padding: 15,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#dcfce7',
    marginBottom: 20,
    gap: 10
  },
  singleMethodText: { fontSize: 14, fontWeight: '600', color: '#16a34a', textAlign: 'center' },
  quantitySection: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  qtyControl: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f3f4f6', borderRadius: 25, padding: 5 },
  qtyButton: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  qtyText: { fontSize: 18, fontWeight: 'bold', marginHorizontal: 20 },
  divider: { height: 1, backgroundColor: '#f0f0f0', marginVertical: 15 },
  statsContainer: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: '#f9f9f9', padding: 15, borderRadius: 12 },
  statItem: { alignItems: 'center', flex: 1 },
  statLabel: { fontSize: 10, color: '#888' },
  statValue: { fontSize: 13, fontWeight: '600', color: '#000' },
  statValueTime: { fontSize: 11, fontWeight: '600', textAlign: 'center' },
  locationSection: { marginTop: 25 },
  mapBox: {
    width: '100%',
    height: 160,
    backgroundColor: '#fff',
    borderRadius: 15,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10
  },
  mapIconCircle: { alignItems: 'center' },
  mapStoreName: { fontSize: 12, color: '#6b7280', marginTop: 4 },
  addressText: { fontSize: 13, color: '#9ca3af', marginTop: 10, textAlign: 'left', paddingHorizontal: 5 },
  mapsBtn: { flexDirection: 'row', backgroundColor: '#e5e7eb', padding: 15, borderRadius: 12, marginTop: 15, justifyContent: 'center', alignItems: 'center', gap: 10 },
  mapsBtnText: { fontWeight: 'bold', color: '#1f2937' },

  // ✅ Bottom Bar Styles แก้ไขให้เห็นปุ่มชัดเจน
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 35 : 20,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    gap: 15,
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    elevation: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
  },
  totalPriceContainer: { flex: 1 },
  totalLabel: { fontSize: 12, color: '#888' },
  totalPrice: { fontSize: 20, fontWeight: 'bold', color: '#1f2937' },
  buttonGroup: { flexDirection: 'row', gap: 10 },
  cartButton: {
    width: 50,
    height: 50,
    borderRadius: 12,
    backgroundColor: '#333',
    alignItems: 'center',
    justifyContent: 'center'
  },
  bookButton: {
    width: 140,
    height: 50,
    borderRadius: 12,
    backgroundColor: '#10b981',
    alignItems: 'center',
    justifyContent: 'center'
  },
  bookButtonText: { fontSize: 16, fontWeight: 'bold', color: '#fff' }
});