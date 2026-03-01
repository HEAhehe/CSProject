import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  StatusBar,
  Alert,
  Modal,
  Image,
  Dimensions,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import MapView, { Marker } from 'react-native-maps';
import * as Location from 'expo-location';
import { db, auth } from '../../firebase.config';
import { doc, getDoc, collection, addDoc, query, where, getDocs } from 'firebase/firestore';

const { width } = Dimensions.get('window');

const daysOfWeek = [
  { id: 'mon', label: 'จันทร์' },
  { id: 'tue', label: 'อังคาร' },
  { id: 'wed', label: 'พุธ' },
  { id: 'thu', label: 'พฤหัสบดี' },
  { id: 'fri', label: 'ศุกร์' },
  { id: 'sat', label: 'เสาร์' },
  { id: 'sun', label: 'อาทิตย์' },
];

export default function StoreSettingsScreen({ navigation }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [requestStatus, setRequestStatus] = useState(null); // null | 'pending' | 'rejected'
  const [rejectReason, setRejectReason] = useState('');

  // ข้อมูลทั่วไป
  const [storeName, setStoreName] = useState('');
  const [storeOwner, setStoreOwner] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [storeDetails, setStoreDetails] = useState('');
  const [selectedDelivery, setSelectedDelivery] = useState('pickup');
  const [storeImage, setStoreImage] = useState(null);

  // ข้อมูลเวลาทำการ
  const [businessHours, setBusinessHours] = useState({
    mon: { isOpen: true, openTime: '08:00', closeTime: '20:00' },
    tue: { isOpen: true, openTime: '08:00', closeTime: '20:00' },
    wed: { isOpen: true, openTime: '08:00', closeTime: '20:00' },
    thu: { isOpen: true, openTime: '08:00', closeTime: '20:00' },
    fri: { isOpen: true, openTime: '08:00', closeTime: '20:00' },
    sat: { isOpen: false, openTime: '', closeTime: '' },
    sun: { isOpen: false, openTime: '', closeTime: '' },
  });
  const [showBusinessHoursModal, setShowBusinessHoursModal] = useState(false);

  // ข้อมูลตำแหน่ง
  const [location, setLocation] = useState('');
  const [address, setAddress] = useState('');
  const [coordinates, setCoordinates] = useState(null);
  const [mapModalVisible, setMapModalVisible] = useState(false);
  const [tempMarker, setTempMarker] = useState(null);
  const [region, setRegion] = useState({
    latitude: 13.7563,
    longitude: 100.5018,
    latitudeDelta: 0.05,
    longitudeDelta: 0.05,
  });

  useEffect(() => {
    loadStoreData();
    checkRequestStatus();
  }, []);

  const checkRequestStatus = async () => {
    try {
      const user = auth.currentUser;
      if (!user) return;

      const q = query(
        collection(db, 'approval_requests'),
        where('userId', '==', user.uid),
        where('type', '==', 'store_update')
      );
      const snapshot = await getDocs(q);

      if (!snapshot.empty) {
        // ใช้ getTime() เพื่อความชัวร์ในการเปรียบเทียบ Date ฝั่ง JS
        const sorted = snapshot.docs
          .map(d => d.data())
          .sort((a, b) => new Date(b.requestDate).getTime() - new Date(a.requestDate).getTime());

        const latestStatus = sorted[0].status;

        if (latestStatus === 'pending') {
          setRequestStatus('pending');
        } else if (latestStatus === 'rejected') {
          setRequestStatus('rejected');
          setRejectReason(sorted[0].rejectReason || '');
        } else {
          // ถ้าเป็น approved หรืออื่นๆ ให้กลับสู่โหมดปกติ (ล้างค่าสถานะทิ้ง) สามารถแก้ข้อมูลใหม่ได้เลย
          setRequestStatus(null);
        }
      }
    } catch (error) {
      console.error('Error checking request status:', error);
    }
  };

  const loadStoreData = async () => {
    try {
      const user = auth.currentUser;
      if (!user) return;

      const storeDoc = await getDoc(doc(db, 'stores', user.uid));
      if (storeDoc.exists()) {
        const data = storeDoc.data();

        setStoreName(data.storeName || '');
        setStoreOwner(data.storeOwner || '');
        setPhoneNumber(data.phoneNumber || data.phone || '');
        setStoreDetails(data.storeDetails || '');
        setSelectedDelivery(data.deliveryMethod || 'pickup');
        setStoreImage(data.storeImage || data.imageUrl || null);

        if (data.businessHours) setBusinessHours(data.businessHours);

        setLocation(data.location || '');
        setAddress(data.address || '');
        if (data.latitude && data.longitude) {
          const coords = { latitude: data.latitude, longitude: data.longitude };
          setCoordinates(coords);
          setRegion({ ...coords, latitudeDelta: 0.01, longitudeDelta: 0.01 });
        }
      }
    } catch (error) {
      console.error('Error loading store data:', error);
      Alert.alert('ผิดพลาด', 'ไม่สามารถโหลดข้อมูลร้านค้าได้');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('ต้องการสิทธิ์', 'แอปต้องการสิทธิ์เข้าถึงคลังรูปภาพ');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.2,
      base64: true,
    });

    if (!result.canceled && result.assets[0]) {
      setStoreImage(`data:image/jpeg;base64,${result.assets[0].base64}`);
    }
  };

  const handleTimeInputChange = (dayId, type, text) => {
    if (text === '') {
      setBusinessHours(prev => ({ ...prev, [dayId]: { ...prev[dayId], [type]: '' } }));
      return;
    }
    let cleaned = text.replace(/[^0-9]/g, '');
    if (cleaned.length > 4) cleaned = cleaned.substring(0, 4);
    let validatedText = '';
    if (cleaned.length > 0) {
      if (parseInt(cleaned[0]) > 2) return;
      validatedText += cleaned[0];
    }
    if (cleaned.length > 1) {
      const hours = parseInt(cleaned.substring(0, 2));
      if (hours > 23) return;
      validatedText += cleaned[1];
    }
    if (cleaned.length > 2) {
      if (parseInt(cleaned[2]) > 5) return;
      validatedText += ':' + cleaned[2];
    }
    if (cleaned.length > 3) validatedText += cleaned[3];

    setBusinessHours(prev => ({ ...prev, [dayId]: { ...prev[dayId], [type]: validatedText } }));
  };

  const handleTimeInputBlur = (dayId, type, text) => {
    if (!text) return;
    let [hours, minutes] = text.split(':');
    if (hours && hours.length === 1) hours = '0' + hours;
    if (!minutes) minutes = '00';
    else if (minutes.length === 1) minutes = minutes + '0';
    setBusinessHours(prev => ({ ...prev, [dayId]: { ...prev[dayId], [type]: `${hours}:${minutes}` } }));
  };

  const toggleDayStatus = (dayId) => {
    setBusinessHours(prev => ({ ...prev, [dayId]: { ...prev[dayId], isOpen: !prev[dayId].isOpen } }));
  };

  const getBusinessHoursSummary = () => {
    const openDays = daysOfWeek.filter(day => businessHours[day.id].isOpen);
    if (openDays.length === 0) return 'ปิดทำการทุกวัน';
    return `เปิด ${openDays.length} วันต่อสัปดาห์`;
  };

  const handleOpenMap = async () => {
    if (!coordinates) {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        let loc = await Location.getCurrentPositionAsync({});
        setRegion({ latitude: loc.coords.latitude, longitude: loc.coords.longitude, latitudeDelta: 0.01, longitudeDelta: 0.01 });
      }
    }
    setTempMarker(coordinates);
    setMapModalVisible(true);
  };

  const handleConfirmLocation = async () => {
    if (!tempMarker) {
      Alert.alert('กรุณาปักหมุด', 'กรุณาแตะบนแผนที่เพื่อเลือกตำแหน่ง');
      return;
    }
    setCoordinates(tempMarker);
    try {
      const addressResults = await Location.reverseGeocodeAsync({ latitude: tempMarker.latitude, longitude: tempMarker.longitude });
      if (addressResults && addressResults.length > 0) {
        const addr = addressResults[0];
        const fullAddress = [addr.name, addr.street, addr.district, addr.city, addr.region].filter(Boolean).join(', ');
        setLocation(fullAddress || 'ที่อยู่จากพิกัดที่เลือก');
      }
      setAddress(`lat: ${tempMarker.latitude.toFixed(6)}, lng: ${tempMarker.longitude.toFixed(6)}`);
    } catch (error) {
      console.log("Geocode error");
    }
    setMapModalVisible(false);
  };

  const handleSave = async () => {
    if (!storeName.trim() || !phoneNumber.trim() || !location.trim()) {
      Alert.alert('ข้อมูลไม่ครบ', 'กรุณากรอกข้อมูลที่มีเครื่องหมาย * ให้ครบถ้วน');
      return;
    }

    setSaving(true);
    try {
      const user = auth.currentUser;

      const bh = businessHours || {};
      const formattedHoursSummary = Object.keys(bh)
        .filter(day => bh[day].isOpen)
        .map(day => {
          const dayLabel = daysOfWeek.find(d => d.id === day)?.label || day;
          return `${dayLabel}: ${bh[day].openTime}-${bh[day].closeTime}`;
        })
        .join('\n');

      const approvalRequest = {
        type: 'store_update',
        userId: user.uid,
        userName: storeOwner || user.displayName || 'ไม่ระบุชื่อ',
        userEmail: user.email || 'ไม่ระบุอีเมล',
        storeName: storeName.trim(),
        requestDate: new Date().toISOString(),
        status: 'pending',

        newData: {
          storeName: storeName.trim(),
          storeOwner: storeOwner.trim(),
          phoneNumber: phoneNumber.trim(),
          storeDetails: storeDetails.trim(),
          businessHours: businessHours,
          deliveryMethod: selectedDelivery,
          location: location.trim(),
          address: address.trim(),
          latitude: coordinates?.latitude || null,
          longitude: coordinates?.longitude || null,
          storeImage: storeImage,
          updatedAt: new Date().toISOString()
        },

        details: {
          'ชื่อร้าน (ที่แก้ไข)': storeName.trim(),
          'เจ้าของร้าน': storeOwner.trim(),
          'เบอร์โทร': phoneNumber.trim(),
          'เวลาทำการ': formattedHoursSummary,
          'การจัดส่ง': selectedDelivery === 'pickup' ? 'รับที่ร้าน' : selectedDelivery === 'delivery' ? 'เดลิเวอรี่' : 'ทั้งสองแบบ',
          'ที่อยู่ใหม่': location.trim(),
        }
      };

      await addDoc(collection(db, 'approval_requests'), approvalRequest);

      Alert.alert(
        'ส่งคำขอสำเร็จ 📝',
        'แอดมินจะตรวจสอบและอนุมัติภายใน 1-2 วันทำการ',
        [{ text: 'ตกลง', onPress: () => { setRequestStatus('pending'); } }]
      );

    } catch (error) {
      console.error('Error submitting update request:', error);
      Alert.alert('ผิดพลาด', 'ไม่สามารถส่งคำขอได้ กรุณาลองใหม่อีกครั้ง');
    } finally {
      setSaving(false);
    }
  };

  const DeliveryOption = ({ icon, title, isSelected, onPress }) => (
    <TouchableOpacity style={[styles.deliveryOption, isSelected && styles.deliveryOptionSelected]} onPress={onPress}>
      <Ionicons name={icon} size={24} color={isSelected ? '#10b981' : '#6b7280'} />
      <Text style={[styles.deliveryTitle, isSelected && styles.deliveryTitleSelected]}>{title}</Text>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#10b981" />
      </View>
    );
  }

  // ตัวแปรเช็คสำหรับล็อคฟอร์ม
  const isPending = requestStatus === 'pending';

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={24} color="#1f2937" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>ตั้งค่าร้านค้า</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* 🔔 Status Banner */}
      {isPending && (
        <View style={styles.bannerPending}>
          <Ionicons name="time-outline" size={20} color="#92400e" />
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text style={styles.bannerTitle}>รอการอนุมัติจากแอดมิน</Text>
            <Text style={styles.bannerSubtitle}>คำขอแก้ไขข้อมูลร้านค้าของคุณกำลังอยู่ระหว่างตรวจสอบ ใช้เวลา 1-2 วันทำการ (ฟอร์มจะถูกล็อคชั่วคราว)</Text>
          </View>
        </View>
      )}

      {requestStatus === 'rejected' && (
        <View style={styles.bannerRejected}>
          <Ionicons name="close-circle" size={20} color="#991b1b" />
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text style={styles.bannerRejectedTitle}>คำขอถูกปฏิเสธ ✗</Text>
            {rejectReason ? (
              <Text style={styles.bannerRejectedSubtitle}>เหตุผล: {rejectReason}</Text>
            ) : (
              <Text style={styles.bannerRejectedSubtitle}>กรุณาตรวจสอบข้อมูลอีกครั้ง</Text>
            )}
            <Text style={[styles.bannerRejectedSubtitle, { marginTop: 4, fontWeight: '600' }]}>คุณสามารถแก้ไขและส่งคำขอใหม่ได้เลย</Text>
          </View>
        </View>
      )}

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>

          {/* ล็อคการโต้ตอบทั้งหมดถ้าเป็น pending */}
          <View pointerEvents={isPending ? 'none' : 'auto'} style={{ opacity: isPending ? 0.6 : 1 }}>

            {/* 🖼️ รูปร้านค้า */}
            <TouchableOpacity style={styles.imagePickerContainer} onPress={handleSelectImage}>
              {storeImage ? (
                <Image source={{ uri: storeImage }} style={styles.imagePreview} />
              ) : (
                <View style={styles.imagePlaceholder}>
                  <Ionicons name="camera-outline" size={40} color="#9ca3af" />
                  <Text style={styles.imagePlaceholderText}>เปลี่ยนรูปหน้าร้าน</Text>
                </View>
              )}
              <View style={styles.cameraBadge}>
                <Ionicons name="camera" size={16} color="#fff" />
              </View>
            </TouchableOpacity>

            {/* 📝 ข้อมูลพื้นฐาน */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>ข้อมูลพื้นฐาน</Text>

              <Text style={styles.label}>ชื่อร้านค้า *</Text>
              <TextInput style={styles.input} value={storeName} onChangeText={setStoreName} placeholder="ชื่อร้านของคุณ" />

              <Text style={styles.label}>ชื่อเจ้าของร้าน</Text>
              <TextInput style={styles.input} value={storeOwner} onChangeText={setStoreOwner} placeholder="ชื่อ-นามสกุล" />

              <Text style={styles.label}>เบอร์โทรศัพท์ติดต่อ *</Text>
              <TextInput style={styles.input} value={phoneNumber} onChangeText={(t) => setPhoneNumber(t.replace(/[^0-9]/g, ''))} placeholder="08X-XXX-XXXX" keyboardType="phone-pad" maxLength={10} />

              <Text style={styles.label}>รายละเอียดร้านค้า (แนะนำตัว)</Text>
              <TextInput style={[styles.input, styles.textArea]} value={storeDetails} onChangeText={setStoreDetails} placeholder="บอกเล่าเกี่ยวกับร้านค้าของคุณ..." multiline numberOfLines={3} textAlignVertical="top" />
            </View>

            {/* 🛵 การจัดส่งและเวลา */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>การตั้งค่าบริการ</Text>

              <Text style={styles.label}>รูปแบบการส่งสินค้า</Text>
              <View style={styles.deliveryRow}>
                <DeliveryOption icon="storefront" title="รับที่ร้าน" isSelected={selectedDelivery === 'pickup'} onPress={() => setSelectedDelivery('pickup')} />
                <DeliveryOption icon="bicycle" title="เดลิเวอรี่" isSelected={selectedDelivery === 'delivery'} onPress={() => setSelectedDelivery('delivery')} />
                <DeliveryOption icon="swap-horizontal" title="ทั้งสองแบบ" isSelected={selectedDelivery === 'both'} onPress={() => setSelectedDelivery('both')} />
              </View>

              <Text style={styles.label}>เวลาทำการ</Text>
              <TouchableOpacity style={styles.businessHoursButton} onPress={() => setShowBusinessHoursModal(true)}>
                <View style={styles.businessHoursInfo}>
                  <Ionicons name="time" size={20} color="#10b981" />
                  <Text style={styles.businessHoursText}>{getBusinessHoursSummary()}</Text>
                </View>
                <Ionicons name="create-outline" size={20} color="#10b981" />
              </TouchableOpacity>
            </View>

            {/* 📍 ตำแหน่งที่ตั้ง */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>ตำแหน่งที่ตั้ง</Text>

              <Text style={styles.label}>ที่อยู่ร้านค้า *</Text>
              <TextInput style={[styles.input, { height: 80 }]} value={location} onChangeText={setLocation} placeholder="เลขที่ ถนน ตำบล อำเภอ จังหวัด..." multiline textAlignVertical="top" />

              <TouchableOpacity style={styles.mapButton} onPress={handleOpenMap}>
                <Ionicons name={coordinates ? "location" : "map-outline"} size={20} color={coordinates ? "#10b981" : "#6b7280"} />
                <Text style={[styles.mapButtonText, coordinates && { color: '#10b981' }]}>
                  {coordinates ? 'แก้ไขตำแหน่ง (ปักหมุดแล้ว)' : 'เปิดแผนที่เพื่อปักหมุด'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* ℹ️ คำเตือน */}
            {!isPending && (
               <Text style={styles.warningText}>
                 * การแก้ไขจะใช้เวลาตรวจสอบข้อมูล 1-2 วันทำการ
               </Text>
            )}

            <View style={{ height: 120 }} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* 💾 ปุ่มบันทึก */}
      <View style={styles.footer}>
        {isPending ? (
          <View style={styles.saveButtonDisabled}>
            <Ionicons name="time-outline" size={18} color="#92400e" />
            <Text style={styles.saveButtonDisabledText}>ฟอร์มถูกล็อค (รอแอดมินอนุมัติ)</Text>
          </View>
        ) : (
          <TouchableOpacity
            style={[styles.saveButton, saving && { opacity: 0.7 }]}
            onPress={handleSave}
            disabled={saving}
          >
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveButtonText}>ส่งคำขอแก้ไขข้อมูล</Text>}
          </TouchableOpacity>
        )}
      </View>

      {/* 🕒 Modal เวลาทำการ */}
      <Modal visible={showBusinessHoursModal} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>เวลาทำการ</Text>
              <TouchableOpacity onPress={() => setShowBusinessHoursModal(false)}><Ionicons name="close" size={24} color="#333" /></TouchableOpacity>
            </View>
            <ScrollView style={styles.modalBody}>
              {daysOfWeek.map((day) => (
                <View key={day.id} style={styles.dayRow}>
                  <View style={styles.dayHeader}>
                    <TouchableOpacity style={styles.dayToggle} onPress={() => toggleDayStatus(day.id)}>
                      <View style={[styles.checkbox, businessHours[day.id].isOpen && styles.checkboxActive]}>
                        {businessHours[day.id].isOpen && <Ionicons name="checkmark" size={16} color="#FFF" />}
                      </View>
                      <Text style={[styles.dayLabel, !businessHours[day.id].isOpen && styles.dayLabelInactive]}>{day.label}</Text>
                    </TouchableOpacity>
                  </View>
                  {businessHours[day.id].isOpen ? (
                    <View style={styles.timeRow}>
                      <View style={styles.timeInputBox}>
                        <TextInput style={styles.timeInputText} value={businessHours[day.id].openTime} onChangeText={(t) => handleTimeInputChange(day.id, 'openTime', t)} onBlur={(e) => handleTimeInputBlur(day.id, 'openTime', e.nativeEvent.text)} keyboardType="number-pad" maxLength={5} placeholder="--:--" />
                        <Ionicons name="time-outline" size={16} color="#999" />
                      </View>
                      <Text style={styles.dash}>—</Text>
                      <View style={styles.timeInputBox}>
                        <TextInput style={styles.timeInputText} value={businessHours[day.id].closeTime} onChangeText={(t) => handleTimeInputChange(day.id, 'closeTime', t)} onBlur={(e) => handleTimeInputBlur(day.id, 'closeTime', e.nativeEvent.text)} keyboardType="number-pad" maxLength={5} placeholder="--:--" />
                        <Ionicons name="time-outline" size={16} color="#999" />
                      </View>
                    </View>
                  ) : (
                    <View style={styles.closedContainer}><Text style={styles.closedText}>ปิดทำการ</Text></View>
                  )}
                </View>
              ))}
            </ScrollView>
            <View style={styles.modalFooter}>
              <TouchableOpacity style={styles.modalDoneButton} onPress={() => setShowBusinessHoursModal(false)}><Text style={styles.modalDoneButtonText}>เสร็จสิ้น</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* 📍 Modal แผนที่ */}
      <Modal animationType="slide" transparent={false} visible={mapModalVisible} onRequestClose={() => setMapModalVisible(false)}>
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity style={styles.modalBackButton} onPress={() => setMapModalVisible(false)}>
              <Ionicons name="close" size={28} color="#333" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>เลือกตำแหน่งร้าน</Text>
            <TouchableOpacity style={styles.modalConfirmButton} onPress={handleConfirmLocation}>
              <Ionicons name="checkmark" size={28} color="#10b981" />
            </TouchableOpacity>
          </View>
          <MapView style={styles.map} region={region} onRegionChangeComplete={setRegion} onPress={(e) => setTempMarker(e.nativeEvent.coordinate)} showsUserLocation showsMyLocationButton={true}>
            {tempMarker && (
              <Marker coordinate={tempMarker} draggable onDragEnd={(e) => setTempMarker(e.nativeEvent.coordinate)}>
                <Ionicons name="location" size={40} color="#FF5252" />
              </Marker>
            )}
          </MapView>
          <View style={styles.instructionOverlay}>
            <View style={styles.instructionBox}>
              <Text style={styles.instructionText}>แตะบนแผนที่เพื่อปักหมุดตำแหน่งร้าน</Text>
            </View>
          </View>
        </SafeAreaView>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: Platform.OS === 'ios' ? 10 : 20, paddingBottom: 15, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  backButton: { padding: 5 },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#1f2937' },
  content: { flex: 1 },

  imagePickerContainer: { width: '100%', height: 200, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f3f4f6', position: 'relative' },
  imagePreview: { width: '100%', height: '100%', resizeMode: 'cover' },
  imagePlaceholder: { flex: 1, backgroundColor: '#f3f4f6', alignItems: 'center', justifyContent: 'center' },
  imagePlaceholderText: { color: '#9ca3af', marginTop: 10, fontSize: 14, fontWeight: '500' },
  cameraBadge: { position: 'absolute', bottom: 15, right: 15, backgroundColor: '#10b981', padding: 10, borderRadius: 25, elevation: 5, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 3, shadowOffset: {width: 0, height: 2} },

  section: { backgroundColor: '#fff', padding: 20, marginBottom: 10, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', color: '#1f2937', marginBottom: 15 },
  label: { fontSize: 13, fontWeight: '600', color: '#4b5563', marginBottom: 8, marginTop: 10 },
  input: { backgroundColor: '#f9fafb', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 10, paddingHorizontal: 15, paddingVertical: 12, fontSize: 15, color: '#1f2937' },
  textArea: { height: 80, paddingTop: 12 },

  deliveryRow: { flexDirection: 'row', gap: 10 },
  deliveryOption: { flex: 1, alignItems: 'center', backgroundColor: '#f9fafb', paddingVertical: 12, borderRadius: 10, borderWidth: 1, borderColor: '#e5e7eb', gap: 5 },
  deliveryOptionSelected: { backgroundColor: '#ecfdf5', borderColor: '#10b981' },
  deliveryTitle: { fontSize: 12, color: '#6b7280', fontWeight: '500' },
  deliveryTitleSelected: { color: '#10b981', fontWeight: 'bold' },

  businessHoursButton: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f9fafb', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 10, padding: 15 },
  businessHoursInfo: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  businessHoursText: { fontSize: 14, color: '#1f2937', fontWeight: '500' },

  mapButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f9fafb', borderWidth: 1, borderColor: '#e5e7eb', borderStyle: 'dashed', borderRadius: 10, padding: 15, gap: 8, marginTop: 10 },
  mapButtonText: { fontSize: 14, color: '#6b7280', fontWeight: '500' },

  warningText: { fontSize: 12, color: '#f59e0b', textAlign: 'center', marginTop: 10, paddingHorizontal: 20 },

  bannerPending: { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: '#fef3c7', borderLeftWidth: 4, borderLeftColor: '#f59e0b', paddingHorizontal: 16, paddingVertical: 12, marginHorizontal: 0 },
  bannerTitle: { fontSize: 14, fontWeight: '700', color: '#92400e', marginBottom: 2 },
  bannerSubtitle: { fontSize: 12, color: '#92400e', lineHeight: 18 },

  bannerRejected: { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: '#fee2e2', borderLeftWidth: 4, borderLeftColor: '#ef4444', paddingHorizontal: 16, paddingVertical: 12, marginHorizontal: 0 },
  bannerRejectedTitle: { fontSize: 14, fontWeight: '700', color: '#991b1b', marginBottom: 2 },
  bannerRejectedSubtitle: { fontSize: 12, color: '#991b1b', lineHeight: 18 },

  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#fff', padding: 20, paddingBottom: Platform.OS === 'ios' ? 35 : 20, borderTopWidth: 1, borderTopColor: '#f3f4f6' },
  saveButton: { backgroundColor: '#10b981', paddingVertical: 15, borderRadius: 12, alignItems: 'center' },
  saveButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  saveButtonDisabled: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#fef3c7', paddingVertical: 15, borderRadius: 12, borderWidth: 1.5, borderColor: '#f59e0b' },
  saveButtonDisabledText: { color: '#92400e', fontSize: 16, fontWeight: '600' },

  // Styles สำหรับ Modal ต่างๆ
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '85%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: '#EEE' },
  modalTitle: { fontSize: 18, fontWeight: '600' },
  modalBody: { padding: 20 },
  dayRow: { marginBottom: 15, paddingBottom: 15, borderBottomWidth: 1, borderBottomColor: '#F9F9F9' },
  dayHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  dayToggle: { flexDirection: 'row', alignItems: 'center' },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: '#DDD', justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  checkboxActive: { backgroundColor: '#10b981', borderColor: '#10b981' },
  dayLabel: { fontSize: 16, fontWeight: '500' },
  dayLabelInactive: { color: '#CCC' },
  timeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  timeInputBox: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#F2F2F2', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
  timeInputText: { fontSize: 16, color: '#333', flex: 1, padding: 0 },
  dash: { marginHorizontal: 10, color: '#999' },
  closedContainer: { backgroundColor: '#F5F5F5', padding: 10, borderRadius: 8, alignItems: 'center' },
  closedText: { color: '#999', fontSize: 14, fontStyle: 'italic' },
  modalFooter: { padding: 20, borderTopWidth: 1, borderTopColor: '#EEE', paddingBottom: Platform.OS === 'ios' ? 40 : 20 },
  modalDoneButton: { backgroundColor: '#10b981', borderRadius: 12, paddingVertical: 15, alignItems: 'center' },
  modalDoneButtonText: { color: '#FFF', fontWeight: 'bold', fontSize: 16 },

  modalContainer: { flex: 1, backgroundColor: '#FFFFFF' },
  modalBackButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#F5F5F5', justifyContent: 'center', alignItems: 'center' },
  modalConfirmButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#ecfdf5', justifyContent: 'center', alignItems: 'center' },
  map: { flex: 1 },
  instructionOverlay: { position: 'absolute', top: 80, left: 20, right: 20, alignItems: 'center' },
  instructionBox: { backgroundColor: 'rgba(0, 0, 0, 0.75)', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 25 },
  instructionText: { color: '#FFFFFF', fontSize: 14, fontWeight: '500' }
});