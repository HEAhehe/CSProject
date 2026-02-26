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
  RefreshControl,
  ActivityIndicator
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { db, auth } from '../../firebase.config';
import { collection, getDocs, doc, updateDoc, query } from 'firebase/firestore';

export default function AdminApprovalsScreen({ navigation }) {
  const [selectedTab, setSelectedTab] = useState('pending'); // pending, approved, rejected
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [actionType, setActionType] = useState(''); // 'approve' or 'reject'

  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(
    useCallback(() => { fetchRequests(); }, [])
  );

  const fetchRequests = async () => {
    try {
      const q = query(collection(db, 'approval_requests'));
      const snapshot = await getDocs(q);

      const loadedRequests = [];
      snapshot.forEach(doc => { loadedRequests.push({ id: doc.id, ...doc.data() }); });

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

  const filteredRequests = requests.filter(req => (req.status || 'pending') === selectedTab);

  const getRequestTypeColor = (type) => {
    if (type === 'store_update') return '#8b5cf6'; // ม่วง
    return '#3b82f6'; // ฟ้า (ลงทะเบียนใหม่)
  };

  const handleRequestPress = (request) => {
    setSelectedRequest(request);
    setModalVisible(true);
  };

  const confirmAction = () => {
    Alert.alert(
      actionType === 'approve' ? 'ยืนยันการอนุมัติ' : 'ยืนยันการปฏิเสธ',
      `คุณต้องการ${actionType === 'approve' ? 'อนุมัติ' : 'ปฏิเสธ'}คำขอนี้หรือไม่?`,
      [
        { text: 'ยกเลิก', style: 'cancel' },
        { text: 'ยืนยัน', onPress: async () => await processAction() },
      ]
    );
  };

  const handleApprove = () => { setActionType('approve'); confirmAction(); };
  const handleReject = () => {
    if (!rejectReason.trim()) { Alert.alert('ข้อผิดพลาด', 'กรุณาระบุเหตุผลในการปฏิเสธ'); return; }
    setActionType('reject'); confirmAction();
  };

  const processAction = async () => {
    if (!selectedRequest) return;
    try {
      const updateData = {
        status: actionType === 'approve' ? 'approved' : 'rejected',
        approvedBy: auth.currentUser?.email || 'Admin',
        approvedDate: new Date().toISOString(),
      };

      if (actionType === 'reject') updateData.rejectReason = rejectReason;
      await updateDoc(doc(db, 'approval_requests', selectedRequest.id), updateData);

      if (!selectedRequest.userId) return;
      const storeRef = doc(db, 'stores', selectedRequest.userId);

      if (selectedRequest.type === 'store_registration') {
        if (actionType === 'approve') {
          await updateDoc(storeRef, { status: 'approved', isActive: true, approvedBy: auth.currentUser?.email, approvedDate: new Date().toISOString() });
          await updateDoc(doc(db, 'users', selectedRequest.userId), { currentRole: 'store', hasStorePending: false });
        } else {
          await updateDoc(storeRef, { status: 'rejected', isActive: false, rejectReason, rejectedBy: auth.currentUser?.email, rejectedDate: new Date().toISOString() });
          await updateDoc(doc(db, 'users', selectedRequest.userId), { hasStorePending: false });
        }
      } else if (selectedRequest.type === 'store_update') {
        if (actionType === 'approve' && selectedRequest.newData) {
          await updateDoc(storeRef, { ...selectedRequest.newData, updatedAt: new Date().toISOString() });
        }
      }

      setModalVisible(false); setRejectReason(''); setSelectedRequest(null);
      fetchRequests();
      Alert.alert('สำเร็จ', `${actionType === 'approve' ? 'อนุมัติ' : 'ปฏิเสธ'}คำขอแล้ว`);
    } catch (error) {
      Alert.alert('ข้อผิดพลาด', `ไม่สามารถทำรายการได้: ${error.message}`);
    }
  };

  const renderRequest = ({ item }) => {
    const isUpdate = item.type === 'store_update';
    const typeColor = getRequestTypeColor(item.type);
    const displayDate = item.requestDate ? new Date(item.requestDate).toLocaleDateString('th-TH') : '-';

    return (
      <TouchableOpacity style={styles.requestCard} onPress={() => handleRequestPress(item)}>
        <View style={styles.requestHeader}>
          <View style={[styles.typeIcon, { backgroundColor: typeColor + '20' }]}>
            <Ionicons name={isUpdate ? 'create' : 'storefront'} size={20} color={typeColor} />
          </View>
          <View style={styles.requestInfo}>
            {/* ✅ ป้ายกำกับ Tag อย่างชัดเจน */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}>
              <View style={[styles.typeBadge, isUpdate ? styles.typeUpdateBg : styles.typeRegisterBg]}>
                <Text style={[styles.typeBadgeText, isUpdate ? styles.typeUpdateText : styles.typeRegisterText]}>
                  {isUpdate ? '📝 ขอแก้ไขข้อมูล' : '🆕 สมัครร้านใหม่'}
                </Text>
              </View>
              <Text style={styles.requestDate}>{displayDate}</Text>
            </View>

            <Text style={styles.storeNameTitle}>{item.storeName || item.details?.['ชื่อร้าน'] || 'ไม่ระบุชื่อร้าน'}</Text>
            <Text style={styles.requestUser}>โดย: {item.userName || 'ไม่ระบุชื่อ'}</Text>
          </View>
        </View>

        {/* ✅ แสดงเหตุผลปฏิเสธใน card */}
        {item.status === 'rejected' && item.rejectReason ? (
          <View style={styles.rejectReasonCard}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 4 }}>
              <Ionicons name="close-circle" size={13} color="#ef4444" />
              <Text style={styles.rejectReasonCardTitle}>เหตุผลที่ปฏิเสธ</Text>
            </View>
            <Text style={styles.rejectReasonCardText}>{item.rejectReason}</Text>
          </View>
        ) : null}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#1f2937" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>รายการคำขอทั้งหมด</Text>
        <View style={styles.placeholder} />
      </View>

      <View style={styles.tabsContainer}>
        <TouchableOpacity style={[styles.tab, selectedTab === 'pending' && styles.tabActive]} onPress={() => setSelectedTab('pending')}>
          <Text style={[styles.tabText, selectedTab === 'pending' && styles.tabTextActive]}>รอดำเนินการ</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tab, selectedTab === 'approved' && styles.tabActive]} onPress={() => setSelectedTab('approved')}>
          <Text style={[styles.tabText, selectedTab === 'approved' && styles.tabTextActive]}>อนุมัติแล้ว</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tab, selectedTab === 'rejected' && styles.tabActive]} onPress={() => setSelectedTab('rejected')}>
          <Text style={[styles.tabText, selectedTab === 'rejected' && styles.tabTextActive]}>ปฏิเสธ</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color="#1f2937" /></View>
      ) : filteredRequests.length > 0 ? (
        <FlatList
          data={filteredRequests}
          renderItem={renderRequest}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.requestsList}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        />
      ) : (
        <View style={styles.emptyState}>
          <Ionicons name="folder-open-outline" size={64} color="#d1d5db" />
          <Text style={styles.emptyText}>ไม่มีรายการในหมวดนี้</Text>
        </View>
      )}

      {/* Modal */}
      <Modal animationType="slide" transparent={true} visible={modalVisible}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>รายละเอียดคำขอ</Text>
              <TouchableOpacity onPress={() => { setModalVisible(false); setRejectReason(''); }}>
                <Ionicons name="close" size={24} color="#1f2937" />
              </TouchableOpacity>
            </View>

            {selectedRequest && (
              <View style={{flex: 1}}>
                <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
                  <View style={styles.infoRow}>
                    <Text style={styles.label}>ประเภท:</Text>
                    <Text style={styles.value}>{selectedRequest.type === 'store_update' ? 'แก้ไขข้อมูลร้าน' : 'เปิดร้านใหม่'}</Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={styles.label}>ผู้ขอ:</Text>
                    <Text style={styles.value}>{selectedRequest.userName}</Text>
                  </View>

                  <View style={styles.divider} />
                  <Text style={styles.sectionHeader}>{selectedRequest.type === 'store_update' ? 'ข้อมูลที่ขอแก้ไขใหม่' : 'ข้อมูลร้านค้า'}</Text>

                  {selectedRequest.details && Object.entries(selectedRequest.details).map(([key, value]) => (
                    <View key={key} style={styles.infoRow}>
                      <Text style={styles.label}>{key}:</Text>
                      <Text style={styles.value}>{String(value)}</Text>
                    </View>
                  ))}

                  {selectedRequest.status === 'pending' && (
                    <View style={styles.rejectInputContainer}>
                      <Text style={styles.label}>เหตุผล (กรณีปฏิเสธ):</Text>
                      <TextInput style={styles.reasonInput} placeholder="ระบุเหตุผลที่นี่..." value={rejectReason} onChangeText={setRejectReason} multiline />
                    </View>
                  )}

                  {selectedRequest.status === 'rejected' && selectedRequest.rejectReason && (
                    <View style={styles.rejectReasonBox}>
                      <Text style={styles.rejectReasonTitle}>เหตุผลที่ปฏิเสธ:</Text>
                      <Text style={styles.rejectReasonText}>{selectedRequest.rejectReason}</Text>
                    </View>
                  )}
                  <View style={{height: 40}} />
                </ScrollView>

                {selectedRequest.status === 'pending' && (
                  <View style={styles.modalActions}>
                    <TouchableOpacity style={styles.rejectButton} onPress={handleReject}>
                      <Ionicons name="close-circle" size={20} color="#fff" />
                      <Text style={styles.buttonText}>ปฏิเสธ</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.approveButton} onPress={handleApprove}>
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 50, paddingBottom: 12 },
  backButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 16, fontWeight: '600', color: '#1f2937' },
  placeholder: { width: 40 },

  tabsContainer: { flexDirection: 'row', paddingHorizontal: 20, paddingVertical: 12, gap: 8 },
  tab: { flex: 1, paddingVertical: 8, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: '#1f2937' },
  tabText: { fontSize: 12, color: '#9ca3af', fontWeight: '500' },
  tabTextActive: { color: '#1f2937', fontWeight: '600' },

  requestsList: { paddingHorizontal: 20, paddingBottom: 100 },
  requestCard: { backgroundColor: '#f9fafb', borderRadius: 12, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#e5e7eb' },
  requestHeader: { flexDirection: 'row', alignItems: 'center' },
  typeIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  requestInfo: { flex: 1 },

  // ✅ ป้ายกำกับแยกสีให้ชัดเจน
  typeBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  typeUpdateBg: { backgroundColor: '#ede9fe' },
  typeRegisterBg: { backgroundColor: '#dbeafe' },
  typeBadgeText: { fontSize: 10, fontWeight: 'bold' },
  typeUpdateText: { color: '#8b5cf6' },
  typeRegisterText: { color: '#3b82f6' },

  storeNameTitle: { fontSize: 15, fontWeight: 'bold', color: '#1f2937', marginBottom: 2 },
  requestUser: { fontSize: 13, color: '#6b7280' },
  requestDate: { fontSize: 11, color: '#9ca3af' },

  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', marginTop: 100 },
  emptyText: { fontSize: 16, color: '#9ca3af', marginTop: 16 },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '85%', minHeight: '50%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#1f2937' },
  modalBody: { padding: 20 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  label: { fontSize: 14, color: '#6b7280' },
  value: { fontSize: 14, fontWeight: '500', color: '#1f2937', maxWidth: '60%', textAlign: 'right' },
  divider: { height: 1, backgroundColor: '#f3f4f6', marginVertical: 15 },
  sectionHeader: { fontSize: 16, fontWeight: '600', color: '#1f2937', marginBottom: 15 },

  rejectInputContainer: { marginTop: 20 },
  reasonInput: { backgroundColor: '#f9fafb', borderRadius: 8, padding: 12, marginTop: 8, minHeight: 80, textAlignVertical: 'top', borderWidth: 1, borderColor: '#e5e7eb' },
  rejectReasonBox: { backgroundColor: '#fee2e2', padding: 12, borderRadius: 8, marginTop: 15 },
  rejectReasonTitle: { color: '#ef4444', fontWeight: '600', marginBottom: 4 },
  rejectReasonText: { color: '#7f1d1d' },

  // ✅ ในรายการ card
  rejectReasonCard: { marginTop: 10, backgroundColor: '#fff1f2', borderRadius: 8, padding: 10, borderLeftWidth: 3, borderLeftColor: '#ef4444' },
  rejectReasonCardTitle: { fontSize: 11, fontWeight: '700', color: '#ef4444' },
  rejectReasonCardText: { fontSize: 13, color: '#7f1d1d', marginTop: 2, lineHeight: 18 },

  modalActions: { flexDirection: 'row', padding: 20, gap: 12, borderTopWidth: 1, borderTopColor: '#f3f4f6' },
  rejectButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 14, borderRadius: 8, backgroundColor: '#ef4444' },
  approveButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 14, borderRadius: 8, backgroundColor: '#10b981' },
  buttonText: { color: '#fff', fontWeight: '600', fontSize: 15 },
});