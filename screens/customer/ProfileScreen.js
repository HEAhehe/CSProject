import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  Image,
  Alert,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { auth, db } from '../../firebase.config';
import { doc, onSnapshot } from 'firebase/firestore';

export default function ProfileScreen({ navigation }) {
  const [userData, setUserData] = useState(null);

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

  const totalWeight = userData?.totalWeightSaved || 0;
  const co2Saved = totalWeight * 2.5;

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

  const menuItems = [
    { icon: 'person-outline', title: 'แก้ไขโปรไฟล์', subtitle: 'เปลี่ยนข้อมูลส่วนตัว', color: '#10b981', screen: 'EditProfile' },
    { icon: 'storefront-outline', title: 'สมัครเป็นร้านค้า', subtitle: 'เริ่มขายอาหารกับเรา', color: '#f59e0b', screen: 'RegisterStoreStep1', requiresGuest: true },
    { icon: 'lock-closed-outline', title: 'เปลี่ยนรหัสผ่าน', subtitle: 'อัปเดตรหัสผ่านของคุณ', color: '#3b82f6', screen: 'ChangePassword' },
    { icon: 'heart-outline', title: 'รายการโปรด', subtitle: 'ร้านค้าและสินค้าที่ชื่นชอบ', color: '#f43f5e', screen: 'FavoriteStores' },
    { icon: 'notifications-outline', title: 'การแจ้งเตือน', subtitle: 'ตั้งค่าการแจ้งเตือน', color: '#f59e0b', screen: 'Notifications' },
  ];

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#1f2937" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>โปรไฟล์</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.profileSection}>
          <View style={styles.profileImageContainer}>
            {userData?.profileImage ? (
              <Image source={{ uri: userData.profileImage }} style={styles.profileImage} />
            ) : (
              <View style={styles.profilePlaceholder}><Ionicons name="person" size={50} color="#10b981" /></View>
            )}
            <View style={[styles.statusDot, { backgroundColor: userData?.currentRole === 'store' ? '#f59e0b' : '#10b981' }]} />
          </View>
          <Text style={styles.profileName}>{userData?.username || 'User'}</Text>
          <Text style={styles.profileEmail}>{userData?.email || ''}</Text>

          {/* Impact Dashboard - ปรับขนาดให้เท่ากัน */}
          <View style={styles.impactContainer}>
            <View style={styles.impactCard}>
              <View style={styles.impactIconBg}>
                <Ionicons name="leaf" size={20} color="#10b981" />
              </View>
              <View style={styles.valueRow}>
                <Text style={styles.impactValue}>{totalWeight.toFixed(1)}</Text>
                <Text style={styles.unitText}> kg</Text>
              </View>
              <Text style={styles.impactLabel}>ลดขยะอาหาร</Text>
            </View>

            <View style={[styles.impactCard, { borderColor: '#dbeafe', backgroundColor: '#eff6ff' }]}>
              <View style={[styles.impactIconBg, { backgroundColor: '#dbeafe' }]}>
                <Ionicons name="cloud-done" size={20} color="#3b82f6" />
              </View>
              <View style={styles.valueRow}>
                <Text style={[styles.impactValue, { color: '#3b82f6' }]}>{co2Saved.toFixed(1)}</Text>
                <Text style={[styles.unitText, { color: '#3b82f6' }]}> kg</Text>
              </View>
              <Text style={styles.impactLabel}>ลด CO2 สะสม</Text>
            </View>
          </View>
        </View>

        <View style={styles.menuSection}>
          {menuItems.map((item, index) => {
            if (item.requiresGuest && userData?.currentRole === 'store') return null;
            return (
              <TouchableOpacity key={index} style={styles.menuItem} onPress={() => item.screen && navigation.navigate(item.screen)}>
                <View style={[styles.menuIcon, { backgroundColor: `${item.color}15` }]}>
                  <Ionicons name={item.icon} size={24} color={item.color} />
                </View>
                <View style={styles.menuContent}>
                  <Text style={styles.menuTitle}>{item.title}</Text>
                  <Text style={styles.menuSubtitle}>{item.subtitle}</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#d1d5db" />
              </TouchableOpacity>
            );
          })}
        </View>

        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={22} color="#ef4444" />
          <Text style={styles.logoutText}>ออกจากระบบ</Text>
        </TouchableOpacity>
        <Text style={styles.versionText}>เวอร์ชัน 1.0.0</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
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
  content: { flex: 1 },
  profileSection: { backgroundColor: '#fff', alignItems: 'center', paddingVertical: 30, marginBottom: 15 },
  profileImageContainer: { position: 'relative', marginBottom: 15 },
  profileImage: { width: 100, height: 100, borderRadius: 50, borderWidth: 3, borderColor: '#10b981' },
  profilePlaceholder: { width: 100, height: 100, borderRadius: 50, backgroundColor: '#f0fdf4', alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: '#10b981' },
  statusDot: { position: 'absolute', bottom: 5, right: 5, width: 20, height: 20, borderRadius: 10, borderWidth: 3, borderColor: '#fff' },
  profileName: { fontSize: 24, fontWeight: 'bold', color: '#1f2937', marginBottom: 5 },
  profileEmail: { fontSize: 14, color: '#6b7280', marginBottom: 25 },

  impactContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    width: '100%',
    justifyContent: 'center',
    gap: 15
  },
  impactCard: {
    flex: 1, // ทำให้การ์ดสองใบขยายเท่ากัน
    maxWidth: 170, // ป้องกันไม่ให้การ์ดกว้างเกินไปในหน้าจอใหญ่
    backgroundColor: '#f0fdf4',
    borderRadius: 20,
    paddingVertical: 20,
    paddingHorizontal: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#dcfce7',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  impactIconBg: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#dcfce7',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  impactValue: { fontSize: 22, fontWeight: 'bold', color: '#10b981' },
  unitText: { fontSize: 14, fontWeight: '600', color: '#10b981' },
  impactLabel: { fontSize: 12, color: '#6b7280', marginTop: 4, fontWeight: '500' },

  menuSection: { backgroundColor: '#fff', paddingVertical: 10, marginBottom: 15 },
  menuItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 15, paddingHorizontal: 20 },
  menuIcon: { width: 45, height: 45, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 15 },
  menuContent: { flex: 1 },
  menuTitle: { fontSize: 15, fontWeight: '600', color: '#1f2937', marginBottom: 2 },
  menuSubtitle: { fontSize: 12, color: '#9ca3af' },
  logoutButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff', marginHorizontal: 20, paddingVertical: 15, borderRadius: 12, marginBottom: 20 },
  logoutText: { fontSize: 16, fontWeight: '600', color: '#ef4444', marginLeft: 8 },
  versionText: { fontSize: 12, color: '#9ca3af', textAlign: 'center', marginBottom: 30 },
});