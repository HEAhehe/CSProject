import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  StatusBar,
  Image,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { db, auth } from '../firebase.config';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';

export default function DonationListScreen({ navigation }) {
  const [donations, setDonations] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState('all'); // all, near, recent

  useEffect(() => {
    loadDonations();
  }, []);

  const loadDonations = async () => {
    try {
      const user = auth.currentUser;
      
      // Query donations that are available and not from current user
      const q = query(
        collection(db, 'food_items'),
        where('donationStatus', '==', 'available'),
        orderBy('updatedAt', 'desc')
      );
      
      const querySnapshot = await getDocs(q);
      const items = [];
      
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        // Exclude own donations
        if (data.userId !== user.uid) {
          items.push({
            id: doc.id,
            ...data,
          });
        }
      });
      
      setDonations(items);
    } catch (error) {
      console.error('Error loading donations:', error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadDonations();
    setRefreshing(false);
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

  const renderDonationItem = ({ item }) => (
    <TouchableOpacity
      style={styles.donationCard}
      onPress={() => navigation.navigate('DonationDetail', { donation: item })}
      activeOpacity={0.7}
    >
      <View style={styles.donationImageContainer}>
        {item.imageUrl ? (
          <Image source={{ uri: item.imageUrl }} style={styles.donationImage} />
        ) : (
          <View style={styles.donationImagePlaceholder}>
            <Ionicons name="fast-food" size={40} color="#d1d5db" />
          </View>
        )}
        <View style={styles.heartBadge}>
          <Ionicons name="heart" size={16} color="#fff" />
        </View>
      </View>

      <View style={styles.donationInfo}>
        <Text style={styles.donationName} numberOfLines={1}>{item.name}</Text>
        <Text style={styles.donationCategory}>{item.category}</Text>
        
        <View style={styles.donationMeta}>
          <View style={styles.metaItem}>
            <Ionicons name="cube-outline" size={14} color="#6b7280" />
            <Text style={styles.metaText}>x{item.quantity}</Text>
          </View>
          
          <View style={styles.metaItem}>
            <Ionicons name="time-outline" size={14} color="#f59e0b" />
            <Text style={styles.metaText}>{getDaysLeft(item.expiryDate)}</Text>
          </View>
        </View>

        <View style={styles.donorInfo}>
          <View style={styles.donorAvatar}>
            <Ionicons name="person" size={14} color="#10b981" />
          </View>
          <Text style={styles.donorName}>ผู้บริจาค</Text>
          <View style={styles.distanceBadge}>
            <Ionicons name="location" size={12} color="#3b82f6" />
            <Text style={styles.distanceText}>2.5 km</Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#1f2937" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>อาหารบริจาค</Text>
        <TouchableOpacity style={styles.filterButton}>
          <Ionicons name="options" size={24} color="#1f2937" />
        </TouchableOpacity>
      </View>

      {/* Filter Pills */}
      <View style={styles.filterContainer}>
        <TouchableOpacity
          style={[styles.filterPill, filter === 'all' && styles.filterPillActive]}
          onPress={() => setFilter('all')}
        >
          <Ionicons 
            name="grid" 
            size={16} 
            color={filter === 'all' ? '#fff' : '#6b7280'} 
          />
          <Text style={[styles.filterPillText, filter === 'all' && styles.filterPillTextActive]}>
            ทั้งหมด
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.filterPill, filter === 'near' && styles.filterPillActive]}
          onPress={() => setFilter('near')}
        >
          <Ionicons 
            name="location" 
            size={16} 
            color={filter === 'near' ? '#fff' : '#6b7280'} 
          />
          <Text style={[styles.filterPillText, filter === 'near' && styles.filterPillTextActive]}>
            ใกล้ฉัน
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.filterPill, filter === 'recent' && styles.filterPillActive]}
          onPress={() => setFilter('recent')}
        >
          <Ionicons 
            name="time" 
            size={16} 
            color={filter === 'recent' ? '#fff' : '#6b7280'} 
          />
          <Text style={[styles.filterPillText, filter === 'recent' && styles.filterPillTextActive]}>
            ล่าสุด
          </Text>
        </TouchableOpacity>
      </View>

      {/* Donation List */}
      {donations.length > 0 ? (
        <FlatList
          data={donations}
          renderItem={renderDonationItem}
          keyExtractor={(item) => item.id}
          numColumns={2}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        />
      ) : (
        <View style={styles.emptyState}>
          <Ionicons name="heart-dislike-outline" size={80} color="#d1d5db" />
          <Text style={styles.emptyText}>ยังไม่มีอาหารบริจาค</Text>
          <Text style={styles.emptySubtext}>
            กลับมาตรวจสอบใหม่ภายหลัง
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 15,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
  },
  filterContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: '#fff',
  },
  filterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f9fafb',
    marginRight: 10,
  },
  filterPillActive: {
    backgroundColor: '#10b981',
  },
  filterPillText: {
    fontSize: 13,
    color: '#6b7280',
    fontWeight: '500',
    marginLeft: 6,
  },
  filterPillTextActive: {
    color: '#fff',
  },
  listContent: {
    padding: 15,
  },
  donationCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 15,
    margin: 5,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  donationImageContainer: {
    position: 'relative',
    width: '100%',
    height: 150,
  },
  donationImage: {
    width: '100%',
    height: '100%',
  },
  donationImagePlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heartBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(239, 68, 68, 0.9)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  donationInfo: {
    padding: 12,
  },
  donationName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 4,
  },
  donationCategory: {
    fontSize: 12,
    color: '#9ca3af',
    marginBottom: 8,
  },
  donationMeta: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 12,
  },
  metaText: {
    fontSize: 11,
    color: '#6b7280',
    marginLeft: 4,
  },
  donorInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  donorAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#f0fdf4',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6,
  },
  donorName: {
    flex: 1,
    fontSize: 11,
    color: '#6b7280',
  },
  distanceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#eff6ff',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  distanceText: {
    fontSize: 10,
    color: '#3b82f6',
    marginLeft: 2,
    fontWeight: '500',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#6b7280',
    marginTop: 20,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#9ca3af',
    textAlign: 'center',
  },
});
