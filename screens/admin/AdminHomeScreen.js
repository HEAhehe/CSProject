import React, { useState, useCallback, useEffect } from 'react';
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
import { collection, getDocs, doc, updateDoc, getDoc, query } from 'firebase/firestore';

export default function AdminHomeScreen({ navigation }) {
  const [requests, setRequests] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('pending');
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const [counts, setCounts] = useState({ pending: 0, approved: 0, rejected: 0, all: 0 });

  const [modalVisible, setModalVisible] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [expandedId, setExpandedId] = useState(null);

  const [fullImageVisible, setFullImageVisible] = useState(false);
  const [selectedImageUrl, setSelectedImageUrl] = useState('');

  const toggleExpand = (id) => setExpandedId(expandedId === id ? null : id);

  useFocusEffect(
    useCallback(() => { fetchData(); }, [])
  );

  const fetchData = async () => {
    try {
      const q = query(collection(db, 'approval_requests'));
      const snapshot = await getDocs(q);
      const loadedRequests = [];
      let p = 0, a = 0, r = 0;

      snapshot.forEach(doc => {
        const data = doc.data();
        const item = { id: doc.id, ...data };
        loadedRequests.push(item);
        const status = data.status || 'pending';
        if (status === 'pending') p++;
        else if (status === 'approved') a++;
        else if (status === 'rejected') r++;
      });

      loadedRequests.sort((a, b) => {
        const dateA = a.requestDate ? new Date(a.requestDate) : new Date(0);
        const dateB = b.requestDate ? new Date(b.requestDate) : new Date(0);
        return dateB - dateA;
      });

      setRequests(loadedRequests);
      setCounts({ pending: p, approved: a, rejected: r, all: loadedRequests.length });
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

  const getFilteredRequests = () => {
    let filtered = requests;
    if (selectedStatus !== 'all') {
      filtered = filtered.filter(req => (req.status || 'pending') === selectedStatus);
    }
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

  const handleAction = (request, action) => {
    setSelectedRequest(request);
    if (action === 'approve') confirmAction('approve', request);
    else setModalVisible(true);
  };

  const confirmAction = (actionType, request, reason = '') => {
    let titleMsg = actionType === 'approve' ? 'ยืนยันการอนุมัติ' : 'ยืนยันการปฏิเสธ';
    let bodyMsg = `คุณต้องการ${actionType === 'approve' ? 'อนุมัติ' : 'ปฏิเสธ'}${request.type === 'store_update' ? 'คำขอแก้ไขข้อมูลร้าน' : 'คำขอเปิดร้านใหม่'} ใช่หรือไม่?`;

    Alert.alert(titleMsg, bodyMsg, [
      { text: 'ยกเลิก', style: 'cancel' },
      { text: 'ยืนยัน', onPress: async () => await processUpdate(actionType, request, reason) },
    ]);
  };

  const processUpdate = async (actionType, request, reason) => {
    try {
      const updateData = {
        status: actionType === 'approve' ? 'approved' : 'rejected',
        approvedBy: auth.currentUser?.email || 'Admin',
        approvedDate: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      if (actionType === 'reject') updateData.rejectReason = reason;
      await updateDoc(doc(db, 'approval_requests', request.id), updateData);

      if (request.userId) {
        const storeDocRef = doc(db, 'stores', request.userId);

        if (request.type === 'store_registration') {
            if (actionType === 'approve') {
              await updateDoc(storeDocRef, {
                status: 'approved', isActive: true,
                approvedBy: auth.currentUser?.email || 'Admin',
                approvedDate: new Date().toISOString(), updatedAt: new Date().toISOString()
              });
              await updateDoc(doc(db, 'users', request.userId), {
                currentRole: 'store', hasStorePending: false, updatedAt: new Date().toISOString()
              });
            } else {
              await updateDoc(doc(db, 'users', request.userId), { hasStorePending: false, updatedAt: new Date().toISOString() });
              await updateDoc(storeDocRef, { status: 'rejected', isActive: false, rejectReason: reason, updatedAt: new Date().toISOString() });
            }
        }
        else if (request.type === 'store_update') {
            if (actionType === 'approve' && request.newData) {
                await updateDoc(storeDocRef, { ...request.newData, updatedAt: new Date().toISOString() });
            }
        }
      }

      Alert.alert('สำเร็จ', 'บันทึกสถานะเรียบร้อยแล้ว');
      setModalVisible(false);
      setRejectReason('');
      fetchData();
    } catch (error) {
      Alert.alert('ข้อผิดพลาด', `ไม่สามารถอัปเดตข้อมูลได้: ${error.message}`);
    }
  };

  const openImage = (url) => { setSelectedImageUrl(url); setFullImageVisible(true); };

  const StatusCard = ({ icon, label, count, color, filterKey }) => (
    <TouchableOpacity
      style={[styles.statusCard, selectedStatus === filterKey && { borderColor: color, borderWidth: 1.5, backgroundColor: `${color}05` }]}
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
    const isExpanded = expandedId === item.id;
    const currentStatus = item.status || 'pending';
    const statusColor = currentStatus === 'approved' ? '#10b981' : currentStatus === 'rejected' ? '#ef4444' : '#f59e0b';
    const isUpdate = item.type === 'store_update';

    const [realStoreImage, setRealStoreImage] = useState(item.details?.['รูปภาพ'] || item.storeImage || null);

    useEffect(() => {
      if (!realStoreImage && item.userId) {
        const fetchStoreImage = async () => {
          try {
            const storeDoc = await getDoc(doc(db, 'stores', item.userId));
            if (storeDoc.exists() && storeDoc.data().storeImage) {
              setRealStoreImage(storeDoc.data().storeImage);
            }
          } catch (error) {}
        };
        fetchStoreImage();
      }
    }, [item.userId, realStoreImage]);

    // ✅ ฟังก์ชันจัดเรียงเวลาทำการใหม่ ให้โชว์ครบ 7 วัน และบอกว่าปิดทำการ
    const renderBusinessHours = (requestItem) => {
        // 1. ถ้ามีข้อมูล newData.businessHours (แบบ object)
        const rawBh = requestItem.newData?.businessHours;
        const orderedKeys = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
        const daysMap = { mon: 'จันทร์', tue: 'อังคาร', wed: 'พุธ', thu: 'พฤหัสบดี', fri: 'ศุกร์', sat: 'เสาร์', sun: 'อาทิตย์' };

        if (rawBh && typeof rawBh === 'object') {
             return orderedKeys.map((key, index) => {
                 const dayData = rawBh[key];
                 return (
                    <View key={index} style={{ flexDirection: 'row', marginBottom: 4, alignItems: 'center' }}>
                      <Text style={[styles.detailValueTime, { width: 85, fontWeight: '600', color: '#4b5563' }]}>{daysMap[key]}</Text>
                      <Text style={[styles.detailValueTime, !dayData.isOpen && { color: '#ef4444' }]}>
                        {dayData.isOpen ? `${dayData.openTime} - ${dayData.closeTime} น.` : 'ปิดทำการ'}
                      </Text>
                    </View>
                 );
             });
        }

        // 2. ถ้าเป็น String แบบเก่า (จับแยกแล้วเรียงใหม่)
        const timeString = requestItem.details?.['เวลาทำการ'];
        if (!timeString) return <Text style={styles.detailValueTime}>ไม่ระบุเวลา</Text>;

        const lines = timeString.split('\n');
        const parsedDays = {};
        lines.forEach(line => {
            const parts = line.split(': ');
            if (parts.length === 2) {
                parsedDays[parts[0]] = parts[1].replace('-', ' - ') + ' น.';
            }
        });

        const thDays = ['จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์', 'อาทิตย์'];
        return thDays.map((day, index) => (
            <View key={index} style={{ flexDirection: 'row', marginBottom: 4, alignItems: 'center' }}>
                <Text style={[styles.detailValueTime, { width: 85, fontWeight: '600', color: '#4b5563' }]}>{day}</Text>
                <Text style={[styles.detailValueTime, !parsedDays[day] && { color: '#ef4444' }]}>
                   {parsedDays[day] || 'ปิดทำการ'}
                </Text>
            </View>
        ));
    };

    return (
      <View style={styles.requestCard}>
        {/* Header Section */}
        <View style={styles.cardMainHeader}>
          <View style={styles.requestIcon}>
            {realStoreImage ? (
              <Image source={{ uri: realStoreImage }} style={styles.storeMiniImage} />
            ) : (
              <Ionicons name="storefront-outline" size={24} color="#9ca3af" />
            )}
          </View>

          <View style={styles.headerInfo}>
            <View style={styles.badgeRow}>
              <Text style={[styles.statusBadgeText, { color: statusColor, backgroundColor: `${statusColor}15` }]}>
                {currentStatus === 'approved' ? 'อนุมัติแล้ว' : currentStatus === 'rejected' ? 'ปฏิเสธ' : 'รอดำเนินการ'}
              </Text>

              <View style={[styles.typeBadge, isUpdate ? styles.typeUpdateBg : styles.typeRegisterBg]}>
                <Text style={[styles.typeBadgeText, isUpdate ? styles.typeUpdateText : styles.typeRegisterText]}>
                  {isUpdate ? '📝 ขอแก้ไขข้อมูล' : '🆕 สมัครร้านใหม่'}
                </Text>
              </View>
            </View>

            <Text style={styles.storeNameText}>{item.details?.['ชื่อร้าน'] || item.details?.['ชื่อร้าน (ที่แก้ไข)'] || item.storeName || 'ไม่ระบุชื่อร้าน'}</Text>
            <Text style={styles.ownerLabel}>โดย: {item.userName || 'ไม่ระบุ'}</Text>
            <Text style={styles.dateLabel}>ส่งเมื่อ: {new Date(item.requestDate).toLocaleDateString('th-TH')}</Text>
          </View>

          <TouchableOpacity onPress={() => toggleExpand(item.id)} style={styles.expandBtn}>
             <Ionicons name={isExpanded ? "chevron-up" : "chevron-down"} size={22} color="#6b7280" />
          </TouchableOpacity>
        </View>

        {/* ✅ ย้ายปุ่ม Action ลงมาไว้ด้านล่างของ Header ไม่ให้ทับกับ Tag ด้านบน */}
        {currentStatus === 'pending' && (
           <View style={styles.quickActionRow}>
              <TouchableOpacity style={styles.miniBtnApprove} onPress={() => handleAction(item, 'approve')}>
                <Ionicons name="checkmark-circle" size={16} color="#fff" />
                <Text style={styles.miniBtnTextApprove}>อนุมัติ</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.miniBtnReject} onPress={() => handleAction(item, 'reject')}>
                <Ionicons name="close-circle" size={16} color="#ef4444" />
                <Text style={styles.miniBtnTextReject}>ปฏิเสธ</Text>
              </TouchableOpacity>
           </View>
        )}

        {isExpanded && (
          <View style={styles.expandedContent}>
            <View style={styles.detailSection}>
              <Text style={styles.detailTitle}>ข้อมูลติดต่อ</Text>
              <View style={styles.detailBox}>
                <Ionicons name="call-outline" size={18} color="#6b7280" style={styles.detailIcon} />
                <Text style={styles.detailValue}>{item.details?.['เบอร์โทร'] || 'ไม่ระบุเบอร์โทร'}</Text>
              </View>
            </View>

            <View style={styles.detailSection}>
              <Text style={styles.detailTitle}>ที่อยู่ร้าน</Text>
              <View style={styles.detailBox}>
                <Ionicons name="location-outline" size={18} color="#6b7280" style={styles.detailIcon} />
                <Text style={styles.detailValue}>{item.details?.['ที่อยู่'] || item.details?.['ที่อยู่ใหม่'] || 'ไม่ระบุที่อยู่'}</Text>
              </View>
            </View>

            <View style={styles.detailSection}>
              <Text style={styles.detailTitle}>เวลาทำการและการจัดส่ง</Text>
              <View style={[styles.detailBox, { flexDirection: 'column', alignItems: 'flex-start' }]}>
                {/* ✅ เรียกใช้ฟังก์ชันเวลาทำการใหม่ */}
                <View style={{ width: '100%' }}>{renderBusinessHours(item)}</View>
                <View style={styles.divider} />
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Ionicons name="bicycle-outline" size={18} color="#10b981" style={styles.detailIcon} />
                  <Text style={styles.detailValueBold}>รูปแบบจัดส่ง: {item.details?.['การจัดส่ง'] || 'ไม่ระบุ'}</Text>
                </View>
              </View>
            </View>

            <View style={styles.detailSection}>
              <Text style={styles.detailTitle}>รูปประกอบร้านค้า</Text>
              {realStoreImage ? (
                <View style={styles.imagePreviewBox}>
                  <Image source={{ uri: realStoreImage }} style={styles.previewImage} />
                  <View style={styles.imageOverlay}>
                    <TouchableOpacity style={styles.viewFullBtn} onPress={() => openImage(realStoreImage)}>
                      <Ionicons name="expand-outline" size={16} color="#fff" />
                      <Text style={styles.viewFullText}>ดูรูปเต็ม</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <View style={styles.noImageBox}>
                  <Ionicons name="image-outline" size={30} color="#9ca3af" />
                  <Text style={styles.noImageText}>ไม่มีรูปภาพประกอบ</Text>
                </View>
              )}
            </View>
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Admin Panel</Text>
          <Text style={styles.headerSubtitle}>จัดการคำขออนุมัติ</Text>
        </View>
        <TouchableOpacity style={styles.statsButton} onPress={() => navigation.navigate('AdminReports')}>
          <Ionicons name="bar-chart-outline" size={18} color="#1f2937" />
          <Text style={styles.statsButtonText}>ไปยังสถิติ</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />} showsVerticalScrollIndicator={false}>
        <View style={styles.cardsGrid}>
          <StatusCard icon="time-outline" label="รอดำเนินการ" count={counts.pending} color="#f59e0b" filterKey="pending" />
          <StatusCard icon="checkmark-circle" label="อนุมัติแล้ว" count={counts.approved} color="#10b981" filterKey="approved" />
          <StatusCard icon="close-circle" label="ปฏิเสธ" count={counts.rejected} color="#ef4444" filterKey="rejected" />
          <StatusCard icon="list-outline" label="ทั้งหมด" count={counts.all} color="#3b82f6" filterKey="all" />
        </View>

        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color="#6b7280" />
          <TextInput style={styles.searchInput} placeholder="ค้นหาชื่อร้าน หรือเจ้าของร้าน..." value={searchQuery} onChangeText={setSearchQuery} />
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabsContainer}>
            {['pending', 'approved', 'rejected'].map(status => (
                <TouchableOpacity key={status} style={[styles.tab, selectedStatus === status && styles.tabActive]} onPress={() => setSelectedStatus(status)}>
                    <Text style={[styles.tabText, selectedStatus === status && styles.tabTextActive]}>
                        {status === 'pending' ? 'รอดำเนินการ' : status === 'approved' ? 'อนุมัติแล้ว' : 'ปฏิเสธ'}
                    </Text>
                </TouchableOpacity>
            ))}
        </ScrollView>

        <View style={styles.listContainer}>
          {getFilteredRequests().map(item => <RequestItem key={item.id} item={item} />)}
          {getFilteredRequests().length === 0 && <View style={styles.emptyState}><Text style={styles.emptyText}>ไม่พบข้อมูล</Text></View>}
        </View>
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Reject Modal */}
      <Modal animationType="fade" transparent={true} visible={modalVisible}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>เหตุผลในการปฏิเสธ</Text>
            <TextInput style={styles.rejectInput} placeholder="ระบุเหตุผลที่นี่..." multiline value={rejectReason} onChangeText={setRejectReason} />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalBtnCancel} onPress={() => setModalVisible(false)}><Text style={{fontWeight:'600', color:'#4b5563'}}>ยกเลิก</Text></TouchableOpacity>
              <TouchableOpacity style={styles.modalBtnConfirm} onPress={() => confirmAction('reject', selectedRequest, rejectReason)}><Text style={{ color: '#fff', fontWeight:'600' }}>ยืนยัน</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Full Image Modal */}
      <Modal animationType="fade" transparent={true} visible={fullImageVisible}>
        <View style={styles.imageModalOverlay}>
          <TouchableOpacity style={styles.closeImageBtn} onPress={() => setFullImageVisible(false)}>
            <Ionicons name="close" size={30} color="#fff" />
          </TouchableOpacity>
          {selectedImageUrl ? <Image source={{ uri: selectedImageUrl }} style={styles.fullScreenImage} resizeMode="contain" /> : null}
        </View>
      </Modal>

      <View style={styles.bottomNav}>
        <TouchableOpacity style={styles.navItem}><Ionicons name="home" size={24} color="#1f2937" /><Text style={styles.navLabelActive}>หน้าหลัก</Text></TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={() => navigation.navigate('AdminUsers')}><Ionicons name="people-outline" size={24} color="#9ca3af" /><Text style={styles.navLabel}>บัญชี</Text></TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={() => navigation.navigate('AdminReports')}><Ionicons name="stats-chart-outline" size={24} color="#9ca3af" /><Text style={styles.navLabel}>รายงาน</Text></TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={() => navigation.navigate('AdminProfile')}><Ionicons name="person-outline" size={24} color="#9ca3af" /><Text style={styles.navLabel}>โปรไฟล์</Text></TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 60, paddingBottom: 20, backgroundColor: '#fff' },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#1f2937' },
  headerSubtitle: { fontSize: 12, color: '#6b7280' },
  statsButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f3f4f6', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, gap: 6 },
  statsButtonText: { fontSize: 13, fontWeight: '600', color: '#1f2937' },
  content: { flex: 1, paddingHorizontal: 20 },
  cardsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 15 },
  statusCard: { width: '48%', backgroundColor: '#fff', padding: 15, borderRadius: 12, borderWidth: 1, borderColor: '#e5e7eb' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  cardCount: { fontSize: 18, fontWeight: 'bold' },
  cardLabel: { fontSize: 13, color: '#6b7280' },
  searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 10, paddingHorizontal: 15, height: 45, marginTop: 20, marginBottom: 15 },
  searchInput: { flex: 1, marginLeft: 10, fontSize: 14 },
  tabsContainer: { flexDirection: 'row', marginBottom: 15, height: 40 },
  tab: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 20, backgroundColor: '#fff', marginRight: 10, borderWidth: 1, borderColor: '#e5e7eb', justifyContent: 'center' },
  tabActive: { backgroundColor: '#1f2937', borderColor: '#1f2937' },
  tabText: { fontSize: 13, color: '#6b7280', fontWeight: '500' },
  tabTextActive: { color: '#fff' },
  listContainer: { gap: 12 },

  requestCard: { backgroundColor: '#fff', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#e5e7eb', shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 2 },
  cardMainHeader: { flexDirection: 'row', alignItems: 'flex-start' },
  requestIcon: { width: 50, height: 50, borderRadius: 10, backgroundColor: '#f3f4f6', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  storeMiniImage: { width: '100%', height: '100%' },
  headerInfo: { flex: 1, marginLeft: 12 },

  badgeRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginBottom: 6 },
  statusBadgeText: { fontSize: 11, fontWeight: '600', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  typeBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  typeUpdateBg: { backgroundColor: '#ede9fe' },
  typeRegisterBg: { backgroundColor: '#dbeafe' },
  typeBadgeText: { fontSize: 10, fontWeight: 'bold' },
  typeUpdateText: { color: '#8b5cf6' },
  typeRegisterText: { color: '#3b82f6' },

  storeNameText: { fontSize: 16, fontWeight: 'bold', color: '#111827' },
  ownerLabel: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  dateLabel: { fontSize: 11, color: '#9ca3af', marginTop: 2 },

  expandBtn: { padding: 4, backgroundColor: '#f9fafb', borderRadius: 20, marginLeft: 10 },

  // ✅ สไตล์สำหรับปุ่มที่ถูกย้ายลงมาด้านล่าง Header
  quickActionRow: { flexDirection: 'row', marginTop: 12, gap: 10, borderTopWidth: 1, borderTopColor: '#f3f4f6', paddingTop: 12 },
  miniBtnApprove: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#10b981', paddingVertical: 10, borderRadius: 8 },
  miniBtnReject: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#fee2e2', paddingVertical: 10, borderRadius: 8 },
  miniBtnTextApprove: { fontSize: 13, fontWeight: '700', color: '#fff' },
  miniBtnTextReject: { fontSize: 13, fontWeight: '700', color: '#ef4444' },

  expandedContent: { marginTop: 12, borderTopWidth: 1, borderTopColor: '#f3f4f6', paddingTop: 16 },
  detailSection: { marginBottom: 14 },
  detailTitle: { fontSize: 13, fontWeight: '600', color: '#6b7280', marginBottom: 6, marginLeft: 2 },
  detailBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f9fafb', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 10, padding: 12 },
  detailIcon: { marginRight: 8 },
  detailValue: { fontSize: 14, color: '#111827', flex: 1, lineHeight: 20 },
  detailValueTime: { fontSize: 14, color: '#374151', lineHeight: 22 },
  detailValueBold: { fontSize: 14, color: '#111827', fontWeight: '600' },
  divider: { height: 1, backgroundColor: '#e5e7eb', width: '100%', marginVertical: 8 },

  imagePreviewBox: { width: '100%', height: 160, borderRadius: 10, overflow: 'hidden', borderWidth: 1, borderColor: '#e5e7eb' },
  previewImage: { width: '100%', height: '100%' },
  imageOverlay: { position: 'absolute', bottom: 10, right: 10 },
  viewFullBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, gap: 4 },
  viewFullText: { color: '#fff', fontSize: 12, fontWeight: '500' },
  noImageBox: { backgroundColor: '#f9fafb', borderWidth: 1, borderColor: '#e5e7eb', borderStyle: 'dashed', borderRadius: 10, height: 100, alignItems: 'center', justifyContent: 'center' },
  noImageText: { color: '#9ca3af', fontSize: 13, marginTop: 8 },

  emptyState: { alignItems: 'center', marginTop: 40 },
  emptyText: { color: '#9ca3af' },

  // Modals
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
  modalContent: { backgroundColor: '#fff', borderRadius: 16, padding: 24 },
  modalTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 16, color: '#111827' },
  rejectInput: { backgroundColor: '#f9fafb', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 10, padding: 14, height: 100, textAlignVertical: 'top', marginBottom: 20, fontSize: 15 },
  modalActions: { flexDirection: 'row', gap: 12 },
  modalBtnCancel: { flex: 1, padding: 14, borderRadius: 10, backgroundColor: '#f3f4f6', alignItems: 'center' },
  modalBtnConfirm: { flex: 1, padding: 14, borderRadius: 10, backgroundColor: '#ef4444', alignItems: 'center' },

  imageModalOverlay: { flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' },
  closeImageBtn: { position: 'absolute', top: 50, right: 20, zIndex: 10, padding: 10 },
  fullScreenImage: { width: '100%', height: '80%' },

  bottomNav: { flexDirection: 'row', backgroundColor: '#fff', paddingVertical: 10, borderTopWidth: 1, borderTopColor: '#f3f4f6', position: 'absolute', bottom: 0, width: '100%' },
  navItem: { flex: 1, alignItems: 'center' },
  navLabel: { fontSize: 10, color: '#9ca3af', marginTop: 4 },
  navLabelActive: { fontSize: 10, color: '#1f2937', fontWeight: 'bold', marginTop: 4 },
});