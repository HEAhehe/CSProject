import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  StatusBar,
  Alert,
  ActivityIndicator
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { db, auth } from '../../firebase.config';
// ✅ Import เพิ่ม: runTransaction, getDoc
import { collection, onSnapshot, deleteDoc, doc, runTransaction, getDoc } from 'firebase/firestore';

export default function CartScreen({ navigation }) {
  const [cartItems, setCartItems] = useState([]);
  const [totalPrice, setTotalPrice] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const user = auth.currentUser;
    if (user) {
      const cartRef = collection(db, 'users', user.uid, 'cart');
      const unsubscribe = onSnapshot(cartRef, (snapshot) => {
        const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setCartItems(items);

        const total = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        setTotalPrice(total);
      });
      return () => unsubscribe();
    }
  }, []);

  const removeItem = async (id) => {
    Alert.alert('ยืนยัน', 'ต้องการลบรายการนี้หรือไม่?', [
      { text: 'ยกเลิก', style: 'cancel' },
      {
        text: 'ลบ',
        style: 'destructive',
        onPress: async () => {
          const user = auth.currentUser;
          await deleteDoc(doc(db, 'users', user.uid, 'cart', id));
        }
      }
    ]);
  };

  const handleCheckout = async () => {
    if (cartItems.length === 0) return;

    Alert.alert('ยืนยันการสั่งซื้อ', `ยอดรวมทั้งหมด ${totalPrice} บาท`, [
      { text: 'ยกเลิก', style: 'cancel' },
      {
        text: 'สั่งเลย',
        onPress: async () => {
          setLoading(true);
          const user = auth.currentUser;

          try {
            for (const item of cartItems) {
              await runTransaction(db, async (transaction) => {
                // 1. เช็คสต็อกล่าสุด
                const foodRef = doc(db, 'food_items', item.foodId);
                const foodDoc = await transaction.get(foodRef);

                if (!foodDoc.exists()) throw `สินค้า "${item.foodName}" ถูกลบไปแล้ว`;
                const currentQty = foodDoc.data().quantity || 0;

                if (currentQty < item.quantity) {
                  throw `สินค้า "${item.foodName}" เหลือไม่พอ (เหลือ ${currentQty})`;
                }

                // 2. ✅ ดึงเวลาปิดร้านจริง (ใช้ Logic เดียวกับ HomeScreen)
                let closingTime = "20:00";
                // ใช้ storeId หรือ userId (เผื่อใน cart เก็บมาไม่ครบ)
                const targetStoreId = item.storeId || item.userId;

                if (targetStoreId) {
                    // หาใน stores ก่อน
                    const storeRef = doc(db, 'stores', targetStoreId);
                    const storeDoc = await transaction.get(storeRef);
                    if (storeDoc.exists()) {
                        closingTime = storeDoc.data().closeTime || storeDoc.data().closingTime || "20:00";
                    } else {
                        // Fallback ไป users
                        const userStoreRef = doc(db, 'users', targetStoreId);
                        const userStoreDoc = await transaction.get(userStoreRef);
                        if (userStoreDoc.exists()) {
                            closingTime = userStoreDoc.data().closeTime || userStoreDoc.data().closingTime || "20:00";
                        }
                    }
                }

                // 3. ตัดสต็อก
                transaction.update(foodRef, { quantity: currentQty - item.quantity });

                // 4. สร้าง Order
                const newOrderRef = doc(collection(db, 'orders'));
                transaction.set(newOrderRef, {
                  userId: user.uid,
                  foodId: item.foodId,
                  foodName: item.foodName,
                  storeName: item.storeName,
                  storeId: targetStoreId, // ใช้ ID ที่เช็คแล้ว
                  quantity: item.quantity,
                  totalPrice: item.price * item.quantity,
                  status: 'pending',
                  orderType: 'pickup',
                  closingTime: closingTime, // ✅ บันทึกเวลาปิดร้านจริง
                  createdAt: new Date().toISOString(),
                  imageUrl: item.imageUrl
                });
              });

              await deleteDoc(doc(db, 'users', user.uid, 'cart', item.id));
            }

            setLoading(false);
            Alert.alert('สำเร็จ', 'สั่งซื้อเรียบร้อยแล้ว!');
            navigation.navigate('Orders');

          } catch (error) {
            console.error(error);
            setLoading(false);
            Alert.alert('เกิดข้อผิดพลาด', typeof error === 'string' ? error : 'บางรายการสินค้าหมด หรือระบบขัดข้อง');
          }
        }
      }
    ]);
  };

  const renderItem = ({ item }) => (
    <View style={styles.itemContainer}>
        <Image
          source={item.imageUrl ? { uri: item.imageUrl } : { uri: 'https://via.placeholder.com/100' }}
          style={styles.itemImage}
        />

        <View style={styles.itemInfo}>
            <View>
                <Text style={styles.itemName} numberOfLines={1}>{item.foodName}</Text>
                <View style={styles.storeRow}>
                    <Ionicons name="storefront" size={12} color="#6b7280" />
                    <Text style={styles.itemStore} numberOfLines={1}>{item.storeName || 'ร้านค้า'}</Text>
                </View>
            </View>

            <View style={styles.priceRow}>
                <Text style={styles.itemPrice}>฿{item.price * item.quantity}</Text>
                <Text style={styles.itemQty}>x{item.quantity}</Text>
            </View>
        </View>

        <TouchableOpacity onPress={() => removeItem(item.id)} style={styles.removeButton}>
            <Ionicons name="trash-outline" size={20} color="#ef4444" />
        </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#1f2937" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>ตระกร้าของฉัน ({cartItems.length})</Text>
        <View style={{width: 40}} />
      </View>

      {/* Content */}
      <FlatList
        data={cartItems}
        renderItem={renderItem}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
            <View style={styles.emptyState}>
                <View style={styles.emptyIconBg}>
                    <Ionicons name="cart-outline" size={48} color="#9ca3af" />
                </View>
                <Text style={styles.emptyText}>ไม่มีสินค้าในตระกร้า</Text>
                <Text style={styles.emptySubText}>เลือกอาหารอร่อยๆ มาใส่ตระกร้าเลย!</Text>
                <TouchableOpacity style={styles.browseButton} onPress={() => navigation.navigate('Home')}>
                    <Text style={styles.browseButtonText}>ดูรายการอาหาร</Text>
                </TouchableOpacity>
            </View>
        }
      />

      {/* Footer Checkout */}
      {cartItems.length > 0 && (
          <View style={styles.footer}>
              <View style={styles.totalRow}>
                  <Text style={styles.totalLabel}>ยอดรวมทั้งหมด</Text>
                  <Text style={styles.totalValue}>฿{totalPrice}</Text>
              </View>

              <TouchableOpacity
                style={[styles.checkoutButton, loading && { opacity: 0.7 }]}
                onPress={handleCheckout}
                disabled={loading}
              >
                  {loading ? (
                      <ActivityIndicator color="#fff" />
                  ) : (
                      <>
                        <Text style={styles.checkoutText}>สั่งซื้อ ({cartItems.length})</Text>
                        <Ionicons name="arrow-forward" size={20} color="#fff" />
                      </>
                  )}
              </TouchableOpacity>
          </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6'
  },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#1f2937' },
  backButton: { padding: 4 },

  listContent: { padding: 20, paddingBottom: 100 },

  itemContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 12,
    marginBottom: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2
  },
  itemImage: {
    width: 70,
    height: 70,
    borderRadius: 12,
    backgroundColor: '#f3f4f6',
    marginRight: 16
  },
  itemInfo: { flex: 1, justifyContent: 'space-between', height: 70, paddingVertical: 2 },
  itemName: { fontSize: 16, fontWeight: 'bold', color: '#1f2937', marginBottom: 4 },
  storeRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  itemStore: { fontSize: 12, color: '#6b7280' },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 'auto' },
  itemPrice: { fontSize: 16, fontWeight: 'bold', color: '#10b981' },
  itemQty: { fontSize: 14, color: '#6b7280' },

  removeButton: {
    padding: 10,
    backgroundColor: '#fee2e2',
    borderRadius: 10,
    marginLeft: 10
  },

  emptyState: { alignItems: 'center', marginTop: 80, paddingHorizontal: 40 },
  emptyIconBg: {
    width: 100, height: 100, borderRadius: 50, backgroundColor: '#f3f4f6',
    alignItems: 'center', justifyContent: 'center', marginBottom: 20
  },
  emptyText: { fontSize: 18, fontWeight: 'bold', color: '#374151', marginBottom: 8 },
  emptySubText: { fontSize: 14, color: '#9ca3af', textAlign: 'center', marginBottom: 30 },
  browseButton: {
    backgroundColor: '#1f2937', paddingHorizontal: 24, paddingVertical: 12,
    borderRadius: 25
  },
  browseButtonText: { color: '#fff', fontWeight: '600' },

  footer: {
    padding: 20,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderColor: '#f3f4f6',
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.05,
    shadowRadius: 6
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16
  },
  totalLabel: { fontSize: 14, color: '#6b7280' },
  totalValue: { fontSize: 24, fontWeight: 'bold', color: '#1f2937' },

  checkoutButton: {
    backgroundColor: '#10b981',
    paddingVertical: 16,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4
  },
  checkoutText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
});