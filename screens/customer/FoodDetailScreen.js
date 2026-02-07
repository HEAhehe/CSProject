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
  Platform, // ✅ เพิ่มการ Import Platform เพื่อแก้ Error
  Dimensions,
  ActivityIndicator
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { db, auth } from '../../firebase.config';
import {
  collection,
  addDoc,
  doc,
  onSnapshot,
  setDoc,
  deleteDoc,
  runTransaction,
  getDoc,
  query,
  where,
  getDocs,
  updateDoc
} from 'firebase/firestore';

const { width } = Dimensions.get('window');

export default function FoodDetailScreen({ navigation, route }) {
  const { food } = route.params;
  const [loading, setLoading] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false);
  const [quantity, setQuantity] = useState(1);

  // ✅ State สำหรับข้อมูลเวลาและร้านค้าที่ซิงค์จาก DB
  const [storeClosingTime, setStoreClosingTime] = useState(null);
  const [storeOpenTime, setStoreOpenTime] = useState(null);
  const [storeName, setStoreName] = useState(food.storeName || "กำลังโหลด...");
  const [closingTimeDisplay, setClosingTimeDisplay] = useState("กำลังโหลด...");
  const [currentTime, setCurrentTime] = useState(new Date());

  const originalPrice = Number(food.originalPrice) || 0;
  const price = Number(food.discountPrice) || Number(food.price) || 0;
  const discountPercent = originalPrice > 0 ? Math.round(((originalPrice - price) / originalPrice) * 100) : 0;

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // 1. 🟢 ระบบค้นหาร้านค้าอัจฉริยะ (Smart Fetch Store Data) - คืนค่าตามโค้ดเดิมที่ใช้งานได้
  useEffect(() => {
    const user = auth.currentUser;
    const targetStoreId = food.storeId;
    const targetUserId = food.userId || food.userID;

    const fetchStoreData = async () => {
        try {
            let storeData = null;
            let realStoreId = targetStoreId;

            // 🔍 Step 1: หาจาก 'stores' ด้วย storeId
            if (targetStoreId) {
                const docSnap = await getDoc(doc(db, 'stores', targetStoreId));
                if (docSnap.exists()) {
                    storeData = docSnap.data();
                }
            }

            // 🔍 Step 2: หาจาก userId ในคอลเลกชัน stores (เผื่อ storeId ผิด)
            if (!storeData && targetUserId) {
                const q = query(collection(db, 'stores'), where('userId', '==', targetUserId));
                const querySnap = await getDocs(q);
                if (!querySnap.empty) {
                    storeData = querySnap.docs[0].data();
                    realStoreId = querySnap.docs[0].id;
                }
            }

            // 🔍 Step 3: หาในคอลเลกชัน 'users' (สำหรับข้อมูลเวอร์ชันเก่า)
            if (!storeData && targetUserId) {
                const docSnap = await getDoc(doc(db, 'users', targetUserId));
                if (docSnap.exists() && (docSnap.data().closeTime || docSnap.data().closingTime)) {
                    storeData = docSnap.data();
                }
            }

            if (storeData) {
                // ✅ อัปเดตข้อมูลให้ซิงค์กัน (ใช้ storeName จาก DB ตามที่เคยแก้ไว้)
                setStoreName(storeData.storeName || food.storeName);
                setStoreClosingTime(storeData.closeTime || storeData.closingTime || "20:00");
                setStoreOpenTime(storeData.openTime || "08:00");
            } else {
                setStoreClosingTime("20:00");
                setStoreOpenTime("08:00");
            }

            // เช็คสถานะรายการโปรด
            if (user && realStoreId) {
                const favRef = doc(db, 'users', user.uid, 'favorites', realStoreId);
                onSnapshot(favRef, (docSnapshot) => setIsFavorite(docSnapshot.exists()));
            }

        } catch (error) {
            console.error("Error fetching store data:", error);
            setStoreClosingTime("20:00");
        }
    };
    fetchStoreData();
  }, [food]);

  // 2. 🟢 การคำนวณเวลา (ใช้ Logic เดิมที่แสดงผลปกติ)
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

      // เช็คเวลาเปิด-ปิด
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

  // --- ฟังก์ชันการทำงานอื่นๆ ---
  const increaseQty = () => { if (quantity < food.quantity) setQuantity(quantity + 1); };
  const decreaseQty = () => { if (quantity > 1) setQuantity(quantity - 1); };

  const handleAddToCart = async () => {
    const user = auth.currentUser;
    if (!user) return Alert.alert('กรุณาเข้าสู่ระบบ');
    setLoading(true);
    try {
      await addDoc(collection(db, 'users', user.uid, 'cart'), {
        foodId: food.id, foodName: food.name, price, originalPrice, quantity,
        storeName: storeName, // ✅ ใช้ชื่อที่ซิงค์แล้ว
        storeId: food.storeId || food.userId, imageUrl: food.imageUrl, addedAt: new Date().toISOString()
      });
      Alert.alert('สำเร็จ', 'เพิ่มลงตระกร้าแล้ว 🛒', [{ text: 'ซื้อต่อ' }, { text: 'ไปตะกร้า', onPress: () => navigation.navigate('Cart') }]);
    } catch (e) { Alert.alert('Error', 'ลองใหม่อีกครั้ง'); } finally { setLoading(false); }
  };

  const handleBookNow = async () => {
    const user = auth.currentUser;
    if (!user) return Alert.alert('กรุณาเข้าสู่ระบบ');
    Alert.alert('ยืนยันการจอง', `ยอดรวม ${price * quantity} ฿?`, [{ text: 'ยกเลิก', style: 'cancel' }, {
      text: 'ยืนยัน', onPress: async () => {
        setLoading(true);
        try {
          await runTransaction(db, async (transaction) => {
            const foodRef = doc(db, 'food_items', food.id);
            const foodDoc = await transaction.get(foodRef);
            if (!foodDoc.exists()) throw "สินค้าถูกลบแล้ว";
            if (foodDoc.data().quantity < quantity) throw "สินค้าไม่พอ";
            transaction.update(foodRef, { quantity: foodDoc.data().quantity - quantity });
            const newOrderRef = doc(collection(db, 'orders'));
            transaction.set(newOrderRef, {
              userId: user.uid, foodId: food.id, foodName: food.name, storeName: storeName,
              storeId: food.storeId || food.userId, totalPrice: price * quantity,
              quantity, status: 'pending', orderType: 'pickup', closingTime: storeClosingTime,
              createdAt: new Date().toISOString(), imageUrl: food.imageUrl || null
            });
            return newOrderRef.id;
          }).then((orderId) => {
            navigation.replace('OrderDetail', { order: { id: orderId, ...food, storeName, totalPrice: price * quantity, quantity, status: 'pending', orderType: 'pickup', closingTime: storeClosingTime, createdAt: new Date().toISOString() } });
          });
        } catch (e) { Alert.alert('จองไม่สำเร็จ', e); } finally { setLoading(false); }
      }
    }]);
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />
      <View style={styles.imageContainer}>
         {food.imageUrl ? <Image source={{ uri: food.imageUrl }} style={styles.foodImage} /> : <View style={styles.placeholderImage}><Ionicons name="fast-food" size={80} color="#ccc" /></View>}
         <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}><Ionicons name="chevron-back" size={24} color="#000" /></TouchableOpacity>
         {discountPercent > 0 && <View style={styles.discountBadge}><Text style={styles.discountText}>ลด {discountPercent}%</Text><Ionicons name="flame" size={16} color="#000" /></View>}
      </View>
      <ScrollView style={styles.contentContainer} showsVerticalScrollIndicator={false}>
         <View style={styles.headerSection}>
            <View style={styles.titleRow}>
                <Text style={styles.foodName}>{food.name}</Text>
                <View style={styles.priceBlock}><Text style={styles.currentPrice}>{price} ฿</Text>{originalPrice > price && <Text style={styles.originalPrice}>{originalPrice} ฿</Text>}</View>
            </View>
            <View style={styles.storeRow}><Ionicons name="storefront-outline" size={16} color="#666" /><Text style={styles.storeName}>{storeName}</Text></View>
         </View>
         <View style={styles.quantitySection}>
            <Text style={styles.sectionTitle}>จำนวน</Text>
            <View style={styles.qtyControl}>
                <TouchableOpacity style={styles.qtyButton} onPress={decreaseQty}><Ionicons name="remove" size={24} color="#000" /></TouchableOpacity>
                <Text style={styles.qtyText}>{quantity}</Text>
                <TouchableOpacity style={styles.qtyButton} onPress={increaseQty}><Ionicons name="add" size={24} color="#000" /></TouchableOpacity>
            </View>
         </View>
         <View style={styles.divider} />
         <View style={styles.statsContainer}>
            <View style={styles.statItem}><Ionicons name="restaurant-outline" size={20} color="#333" /><Text style={styles.statLabel}>คงเหลือ</Text><Text style={styles.statValue}>{food.quantity} ชุด</Text></View>
            <View style={styles.statItem}><Ionicons name="time-outline" size={20} color="#333" /><Text style={styles.statLabel}>รับได้ถึง</Text><Text style={styles.statValueTime}>{closingTimeDisplay}</Text></View>
            <View style={styles.statItem}><Ionicons name="location-outline" size={20} color="#333" /><Text style={styles.statLabel}>ระยะทาง</Text><Text style={styles.statValue}>0.8 Km</Text></View>
         </View>
         <View style={styles.locationSection}>
            <Text style={styles.sectionTitle}>ที่อยู่ร้าน</Text>
            <View style={styles.mapCard}><View style={styles.mapPlaceholder}><Ionicons name="location-sharp" size={30} color="#333" /><Text style={styles.mapText}>{storeName}</Text></View><Text style={styles.addressText}>123 ถนนตัวอย่าง กทม.</Text></View>
         </View>
         <View style={{height: 100}} />
      </ScrollView>
      <View style={styles.bottomBar}>
         <View style={styles.totalPriceContainer}><Text style={styles.totalLabel}>รวมทั้งหมด</Text><Text style={styles.totalPrice}>{price * quantity} ฿</Text></View>
         <TouchableOpacity style={styles.cartButton} onPress={handleAddToCart} disabled={loading}>{loading ? <ActivityIndicator color="#fff" /> : <Ionicons name="cart-outline" size={24} color="#fff" />}</TouchableOpacity>
         <TouchableOpacity style={styles.bookButton} onPress={handleBookNow} disabled={loading}><Text style={styles.bookButtonText}>จองเลย</Text></TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  imageContainer: { width: '100%', height: 280, backgroundColor: '#f0f0f0', position: 'relative' },
  foodImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  placeholderImage: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  backButton: { position: 'absolute', top: Platform.OS === 'ios' ? 60 : 50, left: 20, width: 40, height: 40, borderRadius: 20, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', elevation: 2 },
  discountBadge: { position: 'absolute', bottom: 30, right: 20, backgroundColor: '#e0e0e0', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, gap: 5 },
  discountText: { fontWeight: 'bold', fontSize: 14 },
  contentContainer: { flex: 1, borderTopLeftRadius: 30, borderTopRightRadius: 30, backgroundColor: '#fff', marginTop: -20, paddingTop: 25, paddingHorizontal: 20 },
  headerSection: { marginBottom: 20 },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  foodName: { fontSize: 24, fontWeight: 'bold', color: '#000', flex: 1 },
  priceBlock: { alignItems: 'flex-end' },
  currentPrice: { fontSize: 24, fontWeight: 'bold', color: '#ef4444' },
  originalPrice: { fontSize: 14, color: '#999', textDecorationLine: 'line-through' },
  storeRow: { flexDirection: 'row', alignItems: 'center', marginTop: 5, gap: 5 },
  storeName: { fontSize: 14, color: '#666' },
  quantitySection: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', color: '#333' },
  qtyControl: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f3f4f6', borderRadius: 25, padding: 5 },
  qtyButton: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', elevation: 1 },
  qtyText: { fontSize: 18, fontWeight: 'bold', marginHorizontal: 20 },
  divider: { height: 1, backgroundColor: '#f0f0f0', marginVertical: 15 },
  statsContainer: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: '#f9f9f9', padding: 15, borderRadius: 12, marginBottom: 25 },
  statItem: { alignItems: 'center', flex: 1 },
  statLabel: { fontSize: 10, color: '#888', marginTop: 4 },
  statValue: { fontSize: 13, fontWeight: '600', color: '#000', marginTop: 2 },
  statValueTime: { fontSize: 11, fontWeight: '600', color: '#000', marginTop: 2, textAlign: 'center', lineHeight: 16 },
  locationSection: { marginBottom: 20 },
  mapCard: { borderWidth: 1, borderColor: '#eee', borderRadius: 12, overflow: 'hidden', marginBottom: 10 },
  mapPlaceholder: { height: 100, backgroundColor: '#f0f0f0', alignItems: 'center', justifyContent: 'center' },
  mapText: { marginTop: 5, fontSize: 12, color: '#555', fontWeight: 'bold' },
  addressText: { padding: 10, fontSize: 12, color: '#666' },
  bottomBar: { flexDirection: 'row', alignItems: 'center', padding: 20, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#f0f0f0', gap: 15 },
  totalPriceContainer: { flex: 1 },
  totalLabel: { fontSize: 12, color: '#888' },
  totalPrice: { fontSize: 20, fontWeight: 'bold', color: '#000' },
  cartButton: { width: 50, height: 50, borderRadius: 12, backgroundColor: '#333', alignItems: 'center', justifyContent: 'center' },
  bookButton: { flex: 2, backgroundColor: '#10b981', height: 50, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  bookButtonText: { fontSize: 16, fontWeight: 'bold', color: '#fff' }
}); // ✅ จบไฟล์อย่างถูกต้องเพื่อแก้ Unexpected token