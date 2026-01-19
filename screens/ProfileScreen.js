import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { auth, db } from '../firebase.config';
import { doc, getDoc } from 'firebase/firestore';

export default function ProfileScreen({ navigation }) {
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
      'ออกจากระบบ',
      'คุณต้องการออกจากระบบหรือไม่?',
      [
        {
          text: 'ยกเลิก',
          style: 'cancel',
        },
        {
          text: 'ออกจากระบบ',
          style: 'destructive',
          onPress: async () => {
            await auth.signOut();
            // ไม่ต้องสั่ง Navigate แล้ว ปล่อยให้ App.js จัดการเอง
          },
        },
      ]
    );
  };

  const menuItems = [
    {
      icon: 'person-outline',
      title: 'แก้ไขโปรไฟล์',
      subtitle: 'เปลี่ยนข้อมูลส่วนตัว',
      color: '#10b981',
      screen: 'EditProfile',
    },
    {
      icon: 'lock-closed-outline',
      title: 'เปลี่ยนรหัสผ่าน',
      subtitle: 'อัปเดตรหัสผ่านของคุณ',
      color: '#3b82f6',
      screen: 'ChangePassword',
    },
    {
      icon: 'heart-outline',
      title: 'รายการโปรด',
      subtitle: 'ร้านค้าและสินค้าที่ชื่นชอบ',
      color: '#f43f5e',
    },
    {
      icon: 'notifications-outline',
      title: 'การแจ้งเตือน',
      subtitle: 'ตั้งค่าการแจ้งเตือน',
      color: '#f59e0b',
    },
    {
      icon: 'help-circle-outline',
      title: 'ช่วยเหลือและสนับสนุน',
      subtitle: 'คำถามที่พบบ่อย',
      color: '#8b5cf6',
    },
    {
      icon: 'shield-checkmark-outline',
      title: 'ความเป็นส่วนตัว',
      subtitle: 'นโยบายและความปลอดภัย',
      color: '#6366f1',
    },
  ];

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#1f2937" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>โปรไฟล์</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView 
        style={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Info */}
        <View style={styles.profileSection}>
          <View style={styles.profileImageContainer}>
            {userData?.profileImage ? (
              <Image 
                source={{ uri: userData.profileImage }} 
                style={styles.profileImage}
              />
            ) : (
              <View style={styles.profilePlaceholder}>
                <Ionicons name="person" size={50} color="#10b981" />
              </View>
            )}
            <View style={styles.statusDot} />
          </View>
          
          <Text style={styles.profileName}>{userData?.username || 'User'}</Text>
          <Text style={styles.profileEmail}>{userData?.email || ''}</Text>
          
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>0</Text>
              <Text style={styles.statLabel}>อาหาร</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>0</Text>
              <Text style={styles.statLabel}>บริจาค</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>0</Text>
              <Text style={styles.statLabel}>ประหยัด</Text>
            </View>
          </View>
        </View>

        {/* Menu Items */}
        <View style={styles.menuSection}>
          {menuItems.map((item, index) => (
            <TouchableOpacity
              key={index}
              style={styles.menuItem}
              onPress={() => {
                if (item.screen) {
                  navigation.navigate(item.screen);
                }
              }}
              activeOpacity={0.7}
            >
              <View style={[styles.menuIcon, { backgroundColor: `${item.color}15` }]}>
                <Ionicons name={item.icon} size={24} color={item.color} />
              </View>
              <View style={styles.menuContent}>
                <Text style={styles.menuTitle}>{item.title}</Text>
                <Text style={styles.menuSubtitle}>{item.subtitle}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#d1d5db" />
            </TouchableOpacity>
          ))}
        </View>

        {/* Logout Button */}
        <TouchableOpacity
          style={styles.logoutButton}
          onPress={handleLogout}
          activeOpacity={0.8}
        >
          <Ionicons name="log-out-outline" size={22} color="#ef4444" />
          <Text style={styles.logoutText}>ออกจากระบบ</Text>
        </TouchableOpacity>

        {/* App Version */}
        <Text style={styles.versionText}>เวอร์ชัน 1.0.0</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 15,
    backgroundColor: '#fff',
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
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
  },
  placeholder: {
    width: 40,
  },
  content: {
    flex: 1,
  },
  profileSection: {
    backgroundColor: '#fff',
    alignItems: 'center',
    paddingVertical: 30,
    marginBottom: 15,
  },
  profileImageContainer: {
    position: 'relative',
    marginBottom: 15,
  },
  profileImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 3,
    borderColor: '#10b981',
  },
  profilePlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#f0fdf4',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#10b981',
  },
  statusDot: {
    position: 'absolute',
    bottom: 5,
    right: 5,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#10b981',
    borderWidth: 3,
    borderColor: '#fff',
  },
  profileName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 5,
  },
  profileEmail: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 20,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
  },
  statItem: {
    alignItems: 'center',
    paddingHorizontal: 25,
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  statLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 30,
    backgroundColor: '#e5e7eb',
  },
  menuSection: {
    backgroundColor: '#fff',
    paddingVertical: 10,
    marginBottom: 15,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    paddingHorizontal: 20,
  },
  menuIcon: {
    width: 45,
    height: 45,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 15,
  },
  menuContent: {
    flex: 1,
  },
  menuTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 2,
  },
  menuSubtitle: {
    fontSize: 12,
    color: '#9ca3af',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    marginHorizontal: 20,
    paddingVertical: 15,
    borderRadius: 12,
    marginBottom: 20,
  },
  logoutText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ef4444',
    marginLeft: 8,
  },
  versionText: {
    fontSize: 12,
    color: '#9ca3af',
    textAlign: 'center',
    marginBottom: 30,
  },
});
