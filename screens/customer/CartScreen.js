import React, { useState, useEffect, useMemo } from 'react';
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
  ActivityIndicator,
  Pressable
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
  increment // เพิ่ม increment สำหรับอัปเดตยอดสะสม
} from 'firebase/firestore';

export default function CartScreen({ navigation }) {
  const [cartItems, setCartItems] = useState([]);
  const [selectedItems, setSelectedItems] = useState(new Set());
  const [totalPrice, setTotalPrice] = useState(0);
  const [totalOriginalPrice, setTotalOriginalPrice] = useState(0);
  const [totalWeight, setTotalWeight] = useState(0); // ✅ เพิ่ม state สำหรับน้ำหนักรวม
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(true);

  // 1. Fetch Cart Items
  useEffect(() => {
    const user = auth.currentUser;
    if (user) {
      const cartRef = collection(db, 'users', user.uid, 'cart');
      const unsubscribe = onSnapshot(cartRef, (snapshot) => {
        const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setCartItems(items);
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

  // 2. Group Items by Store
  const groupedItems = useMemo(() => {
    const groups = {};
    cartItems.forEach(item => {
      const storeId = item.storeId || item.userId || 'unknown';
      if (!groups[storeId]) {
        groups[storeId] = {
          storeId,
          storeName: item.storeName || 'ร้านค้า',
          items: []
        };
      }
      groups[storeId].items.push(item);
    });
    return Object.values(groups);
  }, [cartItems]);

  // 3. Calculate Price & Weight
  useEffect(() => {
    const selected = cartItems.filter(item => selectedItems.has(item.id));
    const netTotal = selected.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const originalTotal = selected.reduce((sum, item) => sum + ((item.originalPrice || item.price) * item.quantity), 0);

    // ✅ คำนวณน้ำหนักรวม (ใช้ 0.4 kg ต่อชิ้นเป็นค่ามาตรฐาน)
    const weightTotal = selected.reduce((sum, item) => sum + (0.4 * item.quantity), 0);

    setTotalPrice(netTotal);
    setTotalOriginalPrice(originalTotal);
    setTotalWeight(weightTotal);
  }, [cartItems, selectedItems]);

  const toggleSelection = (id) => {
    const newSelected = new Set(selectedItems);
    if (newSelected.has(id)) newSelected.delete(id);
    else newSelected.add(id);
    setSelectedItems(newSelected);
  };

  const toggleStoreSelection = (storeItems) => {
    const newSelected = new Set(selectedItems);
    const allSelected = storeItems.every(item => selectedItems.has(item.id));
    storeItems.forEach(item => {
      if (allSelected) newSelected.delete(item.id);
      else newSelected.add(item.id);
    });
    setSelectedItems(newSelected);
  };

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
          const newSelected = new Set(selectedItems);
          newSelected.delete(id);
          setSelectedItems(newSelected);
      }}
    ]);
  };

  const handleCheckout = async () => {
    if (selectedItems.size === 0) {
        Alert.alert('แจ้งเตือน', 'กรุณาเลือกสินค้าที่ต้องการสั่งซื้อ');
        return;
    }

    const itemsToCheckout = cartItems.filter(item => selectedItems.has(item.id));

    Alert.alert('ยืนยันการสั่งซื้อ', `รวมทั้งหมด ${totalPrice} บาท (${itemsToCheckout.length} รายการ)`, [
      { text: 'ยกเลิก', style: 'cancel' },
      {
        text: 'สั่งเลย',
        onPress: async () => {
          setLoading(true);
          const user = auth.currentUser;

          try {
            const groupedByStore = itemsToCheckout.reduce((acc, item) => {
              const sId = item.storeId || item.userId;
              if (!acc[sId]) acc[sId] = [];
              acc[sId].push(item);
              return acc;
            }, {});

            for (const storeId in groupedByStore) {
              const itemsInOrder = groupedByStore[storeId];

              await runTransaction(db, async (transaction) => {
                const foodRefs = itemsInOrder.map(item => doc(db, 'food_items', item.foodId));
                const foodSnaps = await Promise.all(foodRefs.map(ref => transaction.get(ref)));

                foodSnaps.forEach((snap, index) => {
                  if (!snap.exists()) throw `สินค้า "${itemsInOrder[index].foodName}" ไม่มีในระบบ`;
                  if (snap.data().quantity < itemsInOrder[index].quantity) {
                    throw `สินค้า "${itemsInOrder[index].foodName}" เหลือไม่พอ`;
                  }
                });

                let closingTime = '20:00';
                const storeRef = doc(db, 'stores', storeId);
                const storeSnap = await transaction.get(storeRef);
                if (storeSnap.exists()) {
                   closingTime = storeSnap.data().closeTime || storeSnap.data().closingTime || '20:00';
                }

                itemsInOrder.forEach((item, index) => {
                  transaction.update(foodRefs[index], {
                    quantity: foodSnaps[index].data().quantity - item.quantity
                  });
                });

                const orderType = itemsInOrder[0].deliveryMethod || 'pickup';
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
                  foodName: itemsInOrder.length > 1 ? `${itemsInOrder[0].foodName} และอื่นๆ` : itemsInOrder[0].foodName,
                  totalPrice: itemsInOrder.reduce((sum, i) => sum + (i.price * i.quantity), 0),
                  quantity: itemsInOrder.reduce((sum, i) => sum + i.quantity, 0),
                  status: 'pending',
                  orderType: orderType,
                  closingTime: closingTime,
                  createdAt: new Date().toISOString()
                });
              });

              for (const item of itemsInOrder) {
                await deleteDoc(doc(db, 'users', user.uid, 'cart', item.id));
              }
            }

            setLoading(false);
            Alert.alert('สำเร็จ', `คุณช่วยโลกโดยการลดขยะอาหารไปได้ ${totalWeight.toFixed(1)} kg! 🥳`);
            navigation.navigate('Orders');

          } catch (error) {
            console.error(error);
            setLoading(false);
            Alert.alert('ข้อผิดพลาด', typeof error === 'string' ? error : 'สั่งซื้อไม่สำเร็จ');
          }
        }
      }
    ]);
  };

  const renderStoreCard = ({ item: group }) => {
    const isStoreSelected = group.items.every(item => selectedItems.has(item.id));

    return (
      <View style={styles.storeCardContainer}>
        <View style={styles.storeHeader}>
            <TouchableOpacity onPress={() => toggleStoreSelection(group.items)} style={styles.storeCheckbox}>
                <Ionicons
                    name={isStoreSelected ? "checkbox" : "square-outline"}
                    size={24}
                    color={isStoreSelected ? "#10b981" : "#9ca3af"}
                />
            </TouchableOpacity>
            <Ionicons name="storefront" size={18} color="#374151" style={{marginRight: 6}} />
            <Text style={styles.storeNameText}>{group.storeName}</Text>
        </View>

        <View style={styles.divider} />

        {group.items.map((item, index) => {
            const isSelected = selectedItems.has(item.id);
            const isDelivery = item.deliveryMethod === 'delivery';
            const hasDiscount = item.originalPrice > item.price;

            return (
                <View key={item.id}>
                    <View style={styles.itemRowContainer}>
                        <TouchableOpacity style={styles.checkboxArea} onPress={() => toggleSelection(item.id)}>
                            <Ionicons
                                name={isSelected ? "checkbox" : "square-outline"}
                                size={24}
                                color={isSelected ? "#10b981" : "#d1d5db"}
                            />
                        </TouchableOpacity>

                        <Pressable
                            style={styles.itemContent}
                            onPress={() => navigation.navigate('FoodDetail', { food: { ...item, id: item.foodId } })}
                        >
                            <Image source={item.imageUrl ? { uri: item.imageUrl } : { uri: 'https://via.placeholder.com/100' }} style={styles.itemImage} />

                            <View style={styles.itemInfo}>
                                <View>
                                    <View style={styles.titleRow}>
                                        <Text style={styles.itemName} numberOfLines={1}>{item.foodName}</Text>
                                        <TouchableOpacity style={styles.trashIcon} onPress={() => removeItem(item.id)}>
                                            <Ionicons name="trash-outline" size={20} color="#ef4444" />
                                        </TouchableOpacity>
                                    </View>

                                    <View style={[styles.methodBadge, isDelivery ? styles.badgeDelivery : styles.badgePickup]}>
                                        <Ionicons
                                            name={isDelivery ? "bicycle" : "storefront"}
                                            size={12}
                                            color={isDelivery ? "#c2410c" : "#15803d"}
                                        />
                                        <Text style={[styles.methodText, isDelivery ? styles.textDelivery : styles.textPickup]}>
                                            {isDelivery ? "จัดส่ง" : "รับเอง"}
                                        </Text>
                                    </View>
                                </View>

                                <View style={styles.priceRow}>
                                    <View style={styles.priceGroup}>
                                        <Text style={styles.itemPrice}>฿{item.price}</Text>
                                        {hasDiscount && (
                                            <Text style={styles.itemOriginalPrice}>฿{item.originalPrice}</Text>
                                        )}
                                    </View>

                                    <View style={styles.qtyContainer}>
                                        <TouchableOpacity style={styles.qtyButton} onPress={() => handleUpdateQuantity(item.id, item.foodId, item.quantity, -1)}>
                                            <Ionicons name="remove" size={16} color="#555" />
                                        </TouchableOpacity>
                                        <Text style={styles.qtyText}>{item.quantity}</Text>
                                        <TouchableOpacity style={styles.qtyButton} onPress={() => handleUpdateQuantity(item.id, item.foodId, item.quantity, 1)}>
                                            <Ionicons name="add" size={16} color="#555" />
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            </View>
                        </Pressable>
                    </View>
                    {index < group.items.length - 1 && <View style={styles.itemDivider} />}
                </View>
            );
        })}
      </View>
    );
  };

  if (initializing) return (<View style={styles.loadingContainer}><ActivityIndicator size="large" color="#10b981" /></View>);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#1f2937" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>ตะกร้าของฉัน ({cartItems.length})</Text>
        <View style={{width: 40}} />
      </View>

      <FlatList
        data={groupedItems} // ✅ แก้เป็นใช้ groupedItems เพื่อความสวยงาม
        renderItem={renderStoreCard}
        keyExtractor={item => item.storeId}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
            <View style={styles.emptyState}>
                <View style={styles.emptyIconBg}><Ionicons name="cart-outline" size={48} color="#9ca3af" /></View>
                <Text style={styles.emptyText}>ไม่มีสินค้าในตะกร้า</Text>
                <TouchableOpacity style={styles.browseButton} onPress={() => navigation.navigate('Home')}><Text style={styles.browseButtonText}>ไปช้อปเลย!</Text></TouchableOpacity>
            </View>
        }
      />

      {cartItems.length > 0 && (
          <View style={styles.footer}>
              <View style={styles.totalRow}>
                  <View>
                    <Text style={styles.totalLabel}>รวม ({selectedItems.size} รายการ)</Text>
                    {/* ✅ แสดงน้ำหนักที่จะลดได้ใน Footer */}
                    {totalWeight > 0 && (
                        <Text style={styles.weightSavingText}>ลด Food Waste ได้ {totalWeight.toFixed(1)} kg 🌍</Text>
                    )}
                  </View>
                  <View style={{alignItems: 'flex-end'}}>
                      {totalOriginalPrice > totalPrice && (
                          <Text style={styles.totalOriginalValue}>฿{totalOriginalPrice}</Text>
                      )}
                      <Text style={styles.totalValue}>฿{totalPrice}</Text>
                  </View>
              </View>
              <TouchableOpacity
                style={[styles.checkoutButton, (loading || selectedItems.size === 0) && { opacity: 0.7, backgroundColor: '#9ca3af' }]}
                onPress={handleCheckout}
                disabled={loading || selectedItems.size === 0}
              >
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
  listContent: { padding: 10, paddingBottom: 120 },
  storeCardContainer: { backgroundColor: '#fff', borderRadius: 16, padding: 15, marginBottom: 15, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 3 },
  storeHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  storeCheckbox: { marginRight: 8 },
  storeNameText: { fontSize: 16, fontWeight: 'bold', color: '#1f2937' },
  divider: { height: 1, backgroundColor: '#f3f4f6', marginBottom: 15 },
  itemDivider: { height: 1, backgroundColor: '#f3f4f6', marginVertical: 12, marginLeft: 35 },
  itemRowContainer: { flexDirection: 'row', alignItems: 'center' },
  checkboxArea: { marginRight: 5 },
  itemContent: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  itemImage: { width: 80, height: 80, borderRadius: 12, backgroundColor: '#f3f4f6', marginRight: 12 },
  itemInfo: { flex: 1, justifyContent: 'space-between', height: 80 },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between' },
  itemName: { fontSize: 15, fontWeight: 'bold', color: '#1f2937', flex: 1 },
  trashIcon: { padding: 4 },
  methodBadge: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, gap: 4, marginTop: 2 },
  badgeDelivery: { backgroundColor: '#ffedd5' },
  badgePickup: { backgroundColor: '#dcfce7' },
  methodText: { fontSize: 10, fontWeight: 'bold' },
  textDelivery: { color: '#c2410c' },
  textPickup: { color: '#15803d' },
  priceRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  priceGroup: { flexDirection: 'row', alignItems: 'baseline', gap: 4 },
  itemPrice: { fontSize: 17, fontWeight: 'bold', color: '#10b981' },
  itemOriginalPrice: { fontSize: 11, color: '#9ca3af', textDecorationLine: 'line-through' },
  qtyContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f3f4f6', borderRadius: 20, padding: 2 },
  qtyButton: { width: 24, height: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff', borderRadius: 12, elevation: 1 },
  qtyText: { fontSize: 14, fontWeight: 'bold', color: '#333', marginHorizontal: 8 },
  emptyState: { alignItems: 'center', marginTop: 80, paddingHorizontal: 40 },
  emptyIconBg: { width: 100, height: 100, borderRadius: 50, backgroundColor: '#f3f4f6', alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  emptyText: { fontSize: 18, fontWeight: 'bold', color: '#374151', marginBottom: 20 },
  browseButton: { backgroundColor: '#1f2937', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 25 },
  browseButtonText: { color: '#fff', fontWeight: '600' },
  footer: { padding: 20, backgroundColor: '#fff', borderTopWidth: 1, borderColor: '#f3f4f6', position: 'absolute', bottom: 0, left: 0, right: 0, elevation: 10 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  totalLabel: { fontSize: 14, color: '#6b7280' },
  weightSavingText: { fontSize: 12, color: '#10b981', fontWeight: '600' },
  totalValue: { fontSize: 24, fontWeight: 'bold', color: '#1f2937' },
  totalOriginalValue: { fontSize: 12, color: '#9ca3af', textDecorationLine: 'line-through' },
  checkoutButton: { backgroundColor: '#10b981', paddingVertical: 16, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  checkoutText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
});