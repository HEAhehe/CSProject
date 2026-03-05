import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, Image, ScrollView, TouchableOpacity,
  StatusBar, Dimensions, ActivityIndicator, FlatList, Linking, Platform, Alert
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

  const [reviewFilter, setReviewFilter] = useState('all');

  useEffect(() => {
    const fetchStoreData = async () => {
      try {
        let storeDoc = await getDoc(doc(db, 'stores', storeId));
        if (storeDoc.exists()) {
          setStore({ id: storeDoc.id, ...storeDoc.data() });
        } else {
          storeDoc = await getDoc(doc(db, 'users', storeId));
          if (storeDoc.exists()) setStore({ id: storeDoc.id, ...storeDoc.data() });
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

  // 🔴 ฟังก์ชันคำนวณเวลาที่แม่นยำ (รองรับข้ามคืน)
  const checkIsStoreOpen = () => {
    if (!store) return false;
    const now = new Date();
    const daysMap = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
    const currentDayIdx = now.getDay();
    const prevDayIdx = currentDayIdx === 0 ? 6 : currentDayIdx - 1;

    let todayHours = store.businessHours ? store.businessHours[daysMap[currentDayIdx]] : { isOpen: true, openTime: store.openTime || "08:00", closeTime: store.closeTime || store.closingTime || "20:00" };
    let prevDayHours = store.businessHours ? store.businessHours[daysMap[prevDayIdx]] : todayHours;

    if (prevDayHours && prevDayHours.isOpen) {
      const [poH, poM] = prevDayHours.openTime.split(':').map(Number);
      const [pcH, pcM] = prevDayHours.closeTime.split(':').map(Number);
      if (pcH < poH || (pcH === poH && pcM < poM)) { // ถ้าเปิดข้ามคืนมาจากเมื่อวาน
         if (now.getHours() < pcH || (now.getHours() === pcH && now.getMinutes() < pcM)) return true;
      }
    }

    if (todayHours && todayHours.isOpen) {
      const [toH, toM] = todayHours.openTime.split(':').map(Number);
      const [tcH, tcM] = todayHours.closeTime.split(':').map(Number);
      let oDate = new Date(); oDate.setHours(toH, toM, 0, 0);
      let cDate = new Date(); cDate.setHours(tcH, tcM, 0, 0);
      if (tcH < toH || (tcH === toH && tcM < toM)) cDate.setDate(cDate.getDate() + 1);
      return now >= oDate && now <= cDate;
    }
    return false;
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

  const filteredReviews = reviews.filter((review) => {
    if (reviewFilter === 'all') return true;
    if (reviewFilter === 'image') return !!review.reviewImage;
    return review.rating === reviewFilter;
  });

  const filterOptions = [
    { id: 'all', label: 'ทั้งหมด' },
    { id: 'image', label: 'มีรูปภาพ' },
    { id: 5, label: '5 ดาว' },
    { id: 4, label: '4 ดาว' },
    { id: 3, label: '3 ดาว' },
    { id: 2, label: '2 ดาว' },
    { id: 1, label: '1 ดาว' },
  ];

  const getRatingCounts = () => {
    const counts = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    reviews.forEach(r => {
      const star = Math.floor(r.rating || 5);
      if (counts[star] !== undefined) counts[star]++;
    });
    return counts;
  };
  const ratingCounts = getRatingCounts();

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

  // 🔴 เรียกใช้ฟังก์ชันเช็คเวลาเปิด-ปิดร้าน
  const isStoreOpen = checkIsStoreOpen();

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      <View style={styles.headerContainer}>
        <Image source={{ uri: store.storeImage || 'https://via.placeholder.com/400x200' }} style={styles.coverImage} />
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
                {/* 🔴 แก้ไขป้ายสถานะให้แสดงตามเวลาจริง ไม่ใช่แค่ isActive */}
                <View style={[styles.statusBadge, { backgroundColor: !store.isActive ? '#6b7280' : isStoreOpen ? '#10b981' : '#ef4444' }]}>
                    <Text style={styles.statusText}>
                       {!store.isActive ? "ปิดชั่วคราว" : isStoreOpen ? "เปิดทำการ" : "ปิดแล้ว"}
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
                      style={[styles.foodCard, !isStoreOpen && { opacity: 0.6 }]} // ถ้าร้านปิดให้เมนูจางลง
                      onPress={() => {
                        if (isStoreOpen) {
                          navigation.push('FoodDetail', { food: { ...item, storeName: store.storeName, storeId: store.id } });
                        } else {
                          Alert.alert('ร้านปิดให้บริการ', 'ไม่สามารถสั่งอาหารได้ในขณะนี้ กรุณาทำรายการในเวลาทำการครับ');
                        }
                      }}
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

                      <View style={[styles.addBtn, !isStoreOpen && { backgroundColor: '#9ca3af' }]}>
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
                        initialRegion={{ latitude: store.latitude, longitude: store.longitude, latitudeDelta: 0.005, longitudeDelta: 0.005 }}
                        scrollEnabled={false} zoomEnabled={false}
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
                <View style={styles.iconBox}><Ionicons name="call" size={20} color="#10b981" /></View>
                <Text style={styles.contactText}>{store.phoneNumber || '-'}</Text>
            </TouchableOpacity>
            <View style={styles.contactRow}>
                <View style={[styles.iconBox, { backgroundColor: '#e0f2fe' }]}><Ionicons name="bicycle" size={20} color="#0284c7" /></View>
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
          data={filteredReviews}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.reviewList}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <View style={styles.reviewHeaderWrapper}>
              <Text style={[styles.sectionTitle, { marginBottom: 10 }]}>คะแนนและรีวิวจากผู้สั่งซื้อ</Text>

              <View style={styles.ratingSummaryContainer}>
                 <View style={styles.averageScoreContainer}>
                    <Text style={styles.hugeAverageText}>{averageRating > 0 ? averageRating : '0.0'}</Text>
                    <View style={styles.starsSummaryRow}>
                       {[1, 2, 3, 4, 5].map((star) => (
                          <Ionicons key={star} name="star" size={14} color={star <= Math.round(averageRating) ? "#f59e0b" : "#e5e7eb"} style={{ marginHorizontal: 1 }} />
                       ))}
                    </View>
                    <Text style={styles.totalReviewsText}>{reviews.length} รีวิว</Text>
                 </View>

                 <View style={styles.barsContainer}>
                    {[5, 4, 3, 2, 1].map(star => {
                       const count = ratingCounts[star];
                       const percent = reviews.length > 0 ? (count / reviews.length) * 100 : 0;
                       return (
                         <View key={star} style={styles.barRow}>
                            <Text style={styles.barStarText}>{star}</Text>
                            <Ionicons name="star" size={10} color="#9ca3af" style={{ marginHorizontal: 4 }} />
                            <View style={styles.barTrack}>
                               <View style={[styles.barFill, { width: `${percent}%` }]} />
                            </View>
                         </View>
                       )
                    })}
                 </View>
              </View>

              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterBarContainer}>
                {filterOptions.map((filter) => {
                  const isActive = reviewFilter === filter.id;
                  return (
                    <TouchableOpacity
                      key={filter.id}
                      style={[styles.filterButton, isActive && styles.filterButtonActive]}
                      onPress={() => setReviewFilter(filter.id)}
                    >
                      {filter.id === 'image' && <Ionicons name="image-outline" size={14} color={isActive ? '#fff' : '#4b5563'} style={{marginRight: 4}} />}
                      {typeof filter.id === 'number' && <Ionicons name="star" size={12} color={isActive ? '#fff' : '#f59e0b'} style={{marginRight: 4}} />}
                      <Text style={[styles.filterButtonText, isActive && styles.filterButtonTextActive]}>
                        {filter.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          }
          renderItem={({ item }) => {
            let formattedDate = 'เพิ่งรีวิวเมื่อสักครู่';
            if (item.createdAt && item.createdAt.toDate) formattedDate = item.createdAt.toDate().toLocaleDateString('th-TH');
            else if (item.createdAt && item.createdAt.seconds) formattedDate = new Date(item.createdAt.seconds * 1000).toLocaleDateString('th-TH');

            return (
              <View style={styles.reviewCard}>
                <View style={styles.reviewHeader}>
                  <View style={styles.reviewerInfo}>
                    <View style={[styles.reviewerAvatar, item.isAnonymous && { backgroundColor: '#9ca3af' }]}>
                      {(!item.isAnonymous && item.userProfileImage) ? (
                        <Image source={{ uri: item.userProfileImage }} style={{ width: '100%', height: '100%', borderRadius: 15 }} />
                      ) : (
                        <Ionicons name={item.isAnonymous ? "eye-off" : "person"} size={16} color="#fff" />                      )}
                    </View>
                    <View>
                        <Text style={styles.reviewerName}>{item.isAnonymous ? 'ผู้ไม่ประสงค์ออกนาม' : (item.userName || 'ผู้ใช้งาน')}</Text>
                        <Text style={styles.reviewDate}>{formattedDate}</Text>
                    </View>
                  </View>
                </View>

                <View style={styles.orderSummaryBox}>
                    <View style={styles.orderSummaryHeader}>
                        <Ionicons name="receipt-outline" size={14} color="#f59e0b" />
                        <Text style={styles.orderSummaryTitle}>รายการที่สั่งซื้อ</Text>
                        {item.orderType && (
                          <View style={styles.orderTypeBadge}>
                              <Text style={styles.orderTypeText}>{item.orderType === 'delivery' ? 'จัดส่ง' : 'รับที่ร้าน'}</Text>
                          </View>
                        )}
                    </View>
                    <View style={styles.orderItemsList}>
                        {item.orderItems && item.orderItems.length > 0 ? (
                            item.orderItems.map((food, idx) => (
                                <Text key={idx} style={styles.orderItemText}><Text style={{fontWeight: 'bold'}}>{food.quantity}x</Text> {food.foodName}</Text>
                            ))
                        ) : (
                            <Text style={styles.orderItemText}>• {item.orderFoodName || 'รายการอาหาร'}</Text>
                        )}
                    </View>
                </View>

                <View style={styles.reviewStars}>
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Ionicons key={star} name="star" size={16} color={star <= item.rating ? "#f59e0b" : "#e5e7eb"} style={{marginRight: 2}} />
                  ))}
                </View>

                {item.tags && item.tags.length > 0 && (
                  <View style={styles.reviewTagsContainer}>
                    {item.tags.map((tag, idx) => (
                      <View key={idx} style={styles.reviewTag}><Text style={styles.reviewTagText}>{tag}</Text></View>
                    ))}
                  </View>
                )}

                {item.comment ? <Text style={styles.reviewComment}>{item.comment}</Text> : null}
                {item.reviewImage && <Image source={{ uri: item.reviewImage }} style={styles.attachedImage} />}
              </View>
            )
          }}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="chatbubbles-outline" size={50} color="#d1d5db" />
              <Text style={{ color: '#9ca3af', marginTop: 10, fontSize: 14 }}>
                  {reviewFilter === 'all' ? 'ยังไม่มีรีวิวสำหรับร้านค้านี้' : 'ไม่พบรีวิวที่ตรงกับตัวกรองนี้'}
              </Text>
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
  statusBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4, marginLeft: 10 },
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
  reviewHeaderWrapper: { marginBottom: 15 },
  ratingSummaryContainer: { flexDirection: 'row', backgroundColor: '#fff', padding: 20, borderRadius: 16, marginBottom: 15, borderWidth: 1, borderColor: '#f3f4f6', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.03, shadowRadius: 4, elevation: 1 },
  averageScoreContainer: { alignItems: 'center', justifyContent: 'center', paddingRight: 20, borderRightWidth: 1, borderColor: '#f3f4f6', width: '35%' },
  hugeAverageText: { fontSize: 44, fontWeight: 'bold', color: '#1f2937', includeFontPadding: false },
  starsSummaryRow: { flexDirection: 'row', marginVertical: 6 },
  totalReviewsText: { fontSize: 12, color: '#6b7280' },
  barsContainer: { flex: 1, paddingLeft: 15, justifyContent: 'center' },
  barRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 5 },
  barStarText: { fontSize: 12, color: '#4b5563', width: 10, textAlign: 'center', fontWeight: '600' },
  barTrack: { flex: 1, height: 6, backgroundColor: '#f3f4f6', borderRadius: 3, marginLeft: 4, overflow: 'hidden' },
  barFill: { height: '100%', backgroundColor: '#f59e0b', borderRadius: 3 },
  filterBarContainer: { flexDirection: 'row', gap: 10, paddingBottom: 10 },
  filterButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: '#e5e7eb' },
  filterButtonActive: { backgroundColor: '#10b981', borderColor: '#10b981' },
  filterButtonText: { fontSize: 13, color: '#4b5563', fontWeight: '500' },
  filterButtonTextActive: { color: '#fff', fontWeight: 'bold' },
  reviewCard: { backgroundColor: '#fff', padding: 15, borderRadius: 12, marginBottom: 15, borderWidth: 1, borderColor: '#f3f4f6' },
  reviewHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
  reviewerInfo: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  reviewerAvatar: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#10b981', justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  reviewerName: { fontSize: 14, fontWeight: 'bold', color: '#374151' },
  reviewDate: { fontSize: 12, color: '#9ca3af' },
  orderSummaryBox: { backgroundColor: '#fcfcfc', borderRadius: 8, padding: 10, marginBottom: 10, borderWidth: 1, borderColor: '#f3f4f6' },
  orderSummaryHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  orderSummaryTitle: { fontSize: 12, fontWeight: 'bold', color: '#f59e0b', marginLeft: 4, flex: 1 },
  orderTypeBadge: { backgroundColor: '#f3f4f6', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  orderTypeText: { fontSize: 10, color: '#6b7280', fontWeight: '600' },
  orderItemsList: { paddingLeft: 4 },
  orderItemText: { fontSize: 12, color: '#4b5563', marginBottom: 2 },
  reviewStars: { flexDirection: 'row', marginBottom: 10 },
  reviewTagsContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 },
  reviewTag: { backgroundColor: '#f0fdf4', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, borderWidth: 1, borderColor: '#dcfce7' },
  reviewTagText: { fontSize: 11, color: '#16a34a', fontWeight: '500' },
  reviewComment: { fontSize: 14, color: '#4b5563', lineHeight: 20, marginTop: 5 },
  attachedImage: { width: 100, height: 100, borderRadius: 10, marginTop: 12, borderWidth: 1, borderColor: '#e5e7eb' }
});