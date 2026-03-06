import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  StatusBar,
  TextInput,
  ActivityIndicator,
  Alert,
  Modal,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
  Keyboard
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { auth, db } from '../../firebase.config';
import { collection, addDoc, onSnapshot, deleteDoc, doc, updateDoc, getDoc } from 'firebase/firestore';
import * as Location from 'expo-location';
import MapView from 'react-native-maps';

const { width, height } = Dimensions.get('window');

export default function AddressBookScreen({ navigation }) {
  const [addresses, setAddresses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeAddressId, setActiveAddressId] = useState(null);

  // State สำหรับหน้าเพิ่ม/แก้ไขที่อยู่
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingId, setEditingId] = useState(null); // ✅ เก็บ ID ของที่อยู่ที่กำลังแก้ไข (ถ้ามี)
  const [newTitle, setNewTitle] = useState('');
  const [newDetail, setNewDetail] = useState('');
    const insets = useSafeAreaInsets();
  const [tempLocation, setTempLocation] = useState(null);

  // State สำหรับระบบแผนที่
  const [mapModalVisible, setMapModalVisible] = useState(false);
  const [isFetchingGPS, setIsFetchingGPS] = useState(false);
  const [mapRegion, setMapRegion] = useState({
    latitude: 13.9130, // ค่าเริ่มต้น
    longitude: 100.4988,
    latitudeDelta: 0.01,
    longitudeDelta: 0.01,
  });

  // State สำหรับระบบค้นหาสถานที่
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;

    const fetchCurrentAddress = async () => {
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (userDoc.exists()) {
        setActiveAddressId(userDoc.data().activeAddressId || null);
      }
    };
    fetchCurrentAddress();

    const addrRef = collection(db, 'users', user.uid, 'addresses');
    const unsubscribe = onSnapshot(addrRef, (snapshot) => {
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setAddresses(list);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // ✅ เปิด Modal สำหรับ "เพิ่มที่อยู่ใหม่"
  const openAddModal = () => {
    setEditingId(null);
    setNewTitle('');
    setNewDetail('');
    setTempLocation(null);
    setIsModalVisible(true);
  };

  // ✅ เปิด Modal สำหรับ "แก้ไขที่อยู่เดิม"
  const openEditModal = (item) => {
    setEditingId(item.id);
    setNewTitle(item.title);
    setNewDetail(item.address);
    setTempLocation({ latitude: item.latitude, longitude: item.longitude });
    setMapRegion({
      latitude: item.latitude,
      longitude: item.longitude,
      latitudeDelta: 0.005,
      longitudeDelta: 0.005,
    });
    setIsModalVisible(true);
  };

  const closeFormModal = () => {
    setIsModalVisible(false);
    setEditingId(null);
    setNewTitle('');
    setNewDetail('');
    setTempLocation(null);
  };

  const openMapPicker = async () => {
    setMapModalVisible(true);
    if (tempLocation && editingId) return;

    setIsFetchingGPS(true);
    try {
      let { status } = await Location.requestForegroundPermissionsAsync();

      // ✅ แก้ไข: ดักกรณีไม่อนุญาตสิทธิ์การเข้าถึงตำแหน่ง
      if (status !== 'granted') {
        Alert.alert('แจ้งเตือน', 'กรุณาอนุญาตสิทธิ์การเข้าถึงตำแหน่งเพื่อใช้งานแผนที่ครับ');
        setIsFetchingGPS(false);
        return;
      }

      let location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setMapRegion({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        latitudeDelta: 0.005,
        longitudeDelta: 0.005,
      });
    } catch (error) {
      console.log('Cannot fetch current location', error);
      Alert.alert('ข้อผิดพลาด', 'ไม่สามารถค้นหาตำแหน่งปัจจุบันได้');
    }
    setIsFetchingGPS(false);
  };

  const handleSearchLocation = async () => {
    if (!searchQuery.trim()) return;

    Keyboard.dismiss();
    setIsSearching(true);

    try {
      const geocodedLocation = await Location.geocodeAsync(searchQuery);

      if (geocodedLocation.length > 0) {
        const { latitude, longitude } = geocodedLocation[0];
        setMapRegion({
          latitude,
          longitude,
          latitudeDelta: 0.005,
          longitudeDelta: 0.005,
        });
      } else {
        Alert.alert('ไม่พบสถานที่', 'ลองค้นหาด้วยชื่ออื่น หรือระบุให้ชัดเจนขึ้นครับ (เช่น ระบุจังหวัด)');
      }
    } catch (error) {
      Alert.alert('ข้อผิดพลาด', 'ไม่สามารถค้นหาสถานที่ได้ในขณะนี้');
    }
    setIsSearching(false);
  };

  const confirmMapLocation = () => {
    setTempLocation({
      latitude: mapRegion.latitude,
      longitude: mapRegion.longitude
    });
    setMapModalVisible(false);
  };

  // ✅ ฟังก์ชันบันทึกข้อมูล (รองรับทั้งการ เพิ่มใหม่ และ แก้ไข)
  const handleSaveAddress = async () => {
    if (!newTitle.trim() || !newDetail.trim()) {
      Alert.alert('แจ้งเตือน', 'กรุณากรอกชื่อที่อยู่และรายละเอียดให้ครบถ้วน');
      return;
    }
    if (!tempLocation) {
      Alert.alert('แจ้งเตือน', 'กรุณากดปุ่ม "ปักหมุดบนแผนที่" เพื่อระบุพิกัดจัดส่ง');
      return;
    }

    const user = auth.currentUser;
    try {
      const addressData = {
        title: newTitle,
        address: newDetail,
        latitude: tempLocation.latitude,
        longitude: tempLocation.longitude,
      };

      if (editingId) {
        // อัปเดตที่อยู่เดิม
        await updateDoc(doc(db, 'users', user.uid, 'addresses', editingId), {
          ...addressData,
          updatedAt: new Date().toISOString()
        });

        // ถ้าที่อยู่ที่แก้กำลังถูกตั้งเป็นค่าเริ่มต้น (Active) อยู่ ให้อัปเดต Profile ไปด้วย
        if (editingId === activeAddressId) {
          await updateDoc(doc(db, 'users', user.uid), {
            addressTitle: addressData.title,
            address: addressData.address,
            latitude: addressData.latitude,
            longitude: addressData.longitude
          });
        }
        Alert.alert('สำเร็จ', 'แก้ไขข้อมูลที่อยู่เรียบร้อยแล้ว');
      } else {
        // เพิ่มที่อยู่ใหม่
        addressData.createdAt = new Date().toISOString();
        const docRef = await addDoc(collection(db, 'users', user.uid, 'addresses'), addressData);

        if (addresses.length === 0) {
          await handleSelectAddress(docRef.id, addressData);
        }
      }

      closeFormModal();
    } catch (error) {
      Alert.alert('ผิดพลาด', 'ไม่สามารถบันทึกที่อยู่ได้');
    }
  };

  const handleDeleteAddress = (id) => {
    Alert.alert('ลบที่อยู่', 'คุณต้องการลบที่อยู่นี้ใช่หรือไม่?', [
      { text: 'ยกเลิก', style: 'cancel' },
      { text: 'ลบ', style: 'destructive', onPress: async () => {
          const user = auth.currentUser;
          await deleteDoc(doc(db, 'users', user.uid, 'addresses', id));
          if (id === activeAddressId) {
             await updateDoc(doc(db, 'users', user.uid), { activeAddressId: null, addressTitle: null, address: null, latitude: null, longitude: null });
             setActiveAddressId(null);
          }
      }}
    ]);
  };

  const handleSelectAddress = async (id, addrData) => {
    const user = auth.currentUser;
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        activeAddressId: id,
        addressTitle: addrData.title,
        address: addrData.address,
        latitude: addrData.latitude,
        longitude: addrData.longitude
      });
      setActiveAddressId(id);
      navigation.goBack();
    } catch (error) {
      console.error(error);
    }
  };

  const renderItem = ({ item }) => {
    const isActive = item.id === activeAddressId;
    return (
      <TouchableOpacity
        style={[styles.card, isActive && styles.cardActive]}
        onPress={() => handleSelectAddress(item.id, item)}
      >
        <View style={styles.iconContainer}>
          <Ionicons name="location" size={24} color={isActive ? "#10b981" : "#9ca3af"} />
        </View>
        <View style={styles.cardInfo}>
          <Text style={[styles.cardTitle, isActive && { color: '#10b981' }]}>{item.title}</Text>
          <Text style={styles.cardDetail}>{item.address}</Text>
        </View>

        {/* ✅ เพิ่มปุ่มแก้ไข (ดินสอ) ไว้ข้างๆ ถังขยะ */}
        <View style={styles.cardActions}>
          <TouchableOpacity onPress={() => openEditModal(item)} style={styles.actionBtn}>
            <Ionicons name="create-outline" size={22} color="#3b82f6" />
          </TouchableOpacity>

          {!isActive ? (
            <TouchableOpacity onPress={() => handleDeleteAddress(item.id)} style={styles.actionBtn}>
              <Ionicons name="trash-outline" size={22} color="#ef4444" />
            </TouchableOpacity>
          ) : (
            <Ionicons name="checkmark-circle" size={24} color="#10b981" style={{ marginLeft: 5 }} />
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 15) }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#1f2937" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>สมุดที่อยู่จัดส่ง</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#10b981" style={{ marginTop: 50 }} />
      ) : (
        <FlatList
          data={addresses}
          renderItem={renderItem}
          keyExtractor={item => item.id}
          contentContainerStyle={[styles.listContent, { paddingBottom: Math.max(insets.bottom, 40) + 80 }]}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="map-outline" size={60} color="#d1d5db" />
              <Text style={styles.emptyText}>ยังไม่มีที่อยู่จัดส่ง</Text>
              <Text style={styles.emptySubText}>เพิ่มที่อยู่ของคุณเพื่อให้ร้านค้านำทางไปได้ถูกต้อง</Text>
            </View>
          }
        />
      )}

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 20) }]}>
        <TouchableOpacity style={styles.addButton} onPress={openAddModal}>
          <Ionicons name="add-circle-outline" size={24} color="#fff" />
          <Text style={styles.addButtonText}>เพิ่มที่อยู่ใหม่</Text>
        </TouchableOpacity>
      </View>

      {/* Modal สำหรับเพิ่ม/แก้ไขรายละเอียดที่อยู่ */}
      <Modal visible={isModalVisible} animationType="slide" transparent={true}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
          <View style={[styles.modalContainer, { paddingBottom: Math.max(insets.bottom, 25) }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editingId ? 'แก้ไขที่อยู่' : 'เพิ่มที่อยู่ใหม่'}</Text>
              <TouchableOpacity onPress={closeFormModal}>
                <Ionicons name="close" size={28} color="#9ca3af" />
              </TouchableOpacity>
            </View>

            <Text style={styles.label}>ชื่อที่เรียก (เช่น บ้าน, ที่ทำงาน, บ้านเพื่อน)</Text>
            <TextInput
              style={styles.input}
              placeholder="ระบุชื่อที่เรียกง่ายๆ"
              value={newTitle}
              onChangeText={setNewTitle}
            />

            <Text style={styles.label}>รายละเอียดที่อยู่แบบข้อความ</Text>
            <TextInput
              style={[styles.input, { height: 80, textAlignVertical: 'top' }]}
              placeholder="บ้านเลขที่, ซอย, หมู่บ้าน, จุดสังเกต..."
              multiline
              value={newDetail}
              onChangeText={setNewDetail}
            />

            <View style={styles.gpsSection}>
              <Text style={styles.label}>ตำแหน่งบนแผนที่ (สำหรับไรเดอร์นำทาง)</Text>
              {tempLocation ? (
                <TouchableOpacity style={styles.gpsSuccess} onPress={openMapPicker}>
                  <Ionicons name="checkmark-circle" size={20} color="#10b981" />
                  <Text style={styles.gpsSuccessText}>ปักหมุดพิกัดเรียบร้อยแล้ว (กดเพื่อแก้ไข)</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity style={styles.gpsButton} onPress={openMapPicker}>
                  <Ionicons name="map" size={20} color="#10b981" />
                  <Text style={styles.gpsButtonText}>คลิกเพื่อเลื่อนปักหมุดบนแผนที่</Text>
                </TouchableOpacity>
              )}
            </View>

            <TouchableOpacity style={styles.saveButton} onPress={handleSaveAddress}>
              <Text style={styles.saveButtonText}>บันทึกข้อมูลที่อยู่</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Map Modal */}
      <Modal visible={mapModalVisible} animationType="fade" transparent={false}>
        <View style={styles.mapModalContainer}>
          <View style={[styles.searchMapContainer, { top: Math.max(insets.top, 15) }]}>
            <View style={styles.searchInputWrapper}>
              <Ionicons name="search" size={20} color="#9ca3af" />
              <TextInput
                style={styles.searchMapInput}
                placeholder="ค้นหาสถานที่, ซอย, ถนน..."
                value={searchQuery}
                onChangeText={setSearchQuery}
                onSubmitEditing={handleSearchLocation}
                returnKeyType="search"
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery('')}>
                  <Ionicons name="close-circle" size={20} color="#d1d5db" />
                </TouchableOpacity>
              )}
            </View>
            <TouchableOpacity
              style={styles.searchBtn}
              onPress={handleSearchLocation}
              disabled={isSearching}
            >
              {isSearching ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.searchBtnText}>ค้นหา</Text>
              )}
            </TouchableOpacity>
          </View>

          {isFetchingGPS && (
            <View style={styles.mapLoadingOverlay}>
              <ActivityIndicator size="large" color="#10b981" />
              <Text style={{ marginTop: 10, color: '#374151' }}>กำลังค้นหาตำแหน่ง...</Text>
            </View>
          )}

          <MapView
            style={styles.map}
            region={mapRegion}
            onRegionChangeComplete={(region) => setMapRegion(region)}
            showsUserLocation={true}
            // ✅ เพิ่ม mapPadding เพื่อดัน UI ของแผนที่ (เช่นปุ่ม GPS, โลโก้ Google) ให้หลบแถบของเรา
            mapPadding={{
              top: Math.max(insets.top, 15) + 60,     // ดันลงมาจากด้านบนให้พ้นแถบค้นหา
              bottom: Math.max(insets.bottom, 20) + 100, // ดันขึ้นจากด้านล่างให้พ้นแถบปุ่มยืนยันพิกัด
              left: 0,
              right: 0
            }}
          />

          <View pointerEvents="none" style={styles.markerFixed}>
            <Ionicons name="location" size={48} color="#ef4444" style={{ marginBottom: 24 }} />
          </View>

          <View style={[styles.mapBottomBar, { paddingBottom: Math.max(insets.bottom, 20) }]}>
            <Text style={styles.mapGuideText}>เลื่อนแผนที่ให้หมุดตรงกับตำแหน่งที่ต้องการ</Text>
            <View style={styles.mapButtonGroup}>
              <TouchableOpacity style={styles.mapCancelBtn} onPress={() => setMapModalVisible(false)}>
                <Text style={styles.mapCancelBtnText}>ยกเลิก</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.mapConfirmBtn} onPress={confirmMapLocation}>
                <Text style={styles.mapConfirmBtnText}>ยืนยันพิกัดนี้</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 15, backgroundColor: '#fff', borderBottomWidth: 1, borderColor: '#e5e7eb' },
  backBtn: { padding: 5 },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#1f2937' },
  listContent: { padding: 20 },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', padding: 15, borderRadius: 12, marginBottom: 15, borderWidth: 1, borderColor: '#e5e7eb', elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05 },
  cardActive: { borderColor: '#10b981', backgroundColor: '#f0fdf4' },
  iconContainer: { width: 40, alignItems: 'center' },
  cardInfo: { flex: 1, paddingHorizontal: 10 },
  cardTitle: { fontSize: 16, fontWeight: 'bold', color: '#1f2937' },
  cardDetail: { fontSize: 13, color: '#6b7280', marginTop: 4 },
  cardActions: { flexDirection: 'row', alignItems: 'center' },
  actionBtn: { padding: 8 },
  emptyState: { alignItems: 'center', marginTop: 100 },
  emptyText: { fontSize: 18, fontWeight: 'bold', color: '#374151', marginTop: 15 },
  emptySubText: { fontSize: 14, color: '#9ca3af', marginTop: 5, textAlign: 'center', paddingHorizontal: 40 },
  footer: { paddingHorizontal: 20, paddingTop: 20, backgroundColor: '#fff', borderTopWidth: 1, borderColor: '#e5e7eb' },
  addButton: { flexDirection: 'row', backgroundColor: '#1f2937', paddingVertical: 15, borderRadius: 12, alignItems: 'center', justifyContent: 'center', gap: 8 },
  addButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContainer: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 25 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#1f2937' },
  label: { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 8 },
  input: { backgroundColor: '#f9fafb', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 10, padding: 12, fontSize: 15, color: '#1f2937', marginBottom: 20 },
  gpsSection: { marginBottom: 30 },
  gpsButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#ecfdf5', borderWidth: 1, borderColor: '#10b981', paddingVertical: 14, borderRadius: 10, gap: 8 },
  gpsButtonText: { color: '#10b981', fontWeight: 'bold', fontSize: 15 },
  gpsSuccess: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f0fdf4', padding: 14, borderRadius: 10, gap: 8, borderWidth: 1, borderColor: '#10b981' },
  gpsSuccessText: { color: '#10b981', fontWeight: 'bold' },
  saveButton: { backgroundColor: '#10b981', paddingVertical: 16, borderRadius: 12, alignItems: 'center' },
  saveButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },

  mapModalContainer: { flex: 1, backgroundColor: '#fff' },
  mapLoadingOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(255,255,255,0.8)', zIndex: 10, justifyContent: 'center', alignItems: 'center' },
  map: { flex: 1 },
  markerFixed: { position: 'absolute', left: '50%', top: '50%', marginLeft: -24, marginTop: -48, alignItems: 'center', justifyContent: 'center' },

  searchMapContainer: { position: 'absolute', left: 15, right: 15, flexDirection: 'row', gap: 10, zIndex: 5 },
  searchInputWrapper: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', paddingHorizontal: 15, borderRadius: 12, elevation: 5, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 5 },
  searchMapInput: { flex: 1, paddingVertical: 12, marginLeft: 10, fontSize: 14, color: '#1f2937' },
  searchBtn: { backgroundColor: '#10b981', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20, borderRadius: 12, elevation: 5, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 5 },
  searchBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 14 },

  mapBottomBar: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#fff', padding: 20, borderTopLeftRadius: 24, borderTopRightRadius: 24, shadowColor: '#000', shadowOffset: { width: 0, height: -2 }, shadowOpacity: 0.1, shadowRadius: 10, elevation: 10 },
  mapGuideText: { textAlign: 'center', color: '#6b7280', fontSize: 14, marginBottom: 15, fontWeight: '500' },
  mapButtonGroup: { flexDirection: 'row', gap: 10 },
  mapCancelBtn: { flex: 1, backgroundColor: '#f3f4f6', paddingVertical: 15, borderRadius: 12, alignItems: 'center' },
  mapCancelBtnText: { color: '#4b5563', fontWeight: 'bold', fontSize: 15 },
  mapConfirmBtn: { flex: 1, backgroundColor: '#10b981', paddingVertical: 15, borderRadius: 12, alignItems: 'center' },
  mapConfirmBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 15 },
});