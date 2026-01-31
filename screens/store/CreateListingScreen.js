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
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';

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

  const [imageUri, setImageUri] = useState(null);
  const [loading, setLoading] = useState(false);
  const [storeName, setStoreName] = useState('');

  useEffect(() => {
    loadStoreName();
    if (editItem) {
      const discount = editItem.originalPrice && editItem.discountPrice 
        ? Math.round(((editItem.originalPrice - editItem.discountPrice) / editItem.originalPrice) * 100)
        : 0;

      setFormData({
        name: editItem.name || '',
        fullPrice: String(editItem.originalPrice || ''),
        price: String(editItem.discountPrice || editItem.price || ''),
        amount: String(editItem.quantity || ''),
        closedForSale: editItem.expiryDate || '',
      });
      setImageUri(editItem.imageUrl);
    }
  }, []);

  const loadStoreName = async () => {
    try {
      const user = auth.currentUser;
      if (user) {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          setStoreName(userData.storeName || userData.username || 'ร้านค้า');
        }
      }
    } catch (error) {
      console.error('Error loading store name:', error);
    }
  };

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('ขออนุญาต', 'กรุณาอนุญาตให้เข้าถึงรูปภาพ');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setImageUri(result.assets[0].uri);
    }
  };

  const uploadImage = async (uri) => {
    try {
      const user = auth.currentUser;
      const response = await fetch(uri);
      const blob = await response.blob();
      
      const storage = getStorage();
      const filename = `food_${Date.now()}.jpg`;
      const storageRef = ref(storage, `food_images/${user.uid}/${filename}`);
      
      await uploadBytes(storageRef, blob);
      const downloadURL = await getDownloadURL(storageRef);
      
      return downloadURL;
    } catch (error) {
      console.error('Error uploading image:', error);
      throw error;
    }
  };

  const calculateDiscount = () => {
    const full = Number(formData.fullPrice) || 0;
    const discounted = Number(formData.price) || 0;
    if (full > 0 && discounted > 0 && discounted < full) {
      return Math.round(((full - discounted) / full) * 100);
    }
    return 0;
  };

  const validateForm = () => {
    if (!formData.name.trim()) {
      Alert.alert('ผิดพลาด', 'กรุณากรอกชื่อเมนู');
      return false;
    }
    if (!formData.fullPrice || Number(formData.fullPrice) <= 0) {
      Alert.alert('ผิดพลาด', 'กรุณากรอกราคาเต็ม');
      return false;
    }
    if (!formData.price || Number(formData.price) <= 0) {
      Alert.alert('ผิดพลาด', 'กรุณากรอกราคา');
      return false;
    }
    if (!formData.amount || Number(formData.amount) <= 0) {
      Alert.alert('ผิดพลาด', 'กรุณากรอกจำนวน');
      return false;
    }
    return true;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    setLoading(true);
    try {
      const user = auth.currentUser;
      let imageUrl = editItem?.imageUrl || null;

      // อัปโหลดรูปถ้ามีการเปลี่ยน
      if (imageUri && imageUri !== editItem?.imageUrl) {
        imageUrl = await uploadImage(imageUri);
      }

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
        imageUrl: imageUrl,
        updatedAt: serverTimestamp(),
      };

      if (isEditing) {
        await updateDoc(doc(db, 'food_items', editItem.id), itemData);
        Alert.alert('สำเร็จ', 'อัปเดตรายการเรียบร้อย', [
          { text: 'ตกลง', onPress: () => navigation.goBack() }
        ]);
      } else {
        itemData.createdAt = serverTimestamp();
        await addDoc(collection(db, 'food_items'), itemData);
        Alert.alert('สำเร็จ', 'เพิ่มรายการเรียบร้อย', [
          { text: 'ตกลง', onPress: () => navigation.goBack() }
        ]);
      }
    } catch (error) {
      console.error('Error saving item:', error);
      Alert.alert('ผิดพลาด', 'ไม่สามารถบันทึกข้อมูลได้');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    navigation.goBack();
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleCancel} style={styles.menuButton}>
          <Ionicons name="menu" size={24} color="#1f2937" />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Ionicons name="storefront" size={20} color="#1f2937" />
          <Text style={styles.headerTitle}>CREATE LISTING</Text>
        </View>
        <TouchableOpacity onPress={() => navigation.navigate('Profile')} style={styles.profileButton}>
          <Ionicons name="person-circle-outline" size={28} color="#6b7280" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Image Picker */}
        <View style={styles.imageSection}>
          <TouchableOpacity style={styles.imageBox} onPress={pickImage}>
            {imageUri ? (
              <Image source={{ uri: imageUri }} style={styles.selectedImage} />
            ) : (
              <View style={styles.imagePlaceholder}>
                <Ionicons name="image-outline" size={40} color="#d1d5db" />
              </View>
            )}
          </TouchableOpacity>

          <TouchableOpacity style={styles.uploadButton} onPress={pickImage}>
            <Text style={styles.uploadButtonText}>UPLOAD PIC</Text>
          </TouchableOpacity>
        </View>

        {/* Form */}
        <View style={styles.formContainer}>
          {/* Menu */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Menu</Text>
            <TextInput
              style={styles.input}
              placeholder=""
              value={formData.name}
              onChangeText={(text) => setFormData({ ...formData, name: text })}
            />
          </View>

          {/* Full Price */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Full Price</Text>
            <TextInput
              style={styles.input}
              placeholder=""
              keyboardType="numeric"
              value={formData.fullPrice}
              onChangeText={(text) => setFormData({ ...formData, fullPrice: text.replace(/[^0-9]/g, '') })}
            />
          </View>

          {/* Price */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Price</Text>
            <TextInput
              style={styles.input}
              placeholder=""
              keyboardType="numeric"
              value={formData.price}
              onChangeText={(text) => setFormData({ ...formData, price: text.replace(/[^0-9]/g, '') })}
            />
          </View>

          {/* Discount */}
          <View style={styles.discountGroup}>
            <Text style={styles.label}>Discount</Text>
            <View style={styles.discountDisplay}>
              <Text style={styles.discountValue}>{calculateDiscount()}</Text>
              <Text style={styles.discountPercent}>%</Text>
            </View>
          </View>

          {/* Amount */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Amount</Text>
            <TextInput
              style={styles.input}
              placeholder=""
              keyboardType="numeric"
              value={formData.amount}
              onChangeText={(text) => setFormData({ ...formData, amount: text.replace(/[^0-9]/g, '') })}
            />
          </View>

          {/* Closed For Sale */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Closed For Sale</Text>
            <View style={styles.dateInput}>
              <Ionicons name="calendar-outline" size={20} color="#6b7280" style={styles.calendarIcon} />
              <TextInput
                style={styles.dateTextInput}
                placeholder="เลือกวันที่"
                value={formData.closedForSale}
                onChangeText={(text) => setFormData({ ...formData, closedForSale: text })}
              />
            </View>
          </View>
        </View>

        <View style={{ height: 120 }} />
      </ScrollView>

      {/* Bottom Buttons */}
      <View style={styles.bottomButtons}>
        <TouchableOpacity style={styles.cancelButton} onPress={handleCancel}>
          <Text style={styles.cancelButtonText}>CANCEL</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.postButton} 
          onPress={handleSubmit}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#1f2937" />
          ) : (
            <Text style={styles.postButtonText}>POST</Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 15,
    backgroundColor: '#fff',
  },
  menuButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
  },
  profileButton: {
    width: 40,
  },
  content: {
    flex: 1,
  },
  imageSection: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    gap: 15,
  },
  imageBox: {
    width: 120,
    height: 120,
    borderRadius: 12,
    backgroundColor: '#f3f4f6',
    borderWidth: 2,
    borderColor: '#e5e7eb',
    overflow: 'hidden',
  },
  selectedImage: {
    width: '100%',
    height: '100%',
  },
  imagePlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadButton: {
    flex: 1,
    backgroundColor: '#f3f4f6',
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: 'center',
  },
  uploadButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
  },
  formContainer: {
    paddingHorizontal: 20,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    color: '#1f2937',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#f3f4f6',
    padding: 15,
    borderRadius: 12,
    fontSize: 14,
    color: '#1f2937',
  },
  discountGroup: {
    marginBottom: 20,
  },
  discountDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    borderRadius: 12,
    paddingLeft: 15,
  },
  discountValue: {
    fontSize: 14,
    color: '#1f2937',
    paddingVertical: 15,
  },
  discountPercent: {
    fontSize: 14,
    color: '#1f2937',
    marginLeft: 8,
  },
  dateInput: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    borderRadius: 12,
    paddingHorizontal: 15,
  },
  calendarIcon: {
    marginRight: 10,
  },
  dateTextInput: {
    flex: 1,
    paddingVertical: 15,
    fontSize: 14,
    color: '#1f2937',
  },
  bottomButtons: {
    flexDirection: 'row',
    padding: 20,
    gap: 15,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#f3f4f6',
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
  },
  postButton: {
    flex: 1,
    backgroundColor: '#f3f4f6',
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: 'center',
  },
  postButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
  },
});