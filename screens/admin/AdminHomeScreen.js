import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, StatusBar, ScrollView,
  TextInput, RefreshControl, Modal, Image, Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { db, auth } from '../../firebase.config';
import { collection, getDocs, doc, updateDoc, getDoc, query, addDoc } from 'firebase/firestore';
// ✅ 1. Import SafeArea
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function AdminHomeScreen({ navigation }) {
  // ✅ 2. ดึง insets
  const insets = useSafeAreaInsets();

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
        const timeA = a.requestDate ? new Date(a.requestDate).getTime() : 0;
        const timeB = b.requestDate ? new Date(b.requestDate).getTime() : 0;
        return timeB - timeA;
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
    if (action === 'approve') {
      confirmAction('approve', request);
    } else {
      setModalVisible(true);
    }
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
        const notifRef = collection(db, 'store_notifications');
        const userNotifRef = collection(db, 'notifications');

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

              await addDoc(userNotifRef, {
                 userId: request.userId,
                 title: 'ยินดีด้วย! ร้านค้าอนุมัติแล้ว 🎉',
                 message: 'คุณสามารถเริ่มโพสต์ขายอาหารเพื่อช่วยลด Food Waste ได้เลย',
                 type: 'store_approved',
                 isRead: false,
                 createdAt: new Date().toISOString()
              });

            } else {
              await updateDoc(doc(db, 'users', request.userId), { hasStorePending: false, updatedAt: new Date().toISOString() });
              await updateDoc(storeDocRef, { status: 'rejected', isActive: false, rejectReason: reason, updatedAt: new Date().toISOString() });

              await addDoc(userNotifRef, {
                 userId: request.userId,
                 title: 'คำขอเปิดร้านถูกปฏิเสธ ❌',
                 message: `(เหตุผล: ${reason}) กรุณาตรวจสอบข้อมูลและส่งคำขอใหม่อีกครั้ง`,
                 type: 'store_rejected',
                 isRead: false,
                 createdAt: new Date().toISOString()
              });
            }
        }
        else if (request.type === 'store_update') {
            const storeSnap = await getDoc(storeDocRef);
            const currentStoreData = storeSnap.exists() ? storeSnap.data() : {};

            if (actionType === 'approve' && request.newData) {
                await updateDoc(storeDocRef, { ...request.newData, updatedAt: new Date().toISOString() });
            }

            let mappedDetails = request.details ? { ...request.details } : {};
            if (request.newData) {
              const keyMap = {
                storeName: 'ชื่อร้านค้า',
                storeOwner: 'เจ้าของร้าน',
                phoneNumber: 'เบอร์โทรศัพท์',
                location: 'ที่อยู่ร้าน',
                storeDetails: 'รายละเอียดร้าน',
                deliveryMethod: 'การจัดส่ง',
                storeImage: 'รูปร้านค้า',
                businessHours: 'เวลาทำการ'
              };

              const getBHoursText = (bh) => {
                  if (!bh) return 'ไม่ระบุ';
                  if (typeof bh === 'string') return bh;
                  const daysOfWeek = [
                      { id: 'mon', label: 'จันทร์' }, { id: 'tue', label: 'อังคาร' }, { id: 'wed', label: 'พุธ' },
                      { id: 'thu', label: 'พฤหัส' }, { id: 'fri', label: 'ศุกร์' }, { id: 'sat', label: 'เสาร์' }, { id: 'sun', label: 'อาทิตย์' }
                  ];
                  return daysOfWeek.map(d => {
                      return bh[d.id]?.isOpen ? `${d.label}: ${bh[d.id].openTime}-${bh[d.id].closeTime}` : `${d.label}: ปิดทำการ`;
                  }).join('\n');
              };

              Object.entries(request.newData).forEach(([key, val]) => {
                if (keyMap[key] && val !== undefined && val !== null && val !== '') {
                  let displayVal = val;
                  if (key === 'deliveryMethod') {
                    displayVal = val === 'pickup' ? 'รับที่ร้าน' : val === 'delivery' ? 'เดลิเวอรี่' : val === 'both' ? 'ทั้งสองแบบ' : val;
                  } else if (key === 'businessHours') {
                    displayVal = getBHoursText(val);
                  }
                  mappedDetails[keyMap[key]] = (key === 'storeImage') ? val : String(displayVal);
                }
              });
            }

            const finalImage = request.newData?.storeImage || request.storeImage || currentStoreData.storeImage;
            if (finalImage) {
                mappedDetails['รูปร้านค้า'] = finalImage;
            }

            const storeName = request.storeName || mappedDetails['ชื่อร้านค้า'] || request.newData?.storeName || 'ร้านค้าของคุณ';

            if (actionType === 'approve') {
                await addDoc(notifRef, {
                    storeId: request.userId,
                    title: 'แก้ไขข้อมูลร้านได้รับการอนุมัติ ✅',
                    message: `แอดมินอนุมัติการแก้ไขข้อมูลร้าน "${storeName}" เรียบร้อยแล้ว ข้อมูลได้รับการอัปเดตแล้ว`,
                    type: 'store_edit_approved',
                    details: mappedDetails,
                    isRead: false,
                    createdAt: new Date().toISOString()
                });
            } else {
                await addDoc(notifRef, {
                    storeId: request.userId,
                    title: 'แก้ไขข้อมูลร้านถูกปฏิเสธ ❌',
                    message: `แอดมินไม่อนุมัติการแก้ไขข้อมูลร้าน "${storeName}"`,
                    cancelReason: reason,
                    type: 'store_edit_rejected',
                    details: mappedDetails,
                    isRead: false,
                    createdAt: new Date().toISOString()
                });
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

    const [oldStoreData, setOldStoreData] = useState(null);

    useEffect(() => {
      if (isUpdate && item.userId) {
        const fetchOldData = async () => {
          try {
            const snap = await getDoc(doc(db, 'stores', item.userId));
            if (snap.exists()) setOldStoreData(snap.data());
          } catch(e) {
            console.log("Error fetching old data:", e);
          }
        };
        fetchOldData();
      }
    }, [item.userId]);

    const getDeliveryText = (val) => val === 'pickup' ? 'รับที่ร้าน' : val === 'delivery' ? 'เดลิเวอรี่' : val === 'both' ? 'ทั้งสองแบบ' : 'ไม่ระบุ';

    const getBHoursText = (bh) => {
        if (!bh) return 'ไม่ระบุ';
        const daysOfWeek = [
            { id: 'mon', label: 'จันทร์' }, { id: 'tue', label: 'อังคาร' }, { id: 'wed', label: 'พุธ' },
            { id: 'thu', label: 'พฤหัส' }, { id: 'fri', label: 'ศุกร์' }, { id: 'sat', label: 'เสาร์' }, { id: 'sun', label: 'อาทิตย์' }
        ];
        return daysOfWeek.filter(d => bh[d.id]?.isOpen)
                         .map(d => `${d.label}: ${bh[d.id].openTime}-${bh[d.id].closeTime}`)
                         .join(', ') || 'ปิดทำการทุกวัน';
    };

    const CompareField = ({ label, oldVal, newVal, icon }) => {
        const isChanged = isUpdate && String(oldVal || '') !== String(newVal || '');

        return (
            <View style={styles.detailSection}>
                <Text style={styles.detailTitle}>{label} {isChanged && <Text style={{color:'#f59e0b', fontSize: 11}}>(มีการแก้ไข)</Text>}</Text>
                {isChanged ? (
                    <View style={styles.changedBox}>
                        <View style={styles.oldRow}>
                            <Ionicons name={icon} size={16} color="#ef4444" />
                            <Text style={styles.oldText}>{oldVal || 'ไม่ระบุข้อมูลเดิม'}</Text>
                        </View>
                        <View style={styles.arrowRow}>
                            <Ionicons name="arrow-down" size={14} color="#9ca3af" />
                        </View>
                        <View style={styles.newRow}>
                            <Ionicons name={icon} size={16} color="#10b981" />
                            <Text style={styles.newText}>{newVal || 'ไม่ระบุ'}</Text>
                        </View>
                    </View>
                ) : (
                    <View style={styles.detailBox}>
                        <Ionicons name={icon} size={18} color="#6b7280" style={styles.detailIcon} />
                        <Text style={styles.detailValue}>{newVal || 'ไม่ระบุ'}</Text>
                    </View>
                )}
            </View>
        );
    };

    const displayImage = isUpdate ? (item.newData?.storeImage || oldStoreData?.storeImage) : (item.details?.['รูปภาพ'] || item.storeImage);
    const hasImageChanged = isUpdate && (oldStoreData?.storeImage !== item.newData?.storeImage) && !!item.newData?.storeImage;

    return (
      <View style={styles.requestCard}>
        <View style={styles.cardMainHeader}>
          <View style={styles.requestIcon}>
            {displayImage ? (
              <Image source={{ uri: displayImage }} style={styles.storeMiniImage} />
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

            <Text style={styles.storeNameText}>{item.newData?.storeName || item.details?.['ชื่อร้าน'] || item.storeName || 'ไม่ระบุชื่อร้าน'}</Text>
            <Text style={styles.ownerLabel}>โดย: {item.newData?.storeOwner || item.userName || 'ไม่ระบุ'}</Text>
            <Text style={styles.dateLabel}>ส่งเมื่อ: {new Date(item.requestDate).toLocaleDateString('th-TH', {year:'numeric', month:'short', day:'numeric', hour:'2-digit', minute:'2-digit'})}</Text>
          </View>

          <TouchableOpacity onPress={() => toggleExpand(item.id)} style={styles.expandBtn}>
             <Ionicons name={isExpanded ? "chevron-up" : "chevron-down"} size={22} color="#6b7280" />
          </TouchableOpacity>
        </View>

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

            <CompareField
                label="ชื่อร้านค้า"
                icon="storefront-outline"
                oldVal={oldStoreData?.storeName}
                newVal={item.newData?.storeName || item.details?.['ชื่อร้าน']}
            />

            <CompareField
                label="เจ้าของร้าน"
                icon="person-outline"
                oldVal={oldStoreData?.storeOwner}
                newVal={item.newData?.storeOwner || item.details?.['เจ้าของร้าน']}
            />

            <CompareField
                label="ข้อมูลติดต่อ (เบอร์โทร)"
                icon="call-outline"
                oldVal={oldStoreData?.phoneNumber}
                newVal={item.newData?.phoneNumber || item.details?.['เบอร์โทร']}
            />

            <CompareField
                label="ที่อยู่ร้าน"
                icon="location-outline"
                oldVal={oldStoreData?.location}
                newVal={item.newData?.location || item.details?.['ที่อยู่ใหม่'] || item.details?.['ที่อยู่']}
            />

            <CompareField
                label="รายละเอียดร้าน"
                icon="document-text-outline"
                oldVal={oldStoreData?.storeDetails}
                newVal={item.newData?.storeDetails}
            />

            <CompareField
                label="การจัดส่ง"
                icon="bicycle-outline"
                oldVal={getDeliveryText(oldStoreData?.deliveryMethod)}
                newVal={isUpdate ? getDeliveryText(item.newData?.deliveryMethod) : item.details?.['การจัดส่ง']}
            />

            <CompareField
                label="เวลาทำการ"
                icon="time-outline"
                oldVal={getBHoursText(oldStoreData?.businessHours)}
                newVal={isUpdate ? getBHoursText(item.newData?.businessHours) : item.details?.['เวลาทำการ']}
            />

            <View style={styles.detailSection}>
              <Text style={styles.detailTitle}>รูปประกอบร้านค้า {hasImageChanged && <Text style={{color:'#f59e0b', fontSize: 11}}>(เปลี่ยนรูปใหม่)</Text>}</Text>

              {hasImageChanged ? (
                 <View style={{flexDirection: 'row', gap: 10}}>
                    <View style={{flex: 1}}>
                        <Text style={{fontSize: 12, color: '#ef4444', marginBottom: 4, textAlign: 'center'}}>รูปเดิม</Text>
                        <View style={[styles.imagePreviewBox, {height: 100}]}>
                            {oldStoreData?.storeImage ? (
                                <Image source={{ uri: oldStoreData.storeImage }} style={styles.previewImage} />
                            ) : (
                                <View style={{flex: 1, backgroundColor: '#f3f4f6', alignItems:'center', justifyContent:'center'}}>
                                    <Ionicons name="image-outline" size={24} color="#9ca3af" />
                                </View>
                            )}
                        </View>
                    </View>
                    <View style={{flex: 1}}>
                        <Text style={{fontSize: 12, color: '#10b981', marginBottom: 4, textAlign: 'center', fontWeight: 'bold'}}>รูปใหม่</Text>
                        <View style={[styles.imagePreviewBox, {height: 100, borderColor: '#10b981', borderWidth: 2}]}>
                            {item.newData?.storeImage && (
                                <>
                                    <Image source={{ uri: item.newData.storeImage }} style={styles.previewImage} />
                                    <TouchableOpacity style={styles.imageOverlay} onPress={() => openImage(item.newData.storeImage)}>
                                        <Ionicons name="expand-outline" size={18} color="#fff" />
                                    </TouchableOpacity>
                                </>
                            )}
                        </View>
                    </View>
                 </View>
              ) : (
                displayImage ? (
                    <View style={styles.imagePreviewBox}>
                        <Image source={{ uri: displayImage }} style={styles.previewImage} />
                        <View style={styles.imageOverlay}>
                            <TouchableOpacity style={styles.viewFullBtn} onPress={() => openImage(displayImage)}>
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
                )
              )}
            </View>

          </View>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#f9fafb" />
      {/* ✅ 3. ดัน Header ลงให้พ้นรอยบาก */}
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 20) }]}>
        <View>
          <Text style={styles.headerTitle}>Admin Panel</Text>
          <Text style={styles.headerSubtitle}>จัดการคำขออนุมัติ</Text>
        </View>
        <TouchableOpacity style={styles.statsButton} onPress={() => navigation.navigate('AdminReports')}>
          <Ionicons name="bar-chart-outline" size={18} color="#1f2937" />
          <Text style={styles.statsButtonText}>ไปยังสถิติ</Text>
        </TouchableOpacity>
      </View>

      {/* ✅ 4. เพิ่ม contentContainerStyle ดันเนื้อหาล่างสุดให้พ้นเมนู */}
      <ScrollView
        style={styles.content}
        contentContainerStyle={{ paddingBottom: insets.bottom + 90 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
      >
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
      </ScrollView>

      <Modal animationType="fade" transparent={true} visible={modalVisible}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>เหตุผลในการปฏิเสธ</Text>
            <TextInput style={styles.rejectInput} placeholder="ระบุเหตุผลที่นี่..." multiline value={rejectReason} onChangeText={setRejectReason} />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalBtnCancel} onPress={() => setModalVisible(false)}><Text style={{fontWeight:'600', color:'#4b5563'}}>ยกเลิก</Text></TouchableOpacity>

              <TouchableOpacity style={styles.modalBtnConfirm} onPress={() => {
                if(!rejectReason.trim()){
                  Alert.alert('แจ้งเตือน', 'กรุณาระบุเหตุผลในการปฏิเสธคำขอ');
                  return;
                }
                processUpdate('reject', selectedRequest, rejectReason);
              }}>
                <Text style={{ color: '#fff', fontWeight:'600' }}>ยืนยัน</Text>
              </TouchableOpacity>

            </View>
          </View>
        </View>
      </Modal>

      <Modal animationType="fade" transparent={true} visible={fullImageVisible}>
        <View style={styles.imageModalOverlay}>
          <TouchableOpacity style={styles.closeImageBtn} onPress={() => setFullImageVisible(false)}>
            <Ionicons name="close" size={30} color="#fff" />
          </TouchableOpacity>
          {selectedImageUrl ? <Image source={{ uri: selectedImageUrl }} style={styles.fullScreenImage} resizeMode="contain" /> : null}
        </View>
      </Modal>

      {/* ✅ 5. ดัน Bottom Nav ขึ้น */}
      <View style={[styles.bottomNav, { paddingBottom: Math.max(insets.bottom, 10) }]}>
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
  // 🟢 เอา paddingTop: 60 ออกจาก CSS เพราะเราทำ inline style ด้านบนแล้ว
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 20, backgroundColor: '#fff' },
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

  changedBox: { backgroundColor: '#f0fdf4', borderWidth: 1, borderColor: '#bbf7d0', borderRadius: 10, padding: 12, flexDirection: 'column' },
  oldRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  oldText: { fontSize: 13, color: '#ef4444', textDecorationLine: 'line-through', flex: 1, lineHeight: 18 },
  arrowRow: { paddingLeft: 24, marginVertical: 4 },
  newRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  newText: { fontSize: 14, color: '#065f46', fontWeight: 'bold', flex: 1, lineHeight: 20 },

  imagePreviewBox: { width: '100%', height: 160, borderRadius: 10, overflow: 'hidden', borderWidth: 1, borderColor: '#e5e7eb' },
  previewImage: { width: '100%', height: '100%' },
  imageOverlay: { position: 'absolute', bottom: 10, right: 10, backgroundColor: 'rgba(0,0,0,0.6)', padding: 6, borderRadius: 20 },
  viewFullBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, gap: 4 },
  viewFullText: { color: '#fff', fontSize: 12, fontWeight: '500' },
  noImageBox: { backgroundColor: '#f9fafb', borderWidth: 1, borderColor: '#e5e7eb', borderStyle: 'dashed', borderRadius: 10, height: 100, alignItems: 'center', justifyContent: 'center' },
  noImageText: { color: '#9ca3af', fontSize: 13, marginTop: 8 },

  emptyState: { alignItems: 'center', marginTop: 40 },
  emptyText: { color: '#9ca3af' },

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

  // 🟢 เปลี่ยน paddingVertical เป็น paddingTop เพื่อรับกับ insets
  bottomNav: { flexDirection: 'row', backgroundColor: '#fff', paddingTop: 10, borderTopWidth: 1, borderTopColor: '#f3f4f6', position: 'absolute', bottom: 0, width: '100%' },
  navItem: { flex: 1, alignItems: 'center' },
  navLabel: { fontSize: 10, color: '#9ca3af', marginTop: 4 },
  navLabelActive: { fontSize: 10, color: '#1f2937', fontWeight: 'bold', marginTop: 4 },
});