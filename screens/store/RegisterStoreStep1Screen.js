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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function RegisterStoreStep1Screen({ navigation, route }) {
  const [storeName, setStoreName] = useState('');
  const [storeOwner, setStoreOwner] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [openTime, setOpenTime] = useState('');
  const [closeTime, setCloseTime] = useState('');
  const [storeDetails, setStoreDetails] = useState('');
  const [selectedDelivery, setSelectedDelivery] = useState(null);

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
        openTime,
        closeTime,
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
        <View style={styles.timeContainer}>
          <View style={styles.timeBox}>
            <Ionicons name="time-outline" size={20} color="#666" />
            <Text style={styles.timeLabel}>เวลาเปิดร้าน</Text>
            <TextInput
              style={styles.timeInput}
              placeholder="--:-- น."
              value={openTime}
              onChangeText={setOpenTime}
            />
          </View>

          <View style={styles.timeBox}>
            <Ionicons name="time-outline" size={20} color="#666" />
            <Text style={styles.timeLabel}>เวลาปิดร้าน</Text>
            <TextInput
              style={styles.timeInput}
              placeholder="--:-- น."
              value={closeTime}
              onChangeText={setCloseTime}
            />
          </View>
        </View>

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
  timeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  timeBox: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 15,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    alignItems: 'center',
  },
  timeLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 5,
    marginBottom: 10,
  },
  timeInput: {
    fontSize: 15,
    color: '#333',
    textAlign: 'center',
    width: '100%',
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
    backgroundColor: '#E0E0E0',
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
  },
  nextButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
});