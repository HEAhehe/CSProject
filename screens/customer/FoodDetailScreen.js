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
  Dimensions,
  ActivityIndicator
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { db, auth } from '../../firebase.config';
// ✅ Import เพิ่ม: query, where, getDocs เพื่อใช้ระบบค้นหาอัจฉริยะ
import { collection, addDoc, doc, onSnapshot, setDoc, deleteDoc, runTransaction, getDoc, query, where, getDocs } from 'firebase/firestore';

const { width } = Dimensions.get('window');

export default function FoodDetailScreen({ navigation, route }) {
  const { food } = route.params;
  const [loading, setLoading] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false);
  const [quantity, setQuantity] = useState(1);

  // State
  const [storeClosingTime, setStoreClosingTime] = useState(null);
  const [storeOpenTime, setStoreOpenTime] = useState(null);
  const [closingTimeDisplay, setClosingTimeDisplay] = useState("กำลังโหลด...");
  const [currentTime, setCurrentTime] = useState(new Date());

  const originalPrice = Number(food.originalPrice) || 0;
  const price = Number(food.discountPrice) || Number(food.price) || 0;
  const discountPercent = originalPrice > 0 ? Math.round(((originalPrice - price) / originalPrice) * 100) : 0;

  // Timer
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // 1. ระบบค้นหาร้านค้าอัจฉริยะ (Smart Fetch Store Data)
  useEffect(() => {
    const user = auth.currentUser;
    // เราจะใช้ทั้ง storeId และ userId ในการตามหาข้อมูลร้าน
    const targetStoreId = food.storeId;
    const targetUserId = food.userId || food.userID;

    const fetchStoreData = async () => {
        try {
            let storeData = null;
            let realStoreId = targetStoreId; // เก็บ ID จริงที่เจอเพื่อใช้เช็ค Favorite

            // 🔍 Step 1: ลองหาจาก 'stores' ด้วย storeId ตรงๆ ก่อน (วิธีมาตรฐาน)
            if (targetStoreId) {
                const docRef = doc(db, 'stores', targetStoreId);
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    storeData = docSnap.data();
                    console.log("Found store by StoreID ✅");
                }
            }

            // 🔍 Step 2: ถ้ายังไม่เจอ... ลอง Query หาจาก userId (เผื่อ storeId ผิด)
            if (!storeData && targetUserId) {
                console.log("Searching store by UserID... 🔍");
                const q = query(collection(db, 'stores'), where('userId', '==', targetUserId));
                const querySnap = await getDocs(q);

                if (!querySnap.empty) {
                    const foundDoc = querySnap.docs[0];
                    storeData = foundDoc.data();
                    realStoreId = foundDoc.id; // อัปเดต ID จริงที่เจอ
                    console.log("Found store by UserID Query ✅");
                }
            }

            // 🔍 Step 3: ถ้ายังไม่เจออีก... ลองไปหาใน 'users' (เผื่อเป็นระบบเก่า)
            if (!storeData && targetUserId) {
                const docRef = doc(db, 'users', targetUserId);
                const docSnap = await getDoc(docRef);
                if (docSnap.exists() && (docSnap.data().closeTime || docSnap.data().closingTime)) {
                    storeData = docSnap.data();
                    console.log("Found data in Users collection ⚠️");
                }
            }

            // ✅ อัปเดตข้อมูลเวลา (ถ้าเจอข้อมูล)
            if (storeData) {
                setStoreClosingTime(storeData.closeTime || storeData.closingTime || "20:00");
                setStoreOpenTime(storeData.openTime || "08:00");
            } else {
                console.log("❌ Store not found anywhere, using defaults");
                setStoreClosingTime("20:00");
                setStoreOpenTime("08:00");
            }

            // ✅ เช็ค Favorite ด้วย ID ที่ถูกต้องที่สุดที่หาเจอ
            if (user && realStoreId) {
                const favRef = doc(db, 'users', user.uid, 'favorites', realStoreId);
                const unsubscribe = onSnapshot(favRef, (docSnapshot) => setIsFavorite(docSnapshot.exists()));
                return () => unsubscribe();
            }

        } catch (error) {
            console.error("Error fetching store data:", error);
            setStoreClosingTime("20:00");
        }
    };

    fetchStoreData();
  }, [food]);

  // 2. คำนวณเวลา
  useEffect(() => {
    if (!storeClosingTime) return;

    const calculateTimeLeft = () => {
      const now = currentTime;
      const openDate = new Date();
      const closeDate = new Date();

      if (typeof storeClosingTime === 'string') {
          const [h, m] = storeClosingTime.split(':').map(Number);
          closeDate.setHours(h, m, 0, 0);
      }
      if (typeof storeOpenTime === 'string') {
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

  const handleToggleFavorite = async () => {
    const user = auth.currentUser;
    if (!user) return Alert.alert('กรุณาเข้าสู่ระบบ');
    const storeId = food.storeId || food.userId || food.userID;

    // ใช้ storeId หรือ userId ก็ได้ (ระบบจะฉลาดพอ)
    const targetId = storeId;
    if (!targetId) return;

    const favRef = doc(db, 'users', user.uid, 'favorites', targetId);
    try {
        if (isFavorite) await deleteDoc(favRef);
        else await setDoc(favRef, { storeId: targetId, storeName: food.storeName || 'ร้านค้า', savedAt: new Date().toISOString() });
    } catch (error) { console.error(error); }
  };

  const increaseQty = () => { if (quantity < food.quantity) setQuantity(quantity + 1); };
  const decreaseQty = () => { if (quantity > 1) setQuantity(quantity - 1); };

  const handleAddToCart = async () => {
    const user = auth.currentUser;
    if (!user) return Alert.alert('กรุณาเข้าสู่ระบบ');
    setLoading(true);
    try {
      await addDoc(collection(db, 'users', user.uid, 'cart'), {
        foodId: food.id,
        foodName: food.name,
        price: price,
        originalPrice: originalPrice,
        quantity: quantity,
        storeName: food.storeName || 'ร้านค้า',
        storeId: food.storeId || food.userId || food.userID,
        imageUrl: food.imageUrl,
        addedAt: new Date().toISOString()
      });
      Alert.alert('สำเร็จ', 'เพิ่มลงตระกร้าแล้ว 🛒', [
        { text: 'ซื้อต่อ' },
        { text: 'ไปตระกร้า', onPress: () => navigation.navigate('Cart') }
      ]);
    } catch (error) {
      Alert.alert('Error', 'ไม่สามารถเพิ่มลงตระกร้าได้');
    } finally {
      setLoading(false);
    }
  };

  const handleBookNow = async () => {
    const user = auth.currentUser;
    if (!user) return Alert.alert('กรุณาเข้าสู่ระบบ');

    Alert.alert(
      'ยืนยันการจอง',
      `จอง "${food.name}" จำนวน ${quantity} ที่ \nราคารวม ${price * quantity} บาท?`,
      [
        { text: 'ยกเลิก', style: 'cancel' },
        {
          text: 'ยืนยัน',
          onPress: async () => {
            setLoading(true);
            try {
              await runTransaction(db, async (transaction) => {
                const foodRef = doc(db, 'food_items', food.id);
                const foodDoc = await transaction.get(foodRef);

                if (!foodDoc.exists()) throw "สินค้าถูกลบไปแล้ว";
                const currentQty = foodDoc.data().quantity || 0;
                if (currentQty < quantity) throw "สินค้าหมด หรือเหลือไม่พอ";

                transaction.update(foodRef, { quantity: currentQty - quantity });

                const newOrderRef = doc(collection(db, 'orders'));
                const targetStoreId = food.storeId || food.userId || food.userID;

                transaction.set(newOrderRef, {
                  userId: user.uid,
                  foodId: food.id,
                  foodName: food.name,
                  storeName: food.storeName || 'ร้านค้า',
                  storeId: targetStoreId,
                  totalPrice: price * quantity,
                  quantity: quantity,
                  status: 'pending',
                  orderType: 'pickup',
                  closingTime: storeClosingTime,
                  createdAt: new Date().toISOString(),
                  imageUrl: food.imageUrl || null
                });

                return newOrderRef.id;
              }).then((orderId) => {
                 setLoading(false);
                 navigation.replace('OrderDetail', {
                    order: {
                        id: orderId,
                        ...food,
                        totalPrice: price * quantity,
                        quantity: quantity,
                        status: 'pending',
                        orderType: 'pickup',
                        closingTime: storeClosingTime,
                        createdAt: new Date().toISOString()
                    }
                 });
              });

            } catch (error) {
              console.error(error);
              setLoading(false);
              Alert.alert('จองไม่สำเร็จ', typeof error === 'string' ? error : 'เกิดข้อผิดพลาด');
            }
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />
      <View style={styles.imageContainer}>
         {food.imageUrl ? ( <Image source={{ uri: food.imageUrl }} style={styles.foodImage} /> ) : ( <View style={styles.placeholderImage}><Ionicons name="fast-food" size={80} color="#ccc" /></View> )}
         <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}><Ionicons name="chevron-back" size={24} color="#000" /></TouchableOpacity>
         <TouchableOpacity style={styles.heartButton} onPress={handleToggleFavorite}>
            <Ionicons name={isFavorite ? "heart" : "heart-outline"} size={24} color={isFavorite ? "#ef4444" : "#000"} />
         </TouchableOpacity>
         {discountPercent > 0 && ( <View style={styles.discountBadge}><Text style={styles.discountText}>ลด {discountPercent}%</Text><Ionicons name="flame" size={16} color="#000" /></View> )}
      </View>
      <ScrollView style={styles.contentContainer} showsVerticalScrollIndicator={false}>
         <View style={styles.headerSection}>
            <View style={styles.titleRow}>
                <Text style={styles.foodName}>{food.name}</Text>
                <View style={styles.priceBlock}>
                    <Text style={styles.currentPrice}>{price} ฿</Text>
                    {originalPrice > price && ( <Text style={styles.originalPrice}>{originalPrice} ฿</Text> )}
                </View>
            </View>
            <View style={styles.storeRow}>
                <Ionicons name="storefront-outline" size={16} color="#666" />
                <Text style={styles.storeName}>{food.storeName || 'ชื่อร้านค้า'}</Text>
            </View>
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
            <View style={styles.statItem}>
                <Ionicons name="restaurant-outline" size={20} color="#333" />
                <Text style={styles.statLabel}>คงเหลือ</Text>
                <Text style={styles.statValue}>{food.quantity} ชุด</Text>
            </View>
            <View style={styles.statItem}>
                <Ionicons name="time-outline" size={20} color="#333" />
                <Text style={styles.statLabel}>รับได้ถึง</Text>
                <Text style={styles.statValueTime}>{closingTimeDisplay}</Text>
            </View>
            <View style={styles.statItem}>
                <Ionicons name="location-outline" size={20} color="#333" />
                <Text style={styles.statLabel}>ระยะทาง</Text>
                <Text style={styles.statValue}>0.8 Km</Text>
            </View>
         </View>

         <View style={styles.locationSection}>
            <Text style={styles.sectionTitle}>ที่อยู่ร้าน</Text>
            <View style={styles.mapCard}><View style={styles.mapPlaceholder}><Ionicons name="location-sharp" size={30} color="#333" /><Text style={styles.mapText}>{food.storeName}</Text></View><Text style={styles.addressText}>123 ถนนตัวอย่าง กทม.</Text></View>
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
  backButton: { position: 'absolute', top: 50, left: 20, width: 40, height: 40, borderRadius: 20, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', elevation: 2 },
  heartButton: { position: 'absolute', top: 50, right: 20, width: 40, height: 40, borderRadius: 20, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', elevation: 2 },
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
  statValueTime: { fontSize: 11, fontWeight: '600', color: '#000', marginTop: 2, textAlign: 'center' },
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
  bookButtonText: { fontSize: 16, fontWeight: 'bold', color: '#fff' },
});