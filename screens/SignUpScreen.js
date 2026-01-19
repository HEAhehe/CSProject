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
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { auth, db } from '../firebase.config';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';

export default function SignUpScreen({ navigation }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [profileImage, setProfileImage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const pickImage = async () => {
    try {
      // ขอ permission
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (status !== 'granted') {
        Alert.alert(
          'ต้องการสิทธิ์เข้าถึง',
          'แอปต้องการสิทธิ์เข้าถึงคลังรูปภาพเพื่อให้คุณเลือกรูปโปรไฟล์',
          [
            { text: 'ยกเลิก', style: 'cancel' },
            { 
              text: 'ตั้งค่า', 
              onPress: () => {
                // ผู้ใช้จะต้องไปตั้งค่าเอง
                Alert.alert('คำแนะนำ', 'กรุณาเปิดการตั้งค่า → แอป → FoodWaste → อนุญาตการเข้าถึงรูปภาพ');
              }
            }
          ]
        );
        return;
      }

      // เปิดตัวเลือกรูป
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.5, // ลดคุณภาพเพื่อลดขนาดไฟล์
      });

      console.log('Image picker result:', result);

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const imageUri = result.assets[0].uri;
        console.log('Selected image URI:', imageUri);
        setProfileImage(imageUri);
        Alert.alert('สำเร็จ', 'เลือกรูปภาพสำเร็จ!');
      } else {
        console.log('Image selection cancelled');
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('ข้อผิดพลาด', 'ไม่สามารถเลือกรูปภาพได้: ' + error.message);
    }
  };

  const convertImageToBase64 = async (uri) => {
    try {
      console.log('Converting image to base64:', uri);
      
      const response = await fetch(uri);
      const blob = await response.blob();
      
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          console.log('Image converted to base64 successfully');
          resolve(reader.result);
        };
        reader.onerror = (error) => {
          console.error('Error converting image:', error);
          reject(error);
        };
        reader.readAsDataURL(blob);
      });
    } catch (error) {
      console.error('Error in convertImageToBase64:', error);
      return null;
    }
  };

  const handleSignUp = async () => {
    // Validation
    if (!username || !password || !confirmPassword || !phoneNumber) {
      Alert.alert('ข้อผิดพลาด', 'กรุณากรอกข้อมูลให้ครบถ้วน');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('ข้อผิดพลาด', 'รหัสผ่านไม่ตรงกัน');
      return;
    }

    if (password.length < 6) {
      Alert.alert('ข้อผิดพลาด', 'รหัสผ่านต้องมีความยาวอย่างน้อย 6 ตัวอักษร');
      return;
    }

    setLoading(true);
    
    try {
      console.log('Starting sign up process...');
      
      // สร้าง email จาก username
      const email = username.includes('@') ? username : `${username}@foodwaste.app`;
      console.log('Email:', email);
      
      // สร้างบัญชีใน Firebase Authentication
      console.log('Creating user in Firebase Auth...');
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      console.log('User created:', user.uid);

      // แปลงรูปเป็น base64 (ถ้ามี)
      let profileImageBase64 = null;
      if (profileImage) {
        console.log('Converting profile image...');
        profileImageBase64 = await convertImageToBase64(profileImage);
        if (profileImageBase64) {
          console.log('Profile image converted, size:', profileImageBase64.length);
        } else {
          console.log('Failed to convert image, will save without image');
        }
      } else {
        console.log('No profile image selected');
      }

      // บันทึกข้อมูลลง Firestore
      console.log('Saving user data to Firestore...');
      await setDoc(doc(db, 'users', user.uid), {
        userId: user.uid,
        username: username,
        email: email,
        phoneNumber: phoneNumber,
        profileImage: profileImageBase64,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      console.log('User data saved successfully');

      /*Alert.alert(
        'สำเร็จ! 🎉',
        'สมัครสมาชิกสำเร็จ กรุณาเข้าสู่ระบบ',
        [
          {
            text: 'ตกลง',
            onPress: () => navigation.navigate('SignIn'),
          },
        ]
      ); */
    } catch (error) {
      console.error('Sign up error:', error);
      let errorMessage = 'เกิดข้อผิดพลาดในการสมัครสมาชิก';
      
      if (error.code === 'auth/email-already-in-use') {
        errorMessage = 'ชื่อผู้ใช้นี้ถูกใช้งานแล้ว';
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = 'รูปแบบชื่อผู้ใช้ไม่ถูกต้อง';
      } else if (error.code === 'auth/weak-password') {
        errorMessage = 'รหัสผ่านไม่ปลอดภัยเพียงพอ';
      } else if (error.code === 'auth/network-request-failed') {
        errorMessage = 'ไม่สามารถเชื่อมต่ออินเทอร์เน็ตได้';
      } else {
        errorMessage = `เกิดข้อผิดพลาด: ${error.message}`;
      }
      
      Alert.alert('ข้อผิดพลาด', errorMessage);
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
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color="#1f2937" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>สร้างบัญชี</Text>
          <View style={styles.placeholder} />
        </View>

        <View style={styles.formContainer}>
          {/* Profile Image Picker */}
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
              <Ionicons name="camera" size={18} color="#fff" />
            </View>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.changePhotoButton}
            onPress={pickImage}
          >
            <Ionicons name="image" size={16} color="#10b981" />
            <Text style={styles.changePhotoText}>
              {profileImage ? 'เปลี่ยนรูปโปรไฟล์' : 'เลือกรูปโปรไฟล์'}
            </Text>
          </TouchableOpacity>

          {profileImage && (
            <TouchableOpacity
              style={styles.removeImageButton}
              onPress={() => {
                setProfileImage(null);
                Alert.alert('สำเร็จ', 'ลบรูปภาพแล้ว');
              }}
            >
              <Ionicons name="close-circle" size={16} color="#ef4444" />
              <Text style={styles.removeImageText}>ลบรูป</Text>
            </TouchableOpacity>
          )}

          {/* Form Inputs */}
          <View style={styles.inputContainer}>
            <View style={styles.iconContainer}>
              <Ionicons name="person" size={20} color="#10b981" />
            </View>
            <TextInput
              style={styles.input}
              placeholder="ชื่อผู้ใช้"
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
              placeholderTextColor="#9ca3af"
            />
          </View>

          <View style={styles.inputContainer}>
            <View style={styles.iconContainer}>
              <Ionicons name="lock-closed" size={20} color="#10b981" />
            </View>
            <TextInput
              style={styles.input}
              placeholder="รหัสผ่าน"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              placeholderTextColor="#9ca3af"
            />
            <TouchableOpacity
              onPress={() => setShowPassword(!showPassword)}
              style={styles.eyeIcon}
            >
              <Ionicons
                name={showPassword ? "eye" : "eye-off"}
                size={20}
                color="#6b7280"
              />
            </TouchableOpacity>
          </View>

          <View style={styles.inputContainer}>
            <View style={styles.iconContainer}>
              <Ionicons name="lock-closed" size={20} color="#10b981" />
            </View>
            <TextInput
              style={styles.input}
              placeholder="ยืนยันรหัสผ่าน"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry={!showConfirmPassword}
              autoCapitalize="none"
              placeholderTextColor="#9ca3af"
            />
            <TouchableOpacity
              onPress={() => setShowConfirmPassword(!showConfirmPassword)}
              style={styles.eyeIcon}
            >
              <Ionicons
                name={showConfirmPassword ? "eye" : "eye-off"}
                size={20}
                color="#6b7280"
              />
            </TouchableOpacity>
          </View>

          <View style={styles.inputContainer}>
            <View style={styles.iconContainer}>
              <Ionicons name="call" size={20} color="#10b981" />
            </View>
            <TextInput
              style={styles.input}
              placeholder="เบอร์โทรศัพท์"
              value={phoneNumber}
              onChangeText={setPhoneNumber}
              keyboardType="phone-pad"
              placeholderTextColor="#9ca3af"
            />
          </View>

          {/* Sign Up Button */}
          <TouchableOpacity
            style={styles.signUpButton}
            onPress={handleSignUp}
            disabled={loading}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.signUpButtonText}>สมัครสมาชิก</Text>
            )}
          </TouchableOpacity>

          {/* Login Link */}
          <View style={styles.loginContainer}>
            <Text style={styles.loginText}>มีบัญชีอยู่แล้ว? </Text>
            <TouchableOpacity onPress={() => navigation.navigate('SignIn')}>
              <Text style={styles.loginLink}>เข้าสู่ระบบ</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 50,
    marginBottom: 20,
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
    fontSize: 20,
    fontWeight: '600',
    color: '#1f2937',
  },
  placeholder: {
    width: 40,
  },
  formContainer: {
    paddingHorizontal: 30,
    alignItems: 'center',
  },
  profileImageContainer: {
    marginBottom: 10,
    position: 'relative',
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
  changePhotoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: '#f0fdf4',
    marginBottom: 5,
  },
  changePhotoText: {
    fontSize: 13,
    color: '#10b981',
    fontWeight: '600',
    marginLeft: 6,
  },
  removeImageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    marginBottom: 20,
  },
  removeImageText: {
    fontSize: 12,
    color: '#ef4444',
    marginLeft: 4,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
    borderRadius: 15,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    width: '100%',
  },
  iconContainer: {
    width: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    flex: 1,
    paddingVertical: 16,
    fontSize: 15,
    color: '#1f2937',
  },
  eyeIcon: {
    padding: 15,
  },
  signUpButton: {
    backgroundColor: '#10b981',
    paddingVertical: 16,
    borderRadius: 15,
    alignItems: 'center',
    marginTop: 10,
    width: '100%',
    shadowColor: '#10b981',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  signUpButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  loginContainer: {
    flexDirection: 'row',
    marginTop: 20,
    alignItems: 'center',
  },
  loginText: {
    fontSize: 14,
    color: '#6b7280',
  },
  loginLink: {
    fontSize: 14,
    color: '#10b981',
    fontWeight: '600',
  },
});
