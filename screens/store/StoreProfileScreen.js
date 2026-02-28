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
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { auth, db } from '../../firebase.config';
import { doc, getDoc } from 'firebase/firestore';

export default function StoreProfileScreen({ navigation }) {
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

  const handleCall = () => {
    if (storeData?.phone) {
      Linking.openURL(`tel:${storeData.phone}`);
    }
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
      onPress: () => navigation.navigate('Notifications'),
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

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={22} color="#1f2937" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>โปรไฟล์</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>

        {/* Avatar Section */}
        <View style={styles.avatarSection}>
          <View style={styles.avatarWrapper}>
            <Image
              source={storeData?.storeImage ? { uri: storeData.storeImage } : { uri: defaultAvatar }}
              style={styles.avatar}
            />
            <View style={styles.onlineDot} />
          </View>

          <Text style={styles.storeName}>{storeData?.storeName || 'ชื่อร้านค้า'}</Text>

          {storeData?.phone ? (
            <TouchableOpacity style={styles.phoneChip} onPress={handleCall} activeOpacity={0.8}>
              <Ionicons name="call" size={15} color="#10b981" />
              <Text style={styles.phoneText}>{storeData.phone}</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Impact Stats Cards */}
        <View style={styles.statsRow}>
          {/* ลดขยะอาหาร */}
          <View style={[styles.statCard, { backgroundColor: '#f0fdf4' }]}>
            <View style={[styles.statIconCircle, { backgroundColor: '#d1fae5' }]}>
              <Ionicons name="leaf" size={22} color="#10b981" />
            </View>
            <Text style={[styles.statValue, { color: '#10b981' }]}>
              {storeData?.totalFoodSaved
                ? `${Number(storeData.totalFoodSaved).toFixed(1)}`
                : '0.0'}{' '}
              <Text style={styles.statUnit}>kg</Text>
            </Text>
            <Text style={styles.statLabel}>ลดขยะอาหาร</Text>
          </View>

          {/* ลด CO2 */}
          <View style={[styles.statCard, { backgroundColor: '#eff6ff' }]}>
            <View style={[styles.statIconCircle, { backgroundColor: '#dbeafe' }]}>
              <Ionicons name="cloud-done" size={22} color="#3b82f6" />
            </View>
            <Text style={[styles.statValue, { color: '#3b82f6' }]}>
              {storeData?.totalCO2Saved
                ? `${Number(storeData.totalCO2Saved).toFixed(1)}`
                : '0.0'}{' '}
              <Text style={styles.statUnit}>kg</Text>
            </Text>
            <Text style={styles.statLabel}>ลด CO2 สะสม</Text>
          </View>
        </View>

        {/* Divider */}
        <View style={styles.divider} />

        {/* Menu Items */}
        <View style={styles.menuList}>
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

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f9fafb',
  },

  // ─── Header ───────────────────────────────────────────────────
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 56 : 16,
    paddingBottom: 14,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1f2937',
    letterSpacing: -0.3,
  },

  scrollContent: {
    paddingBottom: 40,
  },

  // ─── Avatar Section ───────────────────────────────────────────
  avatarSection: {
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingTop: 32,
    paddingBottom: 28,
    paddingHorizontal: 20,
  },
  avatarWrapper: {
    position: 'relative',
    marginBottom: 14,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 3,
    borderColor: '#10b981',
    backgroundColor: '#d1fae5',
  },
  onlineDot: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#f59e0b',
    borderWidth: 2,
    borderColor: '#fff',
  },
  storeName: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1f2937',
    marginBottom: 10,
    letterSpacing: -0.4,
  },
  phoneChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#ecfdf5',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#a7f3d0',
  },
  phoneText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#10b981',
  },

  // ─── Stats ────────────────────────────────────────────────────
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 4,
  },
  statCard: {
    flex: 1,
    borderRadius: 18,
    paddingVertical: 20,
    paddingHorizontal: 16,
    alignItems: 'center',
    gap: 6,
  },
  statIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  statValue: {
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  statUnit: {
    fontSize: 14,
    fontWeight: '500',
  },
  statLabel: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '500',
    textAlign: 'center',
  },

  // ─── Divider ──────────────────────────────────────────────────
  divider: {
    height: 8,
    backgroundColor: '#f3f4f6',
    marginTop: 20,
  },

  // ─── Menu List ────────────────────────────────────────────────
  menuList: {
    backgroundColor: '#fff',
    marginHorizontal: 0,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 14,
  },
  menuItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  menuIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuTextGroup: {
    flex: 1,
    gap: 2,
  },
  menuTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1f2937',
  },
  menuSubtitle: {
    fontSize: 12,
    color: '#9ca3af',
    fontWeight: '400',
  },
});