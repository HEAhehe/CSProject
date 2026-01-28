import React, { useState } from 'react';
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

export default function FoodDetailScreen({ navigation, route }) {
  const { food, store } = route.params;
  const [quantity, setQuantity] = useState(1);

  const handleBookNow = () => {
    navigation.navigate('BookingSuccess', {
      food,
      store,
      quantity,
      totalPrice: food.discountPrice * quantity,
    });
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      {/* Header Image */}
      <View style={styles.headerImage}>
        {food.image ? (
          <Image source={{ uri: food.image }} style={styles.image} />
        ) : (
          <View style={styles.imagePlaceholder}>
            <Ionicons name="fast-food" size={80} color="#d1d5db" />
          </View>
        )}

        {/* Header Overlay */}
        <View style={styles.headerOverlay}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Discount Badge */}
        <View style={styles.discountBadge}>
          <Text style={styles.discountText}>{food.discount}% OFF</Text>
        </View>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Food Info */}
        <View style={styles.infoSection}>
          <Text style={styles.foodName}>{food.name}</Text>

          {/* Store Info */}
          <TouchableOpacity style={styles.storeRow}>
            <Ionicons name="storefront" size={18} color="#6b7280" />
            <Text style={styles.storeName}>{store.name}</Text>
            <Ionicons name="chevron-forward" size={16} color="#9ca3af" />
          </TouchableOpacity>

          {/* Price */}
          <View style={styles.priceContainer}>
            <View style={styles.priceRow}>
              <Text style={styles.originalPrice}>฿{food.originalPrice}</Text>
              <Text style={styles.discountPrice}>฿{food.discountPrice}</Text>
            </View>
            <Text style={styles.savingsText}>
              You save ฿{food.originalPrice - food.discountPrice}
            </Text>
          </View>

          {/* Quick Info */}
          <View style={styles.quickInfo}>
            <View style={styles.quickInfoItem}>
              <Ionicons name="cube" size={20} color="#10b981" />
              <View>
                <Text style={styles.quickInfoLabel}>Available</Text>
                <Text style={styles.quickInfoValue}>{food.quantity} portions</Text>
              </View>
            </View>

            <View style={styles.quickInfoItem}>
              <Ionicons name="time" size={20} color="#f59e0b" />
              <View>
                <Text style={styles.quickInfoLabel}>Pickup Time</Text>
                <Text style={styles.quickInfoValue}>{food.expiryTime}</Text>
              </View>
            </View>
          </View>

          {/* Description */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Description</Text>
            <Text style={styles.descriptionText}>
              Fresh and healthy food surplus from our store. All items are safe to eat and in excellent condition. Perfect for reducing food waste while saving money.
            </Text>
          </View>

          {/* Pickup Location */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Pickup Location</Text>
            <View style={styles.locationCard}>
              <Ionicons name="location" size={20} color="#3b82f6" />
              <View style={styles.locationInfo}>
                <Text style={styles.locationText}>{store.name}</Text>
                <Text style={styles.locationDistance}>{store.distance} away</Text>
              </View>
              <TouchableOpacity style={styles.mapButton}>
                <Ionicons name="navigate" size={18} color="#3b82f6" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Quantity Selector */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Quantity</Text>
            <View style={styles.quantitySelector}>
              <TouchableOpacity
                style={styles.quantityButton}
                onPress={() => quantity > 1 && setQuantity(quantity - 1)}
                disabled={quantity <= 1}
              >
                <Ionicons name="remove" size={20} color={quantity <= 1 ? '#d1d5db' : '#1f2937'} />
              </TouchableOpacity>

              <View style={styles.quantityDisplay}>
                <Text style={styles.quantityText}>{quantity}</Text>
              </View>

              <TouchableOpacity
                style={styles.quantityButton}
                onPress={() => quantity < food.quantity && setQuantity(quantity + 1)}
                disabled={quantity >= food.quantity}
              >
                <Ionicons name="add" size={20} color={quantity >= food.quantity ? '#d1d5db' : '#1f2937'} />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Bottom Bar */}
      <View style={styles.bottomBar}>
        <View style={styles.totalContainer}>
          <Text style={styles.totalLabel}>Total Price</Text>
          <Text style={styles.totalPrice}>฿{food.discountPrice * quantity}</Text>
        </View>

        <TouchableOpacity style={styles.bookButton} onPress={handleBookNow}>
          <Text style={styles.bookButtonText}>Book Now</Text>
          <Ionicons name="arrow-forward" size={20} color="#fff" />
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
  headerImage: {
    height: 300,
    position: 'relative',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  imagePlaceholder: {
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
  discountBadge: {
    position: 'absolute',
    top: 60,
    right: 20,
    backgroundColor: '#ef4444',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  discountText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
  },
  content: {
    flex: 1,
  },
  infoSection: {
    padding: 20,
  },
  foodName: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 12,
  },
  storeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
    marginBottom: 16,
  },
  storeName: {
    flex: 1,
    fontSize: 14,
    color: '#6b7280',
  },
  priceContainer: {
    marginBottom: 20,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 6,
  },
  originalPrice: {
    fontSize: 18,
    color: '#9ca3af',
    textDecorationLine: 'line-through',
  },
  discountPrice: {
    fontSize: 28,
    fontWeight: '700',
    color: '#10b981',
  },
  savingsText: {
    fontSize: 13,
    color: '#10b981',
    fontWeight: '500',
  },
  quickInfo: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 24,
  },
  quickInfoItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#f9fafb',
    padding: 16,
    borderRadius: 12,
  },
  quickInfoLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 4,
  },
  quickInfoValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 12,
  },
  descriptionText: {
    fontSize: 14,
    color: '#6b7280',
    lineHeight: 22,
  },
  locationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#f9fafb',
    padding: 16,
    borderRadius: 12,
  },
  locationInfo: {
    flex: 1,
  },
  locationText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 4,
  },
  locationDistance: {
    fontSize: 12,
    color: '#6b7280',
  },
  mapButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  quantitySelector: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  quantityButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#f9fafb',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#f3f4f6',
  },
  quantityDisplay: {
    flex: 1,
    height: 44,
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quantityText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1f2937',
  },
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
    gap: 16,
  },
  totalContainer: {
    flex: 1,
  },
  totalLabel: {
    fontSize: 13,
    color: '#6b7280',
    marginBottom: 4,
  },
  totalPrice: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1f2937',
  },
  bookButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#10b981',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
  },
  bookButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});
