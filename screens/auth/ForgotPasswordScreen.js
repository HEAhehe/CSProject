import React, { useState, useEffect } from 'react';
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
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../../firebase.config';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function ForgotPasswordScreen({ navigation }) {
  const insets = useSafeAreaInsets();

  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  // 🟢 เพิ่ม State สำหรับสถานะการส่งและนับถอยหลัง
  const [emailSent, setEmailSent] = useState(false);
  const [countdown, setCountdown] = useState(0);

  // 🟢 ระบบนับถอยหลัง (ทำงานอัตโนมัติเมื่อ countdown > 0)
  useEffect(() => {
    let timer;
    if (countdown > 0) {
      timer = setInterval(() => {
        setCountdown((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [countdown]);

  const handleResetPassword = async () => {
    if (!email) {
      Alert.alert('ข้อผิดพลาด', 'กรุณากรอกอีเมลของคุณ');
      return;
    }

    const emailRegex = /\S+@\S+\.\S+/;
    if (!emailRegex.test(email)) {
      Alert.alert('ข้อผิดพลาด', 'รูปแบบอีเมลไม่ถูกต้อง');
      return;
    }

    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, email.trim());

      // 🟢 เมื่อส่งสำเร็จ ให้โชว์ข้อความและเริ่มนับถอยหลัง 30 วิ (ไม่เด้งออก)
      setEmailSent(true);
      setCountdown(30);

    } catch (error) {
      console.error(error);
      let errorMessage = 'เกิดข้อผิดพลาดในการส่งลิงก์';

      if (error.code === 'auth/invalid-email') {
        errorMessage = 'รูปแบบอีเมลไม่ถูกต้อง';
      } else if (error.code === 'auth/user-not-found') {
        errorMessage = 'ไม่พบอีเมลนี้ในระบบ กรุณาตรวจสอบอีกครั้ง';
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
          <Text style={styles.headerTitle}>ลืมรหัสผ่าน</Text>
          <View style={styles.placeholder} />
        </View>

        <View style={styles.formContainer}>
          <View style={styles.iconCircle}>
            <Ionicons name="lock-closed-outline" size={60} color="#10b981" />
          </View>

          <Text style={styles.title}>ลืมรหัสผ่านใช่ไหม?</Text>
          <Text style={styles.subtitle}>
            กรุณากรอกอีเมลที่คุณใช้สมัครบัญชี เราจะส่งลิงก์สำหรับตั้งรหัสผ่านใหม่ไปให้คุณทางอีเมล
          </Text>

          <View style={styles.inputContainer}>
            <View style={styles.iconContainer}>
              <Ionicons name="mail" size={20} color="#10b981" />
            </View>
            <TextInput
              style={styles.input}
              placeholder="อีเมลของคุณ"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              placeholderTextColor="#9ca3af"
              editable={countdown === 0} // ป้องกันการแก้ค่ายูสเซอร์ระหว่างรอ
            />
          </View>

          {/* 🟢 แสดงกล่องข้อความเมื่อกดส่งลิงก์ไปแล้ว */}
          {emailSent && (
            <View style={styles.successAlertBox}>
              <Ionicons name="mail-unread" size={24} color="#059669" style={{ marginTop: 2 }} />
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={styles.successAlertTitle}>ส่งลิงก์สำเร็จแล้ว!</Text>
                <Text style={styles.successAlertDesc}>
                  กรุณาตรวจสอบในกล่องข้อความของคุณ หากไม่พบโปรดตรวจสอบในโฟลเดอร์ <Text style={{fontWeight: 'bold'}}>จดหมายขยะ (Spam/Junk)</Text>
                </Text>
              </View>
            </View>
          )}

          {/* 🟢 เปลี่ยนปุ่มให้แสดงเวลาถอยหลัง และล็อกปุ่มเมื่อเวลากำลังเดิน */}
          <TouchableOpacity
            style={[styles.resetButton, countdown > 0 && styles.resetButtonDisabled]}
            onPress={handleResetPassword}
            disabled={loading || countdown > 0}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.resetButtonText}>
                {countdown > 0
                  ? `ส่งลิงก์ใหม่อีกครั้ง (${countdown}s)`
                  : (emailSent ? 'ส่งลิงก์อีกครั้ง' : 'ส่งลิงก์รีเซ็ตรหัสผ่าน')
                }
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.backToLoginBtn}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.backToLoginText}>กลับไปหน้าเข้าสู่ระบบ</Text>
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
  iconCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#ecfdf5',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 25,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 15,
  },
  subtitle: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 30,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
    borderRadius: 15,
    marginBottom: 25,
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

  // 🟢 สไตล์สำหรับกล่องข้อความเตือนให้เช็คอีเมล
  successAlertBox: {
    flexDirection: 'row',
    backgroundColor: '#d1fae5',
    padding: 15,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#a7f3d0',
    width: '100%',
    marginBottom: 20,
    alignItems: 'flex-start',
  },
  successAlertTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#065f46',
    marginBottom: 4,
  },
  successAlertDesc: {
    fontSize: 13,
    color: '#064e3b',
    lineHeight: 20,
  },

  resetButton: {
    backgroundColor: '#10b981',
    paddingVertical: 16,
    borderRadius: 15,
    alignItems: 'center',
    width: '100%',
    marginBottom: 20,
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  // 🟢 สไตล์ปุ่มตอนถูกปิดใช้งาน (กำลังนับถอยหลัง)
  resetButtonDisabled: {
    backgroundColor: '#9ca3af',
    shadowOpacity: 0,
    elevation: 0,
  },
  resetButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  backToLoginBtn: {
    padding: 10,
  },
  backToLoginText: {
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '500',
  }
});