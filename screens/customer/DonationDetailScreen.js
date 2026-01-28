import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { db, auth } from '../firebase.config';
import { collection, addDoc } from 'firebase/firestore';

export default function DonationDetailScreen({ navigation, route }) {
  const { donation } = route.params;
  const [requested, setRequested] = useState(false);

  const handleRequest = async () => {
    Alert.alert(
      'ขอรับอาหารบริจาค',
      `คุณต้องการขอรับ "${donation.name}" หรือไม่?`,
      [
        {
          text: 'ยกเลิก',
          style: 'cancel',
        },
        {
          text: 'ยืนยัน',
          onPress: async () => {
            try {
              const user = auth.currentUser;
              
              await addDoc(collection(db, 'donation_requests'), {
                foodItemId: donation.id,
                donorId: donation.userId,
                recipientId: user.uid,
                status: 'pending',
                createdAt: new Date().toISOString(),
              });

              setRequested(true);
              Alert.alert('สำเร็จ', 'ส่งคำขอรับอาหารแล้ว\nรอผู้บริจาคยืนยัน');
            } catch (error) {
              console.error('Error requesting donation:', error);
              Alert.alert('ข้อผิดพลาด', 'ไม่สามารถส่งคำขอได้');
            }
          },
        },
      ]
    );
  };

  const getDaysLeft = (expiryDate) => {
    if (!expiryDate) return '-';
    
    const today = new Date();
    const expiry = new Date(expiryDate);
    const diffTime = expiry - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) return `หมดอายุแล้ว`;
    if (diffDays === 0) return 'หมดอายุวันนี้';
    if (diffDays === 1) return 'หมดอายุพรุ่งนี้';
    return `เหลืออีก ${diffDays} วัน`;
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      
      {/* Image Header */}
      <View style={styles.imageHeader}>
        {donation.imageUrl ? (
          <Image source={{ uri: donation.imageUrl }} style={styles.headerImage} />
        ) : (
          <View style={styles.headerImagePlaceholder}>
            <Ionicons name="fast-food" size={80} color="#d1d5db" />
          </View>
        )}
        
        {/* Header Overlay */}
        <View style={styles.headerOverlay}>
          <TouchableOpacity
            style={styles.headerBackButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.headerShareButton}>
            <Ionicons name="share-social" size={24} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Heart Badge */}
        <View style={styles.heartBadgeFloat}>
          <Ionicons name="heart" size={24} color="#fff" />
        </View>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Info Section */}
        <View style={styles.infoSection}>
          <Text style={styles.donationName}>{donation.name}</Text>
          <Text style={styles.donationCategory}>{donation.category}</Text>

          {/* Quick Info */}
          <View style={styles.quickInfoRow}>
            <View style={styles.quickInfoItem}>
              <Ionicons name="cube" size={20} color="#10b981" />
              <Text style={styles.quickInfoText}>x{donation.quantity}</Text>
            </View>
            
            <View style={styles.quickInfoDivider} />
            
            <View style={styles.quickInfoItem}>
              <Ionicons name="time" size={20} color="#f59e0b" />
              <Text style={styles.quickInfoText}>{getDaysLeft(donation.expiryDate)}</Text>
            </View>
            
            <View style={styles.quickInfoDivider} />
            
            <View style={styles.quickInfoItem}>
              <Ionicons name="location" size={20} color="#3b82f6" />
              <Text style={styles.quickInfoText}>2.5 km</Text>
            </View>
          </View>

          {/* Expiry Date Card */}
          <View style={styles.expiryCard}>
            <Ionicons name="calendar" size={20} color="#f59e0b" />
            <View style={styles.expiryContent}>
              <Text style={styles.expiryLabel}>วันหมดอายุ</Text>
              <Text style={styles.expiryDate}>
                {new Date(donation.expiryDate).toLocaleDateString('th-TH', {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })}
              </Text>
            </View>
          </View>

          {/* Donor Info */}
          <View style={styles.donorSection}>
            <Text style={styles.sectionTitle}>ผู้บริจาค</Text>
            <View style={styles.donorCard}>
              <View style={styles.donorAvatar}>
                <Ionicons name="person" size={30} color="#10b981" />
              </View>
              <View style={styles.donorInfo}>
                <Text style={styles.donorName}>ผู้บริจาค</Text>
                <View style={styles.ratingRow}>
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Ionicons key={star} name="star" size={14} color="#f59e0b" />
                  ))}
                  <Text style={styles.ratingText}>5.0</Text>
                </View>
              </View>
              <TouchableOpacity style={styles.chatButton}>
                <Ionicons name="chatbubble-outline" size={20} color="#10b981" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Pickup Location */}
          <View style={styles.locationSection}>
            <Text style={styles.sectionTitle}>สถานที่รับ</Text>
            <View style={styles.mapCard}>
              <View style={styles.mapPlaceholder}>
                <Ionicons name="map" size={40} color="#9ca3af" />
                <Text style={styles.mapText}>แผนที่</Text>
              </View>
              <View style={styles.addressInfo}>
                <Ionicons name="location" size={18} color="#3b82f6" />
                <View style={styles.addressContent}>
                  <Text style={styles.addressText}>
                    กรุงเทพมหานคร{'\n'}
                    ระยะทาง 2.5 กิโลเมตร
                  </Text>
                </View>
                <TouchableOpacity style={styles.directionButton}>
                  <Ionicons name="navigate" size={18} color="#3b82f6" />
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* Tips */}
          <View style={styles.tipSection}>
            <View style={styles.tipHeader}>
              <Ionicons name="information-circle" size={20} color="#10b981" />
              <Text style={styles.tipTitle}>ข้อควรทราบ</Text>
            </View>
            <Text style={styles.tipText}>
              • ตรวจสอบวันหมดอายุก่อนรับอาหาร{'\n'}
              • นัดหมายเวลารับล่วงหน้ากับผู้บริจาค{'\n'}
              • นำภาชนะมารองรับอาหาร
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Request Button */}
      <View style={styles.actionFooter}>
        {requested ? (
          <View style={styles.requestedBanner}>
            <Ionicons name="checkmark-circle" size={24} color="#10b981" />
            <Text style={styles.requestedText}>ส่งคำขอแล้ว</Text>
          </View>
        ) : (
          <TouchableOpacity
            style={styles.requestButton}
            onPress={handleRequest}
          >
            <Ionicons name="hand-left" size={22} color="#fff" />
            <Text style={styles.requestButtonText}>ขอรับอาหาร</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  imageHeader: {
    height: 300,
    position: 'relative',
  },
  headerImage: {
    width: '100%',
    height: '100%',
  },
  headerImagePlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 50,
  },
  headerBackButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerShareButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heartBadgeFloat: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#ef4444',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#ef4444',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  content: {
    flex: 1,
  },
  infoSection: {
    backgroundColor: '#fff',
    padding: 20,
    borderTopLeftRadius: 25,
    borderTopRightRadius: 25,
    marginTop: -25,
  },
  donationName: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 5,
  },
  donationCategory: {
    fontSize: 16,
    color: '#9ca3af',
    marginBottom: 20,
  },
  quickInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
    padding: 15,
    borderRadius: 12,
    marginBottom: 20,
  },
  quickInfoItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickInfoText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
    marginLeft: 6,
  },
  quickInfoDivider: {
    width: 1,
    height: 30,
    backgroundColor: '#e5e7eb',
  },
  expiryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef3c7',
    padding: 15,
    borderRadius: 12,
    marginBottom: 20,
  },
  expiryContent: {
    flex: 1,
    marginLeft: 12,
  },
  expiryLabel: {
    fontSize: 12,
    color: '#92400e',
    marginBottom: 2,
  },
  expiryDate: {
    fontSize: 15,
    fontWeight: '600',
    color: '#78350f',
  },
  donorSection: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 12,
  },
  donorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
    padding: 15,
    borderRadius: 12,
  },
  donorAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#f0fdf4',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  donorInfo: {
    flex: 1,
  },
  donorName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 4,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ratingText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1f2937',
    marginLeft: 6,
  },
  chatButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#f0fdf4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  locationSection: {
    marginBottom: 20,
  },
  mapCard: {
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#f9fafb',
  },
  mapPlaceholder: {
    height: 150,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapText: {
    fontSize: 14,
    color: '#9ca3af',
    marginTop: 8,
  },
  addressInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
  },
  addressContent: {
    flex: 1,
    marginLeft: 10,
  },
  addressText: {
    fontSize: 14,
    color: '#4b5563',
    lineHeight: 20,
  },
  directionButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tipSection: {
    backgroundColor: '#f0fdf4',
    padding: 15,
    borderRadius: 12,
    marginBottom: 20,
  },
  tipHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  tipTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#065f46',
    marginLeft: 8,
  },
  tipText: {
    fontSize: 13,
    color: '#047857',
    lineHeight: 20,
  },
  actionFooter: {
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  requestButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#10b981',
    paddingVertical: 16,
    borderRadius: 12,
    shadowColor: '#10b981',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  requestButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#fff',
    marginLeft: 10,
  },
  requestedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f0fdf4',
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#10b981',
  },
  requestedText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#10b981',
    marginLeft: 10,
  },
});
