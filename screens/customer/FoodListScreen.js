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
import { auth, db } from '../../firebase.config';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';

export default function FoodListScreen({ navigation }) {
  const [foodItems, setFoodItems] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState('all'); // all, fresh, warning, expired

  useEffect(() => {
    loadFoodItems();
  }, []);

  const loadFoodItems = async () => {
    try {
      const user = auth.currentUser;
      if (user) {
        const q = query(
          collection(db, 'food_items'),
          where('userId', '==', user.uid),
          orderBy('expiryDate', 'asc')
        );
        
        const querySnapshot = await getDocs(q);
        const items = [];
        
        querySnapshot.forEach((doc) => {
          const data = doc.data();
          const status = getFoodStatus(data.expiryDate);
          items.push({
            id: doc.id,
            ...data,
            status,
          });
        });
        
        setFoodItems(items);
      }
    } catch (error) {
      console.error('Error loading food items:', error);
    }
  };

  const getFoodStatus = (expiryDate) => {
    if (!expiryDate) return 'fresh';
    
    const today = new Date();
    const expiry = new Date(expiryDate);
    const diffTime = expiry - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) return 'expired';
    if (diffDays <= 3) return 'warning';
    return 'fresh';
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'fresh': return '#10b981';
      case 'warning': return '#f59e0b';
      case 'expired': return '#ef4444';
      default: return '#6b7280';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'fresh': return 'สด';
      case 'warning': return 'ใกล้หมดอายุ';
      case 'expired': return 'หมดอายุ';
      default: return '-';
    }
  };

  const getDaysLeft = (expiryDate) => {
    if (!expiryDate) return '-';
    
    const today = new Date();
    const expiry = new Date(expiryDate);
    const diffTime = expiry - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) return `หมดอายุแล้ว ${Math.abs(diffDays)} วัน`;
    if (diffDays === 0) return 'หมดอายุวันนี้';
    return `เหลืออีก ${diffDays} วัน`;
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadFoodItems();
    setRefreshing(false);
  };

  const filteredItems = foodItems.filter(item => {
    if (filter === 'all') return true;
    return item.status === filter;
  });

  const renderFoodItem = ({ item }) => (
    <TouchableOpacity
      style={styles.foodCard}
      onPress={() => navigation.navigate('FoodDetail', { foodItem: item })}
      activeOpacity={0.7}
    >
      <View style={styles.foodImageContainer}>
        {item.imageUrl ? (
          <Image source={{ uri: item.imageUrl }} style={styles.foodImage} />
        ) : (
          <View style={styles.foodImagePlaceholder}>
            <Ionicons name="fast-food" size={40} color="#d1d5db" />
          </View>
        )}
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
          <Text style={styles.statusBadgeText}>{getStatusText(item.status)}</Text>
        </View>
      </View>

      <View style={styles.foodInfo}>
        <Text style={styles.foodName} numberOfLines={1}>{item.name}</Text>
        <Text style={styles.foodCategory}>{item.category}</Text>
        
        <View style={styles.foodDetails}>
          <View style={styles.detailRow}>
            <Ionicons name="cube-outline" size={14} color="#6b7280" />
            <Text style={styles.detailText}>จำนวน: {item.quantity}</Text>
          </View>
          <View style={styles.detailRow}>
            <Ionicons name="calendar-outline" size={14} color="#6b7280" />
            <Text style={styles.detailText}>
              {new Date(item.expiryDate).toLocaleDateString('th-TH', { 
                day: 'numeric', 
                month: 'short',
                year: 'numeric' 
              })}
            </Text>
          </View>
        </View>

        <View style={[styles.daysLeftBadge, { backgroundColor: `${getStatusColor(item.status)}15` }]}>
          <Ionicons name="time-outline" size={14} color={getStatusColor(item.status)} />
          <Text style={[styles.daysLeftText, { color: getStatusColor(item.status) }]}>
            {getDaysLeft(item.expiryDate)}
          </Text>
        </View>
      </View>

      <TouchableOpacity style={styles.moreButton}>
        <Ionicons name="ellipsis-vertical" size={20} color="#9ca3af" />
      </TouchableOpacity>
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
        <Text style={styles.headerTitle}>รายการอาหาร</Text>
        <TouchableOpacity style={styles.searchButton}>
          <Ionicons name="search" size={24} color="#1f2937" />
        </TouchableOpacity>
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterContainer}>
        <TouchableOpacity
          style={[styles.filterTab, filter === 'all' && styles.filterTabActive]}
          onPress={() => setFilter('all')}
        >
          <Text style={[styles.filterText, filter === 'all' && styles.filterTextActive]}>
            ทั้งหมด ({foodItems.length})
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.filterTab, filter === 'fresh' && styles.filterTabActive]}
          onPress={() => setFilter('fresh')}
        >
          <Text style={[styles.filterText, filter === 'fresh' && styles.filterTextActive]}>
            สด ({foodItems.filter(i => i.status === 'fresh').length})
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.filterTab, filter === 'warning' && styles.filterTabActive]}
          onPress={() => setFilter('warning')}
        >
          <Text style={[styles.filterText, filter === 'warning' && styles.filterTextActive]}>
            ใกล้หมดอายุ ({foodItems.filter(i => i.status === 'warning').length})
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.filterTab, filter === 'expired' && styles.filterTabActive]}
          onPress={() => setFilter('expired')}
        >
          <Text style={[styles.filterText, filter === 'expired' && styles.filterTextActive]}>
            หมดอายุ ({foodItems.filter(i => i.status === 'expired').length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Food List */}
      {filteredItems.length > 0 ? (
        <FlatList
          data={filteredItems}
          renderItem={renderFoodItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        />
      ) : (
        <View style={styles.emptyState}>
          <Ionicons name="pizza-outline" size={80} color="#d1d5db" />
          <Text style={styles.emptyText}>ไม่มีรายการอาหาร</Text>
          <Text style={styles.emptySubtext}>
            {filter === 'all' ? 'เริ่มเพิ่มอาหารของคุณเพื่อจัดการ' : 'ไม่มีอาหารในหมวดหมู่นี้'}
          </Text>
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => navigation.navigate('AddFood')}
          >
            <Ionicons name="add" size={20} color="#fff" />
            <Text style={styles.addButtonText}>เพิ่มอาหาร</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Floating Add Button */}
      {filteredItems.length > 0 && (
        <TouchableOpacity
          style={styles.fab}
          onPress={() => navigation.navigate('AddFood')}
        >
          <Ionicons name="add" size={28} color="#fff" />
        </TouchableOpacity>
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
  searchButton: {
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
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  filterTab: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
    backgroundColor: '#f9fafb',
  },
  filterTabActive: {
    backgroundColor: '#10b981',
  },
  filterText: {
    fontSize: 13,
    color: '#6b7280',
    fontWeight: '500',
  },
  filterTextActive: {
    color: '#fff',
  },
  listContent: {
    padding: 20,
  },
  foodCard: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 15,
    padding: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  foodImageContainer: {
    position: 'relative',
    marginRight: 12,
  },
  foodImage: {
    width: 80,
    height: 80,
    borderRadius: 12,
  },
  foodImagePlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 12,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusBadge: {
    position: 'absolute',
    top: 5,
    right: 5,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  statusBadgeText: {
    fontSize: 10,
    color: '#fff',
    fontWeight: '600',
  },
  foodInfo: {
    flex: 1,
    justifyContent: 'space-between',
  },
  foodName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 4,
  },
  foodCategory: {
    fontSize: 12,
    color: '#9ca3af',
    marginBottom: 8,
  },
  foodDetails: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 8,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 12,
    marginBottom: 4,
  },
  detailText: {
    fontSize: 12,
    color: '#6b7280',
    marginLeft: 4,
  },
  daysLeftBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  daysLeftText: {
    fontSize: 11,
    fontWeight: '600',
    marginLeft: 4,
  },
  moreButton: {
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
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
    marginBottom: 30,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#10b981',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 25,
  },
  addButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
    marginLeft: 8,
  },
  fab: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#10b981',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#10b981',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
});
