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
import { doc, setDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { auth, db } from '../../firebase.config';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function SignUpScreen({ navigation }) {
  const insets = useSafeAreaInsets();

  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [profileImage, setProfileImage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [pickedImageBase64, setPickedImageBase64] = useState(null);

  const pickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (status !== 'granted') {
        Alert.alert('ขออภัย', 'ต้องการสิทธิ์เข้าถึงคลังรูปภาพ');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.1,
        base64: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setProfileImage(result.assets[0].uri);
        setPickedImageBase64(result.assets[0].base64);
      }
    } catch (error) {
      console.log(error);
      Alert.alert('ข้อผิดพลาด', 'เลือกรูปไม่ได้');
    }
  };

  const handleSignUp = async () => {
    if (!username || !email || !password || !confirmPassword || !phoneNumber) {
      Alert.alert('ข้อผิดพลาด', 'กรุณากรอกข้อมูลให้ครบถ้วน');
      return;
    }

    if (username.includes('@')) {
      Alert.alert('รูปแบบไม่ถูกต้อง', 'ชื่อผู้ใช้ (Username) ไม่สามารถใช้เครื่องหมาย @ ได้ครับ');
      return;
    }

    const emailRegex = /\S+@\S+\.\S+/;
    if (!emailRegex.test(email)) {
      Alert.alert('ข้อผิดพลาด', 'รูปแบบอีเมลไม่ถูกต้อง');
      return;
    }

    const phoneRegex = /^0\d{9}$/;
    if (!phoneRegex.test(phoneNumber)) {
      Alert.alert('รูปแบบไม่ถูกต้อง', 'เบอร์โทรศัพท์ต้องขึ้นต้นด้วย 0 และมี 10 หลัก (เช่น 0812345678)');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('ข้อผิดพลาด', 'รหัสผ่านและยืนยันรหัสผ่านไม่ตรงกัน');
      return;
    }

    const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d@$!%*#?&]{8,}$/;
    if (!passwordRegex.test(password)) {
      Alert.alert(
        'รหัสผ่านไม่รัดกุม',
        'รหัสผ่านต้องมีความยาวอย่างน้อย 8 ตัวอักษร และประกอบด้วยตัวอักษรภาษาอังกฤษและตัวเลข'
      );
      return;
    }

    setLoading(true);

    try {
      const usersRef = collection(db, 'users');

      // ✅ 1. เช็คก่อนว่า Username นี้มีคนใช้ไปแล้วหรือยัง
      const usernameQuery = query(usersRef, where('username', '==', username));
      const usernameSnapshot = await getDocs(usernameQuery);

      if (!usernameSnapshot.empty) {
        Alert.alert('ชื่อผู้ใช้ซ้ำ', 'ชื่อผู้ใช้นี้ถูกใช้งานแล้ว กรุณาตั้งชื่อผู้ใช้ใหม่ครับ');
        setLoading(false);
        return;
      }

      // ✅ 2. เช็คก่อนว่า เบอร์โทรศัพท์ นี้เคยถูกใช้สมัครไปแล้วหรือยัง (ป้องกันคนโดนแบนมาสมัครใหม่)
      const phoneQuery = query(usersRef, where('phoneNumber', '==', phoneNumber));
      const phoneSnapshot = await getDocs(phoneQuery);

      if (!phoneSnapshot.empty) {
        Alert.alert('เบอร์โทรศัพท์ซ้ำ', 'เบอร์โทรศัพท์นี้ถูกใช้สมัครบัญชีไปแล้ว ไม่สามารถใช้ซ้ำได้ครับ');
        setLoading(false);
        return;
      }

      // ถ้า Username และเบอร์โทรไม่ซ้ำ ให้สร้างบัญชีต่อ
      const userCredential = await createUserWithEmailAndPassword(auth, email.trim(), password);
      const user = userCredential.user;

      const isAdminAccount = username.toLowerCase().includes('admin');

      let finalProfileImage = null;
      if (pickedImageBase64) {
        finalProfileImage = `data:image/jpeg;base64,${pickedImageBase64}`;
      }

      await setDoc(doc(db, 'users', user.uid), {
        userId: user.uid,
        username: username,
        email: email.trim(),
        phoneNumber: phoneNumber,
        profileImage: finalProfileImage,

        isAdmin: isAdminAccount,
        currentRole: isAdminAccount ? 'admin' : 'customer',

        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      Alert.alert(
        'สำเร็จ! 🎉',
        'สมัครสมาชิกสำเร็จ ' + (isAdminAccount ? '(สิทธิ์ Admin)' : ''),
        [{ text: 'ตกลง', onPress: () => console.log('Sign up success') }]
      );

    } catch (error) {
      console.error('Sign up error:', error);
      let errorMessage = 'เกิดข้อผิดพลาดในการสมัครสมาชิก';

      if (error.code === 'auth/email-already-in-use') {
        errorMessage = 'อีเมลนี้ถูกใช้งานแล้ว';
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = 'รูปแบบอีเมลไม่ถูกต้อง';
      } else if (error.code === 'auth/network-request-failed') {
        errorMessage = 'ไม่สามารถเชื่อมต่ออินเทอร์เน็ตได้';
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
        <View style={[styles.header, { paddingTop: Math.max(insets.top, 20) }]}>
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
                setPickedImageBase64(null);
                Alert.alert('สำเร็จ', 'ลบรูปภาพแล้ว');
              }}
            >
              <Ionicons name="close-circle" size={16} color="#ef4444" />
              <Text style={styles.removeImageText}>ลบรูป</Text>
            </TouchableOpacity>
          )}

          <View style={styles.inputContainer}>
            <View style={styles.iconContainer}>
              <Ionicons name="person" size={20} color="#10b981" />
            </View>
            <TextInput
              style={styles.input}
              placeholder="ชื่อผู้ใช้ (ห้ามมี @)"
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
              placeholderTextColor="#9ca3af"
            />
          </View>

          <View style={styles.inputContainer}>
            <View style={styles.iconContainer}>
              <Ionicons name="mail" size={20} color="#10b981" />
            </View>
            <TextInput
              style={styles.input}
              placeholder="อีเมล"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              placeholderTextColor="#9ca3af"
            />
          </View>

          <View style={[styles.inputContainer, { marginBottom: 6 }]}>
            <View style={styles.iconContainer}>
              <Ionicons name="call" size={20} color="#10b981" />
            </View>
            <TextInput
              style={styles.input}
              placeholder="เบอร์โทรศัพท์ (10 หลัก เริ่มด้วย 0)"
              value={phoneNumber}
              onChangeText={(text) => {
                const numericValue = text.replace(/[^0-9]/g, '');
                setPhoneNumber(numericValue);
              }}
              keyboardType="phone-pad"
              maxLength={10}
              placeholderTextColor="#9ca3af"
            />
          </View>

          <View style={[styles.inputContainer, { marginTop: 9, marginBottom: 6 }]}>
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

          <Text style={styles.passwordHintText}>
            * อย่างน้อย 8 ตัวอักษร ประกอบด้วยตัวอักษรภาษาอังกฤษและตัวเลข
          </Text>

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
  container: { flex: 1, backgroundColor: '#fff' },
  scrollContent: { flexGrow: 1, paddingBottom: 40 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, marginBottom: 20, paddingBottom: 10
  },
  backButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#f3f4f6', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 20, fontWeight: '600', color: '#1f2937' },
  placeholder: { width: 40 },
  formContainer: { paddingHorizontal: 30, alignItems: 'center' },
  profileImageContainer: { marginBottom: 10, position: 'relative' },
  profileImage: { width: 120, height: 120, borderRadius: 60, borderWidth: 3, borderColor: '#10b981' },
  profilePlaceholder: { width: 120, height: 120, borderRadius: 60, backgroundColor: '#f3f4f6', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#e5e7eb', borderStyle: 'dashed' },
  editIconContainer: { position: 'absolute', bottom: 0, right: 0, backgroundColor: '#10b981', borderRadius: 22, width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: '#fff' },
  changePhotoButton: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 16, borderRadius: 20, backgroundColor: '#f0fdf4', marginBottom: 5 },
  changePhotoText: { fontSize: 13, color: '#10b981', fontWeight: '600', marginLeft: 6 },
  removeImageButton: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, marginBottom: 20 },
  removeImageText: { fontSize: 12, color: '#ef4444', marginLeft: 4 },
  inputContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f9fafb', borderRadius: 15, marginBottom: 15, borderWidth: 1, borderColor: '#e5e7eb', width: '100%' },
  iconContainer: { width: 50, alignItems: 'center', justifyContent: 'center' },
  input: { flex: 1, paddingVertical: 16, fontSize: 15, color: '#1f2937' },
  eyeIcon: { padding: 15 },
  passwordHintText: { alignSelf: 'flex-start', marginLeft: 10, marginBottom: 15, fontSize: 11, color: '#6b7280' },
  signUpButton: { backgroundColor: '#10b981', paddingVertical: 16, borderRadius: 15, alignItems: 'center', marginTop: 5, width: '100%', shadowColor: '#10b981', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 8 },
  signUpButtonText: { fontSize: 16, fontWeight: '600', color: '#fff' },
  loginContainer: { flexDirection: 'row', marginTop: 20, alignItems: 'center' },
  loginText: { fontSize: 14, color: '#6b7280' },
  loginLink: { fontSize: 14, color: '#10b981', fontWeight: '600' },
});