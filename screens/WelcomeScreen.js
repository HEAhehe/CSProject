import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Dimensions,
  StatusBar,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

const { width, height } = Dimensions.get('window');

export default function WelcomeScreen({ navigation }) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 1200,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 20,
        friction: 7,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 1000,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      
      {/* Decorative Background Elements */}
      <View style={styles.decorativeCircle1} />
      <View style={styles.decorativeCircle2} />
      
      <Animated.View 
        style={[
          styles.logoContainer, 
          { 
            opacity: fadeAnim,
            transform: [{ scale: scaleAnim }]
          }
        ]}
      >
        <View style={styles.logoCircle}>
          <Ionicons name="leaf-outline" size={80} color="#10b981" />
        </View>
        <Text style={styles.appName}>Food</Text>
        <Text style={styles.appTitle}>WASTE</Text>
        <Text style={styles.tagline}>ลดขยะอาหาร แบ่งปันความสุข</Text>
      </Animated.View>

      <Animated.View
        style={[
          styles.buttonContainer,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }]
          }
        ]}
      >
        <TouchableOpacity
          style={styles.getStartedButton}
          onPress={() => navigation.navigate('SignIn')}
          activeOpacity={0.8}
        >
          <Text style={styles.getStartedText}>เริ่มต้นใช้งาน</Text>
          <Ionicons name="arrow-forward" size={20} color="#fff" style={styles.arrowIcon} />
        </TouchableOpacity>

        <View style={styles.featuresContainer}>
          <View style={styles.featureItem}>
            <Ionicons name="restaurant-outline" size={24} color="#10b981" />
            <Text style={styles.featureText}>จัดการอาหาร</Text>
          </View>
          <View style={styles.featureItem}>
            <Ionicons name="heart-outline" size={24} color="#f43f5e" />
            <Text style={styles.featureText}>แบ่งปัน</Text>
          </View>
          <View style={styles.featureItem}>
            <Ionicons name="earth-outline" size={24} color="#3b82f6" />
            <Text style={styles.featureText}>ช่วยโลก</Text>
          </View>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 80,
    paddingBottom: 50,
  },
  decorativeCircle1: {
    position: 'absolute',
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: '#10b981',
    opacity: 0.05,
    top: -100,
    right: -100,
  },
  decorativeCircle2: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: '#3b82f6',
    opacity: 0.05,
    bottom: -50,
    left: -50,
  },
  logoContainer: {
    alignItems: 'center',
    marginTop: 40,
  },
  logoCircle: {
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: '#f0fdf4',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 30,
    shadowColor: '#10b981',
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 10,
  },
  appName: {
    fontSize: 48,
    fontWeight: '300',
    color: '#1f2937',
    marginBottom: -5,
    letterSpacing: 2,
  },
  appTitle: {
    fontSize: 64,
    fontWeight: 'bold',
    color: '#10b981',
    marginBottom: 10,
    letterSpacing: 1,
  },
  tagline: {
    fontSize: 16,
    color: '#6b7280',
    fontWeight: '400',
    marginTop: 10,
  },
  buttonContainer: {
    width: '100%',
    alignItems: 'center',
  },
  getStartedButton: {
    backgroundColor: '#10b981',
    paddingHorizontal: 50,
    paddingVertical: 18,
    borderRadius: 30,
    marginBottom: 40,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#10b981',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    minWidth: 250,
    justifyContent: 'center',
  },
  getStartedText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginRight: 8,
  },
  arrowIcon: {
    marginLeft: 5,
  },
  featuresContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    paddingHorizontal: 20,
  },
  featureItem: {
    alignItems: 'center',
  },
  featureText: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 8,
    fontWeight: '500',
  },
});
