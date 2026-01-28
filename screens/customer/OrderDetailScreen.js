import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Image,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function OrderDetailScreen({ navigation, route }) {
  const { order } = route.params || {};

  const handleCancelOrder = () => {
    Alert.alert(
      'ยกเลิกการจอง',
      'คุณต้องการยกเลิกการจองนี้หรือไม่?',
      [
        { text: 'ไม่', style: 'cancel' },
        {
          text: 'ยกเลิก',
          style: 'destructive',
          onPress: () => {
            // Cancel order logic
            Alert.alert('สำเร็จ', 'ยกเลิกการจองแล้ว');
            navigation.goBack();
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="chevron-back" size={24} color="#1f2937" />
        </TouchableOpacity>

        <Text style={styles.headerTitle}>จองสำเร็จ!</Text>

        <TouchableOpacity style={styles.favoriteButton}>
          <Ionicons name="heart-outline" size={24} color="#1f2937" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Food Image */}
        <View style={styles.imageSection}>
          <View style={styles.imagePlaceholder}>
            {/* Placeholder for food image */}
          </View>
          <View style={styles.discountBadge}>
            <Ionicons name="flame" size={16} color="#fff" />
            <Text style={styles.discountText}>ลด 50%</Text>
          </View>
        </View>

        {/* Food Info */}
        <View style={styles.infoSection}>
          <Text style={styles.foodName}>คอหมูย่าง</Text>
          
          <View style={styles.priceRow}>
            <Text style={styles.currentPrice}>30 ฿</Text>
            <Text style={styles.originalPrice}>60 ฿</Text>
          </View>

          <View style={styles.storeInfo}>
            <Ionicons name="storefront" size={16} color="#1f2937" />
            <Text style={styles.storeName}>ครัวคุณแม่</Text>
          </View>

          <View style={styles.detailsGrid}>
            <View style={styles.detailItem}>
              <Ionicons name="repeat-outline" size={20} color="#1f2937" />
              <Text style={styles.detailValue}>3/5 ชุด</Text>
            </View>

            <View style={styles.detailItem}>
              <Ionicons name="time-outline" size={20} color="#1f2937" />
              <Text style={styles.detailValue}>20:00 น. (อีก 59 นาที)</Text>
            </View>

            <View style={styles.detailItem}>
              <Ionicons name="location-outline" size={20} color="#1f2937" />
              <Text style={styles.detailValue}>0.8 Km</Text>
            </View>
          </View>
        </View>

        {/* Success Message */}
        <View style={styles.successBanner}>
          <View style={styles.successIcon}>
            <Ionicons name="checkmark" size={32} color="#fff" />
          </View>
          <Text style={styles.successTitle}>จองสำเร็จ!</Text>
          <Text style={styles.successSubtitle}>เตรียมไปรับตามรอบยอดได้เลย</Text>
        </View>

        {/* Order Details */}
        <View style={styles.detailsSection}>
          <Text style={styles.sectionLabel}>รายละเอียด</Text>

          <View style={styles.detailCard}>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Order ID</Text>
              <View style={styles.orderIdContainer}>
                <Text style={styles.orderId}>#A1B2C3</Text>
                <TouchableOpacity>
                  <Ionicons name="copy-outline" size={16} color="#6b7280" />
                </TouchableOpacity>
              </View>
            </View>
          </View>

          <View style={styles.itemDetailCard}>
            <View style={styles.itemRow}>
              <Ionicons name="restaurant-outline" size={20} color="#1f2937" />
              <View style={styles.itemInfo}>
                <Text style={styles.itemName}>คอหมูย่าง</Text>
                <Text style={styles.itemQuantity}>จำนวน 2 ชุด</Text>
              </View>
            </View>
          </View>

          <View style={styles.detailCard}>
            <View style={styles.detailRow}>
              <Ionicons name="cash-outline" size={20} color="#1f2937" />
              <View style={styles.priceInfo}>
                <Text style={styles.priceLabel}>ยอดชำระ : 30฿</Text>
                <Text style={styles.priceNote}>ชำระด้วยเงินสด</Text>
              </View>
            </View>
          </View>

          <View style={styles.detailCard}>
            <View style={styles.detailRow}>
              <Ionicons name="storefront-outline" size={20} color="#1f2937" />
              <View style={styles.storeDetail}>
                <Text style={styles.storeDetailName}>ครัวคุณแม่</Text>
                <Text style={styles.storeDetailAddress}>123 XXX XXX XXX</Text>
              </View>
            </View>
          </View>

          <View style={styles.detailCard}>
            <View style={styles.detailRow}>
              <Ionicons name="time-outline" size={20} color="#1f2937" />
              <View>
                <Text style={styles.timeLabel}>วันรับสินค้า</Text>
                <Text style={styles.timeValue}>18:00 - 19.00 น.</Text>
              </View>
            </View>
          </View>

          {/* Info Banner */}
          <View style={styles.infoBanner}>
            <Ionicons name="information-circle-outline" size={20} color="#1e40af" />
            <Text style={styles.infoText}>
              นำ Order ID ที่ได้แสดงเพื่อเรียน เพื่อยกเหลือการซื้อหายคิดบรรค
            </Text>
          </View>
        </View>

        {/* Map Section */}
        <View style={styles.mapSection}>
          <Text style={styles.sectionLabel}>ที่อยู่ร้าน</Text>
          
          <View style={styles.mapContainer}>
            <View style={styles.mapPlaceholder}>
              <Ionicons name="location" size={32} color="#1f2937" />
              <Text style={styles.mapLabel}>ครัวคุณแม่</Text>
              <Text style={styles.mapAddress}>123 XXX XXX XXX</Text>
            </View>
          </View>

          <TouchableOpacity style={styles.mapButton}>
            <Ionicons name="navigate-outline" size={20} color="#1f2937" />
            <Text style={styles.mapButtonText}>เปิด Google Maps</Text>
          </TouchableOpacity>
        </View>

        {/* Cancel Button */}
        <TouchableOpacity style={styles.cancelButton} onPress={handleCancelOrder}>
          <Ionicons name="close-circle-outline" size={20} color="#ef4444" />
          <Text style={styles.cancelButtonText}>ขอเขลย</Text>
        </TouchableOpacity>

        {/* Guide Note */}
        <Text style={styles.guideNote}>
          ซ่องเขาบิตที่ที่เสร้นเหลานมดอมออมรกนดังจิสีต
        </Text>

        {/* Social Icons */}
        <View style={styles.socialIcons}>
          <View style={styles.socialIcon}>
            <Ionicons name="logo-facebook" size={20} color="#3b82f6" />
          </View>
          <View style={styles.socialIcon}>
            <Ionicons name="logo-instagram" size={20} color="#ec4899" />
          </View>
        </View>
      </ScrollView>

      {/* Bottom Action */}
      <View style={styles.bottomAction}>
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() => navigation.navigate('Home')}
        >
          <Ionicons name="navigate-outline" size={20} color="#1f2937" />
          <Text style={styles.primaryButtonText}>ดูเส้นทาง</Text>
        </TouchableOpacity>
      </View>

      {/* Bottom Nav */}
      <View style={styles.bottomNav}>
        <TouchableOpacity style={styles.navItem}>
          <Ionicons name="home-outline" size={24} color="#9ca3af" />
          <Text style={styles.navLabel}>หน้าหลัก</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.navItem}>
          <Ionicons name="receipt" size={24} color="#1f2937" />
          <Text style={styles.navLabelActive}>รายการซื้อ</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.navItem}>
          <Ionicons name="notifications-outline" size={24} color="#9ca3af" />
          <Text style={styles.navLabel}>แจ้งเตือน</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.navItem}>
          <Ionicons name="person-outline" size={24} color="#9ca3af" />
          <Text style={styles.navLabel}>โปรไฟล์</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 50,
    paddingBottom: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
  },
  favoriteButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
  },
  imageSection: {
    height: 200,
    backgroundColor: '#f3f4f6',
    position: 'relative',
  },
  imagePlaceholder: {
    width: '100%',
    height: '100%',
  },
  discountBadge: {
    position: 'absolute',
    top: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#ef4444',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  discountText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#fff',
  },
  infoSection: {
    padding: 20,
  },
  foodName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 8,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  currentPrice: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1f2937',
  },
  originalPrice: {
    fontSize: 16,
    color: '#9ca3af',
    textDecorationLine: 'line-through',
  },
  storeInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 16,
  },
  storeName: {
    fontSize: 14,
    color: '#1f2937',
  },
  detailsGrid: {
    gap: 12,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  detailValue: {
    fontSize: 14,
    color: '#1f2937',
  },
  successBanner: {
    alignItems: 'center',
    paddingVertical: 24,
    backgroundColor: '#f9fafb',
  },
  successIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#1f2937',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  successTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 4,
  },
  successSubtitle: {
    fontSize: 13,
    color: '#6b7280',
  },
  detailsSection: {
    padding: 20,
  },
  sectionLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 12,
  },
  detailCard: {
    backgroundColor: '#f9fafb',
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  detailLabel: {
    fontSize: 14,
    color: '#6b7280',
  },
  orderIdContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginLeft: 'auto',
  },
  orderId: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
  },
  itemDetailCard: {
    backgroundColor: '#f9fafb',
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 2,
  },
  itemQuantity: {
    fontSize: 13,
    color: '#6b7280',
  },
  priceInfo: {
    flex: 1,
  },
  priceLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 2,
  },
  priceNote: {
    fontSize: 13,
    color: '#6b7280',
  },
  storeDetail: {
    flex: 1,
  },
  storeDetailName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 2,
  },
  storeDetailAddress: {
    fontSize: 13,
    color: '#6b7280',
  },
  timeLabel: {
    fontSize: 13,
    color: '#6b7280',
    marginBottom: 2,
  },
  timeValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: '#fef3c7',
    padding: 16,
    borderRadius: 8,
    marginTop: 12,
  },
  infoText: {
    flex: 1,
    fontSize: 12,
    color: '#78350f',
    lineHeight: 18,
  },
  mapSection: {
    padding: 20,
  },
  mapContainer: {
    height: 180,
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    marginBottom: 12,
    overflow: 'hidden',
  },
  mapPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
    marginTop: 8,
  },
  mapAddress: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 4,
  },
  mapButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#f9fafb',
    paddingVertical: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  mapButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
  },
  cancelButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 8,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ef4444',
    marginBottom: 12,
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ef4444',
  },
  guideNote: {
    fontSize: 11,
    color: '#9ca3af',
    textAlign: 'center',
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  socialIcons: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 24,
  },
  socialIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f9fafb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomAction: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#f9fafb',
    paddingVertical: 14,
    borderRadius: 8,
  },
  primaryButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1f2937',
  },
  bottomNav: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
  },
  navLabel: {
    fontSize: 11,
    color: '#9ca3af',
    marginTop: 4,
  },
  navLabelActive: {
    fontSize: 11,
    color: '#1f2937',
    fontWeight: '600',
    marginTop: 4,
  },
});
