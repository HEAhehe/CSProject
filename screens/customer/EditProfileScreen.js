import React, { useState, useEffect } from 'react';
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
import { auth, db } from '../../firebase.config';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import * as ImagePicker from 'expo-image-picker';

export default function EditProfileScreen({ navigation }) {
  const [userData, setUserData] = useState(null);
  const [username, setUsername] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [profileImage, setProfileImage] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadUserData();
  }, []);

  const loadUserData = async () => {
    try {
      const user = auth.currentUser;
      if (user) {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          const data = userDoc.data();
          setUserData(data);
          setUsername(data.username || '');
          setPhoneNumber(data.phoneNumber || '');
          setProfileImage(data.profileImage || null);
        }
      }
    } catch (error) {
      console.error('Error loading user data:', error);
    }
  };
  const [pickedImageBase64, setPickedImageBase64] = useState(null);
  const pickImage = async () => {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (status !== 'granted') {
        Alert.alert('ขออนุญาต', 'แอปต้องการสิทธิ์เข้าถึงคลังรูปภาพ');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.3,
        base64: true,
      });

      if (!result.canceled) {
        setProfileImage(result.assets[0].uri);
        setPickedImageBase64(result.assets[0].base64);
      }
    };

  const convertImageToBase64 = async (uri) => {
    try {
      const response = await fetch(uri);
      const blob = await response.blob();
      
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          resolve(reader.result);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch (error) {
      console.error('Error converting image:', error);
      return null;
    }
  };

const handleSave = async () => {
    if (!username || !phoneNumber) {
      Alert.alert('ข้อผิดพลาด', 'กรุณากรอกข้อมูลให้ครบถ้วน');
      return;
    }

    setLoading(true);
    try {
      const user = auth.currentUser;

      // เริ่มต้นด้วยรูปเดิมที่มีอยู่แล้ว
      let finalProfileImage = userData?.profileImage;

      // ถ้ามีการเลือกรูปใหม่ (มี Base64 ใหม่) ให้ใช้ตัวใหม่
      if (pickedImageBase64) {
        // ⭐ แก้ชื่อตัวแปรตรงนี้ให้ตรงกัน (ของเดิมคุณเขียน finalProfileImage ลอยๆ)
        finalProfileImage = `data:image/jpeg;base64,${pickedImageBase64}`;
      }

      await updateDoc(doc(db, 'users', user.uid), {
        username: username,
        phoneNumber: phoneNumber,
        profileImage: finalProfileImage, // ใช้ตัวแปรที่ถูกต้อง
        updatedAt: new Date().toISOString(),
      });

      Alert.alert('สำเร็จ', 'อัปเดตโปรไฟล์สำเร็จ', [
        { text: 'ตกลง', onPress: () => navigation.goBack() }
      ]);

    } catch (error) {
      console.error('Error updating profile:', error);
      Alert.alert('ข้อผิดพลาด', 'เกิดข้อผิดพลาดในการอัปเดตโปรไฟล์');
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
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#1f2937" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>แก้ไขโปรไฟล์</Text>
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
        {/* Profile Image */}
        <View style={styles.imageSection}>
          <TouchableOpacity 
            style={styles.profileImageContainer}
            onPress={pickImage}
            activeOpacity={0.7}
          >
            {profileImage ? (
              <Image source={{ uri: profileImage }} style={styles.profileImage} />
            ) : (
              <View style={styles.profilePlaceholder}>
                <Ionicons name="person" size={60} color="#9ca3af" />
              </View>
            )}
            <View style={styles.editIconContainer}>
              <Ionicons name="camera" size={20} color="#fff" />
            </View>
          </TouchableOpacity>
          <Text style={styles.changePhotoText}>เปลี่ยนรูปโปรไฟล์</Text>
        </View>

        {/* Form */}
        <View style={styles.formSection}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>ชื่อผู้ใช้</Text>
            <View style={styles.inputContainer}>
              <Ionicons name="person-outline" size={20} color="#6b7280" style={styles.icon} />
              <TextInput
                style={styles.input}
                placeholder="ชื่อผู้ใช้"
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
                placeholderTextColor="#9ca3af"
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>อีเมล</Text>
            <View style={[styles.inputContainer, styles.inputDisabled]}>
              <Ionicons name="mail-outline" size={20} color="#9ca3af" style={styles.icon} />
              <TextInput
                style={[styles.input, styles.textDisabled]}
                value={userData?.email || ''}
                editable={false}
                placeholderTextColor="#9ca3af"
              />
              <Ionicons name="lock-closed" size={16} color="#9ca3af" />
            </View>
            <Text style={styles.helperText}>อีเมลไม่สามารถเปลี่ยนแปลงได้</Text>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>เบอร์โทรศัพท์</Text>
            <View style={styles.inputContainer}>
              <Ionicons name="call-outline" size={20} color="#6b7280" style={styles.icon} />
              <TextInput
                style={styles.input}
                placeholder="เบอร์โทรศัพท์"
                value={phoneNumber}
                onChangeText={setPhoneNumber}
                keyboardType="phone-pad"
                placeholderTextColor="#9ca3af"
              />
            </View>
          </View>

          {/* Account Info */}
          <View style={styles.infoSection}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>สมาชิกตั้งแต่</Text>
              <Text style={styles.infoValue}>
                {userData?.createdAt ? new Date(userData.createdAt).toLocaleDateString('th-TH') : '-'}
              </Text>
            </View>
            <View style={styles.infoDivider} />
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>อัปเดตล่าสุด</Text>
              <Text style={styles.infoValue}>
                {userData?.updatedAt ? new Date(userData.updatedAt).toLocaleDateString('th-TH') : '-'}
              </Text>
            </View>
          </View>
        </View>

        {/* Delete Account */}
        <TouchableOpacity style={styles.deleteButton}>
          <Ionicons name="trash-outline" size={20} color="#ef4444" />
          <Text style={styles.deleteText}>ลบบัญชี</Text>
        </TouchableOpacity>
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
    alignItems: 'center',
    paddingVertical: 30,
    backgroundColor: '#fff',
    marginBottom: 15,
  },
  profileImageContainer: {
    position: 'relative',
    marginBottom: 10,
  },
  profileImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 3,
    borderColor: '#10b981',
  },
  profilePlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#e5e7eb',
    borderStyle: 'dashed',
  },
  editIconContainer: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#10b981',
    borderRadius: 22,
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#fff',
  },
  changePhotoText: {
    fontSize: 14,
    color: '#10b981',
    fontWeight: '500',
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
  inputDisabled: {
    backgroundColor: '#f3f4f6',
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
  textDisabled: {
    color: '#9ca3af',
  },
  helperText: {
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 5,
    marginLeft: 5,
  },
  infoSection: {
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    padding: 15,
    marginTop: 10,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  infoLabel: {
    fontSize: 14,
    color: '#6b7280',
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1f2937',
  },
  infoDivider: {
    height: 1,
    backgroundColor: '#e5e7eb',
    marginVertical: 5,
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    marginHorizontal: 20,
    paddingVertical: 15,
    borderRadius: 12,
    marginBottom: 30,
    borderWidth: 1,
    borderColor: '#fee2e2',
  },
  deleteText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#ef4444',
    marginLeft: 8,
  },
});
