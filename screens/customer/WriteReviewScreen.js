import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator,
  KeyboardAvoidingView, Platform, ScrollView, StatusBar, Modal, Alert, Image
} from 'react-native';
// ✅ 1. Import
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { auth, db } from '../../firebase.config';
import { collection, addDoc, doc, updateDoc, serverTimestamp, getDoc } from 'firebase/firestore';
import * as ImagePicker from 'expo-image-picker';

export default function WriteReviewScreen({ navigation, route }) {
  const { order } = route.params || {};

  // ✅ 2. ดึงค่า Insets
  const insets = useSafeAreaInsets();

  const targetStoreId = order?.storeId;
  const targetStoreName = order?.storeName;

  const [rating, setRating] = useState(5);
  const [selectedTags, setSelectedTags] = useState([]);
  const [comment, setComment] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [loading, setLoading] = useState(false);
  const [imageUri, setImageUri] = useState(null);

  const [alertVisible, setAlertVisible] = useState(false);
  const [alertConfig, setAlertConfig] = useState({ title: '', message: '', type: 'error', onConfirm: null });

  const quickTags = ['คุ้มค่าเกินราคา', 'ปริมาณเยอะ', 'รสชาติอร่อย', 'แพ็คเกจจิ้งดี', 'พนักงานเป็นมิตร', 'สะอาดปลอดภัย'];

  const toggleTag = (tag) => {
    if (selectedTags.includes(tag)) setSelectedTags(selectedTags.filter(t => t !== tag));
    else setSelectedTags([...selectedTags, tag]);
  };

  const pickImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, aspect: [4, 3], quality: 0.5 });
    if (!result.canceled) setImageUri(result.assets[0].uri);
  };

  const showCustomAlert = (title, message, type = 'error', onConfirm = null) => {
    setAlertConfig({ title, message, type, onConfirm });
    setAlertVisible(true);
  };

  const confirmSubmit = () => {
    if (!targetStoreId) { showCustomAlert('ข้อผิดพลาด', 'ไม่พบข้อมูลออเดอร์หรือร้านค้า', 'error'); return; }
    Alert.alert('ยืนยันการส่งรีวิว', 'คุณต้องการส่งรีวิวสินค้านี้ใช่หรือไม่?\n(รีวิวนี้จะไปแสดงในหน้าร้านค้า)', [
        { text: 'ยกเลิก', style: 'cancel' },
        { text: 'ยืนยัน', onPress: executeSubmit }
    ]);
  };

  const executeSubmit = async () => {
    setLoading(true);
    try {
      const user = auth.currentUser;
      const orderRef = doc(db, 'orders', order.id);
      const orderSnap = await getDoc(orderRef);

      if (orderSnap.exists() && orderSnap.data().isReviewed) {
        showCustomAlert('แจ้งเตือน', 'ออเดอร์นี้ถูกรีวิวไปแล้ว ไม่สามารถรีวิวซ้ำได้ครับ', 'error', () => navigation.goBack());
        setLoading(false);
        return;
      }

      let realUserName = user.displayName;
      let realUserProfileImage = user.photoURL || null;
      const userDocRef = doc(db, 'users', user.uid);
      const userDocSnap = await getDoc(userDocRef);

      if (userDocSnap.exists()) {
        const userData = userDocSnap.data();
        if (userData.username) realUserName = userData.username;
        if (userData.profileImage) realUserProfileImage = userData.profileImage;
      }
      if (!realUserName) realUserName = 'ลูกค้า FoodWaste';

      await addDoc(collection(db, 'reviews'), {
        storeId: targetStoreId, storeName: targetStoreName, userId: user.uid, userName: realUserName,
        userProfileImage: realUserProfileImage, isAnonymous: isAnonymous, rating: rating, tags: selectedTags,
        comment: comment.trim(), reviewImage: imageUri, reviewType: 'order', orderId: order.id,
        orderItems: order.items || null, orderType: order.orderType || null, orderTotalPrice: order.totalPrice || null,
        orderFoodName: order.foodName || 'รายการอาหาร', createdAt: serverTimestamp()
      });

      await updateDoc(orderRef, { isReviewed: true });

      const notifRef = await addDoc(collection(db, 'store_notifications'), {
        storeId: targetStoreId, type: 'new_review', title: 'มีรีวิวใหม่จากลูกค้า! ⭐',
        message: `ออเดอร์ #${order.id.slice(0, 6).toUpperCase()} ได้รับรีวิว ${rating} ดาว`,
        orderId: order.id, orderType: order.orderType || 'pickup', rating: rating,
        comment: comment.trim() || '', isRead: false, createdAt: new Date().toISOString()
      });
      await updateDoc(notifRef, { id: notifRef.id });

      showCustomAlert('สำเร็จ!', 'ขอบคุณสำหรับรีวิวของคุณครับ', 'success', () => navigation.goBack());
    } catch (error) {
      console.error("Review Error: ", error);
      showCustomAlert('ผิดพลาด', 'ไม่สามารถส่งรีวิวได้ในขณะนี้', 'error');
    } finally { setLoading(false); }
  };

  if (!order) return (<View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}><Text style={{ color: '#6b7280' }}>ไม่พบข้อมูลคำสั่งซื้อที่จะรีวิว</Text></View>);

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      {/* ✅ 3. ดัน Header ลงมา */}
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 15) }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="close" size={26} color="#1f2937" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>รีวิวสินค้าที่สั่ง</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 40) + 80 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.storeInfoBox}>
            <View style={styles.storeIconCircle}><Ionicons name="fast-food" size={30} color="#f59e0b" /></View>
            <Text style={styles.storeName}>{order.foodName}</Text>
            <Text style={styles.orderSummary}>จากร้าน: {targetStoreName}</Text>
        </View>

        <Text style={styles.sectionTitle}>คุณพึงพอใจแค่ไหน?</Text>
        <View style={styles.starsContainer}>
          {[1, 2, 3, 4, 5].map((star) => (
            <TouchableOpacity key={star} onPress={() => setRating(star)}>
              <Ionicons name={star <= rating ? "star" : "star-outline"} size={45} color={star <= rating ? "#f59e0b" : "#d1d5db"} style={styles.starIcon} />
            </TouchableOpacity>
          ))}
        </View>
        <Text style={styles.ratingHint}>{rating === 5 ? 'ยอดเยี่ยมมาก! 😍' : rating === 4 ? 'ดีมาก 😃' : rating === 3 ? 'ปานกลาง 🙂' : rating === 2 ? 'พอใช้ 😐' : 'ต้องปรับปรุง 😔'}</Text>

        <Text style={styles.sectionTitle}>สิ่งที่คุณประทับใจ (เลือกได้มากกว่า 1)</Text>
        <View style={styles.tagsContainer}>
          {quickTags.map((tag) => {
            const isActive = selectedTags.includes(tag);
            return (
              <TouchableOpacity key={tag} style={[styles.tagBadge, isActive && styles.tagBadgeActive]} onPress={() => toggleTag(tag)}>
                <Text style={[styles.tagText, isActive && styles.tagTextActive]}>{tag}</Text>
              </TouchableOpacity>
            )
          })}
        </View>

        <Text style={styles.sectionTitle}>ข้อความเพิ่มเติม (ไม่บังคับ)</Text>
        <TextInput style={styles.textInput} placeholder="แชร์ประสบการณ์ของคุณให้คนอื่นรู้..." placeholderTextColor="#9ca3af" multiline numberOfLines={4} value={comment} onChangeText={setComment} textAlignVertical="top" />

        <Text style={styles.sectionTitle}>แนบรูปภาพอาหาร (ไม่บังคับ)</Text>
        {imageUri ? (
           <View style={styles.imagePreviewContainer}>
              <Image source={{ uri: imageUri }} style={styles.imagePreview} />
              <TouchableOpacity style={styles.removeImageBtn} onPress={() => setImageUri(null)}><Ionicons name="close-circle" size={28} color="#ef4444" /></TouchableOpacity>
           </View>
        ) : (
           <TouchableOpacity style={styles.uploadImageBtn} onPress={pickImage}><Ionicons name="camera-outline" size={30} color="#9ca3af" /><Text style={styles.uploadImageText}>เพิ่มรูปภาพอาหาร</Text></TouchableOpacity>
        )}

        <TouchableOpacity style={styles.checkboxContainer} onPress={() => setIsAnonymous(!isAnonymous)} activeOpacity={0.7}>
          <Ionicons name={isAnonymous ? "checkbox" : "square-outline"} size={24} color={isAnonymous ? "#10b981" : "#9ca3af"} />
          <Text style={styles.checkboxLabel}>ซ่อนชื่อผู้รีวิว (ไม่ประสงค์ออกนาม)</Text>
        </TouchableOpacity>
      </ScrollView>

      <Modal animationType="fade" transparent={true} visible={alertVisible} onRequestClose={() => setAlertVisible(false)}>
        <View style={styles.alertOverlay}>
          <View style={styles.alertBox}>
            <View style={[styles.alertIconCircle, alertConfig.type === 'success' ? { backgroundColor: '#dcfce7' } : { backgroundColor: '#fee2e2' }]}>
              <Ionicons name={alertConfig.type === 'success' ? "checkmark" : "close"} size={36} color={alertConfig.type === 'success' ? '#10b981' : '#ef4444'} />
            </View>
            <Text style={styles.alertTitle}>{alertConfig.title}</Text>
            <Text style={styles.alertMessage}>{alertConfig.message}</Text>
            <TouchableOpacity style={[styles.alertButton, alertConfig.type === 'success' ? { backgroundColor: '#10b981' } : { backgroundColor: '#111827' }]} onPress={() => { setAlertVisible(false); if (alertConfig.onConfirm) alertConfig.onConfirm(); }}>
              <Text style={styles.alertButtonText}>ตกลง</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ✅ 4. ดันปุ่มล่างขึ้นมา */}
      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 20) }]}>
        <TouchableOpacity style={[styles.submitButton, loading && {opacity: 0.7}]} onPress={confirmSubmit} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitButtonText}>ส่งรีวิวสินค้า</Text>}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  // 🟢 ลบ paddingTop ออก
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 15, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#1f2937' },
  backButton: { padding: 5 },
  content: { flex: 1, padding: 20 },
  storeInfoBox: { alignItems: 'center', marginBottom: 30, marginTop: 10 },
  storeIconCircle: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#fef3c7', justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
  storeName: { fontSize: 20, fontWeight: 'bold', color: '#1f2937', marginBottom: 4, textAlign: 'center' },
  orderSummary: { fontSize: 14, color: '#6b7280' },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', color: '#374151', marginBottom: 15, marginTop: 10 },
  starsContainer: { flexDirection: 'row', justifyContent: 'center', gap: 10 },
  starIcon: { marginHorizontal: 5 },
  ratingHint: { textAlign: 'center', color: '#f59e0b', fontWeight: 'bold', marginTop: 10, marginBottom: 25, fontSize: 16 },
  tagsContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 25 },
  tagBadge: { paddingHorizontal: 15, paddingVertical: 10, borderRadius: 20, backgroundColor: '#f3f4f6', borderWidth: 1, borderColor: '#e5e7eb' },
  tagBadgeActive: { backgroundColor: '#10b981', borderColor: '#10b981' },
  tagText: { color: '#4b5563', fontSize: 14, fontWeight: '500' },
  tagTextActive: { color: '#fff' },
  textInput: { backgroundColor: '#f9fafb', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12, padding: 15, fontSize: 15, color: '#1f2937', minHeight: 120 },
  uploadImageBtn: { backgroundColor: '#f9fafb', borderWidth: 1, borderColor: '#d1d5db', borderStyle: 'dashed', borderRadius: 12, height: 100, justifyContent: 'center', alignItems: 'center', marginTop: 5 },
  uploadImageText: { color: '#9ca3af', marginTop: 8, fontSize: 14, fontWeight: '500' },
  imagePreviewContainer: { position: 'relative', marginTop: 5, width: 120, height: 120 },
  imagePreview: { width: '100%', height: '100%', borderRadius: 12, borderWidth: 1, borderColor: '#e5e7eb' },
  removeImageBtn: { position: 'absolute', top: -10, right: -10, backgroundColor: '#fff', borderRadius: 14 },
  checkboxContainer: { flexDirection: 'row', alignItems: 'center', marginTop: 25, paddingHorizontal: 5, paddingBottom: 40 },
  checkboxLabel: { marginLeft: 10, fontSize: 14, color: '#4b5563' },
  alertOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  alertBox: { backgroundColor: '#fff', borderRadius: 24, padding: 25, alignItems: 'center', width: '85%', shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.1, shadowRadius: 10, elevation: 10 },
  alertIconCircle: { width: 70, height: 70, borderRadius: 35, justifyContent: 'center', alignItems: 'center', marginBottom: 15 },
  alertTitle: { fontSize: 20, fontWeight: 'bold', color: '#1f2937', marginBottom: 10 },
  alertMessage: { fontSize: 14, color: '#6b7280', textAlign: 'center', marginBottom: 25, lineHeight: 22 },
  alertButton: { paddingVertical: 14, borderRadius: 12, width: '100%', alignItems: 'center' },
  alertButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  // 🟢 ลบ paddingBottom ออก
  footer: { paddingHorizontal: 20, paddingTop: 15, borderTopWidth: 1, borderTopColor: '#f3f4f6', backgroundColor: '#fff' },
  submitButton: { backgroundColor: '#10b981', paddingVertical: 16, borderRadius: 12, alignItems: 'center' },
  submitButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' }
});