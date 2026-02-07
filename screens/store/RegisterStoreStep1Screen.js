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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';

export default function RegisterStoreStep1Screen({ navigation, route }) {
  const [storeName, setStoreName] = useState('');
  const [storeOwner, setStoreOwner] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [openDateTime, setOpenDateTime] = useState(new Date());
  const [closeDateTime, setCloseDateTime] = useState(new Date());
  const [showOpenDatePicker, setShowOpenDatePicker] = useState(false);
  const [showOpenTimePicker, setShowOpenTimePicker] = useState(false);
  const [showCloseDatePicker, setShowCloseDatePicker] = useState(false);
  const [showCloseTimePicker, setShowCloseTimePicker] = useState(false);
  const [storeDetails, setStoreDetails] = useState('');
  const [selectedDelivery, setSelectedDelivery] = useState(null);

  const formatDate = (date) => {
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  };

  const formatTime = (date) => {
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes} น.`;
  };

  const formatDateTime = (date) => {
    return `${formatDate(date)} ${formatTime(date)}`;
  };

  const onOpenDateChange = (event, selectedDate) => {
    setShowOpenDatePicker(false);
    if (selectedDate) {
      setOpenDateTime(selectedDate);
    }
  };

  const onOpenTimeChange = (event, selectedTime) => {
    setShowOpenTimePicker(false);
    if (selectedTime) {
      setOpenDateTime(selectedTime);
    }
  };

  const onCloseDateChange = (event, selectedDate) => {
    setShowCloseDatePicker(false);
    if (selectedDate) {
      setCloseDateTime(selectedDate);
    }
  };

  const onCloseTimeChange = (event, selectedTime) => {
    setShowCloseTimePicker(false);
    if (selectedTime) {
      setCloseDateTime(selectedTime);
    }
  };

  const handleNext = () => {
    if (!storeName || !storeOwner || !phoneNumber || !selectedDelivery) {
      alert('กรุณากรอกข้อมูลให้ครบถ้วน');
      return;
    }

    // Pass data to next step
    navigation.navigate('RegisterStoreStep2', {
      step1Data: {
        storeName,
        storeOwner,
        phoneNumber,
        openDateTime: openDateTime.toISOString(),
        closeDateTime: closeDateTime.toISOString(),
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

        {/* Operating Hours */}
        <Text style={styles.label}>เวลาทำการ</Text>
        
        {/* Opening Date & Time */}
        <Text style={styles.subLabel}>เวลาเปิดร้าน</Text>
        <View style={styles.dateTimeContainer}>
          <TouchableOpacity 
            style={styles.dateTimeBox}
            onPress={() => setShowOpenDatePicker(true)}
          >
            <Ionicons name="calendar-outline" size={20} color="#4CAF50" />
            <Text style={styles.dateTimeLabel}>วันที่</Text>
            <Text style={styles.dateTimeDisplay}>{formatDate(openDateTime)}</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.dateTimeBox}
            onPress={() => setShowOpenTimePicker(true)}
          >
            <Ionicons name="time-outline" size={20} color="#4CAF50" />
            <Text style={styles.dateTimeLabel}>เวลา</Text>
            <Text style={styles.dateTimeDisplay}>{formatTime(openDateTime)}</Text>
          </TouchableOpacity>
        </View>

        {/* Closing Date & Time */}
        <Text style={styles.subLabel}>เวลาปิดร้าน</Text>
        <View style={styles.dateTimeContainer}>
          <TouchableOpacity 
            style={styles.dateTimeBox}
            onPress={() => setShowCloseDatePicker(true)}
          >
            <Ionicons name="calendar-outline" size={20} color="#4CAF50" />
            <Text style={styles.dateTimeLabel}>วันที่</Text>
            <Text style={styles.dateTimeDisplay}>{formatDate(closeDateTime)}</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.dateTimeBox}
            onPress={() => setShowCloseTimePicker(true)}
          >
            <Ionicons name="time-outline" size={20} color="#4CAF50" />
            <Text style={styles.dateTimeLabel}>เวลา</Text>
            <Text style={styles.dateTimeDisplay}>{formatTime(closeDateTime)}</Text>
          </TouchableOpacity>
        </View>

        {/* Date and Time Pickers */}
        {showOpenDatePicker && (
          <DateTimePicker
            value={openDateTime}
            mode="date"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={onOpenDateChange}
            minimumDate={new Date()}
          />
        )}

        {showOpenTimePicker && (
          <DateTimePicker
            value={openDateTime}
            mode="time"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={onOpenTimeChange}
            is24Hour={true}
          />
        )}

        {showCloseDatePicker && (
          <DateTimePicker
            value={closeDateTime}
            mode="date"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={onCloseDateChange}
            minimumDate={new Date()}
          />
        )}

        {showCloseTimePicker && (
          <DateTimePicker
            value={closeDateTime}
            mode="time"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={onCloseTimeChange}
            is24Hour={true}
          />
        )}

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
  subLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: '#666',
    marginBottom: 8,
    marginTop: 10,
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
  dateTimeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 10,
  },
  dateTimeBox: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 15,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    alignItems: 'center',
  },
  dateTimeLabel: {
    fontSize: 11,
    color: '#666',
    marginTop: 5,
    marginBottom: 5,
  },
  dateTimeDisplay: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
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
});