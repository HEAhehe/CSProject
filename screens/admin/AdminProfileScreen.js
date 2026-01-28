import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Alert,
  StatusBar,
  ScrollView
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { auth, db } from '../../firebase.config';
import { doc, getDoc } from 'firebase/firestore';
import { useFocusEffect } from '@react-navigation/native';

export default function AdminProfileScreen({ navigation }) {
  const [userData, setUserData] = useState(null);

  useFocusEffect(
    useCallback(() => {
      loadUserData();
    }, [])
  );

  const loadUserData = async () => {
    try {
      const user = auth.currentUser;
      if (user) {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          setUserData(userDoc.data());
        }
      }
    } catch (error) {
      console.error('Error loading user data:', error);
    }
  };

  const handleLogout = () => {
    Alert.alert(
      'ออกจากระบบ',
      'คุณต้องการออกจากระบบผู้ดูแลหรือไม่?',
      [
        { text: 'ยกเลิก', style: 'cancel' },
        {
          text: 'ยืนยัน',
          style: 'destructive',
          onPress: async () => {
            await auth.signOut();
            // App.js จะจัดการเปลี่ยนหน้าให้เอง
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>โปรไฟล์ผู้ดูแล</Text>
          <Text style={styles.headerSubtitle}>จัดการข้อมูลส่วนตัว</Text>
        </View>
      </View>

      <ScrollView style={styles.content}>
        {/* Profile Card */}
        <View style={styles.profileCard}>
          <View style={styles.avatarContainer}>
            {userData?.profileImage ? (
              <Image source={{ uri: userData.profileImage }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Ionicons name="person" size={40} color="#6b7280" />
              </View>
            )}
            <View style={styles.adminBadge}>
              <Ionicons name="shield-checkmark" size={12} color="#fff" />
            </View>
          </View>

          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>{userData?.username || 'Admin'}</Text>
            <Text style={styles.profileEmail}>{userData?.email}</Text>
            <View style={styles.roleContainer}>
              <Text style={styles.roleText}>SUPER ADMIN</Text>
            </View>
          </View>
        </View>

        {/* Menu Section */}
        <View style={styles.menuSection}>
          <Text style={styles.sectionTitle}>การตั้งค่าบัญชี</Text>

          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => navigation.navigate('EditProfile')}
          >
            <View style={[styles.iconBox, { backgroundColor: '#eff6ff' }]}>
              <Ionicons name="person-circle-outline" size={22} color="#3b82f6" />
            </View>
            <Text style={styles.menuText}>แก้ไขข้อมูลส่วนตัว</Text>
            <Ionicons name="chevron-forward" size={20} color="#d1d5db" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.menuItem}
            // onPress={() => navigation.navigate('ChangePassword')}
          >
            <View style={[styles.iconBox, { backgroundColor: '#f0fdf4' }]}>
              <Ionicons name="lock-closed-outline" size={22} color="#10b981" />
            </View>
            <Text style={styles.menuText}>เปลี่ยนรหัสผ่าน</Text>
            <Ionicons name="chevron-forward" size={20} color="#d1d5db" />
          </TouchableOpacity>
        </View>

        {/* Logout Button */}
        <TouchableOpacity
          style={styles.logoutButton}
          onPress={handleLogout}
        >
          <Ionicons name="log-out-outline" size={20} color="#ef4444" />
          <Text style={styles.logoutText}>ออกจากระบบ</Text>
        </TouchableOpacity>

      </ScrollView>

      {/* Bottom Nav */}
      <View style={styles.bottomNav}>
        <TouchableOpacity
          style={styles.navItem}
          onPress={() => navigation.navigate('AdminHome')}
        >
          <Ionicons name="home-outline" size={24} color="#9ca3af" />
          <Text style={styles.navLabel}>หน้าหลัก</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navItem}
          onPress={() => navigation.navigate('AdminUsers')}
        >
          <Ionicons name="people-outline" size={24} color="#9ca3af" />
          <Text style={styles.navLabel}>บัญชี</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navItem}
          onPress={() => navigation.navigate('AdminReports')}
        >
          <Ionicons name="stats-chart-outline" size={24} color="#9ca3af" />
          <Text style={styles.navLabel}>รายงาน</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.navItem}>
          <Ionicons name="person" size={24} color="#1f2937" />
          <Text style={styles.navLabelActive}>โปรไฟล์</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  header: {
    paddingHorizontal: 20, paddingTop: 60, paddingBottom: 20,
    backgroundColor: '#fff',
  },
  headerTitle: { fontSize: 24, fontWeight: 'bold', color: '#1f2937' },
  headerSubtitle: { fontSize: 14, color: '#6b7280' },
  content: { flex: 1, padding: 20 },

  profileCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff',
    padding: 20, borderRadius: 16, marginBottom: 20,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },
  avatarContainer: { position: 'relative', marginRight: 16 },
  avatar: { width: 64, height: 64, borderRadius: 32 },
  avatarPlaceholder: {
    width: 64, height: 64, borderRadius: 32, backgroundColor: '#f3f4f6',
    alignItems: 'center', justifyContent: 'center',
  },
  adminBadge: {
    position: 'absolute', bottom: 0, right: 0, backgroundColor: '#8b5cf6',
    width: 20, height: 20, borderRadius: 10, alignItems: 'center',
    justifyContent: 'center', borderWidth: 2, borderColor: '#fff',
  },
  profileInfo: { flex: 1 },
  profileName: { fontSize: 18, fontWeight: '700', color: '#1f2937' },
  profileEmail: { fontSize: 13, color: '#6b7280', marginBottom: 6 },
  roleContainer: {
    backgroundColor: '#f3e8ff', alignSelf: 'flex-start',
    paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6,
  },
  roleText: { fontSize: 10, fontWeight: '700', color: '#7c3aed' },

  sectionTitle: {
    fontSize: 14, fontWeight: '600', color: '#6b7280',
    marginBottom: 10, marginLeft: 4,
  },
  menuSection: { marginBottom: 24 },
  menuItem: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff',
    padding: 16, borderRadius: 12, marginBottom: 8,
  },
  iconBox: {
    width: 36, height: 36, borderRadius: 8, alignItems: 'center',
    justifyContent: 'center', marginRight: 12,
  },
  menuText: { flex: 1, fontSize: 15, color: '#374151', fontWeight: '500' },

  logoutButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#fee2e2', padding: 16, borderRadius: 12,
    marginBottom: 40, gap: 8,
  },
  logoutText: { fontSize: 16, fontWeight: '600', color: '#ef4444' },

  bottomNav: {
    flexDirection: 'row', backgroundColor: '#fff', paddingVertical: 8,
    paddingHorizontal: 16, borderTopWidth: 1, borderTopColor: '#f3f4f6',
    position: 'absolute', bottom: 0, left: 0, right: 0,
  },
  navItem: { flex: 1, alignItems: 'center', paddingVertical: 8 },
  navLabel: { fontSize: 11, color: '#9ca3af', marginTop: 4 },
  navLabelActive: { fontSize: 11, color: '#1f2937', fontWeight: '600', marginTop: 4 },
});