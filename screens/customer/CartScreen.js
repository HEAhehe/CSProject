import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Platform,
  FlatList,
  TouchableOpacity,
  Image,
  StatusBar,
  Alert,
  ActivityIndicator
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { db, auth } from '../../firebase.config';
import {
  collection,
  onSnapshot,
  deleteDoc,
  updateDoc,
  doc,
  runTransaction,
  getDoc,
  addDoc
} from 'firebase/firestore';

export default function CartScreen({ navigation }) {
  const [cartItems, setCartItems] = useState([]);
  const [totalPrice, setTotalPrice] = useState(0);
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    const user = auth.currentUser;
    if (user) {
      const cartRef = collection(db, 'users', user.uid, 'cart');
      const unsubscribe = onSnapshot(cartRef, (snapshot) => {
        const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setCartItems(items);
        const total = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        setTotalPrice(total);
        setInitializing(false);
      }, (error) => {
        console.error(error);
        setInitializing(false);
      });
      return () => unsubscribe();
    } else {
      setInitializing(false);
    }
  }, []);

  const handleUpdateQuantity = async (cartItemId, foodId, currentQty, change) => {
    const newQty = currentQty + change;
    if (newQty < 1) return;
    try {
        if (change > 0) {
            const foodSnap = await getDoc(doc(db, 'food_items', foodId));
            if (foodSnap.exists() && newQty > (foodSnap.data().quantity || 0)) {
                Alert.alert('เพิ่มจำนวนไม่ได้', `สินค้าเหลือเพียง ${foodSnap.data().quantity} ชิ้น`);
                return;
            }
        }
        const user = auth.currentUser;
        if (user) await updateDoc(doc(db, 'users', user.uid, 'cart', cartItemId), { quantity: newQty });
    } catch (error) { console.error(error); }
  };

  const removeItem = async (id) => {
    Alert.alert('ยืนยัน', 'ต้องการลบรายการนี้หรือไม่?', [
      { text: 'ยกเลิก', style: 'cancel' },
      { text: 'ลบ', style: 'destructive', onPress: async () => {
          const user = auth.currentUser;
          await deleteDoc(doc(db, 'users', user.uid, 'cart', id));
      }}
    ]);
  };

  // ✅ ฟังก์ชัน Checkout แบบรวมออเดอร์แยกตามร้านค้า
  const handleCheckout = async () => {
    if (cartItems.length === 0) return;

    Alert.alert('ยืนยันการสั่งซื้อ', `รวมทั้งหมด ${totalPrice} บาท`, [
      { text: 'ยกเลิก', style: 'cancel' },
      {
        text: 'สั่งเลย',
        onPress: async () => {
          setLoading(true);
          const user = auth.currentUser;

          try {
            // 1. ✅ จัดกลุ่มสินค้าตามร้านค้า (Group by Store)
            const groupedByStore = cartItems.reduce((acc, item) => {
              const sId = item.storeId || item.userId;
              if (!acc[sId]) acc[sId] = [];
              acc[sId].push(item);
              return acc;
            }, {});

            // 2. ✅ วนลูปสร้างออเดอร์ตามจำนวนร้านค้าที่สั่ง
            for (const storeId in groupedByStore) {
              const itemsInOrder = groupedByStore[storeId];

              await runTransaction(db, async (transaction) => {
                // ตรวจสอบสต็อกสินค้าทุกชิ้นในร้านนี้ก่อน
                const foodRefs = itemsInOrder.map(item => doc(db, 'food_items', item.foodId));
                const foodSnaps = await Promise.all(foodRefs.map(ref => transaction.get(ref)));

                foodSnaps.forEach((snap, index) => {
                  if (!snap.exists()) throw `สินค้า "${itemsInOrder[index].foodName}" ไม่มีในระบบ`;
                  if (snap.data().quantity < itemsInOrder[index].quantity) {
                    throw `สินค้า "${itemsInOrder[index].foodName}" เหลือไม่พอ`;
                  }
                });

                // ดึงข้อมูลประเภทการส่งของร้าน (delivery หรือ pickup)
                let orderType = 'pickup';
                let closingTime = '20:00';
                const storeRef = doc(db, 'stores', storeId);
                const storeSnap = await transaction.get(storeRef);

                if (storeSnap.exists()) {
                   // ✅ เช็ค deliveryMethod จาก DB (image_c4cde6.jpg)
                   const method = storeSnap.data().deliveryMethod;
                   orderType = method === 'delivery' ? 'delivery' : 'pickup';
                   closingTime = storeSnap.data().closeTime || storeSnap.data().closingTime || '20:00';
                }

                // ตัดสต็อกสินค้า
                itemsInOrder.forEach((item, index) => {
                  transaction.update(foodRefs[index], {
                    quantity: foodSnaps[index].data().quantity - item.quantity
                  });
                });

                // สร้างเอกสารออเดอร์ใหม่ (1 ร้าน = 1 ออเดอร์)
                const newOrderRef = doc(collection(db, 'orders'));
                transaction.set(newOrderRef, {
                  userId: user.uid,
                  storeId: storeId,
                  storeName: itemsInOrder[0].storeName || 'ร้านค้า',
                  items: itemsInOrder.map(i => ({
                    foodId: i.foodId,
                    foodName: i.foodName,
                    quantity: i.quantity,
                    price: i.price,
                    imageUrl: i.imageUrl || null
                  })),
                  // ✅ เก็บชื่อสินค้าตัวแรกไว้โชว์ในหน้า List (Fallback)
                  foodName: itemsInOrder.length > 1 ? `${itemsInOrder[0].foodName} และอื่นๆ` : itemsInOrder[0].foodName,
                  totalPrice: itemsInOrder.reduce((sum, i) => sum + (i.price * i.quantity), 0),
                  quantity: itemsInOrder.reduce((sum, i) => sum + i.quantity, 0),
                  status: 'pending',
                  orderType: orderType, // ✅ D หรือ P จะถูกกำหนดที่หน้าแสดงผลตาม Type นี้
                  closingTime: closingTime,
                  createdAt: new Date().toISOString()
                });
              });

              // ลบสินค้าที่สั่งแล้วออกจากตะกร้า
              for (const item of itemsInOrder) {
                await deleteDoc(doc(db, 'users', user.uid, 'cart', item.id));
              }
            }

            setLoading(false);
            Alert.alert('สำเร็จ', 'สั่งซื้อเรียบร้อยแล้ว! 🥳');
            navigation.navigate('Orders');

          } catch (error) {
            console.error(error);
            setLoading(false);
            Alert.alert('ข้อผิดพลาด', typeof error === 'string' ? error : 'สต็อกสินค้าไม่พอ หรือระบบขัดข้อง');
          }
        }
      }
    ]);
  };

  const renderItem = ({ item }) => (
    <View style={styles.itemContainer}>
        <Image source={item.imageUrl ? { uri: item.imageUrl } : { uri: 'https://via.placeholder.com/100' }} style={styles.itemImage} />
        <View style={styles.itemInfo}>
            <View>
                <Text style={styles.itemName} numberOfLines={1}>{item.foodName}</Text>
                <View style={styles.storeRow}><Ionicons name="storefront" size={12} color="#6b7280" /><Text style={styles.itemStore} numberOfLines={1}>{item.storeName || 'ร้านค้า'}</Text></View>
            </View>
            <View style={styles.priceRow}>
                <Text style={styles.itemPrice}>฿{item.price}</Text>
                <View style={styles.qtyContainer}>
                    <TouchableOpacity style={styles.qtyButton} onPress={() => handleUpdateQuantity(item.id, item.foodId, item.quantity, -1)}><Ionicons name="remove" size={16} color="#555" /></TouchableOpacity>
                    <Text style={styles.qtyText}>{item.quantity}</Text>
                    <TouchableOpacity style={styles.qtyButton} onPress={() => handleUpdateQuantity(item.id, item.foodId, item.quantity, 1)}><Ionicons name="add" size={16} color="#555" /></TouchableOpacity>
                </View>
            </View>
        </View>
        <TouchableOpacity onPress={() => removeItem(item.id)} style={styles.removeButton}><Ionicons name="trash-outline" size={20} color="#ef4444" /></TouchableOpacity>
    </View>
  );

  if (initializing) return (<View style={styles.loadingContainer}><ActivityIndicator size="large" color="#10b981" /></View>);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}><Ionicons name="arrow-back" size={24} color="#1f2937" /></TouchableOpacity>
        <Text style={styles.headerTitle}>ตระกร้าของฉัน ({cartItems.length})</Text>
        <View style={{width: 40}} />
      </View>

      <FlatList
        data={cartItems}
        renderItem={renderItem}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
            <View style={styles.emptyState}>
                <View style={styles.emptyIconBg}><Ionicons name="cart-outline" size={48} color="#9ca3af" /></View>
                <Text style={styles.emptyText}>ไม่มีสินค้าในตระกร้า</Text>
                <TouchableOpacity style={styles.browseButton} onPress={() => navigation.navigate('Home')}><Text style={styles.browseButtonText}>ไปช้อปเลย!</Text></TouchableOpacity>
            </View>
        }
      />

      {cartItems.length > 0 && (
          <View style={styles.footer}>
              <View style={styles.totalRow}><Text style={styles.totalLabel}>ยอดรวมทั้งหมด</Text><Text style={styles.totalValue}>฿{totalPrice}</Text></View>
              <TouchableOpacity style={[styles.checkoutButton, loading && { opacity: 0.7 }]} onPress={handleCheckout} disabled={loading}>
                  {loading ? <ActivityIndicator color="#fff" /> : <><Text style={styles.checkoutText}>สั่งซื้อสินค้า</Text><Ionicons name="arrow-forward" size={20} color="#fff" /></>}
              </TouchableOpacity>
          </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: Platform.OS === 'ios' ? 60 : 60, paddingBottom: 15, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#1f2937' },
  backButton: { padding: 4 },
  listContent: { padding: 20, paddingBottom: 120 },
  itemContainer: { flexDirection: 'row', backgroundColor: '#fff', borderRadius: 16, padding: 12, marginBottom: 12, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  itemImage: { width: 70, height: 70, borderRadius: 12, backgroundColor: '#f3f4f6', marginRight: 16 },
  itemInfo: { flex: 1, justifyContent: 'space-between', height: 70, paddingVertical: 2 },
  itemName: { fontSize: 16, fontWeight: 'bold', color: '#1f2937', marginBottom: 4 },
  storeRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  itemStore: { fontSize: 12, color: '#6b7280' },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 15, marginTop: 'auto' },
  itemPrice: { fontSize: 16, fontWeight: 'bold', color: '#10b981' },
  qtyContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f3f4f6', borderRadius: 20, paddingHorizontal: 4, paddingVertical: 2 },
  qtyButton: { width: 24, height: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff', borderRadius: 12, elevation: 1 },
  qtyText: { fontSize: 14, fontWeight: 'bold', color: '#333', marginHorizontal: 10 },
  removeButton: { padding: 10, backgroundColor: '#fee2e2', borderRadius: 10, marginLeft: 10 },
  emptyState: { alignItems: 'center', marginTop: 80, paddingHorizontal: 40 },
  emptyIconBg: { width: 100, height: 100, borderRadius: 50, backgroundColor: '#f3f4f6', alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  emptyText: { fontSize: 18, fontWeight: 'bold', color: '#374151', marginBottom: 20 },
  browseButton: { backgroundColor: '#1f2937', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 25 },
  browseButtonText: { color: '#fff', fontWeight: '600' },
  footer: { padding: 20, backgroundColor: '#fff', borderTopWidth: 1, borderColor: '#f3f4f6', position: 'absolute', bottom: 0, left: 0, right: 0, elevation: 10, shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.05, shadowRadius: 6 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  totalLabel: { fontSize: 14, color: '#6b7280' },
  totalValue: { fontSize: 24, fontWeight: 'bold', color: '#1f2937' },
  checkoutButton: { backgroundColor: '#10b981', paddingVertical: 16, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, shadowColor: '#10b981', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
  checkoutText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
});