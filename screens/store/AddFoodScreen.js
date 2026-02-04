import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { db, auth } from '../../firebase.config';
import { collection, addDoc } from 'firebase/firestore';
import * as ImagePicker from 'expo-image-picker';
import DateTimePicker from '@react-native-community/datetimepicker';

export default function AddFoodScreen({ navigation }) {
  const [foodName, setFoodName] = useState('');
  const [category, setCategory] = useState('');
  const [quantity, setQuantity] = useState('');
  const [expiryDate, setExpiryDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [foodImage, setFoodImage] = useState(null);
  const [loading, setLoading] = useState(false);

  const categories = [
    { id: 'vegetable', name: 'ผัก', icon: 'leaf' },
    { id: 'fruit', name: 'ผลไม้', icon: 'nutrition' },
    { id: 'meat', name: 'เนื้อสัตว์', icon: 'fish' },
    { id: 'dairy', name: 'นม/ไข่', icon: 'egg' },
    { id: 'grain', name: 'ธัญพืช', icon: 'pizza' },
    { id: 'other', name: 'อื่นๆ', icon: 'fast-food' },
  ];

  const pickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (status !== 'granted') {
        Alert.alert('ต้องการสิทธิ์', 'แอปต้องการสิทธิ์เข้าถึงคลังรูปภาพ');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.5,
      });

      if (!result.canceled) {
        setFoodImage(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('ข้อผิดพลาด', 'ไม่สามารถเลือกรูปภาพได้');
    }
  };

  const convertImageToBase64 = async (uri) => {
    try {
      const response = await fetch(uri);
      const blob = await response.blob();
      
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch (error) {
      console.error('Error converting image:', error);
      return null;
    }
  };

  const handleSave = async () => {
    if (!foodName || !category || !quantity) {
      Alert.alert('ข้อผิดพลาด', 'กรุณากรอกข้อมูลให้ครบถ้วน');
      return;
    }

    setLoading(true);
    try {
      const user = auth.currentUser;
      
      let imageUrl = null;
      if (foodImage) {
        imageUrl = await convertImageToBase64(foodImage);
      }

      await addDoc(collection(db, 'food_items'), {
        userId: user.uid,
        name: foodName,
        category: category,
        quantity: parseInt(quantity) || 1,
        expiryDate: expiryDate.toISOString(),
        imageUrl: imageUrl,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      Alert.alert(
        'สำเร็จ! 🎉',
        'เพิ่มรายการอาหารสำเร็จ',
        [
          {
            text: 'ตกลง',
            onPress: () => navigation.goBack(),
          },
        ]
      );
    } catch (error) {
      console.error('Error adding food:', error);
      Alert.alert('ข้อผิดพลาด', 'เกิดข้อผิดพลาดในการเพิ่มอาหาร');
    } finally {
      setLoading(false);
    }
  };

  const onDateChange = (event, selectedDate) => {
    setShowDatePicker(false);
    if (selectedDate) {
      setExpiryDate(selectedDate);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#1f2937" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>เพิ่มอาหาร</Text>
        <TouchableOpacity
          style={styles.saveButton}
          onPress={handleSave}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#10b981" size="small" />
          ) : (
            <Text style={styles.saveText}>บันทึก</Text>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView 
        style={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Image Section */}
        <View style={styles.imageSection}>
          <TouchableOpacity 
            style={styles.imageContainer}
            onPress={pickImage}
            activeOpacity={0.7}
          >
            {foodImage ? (
              <Image source={{ uri: foodImage }} style={styles.foodImage} />
            ) : (
              <View style={styles.imagePlaceholder}>
                <Ionicons name="camera" size={40} color="#9ca3af" />
                <Text style={styles.imagePlaceholderText}>เพิ่มรูปอาหาร</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Form Section */}
        <View style={styles.formSection}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>ชื่ออาหาร *</Text>
            <View style={styles.inputContainer}>
              <Ionicons name="fast-food-outline" size={20} color="#6b7280" style={styles.icon} />
              <TextInput
                style={styles.input}
                placeholder="เช่น นมสด, ไข่ไก่"
                value={foodName}
                onChangeText={setFoodName}
                placeholderTextColor="#9ca3af"
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>หมวดหมู่ *</Text>
            <View style={styles.categoryGrid}>
              {categories.map((cat) => (
                <TouchableOpacity
                  key={cat.id}
                  style={[
                    styles.categoryCard,
                    category === cat.id && styles.categoryCardActive
                  ]}
                  onPress={() => setCategory(cat.id)}
                >
                  <Ionicons 
                    name={cat.icon} 
                    size={24} 
                    color={category === cat.id ? '#10b981' : '#9ca3af'} 
                  />
                  <Text style={[
                    styles.categoryText,
                    category === cat.id && styles.categoryTextActive
                  ]}>
                    {cat.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>จำนวน *</Text>
            <View style={styles.inputContainer}>
              <Ionicons name="cube-outline" size={20} color="#6b7280" style={styles.icon} />
              <TextInput
                style={styles.input}
                placeholder="1"
                value={quantity}
                onChangeText={setQuantity}
                keyboardType="number-pad"
                placeholderTextColor="#9ca3af"
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>วันหมดอายุ *</Text>
            <TouchableOpacity 
              style={styles.inputContainer}
              onPress={() => setShowDatePicker(true)}
            >
              <Ionicons name="calendar-outline" size={20} color="#6b7280" style={styles.icon} />
              <Text style={styles.dateText}>
                {expiryDate.toLocaleDateString('th-TH', { 
                  day: 'numeric', 
                  month: 'long', 
                  year: 'numeric' 
                })}
              </Text>
              <Ionicons name="chevron-down" size={20} color="#9ca3af" />
            </TouchableOpacity>
          </View>

          {showDatePicker && (
            <DateTimePicker
              value={expiryDate}
              mode="date"
              display="default"
              onChange={onDateChange}
              minimumDate={new Date()}
            />
          )}

          {/* Tips */}
          <View style={styles.tipCard}>
            <Ionicons name="information-circle" size={20} color="#3b82f6" />
            <Text style={styles.tipText}>
              เพิ่มรายละเอียดให้ครบถ้วนเพื่อช่วยจัดการอาหารได้ดียิ่งขึ้น
            </Text>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 15,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
  },
  saveButton: {
    width: 70,
    alignItems: 'flex-end',
  },
  saveText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#10b981',
  },
  content: {
    flex: 1,
  },
  imageSection: {
    backgroundColor: '#fff',
    alignItems: 'center',
    paddingVertical: 30,
    marginBottom: 15,
  },
  imageContainer: {
    width: 150,
    height: 150,
    borderRadius: 15,
    overflow: 'hidden',
  },
  foodImage: {
    width: '100%',
    height: '100%',
  },
  imagePlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#e5e7eb',
    borderStyle: 'dashed',
    borderRadius: 15,
  },
  imagePlaceholderText: {
    fontSize: 14,
    color: '#9ca3af',
    marginTop: 8,
  },
  formSection: {
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    paddingVertical: 20,
    marginBottom: 15,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    paddingHorizontal: 15,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  icon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    paddingVertical: 14,
    fontSize: 15,
    color: '#1f2937',
  },
  dateText: {
    flex: 1,
    paddingVertical: 14,
    fontSize: 15,
    color: '#1f2937',
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -5,
  },
  categoryCard: {
    width: '31%',
    aspectRatio: 1,
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    margin: '1%',
    borderWidth: 2,
    borderColor: '#e5e7eb',
  },
  categoryCardActive: {
    backgroundColor: '#f0fdf4',
    borderColor: '#10b981',
  },
  categoryText: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 6,
    fontWeight: '500',
  },
  categoryTextActive: {
    color: '#10b981',
    fontWeight: '600',
  },
  tipCard: {
    flexDirection: 'row',
    backgroundColor: '#eff6ff',
    padding: 15,
    borderRadius: 12,
    marginTop: 10,
  },
  tipText: {
    flex: 1,
    fontSize: 13,
    color: '#1e40af',
    marginLeft: 10,
    lineHeight: 18,
  },
});
