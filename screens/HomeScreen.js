import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Image,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { auth, db } from '../firebase.config';
import { doc, getDoc } from 'firebase/firestore';

export default function HomeScreen({ navigation }) {
  const [userData, setUserData] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('home');

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

  const onRefresh = async () => {
    setRefreshing(true);
    await loadUserData();
    setRefreshing(false);
  };

  const handleLogout = () => {
    auth.signOut();
    navigation.replace('Welcome');
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.greeting}>สวัสดี 👋</Text>
            <Text style={styles.username}>{userData?.username || 'User'}</Text>
          </View>
          <TouchableOpacity 
            style={styles.profileButton}
            onPress={() => navigation.navigate('Profile')}
          >
            {userData?.profileImage ? (
              <Image 
                source={{ uri: userData.profileImage }} 
                style={styles.profileImage}
              />
            ) : (
              <View style={styles.profilePlaceholder}>
                <Ionicons name="person" size={24} color="#10b981" />
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Stats Cards */}
        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <View style={[styles.statIconContainer, { backgroundColor: '#dcfce7' }]}>
              <Ionicons name="restaurant" size={24} color="#10b981" />
            </View>
            <Text style={styles.statNumber}>0</Text>
            <Text style={styles.statLabel}>รายการอาหาร</Text>
          </View>

          <View style={styles.statCard}>
            <View style={[styles.statIconContainer, { backgroundColor: '#fef3c7' }]}>
              <Ionicons name="warning" size={24} color="#f59e0b" />
            </View>
            <Text style={styles.statNumber}>0</Text>
            <Text style={styles.statLabel}>ใกล้หมดอายุ</Text>
          </View>

          <View style={styles.statCard}>
            <View style={[styles.statIconContainer, { backgroundColor: '#fee2e2' }]}>
              <Ionicons name="heart" size={24} color="#ef4444" />
            </View>
            <Text style={styles.statNumber}>0</Text>
            <Text style={styles.statLabel}>บริจาคแล้ว</Text>
          </View>
        </View>
      </View>

      {/* Main Content */}
      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>การกระทำด่วน</Text>
          <View style={styles.quickActionsContainer}>
            <TouchableOpacity style={styles.actionCard}>
              <View style={[styles.actionIcon, { backgroundColor: '#dcfce7' }]}>
                <Ionicons name="add" size={28} color="#10b981" />
              </View>
              <Text style={styles.actionText}>เพิ่มอาหาร</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionCard}>
              <View style={[styles.actionIcon, { backgroundColor: '#dbeafe' }]}>
                <Ionicons name="scan" size={28} color="#3b82f6" />
              </View>
              <Text style={styles.actionText}>สแกน</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionCard}>
              <View style={[styles.actionIcon, { backgroundColor: '#fce7f3' }]}>
                <Ionicons name="gift" size={28} color="#ec4899" />
              </View>
              <Text style={styles.actionText}>บริจาค</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionCard}>
              <View style={[styles.actionIcon, { backgroundColor: '#fef3c7' }]}>
                <Ionicons name="search" size={28} color="#f59e0b" />
              </View>
              <Text style={styles.actionText}>ค้นหา</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Recent Items */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>รายการล่าสุด</Text>
            <TouchableOpacity>
              <Text style={styles.seeAllText}>ดูทั้งหมด</Text>
            </TouchableOpacity>
          </View>
          
          <View style={styles.emptyState}>
            <Ionicons name="pizza-outline" size={60} color="#d1d5db" />
            <Text style={styles.emptyText}>ยังไม่มีรายการอาหาร</Text>
            <Text style={styles.emptySubtext}>เริ่มเพิ่มอาหารของคุณเพื่อจัดการ</Text>
          </View>
        </View>

        {/* Tips */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>เคล็ดลับ</Text>
          <View style={styles.tipCard}>
            <View style={styles.tipIcon}>
              <Ionicons name="bulb" size={24} color="#f59e0b" />
            </View>
            <View style={styles.tipContent}>
              <Text style={styles.tipTitle}>เก็บอาหารให้ถูกวิธี</Text>
              <Text style={styles.tipText}>
                แช่แข็งอาหารสามารถยืดอายุการเก็บรักษาได้นานขึ้น
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Bottom Navigation */}
      <View style={styles.bottomNav}>
        <TouchableOpacity 
          style={styles.navItem}
          onPress={() => setActiveTab('home')}
        >
          <Ionicons 
            name={activeTab === 'home' ? "home" : "home-outline"} 
            size={24} 
            color={activeTab === 'home' ? "#10b981" : "#9ca3af"} 
          />
          <Text style={[
            styles.navLabel,
            activeTab === 'home' && styles.navLabelActive
          ]}>
            หน้าหลัก
          </Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.navItem}
          onPress={() => setActiveTab('food')}
        >
          <Ionicons 
            name={activeTab === 'food' ? "restaurant" : "restaurant-outline"} 
            size={24} 
            color={activeTab === 'food' ? "#10b981" : "#9ca3af"} 
          />
          <Text style={[
            styles.navLabel,
            activeTab === 'food' && styles.navLabelActive
          ]}>
            อาหาร
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.navItemCenter}>
          <View style={styles.addButton}>
            <Ionicons name="add" size={32} color="#fff" />
          </View>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.navItem}
          onPress={() => setActiveTab('donate')}
        >
          <Ionicons 
            name={activeTab === 'donate' ? "heart" : "heart-outline"} 
            size={24} 
            color={activeTab === 'donate' ? "#10b981" : "#9ca3af"} 
          />
          <Text style={[
            styles.navLabel,
            activeTab === 'donate' && styles.navLabelActive
          ]}>
            บริจาค
          </Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.navItem}
          onPress={() => navigation.navigate('Profile')}
        >
          <Ionicons 
            name={activeTab === 'profile' ? "person" : "person-outline"} 
            size={24} 
            color={activeTab === 'profile' ? "#10b981" : "#9ca3af"} 
          />
          <Text style={[
            styles.navLabel,
            activeTab === 'profile' && styles.navLabelActive
          ]}>
            โปรไฟล์
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  header: {
    backgroundColor: '#fff',
    paddingTop: 50,
    paddingBottom: 20,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  greeting: {
    fontSize: 16,
    color: '#6b7280',
  },
  username: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  profileButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    overflow: 'hidden',
  },
  profileImage: {
    width: '100%',
    height: '100%',
  },
  profilePlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#f0fdf4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statCard: {
    flex: 1,
    backgroundColor: '#f9fafb',
    padding: 15,
    borderRadius: 15,
    marginHorizontal: 5,
    alignItems: 'center',
  },
  statIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  statNumber: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 11,
    color: '#6b7280',
    textAlign: 'center',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  section: {
    marginTop: 25,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  seeAllText: {
    fontSize: 14,
    color: '#10b981',
    fontWeight: '500',
  },
  quickActionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 10,
  },
  actionCard: {
    width: '23%',
    alignItems: 'center',
    marginHorizontal: '1%',
  },
  actionIcon: {
    width: 60,
    height: 60,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  actionText: {
    fontSize: 12,
    color: '#4b5563',
    textAlign: 'center',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
    backgroundColor: '#fff',
    borderRadius: 15,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6b7280',
    marginTop: 15,
  },
  emptySubtext: {
    fontSize: 13,
    color: '#9ca3af',
    marginTop: 5,
  },
  tipCard: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 15,
    marginTop: 10,
  },
  tipIcon: {
    width: 45,
    height: 45,
    borderRadius: 22.5,
    backgroundColor: '#fef3c7',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 15,
  },
  tipContent: {
    flex: 1,
  },
  tipTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 4,
  },
  tipText: {
    fontSize: 13,
    color: '#6b7280',
    lineHeight: 18,
  },
  bottomNav: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: -2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 10,
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
  },
  navItemCenter: {
    flex: 1,
    alignItems: 'center',
    marginTop: -25,
  },
  navLabel: {
    fontSize: 11,
    color: '#9ca3af',
    marginTop: 4,
  },
  navLabelActive: {
    color: '#10b981',
    fontWeight: '600',
  },
  addButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#10b981',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#10b981',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
});
