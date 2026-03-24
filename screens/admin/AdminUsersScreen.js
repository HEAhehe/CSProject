import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  StatusBar,
  TextInput,
  Image,
  Modal,
  Alert,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { db, auth } from '../../firebase.config';
import { collection, getDocs, doc, updateDoc } from 'firebase/firestore';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function AdminUsersScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();

  const [users, setUsers] = useState([]);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRole, setSelectedRole] = useState(route.params?.role || 'all');
  const [selectedUser, setSelectedUser] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const currentUser = auth.currentUser;

  useFocusEffect(
    useCallback(() => {
      loadUsers();
    }, [])
  );

  useFocusEffect(
    useCallback(() => {
      filterUsers();
    }, [searchQuery, selectedRole, users])
  );

  const loadUsers = async () => {
    try {
      const snapshot = await getDocs(collection(db, 'users'));
      const usersData = [];
      snapshot.forEach(doc => {
        usersData.push({ id: doc.id, ...doc.data() });
      });

      usersData.sort((a, b) => {
        if (a.currentRole === 'admin') return -1;
        if (b.currentRole === 'admin') return 1;
        return 0;
      });

      setUsers(usersData);
    } catch (error) {
      console.error('Error loading users:', error);
    }
  };

  const filterUsers = () => {
    let filtered = users;

    if (selectedRole !== 'all') {
      filtered = filtered.filter(user => {
        const role = user.currentRole || 'customer';
        return role === selectedRole;
      });
    }

    if (searchQuery) {
      const lowerQuery = searchQuery.toLowerCase();
      filtered = filtered.filter(user =>
        (user.username || '').toLowerCase().includes(lowerQuery) ||
        (user.email || '').toLowerCase().includes(lowerQuery)
      );
    }
    setFilteredUsers(filtered);
  };

  const handleUserPress = (user) => {
    setSelectedUser(user);
    setModalVisible(true);
  };

  const getRoleConfig = (role) => {
    const currentRole = role || 'customer';

    switch (currentRole) {
      case 'admin':
        return { label: 'แอดมิน', bg: '#f3e8ff', text: '#7c3aed' };
      case 'store':
        return { label: 'ร้านค้า', bg: '#dcfce7', text: '#16a34a' };
      case 'banned':
        return { label: 'ถูกระงับ', bg: '#fee2e2', text: '#ef4444' };
      default:
        return { label: 'ลูกค้า', bg: '#dbeafe', text: '#2563eb' };
    }
  };

  const handleBanUser = async (userId) => {
    if (userId === currentUser.uid) {
      Alert.alert('ข้อผิดพลาด', 'ไม่สามารถระงับบัญชีตัวเองได้');
      return;
    }

    Alert.alert(
      'ยืนยันการระงับบัญชี',
      'ผู้ใช้รายนี้จะไม่สามารถเข้าสู่ระบบได้อีก คุณต้องการดำเนินการต่อหรือไม่?',
      [
        { text: 'ยกเลิก', style: 'cancel' },
        {
          text: 'ระงับบัญชี',
          style: 'destructive',
          onPress: async () => {
            try {
              await updateDoc(doc(db, 'users', userId), {
                currentRole: 'banned',
                isDeleted: true
              });
              Alert.alert('สำเร็จ', 'ระงับบัญชีเรียบร้อยแล้ว');
              setModalVisible(false);
              loadUsers();
            } catch (error) {
              Alert.alert('ข้อผิดพลาด', 'ระงับบัญชีไม่สำเร็จ');
            }
          },
        },
      ]
    );
  };

  const handleUnbanUser = async (userId) => {
    Alert.alert(
      'ยืนยันการปลดระงับ',
      'ผู้ใช้รายนี้จะกลับมาเป็นลูกค้าและเข้าสู่ระบบได้ปกติ',
      [
        { text: 'ยกเลิก', style: 'cancel' },
        {
          text: 'ยืนยัน',
          onPress: async () => {
            try {
              await updateDoc(doc(db, 'users', userId), {
                currentRole: 'customer',
                isDeleted: false
              });
              Alert.alert('สำเร็จ', 'ปลดระงับบัญชีเรียบร้อยแล้ว');
              setModalVisible(false);
              loadUsers();
            } catch (error) {
              Alert.alert('ข้อผิดพลาด', 'ดำเนินการไม่สำเร็จ');
            }
          },
        },
      ]
    );
  };

  const renderUser = ({ item }) => {
    const roleConfig = getRoleConfig(item.currentRole);

    return (
      <TouchableOpacity
        style={[styles.userCard, item.currentRole === 'banned' && { opacity: 0.6 }]}
        onPress={() => handleUserPress(item)}
      >
        <View style={styles.userAvatar}>
          {item.profileImage ? (
            <Image source={{ uri: item.profileImage }} style={styles.avatarImage} />
          ) : (
            <Ionicons name="person" size={24} color="#6b7280" />
          )}
        </View>

        <View style={styles.userInfo}>
          <Text style={[styles.userName, item.currentRole === 'banned' && { textDecorationLine: 'line-through' }]}>
            {item.username || 'ไม่มีชื่อ'}
          </Text>
          <Text style={styles.userEmail}>{item.email}</Text>
          {item.phoneNumber ? (
            <Text style={styles.userPhone}>📱 {item.phoneNumber}</Text>
          ) : null}
        </View>

        <View style={styles.userRole}>
          <View style={[styles.roleBadge, { backgroundColor: roleConfig.bg }]}>
            <Text style={[styles.roleText, { color: roleConfig.text }]}>
              {roleConfig.label}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      <View style={[styles.header, { paddingTop: Math.max(insets.top, 15) }]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="chevron-back" size={24} color="#1f2937" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>จัดการบัญชี</Text>
        <View style={styles.placeholder} />
      </View>

      <View style={styles.searchSection}>
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color="#9ca3af" />
          <TextInput
            style={styles.searchInput}
            placeholder="ค้นหาชื่อหรืออีเมล..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholderTextColor="#9ca3af"
          />
        </View>
      </View>

      <View style={styles.filterSection}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingRight: 20 }}>
          {['all', 'customer', 'store', 'admin', 'banned'].map((role) => (
            <TouchableOpacity
              key={role}
              style={[styles.filterChip, selectedRole === role && styles.filterChipActive]}
              onPress={() => setSelectedRole(role)}
            >
              <Text style={[styles.filterText, selectedRole === role && styles.filterTextActive]}>
                {role === 'all' ? 'ทั้งหมด' :
                role === 'customer' ? 'ลูกค้า' :
                role === 'store' ? 'ร้านค้า' :
                role === 'banned' ? 'ถูกระงับ' : 'แอดมิน'}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <FlatList
        data={filteredUsers}
        renderItem={renderUser}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[styles.usersList, { paddingBottom: insets.bottom + 90 }]}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyState}>
             <Text style={styles.emptyText}>ไม่พบข้อมูล</Text>
          </View>
        }
      />

      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { paddingBottom: Math.max(insets.bottom, 40) }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>รายละเอียดบัญชี</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={24} color="#1f2937" />
              </TouchableOpacity>
            </View>

            {selectedUser && (
              <>
                <View style={styles.modalBody}>
                  <View style={styles.modalAvatarContainer}>
                    {selectedUser.profileImage ? (
                      <Image source={{ uri: selectedUser.profileImage }} style={styles.modalAvatar} />
                    ) : (
                      <View style={styles.modalAvatarPlaceholder}>
                        <Ionicons name="person" size={48} color="#6b7280" />
                      </View>
                    )}
                  </View>

                  <View style={styles.infoGroup}>
                    <Text style={styles.infoLabel}>ชื่อผู้ใช้</Text>
                    <Text style={styles.infoValue}>{selectedUser.username || '-'}</Text>
                  </View>
                   <View style={styles.infoGroup}>
                    <Text style={styles.infoLabel}>อีเมล</Text>
                    <Text style={styles.infoValue}>{selectedUser.email}</Text>
                  </View>
                   <View style={styles.infoGroup}>
                    <Text style={styles.infoLabel}>สถานะ</Text>
                    <View style={[
                      styles.modalRoleBadge,
                      { backgroundColor: getRoleConfig(selectedUser.currentRole).bg, alignSelf: 'flex-start', marginTop: 4 }
                    ]}>
                      <Text style={[
                        styles.modalRoleText,
                        { color: getRoleConfig(selectedUser.currentRole).text }
                      ]}>
                        {getRoleConfig(selectedUser.currentRole).label}
                      </Text>
                    </View>
                  </View>
                </View>

                <View style={styles.modalActions}>
                  {selectedUser.currentRole === 'banned' ? (
                    <TouchableOpacity
                      style={styles.modalButtonSuccess}
                      onPress={() => handleUnbanUser(selectedUser.id)}
                    >
                      <Ionicons name="checkmark-circle" size={20} color="#fff" />
                      <Text style={styles.modalButtonSuccessText}>ปลดระงับบัญชี</Text>
                    </TouchableOpacity>
                  ) : (
                    <>
                      {(selectedUser.currentRole || 'customer') !== 'admin' && (
                        <TouchableOpacity
                          style={styles.modalButtonDanger}
                          onPress={() => handleBanUser(selectedUser.id)}
                        >
                          <Ionicons name="ban" size={20} color="#fff" />
                          <Text style={styles.modalButtonDangerText}>ระงับบัญชี</Text>
                        </TouchableOpacity>
                      )}

                      {selectedUser.currentRole === 'admin' && (
                        <View style={{flex: 1, alignItems: 'center'}}>
                            <Text style={{color: '#9ca3af', fontSize: 12}}>บัญชีผู้ดูแลระบบไม่สามารถแก้ไขได้</Text>
                        </View>
                      )}
                    </>
                  )}
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>

      <View style={[styles.bottomNav, { paddingBottom: Math.max(insets.bottom, 8) }]}>
        <TouchableOpacity
          style={styles.navItem}
          onPress={() => navigation.navigate('AdminHome')}
        >
          <Ionicons name="home-outline" size={24} color="#9ca3af" />
          <Text style={styles.navLabel}>หน้าหลัก</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.navItem}>
          <Ionicons name="people" size={24} color="#1f2937" />
          <Text style={styles.navLabelActive}>บัญชี</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navItem}
          onPress={() => navigation.navigate('AdminReports')}
        >
          <Ionicons name="stats-chart-outline" size={24} color="#9ca3af" />
          <Text style={styles.navLabel}>รายงาน</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navItem}
          onPress={() => navigation.navigate('AdminProfile')}
        >
          <Ionicons name="person-outline" size={24} color="#9ca3af" />
          <Text style={styles.navLabel}>โปรไฟล์</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 12 },
  backButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 16, fontWeight: '600', color: '#1f2937' },
  placeholder: { width: 40 },
  searchSection: { paddingHorizontal: 20, paddingVertical: 12 },
  searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f3f4f6', borderRadius: 8, paddingHorizontal: 12, height: 44 },
  searchInput: { flex: 1, marginLeft: 8, fontSize: 14, color: '#1f2937' },
  filterSection: { paddingLeft: 20, marginBottom: 12 },
  filterChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: '#f3f4f6' },
  filterChipActive: { backgroundColor: '#1f2937' },
  filterText: { fontSize: 12, color: '#6b7280', fontWeight: '500' },
  filterTextActive: { color: '#fff' },
  usersList: { paddingHorizontal: 20 },
  emptyState: { alignItems: 'center', marginTop: 50 },
  emptyText: { color: '#9ca3af', fontSize: 16 },
  userCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f9fafb', padding: 12, borderRadius: 8, marginBottom: 8 },
  userAvatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#e5e7eb', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  avatarImage: { width: 48, height: 48, borderRadius: 24 },
  userInfo: { flex: 1 },
  userName: { fontSize: 15, fontWeight: '600', color: '#1f2937', marginBottom: 2 },
  userEmail: { fontSize: 13, color: '#6b7280', marginBottom: 2 },
  userPhone: { fontSize: 12, color: '#9ca3af' },
  userRole: { alignItems: 'flex-end', gap: 4 },
  roleBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  roleText: { fontSize: 11, fontWeight: '600' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '80%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#1f2937' },
  modalBody: { padding: 20 },
  modalAvatarContainer: { alignItems: 'center', marginBottom: 20 },
  modalAvatar: { width: 80, height: 80, borderRadius: 40 },
  modalAvatarPlaceholder: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#f3f4f6', alignItems: 'center', justifyContent: 'center' },
  infoGroup: { marginBottom: 15 },
  infoLabel: { fontSize: 13, color: '#6b7280', marginBottom: 4 },
  infoValue: { fontSize: 15, color: '#1f2937', fontWeight: '500' },
  modalRoleBadge: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12 },
  modalRoleText: { fontSize: 13, fontWeight: '600' },
  modalActions: { flexDirection: 'row', paddingHorizontal: 20, gap: 12 },
  modalButtonDanger: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12, borderRadius: 8, backgroundColor: '#ef4444' },
  modalButtonDangerText: { fontSize: 14, fontWeight: '600', color: '#fff' },
  modalButtonSuccess: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12, borderRadius: 8, backgroundColor: '#10b981' },
  modalButtonSuccessText: { fontSize: 14, fontWeight: '600', color: '#fff' },

  bottomNav: { flexDirection: 'row', backgroundColor: '#fff', paddingTop: 8, paddingHorizontal: 16, borderTopWidth: 1, borderTopColor: '#f3f4f6', position: 'absolute', bottom: 0, left: 0, right: 0 },
  navItem: { flex: 1, alignItems: 'center', paddingVertical: 8 },
  navLabel: { fontSize: 11, color: '#9ca3af', marginTop: 4 },
  navLabelActive: { fontSize: 11, color: '#1f2937', fontWeight: '600', marginTop: 4 },
});