import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Dimensions,
  ActivityIndicator,
  FlatList,
  Linking,
  Platform,
  Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { db, auth } from '../../firebase.config';
import { doc, getDoc, collection, query, where, getDocs, setDoc, deleteDoc, onSnapshot } from 'firebase/firestore';
import MapView, { Marker } from 'react-native-maps';

const { width } = Dimensions.get('window');

export default function StoreDetailScreen({ navigation, route }) {
  const { storeId } = route.params;
  const [store, setStore] = useState(null);
  const [menuItems, setMenuItems] = useState([]);

  const [reviews, setReviews] = useState([]);
  const [averageRating, setAverageRating] = useState(0);

  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('menu');
  const [isFavorite, setIsFavorite] = useState(false);

  useEffect(() => {
    const fetchStoreData = async () => {
      try {
        const storeDoc = await getDoc(doc(db, 'stores', storeId));
        if (storeDoc.exists()) {
          setStore({ id: storeDoc.id, ...storeDoc.data() });
        }

        const qFoods = query(collection(db, 'food_items'), where('userId', '==', storeId));
        const querySnapshot = await getDocs(qFoods);
        const foods = [];
        querySnapshot.forEach((doc) => {
          foods.push({ id: doc.id, ...doc.data() });
        });
        setMenuItems(foods);

      } catch (error) {
        console.error("Error fetching store details:", error);
      } finally {
        setLoading(false);
      }
    };

    if (storeId) fetchStoreData();
  }, [storeId]);

  useEffect(() => {
    if (!storeId) return;

    const qReviews = query(collection(db, 'reviews'), where('storeId', '==', storeId));

    const unsubscribeReviews = onSnapshot(qReviews, (snapshot) => {
      const reviewsData = [];
      let totalStars = 0;

      snapshot.forEach((doc) => {
        const rev = { id: doc.id, ...doc.data() };
        reviewsData.push(rev);
        totalStars += (rev.rating || 5);
      });

      reviewsData.sort((a, b) => {
        const dateA = a.createdAt?.seconds || 0;
        const dateB = b.createdAt?.seconds || 0;
        return dateB - dateA;
      });

      setReviews(reviewsData);

      if (reviewsData.length > 0) {
         setAverageRating((totalStars / reviewsData.length).toFixed(1));
      } else {
         setAverageRating(0);
      }
    });

    return () => unsubscribeReviews();
  }, [storeId]);

  useEffect(() => {
    const user = auth.currentUser;
    if (user && storeId) {
      const favRef = doc(db, 'users', user.uid, 'favorites', storeId);
      const unsubscribeFav = onSnapshot(favRef, (docSnapshot) => {
        setIsFavorite(docSnapshot.exists());
      });
      return () => unsubscribeFav();
    }
  }, [storeId]);

  const handleToggleFavorite = async () => {
    const user = auth.currentUser;
    if (!user) {
      Alert.alert('แจ้งเตือน', 'กรุณาเข้าสู่ระบบเพื่อบันทึกร้านโปรด');
      return;
    }

    try {
      const favRef = doc(db, 'users', user.uid, 'favorites', storeId);
      if (isFavorite) {
        await deleteDoc(favRef);
      } else {
        await setDoc(favRef, {
          storeId: storeId,
          storeName: store?.storeName || 'ร้านค้า',
          savedAt: new Date().toISOString()
        });
      }
    } catch (error) {
      console.error("Error toggling favorite store:", error);
      Alert.alert('ข้อผิดพลาด', 'ไม่สามารถบันทึกร้านโปรดได้ในขณะนี้');
    }
  };

  const openMap = () => {
    if (!store?.latitude || !store?.longitude) return;
    const url = Platform.select({
      ios: `maps:0,0?q=${store.latitude},${store.longitude}`,
      android: `geo:0,0?q=${store.latitude},${store.longitude}(${store.storeName})`
    });
    Linking.openURL(url);
  };

  const callStore = () => {
    if (store?.phoneNumber) {
      Linking.openURL(`tel:${store.phoneNumber}`);
    }
  };

  const renderBusinessHours = () => {
    if (!store?.businessHours) return <Text style={styles.infoText}>ไม่ระบุเวลาทำการ</Text>;

    const daysMap = {
        mon: 'จันทร์', tue: 'อังคาร', wed: 'พุธ', thu: 'พฤหัสฯ',
        fri: 'ศุกร์', sat: 'เสาร์', sun: 'อาทิตย์'
    };

    const daysOrder = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

    return daysOrder.map((dayKey) => {
        const dayData = store.businessHours[dayKey];
        const isToday = new Date().getDay() === (daysOrder.indexOf(dayKey) + 1) % 7;

        return (
            <View key={dayKey} style={[styles.hourRow, isToday && styles.todayRow]}>
                <Text style={[styles.dayText, isToday && styles.todayText]}>{daysMap[dayKey]}</Text>
                <Text style={[styles.timeText, isToday && styles.todayText]}>
                    {dayData?.isOpen ? `${dayData.openTime} - ${dayData.closeTime} น.` : 'ปิดทำการ'}
                </Text>
            </View>
        );
    });
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#10b981" />
      </View>
    );
  }

  if (!store) {
    return (
      <View style={styles.loadingContainer}>
        <Text>ไม่พบข้อมูลร้านค้า</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      <View style={styles.headerContainer}>
        <Image
            source={{ uri: store.storeImage || 'https://via.placeholder.com/400x200' }}
            style={styles.coverImage}
        />
        <View style={styles.overlay} />

        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.favoriteButton} onPress={handleToggleFavorite}>
            <Ionicons name={isFavorite ? "heart" : "heart-outline"} size={24} color={isFavorite ? "#ef4444" : "#fff"} />
        </TouchableOpacity>

        <View style={styles.headerContent}>
            <Text style={styles.storeName}>{store.storeName}</Text>
            <View style={styles.ratingRow}>
                <Ionicons name="star" size={16} color="#FFD700" />
                <Text style={styles.ratingText}>
                  {averageRating > 0 ? averageRating : '0.0'} ({reviews.length} รีวิว)
                </Text>
                <View style={styles.statusBadge}>
                    <Text style={styles.statusText}>
                       {store.isActive ? "เปิดทำการ" : "ปิดชั่วคราว"}
                    </Text>
                </View>
            </View>
        </View>
      </View>

      <View style={styles.tabContainer}>
        <TouchableOpacity style={[styles.tabItem, activeTab === 'menu' && styles.activeTab]} onPress={() => setActiveTab('menu')}>
            <Text style={[styles.tabText, activeTab === 'menu' && styles.activeTabText]}>เมนูอาหาร</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tabItem, activeTab === 'info' && styles.activeTab]} onPress={() => setActiveTab('info')}>
            <Text style={[styles.tabText, activeTab === 'info' && styles.activeTabText]}>ข้อมูลร้าน</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tabItem, activeTab === 'reviews' && styles.activeTab]} onPress={() => setActiveTab('reviews')}>
            <Text style={[styles.tabText, activeTab === 'reviews' && styles.activeTabText]}>รีวิว ({reviews.length})</Text>
        </TouchableOpacity>
      </View>

      {activeTab === 'menu' && (
        <FlatList
            data={menuItems}
            keyExtractor={(item) => item.id}
            numColumns={2}
            contentContainerStyle={styles.menuList}
            showsVerticalScrollIndicator={false}
            columnWrapperStyle={{ justifyContent: 'space-between' }}
            renderItem={({ item }) => {
                const originalPrice = Number(item.originalPrice) || 0;
                const discountPrice = Number(item.discountPrice) || Number(item.price) || 0;
                const discountPercent = originalPrice > 0 ? Math.round(((originalPrice - discountPrice) / originalPrice) * 100) : 0;

                return (
                  <TouchableOpacity
                      style={styles.foodCard}
                      onPress={() => navigation.push('FoodDetail', { food: { ...item, storeName: store.storeName, storeId: store.id } })}
                  >
                      <View style={styles.imageWrapper}>
                          <Image source={{ uri: item.imageUrl }} style={styles.foodImage} />
                          {discountPercent > 0 && (
                              <View style={styles.discountBadgeSmall}>
                                  <Text style={styles.discountBadgeText}>-{discountPercent}%</Text>
                              </View>
                          )}
                      </View>

                      <View style={styles.foodInfo}>
                          <Text style={styles.foodName} numberOfLines={1}>{item.name}</Text>
                          <View style={styles.priceContainer}>
                              <Text style={styles.foodPrice}>{discountPrice} ฿</Text>
                              {originalPrice > discountPrice && (
                                  <Text style={styles.foodOriginalPrice}>{originalPrice} ฿</Text>
                              )}
                          </View>
                      </View>

                      <View style={styles.addBtn}>
                          <Ionicons name="add" size={20} color="#fff" />
                      </View>
                  </TouchableOpacity>
                );
            }}
            ListEmptyComponent={
                <View style={styles.emptyState}>
                    <Text style={{ color: '#999' }}>ยังไม่มีรายการอาหาร</Text>
                </View>
            }
        />
      )}

      {activeTab === 'info' && (
        <ScrollView style={styles.infoContainer} showsVerticalScrollIndicator={false}>
            {store.storeDetails ? (
              <>
                <Text style={styles.sectionTitle}>เกี่ยวกับร้าน</Text>
                <Text style={styles.descriptionText}>{store.storeDetails}</Text>
                <View style={styles.divider} />
              </>
            ) : null}

            <Text style={styles.sectionTitle}>ที่ตั้งร้าน</Text>
            <Text style={styles.addressText}>{store.location || store.address}</Text>

            {store.latitude && store.longitude ? (
                <View style={styles.mapPreview}>
                    <MapView
                        style={styles.map}
                        initialRegion={{
                            latitude: store.latitude,
                            longitude: store.longitude,
                            latitudeDelta: 0.005,
                            longitudeDelta: 0.005,
                        }}
                        scrollEnabled={false}
                        zoomEnabled={false}
                    >
                        <Marker coordinate={{ latitude: store.latitude, longitude: store.longitude }} />
                    </MapView>
                    <TouchableOpacity style={styles.mapOverlayBtn} onPress={openMap}>
                        <Text style={styles.mapBtnText}>ดูแผนที่</Text>
                    </TouchableOpacity>
                </View>
            ) : null}

            <View style={styles.divider} />

            <Text style={styles.sectionTitle}>ข้อมูลติดต่อ</Text>
            <TouchableOpacity style={styles.contactRow} onPress={callStore}>
                <View style={styles.iconBox}>
                    <Ionicons name="call" size={20} color="#10b981" />
                </View>
                <Text style={styles.contactText}>{store.phoneNumber || '-'}</Text>
            </TouchableOpacity>
            <View style={styles.contactRow}>
                <View style={[styles.iconBox, { backgroundColor: '#e0f2fe' }]}>
                    <Ionicons name="bicycle" size={20} color="#0284c7" />
                </View>
                <Text style={styles.contactText}>
                    {store.deliveryMethod === 'both' ? 'จัดส่ง & รับที่ร้าน' : store.deliveryMethod === 'delivery' ? 'จัดส่งเท่านั้น' : 'รับที่ร้านเท่านั้น'}
                </Text>
            </View>

            <View style={styles.divider} />

            <Text style={styles.sectionTitle}>เวลาทำการ</Text>
            <View style={styles.hoursBox}>
                {renderBusinessHours()}
            </View>

            <View style={{ height: 50 }} />
        </ScrollView>
      )}

      {activeTab === 'reviews' && (
        <FlatList
          data={reviews}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.reviewList}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <TouchableOpacity
              style={styles.writeReviewBtn}
              onPress={() => {
                const user = auth.currentUser;
                if (!user) {
                  Alert.alert("แจ้งเตือน", "กรุณาเข้าสู่ระบบก่อนเขียนรีวิวครับ");
                  return;
                }
                navigation.navigate('WriteReview', { store: store });
              }}
            >
              <Ionicons name="create-outline" size={20} color="#fff" />
              <Text style={styles.writeReviewBtnText}>เขียนรีวิวให้ร้านนี้</Text>
            </TouchableOpacity>
          }
          renderItem={({ item }) => {
            let formattedDate = 'เพิ่งรีวิวเมื่อสักครู่';
            if (item.createdAt && item.createdAt.toDate) {
               formattedDate = item.createdAt.toDate().toLocaleDateString('th-TH');
            } else if (item.createdAt && item.createdAt.seconds) {
               formattedDate = new Date(item.createdAt.seconds * 1000).toLocaleDateString('th-TH');
            }

            return (
              <View style={styles.reviewCard}>
                <View style={styles.reviewHeader}>
                  <View style={styles.reviewerInfo}>
                    <View style={[styles.reviewerAvatar, item.isAnonymous && { backgroundColor: '#9ca3af' }]}>
                      {/* ✅ เช็ค: ถ้าเปิดเผยตัวตน และ มีรูปโปรไฟล์ ให้ใช้ Image, ถ้าไม่มี หรือซ่อน ให้ใช้ Icon */}
                      {(!item.isAnonymous && item.userProfileImage) ? (
                        <Image
                          source={{ uri: item.userProfileImage }}
                          style={{ width: '100%', height: '100%', borderRadius: 15 }}
                        />
                      ) : (
                        <Ionicons name={item.isAnonymous ? "incognito" : "person"} size={16} color="#fff" />
                      )}
                    </View>
                    <Text style={styles.reviewerName}>
                      {item.isAnonymous ? 'ผู้ไม่ประสงค์ออกนาม' : (item.userName || 'ผู้ใช้งาน')}
                    </Text>
                  </View>
                  <Text style={styles.reviewDate}>{formattedDate}</Text>
                </View>

                <View style={styles.reviewStars}>
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Ionicons
                      key={star}
                      name="star"
                      size={16}
                      color={star <= item.rating ? "#f59e0b" : "#e5e7eb"}
                      style={{marginRight: 2}}
                    />
                  ))}
                </View>

                {item.tags && item.tags.length > 0 && (
                  <View style={styles.reviewTagsContainer}>
                    {item.tags.map((tag, idx) => (
                      <View key={idx} style={styles.reviewTag}>
                        <Text style={styles.reviewTagText}>{tag}</Text>
                      </View>
                    ))}
                  </View>
                )}

                {item.comment ? (
                  <Text style={styles.reviewComment}>{item.comment}</Text>
                ) : null}
              </View>
            )
          }}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="chatbubbles-outline" size={50} color="#d1d5db" />
              <Text style={{ color: '#999', marginTop: 10 }}>ยังไม่มีรีวิวสำหรับร้านค้านี้</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  headerContainer: { height: 250, width: '100%', position: 'relative' },
  coverImage: { width: '100%', height: '100%' },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.4)' },

  backButton: { position: 'absolute', top: 50, left: 20, width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  favoriteButton: { position: 'absolute', top: 50, right: 20, width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },

  headerContent: { position: 'absolute', bottom: 20, left: 20, right: 20 },
  storeName: { fontSize: 26, fontWeight: 'bold', color: '#fff', marginBottom: 5, textShadowColor: 'rgba(0,0,0,0.7)', textShadowOffset: { width: 1, height: 1 }, textShadowRadius: 4 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  ratingText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  statusBadge: { backgroundColor: '#10b981', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4, marginLeft: 10 },
  statusText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },

  tabContainer: { flexDirection: 'row', backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  tabItem: { flex: 1, paddingVertical: 15, alignItems: 'center' },
  activeTab: { borderBottomWidth: 2, borderBottomColor: '#10b981' },
  tabText: { fontSize: 15, color: '#666', fontWeight: '500' },
  activeTabText: { color: '#10b981', fontWeight: 'bold' },

  menuList: { padding: 15, paddingBottom: 50 },
  foodCard: { width: (width - 45) / 2, backgroundColor: '#fff', borderRadius: 12, marginBottom: 15, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 5, elevation: 2, overflow: 'hidden' },

  imageWrapper: { position: 'relative' },
  foodImage: { width: '100%', height: 140, backgroundColor: '#f0f0f0' },
  discountBadgeSmall: { position: 'absolute', top: 8, right: 8, backgroundColor: '#ef4444', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 },
  discountBadgeText: { color: '#fff', fontSize: 10, fontWeight: 'bold' },

  foodInfo: { padding: 10, paddingBottom: 15 },
  foodName: { fontSize: 14, fontWeight: '600', color: '#333', marginBottom: 6 },

  priceContainer: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  foodPrice: { fontSize: 15, fontWeight: 'bold', color: '#ef4444' },
  foodOriginalPrice: { fontSize: 11, color: '#9ca3af', textDecorationLine: 'line-through' },

  addBtn: { position: 'absolute', bottom: 10, right: 10, width: 28, height: 28, borderRadius: 14, backgroundColor: '#10b981', justifyContent: 'center', alignItems: 'center' },
  emptyState: { alignItems: 'center', marginTop: 50 },

  infoContainer: { padding: 20 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#333', marginBottom: 12 },

  descriptionText: { fontSize: 14, color: '#4b5563', lineHeight: 22, textAlign: 'justify' },

  addressText: { fontSize: 14, color: '#666', marginBottom: 15, lineHeight: 20 },
  mapPreview: { height: 180, borderRadius: 12, overflow: 'hidden', position: 'relative', marginBottom: 10 },
  map: { width: '100%', height: '100%' },
  mapOverlayBtn: { position: 'absolute', bottom: 10, right: 10, backgroundColor: '#fff', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, elevation: 3 },
  mapBtnText: { fontSize: 12, fontWeight: '600', color: '#333' },

  divider: { height: 1, backgroundColor: '#eee', marginVertical: 20 },

  contactRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 15 },
  iconBox: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#dcfce7', justifyContent: 'center', alignItems: 'center', marginRight: 15 },
  contactText: { fontSize: 15, color: '#333', flex: 1 },

  hoursBox: { backgroundColor: '#fff', padding: 15, borderRadius: 12, borderWidth: 1, borderColor: '#eee' },
  hourRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  todayRow: { backgroundColor: '#f0fdf4', marginHorizontal: -15, paddingHorizontal: 15 },
  dayText: { fontSize: 14, color: '#666' },
  timeText: { fontSize: 14, color: '#333', fontWeight: '500' },
  todayText: { color: '#10b981', fontWeight: 'bold' },

  reviewList: { padding: 20, paddingBottom: 50 },
  writeReviewBtn: { backgroundColor: '#10b981', flexDirection: 'row', paddingVertical: 12, borderRadius: 12, justifyContent: 'center', alignItems: 'center', gap: 8, marginBottom: 20, elevation: 2, shadowColor: '#10b981', shadowOpacity: 0.3, shadowOffset: {width: 0, height: 2}, shadowRadius: 4 },
  writeReviewBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 15 },

  reviewCard: { backgroundColor: '#fff', padding: 15, borderRadius: 12, marginBottom: 15, borderWidth: 1, borderColor: '#f3f4f6' },
  reviewHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  reviewerInfo: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  reviewerAvatar: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#10b981', justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  reviewerName: { fontSize: 14, fontWeight: 'bold', color: '#374151' },
  reviewDate: { fontSize: 12, color: '#9ca3af' },
  reviewStars: { flexDirection: 'row', marginBottom: 10 },
  reviewTagsContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 },
  reviewTag: { backgroundColor: '#f0fdf4', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, borderWidth: 1, borderColor: '#dcfce7' },
  reviewTagText: { fontSize: 11, color: '#16a34a', fontWeight: '500' },
  reviewComment: { fontSize: 14, color: '#4b5563', lineHeight: 20, marginTop: 5 }
});