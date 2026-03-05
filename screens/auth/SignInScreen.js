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
// 🟢 เพิ่มการ Import Firestore เข้ามาเพื่อใช้ค้นหา Username
import { collection, query, where, getDocs } from 'firebase/firestore';
import { auth, db } from '../../firebase.config';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function SignInScreen({ navigation }) {
  const insets = useSafeAreaInsets();

  // 🟢 เปลี่ยนจาก email เป็น identifier (เพื่อรับทั้ง email และ username)
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

      // 🟢 เช็คว่าสิ่งที่กรอกมา ไม่ใช่อีเมล (ไม่มี @) ใช่หรือไม่?
      if (!loginEmail.includes('@')) {
        // ถ้าเป็น Username -> วิ่งไปหา Email ใน Firestore ก่อน
        const usersRef = collection(db, 'users');
        const q = query(usersRef, where('username', '==', loginEmail));
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
          // ถ้าหา Username ไม่เจอ
          Alert.alert('ข้อผิดพลาด', 'ไม่พบชื่อผู้ใช้นี้ในระบบ');
          setLoading(false);
          return;
        }

        // ถ้าเจอ ดึงอีเมลของคนนั้นออกมาใช้ล็อกอินต่อ
        loginEmail = querySnapshot.docs[0].data().email;
      }

      // 🟢 ล็อกอินเข้า Firebase ด้วยอีเมล
      await signInWithEmailAndPassword(auth, loginEmail, password);

    } catch (error) {
      console.error(error);
      let errorMessage = 'เกิดข้อผิดพลาดในการเข้าสู่ระบบ';

      if (error.code === 'auth/invalid-email') {
        errorMessage = 'รูปแบบอีเมลไม่ถูกต้อง';
      } else if (error.code === 'auth/user-not-found' || error.code === 'auth/invalid-credential') {
        errorMessage = 'บัญชีหรือรหัสผ่านไม่ถูกต้อง';
      } else if (error.code === 'auth/wrong-password') {
        errorMessage = 'รหัสผ่านไม่ถูกต้อง';
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
          <Text style={styles.headerTitle}>เข้าสู่ระบบ</Text>
          <View style={styles.placeholder} />
        </View>

        <View style={styles.formContainer}>
          <View style={styles.welcomeContainer}>
            <Ionicons name="leaf" size={60} color="#10b981" style={{ marginBottom: 10 }} />
            <Text style={styles.welcomeTitle}>ยินดีต้อนรับกลับมา!</Text>
            <Text style={styles.welcomeSubtitle}>เข้าสู่ระบบเพื่อเริ่มช่วยโลกกับเรา</Text>
          </View>

          {/* 🟢 ช่องกรอก Username หรือ Email */}
          <View style={styles.inputContainer}>
            <View style={styles.iconContainer}>
              <Ionicons name="person" size={20} color="#10b981" />
            </View>
            <TextInput
              style={styles.input}
              placeholder="ชื่อผู้ใช้ หรือ อีเมล"
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
            <Text style={styles.forgotPassword}>ลืมรหัสผ่าน?</Text>
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

          <View style={styles.registerContainer}>
            <Text style={styles.registerText}>ยังไม่มีบัญชีใช่ไหม? </Text>
            <TouchableOpacity onPress={() => navigation.navigate('SignUp')}>
              <Text style={styles.registerLink}>สมัครสมาชิก</Text>
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
    marginBottom: 30,
    paddingBottom: 10
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
  welcomeContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  welcomeTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 8,
  },
  welcomeSubtitle: {
    fontSize: 14,
    color: '#6b7280',
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
  forgotPasswordContainer: {
    alignSelf: 'flex-end',
    marginBottom: 25,
  },
  forgotPassword: {
    fontSize: 13,
    color: '#10b981',
    fontWeight: '600',
  },
  signInButton: {
    backgroundColor: '#10b981',
    paddingVertical: 16,
    borderRadius: 15,
    alignItems: 'center',
    marginBottom: 20,
    width: '100%',
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  signInButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  registerContainer: {
    flexDirection: 'row',
    marginTop: 10,
    alignItems: 'center',
  },
  registerText: {
    fontSize: 14,
    color: '#6b7280',
  },
  registerLink: {
    fontSize: 14,
    color: '#10b981',
    fontWeight: '600',
  },
});