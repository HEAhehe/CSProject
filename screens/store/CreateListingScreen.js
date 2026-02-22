import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Image,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Modal // ✅ นำเข้า Modal สำหรับทำป๊อปอัป
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { auth, db } from '../../firebase.config';
import { collection, addDoc, updateDoc, doc, getDoc, serverTimestamp } from 'firebase/firestore';

export default function CreateListingScreen({ navigation, route }) {
  const editItem = route?.params?.editItem;
  const isEditing = !!editItem;

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    fullPrice: '',
    price: '',
    amount: '',
    weightOrVolume: '',
  });

  const [sellingUnit, setSellingUnit] = useState('ชิ้น');
  const [measureUnit, setMeasureUnit] = useState('g');

  const [imageUri, setImageUri] = useState(null);
  const [loading, setLoading] = useState(false);
  const [storeName, setStoreName] = useState('');

  const [selectedCategory, setSelectedCategory] = useState('เบเกอรี่ / ขนมปัง');

  // ✅ State สำหรับควบคุม Custom Alert
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertConfig, setAlertConfig] = useState({
    title: '',
    message: '',
    type: 'error', // 'success' | 'error'
    onConfirm: null
  });

  const foodCategories = [
    { id: 'bakery', label: 'เบเกอรี่ / ขนมปัง', icon: 'pie-chart' },
    { id: 'box', label: 'อาหารกล่อง / ข้าวกล่อง', icon: 'restaurant' },
    { id: 'drink', label: 'เครื่องดื่ม/น้ำ', icon: 'cafe' },
    { id: 'fresh', label: 'อาหารสด/วัตถุดิบ', icon: 'leaf' },
    { id: 'set', label: 'อาหารชุด / Box set', icon: 'gift' },
    { id: 'snack', label: 'ของหวาน / ทานเล่น', icon: 'ice-cream' },
  ];

  const isDrinkCategory = selectedCategory === 'เครื่องดื่ม/น้ำ';
  const isSetCategory = selectedCategory === 'อาหารชุด / Box set';

  let availableSellingUnits = ['กล่อง', 'ชิ้น', 'แพ็ค', 'ถุง'];
  if (isDrinkCategory) {
    availableSellingUnits = ['แก้ว', 'ขวด', 'แพ็ค', 'ถุง'];
  } else if (isSetCategory) {
    availableSellingUnits = ['ชุด', 'กล่อง'];
  }

  const availableMeasureUnits = isDrinkCategory
    ? [
        { id: 'ml', label: 'มล. (ml)' },
        { id: 'L', label: 'ลิตร (L)' }
      ]
    : [
        { id: 'g', label: 'กรัม (g)' },
        { id: 'kg', label: 'กิโลกรัม (kg)' }
      ];

  // ✅ ฟังก์ชันเรียกโชว์ป๊อปอัป
  const showCustomAlert = (title, message, type = 'error', onConfirm = null) => {
    setAlertConfig({ title, message, type, onConfirm });
    setAlertVisible(true);
  };

  useEffect(() => {
    loadStoreName();
    if (editItem) {
      setFormData({
        name: editItem.name || '',
        description: editItem.description || '',
        fullPrice: String(editItem.originalPrice || ''),
        price: String(editItem.discountPrice || ''),
        amount: String(editItem.quantity || ''),
        weightOrVolume: String(editItem.measureValue || editItem.weight || editItem.volume || ''),
      });
      setImageUri(editItem.imageUrl);
      setSelectedCategory(editItem.category || 'เบเกอรี่ / ขนมปัง');
      setSellingUnit(editItem.sellingUnit || editItem.unit || 'ชิ้น');
      setMeasureUnit(editItem.measureUnit || 'g');
    }
  }, [editItem]);

  const loadStoreName = async () => {
    try {
      const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
      if (userDoc.exists()) {
        setStoreName(userDoc.data().username || 'ร้านค้าไม่มีชื่อ');
      }
    } catch (error) {
      console.error("Error loading store name:", error);
    }
  };

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      showCustomAlert('สิทธิ์ถูกปฏิเสธ', 'กรุณาอนุญาตให้เข้าถึงรูปภาพเพื่ออัปโหลดรูปอาหาร', 'error');
      return;
    }

    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.15,
      base64: true,
    });

    if (!result.canceled) {
      setImageUri(`data:image/jpeg;base64,${result.assets[0].base64}`);
    }
  };

  const handleCategorySelect = (catLabel) => {
    setSelectedCategory(catLabel);

    if (catLabel === 'เบเกอรี่ / ขนมปัง') {
        setSellingUnit('ชิ้น'); setMeasureUnit('g');
    } else if (catLabel === 'อาหารกล่อง / ข้าวกล่อง') {
        setSellingUnit('กล่อง'); setMeasureUnit('g');
    } else if (catLabel === 'เครื่องดื่ม/น้ำ') {
        setSellingUnit('แก้ว'); setMeasureUnit('ml');
    } else if (catLabel === 'อาหารสด/วัตถุดิบ') {
        setSellingUnit('แพ็ค'); setMeasureUnit('kg');
    } else if (catLabel === 'อาหารชุด / Box set') {
        setSellingUnit('ชุด'); setMeasureUnit('g');
    } else if (catLabel === 'ของหวาน / ทานเล่น') {
        setSellingUnit('ชิ้น'); setMeasureUnit('g');
    }
  };

  const validateForm = () => {
    if (!formData.name || !formData.fullPrice || !formData.price || !formData.amount || !formData.weightOrVolume) {
      showCustomAlert('ข้อมูลไม่ครบ', 'กรุณากรอกข้อมูลที่มีเครื่องหมาย * ให้ครบถ้วนครับ', 'error');
      return false;
    }
    return true;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    setLoading(true);
    try {
      const user = auth.currentUser;

      const itemData = {
        userId: user.uid,
        storeName: storeName,
        name: formData.name.trim(),
        description: formData.description.trim(),
        category: selectedCategory,
        originalPrice: Number(formData.fullPrice),
        discountPrice: Number(formData.price),
        price: Number(formData.price),
        quantity: Number(formData.amount),

        sellingUnit: sellingUnit,
        measureValue: Number(formData.weightOrVolume),
        measureUnit: measureUnit,
        unit: sellingUnit,

        imageUrl: imageUri,
        updatedAt: serverTimestamp(),
      };

      if (isEditing) {
        await updateDoc(doc(db, 'food_items', editItem.id), itemData);
        showCustomAlert('สำเร็จ!', 'อัปเดตรายการเรียบร้อยแล้ว', 'success', () => navigation.goBack());
      } else {
        const newItemData = {
          ...itemData,
          createdAt: serverTimestamp(),
          status: 'active',
          soldCount: 0
        };
        await addDoc(collection(db, 'food_items'), newItemData);
        showCustomAlert('สำเร็จ!', 'เพิ่มรายการอาหารเรียบร้อยแล้ว', 'success', () => navigation.goBack());
      }
    } catch (error) {
      console.error('Error saving item:', error);
      showCustomAlert('ผิดพลาด', 'ไม่สามารถบันทึกข้อมูลได้ เนื่องจากขนาดรูปภาพอาจใหญ่เกินไป', 'error');
    } finally {
      setLoading(false);
    }
  };

  const measureLabelText = isDrinkCategory ? `ปริมาตร ต่อ 1 ${sellingUnit} *` : `น้ำหนักรวม ต่อ 1 ${sellingUnit} *`;
  const measurePlaceholder = isDrinkCategory ? 'เช่น 250' : (measureUnit === 'kg' ? 'เช่น 1.5' : 'เช่น 350');

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#1f2937" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{isEditing ? 'แก้ไขรายการ' : 'เพิ่มรายการใหม่'}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <TouchableOpacity style={styles.imagePickerContainer} onPress={pickImage}>
          {imageUri ? (
            <View style={styles.imageWrapper}>
              <Image source={{ uri: imageUri }} style={styles.previewImage} />
              <View style={styles.cameraBadge}>
                <Ionicons name="camera" size={20} color="#fff" />
              </View>
            </View>
          ) : (
            <View style={styles.placeholderBox}>
              <Ionicons name="image-outline" size={48} color="#9ca3af" />
              <Text style={styles.placeholderText}>กดเพื่อเพิ่มรูปภาพอาหาร</Text>
            </View>
          )}
        </TouchableOpacity>

        <View style={styles.form}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>หมวดหมู่อาหาร *</Text>
            <View style={styles.categoryContainer}>
              {foodCategories.map((category) => (
                <TouchableOpacity
                  key={category.id}
                  style={[
                    styles.categoryButton,
                    selectedCategory === category.label && styles.categoryButtonActive
                  ]}
                  onPress={() => handleCategorySelect(category.label)}
                >
                  <Ionicons
                    name={selectedCategory === category.label ? "checkmark-circle" : category.icon}
                    size={20}
                    color={selectedCategory === category.label ? '#fff' : '#10b981'}
                  />
                  <Text
                    style={[
                      styles.categoryButtonText,
                      selectedCategory === category.label && styles.categoryButtonTextActive
                    ]}
                    textAlign="center"
                  >
                    {category.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>ชื่ออาหาร *</Text>
            <TextInput
              style={styles.input}
              placeholder={isSetCategory ? "เช่น เซ็ตข้าวปลาแกะ+ชาไทย" : "เช่น ข้าวกล่องกะเพราไข่ดาว"}
              value={formData.name}
              onChangeText={(text) => setFormData({...formData, name: text})}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>รายละเอียดสินค้า (ไม่บังคับ)</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="ระบุส่วนผสม, วิธีอุ่น, หรือข้อควรระวังสำหรับผู้แพ้อาหาร..."
              value={formData.description}
              onChangeText={(text) => setFormData({...formData, description: text})}
              multiline={true}
              numberOfLines={3}
              textAlignVertical="top"
              placeholderTextColor="#9ca3af"
            />
          </View>

          <View style={styles.row}>
            <View style={[styles.inputGroup, { flex: 1 }]}>
              <Text style={styles.label}>ราคาปกติ (บาท) *</Text>
              <TextInput
                style={styles.input}
                placeholder="0"
                keyboardType="numeric"
                value={formData.fullPrice}
                onChangeText={(text) => setFormData({...formData, fullPrice: text})}
              />
            </View>
            <View style={[styles.inputGroup, { flex: 1, marginLeft: 15 }]}>
              <Text style={styles.label}>ราคาลด (บาท) *</Text>
              <TextInput
                style={styles.input}
                placeholder="0"
                keyboardType="numeric"
                value={formData.price}
                onChangeText={(text) => setFormData({...formData, price: text})}
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>จำนวนที่ต้องการขาย *</Text>
            <View style={styles.measureRow}>
              <View style={styles.measureInputWrap}>
                <TextInput
                  style={styles.measureInput}
                  placeholder="0"
                  keyboardType="numeric"
                  value={formData.amount}
                  onChangeText={(text) => setFormData({...formData, amount: text})}
                />
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipContainer}>
                {availableSellingUnits.map((u) => (
                  <TouchableOpacity
                    key={u}
                    style={[styles.unitChip, sellingUnit === u && styles.unitChipActive]}
                    onPress={() => setSellingUnit(u)}
                  >
                    <Text style={[styles.unitChipText, sellingUnit === u && styles.unitChipTextActive]}>{u}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>{measureLabelText}</Text>
            <View style={styles.measureRow}>
              <View style={styles.measureInputWrap}>
                <TextInput
                  style={styles.measureInput}
                  placeholder={measurePlaceholder}
                  keyboardType="numeric"
                  value={formData.weightOrVolume}
                  onChangeText={(text) => setFormData({...formData, weightOrVolume: text})}
                />
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipContainer}>
                {availableMeasureUnits.map((u) => (
                  <TouchableOpacity
                    key={u.id}
                    style={[styles.unitChip, measureUnit === u.id && styles.unitChipActive]}
                    onPress={() => setMeasureUnit(u.id)}
                  >
                    <Text style={[styles.unitChipText, measureUnit === u.id && styles.unitChipTextActive]}>{u.label}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </View>
          <Text style={styles.weightHintText}>
            <Ionicons name="leaf" size={12} color="#10b981" /> ข้อมูลน้ำหนักจะนำไปใช้คำนวณการลด Food Waste
          </Text>

        </View>
        <View style={{ height: 40 }} />
      </ScrollView>

      {/* ✅ ส่วน Custom Alert Modal */}
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
                alertConfig.type === 'success' ? { backgroundColor: '#10b981' } : { backgroundColor: '#ef4444' }
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
          style={[styles.submitButton, loading && styles.disabledButton]}
          onPress={handleSubmit}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.submitButtonText}>
              {isEditing ? 'บันทึกการแก้ไข' : 'ลงประกาศขาย'}
            </Text>
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
    paddingTop: Platform.OS === 'ios' ? 50 : 40,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
    backgroundColor: '#fff',
  },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#1f2937' },
  backButton: { padding: 8 },
  content: { flex: 1, padding: 20 },
  imagePickerContainer: {
    width: '100%',
    height: 220,
    marginBottom: 25,
  },
  placeholderBox: {
    flex: 1,
    backgroundColor: '#f9fafb',
    borderWidth: 2,
    borderColor: '#e5e7eb',
    borderStyle: 'dashed',
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: { marginTop: 12, color: '#9ca3af', fontSize: 14 },
  imageWrapper: { flex: 1, position: 'relative' },
  previewImage: { width: '100%', height: '100%', borderRadius: 20 },
  cameraBadge: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    backgroundColor: '#10b981',
    padding: 10,
    borderRadius: 25,
    elevation: 4,
  },
  form: { gap: 15 },
  label: { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 8 },
  categoryContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  categoryButton: {
    width: '48%',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 2,
    paddingVertical: 12,
    borderRadius: 15,
    borderWidth: 1.5,
    borderColor: '#10b981',
    backgroundColor: '#fff',
    marginBottom: 10,
    gap: 5,
  },
  categoryButtonActive: {
    backgroundColor: '#10b981',
    borderColor: '#10b981',
  },
  categoryButtonText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#10b981',
  },
  categoryButtonTextActive: {
    color: '#fff',
  },
  input: {
    backgroundColor: '#f3f4f6',
    borderRadius: 12,
    padding: 15,
    fontSize: 16,
    color: '#1f2937',
  },
  textArea: {
    height: 80,
    paddingTop: 15,
  },
  row: { flexDirection: 'row' },
  inputGroup: { marginBottom: 5 },
  measureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10
  },
  measureInputWrap: {
    width: 90,
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    justifyContent: 'center'
  },
  measureInput: {
    paddingVertical: 12,
    paddingHorizontal: 15,
    fontSize: 15,
    color: '#1f2937',
    textAlign: 'center'
  },
  chipContainer: {
    gap: 8,
    alignItems: 'center',
    paddingRight: 20
  },
  unitChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  unitChipActive: {
    backgroundColor: '#10b981',
    borderColor: '#10b981',
  },
  unitChipText: {
    fontSize: 13,
    color: '#6b7280',
    fontWeight: '600'
  },
  unitChipTextActive: {
    color: '#fff',
    fontWeight: 'bold'
  },
  weightHintText: {
    fontSize: 12,
    color: '#10b981',
    marginTop: -5,
    marginBottom: 10,
    marginLeft: 5,
    fontStyle: 'italic'
  },
  footer: {
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 40 : 20,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  submitButton: {
    backgroundColor: '#10b981',
    paddingVertical: 16,
    borderRadius: 15,
    alignItems: 'center',
  },
  disabledButton: { backgroundColor: '#a7f3d0' },
  submitButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },

  // ✅ สไตล์สำหรับ Custom Alert Modal
  alertOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  alertBox: { backgroundColor: '#fff', borderRadius: 24, padding: 25, alignItems: 'center', width: '85%', shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.1, shadowRadius: 10, elevation: 10 },
  alertIconCircle: { width: 70, height: 70, borderRadius: 35, justifyContent: 'center', alignItems: 'center', marginBottom: 15 },
  alertTitle: { fontSize: 20, fontWeight: 'bold', color: '#1f2937', marginBottom: 10 },
  alertMessage: { fontSize: 14, color: '#6b7280', textAlign: 'center', marginBottom: 25, lineHeight: 22 },
  alertButton: { paddingVertical: 14, borderRadius: 12, width: '100%', alignItems: 'center' },
  alertButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
});