import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  StatusBar,
  Alert,
  Image,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { db, auth } from '../../firebase.config';
import { doc, setDoc, addDoc, collection } from 'firebase/firestore';

export default function RegisterStoreStep3Screen({ navigation, route }) {
  const { step1Data, step2Data } = route.params || {};
  const [selectedImage, setSelectedImage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const requestPermissions = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'ต้องการสิทธิ์',
        'แอปต้องการสิทธิ์เข้าถึงคลังรูปภาพเพื่อเลือกรูปร้านค้า',
        [{ text: 'ตกลง' }]
      );
      return false;
    }
    return true;
  };

  const handleSelectImage = async () => {
    const hasPermission = await requestPermissions();
    if (!hasPermission) return;

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [16, 9],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setSelectedImage(result.assets[0].uri);
        setErrorMessage('');
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('ข้อผิดพลาด', 'ไม่สามารถเลือกรูปภาพได้');
    }
  };

  const handleBack = () => {
    navigation.goBack();
  };

  const handleSubmit = async () => {
    // Validate image
    if (!selectedImage) {
      setErrorMessage('กรุณาเลือกรูปภาพร้านค้าอย่างน้อย 1 รูป');
      return;
    }

    setLoading(true);
    setErrorMessage('');

    try {
      const user = auth.currentUser;
      if (!user) {
        Alert.alert('ข้อผิดพลาด', 'กรุณาเข้าสู่ระบบก่อนสมัครเป็นร้านค้า');
        setLoading(false);
        return;
      }

      // ======== 1. สร้างข้อมูลร้านค้าใน stores collection ========
      const storeData = {
        userId: user.uid,
        // Step 1 data
        storeName: step1Data?.storeName || '',
        storeOwner: step1Data?.storeOwner || '',
        phoneNumber: step1Data?.phoneNumber || '',
        openDateTime: step1Data?.openDateTime || '',
        closeDateTime: step1Data?.closeDateTime || '',
        storeDetails: step1Data?.storeDetails || '',
        deliveryMethod: step1Data?.deliveryMethod || 'pickup',
        // Step 2 data
        location: step2Data?.location || '',
        address: step2Data?.address || '',
        latitude: step2Data?.latitude || null,
        longitude: step2Data?.longitude || null,
        // Step 3 data
        storeImage: selectedImage,
        // Additional data
        status: 'pending', // pending, approved, rejected
        createdAt: new Date().toISOString(),
        rating: 0,
        totalOrders: 0,
        isActive: false, // จะเปิดเป็น true หลัง Admin อนุมัติ
      };

      await setDoc(doc(db, 'stores', user.uid), storeData);

      // ======== 2. สร้างคำขออนุมัติใน approval_requests collection ========
      // 🔥 นี่คือส่วนที่เพิ่มเข้ามาใหม่!
      const approvalRequest = {
        type: 'store_registration',
        userId: user.uid,
        userName: step1Data?.storeOwner || user.displayName || 'ไม่ระบุชื่อ',
        userEmail: user.email || 'ไม่ระบุอีเมล',
        storeName: step1Data?.storeName || '',
        requestDate: new Date().toISOString(),
        status: 'pending',
        details: {
          'ชื่อร้าน': step1Data?.storeName || '',
          'เจ้าของร้าน': step1Data?.storeOwner || '',
          'เบอร์โทร': step1Data?.phoneNumber || '',
          'เวลาเปิด': step1Data?.openDateTime ? new Date(step1Data.openDateTime).toLocaleString('th-TH') : '',
          'เวลาปิด': step1Data?.closeDateTime ? new Date(step1Data.closeDateTime).toLocaleString('th-TH') : '',
          'การจัดส่ง': step1Data?.deliveryMethod === 'pickup' ? 'รับที่ร้าน' : 
                       step1Data?.deliveryMethod === 'delivery' ? 'เดลิเวอรี่' : 'ทั้งสองแบบ',
          'ที่อยู่': step2Data?.address || '',
          'พิกัด': step2Data?.latitude && step2Data?.longitude ? 
                  `${step2Data.latitude}, ${step2Data.longitude}` : 'ไม่ระบุ',
        }
      };

      await addDoc(collection(db, 'approval_requests'), approvalRequest);

      // ======== 3. อัปเดต user profile (ยังไม่เปลี่ยน role เป็น store ก่อนอนุมัติ) ========
      await setDoc(doc(db, 'users', user.uid), {
        hasStorePending: true, // flag บอกว่ามีคำขอรออนุมัติ
        storeId: user.uid,
      }, { merge: true });

      setLoading(false);

      // Show success message
      Alert.alert(
        'สำเร็จ!',
        'ส่งคำขอสมัครร้านค้าเรียบร้อยแล้ว\nทีมงานจะตรวจสอบและแจ้งผลภายใน 1-2 วันทำการ',
        [
          {
            text: 'ตกลง',
            onPress: () => {
              // Navigate to home or store management screen
              navigation.reset({
                index: 0,
                routes: [{ name: 'Home' }],
              });
            }
          }
        ]
      );

    } catch (error) {
      console.error('Error submitting store:', error);
      setLoading(false);
      Alert.alert(
        'เกิดข้อผิดพลาด',
        'ไม่สามารถส่งคำขอสมัครได้ กรุณาลองใหม่อีกครั้ง'
      );
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={handleBack}
        >
          <Ionicons name="chevron-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>สมัครเป็นร้านค้า</Text>
      </View>

      {/* Progress Indicator */}
      <View style={styles.progressContainer}>
        <View style={styles.stepContainer}>
          <View style={[styles.stepCircle, styles.stepActive]}>
            <Text style={styles.stepTextActive}>1</Text>
          </View>
          <Text style={styles.stepLabel}>ข้อมูลร้านค้า</Text>
        </View>

        <View style={[styles.progressLine, styles.progressLineActive]} />

        <View style={styles.stepContainer}>
          <View style={[styles.stepCircle, styles.stepActive]}>
            <Text style={styles.stepTextActive}>2</Text>
          </View>
          <Text style={styles.stepLabel}>ตำแหน่ง</Text>
        </View>

        <View style={[styles.progressLine, styles.progressLineActive]} />

        <View style={styles.stepContainer}>
          <View style={[styles.stepCircle, styles.stepActive]}>
            <Text style={styles.stepTextActive}>3</Text>
          </View>
          <Text style={styles.stepLabel}>รูปร้านค้า</Text>
        </View>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.sectionTitle}>รูปร้านค้า</Text>

        {/* Image Preview */}
        {selectedImage ? (
          <View style={styles.imagePreviewContainer}>
            <Image 
              source={{ uri: selectedImage }} 
              style={styles.imagePreview}
              resizeMode="cover"
            />
            <TouchableOpacity 
              style={styles.changeImageButton}
              onPress={handleSelectImage}
            >
              <Ionicons name="camera" size={20} color="#FFFFFF" />
              <Text style={styles.changeImageText}>เปลี่ยนรูป</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity 
            style={styles.imagePickerContainer}
            onPress={handleSelectImage}
          >
            <Ionicons name="camera-outline" size={48} color="#999" />
            <Text style={styles.imagePickerTitle}>รูปหน้าร้าน</Text>
            <Text style={styles.imagePickerSubtitle}>
              อัปโหลดรูปภาพที่ชัดเจน
            </Text>
            <View style={styles.selectButton}>
              <Text style={styles.selectButtonText}>เลือกรูปภาพ</Text>
            </View>
          </TouchableOpacity>
        )}

        {/* Error Message */}
        {errorMessage ? (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>
              หมายเหตุ: {errorMessage}
            </Text>
          </View>
        ) : null}

        <View style={styles.spacer} />
      </ScrollView>

      {/* Footer Buttons */}
      <View style={styles.footer}>
        <TouchableOpacity 
          style={styles.backFooterButton}
          onPress={handleBack}
          disabled={loading}
        >
          <Text style={styles.backFooterButtonText}>ย้อนกลับ</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.submitButton, loading && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.submitButtonText}>ส่งคำขอสมัคร</Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F0F0F0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    flex: 1,
    textAlign: 'center',
    marginRight: 40,
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 30,
    paddingVertical: 20,
    backgroundColor: '#FFFFFF',
  },
  stepContainer: {
    alignItems: 'center',
  },
  stepCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E0E0E0',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 5,
  },
  stepActive: {
    backgroundColor: '#4CAF50',
  },
  stepText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#999',
  },
  stepTextActive: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  stepLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 5,
  },
  progressLine: {
    flex: 1,
    height: 2,
    backgroundColor: '#E0E0E0',
    marginHorizontal: 10,
    marginBottom: 20,
  },
  progressLineActive: {
    backgroundColor: '#4CAF50',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    marginTop: 20,
    marginBottom: 20,
    textAlign: 'center',
  },
  imagePickerContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 40,
    marginTop: 10,
    borderWidth: 2,
    borderColor: '#E0E0E0',
    borderStyle: 'dashed',
    alignItems: 'center',
  },
  imagePickerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginTop: 15,
  },
  imagePickerSubtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 5,
    marginBottom: 20,
  },
  selectButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 30,
    borderWidth: 1.5,
    borderColor: '#4CAF50',
  },
  selectButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#4CAF50',
  },
  imagePreviewContainer: {
    marginTop: 10,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  imagePreview: {
    width: '100%',
    height: 250,
    backgroundColor: '#F0F0F0',
  },
  changeImageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4CAF50',
    paddingVertical: 12,
    gap: 8,
  },
  changeImageText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  errorContainer: {
    backgroundColor: '#FFE5E5',
    borderRadius: 8,
    padding: 12,
    marginTop: 15,
    borderWidth: 1,
    borderColor: '#FF6B6B',
  },
  errorText: {
    fontSize: 13,
    color: '#D32F2F',
    textAlign: 'center',
  },
  spacer: {
    height: 40,
  },
  footer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    gap: 10,
  },
  backFooterButton: {
    flex: 1,
    backgroundColor: '#F0F0F0',
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
  },
  backFooterButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  submitButton: {
    flex: 1,
    backgroundColor: '#4CAF50',
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
  },
  submitButtonDisabled: {
    backgroundColor: '#A5D6A7',
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});