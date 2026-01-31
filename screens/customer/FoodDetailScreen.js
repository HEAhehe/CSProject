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
// ✅ ใช้ getDoc เพื่อดึงข้อมูลร้าน
import { collection, addDoc, doc, onSnapshot, setDoc, deleteDoc, runTransaction, getDoc } from 'firebase/firestore';

const { width } = Dimensions.get('window');

export default function FoodDetailScreen({ navigation, route }) {
  const { food } = route.params;
  const [loading, setLoading] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false);
  const [quantity, setQuantity] = useState(1);

  // State สำหรับเวลาปิดร้าน
  const [storeClosingTime, setStoreClosingTime] = useState(null);
  const [closingTimeDisplay, setClosingTimeDisplay] = useState("กำลังโหลด...");

  // ✅ เพิ่ม currentTime ให้เดินทุกวินาที
  const [currentTime, setCurrentTime] = useState(new Date());

  const originalPrice = Number(food.originalPrice) || 0;
  const price = Number(food.discountPrice) || Number(food.price) || 0;
  const discountPercent = originalPrice > 0 ? Math.round(((originalPrice - price) / originalPrice) * 100) : 0;

  // ✅ Timer Loop (สำคัญ! ต้องมีอันนี้เวลานับถอยหลังถึงจะเดิน)
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // 1. ดึงข้อมูลร้านค้า & เช็ค Favorite
  useEffect(() => {
    const user = auth.currentUser;
    // ใช้ storeId จากอาหาร
    const storeId = food.storeId;

    const fetchStoreData = async () => {
        if (storeId) {
            try {
                // ✅ 1. ดึงจากกล่อง 'stores' (ตาม Database จริง)
                let storeDoc = await getDoc(doc(db, 'stores', storeId));

                if (storeDoc.exists()) {
                    const data = storeDoc.data();
                    // ✅ 2. ใช้ 'closeTime' (ตาม Database จริง)
                    setStoreClosingTime(data.closeTime || data.closingTime || "20:00");
                } else {
                    // Fallback: ลองหาใน users เผื่อเป็นระบบเก่า
                    storeDoc = await getDoc(doc(db, 'users', storeId));
                    if (storeDoc.exists()) {
                        const data = storeDoc.data();
                        setStoreClosingTime(data.closeTime || data.closingTime || "20:00");
                    } else {
                        setStoreClosingTime("20:00");
                    }
                }
            } catch (error) {
                console.error("Error fetching store data:", error);
                setStoreClosingTime("20:00");
            }
        }
    };

    fetchStoreData();

    if (user && storeId) {
      const favRef = doc(db, 'users', user.uid, 'favorites', storeId);
      const unsubscribe = onSnapshot(favRef, (docSnapshot) => setIsFavorite(docSnapshot.exists()));
      return () => unsubscribe();
    }
  }, [food]);

  // 2. ระบบคำนวณเวลานับถอยหลัง (ใช้ currentTime ที่เดินทุกวิ)
  useEffect(() => {
    if (!storeClosingTime) return;

    const calculateTimeLeft = () => {
      const now = currentTime;
      let closingDate = new Date();

      // แปลง String "23:00" เป็น Date Object
      if (typeof storeClosingTime === 'string' && storeClosingTime.includes(':')) {
          const [hours, minutes] = storeClosingTime.split(':').map(Number);
          closingDate.setHours(hours, minutes, 0, 0);
      } else {
          setClosingTimeDisplay(`${storeClosingTime} น.`);
          return;
      }

      // ถ้าเลยเวลาปิดแล้ว
      if (now > closingDate) {
        setClosingTimeDisplay(`${storeClosingTime} น. (ปิดแล้ว 😴)`);
        return;
      }

      // คำนวณเวลาที่เหลือ
      const diffMs = closingDate - now;
      const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));
      const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
      const diffSecs = Math.floor((diffMs % (1000 * 60)) / 1000); // วินาที

      // ฟอร์แมตเลข 0 นำหน้า
      const fmt = (n) => n < 10 ? `0${n}` : n;

      let countdownText = "";
      if (diffHrs > 0) {
          countdownText = `${diffHrs} ชม. ${diffMins} นาที`;
      } else {
          // แสดงนาที:วินาที
          countdownText = `${fmt(diffMins)}:${fmt(diffSecs)} นาที`;
      }

      setClosingTimeDisplay(`${storeClosingTime} น. (อีก ${countdownText})`);
    };

    calculateTimeLeft();
  }, [storeClosingTime, currentTime]);

  const handleToggleFavorite = async () => { /* ... Code เดิม ... */ const user = auth.currentUser; if (!user) return Alert.alert('กรุณาเข้าสู่ระบบ'); const storeId = food.storeId || food.userId; if (!storeId) return; const favRef = doc(db, 'users', user.uid, 'favorites', storeId); try { if (isFavorite) await deleteDoc(favRef); else await setDoc(favRef, { storeId, storeName: food.storeName || 'ร้านค้า', savedAt: new Date().toISOString() }); } catch (error) { console.error(error); } };
  const increaseQty = () => { if (quantity < food.quantity) setQuantity(quantity + 1); };
  const decreaseQty = () => { if (quantity > 1) setQuantity(quantity - 1); };
  const handleAddToCart = async () => { /* ... Code เดิม ... */ const user = auth.currentUser; if (!user) return Alert.alert('กรุณาเข้าสู่ระบบ'); setLoading(true); try { await addDoc(collection(db, 'users', user.uid, 'cart'), { foodId: food.id, foodName: food.name, price: price, originalPrice: originalPrice, quantity: quantity, storeName: food.storeName || 'ร้านค้า', storeId: food.storeId || food.userId, imageUrl: food.imageUrl, addedAt: new Date().toISOString() }); Alert.alert('สำเร็จ', 'เพิ่มลงตระกร้าแล้ว 🛒', [ { text: 'ซื้อต่อ' }, { text: 'ไปตระกร้า', onPress: () => navigation.navigate('Cart') } ]); } catch (error) { Alert.alert('Error', 'ไม่สามารถเพิ่มลงตระกร้าได้'); } finally { setLoading(false); } };

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
                transaction.set(newOrderRef, {
                  userId: user.uid,
                  foodId: food.id,
                  foodName: food.name,
                  storeName: food.storeName || 'ร้านค้า',
                  storeId: food.storeId || food.userId,
                  totalPrice: price * quantity,
                  quantity: quantity,
                  status: 'pending',
                  orderType: 'pickup',
                  closingTime: storeClosingTime, // ✅ บันทึกเวลาปิดร้านจริงลงไป
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
                {/* ✅ แสดงเวลาที่ซิงค์มาจริง */}
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