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
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform
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
    fullPrice: '',
    price: '',
    amount: '',
    closedForSale: '',
  });

  const [imageUri, setImageUri] = useState(null); // ตัวแปรนี้จะเก็บ String Base64
  const [loading, setLoading] = useState(false);
  const [storeName, setStoreName] = useState('');

  useEffect(() => {
    loadStoreName();
    if (editItem) {
      setFormData({
        name: editItem.name || '',
        fullPrice: String(editItem.originalPrice || ''),
        price: String(editItem.discountPrice || ''),
        amount: String(editItem.quantity || ''),
        closedForSale: editItem.expiryDate || '',
      });
      setImageUri(editItem.imageUrl);
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
      Alert.alert('สิทธิ์ถูกปฏิเสธ', 'กรุณาอนุญาตให้เข้าถึงรูปภาพเพื่ออัปโหลดรูปอาหาร');
      return;
    }

    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'], // แก้ไข warning deprecated
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.15, // บีบอัดให้เล็กลงมากเพื่อให้ String ไม่เกิน 1MB
      base64: true, // สั่งให้คืนค่าเป็น Base64
    });

    if (!result.canceled) {
      // เก็บข้อมูลในรูปแบบ Base64 URI
      setImageUri(`data:image/jpeg;base64,${result.assets[0].base64}`);
    }
  };

  const validateForm = () => {
    if (!formData.name || !formData.fullPrice || !formData.price || !formData.amount) {
      Alert.alert('ข้อมูลไม่ครบ', 'กรุณากรอกข้อมูลที่มีเครื่องหมาย * ให้ครบถ้วน');
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
        originalPrice: Number(formData.fullPrice),
        discountPrice: Number(formData.price),
        price: Number(formData.price),
        quantity: Number(formData.amount),
        unit: 'ชุด',
        expiryDate: formData.closedForSale,
        imageUrl: imageUri, // บันทึก String Base64 ลง Firestore โดยตรง
        updatedAt: serverTimestamp(),
      };

      if (isEditing) {
        await updateDoc(doc(db, 'food_items', editItem.id), itemData);
        Alert.alert('สำเร็จ', 'อัปเดตรายการเรียบร้อย', [
          { text: 'ตกลง', onPress: () => navigation.goBack() }
        ]);
      } else {
        const newItemData = {
          ...itemData,
          createdAt: serverTimestamp(),
          status: 'active',
          soldCount: 0
        };
        await addDoc(collection(db, 'food_items'), newItemData);
        Alert.alert('สำเร็จ', 'เพิ่มรายการเรียบร้อย', [
          { text: 'ตกลง', onPress: () => navigation.goBack() }
        ]);
      }
    } catch (error) {
      console.error('Error saving item:', error);
      // ส่วนใหญ่ถ้า Error ตรงนี้ในวิธี Base64 มักเกิดจากขนาดรูปใหญ่เกิน 1MB
      Alert.alert('ผิดพลาด', 'ไม่สามารถบันทึกข้อมูลได้ เนื่องจากขนาดรูปภาพอาจใหญ่เกินไป');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <StatusBar barStyle="dark-content" />
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
            <Text style={styles.label}>ชื่ออาหาร *</Text>
            <TextInput
              style={styles.input}
              placeholder="เช่น ข้าวกล่องกะเพราไข่ดาว"
              value={formData.name}
              onChangeText={(text) => setFormData({...formData, name: text})}
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
            <Text style={styles.label}>จำนวนที่มี (ชุด) *</Text>
            <TextInput
              style={styles.input}
              placeholder="0"
              keyboardType="numeric"
              value={formData.amount}
              onChangeText={(text) => setFormData({...formData, amount: text})}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>ปิดรับออเดอร์เวลา</Text>
            <TextInput
              style={styles.input}
              placeholder="เช่น 19:30"
              value={formData.closedForSale}
              onChangeText={(text) => setFormData({...formData, closedForSale: text})}
            />
          </View>
        </View>
        <View style={{ height: 40 }} />
      </ScrollView>

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
    paddingTop: Platform.OS === 'ios' ? 50 : 20,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
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
  input: {
    backgroundColor: '#f3f4f6',
    borderRadius: 12,
    padding: 15,
    fontSize: 16,
    color: '#1f2937',
  },
  row: { flexDirection: 'row' },
  inputGroup: { marginBottom: 5 },
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
});