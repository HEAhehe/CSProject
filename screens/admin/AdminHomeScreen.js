import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  ScrollView,
  TextInput,
  RefreshControl,
  Modal,
  Image,
  Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { db, auth } from '../../firebase.config';
import { collection, getDocs, doc, updateDoc, getDoc, setDoc, query } from 'firebase/firestore';

export default function AdminHomeScreen({ navigation }) {
  const [requests, setRequests] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('pending'); // pending, approved, rejected, all
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  // Stats Counters
  const [counts, setCounts] = useState({
    pending: 0,
    approved: 0,
    rejected: 0,
    all: 0
  });

  // Action States
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [rejectReason, setRejectReason] = useState('');

  // 1. ดึงข้อมูลเมื่อเข้าหน้าจอ
  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [])
  );

  const fetchData = async () => {
    try {
      // ดึงข้อมูลคำขอทั้งหมด
      const q = query(collection(db, 'approval_requests'));
      const snapshot = await getDocs(q);

      const loadedRequests = [];
      let p = 0, a = 0, r = 0;

      snapshot.forEach(doc => {
        const data = doc.data();
        const item = { id: doc.id, ...data };
        loadedRequests.push(item);

        // นับจำนวน
        const status = data.status || 'pending';
        if (status === 'pending') p++;
        else if (status === 'approved') a++;
        else if (status === 'rejected') r++;
      });

      // เรียงลำดับวันที่ล่าสุดขึ้นก่อน
      loadedRequests.sort((a, b) => {
        const dateA = a.requestDate ? new Date(a.requestDate) : new Date(0);
        const dateB = b.requestDate ? new Date(b.requestDate) : new Date(0);
        return dateB - dateA;
      });

      setRequests(loadedRequests);
      setCounts({
        pending: p,
        approved: a,
        rejected: r,
        all: loadedRequests.length
      });

    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  // 2. ฟังก์ชันกรองข้อมูล (Search + Tabs)
  const getFilteredRequests = () => {
    let filtered = requests;

    // กรองตาม Tab (ถ้าไม่ใช่ 'all')
    if (selectedStatus !== 'all') {
      filtered = filtered.filter(req => (req.status || 'pending') === selectedStatus);
    }

    // กรองตาม Search
    if (searchQuery) {
      const lowerQuery = searchQuery.toLowerCase();
      filtered = filtered.filter(req =>
        (req.userName || '').toLowerCase().includes(lowerQuery) ||
        (req.storeName || '').toLowerCase().includes(lowerQuery) ||
        (req.details?.['ชื่อร้าน'] || '').toLowerCase().includes(lowerQuery)
      );
    }

    return filtered;
  };

  // 3. ฟังก์ชันจัดการคำขอ (เหมือนเดิมแต่ย้ายมาที่นี่)
  const handleAction = (request, action) => {
    setSelectedRequest(request);
    if (action === 'approve') {
        confirmAction('approve', request);
    } else {
        setModalVisible(true); // เปิด Modal เพื่อกรอกเหตุผลปฏิเสธ
    }
  };

  const confirmAction = (actionType, request, reason = '') => {
    Alert.alert(
      actionType === 'approve' ? 'ยืนยันการอนุมัติ' : 'ยืนยันการปฏิเสธ',
      `คุณต้องการ${actionType === 'approve' ? 'อนุมัติ' : 'ปฏิเสธ'}ร้านค้านี้ใช่หรือไม่?`,
      [
        { text: 'ยกเลิก', style: 'cancel' },
        {
          text: 'ยืนยัน',
          onPress: async () => {
            await processUpdate(actionType, request, reason);
          },
        },
      ]
    );
  };

  const processUpdate = async (actionType, request, reason) => {
    try {
      console.log('🔄 Starting approval process for:', request.userId);
      
      const updateData = {
        status: actionType === 'approve' ? 'approved' : 'rejected',
        approvedBy: auth.currentUser?.email || 'Admin',
        approvedDate: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      if (actionType === 'reject') {
        updateData.rejectReason = reason;
      }

      // 🔥 STEP 1: อัปเดตสถานะคำขอใน approval_requests
      console.log('📝 Updating approval_requests...');
      await updateDoc(doc(db, 'approval_requests', request.id), updateData);

      // ถ้าอนุมัติ
      if (actionType === 'approve' && request.userId) {
        
        // 🔥 STEP 2: ตรวจสอบว่ามี stores document หรือยัง
        console.log('🔍 Checking stores document...');
        const storeDocRef = doc(db, 'stores', request.userId);
        const storeDoc = await getDoc(storeDocRef);

        const storeData = {
          status: 'approved',
          isActive: true,
          approvedBy: auth.currentUser?.email || 'Admin',
          approvedDate: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };

        if (storeDoc.exists()) {
          // ถ้ามีแล้ว ก็ update
          console.log('✏️ Updating existing store document...');
          await updateDoc(storeDocRef, storeData);
        } else {
          // ถ้ายังไม่มี ก็สร้างใหม่จากข้อมูลใน request
          console.log('🆕 Creating new store document...');
          const newStoreData = {
            userId: request.userId,
            storeName: request.details?.['ชื่อร้าน'] || request.storeName || 'ไม่ระบุ',
            storeOwner: request.userName || 'ไม่ระบุ',
            phoneNumber: request.details?.['เบอร์โทรศัพท์'] || '',
            latitude: request.details?.latitude || null,
            longitude: request.details?.longitude || null,
            deliveryOptions: request.details?.['การจัดส่ง'] || 'รับที่ร้าน',
            createdAt: new Date().toISOString(),
            ...storeData
          };
          await setDoc(storeDocRef, newStoreData);
        }

        // 🔥 STEP 3: อัปเดต users collection
        console.log('👤 Updating user document...');
        await updateDoc(doc(db, 'users', request.userId), {
          currentRole: 'store',
          hasStorePending: false,
          updatedAt: new Date().toISOString()
        });

        console.log('✅ Approval process completed successfully!');
      }

      // ถ้าปฏิเสธ
      if (actionType === 'reject' && request.userId) {
        console.log('❌ Processing rejection...');
        
        // อัปเดต users collection
        await updateDoc(doc(db, 'users', request.userId), {
          hasStorePending: false,
          updatedAt: new Date().toISOString()
        });

        // ตรวจสอบและอัปเดต stores collection
        const storeDocRef = doc(db, 'stores', request.userId);
        const storeDoc = await getDoc(storeDocRef);

        const rejectData = {
          status: 'rejected',
          isActive: false,
          rejectReason: reason,
          rejectedBy: auth.currentUser?.email || 'Admin',
          rejectedDate: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };

        if (storeDoc.exists()) {
          await updateDoc(storeDocRef, rejectData);
        } else {
          // สร้าง document ใหม่พร้อม status rejected
          const newStoreData = {
            userId: request.userId,
            storeName: request.details?.['ชื่อร้าน'] || request.storeName || 'ไม่ระบุ',
            storeOwner: request.userName || 'ไม่ระบุ',
            createdAt: new Date().toISOString(),
            ...rejectData
          };
          await setDoc(storeDocRef, newStoreData);
        }

        console.log('✅ Rejection process completed!');
      }

      Alert.alert('สำเร็จ', 'บันทึกสถานะเรียบร้อยแล้ว');
      setModalVisible(false);
      setRejectReason('');
      fetchData(); // โหลดข้อมูลใหม่

    } catch (error) {
      console.error('❌ Update error:', error);
      console.error('Error details:', error.message);
      Alert.alert('ข้อผิดพลาด', `ไม่สามารถอัปเดตข้อมูลได้: ${error.message}`);
    }
  };

  // UI Components
  const StatusCard = ({ icon, label, count, color, filterKey }) => (
    <TouchableOpacity
      style={[
        styles.statusCard,
        selectedStatus === filterKey && { borderColor: color, borderWidth: 1.5, backgroundColor: `${color}05` }
      ]}
      onPress={() => setSelectedStatus(filterKey)}
    >
      <View style={styles.cardHeader}>
        <Ionicons name={icon} size={20} color={color} />
        <Text style={[styles.cardCount, { color }]}>{count}</Text>
      </View>
      <Text style={styles.cardLabel}>{label}</Text>
    </TouchableOpacity>
  );

  const RequestItem = ({ item }) => {
    const status = item.status || 'pending';
    let statusColor = '#f59e0b'; // pending = orange
    let statusBg = '#fef3c7';
    let statusText = 'รอดำเนินการ';

    if (status === 'approved') {
      statusColor = '#10b981';
      statusBg = '#d1fae5';
      statusText = 'อนุมัติแล้ว';
    } else if (status === 'rejected') {
      statusColor = '#ef4444';
      statusBg = '#fee2e2';
      statusText = 'ปฏิเสธ';
    }

    // แปลงวันที่เป็นรูปแบบไทย
    const formatDate = (dateStr) => {
      if (!dateStr) return 'ไม่ระบุ';
      const date = new Date(dateStr);
      return date.toLocaleDateString('th-TH', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    };

    return (
      <View style={styles.requestCard}>
        {/* Header */}
        <View style={styles.requestHeader}>
          <View style={styles.requestIcon}>
            <Ionicons name="storefront" size={24} color="#10b981" />
          </View>
          <View style={styles.requestInfo}>
            <Text style={styles.storeName}>
              {item.details?.['ชื่อร้าน'] || item.storeName || 'ไม่ระบุชื่อร้าน'}
            </Text>
            <Text style={styles.ownerName}>เจ้าของร้าน: {item.userName || 'ไม่ระบุ'}</Text>
            <Text style={styles.requestDate}>
              วันที่สมัคร: {formatDate(item.requestDate)}
            </Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: statusBg }]}>
            <Text style={[styles.statusText, { color: statusColor }]}>{statusText}</Text>
          </View>
        </View>

        {/* Details */}
        {item.details && (
          <View style={styles.detailsContainer}>
            {item.details['เบอร์โทรศัพท์'] && (
              <View style={styles.detailRow}>
                <Ionicons name="call" size={14} color="#6b7280" />
                <Text style={styles.detailText}>โทร: {item.details['เบอร์โทรศัพท์']}</Text>
              </View>
            )}
            {item.details['ที่อยู่'] && (
              <View style={styles.detailRow}>
                <Ionicons name="location" size={14} color="#6b7280" />
                <Text style={styles.detailText} numberOfLines={2}>
                  ที่อยู่: {item.details['ที่อยู่']}
                </Text>
              </View>
            )}
            {item.details['การจัดส่ง'] && (
              <View style={styles.detailRow}>
                <Ionicons name="bicycle" size={14} color="#6b7280" />
                <Text style={styles.detailText}>การจัดส่ง: {item.details['การจัดส่ง']}</Text>
              </View>
            )}
            {item.details['เปิด-ปิด'] && (
              <View style={styles.detailRow}>
                <Ionicons name="time" size={14} color="#6b7280" />
                <Text style={styles.detailText}>เวลา: {item.details['เปิด-ปิด']}</Text>
              </View>
            )}
          </View>
        )}

        {/* Reject Reason (if any) */}
        {status === 'rejected' && item.rejectReason && (
          <View style={styles.rejectReasonContainer}>
            <Text style={styles.rejectReasonLabel}>เหตุผลที่ปฏิเสธ:</Text>
            <Text style={styles.rejectReasonText}>{item.rejectReason}</Text>
          </View>
        )}

        {/* Action Buttons */}
        {status === 'pending' && (
          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={[styles.btn, styles.btnReject]}
              onPress={() => handleAction(item, 'reject')}
            >
              <Text style={styles.btnTextReject}>ปฏิเสธ</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.btn, styles.btnApprove]}
              onPress={() => handleAction(item, 'approve')}
            >
              <Text style={styles.btnTextApprove}>อนุมัติ</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />

      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Admin Panel</Text>
          <Text style={styles.headerSubtitle}>จัดการคำขออนุมัติร้านค้า</Text>
        </View>
        <TouchableOpacity 
          style={styles.statsButton}
          onPress={() => navigation.navigate('AdminReports')}
        >
          <Ionicons name="bar-chart-outline" size={18} color="#1f2937" />
          <Text style={styles.statsButtonText}>ไปยังสถิติ</Text>
        </TouchableOpacity>
      </View>

      <ScrollView 
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Status Cards */}
        <View style={styles.cardsGrid}>
          <StatusCard
            icon="time-outline"
            label="รอดำเนินการ"
            count={counts.pending}
            color="#f59e0b"
            filterKey="pending"
          />
          <StatusCard
            icon="checkmark-circle"
            label="อนุมัติแล้ว"
            count={counts.approved}
            color="#10b981"
            filterKey="approved"
          />
          <StatusCard
            icon="close-circle"
            label="ปฏิเสธ"
            count={counts.rejected}
            color="#ef4444"
            filterKey="rejected"
          />
          <StatusCard
            icon="list-outline"
            label="ทั้งหมด"
            count={counts.all}
            color="#3b82f6"
            filterKey="all"
          />
        </View>

        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color="#6b7280" />
          <TextInput
            style={styles.searchInput}
            placeholder="ค้นหาชื่อร้าน หรือเจ้าของร้าน..."
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        {/* Tabs */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabsContainer}>
            {['pending', 'approved', 'rejected'].map(status => (
                <TouchableOpacity
                    key={status}
                    style={[styles.tab, selectedStatus === status && styles.tabActive]}
                    onPress={() => setSelectedStatus(status)}
                >
                    <Text style={[styles.tabText, selectedStatus === status && styles.tabTextActive]}>
                        {status === 'pending' ? 'รอดำเนินการ' : status === 'approved' ? 'อนุมัติแล้ว' : 'ปฏิเสธ'}
                    </Text>
                </TouchableOpacity>
            ))}
        </ScrollView>

        {/* Requests List */}
        <View style={styles.listContainer}>
            {getFilteredRequests().map(item => (
                <RequestItem key={item.id} item={item} />
            ))}
            {getFilteredRequests().length === 0 && (
                <View style={styles.emptyState}>
                    <Text style={styles.emptyText}>ไม่พบข้อมูล</Text>
                </View>
            )}
        </View>

        <View style={{height: 100}} />
      </ScrollView>

      {/* Reject Reason Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
                <View style={styles.modalHeader}>
                    <Text style={styles.modalTitle}>ปฏิเสธคำขอ</Text>
                    <TouchableOpacity onPress={() => setModalVisible(false)}>
                        <Ionicons name="close" size={24} color="#1f2937" />
                    </TouchableOpacity>
                </View>
                <Text style={styles.modalSubtitle}>เหตุผลในการปฏิเสธ</Text>
                <TextInput
                    style={styles.rejectInput}
                    placeholder="กรุณาระบุเหตุผล..."
                    multiline
                    numberOfLines={4}
                    value={rejectReason}
                    onChangeText={setRejectReason}
                />
                <View style={styles.modalActions}>
                    <TouchableOpacity
                        style={styles.modalBtnCancel}
                        onPress={() => setModalVisible(false)}
                    >
                        <Text style={styles.modalBtnTextCancel}>ยกเลิก</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={styles.modalBtnConfirm}
                        onPress={() => confirmAction('reject', selectedRequest, rejectReason)}
                    >
                        <Text style={styles.modalBtnTextConfirm}>ยืนยัน</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </View>
      </Modal>

      {/* Bottom Nav */}
      <View style={styles.bottomNav}>
        <TouchableOpacity style={styles.navItem}>
          <Ionicons name="home" size={24} color="#1f2937" />
          <Text style={styles.navLabelActive}>หน้าหลัก</Text>
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
  container: { flex: 1, backgroundColor: '#f9fafb' },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingTop: 60, paddingBottom: 20, backgroundColor: '#fff',
  },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#1f2937' },
  headerSubtitle: { fontSize: 12, color: '#6b7280' },
  statsButton: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#f3f4f6',
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, gap: 6
  },
  statsButtonText: { fontSize: 13, fontWeight: '600', color: '#1f2937' },

  content: { flex: 1, paddingHorizontal: 20 },

  // Cards Grid
  cardsGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 15,
  },
  statusCard: {
    width: '48%', backgroundColor: '#fff', padding: 15, borderRadius: 12,
    borderWidth: 1, borderColor: '#e5e7eb', marginBottom: 5
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  cardCount: { fontSize: 18, fontWeight: 'bold' },
  cardLabel: { fontSize: 13, color: '#6b7280' },

  // Search
  searchContainer: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#e5e7eb',
    borderRadius: 10, paddingHorizontal: 15, height: 45, marginTop: 20, marginBottom: 15
  },
  searchInput: { flex: 1, marginLeft: 10, fontSize: 15 },

  // Tabs
  tabsContainer: { flexDirection: 'row', marginBottom: 15 },
  tab: {
    paddingVertical: 8, paddingHorizontal: 16, borderRadius: 20,
    backgroundColor: '#fff', marginRight: 10, borderWidth: 1, borderColor: '#e5e7eb'
  },
  tabActive: { backgroundColor: '#1f2937', borderColor: '#1f2937' },
  tabText: { fontSize: 13, color: '#6b7280', fontWeight: '500' },
  tabTextActive: { color: '#fff' },

  // List
  listContainer: { gap: 15 },
  requestCard: {
    backgroundColor: '#fff', borderRadius: 12, padding: 15, borderWidth: 1, borderColor: '#e5e7eb'
  },
  requestHeader: { flexDirection: 'row', gap: 12 },
  requestIcon: {
    width: 50, height: 50, borderRadius: 8, backgroundColor: '#f3f4f6',
    alignItems: 'center', justifyContent: 'center'
  },
  requestInfo: { flex: 1 },
  storeName: { fontSize: 16, fontWeight: 'bold', color: '#1f2937' },
  ownerName: { fontSize: 13, color: '#6b7280', marginTop: 2 },
  requestDate: { fontSize: 12, color: '#9ca3af', marginTop: 2 },

  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, height: 24 },
  statusText: { fontSize: 11, fontWeight: 'bold' },

  // รายละเอียด
  detailsContainer: {
    marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#f3f4f6', gap: 6
  },
  detailRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8
  },
  detailText: { fontSize: 13, color: '#4b5563', flex: 1 },

  actionButtons: { flexDirection: 'row', gap: 10, marginTop: 15 },
  btn: { flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: 'center' },
  btnReject: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#d1d5db' },
  btnApprove: { backgroundColor: '#10b981' },
  btnTextReject: { color: '#374151', fontWeight: '600' },
  btnTextApprove: { color: '#fff', fontWeight: '600' },

  rejectReasonContainer: {
    marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#fee2e2',
    backgroundColor: '#fef2f2', padding: 10, borderRadius: 8
  },
  rejectReasonLabel: { fontSize: 12, fontWeight: '600', color: '#991b1b', marginBottom: 4 },
  rejectReasonText: { fontSize: 13, color: '#dc2626' },

  emptyState: { alignItems: 'center', marginTop: 30 },
  emptyText: { color: '#9ca3af' },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
  modalContent: { backgroundColor: '#fff', borderRadius: 16, padding: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  modalTitle: { fontSize: 18, fontWeight: 'bold' },
  modalSubtitle: { fontSize: 14, color: '#6b7280', marginBottom: 10 },
  rejectInput: {
    backgroundColor: '#f9fafb', borderWidth: 1, borderColor: '#e5e7eb',
    borderRadius: 8, padding: 12, height: 100, textAlignVertical: 'top', marginBottom: 20
  },
  modalActions: { flexDirection: 'row', gap: 10 },
  modalBtnCancel: { flex: 1, padding: 12, borderRadius: 8, backgroundColor: '#f3f4f6', alignItems: 'center' },
  modalBtnConfirm: { flex: 1, padding: 12, borderRadius: 8, backgroundColor: '#1f2937', alignItems: 'center' },
  modalBtnTextCancel: { color: '#374151', fontWeight: '600' },
  modalBtnTextConfirm: { color: '#fff', fontWeight: '600' },

  // Bottom Nav
  bottomNav: {
    flexDirection: 'row', backgroundColor: '#fff', paddingVertical: 8,
    paddingHorizontal: 16, borderTopWidth: 1, borderTopColor: '#f3f4f6',
    position: 'absolute', bottom: 0, left: 0, right: 0
  },
  navItem: { flex: 1, alignItems: 'center', paddingVertical: 8 },
  navLabel: { fontSize: 11, color: '#9ca3af', marginTop: 4 },
  navLabelActive: { fontSize: 11, color: '#1f2937', fontWeight: '600', marginTop: 4 },
});