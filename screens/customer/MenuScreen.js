import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  Image,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { auth, db } from '../../firebase.config';
import { doc, getDoc } from 'firebase/firestore';

export default function MenuScreen({ navigation }) {
  const [userData, setUserData] = useState(null);

  useEffect(() => {
    loadUserData();
  }, []);

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
      'Log out',
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
    {
      icon: 'person-outline',
      label: 'Username',
      subtitle: 'ลูกค้า (Role)',
      navigate: 'EditProfile',
      showBadges: true,
    },
    {
      icon: 'grid-outline',
      label: 'หมวดหมู่',
      navigate: 'Categories',
    },
    {
      icon: 'document-text-outline',
      label: 'คำสั่งซื้อมาแล้ว',
      navigate: 'Orders',
    },
    {
      icon: 'heart-outline',
      label: 'ร้านโปรด',
      navigate: 'FavoriteStores',
    },
    {
      icon: 'notifications-outline',
      label: 'แจ้งเตือน',
      navigate: 'Notifications',
    },
    {
      icon: 'person-outline',
      label: 'โปรไฟล์',
      navigate: 'Profile',
    },
  ];

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Food waste</Text>
        <TouchableOpacity
          style={styles.closeButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="close" size={28} color="#1f2937" />
        </TouchableOpacity>
      </View>

      {/* Profile Image */}
      <View style={styles.profileSection}>
        <View style={styles.profileImageContainer}>
          <Ionicons name="camera-outline" size={24} color="#9ca3af" />
        </View>
        <Text style={styles.profileLabel}>สไตเมนน...</Text>
      </View>

      {/* Menu Items */}
      <View style={styles.menuList}>
        {menuItems.map((item, index) => (
          <TouchableOpacity
            key={index}
            style={styles.menuItem}
            onPress={() => item.navigate && navigation.navigate(item.navigate)}
          >
            <View style={styles.menuIconContainer}>
              <Ionicons name={item.icon} size={24} color="#1f2937" />
            </View>
            
            <View style={styles.menuContent}>
              <Text style={styles.menuLabel}>{item.label}</Text>
              {item.subtitle && (
                <Text style={styles.menuSubtitle}>{item.subtitle}</Text>
              )}
            </View>

            {item.showBadges && (
              <View style={styles.badgeContainer}>
                <View style={styles.badge}>
                  <Ionicons name="briefcase-outline" size={16} color="#1f2937" />
                  <Text style={styles.badgeText}>โหมดลูกค้า</Text>
                </View>
                <View style={[styles.badge, styles.badgeInactive]}>
                  <Ionicons name="storefront-outline" size={16} color="#6b7280" />
                  <Text style={styles.badgeTextInactive}>โหมดเจ้าของร้าน</Text>
                </View>
              </View>
            )}

            <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
          </TouchableOpacity>
        ))}
      </View>

      {/* Additional Sections */}
      <View style={styles.additionalSections}>
        <View style={styles.sectionDivider} />
        
        <TouchableOpacity style={styles.menuItem}>
          <View style={styles.menuIconContainer}>
            <Ionicons name="location-outline" size={24} color="#1f2937" />
          </View>
          <View style={styles.menuContent}>
            <Text style={styles.menuLabel}>บัญชี</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
        </TouchableOpacity>

        <View style={styles.sectionDivider} />

        <TouchableOpacity style={styles.menuItem}>
          <View style={styles.menuIconContainer}>
            <Ionicons name="card-outline" size={24} color="#1f2937" />
          </View>
          <View style={styles.menuContent}>
            <Text style={styles.menuLabel}>โปรไฟล์</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
        </TouchableOpacity>
      </View>

      {/* Logout */}
      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Ionicons name="log-out-outline" size={20} color="#ef4444" />
        <Text style={styles.logoutText}>Log out</Text>
      </TouchableOpacity>

      {/* Bottom Nav */}
      <View style={styles.bottomNav}>
        <TouchableOpacity style={styles.navItem}>
          <Ionicons name="home-outline" size={24} color="#9ca3af" />
          <Text style={styles.navLabel}>หน้าหลัก</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.navItem}>
          <Ionicons name="receipt-outline" size={24} color="#9ca3af" />
          <Text style={styles.navLabel}>รายการซื้อ</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.navItem}>
          <Ionicons name="notifications-outline" size={24} color="#9ca3af" />
          <Text style={styles.navLabel}>แจ้งเตือน</Text>
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
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 16,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
  },
  closeButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileSection: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  profileImageContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  profileLabel: {
    fontSize: 13,
    color: '#6b7280',
  },
  menuList: {
    paddingHorizontal: 20,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
  },
  menuIconContainer: {
    width: 40,
    alignItems: 'center',
  },
  menuContent: {
    flex: 1,
    marginLeft: 12,
  },
  menuLabel: {
    fontSize: 15,
    color: '#1f2937',
    fontWeight: '500',
  },
  menuSubtitle: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 2,
  },
  badgeContainer: {
    flexDirection: 'row',
    gap: 8,
    marginRight: 8,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#1f2937',
  },
  badgeInactive: {
    borderColor: '#d1d5db',
  },
  badgeText: {
    fontSize: 11,
    color: '#1f2937',
    fontWeight: '500',
  },
  badgeTextInactive: {
    fontSize: 11,
    color: '#6b7280',
  },
  additionalSections: {
    marginTop: 20,
    paddingHorizontal: 20,
  },
  sectionDivider: {
    height: 1,
    backgroundColor: '#f3f4f6',
    marginVertical: 12,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    marginHorizontal: 20,
    marginTop: 20,
  },
  logoutText: {
    fontSize: 15,
    color: '#ef4444',
    fontWeight: '500',
  },
  bottomNav: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
    marginTop: 'auto',
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
  },
  navLabel: {
    fontSize: 11,
    color: '#9ca3af',
    marginTop: 4,
  },
  navLabelActive: {
    fontSize: 11,
    color: '#1f2937',
    fontWeight: '600',
    marginTop: 4,
  },
});
