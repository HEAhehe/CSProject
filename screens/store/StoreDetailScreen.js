import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function StoreDetailScreen({ navigation, route }) {
  const { store } = route.params || { store: { name: 'Store Name' } };
  const [isFavorite, setIsFavorite] = useState(false);

  const foodItems = [
    {
      id: '1',
      name: 'Fresh Vegetables Mix',
      originalPrice: 120,
      discountPrice: 60,
      discount: 50,
      quantity: 5,
      expiryTime: '2 hours',
      image: null,
    },
    {
      id: '2',
      name: 'Bread & Bakery',
      originalPrice: 80,
      discountPrice: 40,
      discount: 50,
      quantity: 3,
      expiryTime: '4 hours',
      image: null,
    },
  ];

  const renderFoodCard = (item) => (
    <TouchableOpacity
      key={item.id}
      style={styles.foodCard}
      onPress={() => navigation.navigate('FoodDetail', { food: item, store })}
    >
      <View style={styles.foodImageContainer}>
        {item.image ? (
          <Image source={{ uri: item.image }} style={styles.foodImage} />
        ) : (
          <View style={styles.foodImagePlaceholder}>
            <Ionicons name="fast-food" size={32} color="#d1d5db" />
          </View>
        )}
        <View style={styles.discountBadge}>
          <Text style={styles.discountText}>{item.discount}% OFF</Text>
        </View>
      </View>

      <View style={styles.foodInfo}>
        <Text style={styles.foodName} numberOfLines={2}>{item.name}</Text>
        
        <View style={styles.priceRow}>
          <Text style={styles.originalPrice}>฿{item.originalPrice}</Text>
          <Text style={styles.discountPrice}>฿{item.discountPrice}</Text>
        </View>

        <View style={styles.foodMeta}>
          <View style={styles.metaItem}>
            <Ionicons name="cube-outline" size={14} color="#6b7280" />
            <Text style={styles.metaText}>{item.quantity} left</Text>
          </View>
          <View style={styles.metaItem}>
            <Ionicons name="time-outline" size={14} color="#f59e0b" />
            <Text style={styles.metaText}>{item.expiryTime}</Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      {/* Header Image */}
      <View style={styles.headerImage}>
        <View style={styles.headerImagePlaceholder}>
          <Ionicons name="storefront" size={60} color="#d1d5db" />
        </View>

        {/* Header Overlay */}
        <View style={styles.headerOverlay}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.favoriteButton}
            onPress={() => setIsFavorite(!isFavorite)}
          >
            <Ionicons
              name={isFavorite ? 'heart' : 'heart-outline'}
              size={24}
              color={isFavorite ? '#ef4444' : '#fff'}
            />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Store Info */}
        <View style={styles.storeInfo}>
          <Text style={styles.storeName}>{store.name}</Text>
          
          <View style={styles.storeMetaRow}>
            <View style={styles.metaBadge}>
              <Ionicons name="star" size={16} color="#f59e0b" />
              <Text style={styles.metaBadgeText}>{store.rating || '4.8'}</Text>
            </View>

            <View style={styles.metaBadge}>
              <Ionicons name="location" size={16} color="#3b82f6" />
              <Text style={styles.metaBadgeText}>{store.distance || '1.2 km'}</Text>
            </View>

            <View style={styles.metaBadge}>
              <Ionicons name="time" size={16} color="#10b981" />
              <Text style={styles.metaBadgeText}>Open Now</Text>
            </View>
          </View>

          <View style={styles.divider} />

          {/* Info Cards */}
          <View style={styles.infoCards}>
            <View style={styles.infoCard}>
              <Ionicons name="fast-food" size={20} color="#10b981" />
              <Text style={styles.infoCardNumber}>{store.available || 12}</Text>
              <Text style={styles.infoCardLabel}>Available Items</Text>
            </View>

            <View style={styles.infoCard}>
              <Ionicons name="time-outline" size={20} color="#f59e0b" />
              <Text style={styles.infoCardNumber}>2-6</Text>
              <Text style={styles.infoCardLabel}>Hours Left</Text>
            </View>

            <View style={styles.infoCard}>
              <Ionicons name="pricetag" size={20} color="#ef4444" />
              <Text style={styles.infoCardNumber}>50%</Text>
              <Text style={styles.infoCardLabel}>Max Discount</Text>
            </View>
          </View>
        </View>

        {/* Available Food Items */}
        <View style={styles.foodSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Available Food</Text>
            <Text style={styles.itemCount}>{foodItems.length} items</Text>
          </View>

          <View style={styles.foodGrid}>
            {foodItems.map(renderFoodCard)}
          </View>
        </View>

        {/* Store Description */}
        <View style={styles.descriptionSection}>
          <Text style={styles.sectionTitle}>About Store</Text>
          <Text style={styles.descriptionText}>
            Fresh organic produce and baked goods. We offer surplus food at discounted prices to reduce waste.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  headerImage: {
    height: 200,
    position: 'relative',
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
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  favoriteButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
  },
  storeInfo: {
    padding: 20,
  },
  storeName: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 12,
  },
  storeMetaRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  metaBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#f9fafb',
  },
  metaBadgeText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#1f2937',
  },
  divider: {
    height: 1,
    backgroundColor: '#f3f4f6',
    marginVertical: 20,
  },
  infoCards: {
    flexDirection: 'row',
    gap: 12,
  },
  infoCard: {
    flex: 1,
    backgroundColor: '#f9fafb',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  infoCardNumber: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1f2937',
    marginVertical: 8,
  },
  infoCardLabel: {
    fontSize: 11,
    color: '#6b7280',
    textAlign: 'center',
  },
  foodSection: {
    padding: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1f2937',
  },
  itemCount: {
    fontSize: 14,
    color: '#6b7280',
  },
  foodGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -6,
  },
  foodCard: {
    width: '48%',
    backgroundColor: '#fff',
    borderRadius: 16,
    margin: '1%',
    borderWidth: 1,
    borderColor: '#f3f4f6',
    overflow: 'hidden',
  },
  foodImageContainer: {
    position: 'relative',
  },
  foodImage: {
    width: '100%',
    height: 120,
  },
  foodImagePlaceholder: {
    width: '100%',
    height: 120,
    backgroundColor: '#f9fafb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  discountBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#ef4444',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  discountText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#fff',
  },
  foodInfo: {
    padding: 12,
  },
  foodName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 8,
    height: 36,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  originalPrice: {
    fontSize: 13,
    color: '#9ca3af',
    textDecorationLine: 'line-through',
  },
  discountPrice: {
    fontSize: 16,
    fontWeight: '700',
    color: '#10b981',
  },
  foodMeta: {
    flexDirection: 'row',
    gap: 8,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 11,
    color: '#6b7280',
  },
  descriptionSection: {
    padding: 20,
    paddingTop: 0,
  },
  descriptionText: {
    fontSize: 14,
    color: '#6b7280',
    lineHeight: 20,
    marginTop: 8,
  },
});
