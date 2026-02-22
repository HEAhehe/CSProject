import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  StatusBar,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function RegisterStoreStep1Screen({ navigation, route }) {
  const [storeName, setStoreName] = useState('');
  const [storeOwner, setStoreOwner] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [storeDetails, setStoreDetails] = useState('');
  const [selectedDelivery, setSelectedDelivery] = useState(null);

  const daysOfWeek = [
    { id: 'mon', label: 'จันทร์' },
    { id: 'tue', label: 'อังคาร' },
    { id: 'wed', label: 'พุธ' },
    { id: 'thu', label: 'พฤหัสบดี' },
    { id: 'fri', label: 'ศุกร์' },
    { id: 'sat', label: 'เสาร์' },
    { id: 'sun', label: 'อาทิตย์' },
  ];

  const [businessHours, setBusinessHours] = useState({
    mon: { isOpen: true, openTime: '', closeTime: '' },
    tue: { isOpen: true, openTime: '', closeTime: '' },
    wed: { isOpen: true, openTime: '', closeTime: '' },
    thu: { isOpen: true, openTime: '', closeTime: '' },
    fri: { isOpen: true, openTime: '', closeTime: '' },
    sat: { isOpen: false, openTime: '', closeTime: '' },
    sun: { isOpen: false, openTime: '', closeTime: '' },
  });

  const [showBusinessHoursModal, setShowBusinessHoursModal] = useState(false);

  // ฟังก์ชันจัดการการกรอกเวลาให้ถูกต้องตามเงื่อนไข (ชั่วโมง 0-23, นาที 0-5)
  const handleTimeInputChange = (dayId, type, text) => {
    // ถ้าลบจนหมด ให้เซ็ตเป็นค่าว่างเพื่อให้ placeholder ทำงาน
    if (text === '') {
      setBusinessHours(prev => ({
        ...prev,
        [dayId]: { ...prev[dayId], [type]: '' }
      }));
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
    if (cleaned.length > 3) {
      validatedText += cleaned[3];
    }

    setBusinessHours(prev => ({
      ...prev,
      [dayId]: { ...prev[dayId], [type]: validatedText }
    }));
  };

  const handleTimeInputBlur = (dayId, type, text) => {
    if (!text) return;

    let [hours, minutes] = text.split(':');

    // เติม 0 ข้างหน้าชั่วโมงถ้ามีหลักเดียว (เช่น "8" -> "08")
    if (hours && hours.length === 1) {
      hours = '0' + hours;
    }

    // จัดการส่วนนาทีให้ครบ 2 หลัก
    if (!minutes) {
      minutes = '00';
    } else if (minutes.length === 1) {
      minutes = minutes + '0';
    }

    const formattedTime = `${hours}:${minutes}`;

    setBusinessHours(prev => ({
      ...prev,
      [dayId]: { ...prev[dayId], [type]: formattedTime }
    }));
  };

  const toggleDayStatus = (dayId) => {
    setBusinessHours(prev => ({
      ...prev,
      [dayId]: { ...prev[dayId], isOpen: !prev[dayId].isOpen }
    }));
  };

  const getBusinessHoursSummary = () => {
    const openDays = daysOfWeek.filter(day => businessHours[day.id].isOpen);
    if (openDays.length === 0) return 'ปิดทำการทุกวัน';
    return `เปิด ${openDays.length} วันต่อสัปดาห์`;
  };

  const handleNext = () => {
    // 1. เช็คข้อมูลทั่วไป
    if (!storeName || !storeOwner || !phoneNumber || !selectedDelivery) {
      alert('กรุณากรอกข้อมูลร้านค้าให้ครบถ้วน');
      return;
    }

    // 2. เช็คเวลาทำการ (เฉพาะวันที่เลือกเปิด)
    const days = Object.keys(businessHours);
    for (let day of days) {
      if (businessHours[day].isOpen) {
        const { openTime, closeTime } = businessHours[day];
        if (!openTime || openTime.length < 5 || !closeTime || closeTime.length < 5) {
          const dayLabel = daysOfWeek.find(d => d.id === day)?.label;
          alert(`กรุณากรอกเวลาเปิด-ปิดของวัน${dayLabel}ให้ครบถ้วน`);
          return;
        }
      }
    }

    // 3. เช็คว่าต้องเปิดอย่างน้อย 1 วัน
    const hasOpenDay = days.some(day => businessHours[day].isOpen);
    if (!hasOpenDay) {
      alert('กรุณาเลือกวันเปิดทำการอย่างน้อย 1 วัน');
      return;
    }

    // ✅ ส่งค่า businessHours ที่เป็น String "HH:mm" ไปได้เลยโดยไม่ต้อง Map ใหม่
    navigation.navigate('RegisterStoreStep2', {
      step1Data: {
        storeName,
        storeOwner,
        phoneNumber,
        businessHours, // ส่งก้อน Object นี้ไปได้เลย
        storeDetails,
        deliveryMethod: selectedDelivery
      }
    });
  };

  const DeliveryOption = ({ icon, title, subtitle, isSelected, onPress }) => (
    <TouchableOpacity style={[styles.deliveryOption, isSelected && styles.deliveryOptionSelected]} onPress={onPress}>
      <Ionicons name={icon} size={32} color={isSelected ? '#4CAF50' : '#666'} />
      <Text style={[styles.deliveryTitle, isSelected && styles.deliveryTitleSelected]}>{title}</Text>
      {subtitle && <Text style={styles.deliverySubtitle}>{subtitle}</Text>}
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>สมัครเป็นร้านค้า</Text>
      </View>

      {/* Progress Indicator */}
      <View style={styles.progressContainer}>
        <View style={styles.stepContainer}>
          <View style={[styles.stepCircle, styles.stepActive]}>
            <Text style={styles.stepTextActive}>1</Text>
          </View>
          <Text style={styles.stepLabel}>ข้อมูลร้านค้า</Text>
        </View>

        <View style={styles.progressLine} />

        <View style={styles.stepContainer}>
          <View style={styles.stepCircle}>
            <Text style={styles.stepText}>2</Text>
          </View>
          <Text style={styles.stepLabel}>ตำแหน่ง</Text>
        </View>

        <View style={styles.progressLine} />

        <View style={styles.stepContainer}>
          <View style={styles.stepCircle}>
            <Text style={styles.stepText}>3</Text>
          </View>
          <Text style={styles.stepLabel}>รูปร้านค้า</Text>
        </View>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.sectionTitle}>ข้อมูลร้านค้า</Text>
        <Text style={styles.label}>ชื่อร้าน</Text>
        <TextInput style={styles.input} placeholder="ชื่อร้านอาหารของคุณ" value={storeName} onChangeText={setStoreName} />
        <Text style={styles.label}>ชื่อเจ้าของร้าน</Text>
        <TextInput style={styles.input} placeholder="คุณ..." value={storeOwner} onChangeText={setStoreOwner} />
        <Text style={styles.label}>เบอร์โทรศัพท์</Text>
        <TextInput style={styles.input} placeholder="0xx-xxx-xxxx" value={phoneNumber} onChangeText={setPhoneNumber} keyboardType="phone-pad" maxLength={10} />

        <Text style={styles.label}>เวลาทำการ</Text>
        <TouchableOpacity style={styles.businessHoursButton} onPress={() => setShowBusinessHoursModal(true)}>
          <View style={styles.businessHoursInfo}>
            <Ionicons name="time-outline" size={20} color="#4CAF50" />
            <Text style={styles.businessHoursText}>{getBusinessHoursSummary()}</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#999" />
        </TouchableOpacity>

        <Text style={styles.label}>คำอธิบายร้านค้า</Text>
        <TextInput style={[styles.input, styles.textArea]} placeholder="บอกเล่าเกี่ยวกับร้านค้าของคุณ..." value={storeDetails} onChangeText={setStoreDetails} multiline numberOfLines={4} textAlignVertical="top" />

        <Text style={styles.label}>ตัวเลือกการจัดส่ง</Text>
        <DeliveryOption icon="storefront-outline" title="รับที่ร้าน" isSelected={selectedDelivery === 'pickup'} onPress={() => setSelectedDelivery('pickup')} />
        <DeliveryOption icon="bicycle-outline" title="เดลิเวอรี่" isSelected={selectedDelivery === 'delivery'} onPress={() => setSelectedDelivery('delivery')} />
        <DeliveryOption icon="checkmark-circle-outline" title="ทั้งสองแบบ" isSelected={selectedDelivery === 'both'} onPress={() => setSelectedDelivery('both')} />
        <View style={styles.spacer} />
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.nextButton} onPress={handleNext}>
          <Text style={styles.nextButtonText}>ถัดไป</Text>
        </TouchableOpacity>
      </View>

      {/* Modal เวลาทำการที่นำปุ่มก๊อปปี้ออกแล้ว */}
      <Modal visible={showBusinessHoursModal} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>กำหนดเวลาทำการ</Text>
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
                    <View style={styles.grabStyleTimeRow}>
                      <View style={styles.timeInputBox}>
                        <TextInput
                          style={styles.timeInputText}
                          value={businessHours[day.id].openTime}
                          onChangeText={(text) => handleTimeInputChange(day.id, 'openTime', text)}
                          onBlur={(e) => handleTimeInputBlur(day.id, 'openTime', e.nativeEvent.text)}
                          keyboardType="number-pad"
                          maxLength={5}
                          placeholder="--:--"
                        />
                        <Ionicons name="time-outline" size={16} color="#999" />
                      </View>
                      <Text style={styles.dash}>—</Text>
                      <View style={styles.timeInputBox}>
                        <TextInput
                          style={styles.timeInputText}
                          value={businessHours[day.id].closeTime}
                          onChangeText={(text) => handleTimeInputChange(day.id, 'closeTime', text)}
                          onBlur={(e) => handleTimeInputBlur(day.id, 'closeTime', e.nativeEvent.text)}
                          keyboardType="number-pad"
                          maxLength={5}
                          placeholder="--:--"
                        />
                        <Ionicons name="time-outline" size={16} color="#999" />
                      </View>
                    </View>
                  ) : (
                    <View style={styles.closedContainer}>
                      <Text style={styles.closedText}>ปิดทำการ</Text>
                    </View>
                  )}
                </View>
              ))}
            </ScrollView>
            <View style={styles.modalFooter}>
              <TouchableOpacity style={styles.modalDoneButton} onPress={() => setShowBusinessHoursModal(false)}>
                <Text style={styles.modalDoneButtonText}>เสร็จสิ้น</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 15, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#E0E0E0' },
  backButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#F0F0F0', justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '600', color: '#333', flex: 1, textAlign: 'center', marginRight: 40 },
  content: { flex: 1, paddingHorizontal: 20 },
  sectionTitle: { fontSize: 20, fontWeight: '600', color: '#333', marginTop: 20, marginBottom: 20, textAlign: 'center' },
  label: { fontSize: 14, fontWeight: '500', color: '#333', marginBottom: 8, marginTop: 15 },
  input: { backgroundColor: '#FFFFFF', borderRadius: 12, paddingHorizontal: 15, paddingVertical: 12, fontSize: 15, color: '#333', borderWidth: 1, borderColor: '#E0E0E0' },
  textArea: { height: 100, paddingTop: 12 },
  businessHoursButton: { backgroundColor: '#FFFFFF', borderRadius: 12, padding: 15, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderColor: '#E0E0E0' },
  businessHoursInfo: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  businessHoursText: { fontSize: 15, color: '#333', fontWeight: '500' },
  deliveryOption: { backgroundColor: '#FFFFFF', borderRadius: 12, padding: 20, marginBottom: 12, borderWidth: 2, borderColor: '#E0E0E0', alignItems: 'center' },
  deliveryOptionSelected: { borderColor: '#4CAF50', backgroundColor: '#F1F8F4' },
  deliveryTitle: { fontSize: 16, fontWeight: '600', color: '#333', marginTop: 10 },
  deliveryTitleSelected: { color: '#4CAF50' },
  deliverySubtitle: { fontSize: 12, color: '#666', marginTop: 5, textAlign: 'center' },
  spacer: { height: 20 },
  footer: { padding: 20, backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: '#E0E0E0' },
  nextButton: { backgroundColor: '#4CAF50', borderRadius: 12, paddingVertical: 15, alignItems: 'center' },
  nextButtonText: { fontSize: 16, fontWeight: '600', color: '#FFFFFF' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '85%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: '#EEE' },
  modalTitle: { fontSize: 18, fontWeight: '600' },
  modalBody: { padding: 20 },
  dayRow: { marginBottom: 15, paddingBottom: 15, borderBottomWidth: 1, borderBottomColor: '#F9F9F9' },
  dayHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  dayToggle: { flexDirection: 'row', alignItems: 'center' },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: '#DDD', justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  checkboxActive: { backgroundColor: '#4CAF50', borderColor: '#4CAF50' },
  dayLabel: { fontSize: 16, fontWeight: '500' },
  dayLabelInactive: { color: '#CCC' },
  grabStyleTimeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  timeInputBox: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#F2F2F2', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
  timeInputText: { fontSize: 16, color: '#333', flex: 1, padding: 0 },
  dash: { marginHorizontal: 10, color: '#999' },
  closedContainer: { backgroundColor: '#F5F5F5', padding: 10, borderRadius: 8, alignItems: 'center' },
  closedText: { color: '#999', fontSize: 14, fontStyle: 'italic' },
  modalFooter: { padding: 20, borderTopWidth: 1, borderTopColor: '#EEE' },
  modalDoneButton: { backgroundColor: '#4CAF50', borderRadius: 12, paddingVertical: 15, alignItems: 'center' },
  modalDoneButtonText: { color: '#FFF', fontWeight: '600' },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 30,
    paddingVertical: 20,
    backgroundColor: '#FFFFFF',
  },
  stepContainer: {
    alignItems: 'center',
  },
  stepCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E0E0E0',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 5,
  },
  stepActive: {
    backgroundColor: '#4CAF50',
  },
  stepText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#999',
  },
  stepTextActive: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  stepLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 5,
  },
  progressLine: {
    flex: 1,
    height: 2,
    backgroundColor: '#E0E0E0',
    marginHorizontal: 10,
    marginBottom: 20,
  },
});