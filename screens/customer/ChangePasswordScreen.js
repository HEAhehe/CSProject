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
import { updatePassword, EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';
import { auth } from '../../firebase.config';
import { Ionicons } from '@expo/vector-icons';

export default function ChangePasswordScreen({ navigation }) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  // ซ่อน/แสดง รหัสผ่าน
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);

  const handleChangePassword = async () => {
    // 1. ตรวจสอบข้อมูลเบื้องต้น
    if (!currentPassword || !newPassword || !confirmPassword) {
      Alert.alert('แจ้งเตือน', 'กรุณากรอกข้อมูลให้ครบทุกช่อง');
      return;
    }

    if (newPassword.length < 6) {
      Alert.alert('แจ้งเตือน', 'รหัสผ่านใหม่ต้องมีอย่างน้อย 6 ตัวอักษร');
      return;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert('แจ้งเตือน', 'รหัสผ่านใหม่และการยืนยันรหัสผ่านไม่ตรงกัน');
      return;
    }

    setLoading(true);
    try {
      const user = auth.currentUser;

      // 2. ยืนยันตัวตนด้วยรหัสผ่านเดิม (Re-authenticate) ก่อนเปลี่ยนรหัสใหม่
      const credential = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(user, credential);

      // 3. ทำการอัปเดตรหัสผ่านใหม่
      await updatePassword(user, newPassword);

      Alert.alert(
        'สำเร็จ',
        'อัปเดตรหัสผ่านของคุณเรียบร้อยแล้ว',
        [
          {
            text: 'ตกลง',
            onPress: () => navigation.goBack(),
          },
        ]
      );
    } catch (error) {
      console.error("Change Password Error:", error);
      let errorMessage = 'เกิดข้อผิดพลาดในการเปลี่ยนรหัสผ่าน';

      if (error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
        errorMessage = 'รหัสผ่านปัจจุบันไม่ถูกต้อง';
      } else if (error.code === 'auth/requires-recent-login') {
        errorMessage = 'กรุณาล็อกเอาท์และล็อกอินใหม่อีกครั้งก่อนทำรายการนี้';
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

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#1f2937" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>เปลี่ยนรหัสผ่าน</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.contentContainer}>
          <View style={styles.iconCircle}>
            <Ionicons name="key-outline" size={50} color="#3b82f6" />
          </View>
          <Text style={styles.subtitle}>
            เพื่อความปลอดภัยของบัญชี กรุณากรอกรหัสผ่านปัจจุบัน และตั้งรหัสผ่านใหม่ (อย่างน้อย 6 ตัวอักษร)
          </Text>

          <View style={styles.formContainer}>
            {/* รหัสผ่านปัจจุบัน */}
            <Text style={styles.inputLabel}>รหัสผ่านปัจจุบัน</Text>
            <View style={styles.inputContainer}>
              <Ionicons name="lock-closed-outline" size={20} color="#9ca3af" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="กรอกรหัสผ่านปัจจุบัน"
                value={currentPassword}
                onChangeText={setCurrentPassword}
                secureTextEntry={!showCurrentPassword}
                placeholderTextColor="#9ca3af"
              />
              <TouchableOpacity onPress={() => setShowCurrentPassword(!showCurrentPassword)} style={styles.eyeIcon}>
                <Ionicons name={showCurrentPassword ? "eye-outline" : "eye-off-outline"} size={20} color="#9ca3af" />
              </TouchableOpacity>
            </View>

            {/* รหัสผ่านใหม่ */}
            <Text style={styles.inputLabel}>รหัสผ่านใหม่</Text>
            <View style={styles.inputContainer}>
              <Ionicons name="shield-checkmark-outline" size={20} color="#9ca3af" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="รหัสผ่านใหม่ (อย่างน้อย 6 ตัวอักษร)"
                value={newPassword}
                onChangeText={setNewPassword}
                secureTextEntry={!showNewPassword}
                placeholderTextColor="#9ca3af"
              />
              <TouchableOpacity onPress={() => setShowNewPassword(!showNewPassword)} style={styles.eyeIcon}>
                <Ionicons name={showNewPassword ? "eye-outline" : "eye-off-outline"} size={20} color="#9ca3af" />
              </TouchableOpacity>
            </View>

            {/* ยืนยันรหัสผ่านใหม่ */}
            <Text style={styles.inputLabel}>ยืนยันรหัสผ่านใหม่</Text>
            <View style={styles.inputContainer}>
              <Ionicons name="shield-checkmark-outline" size={20} color="#9ca3af" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="กรอกรหัสผ่านใหม่อีกครั้ง"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry={!showNewPassword}
                placeholderTextColor="#9ca3af"
              />
            </View>

            <TouchableOpacity
              style={styles.submitButton}
              onPress={handleChangePassword}
              disabled={loading}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.submitButtonText}>บันทึกรหัสผ่านใหม่</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 60 : 60,
    paddingBottom: 15,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6'
  },
  backButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#f3f4f6', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '600', color: '#1f2937' },
  placeholder: { width: 40 },
  scrollContent: { flexGrow: 1 },
  contentContainer: { alignItems: 'center', paddingHorizontal: 30, paddingTop: 30 },
  iconCircle: { width: 100, height: 100, borderRadius: 50, backgroundColor: '#eff6ff', alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  subtitle: { fontSize: 14, color: '#6b7280', textAlign: 'center', lineHeight: 22, marginBottom: 30 },
  formContainer: { width: '100%' },
  inputLabel: { fontSize: 14, fontWeight: '500', color: '#374151', marginBottom: 8, marginLeft: 4 },
  inputContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f9fafb', borderRadius: 12, marginBottom: 20, borderWidth: 1, borderColor: '#e5e7eb', paddingHorizontal: 15 },
  inputIcon: { marginRight: 10 },
  input: { flex: 1, paddingVertical: 15, fontSize: 15, color: '#1f2937' },
  eyeIcon: { padding: 5 },
  submitButton: { backgroundColor: '#3b82f6', paddingVertical: 16, borderRadius: 12, alignItems: 'center', marginTop: 10, shadowColor: '#3b82f6', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 5 },
  submitButtonText: { fontSize: 16, fontWeight: '600', color: '#fff' },
});