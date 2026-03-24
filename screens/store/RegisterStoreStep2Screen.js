import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  Alert,
  Modal,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import MapView, { Marker } from 'react-native-maps';
import * as Location from 'expo-location';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width, height } = Dimensions.get('window');

export default function RegisterStoreStep2Screen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const { step1Data } = route.params || {};
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
  const [loading, setLoading] = useState(false);
  const [mapReady, setMapReady] = useState(false);

  useEffect(() => {
    requestLocationPermission();
  }, []);

  const requestLocationPermission = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        getUserLocation();
      }
    } catch (error) {
      console.error('Error requesting location permission:', error);
    }
  };

  const getUserLocation = async () => {
    try {
      const currentLocation = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const { latitude, longitude } = currentLocation.coords;
      setRegion({
        latitude,
        longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      });
    } catch (error) {
      console.log('Could not get current location:', error);
    }
  };

  const handleOpenMap = () => {
    setTempMarker(coordinates);
    setMapModalVisible(true);
  };

  const handleMapPress = (event) => {
    const { coordinate } = event.nativeEvent;
    setTempMarker(coordinate);
  };

  const handleConfirmLocation = async () => {
    if (!tempMarker) {
      Alert.alert('กรุณาปักหมุด', 'กรุณาแตะบนแผนที่เพื่อเลือกตำแหน่งร้านค้า');
      return;
    }

    setLoading(true);
    setCoordinates(tempMarker);

    try {
      const addressResults = await Location.reverseGeocodeAsync({
        latitude: tempMarker.latitude,
        longitude: tempMarker.longitude,
      });

      if (addressResults && addressResults.length > 0) {
        const addr = addressResults[0];
        const fullAddress = [
          addr.name, addr.street, addr.district, addr.subregion,
          addr.city, addr.region, addr.postalCode, addr.country,
        ]
          .filter(Boolean)
          .join(', ');

        setLocation(fullAddress || 'ที่อยู่จากพิกัดที่เลือก');
      } else {
        setLocation(`พิกัด: ${tempMarker.latitude.toFixed(6)}, ${tempMarker.longitude.toFixed(6)}`);
      }

      setAddress(`lat: ${tempMarker.latitude.toFixed(6)}, lng: ${tempMarker.longitude.toFixed(6)}`);
      setMapModalVisible(false);
      setLoading(false);

      Alert.alert(
        'ปักหมุดสำเร็จ! 📍',
        'บันทึกตำแหน่งร้านค้าเรียบร้อยแล้ว\nคุณสามารถแก้ไขที่อยู่ได้หากต้องการ',
        [{ text: 'ตกลง' }]
      );
    } catch (error) {
      console.error('Error getting address:', error);
      setLocation(`พิกัด: ${tempMarker.latitude.toFixed(6)}, ${tempMarker.longitude.toFixed(6)}`);
      setAddress(`lat: ${tempMarker.latitude.toFixed(6)}, lng: ${tempMarker.longitude.toFixed(6)}`);
      setMapModalVisible(false);
      setLoading(false);
    }
  };

  const handleCancelMap = () => {
    setTempMarker(coordinates);
    setMapModalVisible(false);
  };

  const handleUseCurrentLocation = async () => {
    setLoading(true);
    try {
      const { status } = await Location.getForegroundPermissionsAsync();

      if (status !== 'granted') {
        Alert.alert(
          'ต้องการสิทธิ์',
          'กรุณาอนุญาตให้เข้าถึงตำแหน่งเพื่อใช้ตำแหน่งปัจจุบัน',
          [
            { text: 'ยกเลิก', style: 'cancel' },
            {
              text: 'อนุญาต',
              onPress: async () => {
                await Location.requestForegroundPermissionsAsync();
              }
            }
          ]
        );
        setLoading(false);
        return;
      }

      const currentLocation = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      const { latitude, longitude } = currentLocation.coords;
      const newMarker = { latitude, longitude };

      setTempMarker(newMarker);
      setRegion({
        latitude,
        longitude,
        latitudeDelta: 0.005,
        longitudeDelta: 0.005,
      });

      setLoading(false);
    } catch (error) {
      console.error('Error getting current location:', error);
      setLoading(false);
      Alert.alert(
        'เกิดข้อผิดพลาด',
        'ไม่สามารถดึงตำแหน่งปัจจุบันได้\nกรุณาตรวจสอบว่าเปิด GPS',
        [{ text: 'ตกลง' }]
      );
    }
  };

  const handleBack = () => {
    navigation.goBack();
  };

  const handleNext = () => {
    if (!location.trim()) {
      Alert.alert('กรุณากรอกข้อมูล', 'กรุณากรอกที่อยู่ร้าน หรือปักหมุดตำแหน่งบนแผนที่');
      return;
    }

    if (!coordinates) {
      Alert.alert('กรุณาปักหมุด', 'กรุณาปักหมุดตำแหน่งร้านค้าบนแผนที่');
      return;
    }

    navigation.navigate('RegisterStoreStep3', {
      step1Data,
      step2Data: {
        location,
        address,
        coordinates,
      }
    });
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      <View style={[styles.header, { paddingTop: insets.top + 15 }]}>
        <TouchableOpacity style={styles.backButton} onPress={handleBack}>
          <Ionicons name="chevron-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>สมัครเป็นร้านค้า</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.progressContainer}>
        <View style={styles.stepContainer}>
          <View style={[styles.stepCircle, styles.stepActive]}>
            <Text style={styles.stepTextActive}>1</Text>
          </View>
          <Text style={styles.stepLabel}>ข้อมูลร้านค้า</Text>
        </View>

        <View style={[styles.progressLine, styles.progressLineActive]} />

        <View style={styles.stepContainer}>
          <View style={[styles.stepCircle, styles.stepActive]}>
            <Text style={styles.stepTextActive}>2</Text>
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

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <Text style={styles.sectionTitle}>ตำแหน่งที่ตั้ง</Text>

        <Text style={styles.label}>ชื่อยู่ร้าน</Text>
        <TextInput
          style={styles.input}
          placeholder="เลขที่ ถนน ตำบล อำเภอ จังหวัด..."
          value={location}
          onChangeText={setLocation}
          multiline
          numberOfLines={3}
          textAlignVertical="top"
          placeholderTextColor="#999"
        />

        <View style={styles.mapContainer}>
          <View style={styles.mapIconContainer}>
            <Ionicons
              name={coordinates ? "location" : "location-outline"}
              size={48}
              color={coordinates ? "#4CAF50" : "#999"}
            />
            {coordinates && (
              <View style={styles.checkMark}>
                <Ionicons name="checkmark-circle" size={24} color="#4CAF50" />
              </View>
            )}
          </View>

          <Text style={styles.mapTitle}>ปักหมุดตำแหน่ง</Text>

          {coordinates && (
            <Text style={styles.coordsText}>
              📍 พิกัด: {coordinates.latitude.toFixed(4)}, {coordinates.longitude.toFixed(4)}
            </Text>
          )}

          <TouchableOpacity
            style={styles.mapButton}
            onPress={handleOpenMap}
            activeOpacity={0.7}
          >
            <Text style={styles.mapButtonText}>
              {coordinates ? 'เปิดแผนที่อีกครั้ง' : 'เปิดแผนที่'}
            </Text>
          </TouchableOpacity>

          {!coordinates && (
            <Text style={styles.hintText}>
              กดปุ่มเพื่อเปิดแผนที่และเลือกตำแหน่งร้านค้า
            </Text>
          )}
        </View>

        <View style={styles.infoContainer}>
          <Ionicons name="information-circle-outline" size={18} color="#2196F3" />
          <Text style={styles.infoText}>
            {' '}คุณสามารถปักหมุดตำแหน่งร้านค้าบนแผนที่ได้ หรือกรอกที่อยู่ด้วยตนเอง
          </Text>
        </View>

        <View style={styles.spacer} />
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom > 0 ? insets.bottom : 15 }]}>
        <TouchableOpacity
          style={styles.backFooterButton}
          onPress={handleBack}
          activeOpacity={0.8}
        >
          <Text style={styles.backFooterButtonText}>ย้อนกลับ</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.nextButton}
          onPress={handleNext}
          activeOpacity={0.8}
        >
          <Text style={styles.nextButtonText}>ถัดไป</Text>
        </TouchableOpacity>
      </View>

      <Modal
        animationType="slide"
        transparent={false}
        visible={mapModalVisible}
        onRequestClose={handleCancelMap}
      >
        <View style={styles.modalContainer}>
          <StatusBar barStyle="dark-content" />

          <View style={[styles.modalHeader, { paddingTop: insets.top + 15 }]}>
            <TouchableOpacity style={styles.modalBackButton} onPress={handleCancelMap}>
              <Ionicons name="close" size={28} color="#333" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>เลือกตำแหน่งร้านค้า</Text>
            <TouchableOpacity
              style={styles.modalConfirmButton}
              onPress={handleConfirmLocation}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#4CAF50" />
              ) : (
                <Ionicons name="checkmark" size={28} color="#4CAF50" />
              )}
            </TouchableOpacity>
          </View>

          <MapView
            style={styles.map}
            region={region}
            onRegionChangeComplete={setRegion}
            onPress={handleMapPress}
            onMapReady={() => setMapReady(true)}
            showsUserLocation
            showsMyLocationButton={false}
            showsCompass
            toolbarEnabled={false}
          >
            {tempMarker && (
              <Marker
                coordinate={tempMarker}
                draggable
                onDragEnd={(e) => setTempMarker(e.nativeEvent.coordinate)}
              >
                <View style={styles.markerContainer}>
                  <Ionicons name="location" size={40} color="#FF5252" />
                </View>
              </Marker>
            )}
          </MapView>

          <View style={styles.instructionOverlay}>
            <View style={styles.instructionBox}>
              <Ionicons name="hand-left-outline" size={20} color="#FFF" />
              <Text style={styles.instructionText}>
                แตะบนแผนที่เพื่อปักหมุดตำแหน่ง
              </Text>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.currentLocationButton, { bottom: insets.bottom + (tempMarker ? 140 : 40) }]}
            onPress={handleUseCurrentLocation}
            disabled={loading}
          >
            <Ionicons name="locate" size={24} color="#4CAF50" />
          </TouchableOpacity>

          {tempMarker && (
            <View style={[styles.bottomInfo, { paddingBottom: insets.bottom > 0 ? insets.bottom + 10 : 15 }]}>
              <Text style={styles.bottomInfoTitle}>ตำแหน่งที่เลือก:</Text>
              <Text style={styles.bottomInfoCoords}>
                Lat: {tempMarker.latitude.toFixed(6)}, Lng: {tempMarker.longitude.toFixed(6)}
              </Text>
              <Text style={styles.bottomInfoHint}>
                ลากหมุดเพื่อปรับตำแหน่ง หรือแตะบนแผนที่ใหม่
              </Text>
            </View>
          )}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 15, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#E0E0E0' },
  backButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#F0F0F0', justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '600', color: '#333' },
  progressContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 30, paddingVertical: 20, backgroundColor: '#FFFFFF' },
  stepContainer: { alignItems: 'center' },
  stepCircle: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#E0E0E0', justifyContent: 'center', alignItems: 'center', marginBottom: 5 },
  stepActive: { backgroundColor: '#4CAF50' },
  stepText: { fontSize: 16, fontWeight: '600', color: '#999' },
  stepTextActive: { fontSize: 16, fontWeight: '600', color: '#FFFFFF' },
  stepLabel: { fontSize: 12, color: '#666', marginTop: 5 },
  progressLine: { flex: 1, height: 2, backgroundColor: '#E0E0E0', marginHorizontal: 10, marginBottom: 20 },
  progressLineActive: { backgroundColor: '#4CAF50' },
  content: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 20 },
  sectionTitle: { fontSize: 20, fontWeight: '600', color: '#333', marginTop: 20, marginBottom: 20, textAlign: 'center' },
  label: { fontSize: 14, fontWeight: '500', color: '#333', marginBottom: 8, marginTop: 15 },
  input: { backgroundColor: '#FFFFFF', borderRadius: 12, paddingHorizontal: 15, paddingVertical: 14, fontSize: 15, color: '#333', borderWidth: 1, borderColor: '#E0E0E0', minHeight: 100 },
  mapContainer: { backgroundColor: '#FFFFFF', borderRadius: 12, padding: 30, marginTop: 20, borderWidth: 1, borderColor: '#E0E0E0', alignItems: 'center' },
  mapIconContainer: { position: 'relative' },
  checkMark: { position: 'absolute', bottom: -5, right: -5, backgroundColor: '#FFFFFF', borderRadius: 12 },
  mapTitle: { fontSize: 18, fontWeight: '600', color: '#333', marginTop: 15, marginBottom: 10 },
  coordsText: { fontSize: 12, color: '#4CAF50', marginBottom: 15, fontWeight: '500' },
  mapButton: { backgroundColor: '#FFFFFF', borderRadius: 8, paddingVertical: 12, paddingHorizontal: 40, borderWidth: 1.5, borderColor: '#4CAF50', minWidth: 200, alignItems: 'center' },
  mapButtonText: { fontSize: 15, fontWeight: '600', color: '#4CAF50' },
  hintText: { fontSize: 12, color: '#999', marginTop: 10, textAlign: 'center' },
  infoContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#E3F2FD', borderRadius: 8, padding: 12, marginTop: 15, borderWidth: 1, borderColor: '#BBDEFB' },
  infoText: { flex: 1, fontSize: 13, color: '#1976D2', lineHeight: 18 },
  spacer: { height: 40 },
  footer: { flexDirection: 'row', paddingHorizontal: 20, paddingTop: 15, backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: '#E0E0E0', gap: 10 },
  backFooterButton: { flex: 1, backgroundColor: '#F0F0F0', borderRadius: 12, paddingVertical: 16, alignItems: 'center' },
  backFooterButtonText: { fontSize: 16, fontWeight: '600', color: '#666' },
  nextButton: { flex: 1, backgroundColor: '#E0E0E0', borderRadius: 12, paddingVertical: 16, alignItems: 'center' },
  nextButtonText: { fontSize: 16, fontWeight: '600', color: '#666' },
  modalContainer: { flex: 1, backgroundColor: '#FFFFFF' },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 15, paddingBottom: 15, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#E0E0E0' },
  modalBackButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#F5F5F5', justifyContent: 'center', alignItems: 'center' },
  modalTitle: { fontSize: 18, fontWeight: '600', color: '#333' },
  modalConfirmButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#F1F8F4', justifyContent: 'center', alignItems: 'center' },
  map: { flex: 1 },
  markerContainer: { alignItems: 'center' },
  instructionOverlay: { position: 'absolute', top: 80, left: 20, right: 20, alignItems: 'center' },
  instructionBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0, 0, 0, 0.75)', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 25, gap: 10 },
  instructionText: { color: '#FFFFFF', fontSize: 14, fontWeight: '500' },
  currentLocationButton: { position: 'absolute', right: 20, width: 50, height: 50, borderRadius: 25, backgroundColor: '#FFFFFF', justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 3.84, elevation: 5 },
  bottomInfo: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#FFFFFF', paddingHorizontal: 20, paddingTop: 15, borderTopWidth: 1, borderTopColor: '#E0E0E0' },
  bottomInfoTitle: { fontSize: 14, fontWeight: '600', color: '#333', marginBottom: 5 },
  bottomInfoCoords: { fontSize: 13, color: '#4CAF50', fontWeight: '500', marginBottom: 5 },
  bottomInfoHint: { fontSize: 12, color: '#999' },
});