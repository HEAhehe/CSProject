import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Dimensions,
  Alert,
  ActivityIndicator,
  Modal,
  KeyboardAvoidingView,
  Platform,
  TextInput,
  Linking
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { db } from '../../firebase.config';
import { doc, onSnapshot, runTransaction, increment, getDoc, collection } from 'firebase/firestore';

const { width } = Dimensions.get('window');

const cancelReasonsList = [
  'สั่งผิดเมนู / สั่งผิดร้าน',
  'รอนานเกินไป (ร้านยังไม่ยืนยัน)',
  'เปลี่ยนใจ / ไม่ต้องการแล้ว',
  'ไม่สะดวกไปรับสินค้าแล้ว',
  'อื่นๆ (โปรดระบุ)'
];

export default function OrderDetailScreen({ navigation, route }) {
  const initialOrder = route.params?.order || {};

  const [currentOrder, setCurrentOrder] = useState(initialOrder);
  const [isItemsExpanded, setIsItemsExpanded] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);

  const [storePhone, setStorePhone] = useState(null);

  const [isCancelModalVisible, setIsCancelModalVisible] = useState(false);
  const [selectedReason, setSelectedReason] = useState('');
  const [customReason, setCustomReason] = useState('');

  useEffect(() => {
    if (!currentOrder?.id) return;

    const unsub = onSnapshot(doc(db, 'orders', currentOrder.id), (docSnap) => {
      if (docSnap.exists()) {
        setCurrentOrder({ id: docSnap.id, ...docSnap.data() });
      }
    });

    return () => unsub();
  }, [currentOrder?.id]);

  useEffect(() => {
    if (currentOrder?.storeId) {
      const fetchStorePhone = async () => {
        try {
          const storeSnap = await getDoc(doc(db, 'stores', currentOrder.storeId));
          if (storeSnap.exists() && storeSnap.data().phoneNumber) {
            setStorePhone(storeSnap.data().phoneNumber);
          }
        } catch (error) {
          console.error("Error fetching store phone:", error);
        }
      };
      fetchStorePhone();
    }
  }, [currentOrder?.storeId]);

  const handleOpenCancelModal = () => {
    setSelectedReason('');
    setCustomReason('');
    setIsCancelModalVisible(true);
  };

  const submitCancel = async () => {
    if (!selectedReason) {
      Alert.alert('แจ้งเตือน', 'กรุณาเลือกเหตุผลการยกเลิก');
      return;
    }

    let finalReason = selectedReason;
    if (selectedReason === 'อื่นๆ (โปรดระบุ)') {
      if (!customReason.trim()) {
        Alert.alert('แจ้งเตือน', 'กรุณาระบุเหตุผลเพิ่มเติม');
        return;
      }
      finalReason = customReason.trim();
    }

    setIsCancelModalVisible(false);
    await executeCancelOrder(finalReason);
  };

  const executeCancelOrder = async (reasonToSave) => {
        setIsCancelling(true);
        try {
            await runTransaction(db, async (transaction) => {
                const orderRef = doc(db, 'orders', currentOrder.id);
                const orderDoc = await transaction.get(orderRef);

                if (!orderDoc.exists()) throw "ไม่พบคำสั่งซื้อนี้ในระบบ";
                if (orderDoc.data().status !== 'pending') throw "ไม่สามารถยกเลิกได้ เนื่องจากร้านค้าเริ่มดำเนินการแล้ว";

                const items = orderDoc.data().items || [];
                const orderWeight = orderDoc.data().totalOrderWeight || 0;
                const userId = orderDoc.data().userId;
                const storeId = orderDoc.data().storeId;

                const foodDocsToUpdate = [];
                for (let item of items) {
                    const foodRef = doc(db, 'food_items', item.foodId);
                    const foodDoc = await transaction.get(foodRef);
                    if (foodDoc.exists()) {
                        foodDocsToUpdate.push({ ref: foodRef, returnQty: item.quantity });
                    }
                }

                let userRef = null;
                let userDoc = null;
                if (userId && orderWeight > 0) {
                    userRef = doc(db, 'users', userId);
                    userDoc = await transaction.get(userRef);
                }

                for (let fData of foodDocsToUpdate) {
                    transaction.update(fData.ref, {
                        quantity: increment(fData.returnQty)
                    });
                }

                if (userDoc && userDoc.exists()) {
                    transaction.update(userRef, {
                        totalWeightSaved: increment(-orderWeight)
                    });
                }

                transaction.update(orderRef, {
                    status: 'cancelled',
                    cancelReason: reasonToSave,
                    cancelledBy: 'customer',
                    cancelledAt: new Date().toISOString()
                });

                if (storeId) {
                    const notifRef = doc(collection(db, 'notifications'));
                    transaction.set(notifRef, {
                        userId: storeId,
                        title: 'ลูกค้ายกเลิกออเดอร์ ❌',
                        message: `ออเดอร์ #${currentOrder.id.slice(0, 6).toUpperCase()} ถูกลูกค้ายกเลิก (สาเหตุ: ${reasonToSave}) จำนวนสินค้าถูกคืนเข้าสต๊อกเรียบร้อยแล้ว`,
                        type: 'order_cancelled',
                        orderId: currentOrder.id,
                        isRead: false,
                        createdAt: new Date().toISOString()
                    });
                }
            });

            Alert.alert('สำเร็จ', 'ยกเลิกคำสั่งซื้อเรียบร้อยแล้ว');
        } catch (error) {
            console.error("Cancel Error:", error);
            Alert.alert('เกิดข้อผิดพลาด', typeof error === 'string' ? error : 'ไม่สามารถยกเลิกคำสั่งซื้อได้');
        } finally {
            setIsCancelling(false);
        }
    };

  const handleCallStore = () => {
    if (storePhone) {
      Linking.openURL(`tel:${storePhone}`);
    } else {
      Alert.alert('แจ้งเตือน', 'ขออภัย ไม่พบเบอร์โทรติดต่อของร้านค้านี้');
    }
  };

  if (!currentOrder || !currentOrder.id) {
    return (
      <View style={styles.container}>
        <View style={styles.errorContainer}>
            <Ionicons name="alert-circle-outline" size={60} color="#ccc" />
            <Text style={styles.errorText}>ไม่พบข้อมูลคำสั่งซื้อ</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Home')}>
                <Text style={styles.backLink}>กลับหน้าหลัก</Text>
            </TouchableOpacity>
        </View>
      </View>
    );
  }

  const getFormattedOrderId = (orderId, type) => {
    if (!orderId) return 'N/A';
    const shortId = orderId.slice(0, 6).toUpperCase();
    const prefix = type === 'delivery' ? 'D' : 'P';
    return `${prefix}-${shortId}`;
  };

  const formattedId = getFormattedOrderId(currentOrder.id, currentOrder.orderType);

  const getStatusDisplay = (status) => {
    switch (status) {
      case 'completed':
        return { color: '#059669', icon: 'checkmark-circle', title: 'รับอาหารแล้ว!', subtitle: 'ขอบคุณที่ช่วยโลกไปกับเรา 🌍' };
      case 'confirmed':
        return { color: '#3b82f6', icon: 'restaurant', title: 'ร้านค้ายืนยันแล้ว!', subtitle: 'ร้านค้ากำลังเตรียมอาหาร หรือรอคุณไปรับ' };
      case 'cancelled':
        return { color: '#ef4444', icon: 'close-circle', title: 'ออเดอร์ถูกยกเลิก', subtitle: 'ขออภัยในความไม่สะดวก' };
      case 'pending':
      default:
        return { color: '#f59e0b', icon: 'time', title: 'รอดำเนินการ...', subtitle: 'กำลังรอร้านค้ายืนยันออเดอร์ของคุณ' };
    }
  };

  const statusInfo = getStatusDisplay(currentOrder.status);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      <View style={styles.header}>
            <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
                <Ionicons name="chevron-back" size={24} color="#1f2937" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>ใบเสร็จคำสั่งซื้อ</Text>
            <View style={{width: 40}} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>

        <View style={styles.successSection}>
            <View style={[styles.successIconCircle, { backgroundColor: statusInfo.color }]}>
                <Ionicons name={statusInfo.icon} size={40} color="#fff" />
            </View>
            <Text style={[styles.successTitle, { color: statusInfo.color }]}>
              {statusInfo.title}
            </Text>
            <Text style={styles.successSubtitle}>{statusInfo.subtitle}</Text>
        </View>

        {currentOrder.status === 'cancelled' && currentOrder.cancelReason && (
            <View style={styles.cancelAlertBox}>
                <View style={styles.cancelAlertIcon}>
                    <Ionicons name="warning" size={28} color="#ef4444" />
                </View>
                <View style={styles.cancelAlertContent}>
                    <Text style={styles.cancelAlertLabel}>
                      {currentOrder.cancelledBy === 'store'
                        ? 'ร้านค้ายกเลิกคำสั่งซื้อ (สาเหตุ):'
                        : currentOrder.cancelledBy === 'customer'
                        ? 'คุณยกเลิกคำสั่งซื้อนี้ (สาเหตุ):'
                        : 'สาเหตุการยกเลิก:'}
                    </Text>
                    <Text style={styles.cancelAlertText}>{currentOrder.cancelReason}</Text>
                </View>
            </View>
        )}

        <View style={styles.orderIdCard}>
            <Text style={styles.orderIdLabel}>
              Order ID ({currentOrder.orderType === 'delivery' ? 'จัดส่ง' : 'รับเอง'})
            </Text>
            <View style={styles.orderIdRow}>
                <Text style={styles.orderIdText}>{formattedId}</Text>
            </View>
        </View>

        <View style={styles.detailsSection}>
            <Text style={styles.sectionHeader}>รายละเอียด</Text>

            <TouchableOpacity
                style={[styles.detailRow, isItemsExpanded && styles.detailRowActive]}
                onPress={() => setIsItemsExpanded(!isItemsExpanded)}
            >
                <View style={styles.iconBox}>
                    <Ionicons name="restaurant-outline" size={20} color="#10b981" />
                </View>
                <View style={styles.detailTextContainer}>
                    <Text style={styles.detailMainText}>{currentOrder.foodName}</Text>
                    <Text style={styles.detailSubText}>{currentOrder.quantity} รายการ (แตะเพื่อดูรายละเอียด)</Text>
                </View>
                <Ionicons name={isItemsExpanded ? "chevron-up" : "chevron-down"} size={20} color="#9ca3af" />
            </TouchableOpacity>

            {isItemsExpanded && currentOrder.items && (
                <View style={styles.expandedItemsBox}>
                    {currentOrder.items.map((item, index) => (
                        <View key={index} style={styles.itemSmallRow}>
                            <Text style={styles.itemSmallName}>• {item.foodName}</Text>
                            <Text style={styles.itemSmallQty}>x{item.quantity}</Text>
                            <Text style={styles.itemSmallPrice}>฿{item.price * item.quantity}</Text>
                        </View>
                    ))}
                </View>
            )}

            <View style={styles.detailRow}>
                <View style={styles.iconBox}><Ionicons name="cash-outline" size={20} color="#555" /></View>
                <View style={styles.detailTextContainer}>
                    <Text style={styles.detailMainText}>ยอดชำระรวม : {currentOrder.totalPrice} ฿</Text>
                    <Text style={styles.detailSubText}>ชำระเงินปลายทาง / ที่หน้าร้าน</Text>
                </View>
            </View>

            {/* แถวข้อมูลร้านค้า */}
            <View style={styles.detailRow}>
                <View style={styles.iconBox}><Ionicons name="storefront-outline" size={20} color="#555" /></View>
                <View style={styles.detailTextContainer}>
                    <Text style={styles.detailMainText}>{currentOrder.storeName}</Text>
                    <Text style={[styles.detailSubText, {color: currentOrder.orderType === 'delivery' ? '#0284c7' : '#10b981', fontWeight: 'bold'}]}>
                        {currentOrder.orderType === 'delivery' ? '🚚 บริการจัดส่ง (Delivery)' : '🛍️ รับเองที่ร้าน (Pickup)'}
                    </Text>
                </View>
            </View>

            {/* ✅ แถวเบอร์โทรศัพท์ร้านค้า (แสดงแยกออกมาให้เห็นชัดเจน) */}
            {storePhone && (currentOrder.status === 'pending' || currentOrder.status === 'confirmed') && (
              <View style={styles.detailRow}>
                  <View style={styles.iconBox}><Ionicons name="call-outline" size={20} color="#555" /></View>
                  <View style={styles.detailTextContainer}>
                      <Text style={styles.detailMainText}>ติดต่อร้านค้า</Text>
                      <Text style={styles.detailSubText}>{storePhone}</Text>
                  </View>
                  <TouchableOpacity style={styles.callStoreBtnText} onPress={handleCallStore}>
                      <Ionicons name="call" size={16} color="#fff" style={{marginRight: 6}} />
                      <Text style={styles.callStoreBtnLabel}>โทรออก</Text>
                  </TouchableOpacity>
              </View>
            )}
        </View>

        {currentOrder.status === 'pending' && (
            <TouchableOpacity
                style={styles.cancelButton}
                onPress={handleOpenCancelModal}
                disabled={isCancelling}
            >
                {isCancelling ? (
                    <ActivityIndicator color="#ef4444" />
                ) : (
                    <>
                        <Ionicons name="close-circle-outline" size={20} color="#ef4444" style={{ marginRight: 8 }} />
                        <Text style={styles.cancelButtonText}>ยกเลิกคำสั่งซื้อ</Text>
                    </>
                )}
            </TouchableOpacity>
        )}

        {currentOrder.status === 'completed' && (
          !currentOrder.isReviewed ? (
            <TouchableOpacity
              style={styles.reviewButton}
              onPress={() => navigation.navigate('WriteReview', { order: currentOrder })}
            >
              <Ionicons name="star" size={20} color="#fff" />
              <Text style={styles.reviewButtonText}>รีวิวสินค้าในออเดอร์นี้</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.reviewedBadge}>
              <Ionicons name="checkmark-circle" size={20} color="#10b981" />
              <Text style={styles.reviewedText}>คุณได้รีวิวสินค้านี้แล้ว ขอบคุณครับ!</Text>
            </View>
          )
        )}

        <TouchableOpacity style={styles.homeButton} onPress={() => navigation.navigate('Home')}>
            <Ionicons name="home" size={20} color="#10b981" style={{ marginRight: 8 }} />
            <Text style={styles.homeButtonText}>กลับไปหน้าหลัก</Text>
        </TouchableOpacity>

        <View style={{height: 50}} />
      </ScrollView>

      <Modal visible={isCancelModalVisible} transparent animationType="fade" onRequestClose={() => setIsCancelModalVisible(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
          <View style={styles.cancelModalBox}>
            <View style={styles.cancelIconCircle}>
              <Ionicons name="help-circle" size={32} color="#f59e0b" />
            </View>
            <Text style={styles.cancelModalTitle}>เหตุผลการยกเลิก</Text>
            <Text style={styles.cancelModalSubtitle}>โปรดระบุเหตุผลเพื่อช่วยให้เราพัฒนาบริการให้ดีขึ้น</Text>

            <ScrollView style={{ width: '100%', maxHeight: 250 }} showsVerticalScrollIndicator={false}>
              {cancelReasonsList.map((reason, index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.reasonOptionBtn}
                  onPress={() => setSelectedReason(reason)}
                >
                  <View style={[styles.radioCircle, selectedReason === reason && styles.radioCircleSelected]}>
                    {selectedReason === reason && <View style={styles.radioInnerCircle} />}
                  </View>
                  <Text style={[styles.reasonOptionText, selectedReason === reason && styles.reasonOptionTextSelected]}>
                    {reason}
                  </Text>
                </TouchableOpacity>
              ))}

              {selectedReason === 'อื่นๆ (โปรดระบุ)' && (
                <TextInput
                  style={styles.customReasonInput}
                  placeholder="พิมพ์เหตุผลของคุณ..."
                  placeholderTextColor="#9ca3af"
                  value={customReason}
                  onChangeText={setCustomReason}
                  multiline
                />
              )}
            </ScrollView>

            <View style={styles.modalButtonGroup}>
              <TouchableOpacity style={styles.modalBtnCancel} onPress={() => setIsCancelModalVisible(false)}>
                <Text style={styles.modalBtnCancelText}>ปิด</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalBtnSubmit} onPress={submitCancel}>
                <Text style={styles.modalBtnSubmitText}>ยืนยันยกเลิก</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 50, paddingBottom: 15, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#1f2937' },
  backButton: { padding: 5 },
  content: { flex: 1, paddingHorizontal: 20 },

  successSection: { alignItems: 'center', marginTop: 25, marginBottom: 15 },
  successIconCircle: { width: 75, height: 75, borderRadius: 40, alignItems: 'center', justifyContent: 'center', marginBottom: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3 },
  successTitle: { fontSize: 22, fontWeight: 'bold', marginBottom: 4 },
  successSubtitle: { fontSize: 14, color: '#6b7280', textAlign: 'center', paddingHorizontal: 20 },

  cancelAlertBox: { flexDirection: 'row', backgroundColor: '#fef2f2', padding: 16, borderRadius: 12, marginBottom: 20, borderWidth: 1, borderColor: '#fecaca', alignItems: 'flex-start' },
  cancelAlertIcon: { marginRight: 12, marginTop: 2 },
  cancelAlertContent: { flex: 1 },
  cancelAlertLabel: { fontSize: 16, color: '#ef4444', fontWeight: 'bold', marginBottom: 4 },
  cancelAlertText: { fontSize: 16, color: '#7f1d1d', lineHeight: 24, fontWeight: '500' },

  orderIdCard: { backgroundColor: '#fff', borderRadius: 16, padding: 20, alignItems: 'center', marginBottom: 20, borderWidth: 1, borderColor: '#e5e7eb' },
  orderIdLabel: { fontSize: 14, color: '#6b7280', marginBottom: 8 },
  orderIdRow: { backgroundColor: '#f3f4f6', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10 },
  orderIdText: { fontSize: 20, fontWeight: 'bold', color: '#1f2937', letterSpacing: 1 },

  detailsSection: { marginBottom: 20 },
  sectionHeader: { fontSize: 16, fontWeight: 'bold', color: '#374151', marginBottom: 12 },
  detailRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', padding: 15, borderRadius: 12, marginBottom: 10, borderWidth: 1, borderColor: '#f3f4f6' },
  detailRowActive: { borderBottomLeftRadius: 0, borderBottomRightRadius: 0, marginBottom: 0 },
  iconBox: { width: 40, alignItems: 'center', marginRight: 10 },
  detailTextContainer: { flex: 1 },
  detailMainText: { fontSize: 15, fontWeight: 'bold', color: '#1f2937' },
  detailSubText: { fontSize: 13, color: '#6b7280', marginTop: 2 },

  // ✅ สไตล์ของปุ่มโทรออกแบบมีข้อความ
  callStoreBtnText: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#10b981',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 4
  },
  callStoreBtnLabel: {
    color: '#fff',
    fontSize: 13,
    fontWeight: 'bold'
  },

  expandedItemsBox: { backgroundColor: '#fafafa', padding: 15, marginBottom: 10, borderBottomLeftRadius: 12, borderBottomRightRadius: 12, borderWidth: 1, borderColor: '#f3f4f6', borderTopWidth: 0 },
  itemSmallRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  itemSmallName: { fontSize: 14, color: '#374151', flex: 1 },
  itemSmallQty: { fontSize: 14, color: '#6b7280', marginHorizontal: 10 },
  itemSmallPrice: { fontSize: 14, fontWeight: '600', color: '#10b981' },

  errorContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  errorText: { fontSize: 18, color: '#6b7280', marginTop: 15, marginBottom: 20 },
  backLink: { fontSize: 16, color: '#10b981', fontWeight: 'bold' },

  cancelButton: { backgroundColor: '#fef2f2', paddingVertical: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: 12, marginBottom: 15, borderWidth: 1, borderColor: '#fecaca' },
  cancelButtonText: { fontSize: 16, fontWeight: 'bold', color: '#ef4444' },

  reviewButton: { backgroundColor: '#f59e0b', paddingVertical: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: 12, marginBottom: 15, gap: 8, elevation: 3 },
  reviewButtonText: { fontSize: 16, fontWeight: 'bold', color: '#fff' },
  reviewedBadge: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#ecfdf5', padding: 15, borderRadius: 12, marginBottom: 15, gap: 8, borderWidth: 1, borderColor: '#dcfce7' },
  reviewedText: { color: '#10b981', fontWeight: 'bold', fontSize: 14 },

  homeButton: { backgroundColor: '#fff', paddingVertical: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: 12, borderWidth: 1, borderColor: '#10b981' },
  homeButtonText: { fontSize: 16, fontWeight: 'bold', color: '#10b981' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  cancelModalBox: { width: '95%', backgroundColor: '#fff', borderRadius: 24, padding: 24, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.15, shadowRadius: 20, elevation: 10 },
  cancelIconCircle: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#fef3c7', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  cancelModalTitle: { fontSize: 20, fontWeight: 'bold', color: '#1f2937', marginBottom: 8, textAlign: 'center' },
  cancelModalSubtitle: { fontSize: 14, color: '#6b7280', marginBottom: 20, textAlign: 'center' },
  reasonOptionBtn: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  radioCircle: { height: 20, width: 20, borderRadius: 10, borderWidth: 2, borderColor: '#d1d5db', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  radioCircleSelected: { borderColor: '#ef4444' },
  radioInnerCircle: { height: 10, width: 10, borderRadius: 5, backgroundColor: '#ef4444' },
  reasonOptionText: { fontSize: 15, color: '#4b5563', flex: 1 },
  reasonOptionTextSelected: { color: '#1f2937', fontWeight: 'bold' },
  customReasonInput: { backgroundColor: '#f9fafb', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12, padding: 12, fontSize: 14, color: '#1f2937', height: 80, textAlignVertical: 'top', marginTop: 10, marginBottom: 10 },
  modalButtonGroup: { flexDirection: 'row', gap: 12, width: '100%', marginTop: 20 },
  modalBtnCancel: { flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: '#f3f4f6', alignItems: 'center' },
  modalBtnCancelText: { fontSize: 15, fontWeight: 'bold', color: '#4b5563' },
  modalBtnSubmit: { flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: '#ef4444', alignItems: 'center' },
  modalBtnSubmitText: { fontSize: 15, fontWeight: 'bold', color: '#fff' },
});