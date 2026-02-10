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
  Platform,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function RegisterStoreStep1Screen({ navigation, route }) {
  const [storeName, setStoreName] = useState('');
  const [storeOwner, setStoreOwner] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [storeDetails, setStoreDetails] = useState('');
  const [selectedDelivery, setSelectedDelivery] = useState(null);

  // เวลาทำการแต่ละวัน
  const daysOfWeek = [
    { id: 'mon', label: 'จันทร์', shortLabel: 'จ.' },
    { id: 'tue', label: 'อังคาร', shortLabel: 'อ.' },
    { id: 'wed', label: 'พุธ', shortLabel: 'พ.' },
    { id: 'thu', label: 'พฤหัสบดี', shortLabel: 'พฤ.' },
    { id: 'fri', label: 'ศุกร์', shortLabel: 'ศ.' },
    { id: 'sat', label: 'เสาร์', shortLabel: 'ส.' },
    { id: 'sun', label: 'อาทิตย์', shortLabel: 'อา.' },
  ];

  const [businessHours, setBusinessHours] = useState({
    mon: { isOpen: true, openTime: null, closeTime: null },
    tue: { isOpen: true, openTime: null, closeTime: null },
    wed: { isOpen: true, openTime: null, closeTime: null },
    thu: { isOpen: true, openTime: null, closeTime: null },
    fri: { isOpen: true, openTime: null, closeTime: null },
    sat: { isOpen: false, openTime: null, closeTime: null },
    sun: { isOpen: false, openTime: null, closeTime: null },
  });

  const [showTimePicker, setShowTimePicker] = useState({ visible: false, day: null, type: null });
  const [showBusinessHoursModal, setShowBusinessHoursModal] = useState(false);
  const [showCopyMenu, setShowCopyMenu] = useState({ visible: false, dayId: null });
  const [editingTime, setEditingTime] = useState({ day: null, type: null, value: '' });

  const formatTime = (date) => {
    if (!date) return '';
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  };

  const parseTimeString = (timeStr) => {
    // รองรับรูปแบบ: 0930, 09:30, 9:30
    const cleaned = timeStr.replace(/[^0-9]/g, '');
    
    if (cleaned.length === 4) {
      const hours = parseInt(cleaned.substring(0, 2));
      const minutes = parseInt(cleaned.substring(2, 4));
      
      if (hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59) {
        const date = new Date(2000, 0, 1, hours, minutes);
        return date;
      }
    } else if (cleaned.length === 3) {
      const hours = parseInt(cleaned.substring(0, 1));
      const minutes = parseInt(cleaned.substring(1, 3));
      
      if (hours >= 0 && hours <= 9 && minutes >= 0 && minutes <= 59) {
        const date = new Date(2000, 0, 1, hours, minutes);
        return date;
      }
    }
    
    return null;
  };

  const handleTimeInputChange = (dayId, type, text) => {
    setEditingTime({ day: dayId, type: type, value: text });
  };

  const handleTimeInputBlur = (dayId, type, text) => {
    const parsedTime = parseTimeString(text);
    
    if (parsedTime) {
      setBusinessHours(prev => ({
        ...prev,
        [dayId]: {
          ...prev[dayId],
          [type]: parsedTime
        }
      }));
    }
    
    setEditingTime({ day: null, type: null, value: '' });
  };

  const formatTimeInput = (text) => {
    // ลบตัวอักษรที่ไม่ใช่ตัวเลข
    let cleaned = text.replace(/[^0-9]/g, '');
    
    // จำกัดความยาว
    if (cleaned.length > 4) {
      cleaned = cleaned.substring(0, 4);
    }
    
    // ใส่ : อัตโนมัติ
    if (cleaned.length >= 3) {
      cleaned = cleaned.substring(0, 2) + ':' + cleaned.substring(2);
    }
    
    return cleaned;
  };

  const toggleDayStatus = (dayId) => {
    setBusinessHours(prev => ({
      ...prev,
      [dayId]: {
        ...prev[dayId],
        isOpen: !prev[dayId].isOpen
      }
    }));
  };

  const copyTimeToAllDays = (sourceDayId) => {
    const sourceDay = businessHours[sourceDayId];
    
    // ตรวจสอบว่ามีเวลาหรือไม่
    if (!sourceDay.openTime || !sourceDay.closeTime) {
      alert('กรุณากำหนดเวลาก่อนคัดลอก');
      return;
    }
    
    const updatedHours = {};
    
    Object.keys(businessHours).forEach(dayId => {
      updatedHours[dayId] = {
        ...businessHours[dayId],
        openTime: new Date(sourceDay.openTime),
        closeTime: new Date(sourceDay.closeTime),
      };
    });
    
    setBusinessHours(updatedHours);
  };

  const copyTimeToWeekdays = (sourceDayId) => {
    const sourceDay = businessHours[sourceDayId];
    
    // ตรวจสอบว่ามีเวลาหรือไม่
    if (!sourceDay.openTime || !sourceDay.closeTime) {
      alert('กรุณากำหนดเวลาก่อนคัดลอก');
      return;
    }
    
    const weekdayIds = ['mon', 'tue', 'wed', 'thu', 'fri'];
    const updatedHours = { ...businessHours };
    
    weekdayIds.forEach(dayId => {
      updatedHours[dayId] = {
        ...updatedHours[dayId],
        openTime: new Date(sourceDay.openTime),
        closeTime: new Date(sourceDay.closeTime),
      };
    });
    
    setBusinessHours(updatedHours);
  };

  const copyTimeToWeekends = (sourceDayId) => {
    const sourceDay = businessHours[sourceDayId];
    
    // ตรวจสอบว่ามีเวลาหรือไม่
    if (!sourceDay.openTime || !sourceDay.closeTime) {
      alert('กรุณากำหนดเวลาก่อนคัดลอก');
      return;
    }
    
    const weekendIds = ['sat', 'sun'];
    const updatedHours = { ...businessHours };
    
    weekendIds.forEach(dayId => {
      updatedHours[dayId] = {
        ...updatedHours[dayId],
        openTime: new Date(sourceDay.openTime),
        closeTime: new Date(sourceDay.closeTime),
      };
    });
    
    setBusinessHours(updatedHours);
  };

  const getBusinessHoursSummary = () => {
    const openDays = daysOfWeek.filter(day => businessHours[day.id].isOpen);
    if (openDays.length === 0) return 'ยังไม่ได้กำหนด';
    
    // ตรวจสอบว่ามีวันที่ยังไม่ได้ตั้งเวลา
    const hasUnsetTime = openDays.some(day => 
      !businessHours[day.id].openTime || !businessHours[day.id].closeTime
    );
    
    if (hasUnsetTime) {
      return `${openDays.length} วัน (กรุณากำหนดเวลา)`;
    }
    
    if (openDays.length === 7) {
      // ตรวจสอบว่าเวลาทุกวันเหมือนกันไหม
      const firstDay = openDays[0].id;
      const firstOpen = formatTime(businessHours[firstDay].openTime);
      const firstClose = formatTime(businessHours[firstDay].closeTime);
      
      const allSameTime = openDays.every(day => 
        formatTime(businessHours[day.id].openTime) === firstOpen &&
        formatTime(businessHours[day.id].closeTime) === firstClose
      );
      
      if (allSameTime) {
        return `ทุกวัน ${firstOpen} - ${firstClose}`;
      }
      return 'ทุกวัน (เวลาแตกต่างกัน)';
    }
    
    // แสดงวันแรกและจำนวน
    const firstDay = daysOfWeek.find(d => d.id === openDays[0].id);
    const firstOpen = formatTime(businessHours[openDays[0].id].openTime);
    const firstClose = formatTime(businessHours[openDays[0].id].closeTime);
    
    if (openDays.length === 1) {
      return `${firstDay.label} ${firstOpen} - ${firstClose}`;
    }
    
    return `${openDays.length} วัน (คลิกเพื่อดูรายละเอียด)`;
  };

  const handleNext = () => {
    if (!storeName || !storeOwner || !phoneNumber || !selectedDelivery) {
      alert('กรุณากรอกข้อมูลให้ครบถ้วน');
      return;
    }

    const hasOpenDay = Object.values(businessHours).some(day => day.isOpen);
    if (!hasOpenDay) {
      alert('กรุณาเลือกอย่างน้อย 1 วันที่เปิดทำการ');
      return;
    }

    // ตรวจสอบว่าทุกวันที่เปิดมีการกำหนดเวลาแล้ว
    const openDaysWithoutTime = Object.entries(businessHours)
      .filter(([_, day]) => day.isOpen && (!day.openTime || !day.closeTime))
      .map(([dayId, _]) => daysOfWeek.find(d => d.id === dayId).label);

    if (openDaysWithoutTime.length > 0) {
      alert(`กรุณากำหนดเวลาทำการสำหรับ: ${openDaysWithoutTime.join(', ')}`);
      return;
    }

    // แปลงเวลาเป็น string เพื่อส่งต่อ
    const businessHoursData = {};
    Object.keys(businessHours).forEach(day => {
      businessHoursData[day] = {
        isOpen: businessHours[day].isOpen,
        openTime: businessHours[day].openTime ? businessHours[day].openTime.toISOString() : null,
        closeTime: businessHours[day].closeTime ? businessHours[day].closeTime.toISOString() : null,
      };
    });

    navigation.navigate('RegisterStoreStep2', {
      step1Data: {
        storeName,
        storeOwner,
        phoneNumber,
        businessHours: businessHoursData,
        storeDetails,
        deliveryMethod: selectedDelivery,
      }
    });
  };

  const DeliveryOption = ({ icon, title, subtitle, isSelected, onPress }) => (
    <TouchableOpacity
      style={[styles.deliveryOption, isSelected && styles.deliveryOptionSelected]}
      onPress={onPress}
    >
      <Ionicons 
        name={icon} 
        size={32} 
        color={isSelected ? '#4CAF50' : '#666'} 
      />
      <Text style={[styles.deliveryTitle, isSelected && styles.deliveryTitleSelected]}>
        {title}
      </Text>
      {subtitle && (
        <Text style={styles.deliverySubtitle}>{subtitle}</Text>
      )}
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
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

        {/* Store Name */}
        <Text style={styles.label}>ชื่อร้าน</Text>
        <TextInput
          style={styles.input}
          placeholder="ชื่อร้านอาหารของคุณ"
          value={storeName}
          onChangeText={setStoreName}
        />

        {/* Store Owner */}
        <Text style={styles.label}>ชื่อเจ้าของร้าน</Text>
        <TextInput
          style={styles.input}
          placeholder="คุณ..."
          value={storeOwner}
          onChangeText={setStoreOwner}
        />

        {/* Phone Number */}
        <Text style={styles.label}>เบอร์โทรศัพท์ (สำหรับติดต่อลูกค้า)</Text>
        <TextInput
          style={styles.input}
          placeholder="0xx-xxx-xxxx"
          value={phoneNumber}
          onChangeText={setPhoneNumber}
          keyboardType="phone-pad"
          maxLength={10}
        />

        {/* Business Hours */}
        <Text style={styles.label}>เวลาทำการ</Text>
        <TouchableOpacity
          style={styles.businessHoursButton}
          onPress={() => setShowBusinessHoursModal(true)}
        >
          <View style={styles.businessHoursInfo}>
            <Ionicons name="time-outline" size={20} color="#4CAF50" />
            <Text style={styles.businessHoursText}>{getBusinessHoursSummary()}</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#999" />
        </TouchableOpacity>

        {/* Store Details */}
        <Text style={styles.label}>คำอธิบายร้านค้า</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          placeholder="บอกเล่าเกี่ยวกับร้านค้าของคุณ..."
          value={storeDetails}
          onChangeText={setStoreDetails}
          multiline
          numberOfLines={4}
          textAlignVertical="top"
        />

        {/* Delivery Options */}
        <Text style={styles.label}>ตัวเลือกการจัดส่ง</Text>
        
        <DeliveryOption
          icon="storefront-outline"
          title="รับที่ร้าน"
          isSelected={selectedDelivery === 'pickup'}
          onPress={() => setSelectedDelivery('pickup')}
        />

        <DeliveryOption
          icon="bicycle-outline"
          title="เดลิเวอรี่"
          subtitle="(กรณีร้านค้าสะดวกจัดส่งลูกค้าเอง)"
          isSelected={selectedDelivery === 'delivery'}
          onPress={() => setSelectedDelivery('delivery')}
        />

        <DeliveryOption
          icon="checkmark-circle-outline"
          title="ทั้งสองแบบ"
          isSelected={selectedDelivery === 'both'}
          onPress={() => setSelectedDelivery('both')}
        />

        <View style={styles.spacer} />
      </ScrollView>

      {/* Next Button */}
      <View style={styles.footer}>
        <TouchableOpacity 
          style={styles.nextButton}
          onPress={handleNext}
        >
          <Text style={styles.nextButtonText}>ถัดไป</Text>
        </TouchableOpacity>
      </View>

      {/* Business Hours Modal */}
      <Modal
        visible={showBusinessHoursModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowBusinessHoursModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>กำหนดเวลาทำการ</Text>
              <TouchableOpacity onPress={() => setShowBusinessHoursModal(false)}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              {daysOfWeek.map((day) => (
                <View key={day.id} style={styles.dayRow}>
                  <View style={styles.dayHeader}>
                    <TouchableOpacity
                      style={styles.dayToggle}
                      onPress={() => toggleDayStatus(day.id)}
                    >
                      <View style={[
                        styles.checkbox,
                        businessHours[day.id].isOpen && styles.checkboxActive
                      ]}>
                        {businessHours[day.id].isOpen && (
                          <Ionicons name="checkmark" size={16} color="#FFF" />
                        )}
                      </View>
                      <Text style={[
                        styles.dayLabel,
                        !businessHours[day.id].isOpen && styles.dayLabelInactive
                      ]}>
                        {day.label}
                      </Text>
                    </TouchableOpacity>
                    
                    {!businessHours[day.id].isOpen ? (
                      <Text style={styles.closedLabel}>หยุด</Text>
                    ) : (
                      <TouchableOpacity
                        style={styles.copyButton}
                        onPress={() => setShowCopyMenu({ visible: true, dayId: day.id })}
                      >
                        <Ionicons name="copy-outline" size={18} color="#4CAF50" />
                      </TouchableOpacity>
                    )}
                  </View>

                  {businessHours[day.id].isOpen && (
                    <View style={styles.timeSelectors}>
                      <View style={[
                        styles.timeInputContainer,
                        !businessHours[day.id].openTime && styles.timeInputContainerEmpty
                      ]}>
                        <Text style={styles.timeLabel}>เปิด</Text>
                        <TextInput
                          style={[
                            styles.timeInput,
                            !businessHours[day.id].openTime && styles.timeInputEmpty
                          ]}
                          value={
                            editingTime.day === day.id && editingTime.type === 'openTime'
                              ? editingTime.value
                              : formatTime(businessHours[day.id].openTime)
                          }
                          onChangeText={(text) => handleTimeInputChange(day.id, 'openTime', formatTimeInput(text))}
                          onBlur={(e) => handleTimeInputBlur(day.id, 'openTime', e.nativeEvent.text)}
                          placeholder="00:00"
                          placeholderTextColor="#FF9800"
                          keyboardType="number-pad"
                          maxLength={5}
                        />
                      </View>

                      <Text style={styles.timeSeparator}>-</Text>

                      <View style={[
                        styles.timeInputContainer,
                        !businessHours[day.id].closeTime && styles.timeInputContainerEmpty
                      ]}>
                        <Text style={styles.timeLabel}>ปิด</Text>
                        <TextInput
                          style={[
                            styles.timeInput,
                            !businessHours[day.id].closeTime && styles.timeInputEmpty
                          ]}
                          value={
                            editingTime.day === day.id && editingTime.type === 'closeTime'
                              ? editingTime.value
                              : formatTime(businessHours[day.id].closeTime)
                          }
                          onChangeText={(text) => handleTimeInputChange(day.id, 'closeTime', formatTimeInput(text))}
                          onBlur={(e) => handleTimeInputBlur(day.id, 'closeTime', e.nativeEvent.text)}
                          placeholder="00:00"
                          placeholderTextColor="#FF9800"
                          keyboardType="number-pad"
                          maxLength={5}
                        />
                      </View>
                    </View>
                  )}
                </View>
              ))}
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.modalDoneButton}
                onPress={() => setShowBusinessHoursModal(false)}
              >
                <Text style={styles.modalDoneButtonText}>เสร็จสิ้น</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Copy Time Menu Modal */}
      <Modal
        visible={showCopyMenu.visible}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setShowCopyMenu({ visible: false, dayId: null })}
      >
        <TouchableOpacity 
          style={styles.copyMenuOverlay}
          activeOpacity={1}
          onPress={() => setShowCopyMenu({ visible: false, dayId: null })}
        >
          <View style={styles.copyMenuContainer}>
            <Text style={styles.copyMenuTitle}>คัดลอกเวลานี้ไปยัง</Text>
            
            <TouchableOpacity
              style={styles.copyMenuItem}
              onPress={() => {
                copyTimeToAllDays(showCopyMenu.dayId);
                setShowCopyMenu({ visible: false, dayId: null });
              }}
            >
              <Ionicons name="calendar-outline" size={20} color="#333" />
              <Text style={styles.copyMenuText}>ทุกวัน</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.copyMenuItem}
              onPress={() => {
                copyTimeToWeekdays(showCopyMenu.dayId);
                setShowCopyMenu({ visible: false, dayId: null });
              }}
            >
              <Ionicons name="briefcase-outline" size={20} color="#333" />
              <Text style={styles.copyMenuText}>วันจันทร์-ศุกร์</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.copyMenuItem}
              onPress={() => {
                copyTimeToWeekends(showCopyMenu.dayId);
                setShowCopyMenu({ visible: false, dayId: null });
              }}
            >
              <Ionicons name="sunny-outline" size={20} color="#333" />
              <Text style={styles.copyMenuText}>วันเสาร์-อาทิตย์</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.copyMenuItem, styles.copyMenuCancel]}
              onPress={() => setShowCopyMenu({ visible: false, dayId: null })}
            >
              <Text style={styles.copyMenuCancelText}>ยกเลิก</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F0F0F0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    flex: 1,
    textAlign: 'center',
    marginRight: 40,
  },
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
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    marginTop: 20,
    marginBottom: 20,
    textAlign: 'center',
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    marginBottom: 8,
    marginTop: 15,
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 15,
    paddingVertical: 12,
    fontSize: 15,
    color: '#333',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  textArea: {
    height: 100,
    paddingTop: 12,
  },
  businessHoursButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 15,
    paddingVertical: 15,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  businessHoursInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  businessHoursText: {
    fontSize: 15,
    color: '#333',
    fontWeight: '500',
  },
  deliveryOption: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: '#E0E0E0',
    alignItems: 'center',
  },
  deliveryOptionSelected: {
    borderColor: '#4CAF50',
    backgroundColor: '#F1F8F4',
  },
  deliveryTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginTop: 10,
  },
  deliveryTitleSelected: {
    color: '#4CAF50',
  },
  deliverySubtitle: {
    fontSize: 12,
    color: '#666',
    marginTop: 5,
    textAlign: 'center',
  },
  spacer: {
    height: 20,
  },
  footer: {
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  nextButton: {
    backgroundColor: '#4CAF50',
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
  },
  nextButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  modalBody: {
    paddingHorizontal: 20,
    paddingVertical: 15,
  },
  dayRow: {
    marginBottom: 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  dayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  dayToggle: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#E0E0E0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  checkboxActive: {
    backgroundColor: '#4CAF50',
    borderColor: '#4CAF50',
  },
  dayLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
  dayLabelInactive: {
    color: '#999',
  },
  closedLabel: {
    fontSize: 14,
    color: '#F44336',
    fontWeight: '500',
  },
  copyButton: {
    padding: 6,
    borderRadius: 6,
    backgroundColor: '#F1F8F4',
  },
  timeSelectors: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    gap: 15,
  },
  timeInputContainer: {
    flex: 1,
    backgroundColor: '#F5F5F5',
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  timeInputContainerEmpty: {
    borderColor: '#FF9800',
    backgroundColor: '#FFF3E0',
  },
  timeLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 5,
  },
  timeInput: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
    width: '100%',
    padding: 0,
  },
  timeInputEmpty: {
    color: '#FF9800',
  },
  timeSeparator: {
    fontSize: 18,
    color: '#999',
    fontWeight: '600',
  },
  modalFooter: {
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  modalDoneButton: {
    backgroundColor: '#4CAF50',
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
  },
  modalDoneButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  // Copy Menu Styles
  copyMenuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  copyMenuContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    width: '100%',
    maxWidth: 320,
    padding: 20,
  },
  copyMenuTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 15,
    textAlign: 'center',
  },
  copyMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    paddingHorizontal: 15,
    borderRadius: 10,
    backgroundColor: '#F5F5F5',
    marginBottom: 10,
    gap: 12,
  },
  copyMenuText: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  copyMenuCancel: {
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    justifyContent: 'center',
    marginTop: 5,
  },
  copyMenuCancelText: {
    fontSize: 16,
    color: '#666',
    fontWeight: '500',
    textAlign: 'center',
  },
});