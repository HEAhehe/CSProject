import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  Modal,
  Alert // ✅ นำเข้า Alert เพื่อใช้ทำป๊อปอัปยืนยัน
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { auth, db } from '../../firebase.config';
import { collection, addDoc, doc, updateDoc, serverTimestamp, getDoc } from 'firebase/firestore';

export default function WriteReviewScreen({ navigation, route }) {
  const { order, store } = route.params || {};
  const isFromOrder = !!order;
  const targetStoreId = isFromOrder ? order.storeId : store?.id;
  const targetStoreName = isFromOrder ? order.storeName : store?.storeName;

  const [rating, setRating] = useState(5);
  const [selectedTags, setSelectedTags] = useState([]);
  const [comment, setComment] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [loading, setLoading] = useState(false);

  const [alertVisible, setAlertVisible] = useState(false);
  const [alertConfig, setAlertConfig] = useState({
    title: '',
    message: '',
    type: 'error',
    onConfirm: null
  });

  const quickTags = ['คุ้มค่าเกินราคา', 'ปริมาณเยอะ', 'รสชาติอร่อย', 'แพ็คเกจจิ้งดี', 'พนักงานเป็นมิตร', 'สะอาดปลอดภัย'];

  const toggleTag = (tag) => {
    if (selectedTags.includes(tag)) {
      setSelectedTags(selectedTags.filter(t => t !== tag));
    } else {
      setSelectedTags([...selectedTags, tag]);
    }
  };

  const showCustomAlert = (title, message, type = 'error', onConfirm = null) => {
    setAlertConfig({ title, message, type, onConfirm });
    setAlertVisible(true);
  };

  // ✅ 1. ฟังก์ชันเช็คและแสดงป๊อปอัปยืนยันก่อนส่ง
  const confirmSubmit = () => {
    if (!targetStoreId) {
      showCustomAlert('ข้อผิดพลาด', 'ไม่พบข้อมูลร้านค้า', 'error');
      return;
    }

    Alert.alert(
      'ยืนยันการส่งรีวิว',
      'คุณต้องการส่งรีวิวนี้ใช่หรือไม่?\n(ข้อมูลรีวิวจะถูกแสดงในหน้าร้านค้า)',
      [
        { text: 'ยกเลิก', style: 'cancel' },
        {
          text: 'ยืนยันการส่ง',
          onPress: executeSubmit // ถ้ากดยืนยัน ค่อยเรียกฟังก์ชันบันทึกข้อมูล
        }
      ]
    );
  };

  // ✅ 2. ฟังก์ชันบันทึกข้อมูลลงฐานข้อมูล (จะทำงานเมื่อกดยืนยันแล้วเท่านั้น)
  const executeSubmit = async () => {
    setLoading(true);
    try {
      const user = auth.currentUser;

      let realUserName = user.displayName;
      let realUserProfileImage = user.photoURL || null;

      const userDocRef = doc(db, 'users', user.uid);
      const userDocSnap = await getDoc(userDocRef);

      if (userDocSnap.exists()) {
        const userData = userDocSnap.data();
        if (userData.username) {
            realUserName = userData.username;
        }
        if (userData.profileImage) {
            realUserProfileImage = userData.profileImage;
        }
      }

      if (!realUserName) {
          realUserName = 'ลูกค้า FoodWaste';
      }

      await addDoc(collection(db, 'reviews'), {
        orderId: isFromOrder ? order.id : 'direct_review',
        storeId: targetStoreId,
        storeName: targetStoreName,
        userId: user.uid,
        userName: realUserName,
        userProfileImage: realUserProfileImage,
        isAnonymous: isAnonymous,
        rating: rating,
        tags: selectedTags,
        comment: comment.trim(),
        createdAt: serverTimestamp()
      });

      if (isFromOrder) {
        await updateDoc(doc(db, 'orders', order.id), {
          isReviewed: true
        });
      }

      showCustomAlert('สำเร็จ!', 'ขอบคุณสำหรับรีวิวของคุณครับ', 'success', () => navigation.goBack());

    } catch (error) {
      console.error("Review Error: ", error);
      showCustomAlert('ผิดพลาด', 'ไม่สามารถส่งรีวิวได้ในขณะนี้', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="close" size={26} color="#1f2937" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>ให้คะแนนร้านค้า</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>

        <View style={styles.storeInfoBox}>
            <View style={styles.storeIconCircle}>
                <Ionicons name="storefront" size={30} color="#10b981" />
            </View>
            <Text style={styles.storeName}>{targetStoreName}</Text>
            {isFromOrder ? (
              <Text style={styles.orderSummary}>ออเดอร์: {order.foodName}</Text>
            ) : (
              <Text style={styles.orderSummary}>รีวิวร้านค้าโดยตรง</Text>
            )}
        </View>

        <Text style={styles.sectionTitle}>คุณพึงพอใจแค่ไหน?</Text>
        <View style={styles.starsContainer}>
          {[1, 2, 3, 4, 5].map((star) => (
            <TouchableOpacity key={star} onPress={() => setRating(star)}>
              <Ionicons
                name={star <= rating ? "star" : "star-outline"}
                size={45}
                color={star <= rating ? "#f59e0b" : "#d1d5db"}
                style={styles.starIcon}
              />
            </TouchableOpacity>
          ))}
        </View>
        <Text style={styles.ratingHint}>
            {rating === 5 ? 'ยอดเยี่ยมมาก! 😍' :
             rating === 4 ? 'ดีมาก 😃' :
             rating === 3 ? 'ปานกลาง 🙂' :
             rating === 2 ? 'พอใช้ 😐' : 'ต้องปรับปรุง 😔'}
        </Text>

        <Text style={styles.sectionTitle}>สิ่งที่คุณประทับใจ (เลือกได้มากกว่า 1)</Text>
        <View style={styles.tagsContainer}>
          {quickTags.map((tag) => {
            const isActive = selectedTags.includes(tag);
            return (
              <TouchableOpacity
                key={tag}
                style={[styles.tagBadge, isActive && styles.tagBadgeActive]}
                onPress={() => toggleTag(tag)}
              >
                <Text style={[styles.tagText, isActive && styles.tagTextActive]}>{tag}</Text>
              </TouchableOpacity>
            )
          })}
        </View>

        <Text style={styles.sectionTitle}>ข้อความเพิ่มเติม (ไม่บังคับ)</Text>
        <TextInput
          style={styles.textInput}
          placeholder="แชร์ประสบการณ์ของคุณให้คนอื่นรู้..."
          placeholderTextColor="#9ca3af"
          multiline
          numberOfLines={4}
          value={comment}
          onChangeText={setComment}
          textAlignVertical="top"
        />

        <TouchableOpacity
          style={styles.checkboxContainer}
          onPress={() => setIsAnonymous(!isAnonymous)}
          activeOpacity={0.7}
        >
          <Ionicons
            name={isAnonymous ? "checkbox" : "square-outline"}
            size={24}
            color={isAnonymous ? "#10b981" : "#9ca3af"}
          />
          <Text style={styles.checkboxLabel}>ซ่อนชื่อผู้รีวิว (ไม่ประสงค์ออกนาม)</Text>
        </TouchableOpacity>

        <View style={{height: 40}}/>
      </ScrollView>

      <Modal
        animationType="fade"
        transparent={true}
        visible={alertVisible}
        onRequestClose={() => setAlertVisible(false)}
      >
        <View style={styles.alertOverlay}>
          <View style={styles.alertBox}>
            <View style={[
              styles.alertIconCircle,
              alertConfig.type === 'success' ? { backgroundColor: '#dcfce7' } : { backgroundColor: '#fee2e2' }
            ]}>
              <Ionicons
                name={alertConfig.type === 'success' ? "checkmark" : "close"}
                size={36}
                color={alertConfig.type === 'success' ? '#10b981' : '#ef4444'}
              />
            </View>
            <Text style={styles.alertTitle}>{alertConfig.title}</Text>
            <Text style={styles.alertMessage}>{alertConfig.message}</Text>

            <TouchableOpacity
              style={[
                styles.alertButton,
                alertConfig.type === 'success' ? { backgroundColor: '#10b981' } : { backgroundColor: '#111827' }
              ]}
              onPress={() => {
                setAlertVisible(false);
                if (alertConfig.onConfirm) alertConfig.onConfirm();
              }}
              activeOpacity={0.8}
            >
              <Text style={styles.alertButtonText}>ตกลง</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.submitButton, loading && {opacity: 0.7}]}
          // ✅ เปลี่ยนมาเรียกใช้ confirmSubmit แทน handleSubmit เดิม
          onPress={confirmSubmit}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.submitButtonText}>ส่งรีวิว</Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#1f2937' },
  backButton: { padding: 5 },
  content: { flex: 1, padding: 20 },

  storeInfoBox: { alignItems: 'center', marginBottom: 30, marginTop: 10 },
  storeIconCircle: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#f0fdf4', justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
  storeName: { fontSize: 20, fontWeight: 'bold', color: '#1f2937', marginBottom: 4 },
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

  checkboxContainer: { flexDirection: 'row', alignItems: 'center', marginTop: 15, paddingHorizontal: 5 },
  checkboxLabel: { marginLeft: 10, fontSize: 14, color: '#4b5563' },

  alertOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  alertBox: { backgroundColor: '#fff', borderRadius: 24, padding: 25, alignItems: 'center', width: '85%', shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.1, shadowRadius: 10, elevation: 10 },
  alertIconCircle: { width: 70, height: 70, borderRadius: 35, justifyContent: 'center', alignItems: 'center', marginBottom: 15 },
  alertTitle: { fontSize: 20, fontWeight: 'bold', color: '#1f2937', marginBottom: 10 },
  alertMessage: { fontSize: 14, color: '#6b7280', textAlign: 'center', marginBottom: 25, lineHeight: 22 },
  alertButton: { paddingVertical: 14, borderRadius: 12, width: '100%', alignItems: 'center' },
  alertButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },

  footer: { padding: 20, paddingBottom: Platform.OS === 'ios' ? 35 : 20, borderTopWidth: 1, borderTopColor: '#f3f4f6' },
  submitButton: { backgroundColor: '#10b981', paddingVertical: 16, borderRadius: 12, alignItems: 'center' },
  submitButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' }
});