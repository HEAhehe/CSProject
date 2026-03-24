import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Image,
  ActivityIndicator,
  Platform,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { auth, db } from '../../firebase.config';
import { doc, getDoc } from 'firebase/firestore';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function StoreProfileScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [storeData, setStoreData] = useState(null);
  const [loading, setLoading] = useState(true);

  const defaultAvatar = Image.resolveAssetSource(require('../../assets/icon.png')).uri;

  useEffect(() => {
    loadStoreProfile();
  }, []);

  const loadStoreProfile = async () => {
    try {
      const user = auth.currentUser;
      if (!user) return;

      const storeDoc = await getDoc(doc(db, 'stores', user.uid));
      if (storeDoc.exists()) {
        setStoreData(storeDoc.data());
      }
    } catch (error) {
      console.error('Error loading store profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    Alert.alert('ออกจากระบบ', 'คุณต้องการออกจากระบบหรือไม่?', [
        { text: 'ยกเลิก', style: 'cancel' },
        { text: 'ออกจากระบบ', style: 'destructive', onPress: async () => { await auth.signOut(); } }
    ]);
  };

  const menuItems = [
    {
      icon: 'person-outline',
      iconBg: '#ecfdf5',
      iconColor: '#10b981',
      title: 'แก้ไขโปรไฟล์',
      subtitle: 'เปลี่ยนข้อมูลร้านค้า',
      onPress: () => navigation.navigate('StoreSettings'),
    },
    {
      icon: 'lock-closed-outline',
      iconBg: '#eff6ff',
      iconColor: '#3b82f6',
      title: 'เปลี่ยนรหัสผ่าน',
      subtitle: 'อัปเดตรหัสผ่านของคุณ',
      onPress: () => navigation.navigate('ChangePassword'),
    },
    {
      icon: 'notifications-outline',
      iconBg: '#fffbeb',
      iconColor: '#f59e0b',
      title: 'การแจ้งเตือน',
      subtitle: 'ตั้งค่าการแจ้งเตือน',
      onPress: () => navigation.navigate('StoreNotifications'),
    },
  ];

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#10b981" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      <View style={[styles.header, { paddingTop: Math.max(insets.top, 15) }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={22} color="#1f2937" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>โปรไฟล์ร้านค้า</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.scrollContent, { paddingBottom: Math.max(insets.bottom, 40) + 20 }]}>

        <View style={styles.profileSection}>
          <View style={styles.avatarWrapper}>
            <Image
              source={storeData?.storeImage ? { uri: storeData.storeImage } : { uri: defaultAvatar }}
              style={styles.avatar}
            />
            <View style={styles.onlineDot} />
          </View>

          {/* 🟢 แสดงแค่ชื่อร้าน และ อีเมล */}
          <Text style={styles.storeName}>{storeData?.storeName || 'ชื่อร้านค้า'}</Text>
          <Text style={styles.storeEmail}>{auth.currentUser?.email || 'ไม่ระบุอีเมล'}</Text>

          {/* 🟢 การ์ดลดขยะอาหาร พร้อมคำใบ้ว่า "ดูประวัติ >" */}
          <View style={styles.impactContainer}>
            <TouchableOpacity style={styles.impactCard} activeOpacity={0.7} onPress={() => navigation.navigate('StoreImpactHistory', { initialTab: 'food' })}>
              <View style={styles.impactIconBg}><Ionicons name="leaf" size={20} color="#10b981" /></View>
              <View style={styles.valueRow}>
                <Text style={styles.impactValue}>
                  {storeData?.totalFoodSaved ? Number(storeData.totalFoodSaved).toFixed(1) : '0.0'}
                </Text>
                <Text style={styles.unitText}> kg</Text>
              </View>
              <Text style={styles.impactLabel}>ลดขยะอาหาร</Text>

              {/* คำใบ้ให้กดได้ */}
              <View style={styles.clickHintRow}>
                <Text style={[styles.clickHintText, { color: '#10b981' }]}>ดูประวัติ</Text>
                <Ionicons name="chevron-forward" size={10} color="#10b981" />
              </View>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.impactCard, { borderColor: '#dbeafe', backgroundColor: '#eff6ff' }]} activeOpacity={0.7} onPress={() => navigation.navigate('StoreImpactHistory', { initialTab: 'co2' })}>
              <View style={[styles.impactIconBg, { backgroundColor: '#dbeafe' }]}><Ionicons name="cloud-done" size={20} color="#3b82f6" /></View>
              <View style={styles.valueRow}>
                <Text style={[styles.impactValue, { color: '#3b82f6' }]}>
                  {storeData?.totalCO2Saved ? Number(storeData.totalCO2Saved).toFixed(1) : '0.0'}
                </Text>
                <Text style={[styles.unitText, { color: '#3b82f6' }]}> kg</Text>
              </View>
              <Text style={styles.impactLabel}>ลด CO2 สะสม</Text>

              {/* คำใบ้ให้กดได้ */}
              <View style={styles.clickHintRow}>
                <Text style={[styles.clickHintText, { color: '#3b82f6' }]}>ดูประวัติ</Text>
                <Ionicons name="chevron-forward" size={10} color="#3b82f6" />
              </View>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.menuSection}>
          {menuItems.map((item, index) => (
            <TouchableOpacity
              key={index}
              style={[styles.menuItem, index < menuItems.length - 1 && styles.menuItemBorder]}
              onPress={item.onPress}
              activeOpacity={0.7}
            >
              <View style={[styles.menuIconBox, { backgroundColor: item.iconBg }]}>
                <Ionicons name={item.icon} size={20} color={item.iconColor} />
              </View>
              <View style={styles.menuTextGroup}>
                <Text style={styles.menuTitle}>{item.title}</Text>
                <Text style={styles.menuSubtitle}>{item.subtitle}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#d1d5db" />
            </TouchableOpacity>
          ))}
        </View>

        {/* 🟢 ปุ่มออกจากระบบ & เวอร์ชัน */}
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
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f9fafb' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 15, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  backButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#f3f4f6', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '600', color: '#1f2937' },
  scrollContent: { },

  profileSection: { backgroundColor: '#fff', alignItems: 'center', paddingVertical: 30, marginBottom: 15 },
  avatarWrapper: { position: 'relative', marginBottom: 12 },
  avatar: { width: 100, height: 100, borderRadius: 50, borderWidth: 3, borderColor: '#10b981', backgroundColor: '#d1fae5' },
  onlineDot: { position: 'absolute', bottom: 5, right: 5, width: 20, height: 20, borderRadius: 10, backgroundColor: '#10b981', borderWidth: 3, borderColor: '#fff' },

  storeName: { fontSize: 22, fontWeight: 'bold', color: '#1f2937', marginBottom: 4 },
  storeEmail: { fontSize: 14, color: '#6b7280', marginBottom: 20 },

  // 🟢 สไตล์การ์ด Impact
  impactContainer: { flexDirection: 'row', paddingHorizontal: 20, width: '100%', justifyContent: 'center', gap: 15 },
  impactCard: { flex: 1, maxWidth: 170, backgroundColor: '#f0fdf4', borderRadius: 20, paddingTop: 20, paddingBottom: 12, paddingHorizontal: 10, alignItems: 'center', borderWidth: 1, borderColor: '#dcfce7', elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4 },
  impactIconBg: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#dcfce7', alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  valueRow: { flexDirection: 'row', alignItems: 'baseline' },
  impactValue: { fontSize: 22, fontWeight: 'bold', color: '#10b981' },
  unitText: { fontSize: 14, fontWeight: '600', color: '#10b981' },
  impactLabel: { fontSize: 12, color: '#6b7280', marginTop: 4, fontWeight: '500' },

  // 🟢 สไตล์คำใบ้กดดูประวัติ
  clickHintRow: { flexDirection: 'row', alignItems: 'center', marginTop: 12, gap: 2, backgroundColor: '#ffffff90', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10 },
  clickHintText: { fontSize: 10, fontWeight: '700' },

  // 🟢 เมนู
  menuSection: { backgroundColor: '#fff', paddingVertical: 10, marginBottom: 15 },
  menuItem: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16, gap: 14 },
  menuItemBorder: { borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  menuIconBox: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  menuTextGroup: { flex: 1, gap: 2 },
  menuTitle: { fontSize: 15, fontWeight: '600', color: '#1f2937' },
  menuSubtitle: { fontSize: 12, color: '#9ca3af' },

  // 🟢 ปุ่ม Logout และ Version
  logoutButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff', marginHorizontal: 20, paddingVertical: 15, borderRadius: 12, marginBottom: 20 },
  logoutText: { fontSize: 16, fontWeight: '600', color: '#ef4444', marginLeft: 8 },
  versionText: { fontSize: 12, color: '#9ca3af', textAlign: 'center' },
});