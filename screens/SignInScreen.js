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
import { auth } from '../firebase.config';
import { Ionicons } from '@expo/vector-icons';

export default function SignInScreen({ navigation }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSignIn = async () => {
    if (!username || !password) {
      Alert.alert('ข้อผิดพลาด', 'กรุณากรอกข้อมูลให้ครบถ้วน');
      return;
    }

    setLoading(true);
    try {
      const email = username.includes('@') ? username : `${username}@foodwaste.app`;
      await signInWithEmailAndPassword(auth, email, password);
      
      // Navigate to Home after successful login
      //navigation.replace('Home');
    } catch (error) {
      console.error(error);
      let errorMessage = 'เกิดข้อผิดพลาดในการเข้าสู่ระบบ';
      
      if (error.code === 'auth/invalid-email') {
        errorMessage = 'รูปแบบอีเมลไม่ถูกต้อง';
      } else if (error.code === 'auth/user-not-found') {
        errorMessage = 'ไม่พบผู้ใช้งานนี้';
      } else if (error.code === 'auth/wrong-password') {
        errorMessage = 'รหัสผ่านไม่ถูกต้อง';
      } else if (error.code === 'auth/invalid-credential') {
        errorMessage = 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง';
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
        </View>

        <View style={styles.logoContainer}>
          <View style={styles.logoCircle}>
            <Ionicons name="leaf" size={60} color="#10b981" />
          </View>
          <Text style={styles.welcomeText}>ยินดีต้อนรับกลับ!</Text>
          <Text style={styles.subtitle}>เข้าสู่ระบบเพื่อจัดการอาหารของคุณ</Text>
        </View>

        <View style={styles.formContainer}>
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

          <TouchableOpacity 
            onPress={() => navigation.navigate('ForgotPassword')}
            style={styles.forgotPasswordContainer}
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

          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>หรือ</Text>
            <View style={styles.dividerLine} />
          </View>

          <TouchableOpacity
            style={styles.signUpButton}
            onPress={() => navigation.navigate('SignUp')}
            activeOpacity={0.8}
          >
            <Text style={styles.signUpButtonText}>สร้างบัญชีใหม่</Text>
          </TouchableOpacity>
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
    paddingVertical: 20,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 40,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoContainer: {
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 40,
  },
  logoCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#f0fdf4',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    shadowColor: '#10b981',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },
  welcomeText: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#6b7280',
  },
  formContainer: {
    paddingHorizontal: 30,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
    borderRadius: 15,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#e5e7eb',
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
    fontWeight: '500',
  },
  signInButton: {
    backgroundColor: '#10b981',
    paddingVertical: 16,
    borderRadius: 15,
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: '#10b981',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  signInButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#e5e7eb',
  },
  dividerText: {
    marginHorizontal: 15,
    fontSize: 13,
    color: '#9ca3af',
  },
  signUpButton: {
    backgroundColor: '#fff',
    paddingVertical: 16,
    borderRadius: 15,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#10b981',
  },
  signUpButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#10b981',
  },
});
