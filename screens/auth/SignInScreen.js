import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
} from 'react-native';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../../firebase.config';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function SignInScreen({ navigation }) {
  const insets = useSafeAreaInsets();

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSignIn = async () => {
    if (!identifier || !password) {
      Alert.alert('ข้อผิดพลาด', 'กรุณากรอกข้อมูลให้ครบถ้วน');
      return;
    }

    setLoading(true);
    try {
      let loginEmail = identifier.trim();
      let foundUserData = null; // ตัวแปรเก็บข้อมูลผู้ใช้ที่ค้นเจอ

      const usersRef = collection(db, 'users');

      // 🟢 1. ค้นหาข้อมูลผู้ใช้ในระบบก่อน (เพื่อเช็คสถานะแบนก่อนยอมให้ Firebase ล็อกอิน)
      if (!loginEmail.includes('@')) {
        // กรณีพิมพ์ Username
        const q = query(usersRef, where('username', '==', loginEmail));
        const querySnapshot = await getDocs(q);

        if (!querySnapshot.empty) {
          foundUserData = querySnapshot.docs[0].data();
          loginEmail = foundUserData.email; // แปลง Username เป็น Email เพื่อใช้ล็อกอิน
        } else {
          Alert.alert('เข้าสู่ระบบล้มเหลว', 'ไม่พบชื่อผู้ใช้นี้ในระบบ');
          setLoading(false);
          return;
        }
      } else {
        // กรณีพิมพ์ Email
        const q = query(usersRef, where('email', '==', loginEmail));
        const querySnapshot = await getDocs(q);

        if (!querySnapshot.empty) {
          foundUserData = querySnapshot.docs[0].data();
        }
      }

      // 🔴 2. ด่านสกัดกั้น: เช็คสถานะการโดนแบนตรงนี้ก่อนเลย!
      if (foundUserData && foundUserData.currentRole === 'banned') {
        Alert.alert(
          'บัญชีถูกระงับ',
          'บัญชีของคุณถูกระงับการใช้งานเนื่องจากผิดเงื่อนไขบางประการ'
        );
        setLoading(false);
        return; // 🛑 หยุดการทำงาน ไม่ส่งคำสั่ง Login ไปให้ Firebase (ป้องกันการแว๊บไปหน้า Home)
      }

      // 🟢 3. ถ้าผ่านด่านแบนมาได้ ค่อยเข้าสู่ระบบของจริง
      const userCredential = await signInWithEmailAndPassword(auth, loginEmail, password);
      const user = userCredential.user;

      // ดึงข้อมูลอีกรอบเพื่อความชัวร์ หรือใช้ foundUserData ก็ได้
      const userDocRef = doc(db, 'users', user.uid);
      const userDocSnap = await getDoc(userDocRef);

      if (userDocSnap.exists()) {
        const userData = userDocSnap.data();
        Alert.alert('สำเร็จ! 🎉', 'เข้าสู่ระบบเรียบร้อยแล้ว');

        // พาไปหน้าถัดไปตาม Role
        if (userData.currentRole === 'admin') {
          navigation.replace('AdminHome');
        } else {
          navigation.replace('MainTabs');
        }
      } else {
        Alert.alert('ข้อผิดพลาด', 'ไม่พบข้อมูลผู้ใช้ในระบบ');
      }

    } catch (error) {
      console.error('Sign in error:', error);
      let errorMessage = 'เกิดข้อผิดพลาดในการเข้าสู่ระบบ';
      if (error.code === 'auth/user-not-found' || error.code === 'auth/invalid-credential') {
        errorMessage = 'อีเมลหรือรหัสผ่านไม่ถูกต้อง';
      } else if (error.code === 'auth/wrong-password') {
        errorMessage = 'รหัสผ่านไม่ถูกต้อง';
      } else if (error.code === 'auth/too-many-requests') {
        errorMessage = 'เข้าสู่ระบบผิดพลาดหลายครั้ง กรุณาลองใหม่ในภายหลัง';
      }
      Alert.alert('เข้าสู่ระบบล้มเหลว', errorMessage);
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
          <View style={styles.placeholder} />
        </View>

        <View style={styles.formContainer}>
          <View style={styles.welcomeContainer}>
            <Text style={styles.welcomeTitle}>ยินดีต้อนรับกลับมา!</Text>
            <Text style={styles.welcomeSubtitle}>
              เข้าสู่ระบบเพื่อลด Food Waste ไปด้วยกัน
            </Text>
          </View>

          <View style={styles.inputContainer}>
            <View style={styles.iconContainer}>
              <Ionicons name="person" size={20} color="#10b981" />
            </View>
            <TextInput
              style={styles.input}
              placeholder="อีเมล หรือ ชื่อผู้ใช้"
              value={identifier}
              onChangeText={setIdentifier}
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

          <TouchableOpacity
            style={styles.forgotPasswordContainer}
            onPress={() => navigation.navigate('ForgotPassword')}
          >
            <Text style={styles.forgotPassword}>ลืมรหัสผ่านใช่ไหม?</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.signInButton}
            onPress={handleSignIn}
            disabled={loading}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.signInButtonText}>เข้าสู่ระบบ</Text>
            )}
          </TouchableOpacity>

          <View style={styles.signUpContainer}>
            <Text style={styles.signUpText}>ยังไม่มีบัญชีใช่ไหม? </Text>
            <TouchableOpacity onPress={() => navigation.navigate('SignUp')}>
              <Text style={styles.signUpLink}>สร้างบัญชีเลย</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  scrollContent: { flexGrow: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, marginBottom: 30, paddingBottom: 10,
  },
  backButton: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: '#f3f4f6',
    alignItems: 'center', justifyContent: 'center',
  },
  placeholder: { width: 40 },
  formContainer: { paddingHorizontal: 30, flex: 1, justifyContent: 'center' },
  welcomeContainer: { alignItems: 'center', marginBottom: 40 },
  welcomeTitle: { fontSize: 24, fontWeight: 'bold', color: '#1f2937', marginBottom: 8 },
  welcomeSubtitle: { fontSize: 14, color: '#6b7280' },
  inputContainer: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#f9fafb',
    borderRadius: 15, marginBottom: 15, borderWidth: 1, borderColor: '#e5e7eb', width: '100%',
  },
  iconContainer: { width: 50, alignItems: 'center', justifyContent: 'center' },
  input: { flex: 1, paddingVertical: 16, fontSize: 15, color: '#1f2937' },
  eyeIcon: { padding: 15 },
  forgotPasswordContainer: { alignSelf: 'flex-end', marginBottom: 25 },
  forgotPassword: { fontSize: 13, color: '#10b981', fontWeight: '600' },
  signInButton: {
    backgroundColor: '#10b981', paddingVertical: 16, borderRadius: 15,
    alignItems: 'center', marginBottom: 30, width: '100%',
    shadowColor: '#10b981', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 8,
  },
  signInButtonText: { fontSize: 16, fontWeight: '600', color: '#fff' },
  signUpContainer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  signUpText: { fontSize: 14, color: '#6b7280' },
  signUpLink: { fontSize: 14, color: '#10b981', fontWeight: '600' },
});