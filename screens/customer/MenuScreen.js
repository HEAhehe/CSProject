import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  Image,
  Alert,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { auth, db } from '../../firebase.config';
import { doc, onSnapshot } from 'firebase/firestore';

export default function MenuScreen({ navigation }) {
  const [userData, setUserData] = useState(null);

  const defaultAvatar = Image.resolveAssetSource(require('../../assets/icon.png')).uri;

  useEffect(() => {
    const user = auth.currentUser;
    if (user) {
      const unsubscribe = onSnapshot(doc(db, 'users', user.uid), (doc) => {
        if (doc.exists()) {
          setUserData(doc.data());
        }
      });
      return () => unsubscribe();
    }
  }, []);

  const handleLogout = () => {
    Alert.alert(
      'ออกจากระบบ',
      'คุณต้องการออกจากระบบหรือไม่?',
      [
        { text: 'ยกเลิก', style: 'cancel' },
        {
          text: 'ออกจากระบบ',
          style: 'destructive',
          onPress: async () => {
            await auth.signOut();
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#e5e5e5" />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.logoContainer}>
           <View style={styles.logoCircle}>
             <Ionicons name="image-outline" size={20} color="#9ca3af" />
           </View>
           <View>
             <Text style={styles.appName}>ชื่อแอป</Text>
             <Text style={styles.appSlogan}>สโลแกน...</Text>
           </View>
        </View>

        {/* ปุ่มปิด (X) */}
        <TouchableOpacity
          style={styles.closeButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="close" size={22} color="#1f2937" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>

        {/* Profile Card (กรอบขาว ขอบดำ) */}
        <View style={styles.profileCard}>
          <View style={styles.profileHeader}>
            <Image
              source={userData?.profileImage ? { uri: userData.profileImage } : { uri: defaultAvatar }}
              style={styles.avatar}
            />
            <View>
              <Text style={styles.username}>{userData?.username || 'Username'}</Text>
              <Text style={styles.userRole}>ลูกค้า (Role)</Text>
            </View>
          </View>

          <View style={styles.modeContainer}>
            <TouchableOpacity style={styles.modeButtonActive}>
              <Ionicons name="cart-outline" size={16} color="#1f2937" />
              <Text style={styles.modeTextActive}>โหมดลูกค้า</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.modeButtonInactive}
              onPress={() => navigation.navigate('RegisterStoreStep1')}
            >
              <Ionicons name="storefront-outline" size={16} color="#1f2937" />
              <Text style={styles.modeTextInactive}>โหมดเจ้าของร้าน</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Menu Section */}
        <Text style={styles.sectionTitle}>เมนูหลัก</Text>

        <TouchableOpacity style={styles.menuItem} onPress={() => navigation.navigate('Home')}>
          <Text style={styles.menuText}>หน้าหลัก</Text>
          <Ionicons name="chevron-forward" size={18} color="#6b7280" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuItem} onPress={() => navigation.navigate('Orders')}>
          <Text style={styles.menuText}>คำสั่งซื้อของฉัน</Text>
          <Ionicons name="chevron-forward" size={18} color="#6b7280" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuItem} onPress={() => navigation.navigate('FavoriteStores')}>
          <Text style={styles.menuText}>ร้านโปรด</Text>
          <Ionicons name="chevron-forward" size={18} color="#6b7280" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuItem} onPress={() => navigation.navigate('Notifications')}>
          <Text style={styles.menuText}>แจ้งเตือน</Text>
          <Ionicons name="chevron-forward" size={18} color="#6b7280" />
        </TouchableOpacity>

        <Text style={styles.sectionTitle}>บัญชี</Text>

        <TouchableOpacity style={styles.menuItem} onPress={() => navigation.navigate('Profile')}>
          <Text style={styles.menuText}>โปรไฟล์</Text>
          <Ionicons name="chevron-forward" size={18} color="#6b7280" />
        </TouchableOpacity>

        {/* Logout */}
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={24} color="#ef4444" />
          <Text style={styles.logoutText}>Log out</Text>
        </TouchableOpacity>

        <View style={{ height: 50 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#e5e5e5' }, // พื้นหลังสีเทาอ่อนเหมือน UI

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20
  },
  logoContainer: { flexDirection: 'row', alignItems: 'center', gap: 15 },
  logoCircle: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#ccc' },
  appName: { fontSize: 16, fontWeight: 'bold', color: '#1f2937' },
  appSlogan: { fontSize: 12, color: '#6b7280' },
  closeButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'transparent', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#999' },

  content: { flex: 1, paddingHorizontal: 20 },

  // Profile Card
  profileCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 15,
    borderWidth: 1,
    borderColor: '#000', // ขอบสีดำชัดเจน
    marginBottom: 25,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 15,
    marginBottom: 15,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#f3f4f6'
  },
  username: { fontSize: 16, fontWeight: 'bold', color: '#1f2937' },
  userRole: { fontSize: 13, color: '#6b7280' },

  modeContainer: { flexDirection: 'row', gap: 10 },
  modeButtonActive: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 8,
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#000', // Active มีขอบดำ
  },
  modeButtonInactive: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 8,
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#000', // Inactive ก็มีขอบ (ตามรูป)
  },
  modeTextActive: { fontSize: 11, fontWeight: 'bold', color: '#1f2937' },
  modeTextInactive: { fontSize: 11, color: '#1f2937' },

  // Menu Items
  sectionTitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
    marginLeft: 5,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff', // ปุ่มสีขาว
    paddingVertical: 14,
    paddingHorizontal: 15,
    borderRadius: 10,
    marginBottom: 10,
  },
  menuText: {
    fontSize: 15,
    color: '#1f2937',
    fontWeight: '500',
  },

  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 20,
    marginLeft: 5,
  },
  logoutText: {
    fontSize: 16,
    color: '#ef4444',
    fontWeight: 'bold',
  },
});