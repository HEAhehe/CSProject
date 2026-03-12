import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput,
  StatusBar, Image, ActivityIndicator, Alert, Platform, KeyboardAvoidingView, Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { auth, db } from '../../firebase.config';
import { collection, addDoc, doc, updateDoc, serverTimestamp, getDoc, getDocs, writeBatch } from 'firebase/firestore';
// ✅ นำเข้าฟังก์ชัน Storage เพื่อใช้อัปโหลดรูปภาพ
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import * as ImagePicker from 'expo-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const UNIT_OPTIONS = ['กล่อง', 'ถุง', 'ชิ้น', 'แพ็ค', 'โหล', 'กิโลกรัม', 'ลิตร', 'ขวด', 'ถาด', 'ชุด'];

const CATEGORY_OPTIONS = [
  { label: 'อาหารสด', icon: 'nutrition-outline' },
  { label: 'อาหารแห้ง', icon: 'cube-outline' },
  { label: 'เครื่องดื่ม', icon: 'wine-outline' },
  { label: 'ขนม/ของหวาน', icon: 'ice-cream-outline' },
  { label: 'ผัก/ผลไม้', icon: 'leaf-outline' },
  { label: 'อาหารสำเร็จรูป', icon: 'fast-food-outline' },
  { label: 'นม/ผลิตภัณฑ์นม', icon: 'water-outline' },
  { label: 'อื่นๆ', icon: 'ellipsis-horizontal-outline' },
];

const WEIGHT_PER_BOX_KG = 0.4;
const CO2_COEFFICIENT = 2.5;

export default function CreateListingScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const editItem = route.params?.editItem || null;
  const isEditMode = !!editItem;

  const [storeData, setStoreData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [imageUri, setImageUri] = useState(editItem?.imageUrl || null);
  const [showUnitModal, setShowUnitModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);

  const [name, setName] = useState(editItem?.name || '');
  const [description, setDescription] = useState(editItem?.description || '');
  const [originalPrice, setOriginalPrice] = useState(editItem?.originalPrice?.toString() || '');
  const [discountPrice, setDiscountPrice] = useState((editItem?.discountPrice || editItem?.price)?.toString() || '');
  const [quantity, setQuantity] = useState(editItem?.quantity?.toString() || '');
  const [unit, setUnit] = useState(editItem?.unit || editItem?.sellingUnit || 'กล่อง');
  const [category, setCategory] = useState(editItem?.category || 'อาหารสด');
  const [weightPerUnit, setWeightPerUnit] = useState(editItem?.weightPerUnit?.toString() || '');

  useEffect(() => {
    loadStoreData();
  }, []);

  const loadStoreData = async () => {
    try {
      const user = auth.currentUser;
      if (!user) return;
      const storeDoc = await getDoc(doc(db, 'stores', user.uid));
      if (storeDoc.exists()) setStoreData(storeDoc.data());
    } catch (e) { console.error('Error loading store:', e); }
  };

  const qty = Number(quantity) || 0;
  const weightPerUnitKg = Number(weightPerUnit) || WEIGHT_PER_BOX_KG;
  const foodWasteSaved = qty * weightPerUnitKg;
  const co2Saved = foodWasteSaved * CO2_COEFFICIENT;

  const notifyFollowers = async (storeId, storeName, foodName, foodImage, foodId, price, originalPrice) => {
    try {
      const usersSnapshot = await getDocs(collection(db, 'users'));
      let count = 0;
      const batch = writeBatch(db);

      for (const userDoc of usersSnapshot.docs) {
        const userId = userDoc.id;
        const favRef = doc(db, 'users', userId, 'favorites', storeId);
        const favSnap = await getDoc(favRef);

        if (favSnap.exists()) {
          const notifRef = doc(collection(db, 'notifications'));
          batch.set(notifRef, {
            userId: userId,
            type: 'new_food_item',
            title: `${storeName} เพิ่มเมนูใหม่! 🍱`,
            message: `"${foodName}" พร้อมให้คุณสั่งซื้อแล้ววันนี้`,
            storeId: storeId,
            storeName: storeName,
            foodName: foodName,
            foodImage: foodImage || null,
            foodId: foodId,
            price: price,
            originalPrice: originalPrice || 0,
            isRead: false,
            createdAt: new Date().toISOString(),
          });
          count++;
        }
      }

      if (count > 0) {
        await batch.commit();
        console.log('[notifyFollowers] ✅ ส่งแจ้งเตือนให้', count, 'คนสำเร็จ');
      }
    } catch (e) {
      console.error('[notifyFollowers] ❌ ERROR:', e);
    }
  };

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('ไม่ได้รับอนุญาต', 'กรุณาอนุญาตการเข้าถึงรูปภาพในการตั้งค่า');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      // เปลี่ยนจาก Images เป็น All หรือคงไว้แต่เตรียมรับข้อความเตือน (Expo แนะนำให้ใช้วิธีอื่นในอนาคต แต่ตอนนี้ยังใช้ได้)
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.2, // ✅ สำคัญมาก! ต้องปรับลดลงเหลือ 0.1 - 0.2 เพื่อไม่ให้ไฟล์เกิน 1MB
      base64: true, // ✅ สั่งให้ Expo คืนค่ารูปภาพมาเป็น Base64
    });

    if (!result.canceled) {
      // เอาข้อมูล Base64 มาต่อ String ให้พร้อมใช้งาน
      const base64Image = `data:image/jpeg;base64,${result.assets[0].base64}`;
      setImageUri(base64Image);
    }
  };

  const discountPercent = originalPrice && discountPrice && Number(originalPrice) > 0
    ? Math.round(((Number(originalPrice) - Number(discountPrice)) / Number(originalPrice)) * 100) : 0;

  const validate = () => {
    if (!name.trim()) { Alert.alert('กรุณากรอกชื่อสินค้า'); return false; }
    if (!discountPrice || Number(discountPrice) <= 0) { Alert.alert('กรุณากรอกราคาขาย'); return false; }
    if (!quantity || Number(quantity) <= 0) { Alert.alert('กรุณากรอกจำนวน'); return false; }
    if (originalPrice && Number(discountPrice) > Number(originalPrice)) { Alert.alert('ราคาขายต้องน้อยกว่าราคาปกติ'); return false; }
    return true;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      const user = auth.currentUser;
      if (!user) throw new Error('Not authenticated');

      // ✅ 1. เตรียมตัวแปรเก็บ URL รูปล่าสุด
      let finalImageUrl = imageUri;

      // ✅ 2. ตรวจสอบว่ารูปนี้เป็นไฟล์ในเครื่อง (file://) ที่เพิ่งเลือกใหม่หรือไม่
      if (imageUri && imageUri.startsWith('file://')) {
        const storage = getStorage();
        // สร้างชื่อไฟล์ไม่ให้ซ้ำกันด้วย Timestamp
        const filename = `food_images/${user.uid}_${Date.now()}.jpg`;
        const storageRef = ref(storage, filename);

        // แปลงไฟล์รูปภาพเป็น Blob สำหรับส่งขึ้น Firebase
        const response = await fetch(imageUri);
        const blob = await response.blob();

        // อัปโหลดขึ้น Firebase Storage
        await uploadBytes(storageRef, blob);

        // ขอลิงก์ออนไลน์ (Download URL) ที่สามารถเปิดได้จากทุกเครื่อง
        finalImageUrl = await getDownloadURL(storageRef);
      }

      // ✅ 3. เอาลิงก์ออนไลน์ที่ได้ ไปใส่ใน payload แทน imageUri เดิม
      const payload = {
        name: name.trim(),
        description: description.trim(),
        originalPrice: Number(originalPrice) || 0,
        discountPrice: Number(discountPrice),
        price: Number(discountPrice),
        quantity: Number(quantity),
        unit,
        sellingUnit: unit,
        category,
        imageUrl: finalImageUrl || null, // <--- ใช้ finalImageUrl ตรงนี้
        userId: user.uid,
        storeId: user.uid,
        storeName: storeData?.storeName || '',
        storeImage: storeData?.storeImage || null,
        weightPerUnit: weightPerUnitKg,
        foodWasteSaved: foodWasteSaved,
        co2Saved: co2Saved,
        updatedAt: serverTimestamp(),
      };

      if (isEditMode) {
        await updateDoc(doc(db, 'food_items', editItem.id), payload);
        Alert.alert('สำเร็จ', 'อัปเดตสินค้าเรียบร้อยแล้ว', [{ text: 'ตกลง', onPress: () => navigation.goBack() }]);
      } else {
        payload.createdAt = serverTimestamp();
        payload.status = 'active';

        const docRef = await addDoc(collection(db, 'food_items'), payload);

        await notifyFollowers(
          user.uid,
          storeData?.storeName || '',
          name.trim(),
          finalImageUrl || null, // <--- ใช้ finalImageUrl ตรงนี้
          docRef.id,
          Number(discountPrice),
          Number(originalPrice)
        );

        Alert.alert('สำเร็จ', 'โพสต์สินค้าเรียบร้อยแล้ว', [{ text: 'ตกลง', onPress: () => navigation.goBack() }]);
      }
    } catch (error) {
      console.error('Error submitting:', error);
      Alert.alert('ผิดพลาด', 'ไม่สามารถบันทึกสินค้าได้ กรุณาลองใหม่อีกครั้ง');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#10b981" />

      <View style={[styles.header, { paddingTop: insets.top + 14 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{isEditMode ? 'แก้ไขสินค้า' : 'โพสต์สินค้าใหม่'}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        <TouchableOpacity style={styles.imagePicker} onPress={pickImage} activeOpacity={0.8}>
          {imageUri ? (
            <>
              <Image source={{ uri: imageUri }} style={styles.pickedImage} />
              <View style={styles.imageEditBadge}>
                <Ionicons name="camera" size={16} color="#fff" />
                <Text style={styles.imageEditText}>เปลี่ยนรูป</Text>
              </View>
            </>
          ) : (
            <View style={styles.imagePlaceholder}>
              <View style={styles.imagePlaceholderIcon}>
                <Ionicons name="camera-outline" size={36} color="#10b981" />
              </View>
              <Text style={styles.imagePlaceholderTitle}>เพิ่มรูปสินค้า</Text>
              <Text style={styles.imagePlaceholderSub}>แตะเพื่ออัปโหลดรูปภาพ</Text>
            </View>
          )}
        </TouchableOpacity>

        <View style={styles.formSection}>
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>ชื่อสินค้า <Text style={styles.required}>*</Text></Text>
            <TextInput style={styles.input} placeholder="เช่น ข้าวกล่อง..." placeholderTextColor="#9ca3af" value={name} onChangeText={setName} />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>หมวดหมู่</Text>
            <TouchableOpacity style={styles.selectInput} onPress={() => setShowCategoryModal(true)}>
              <View style={styles.selectLeft}>
                <Ionicons name={CATEGORY_OPTIONS.find(c => c.label === category)?.icon || 'cube-outline'} size={18} color="#10b981" />
                <Text style={styles.selectText}>{category}</Text>
              </View>
              <Ionicons name="chevron-down" size={18} color="#9ca3af" />
            </TouchableOpacity>
          </View>

          <View style={styles.fieldRow}>
            <View style={[styles.fieldGroup, { flex: 1 }]}>
              <Text style={styles.fieldLabel}>ราคาปกติ (฿)</Text>
              <TextInput style={styles.input} placeholder="0" keyboardType="numeric" value={originalPrice} onChangeText={setOriginalPrice} />
            </View>
            <View style={[styles.fieldGroup, { flex: 1 }]}>
              <Text style={styles.fieldLabel}>ราคาขาย (฿) <Text style={styles.required}>*</Text></Text>
              <TextInput style={[styles.input, styles.inputHighlight]} placeholder="0" keyboardType="numeric" value={discountPrice} onChangeText={setDiscountPrice} />
            </View>
          </View>

          {discountPercent > 0 && (
            <View style={styles.discountPreview}>
              <Ionicons name="pricetag" size={14} color="#10b981" />
              <Text style={styles.discountPreviewText}>ลด {discountPercent}% จากราคาปกติ</Text>
            </View>
          )}

          <View style={styles.fieldRow}>
            <View style={[styles.fieldGroup, { flex: 1 }]}>
              <Text style={styles.fieldLabel}>จำนวน <Text style={styles.required}>*</Text></Text>
              <TextInput style={styles.input} placeholder="0" keyboardType="numeric" value={quantity} onChangeText={setQuantity} />
            </View>
            <View style={[styles.fieldGroup, { flex: 1 }]}>
              <Text style={styles.fieldLabel}>หน่วย</Text>
              <TouchableOpacity style={styles.selectInput} onPress={() => setShowUnitModal(true)}>
                <Text style={styles.selectText}>{unit}</Text>
                <Ionicons name="chevron-down" size={18} color="#9ca3af" />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>น้ำหนักต่อหน่วย (kg)</Text>
            <TextInput
              style={styles.input}
              placeholder={`ค่าเริ่มต้น ${WEIGHT_PER_BOX_KG} kg`}
              placeholderTextColor="#9ca3af"
              keyboardType="numeric"
              value={weightPerUnit}
              onChangeText={setWeightPerUnit}
            />
            <Text style={styles.weightHint}>
              ใช้คำนวณ Food Waste Saved — หากไม่กรอก ระบบใช้ค่าเริ่มต้น {WEIGHT_PER_BOX_KG} kg
            </Text>
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>รายละเอียดสินค้า</Text>
            <TextInput style={[styles.input, styles.inputMultiline]} placeholder="บอกเล่าเกี่ยวกับสินค้า..." multiline numberOfLines={4} textAlignVertical="top" value={description} onChangeText={setDescription} />
          </View>
        </View>

        {name.trim() && discountPrice ? (
          <View style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>ตัวอย่างการแสดงผล</Text>
            <View style={styles.summaryRow}>
              <View style={styles.summaryImageWrap}>
                {imageUri
                  ? <Image source={{ uri: imageUri }} style={styles.summaryImage} />
                  : <View style={[styles.summaryImage, { backgroundColor: '#d1fae5', justifyContent: 'center', alignItems: 'center' }]}>
                      <Ionicons name="fast-food-outline" size={24} color="#10b981" />
                    </View>
                }
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.summaryName} numberOfLines={1}>{name}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 }}>
                  {originalPrice ? <Text style={styles.summaryOriginal}>฿{originalPrice}</Text> : null}
                  <Text style={styles.summaryPrice}>฿{discountPrice}</Text>
                  {discountPercent > 0 && (
                    <View style={styles.summaryBadge}>
                      <Text style={styles.summaryBadgeText}>-{discountPercent}%</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.summaryMeta}>{quantity || '0'} {unit} · {category}</Text>
              </View>
            </View>

            {qty > 0 && (
              <View style={styles.impactRow}>
                <View style={styles.impactItem}>
                  <Ionicons name="leaf-outline" size={18} color="#10b981" />
                  <View>
                    <Text style={styles.impactLabel}>Food Waste Saved</Text>
                    <Text style={styles.impactValue}>{foodWasteSaved.toFixed(2)} kg</Text>
                  </View>
                </View>
                <View style={styles.impactDivider} />
                <View style={styles.impactItem}>
                  <Ionicons name="cloud-outline" size={18} color="#3b82f6" />
                  <View>
                    <Text style={styles.impactLabel}>CO2 Saved</Text>
                    <Text style={[styles.impactValue, { color: '#3b82f6' }]}>{co2Saved.toFixed(2)} kg</Text>
                  </View>
                </View>
              </View>
            )}
          </View>
        ) : null}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom > 0 ? insets.bottom : 16 }]}>
        <TouchableOpacity style={[styles.submitBtn, loading && { opacity: 0.7 }]} onPress={handleSubmit} disabled={loading} activeOpacity={0.85}>
          {loading
            ? <ActivityIndicator color="#fff" />
            : <>
                <Ionicons name={isEditMode ? 'checkmark-circle-outline' : 'cloud-upload-outline'} size={20} color="#fff" />
                <Text style={styles.submitBtnText}>{isEditMode ? 'บันทึกการแก้ไข' : 'โพสต์สินค้า'}</Text>
              </>
          }
        </TouchableOpacity>
      </View>

      <Modal visible={showUnitModal} transparent animationType="fade" onRequestClose={() => setShowUnitModal(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowUnitModal(false)}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>เลือกหน่วย</Text>
            {UNIT_OPTIONS.map(u => (
              <TouchableOpacity key={u} style={[styles.modalOption, u === unit && styles.modalOptionActive]} onPress={() => { setUnit(u); setShowUnitModal(false); }}>
                <Text style={[styles.modalOptionText, u === unit && styles.modalOptionTextActive]}>{u}</Text>
                {u === unit && <Ionicons name="checkmark" size={18} color="#10b981" />}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      <Modal visible={showCategoryModal} transparent animationType="fade" onRequestClose={() => setShowCategoryModal(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowCategoryModal(false)}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>เลือกหมวดหมู่</Text>
            {CATEGORY_OPTIONS.map(c => (
              <TouchableOpacity key={c.label} style={[styles.modalOption, c.label === category && styles.modalOptionActive]} onPress={() => { setCategory(c.label); setShowCategoryModal(false); }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <Ionicons name={c.icon} size={18} color={c.label === category ? '#10b981' : '#6b7280'} />
                  <Text style={[styles.modalOptionText, c.label === category && styles.modalOptionTextActive]}>{c.label}</Text>
                </View>
                {c.label === category && <Ionicons name="checkmark" size={18} color="#10b981" />}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 14, backgroundColor: '#10b981' },
  backBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '800', color: '#fff', letterSpacing: 0.5 },
  content: { flex: 1 },
  imagePicker: { width: '100%', height: 220, backgroundColor: '#fff', position: 'relative', overflow: 'hidden' },
  pickedImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  imageEditBadge: { position: 'absolute', bottom: 12, right: 12, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(0,0,0,0.55)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  imageEditText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  imagePlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  imagePlaceholderIcon: { width: 70, height: 70, borderRadius: 35, backgroundColor: '#f0fdf4', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#a7f3d0', marginBottom: 4 },
  imagePlaceholderTitle: { fontSize: 15, fontWeight: '700', color: '#1f2937' },
  imagePlaceholderSub: { fontSize: 13, color: '#9ca3af' },
  formSection: { padding: 16, gap: 4 },
  fieldGroup: { marginBottom: 16 },
  fieldRow: { flexDirection: 'row', gap: 12, marginBottom: 0 },
  fieldLabel: { fontSize: 13, fontWeight: '700', color: '#374151', marginBottom: 8 },
  required: { color: '#ef4444' },
  input: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: '#1f2937' },
  inputHighlight: { borderColor: '#10b981', borderWidth: 1.5 },
  inputMultiline: { minHeight: 100, textAlignVertical: 'top' },
  selectInput: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  selectLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  selectText: { fontSize: 15, color: '#1f2937' },
  discountPreview: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#f0fdf4', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, marginBottom: 16, borderWidth: 1, borderColor: '#a7f3d0' },
  discountPreviewText: { fontSize: 13, color: '#059669', fontWeight: '600' },
  weightHint: { fontSize: 12, color: '#9ca3af', marginTop: 6 },
  summaryCard: { marginHorizontal: 16, marginBottom: 16, backgroundColor: '#fff', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#e5e7eb', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  summaryTitle: { fontSize: 11, fontWeight: '700', color: '#9ca3af', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 12 },
  summaryRow: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  summaryImageWrap: { borderRadius: 10, overflow: 'hidden' },
  summaryImage: { width: 64, height: 64, borderRadius: 10 },
  summaryName: { fontSize: 15, fontWeight: '700', color: '#1f2937' },
  summaryOriginal: { fontSize: 12, color: '#9ca3af', textDecorationLine: 'line-through' },
  summaryPrice: { fontSize: 18, fontWeight: '800', color: '#10b981' },
  summaryBadge: { backgroundColor: '#10b981', borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 },
  summaryBadgeText: { fontSize: 11, fontWeight: '800', color: '#fff' },
  summaryMeta: { fontSize: 12, color: '#6b7280', marginTop: 4 },
  impactRow: { flexDirection: 'row', alignItems: 'center', marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: '#f3f4f6' },
  impactItem: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  impactDivider: { width: 1, height: 36, backgroundColor: '#e5e7eb', marginHorizontal: 8 },
  impactLabel: { fontSize: 11, color: '#6b7280', fontWeight: '600' },
  impactValue: { fontSize: 15, fontWeight: '800', color: '#10b981', marginTop: 1 },
  footer: { padding: 16, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#f3f4f6' },
  submitBtn: { backgroundColor: '#10b981', borderRadius: 14, paddingVertical: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, shadowColor: '#10b981', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 6 },
  submitBtnText: { fontSize: 16, fontWeight: '800', color: '#fff', letterSpacing: 0.5 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  modalBox: { backgroundColor: '#fff', borderRadius: 20, padding: 20, width: '100%', maxWidth: 340, shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.15, shadowRadius: 20, elevation: 10 },
  modalTitle: { fontSize: 16, fontWeight: '800', color: '#1f2937', marginBottom: 16 },
  modalOption: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, paddingHorizontal: 4, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  modalOptionActive: { backgroundColor: '#f0fdf4', borderRadius: 8, paddingHorizontal: 8, marginHorizontal: -4 },
  modalOptionText: { fontSize: 15, color: '#374151' },
  modalOptionTextActive: { color: '#10b981', fontWeight: '700' },
});