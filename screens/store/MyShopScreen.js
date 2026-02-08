import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Image,
  RefreshControl,
  ActivityIndicator,
  Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { auth, db } from '../../firebase.config';
import { collection, getDocs, query, where, deleteDoc, doc, updateDoc, getDoc } from 'firebase/firestore';
import { useFocusEffect } from '@react-navigation/native';

export default function MyShopScreen({ navigation }) {
  const [storeData, setStoreData] = useState(null);
  const [activeListings, setActiveListings] = useState([]);
  const [soldListings, setSoldListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('active');
  const [stats, setStats] = useState({ posted: 0, sold: 0, revenue: 0 });
  const [statusChecked, setStatusChecked] = useState(false);

  useFocusEffect(
    useCallback(() => {
      // ✅ รีเซ็ตทุกอย่างเมื่อเข้าหน้าใหม่
      setStatusChecked(false);
      setStoreData(null);
      setLoading(true);
      checkAuthAndLoadData();
    }, [])
  );

  const checkAuthAndLoadData = async () => {
    try {
      const user = auth.currentUser;
      
      if (!user) {
        Alert.alert(
          'ต้องเข้าสู่ระบบ',
          'กรุณาเข้าสู่ระบบเพื่อดำเนินการต่อ',
          [
            {
              text: 'ตกลง',
              onPress: () => navigation.replace('SignIn')
            }
          ]
        );
        return;
      }

      // ✅ Reload user และ refresh token
      try {
        await user.reload();
        await user.getIdToken(true);
        console.log('✅ Token refreshed successfully');
      } catch (tokenError) {
        console.error('❌ Token refresh error:', tokenError);
        
        if (tokenError.code === 'auth/invalid-credential' || 
            tokenError.code === 'auth/user-token-expired') {
          
          await auth.signOut();
          Alert.alert(
            'เซสชันหมดอายุ',
            'กรุณาเข้าสู่ระบบใหม่อีกครั้ง',
            [
              {
                text: 'ตกลง',
                onPress: () => navigation.replace('SignIn')
              }
            ]
          );
          return;
        }
      }

      await loadStoreData();
      await loadListings();
      
    } catch (error) {
      console.error('Error in checkAuthAndLoadData:', error);
      setLoading(false);
    }
  };

  const loadStoreData = async () => {
    try {
      const user = auth.currentUser;
      if (!user) return;

      console.log('🔍 Loading store data for userId:', user.uid);

      // ✅ ดึงข้อมูลร้านค้าจาก stores collection แบบ real-time (ไม่ cache)
      const storeDocRef = doc(db, 'stores', user.uid);
      const storeDoc = await getDoc(storeDocRef);
      
      if (storeDoc.exists()) {
        const storeInfo = storeDoc.data();
        console.log('📦 Store data loaded:', {
          status: storeInfo.status,
          storeName: storeInfo.storeName
        });
        
        // ✅ ตรวจสอบสถานะล่าสุด
        if (storeInfo.status === 'approved') {
          console.log('✅ Store is APPROVED');
          setStoreData(storeInfo);
          setStatusChecked(true);
          
        } else if (storeInfo.status === 'pending') {
          console.log('⏳ Store is PENDING');
          if (!statusChecked) {
            setStatusChecked(true);
            Alert.alert(
              'รอการอนุมัติ',
              'ร้านค้าของคุณอยู่ระหว่างการตรวจสอบ กรุณารอการอนุมัติจากผู้ดูแลระบบ',
              [
                {
                  text: 'ตกลง',
                  onPress: () => navigation.goBack()
                }
              ]
            );
          }
        } else if (storeInfo.status === 'rejected') {
          console.log('❌ Store is REJECTED');
          if (!statusChecked) {
            setStatusChecked(true);
            Alert.alert(
              'คำขออนุมัติถูกปฏิเสธ',
              storeInfo.rejectReason || 'ร้านค้าของคุณไม่ได้รับการอนุมัติ กรุณาติดต่อผู้ดูแลระบบ',
              [
                {
                  text: 'ตกลง',
                  onPress: () => navigation.goBack()
                }
              ]
            );
          }
        }
      } else {
        console.log('❌ Store document does NOT exist');
        
        // ✅ ตรวจสอบว่ามี approval_request หรือไม่
        const approvalQuery = query(
          collection(db, 'approval_requests'), 
          where('userId', '==', user.uid),
          where('type', '==', 'store_registration')
        );
        const approvalSnapshot = await getDocs(approvalQuery);
        
        if (!approvalSnapshot.empty) {
          // มี request อยู่แล้ว แต่ยังไม่มี store document = กำลังรอสร้าง
          console.log('⏳ Has approval request but no store document yet');
          if (!statusChecked) {
            setStatusChecked(true);
            Alert.alert(
              'รอการอนุมัติ',
              'ร้านค้าของคุณอยู่ระหว่างการตรวจสอบ กรุณารอการอนุมัติจากผู้ดูแลระบบ',
              [
                {
                  text: 'ตกลง',
                  onPress: () => navigation.goBack()
                }
              ]
            );
          }
        } else {
          // ไม่มีทั้ง store document และ approval request = ยังไม่เคยสมัคร
          console.log('📝 No store, no request - needs to register');
          if (!statusChecked) {
            setStatusChecked(true);
            Alert.alert(
              'ยังไม่มีร้านค้า',
              'คุณยังไม่ได้สมัครเป็นร้านค้า ต้องการสมัครหรือไม่?',
              [
                {
                  text: 'ยกเลิก',
                  onPress: () => navigation.goBack(),
                  style: 'cancel'
                },
                {
                  text: 'สมัคร',
                  onPress: () => navigation.navigate('RegisterStoreStep1')
                }
              ]
            );
          }
        }
      }
    } catch (error) {
      console.error('Error loading store data:', error);
      
      if (error.code === 'auth/invalid-credential' || 
          error.code === 'auth/user-token-expired') {
        
        await auth.signOut();
        Alert.alert(
          'เซสชันหมดอายุ',
          'กรุณาเข้าสู่ระบบใหม่อีกครั้ง',
          [
            {
              text: 'ตกลง',
              onPress: () => navigation.replace('SignIn')
            }
          ]
        );
      } else {
        Alert.alert('ข้อผิดพลาด', 'ไม่สามารถโหลดข้อมูลร้านค้าได้');
      }
    }
  };

  const loadListings = async () => {
    try {
      const user = auth.currentUser;
      if (!user) return;

      const q = query(collection(db, 'food_items'), where('userId', '==', user.uid));
      const snapshot = await getDocs(q);
      const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      const active = items.filter(item => item.quantity > 0);
      const sold = items.filter(item => item.quantity === 0);

      setActiveListings(active);
      setSoldListings(sold);

      const totalRevenue = sold.reduce((sum, item) => {
        return sum + (Number(item.discountPrice) || Number(item.price) || 0);
      }, 0);

      setStats({
        posted: active.length,
        sold: sold.length,
        revenue: totalRevenue,
      });
    } catch (error) {
      console.error('Error loading listings:', error);
      
      if (error.code === 'auth/invalid-credential' || 
          error.code === 'auth/user-token-expired') {
        
        await auth.signOut();
        Alert.alert(
          'เซสชันหมดอายุ',
          'กรุณาเข้าสู่ระบบใหม่อีกครั้ง',
          [
            {
              text: 'ตกลง',
              onPress: () => navigation.replace('SignIn')
            }
          ]
        );
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleDeleteListing = async (itemId) => {
    Alert.alert(
      'ลบรายการ',
      'คุณต้องการลบรายการนี้ใช่หรือไม่?',
      [
        { text: 'ยกเลิก', style: 'cancel' },
        {
          text: 'ลบ',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteDoc(doc(db, 'food_items', itemId));
              Alert.alert('สำเร็จ', 'ลบรายการเรียบร้อย');
              loadListings();
            } catch (error) {
              console.error('Error deleting:', error);
              Alert.alert('ผิดพลาด', 'ไม่สามารถลบรายการได้');
            }
          }
        }
      ]
    );
  };

  const handleMarkAsSold = async (itemId) => {
    try {
      await updateDoc(doc(db, 'food_items', itemId), { quantity: 0 });
      Alert.alert('สำเร็จ', 'ทำเครื่องหมายขายแล้ว');
      loadListings();
    } catch (error) {
      console.error('Error marking as sold:', error);
      Alert.alert('ผิดพลาด', 'ไม่สามารถอัปเดตได้');
    }
  };

  const formatExpiryDate = (dateString) => {
    if (!dateString) return 'ไม่ระบุ';
    
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return dateString;
      
      const day = date.getDate().toString().padStart(2, '0');
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const year = date.getFullYear();
      const hours = date.getHours().toString().padStart(2, '0');
      const minutes = date.getMinutes().toString().padStart(2, '0');
      
      return `${day}/${month}/${year} ${hours}:${minutes} น.`;
    } catch (error) {
      return dateString;
    }
  };

  const renderListingCard = (item) => {
    const originalPrice = Number(item.originalPrice) || 0;
    const discountPrice = Number(item.discountPrice) || Number(item.price) || 0;
    const discountPercent = originalPrice > 0 ? Math.round(((originalPrice - discountPrice) / originalPrice) * 100) : 0;

    return (
      <View key={item.id} style={styles.listingCard}>
        <View style={styles.cardContent}>
          <View style={styles.listingImageContainer}>
            {item.imageUrl ? (
              <Image source={{ uri: item.imageUrl }} style={styles.listingImage} />
            ) : (
              <View style={styles.placeholderImage}>
                <Ionicons name="image-outline" size={40} color="#d1d5db" />
              </View>
            )}
          </View>

          <View style={styles.listingInfo}>
            <Text style={styles.listingName} numberOfLines={1}>{item.name}</Text>
            <Text style={styles.listingPrice}>ราคาเต็ม : {originalPrice} ฿</Text>
            <View style={styles.discountRow}>
              <Text style={styles.discountLabel}>ลด {discountPercent}%</Text>
              <Ionicons name="arrow-forward" size={14} color="#6b7280" />
              <Text style={styles.discountedPrice}> {discountPrice} ฿</Text>
            </View>
            <Text style={styles.quantityInfo}>คงเหลือ : {item.quantity}/{item.quantity + (item.soldCount || 0)} {item.unit}</Text>
            <Text style={styles.closedTime}>ปิดขาย : {formatExpiryDate(item.expiryDate)}</Text>
          </View>
        </View>

        <View style={styles.cardButtons}>
          <TouchableOpacity 
            style={styles.editBtn}
            onPress={() => navigation.navigate('CreateListing', { editItem: item })}
          >
            <Text style={styles.editBtnText}>EDIT</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.deleteBtn}
            onPress={() => handleDeleteListing(item.id)}
          >
            <Text style={styles.deleteBtnText}>DELETE</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const handleRefresh = () => {
    console.log('🔄 Manual refresh triggered');
    setRefreshing(true);
    setStatusChecked(false);
    setStoreData(null);
    checkAuthAndLoadData();
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#1f2937" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>MY SHOP</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Greeting */}
      <View style={styles.greetingContainer}>
        <Text style={styles.greetingText}>
          Hello, {storeData?.storeName || storeData?.storeOwner || 'ผู้ใช้'}
        </Text>
      </View>

      {/* Today's Stats */}
      <View style={styles.statsCard}>
        <View style={styles.statsHeader}>
          <Ionicons name="bar-chart-outline" size={20} color="#1f2937" />
          <Text style={styles.statsTitle}>Today's Stats</Text>
        </View>
        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statNumber}>{stats.posted}</Text>
            <Text style={styles.statLabel}>Posted</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statNumber}>{stats.sold}</Text>
            <Text style={styles.statLabel}>Sold</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statNumber}>{stats.revenue} ฿</Text>
            <Text style={styles.statLabel}>Revenue</Text>
          </View>
        </View>
      </View>

      {/* Active Listings Header */}
      <View style={styles.listingsHeader}>
        <Text style={styles.listingsTitle}>Active Listings</Text>
      </View>

      {/* Listings */}
      <ScrollView 
        style={styles.content}
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={handleRefresh}
            colors={['#10b981']}
            tintColor="#10b981"
          />
        }
      >
        {loading ? (
          <ActivityIndicator size="large" color="#10b981" style={{ marginTop: 40 }} />
        ) : (
          <View style={styles.listingsContainer}>
            {activeListings.length > 0 ? (
              activeListings.map(renderListingCard)
            ) : (
              <View style={styles.emptyState}>
                <Ionicons name="basket-outline" size={60} color="#d1d5db" />
                <Text style={styles.emptyStateText}>ยังไม่มีสินค้า</Text>
                <Text style={styles.emptyStateSubtext}>กดปุ่ม + NEW POST เพื่อเพิ่มสินค้า</Text>
              </View>
            )}
          </View>
        )}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* NEW POST Button - แสดงเฉพาะเมื่อ approved */}
      {storeData?.status === 'approved' && (
        <TouchableOpacity 
          style={styles.newPostButton}
          onPress={() => navigation.navigate('CreateListing')}
        >
          <Ionicons name="add" size={24} color="#1f2937" />
          <Text style={styles.newPostButtonText}>NEW POST</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    paddingTop: 50,
    backgroundColor: '#fff',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
  },
  greetingContainer: {
    padding: 20,
    paddingTop: 10,
  },
  greetingText: {
    fontSize: 18,
    color: '#1f2937',
  },
  statsCard: {
    margin: 20,
    marginTop: 10,
  },
  statsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
    gap: 8,
  },
  statsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 15,
  },
  statBox: {
    flex: 1,
    backgroundColor: '#f3f4f6',
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#6b7280',
  },
  listingsHeader: {
    paddingHorizontal: 20,
    marginBottom: 15,
  },
  listingsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
  },
  content: {
    flex: 1,
  },
  listingsContainer: {
    padding: 20,
    paddingTop: 0,
  },
  listingCard: {
    backgroundColor: '#f3f4f6',
    borderRadius: 12,
    marginBottom: 15,
    overflow: 'hidden',
  },
  cardContent: {
    flexDirection: 'row',
    padding: 15,
  },
  listingImageContainer: {
    width: 100,
    height: 100,
    borderRadius: 8,
    backgroundColor: '#fff',
    overflow: 'hidden',
    marginRight: 15,
  },
  listingImage: {
    width: '100%',
    height: '100%',
  },
  placeholderImage: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  listingInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  listingName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 4,
  },
  listingPrice: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 2,
  },
  discountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  discountLabel: {
    fontSize: 12,
    color: '#6b7280',
  },
  discountedPrice: {
    fontSize: 12,
    color: '#6b7280',
    marginLeft: 4,
  },
  quantityInfo: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 2,
  },
  closedTime: {
    fontSize: 12,
    color: '#6b7280',
  },
  cardButtons: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  editBtn: {
    flex: 1,
    padding: 12,
    alignItems: 'center',
    borderRightWidth: 1,
    borderRightColor: '#e5e7eb',
  },
  editBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6b7280',
  },
  deleteBtn: {
    flex: 1,
    padding: 12,
    alignItems: 'center',
  },
  deleteBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6b7280',
  },
  newPostButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f3f4f6',
    marginHorizontal: 60,
    marginBottom: 20,
    padding: 12,
    borderRadius: 12,
    gap: 8,
  },
  newPostButtonText: {
    color: '#1f2937',
    fontSize: 14,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyStateText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6b7280',
    marginTop: 12,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#9ca3af',
    marginTop: 4,
  },
});