import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  StatusBar,
  Modal,
  TextInput,
  Alert,
  Image,
  RefreshControl,
  ActivityIndicator
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { db, auth } from '../../firebase.config'; // ✅ เช็ค Path ให้ถูก
import { collection, getDocs, doc, updateDoc, query, orderBy } from 'firebase/firestore';

export default function AdminApprovalsScreen({ navigation }) {
  const [selectedTab, setSelectedTab] = useState('pending'); // pending, approved, rejected
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [actionType, setActionType] = useState(''); // 'approve' or 'reject'

  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // ดึงข้อมูลเมื่อเข้าหน้าจอ
  useFocusEffect(
    useCallback(() => {
      fetchRequests();
    }, [])
  );

  const fetchRequests = async () => {
    try {
      // ดึงข้อมูลจาก collection 'approval_requests'
      // ถ้ายังไม่ได้สร้าง collection นี้ใน Firebase มันจะคืนค่าว่าง (ไม่ Error)
      const q = query(collection(db, 'approval_requests'));
      const snapshot = await getDocs(q);

      const loadedRequests = [];
      snapshot.forEach(doc => {
        loadedRequests.push({ id: doc.id, ...doc.data() });
      });

      // เรียงลำดับตามวันที่ (ใหม่ไปเก่า) - ถ้ามี field requestDate
      loadedRequests.sort((a, b) => {
        const dateA = a.requestDate ? new Date(a.requestDate) : new Date(0);
        const dateB = b.requestDate ? new Date(b.requestDate) : new Date(0);
        return dateB - dateA;
      });

      setRequests(loadedRequests);
    } catch (error) {
      console.error('Error fetching requests:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchRequests();
  };

  const filteredRequests = requests.filter(req => {
    // กรองตาม Tab (ถ้าไม่มี field status ให้ถือว่าเป็น pending ไปก่อน)
    const status = req.status || 'pending';
    return status === selectedTab;
  });

  const getRequestTypeLabel = (type) => {
    const types = {
      store_registration: 'ลงทะเบียนร้านค้า',
      food_listing: 'ลงขายอาหาร',
      promotion: 'โปรโมชั่น',
    };
    return types[type] || type || 'ทั่วไป';
  };

  const getRequestTypeColor = (type) => {
    const colors = {
      store_registration: '#3b82f6', // สีฟ้า
      food_listing: '#10b981',       // สีเขียว
      promotion: '#f59e0b',          // สีส้ม
    };
    return colors[type] || '#6b7280';
  };

  const handleRequestPress = (request) => {
    // กดดูรายละเอียดได้ทุกสถานะ แต่จะทำรายการได้เฉพาะ pending
    setSelectedRequest(request);
    setModalVisible(true);
  };

  const handleApprove = () => {
    setActionType('approve');
    confirmAction();
  };

  const handleReject = () => {
    if (!rejectReason.trim()) {
      Alert.alert('ข้อผิดพลาด', 'กรุณาระบุเหตุผลในการปฏิเสธ');
      return;
    }
    setActionType('reject');
    confirmAction();
  };

  const confirmAction = () => {
    Alert.alert(
      actionType === 'approve' ? 'ยืนยันการอนุมัติ' : 'ยืนยันการปฏิเสธ',
      `คุณต้องการ${actionType === 'approve' ? 'อนุมัติ' : 'ปฏิเสธ'}คำขอนี้หรือไม่?`,
      [
        { text: 'ยกเลิก', style: 'cancel' },
        {
          text: 'ยืนยัน',
          onPress: async () => {
            await processAction();
          },
        },
      ]
    );
  };

  const processAction = async () => {
    if (!selectedRequest) return;

    try {
      const updateData = {
        status: actionType === 'approve' ? 'approved' : 'rejected',
        approvedBy: auth.currentUser?.email || 'Admin',
        approvedDate: new Date().toISOString(), // ใช้วันที่มาตรฐาน
      };

      if (actionType === 'reject') {
        updateData.rejectReason = rejectReason;
      }

      // 1. อัปเดตสถานะในตาราง approval_requests
      await updateDoc(doc(db, 'approval_requests', selectedRequest.id), updateData);

      // 2. ⭐ Special Logic: ถ้าเป็นการลงทะเบียนร้านค้า และกด "อนุมัติ"
      // ให้ไปอัปเกรด User คนนั้นเป็น 'store' ทันที
      if (actionType === 'approve' && selectedRequest.type === 'store_registration') {
        if (selectedRequest.userId) {
          await updateDoc(doc(db, 'users', selectedRequest.userId), {
            currentRole: 'store'
          });
          Alert.alert('เสร็จสิ้น', 'อนุมัติคำขอและอัปเกรดผู้ใช้เป็นร้านค้าแล้ว');
        }
      } else {
        Alert.alert(
          'สำเร็จ',
          `${actionType === 'approve' ? 'อนุมัติ' : 'ปฏิเสธ'}คำขอแล้ว`
        );
      }

      setModalVisible(false);
      setRejectReason('');
      setSelectedRequest(null);
      fetchRequests(); // โหลดข้อมูลใหม่

    } catch (error) {
      console.error('Action error:', error);
      Alert.alert('ข้อผิดพลาด', 'ไม่สามารถทำรายการได้');
    }
  };

  const renderRequest = ({ item }) => {
    const typeColor = getRequestTypeColor(item.type);

    // แปลงวันที่ให้สวยงาม
    const displayDate = item.requestDate
      ? new Date(item.requestDate).toLocaleDateString('th-TH')
      : '-';

    return (
      <TouchableOpacity
        style={styles.requestCard}
        onPress={() => handleRequestPress(item)}
      >
        <View style={styles.requestHeader}>
          <View style={[styles.typeIcon, { backgroundColor: `${typeColor}20` }]}>
            <Ionicons
              name={
                item.type === 'store_registration' ? 'storefront' :
                item.type === 'food_listing' ? 'restaurant' :
                'pricetag'
              }
              size={20}
              color={typeColor}
            />
          </View>

          <View style={styles.requestInfo}>
            <Text style={styles.requestType}>{getRequestTypeLabel(item.type)}</Text>
            <Text style={styles.requestUser}>{item.userName || item.storeName || 'ไม่ระบุชื่อ'}</Text>
            <Text style={styles.requestDate}>วันที่: {displayDate}</Text>
          </View>

          {item.status === 'pending' && <Ionicons name="time" size={24} color="#f59e0b" />}
          {item.status === 'approved' && <Ionicons name="checkmark-circle" size={24} color="#10b981" />}
          {item.status === 'rejected' && <Ionicons name="close-circle" size={24} color="#ef4444" />}
        </View>

        {(item.status === 'approved' || item.status === 'rejected') && (
          <View style={styles.requestFooter}>
            <Text style={styles.footerText}>
              {item.status === 'approved' ? 'อนุมัติโดย' : 'ปฏิเสธโดย'}: {item.approvedBy}
            </Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="chevron-back" size={24} color="#1f2937" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>อนุมัติ/ปฏิเสธ</Text>
        <View style={styles.placeholder} />
      </View>

      {/* Tabs */}
      <View style={styles.tabsContainer}>
        {['pending', 'approved', 'rejected'].map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, selectedTab === tab && styles.tabActive]}
            onPress={() => setSelectedTab(tab)}
          >
            <Text style={[styles.tabText, selectedTab === tab && styles.tabTextActive]}>
              {tab === 'pending' ? 'รออนุมัติ' : tab === 'approved' ? 'อนุมัติแล้ว' : 'ปฏิเสธแล้ว'}
              {/* แสดงตัวเลขถ้ามีข้อมูล */}
              {requests.length > 0 ? ` (${requests.filter(r => (r.status || 'pending') === tab).length})` : ''}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Requests List */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#10b981" />
        </View>
      ) : filteredRequests.length > 0 ? (
        <FlatList
          data={filteredRequests}
          renderItem={renderRequest}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.requestsList}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        />
      ) : (
        <View style={styles.emptyState}>
          <Ionicons name="folder-open-outline" size={64} color="#d1d5db" />
          <Text style={styles.emptyText}>ไม่มีรายการในหมวดนี้</Text>
        </View>
      )}

      {/* Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>รายละเอียดคำขอ</Text>
              <TouchableOpacity onPress={() => {
                setModalVisible(false);
                setRejectReason('');
              }}>
                <Ionicons name="close" size={24} color="#1f2937" />
              </TouchableOpacity>
            </View>

            {selectedRequest && (
              <View style={{flex: 1}}>
                <View style={styles.modalBody}>
                  {/* แสดงข้อมูลพื้นฐาน */}
                  <View style={styles.infoRow}>
                    <Text style={styles.label}>ประเภท:</Text>
                    <Text style={styles.value}>{getRequestTypeLabel(selectedRequest.type)}</Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={styles.label}>ผู้ขอ:</Text>
                    <Text style={styles.value}>{selectedRequest.userName}</Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={styles.label}>อีเมล:</Text>
                    <Text style={styles.value}>{selectedRequest.userEmail}</Text>
                  </View>

                  <View style={styles.divider} />

                  {/* แสดงรายละเอียด (Details) */}
                  <Text style={styles.sectionHeader}>ข้อมูลเพิ่มเติม</Text>
                  {selectedRequest.details && Object.entries(selectedRequest.details).map(([key, value]) => (
                    <View key={key} style={styles.infoRow}>
                      <Text style={styles.label}>{key}:</Text>
                      <Text style={styles.value}>{String(value)}</Text>
                    </View>
                  ))}

                  {/* ช่องกรอกเหตุผล (แสดงเฉพาะตอนจะปฏิเสธ และเป็นสถานะ pending) */}
                  {selectedRequest.status === 'pending' && (
                    <View style={styles.rejectInputContainer}>
                      <Text style={styles.label}>เหตุผล (กรณีปฏิเสธ):</Text>
                      <TextInput
                        style={styles.reasonInput}
                        placeholder="ระบุเหตุผลที่นี่..."
                        value={rejectReason}
                        onChangeText={setRejectReason}
                        multiline
                      />
                    </View>
                  )}

                  {/* แสดงเหตุผลที่เคยปฏิเสธไปแล้ว */}
                  {selectedRequest.status === 'rejected' && selectedRequest.rejectReason && (
                    <View style={styles.rejectReasonBox}>
                      <Text style={styles.rejectReasonTitle}>เหตุผลที่ปฏิเสธ:</Text>
                      <Text style={styles.rejectReasonText}>{selectedRequest.rejectReason}</Text>
                    </View>
                  )}
                </View>

                {/* ปุ่ม Action (แสดงเฉพาะ Pending) */}
                {selectedRequest.status === 'pending' && (
                  <View style={styles.modalActions}>
                    <TouchableOpacity
                      style={styles.rejectButton}
                      onPress={handleReject}
                    >
                      <Ionicons name="close-circle" size={20} color="#fff" />
                      <Text style={styles.buttonText}>ปฏิเสธ</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.approveButton}
                      onPress={handleApprove}
                    >
                      <Ionicons name="checkmark-circle" size={20} color="#fff" />
                      <Text style={styles.buttonText}>อนุมัติ</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            )}
          </View>
        </View>
      </Modal>

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
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 50, paddingBottom: 12,
  },
  backButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 16, fontWeight: '600', color: '#1f2937' },
  placeholder: { width: 40 },

  tabsContainer: { flexDirection: 'row', paddingHorizontal: 20, paddingVertical: 12, gap: 8 },
  tab: { flex: 1, paddingVertical: 8, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: '#1f2937' },
  tabText: { fontSize: 12, color: '#9ca3af', fontWeight: '500' },
  tabTextActive: { color: '#1f2937', fontWeight: '600' },

  requestsList: { paddingHorizontal: 20, paddingBottom: 100 },
  requestCard: {
    backgroundColor: '#f9fafb', borderRadius: 12, padding: 16, marginBottom: 12,
  },
  requestHeader: { flexDirection: 'row', alignItems: 'center' },
  typeIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  requestInfo: { flex: 1 },
  requestType: { fontSize: 15, fontWeight: '600', color: '#1f2937', marginBottom: 2 },
  requestUser: { fontSize: 13, color: '#6b7280', marginBottom: 2 },
  requestDate: { fontSize: 12, color: '#9ca3af' },
  requestFooter: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#e5e7eb' },
  footerText: { fontSize: 12, color: '#6b7280' },

  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', marginTop: 100 },
  emptyText: { fontSize: 16, color: '#9ca3af', marginTop: 16 },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '85%', minHeight: '50%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#1f2937' },
  modalBody: { padding: 20 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  label: { fontSize: 14, color: '#6b7280' },
  value: { fontSize: 14, fontWeight: '500', color: '#1f2937', maxWidth: '60%', textAlign: 'right' },
  divider: { height: 1, backgroundColor: '#f3f4f6', marginVertical: 15 },
  sectionHeader: { fontSize: 16, fontWeight: '600', color: '#1f2937', marginBottom: 15 },

  rejectInputContainer: { marginTop: 20 },
  reasonInput: { backgroundColor: '#f9fafb', borderRadius: 8, padding: 12, marginTop: 8, minHeight: 80, textAlignVertical: 'top' },
  rejectReasonBox: { backgroundColor: '#fee2e2', padding: 12, borderRadius: 8, marginTop: 15 },
  rejectReasonTitle: { color: '#ef4444', fontWeight: '600', marginBottom: 4 },
  rejectReasonText: { color: '#7f1d1d' },

  modalActions: { flexDirection: 'row', padding: 20, gap: 12, borderTopWidth: 1, borderTopColor: '#f3f4f6' },
  rejectButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 14, borderRadius: 8, backgroundColor: '#ef4444' },
  approveButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 14, borderRadius: 8, backgroundColor: '#10b981' },
  buttonText: { color: '#fff', fontWeight: '600', fontSize: 15 },

  // Bottom Nav
  bottomNav: { flexDirection: 'row', backgroundColor: '#fff', paddingVertical: 8, paddingHorizontal: 16, borderTopWidth: 1, borderTopColor: '#f3f4f6', position: 'absolute', bottom: 0, left: 0, right: 0 },
  navItem: { flex: 1, alignItems: 'center', paddingVertical: 8 },
  navLabel: { fontSize: 11, color: '#9ca3af', marginTop: 4 },
});