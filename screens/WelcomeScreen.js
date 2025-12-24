import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
} from 'react-native';

export default function WelcomeScreen({ navigation }) {
  const fadeAnim = new Animated.Value(0);

  React.useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 1000,
      useNativeDriver: true,
    }).start();
  }, []);

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.logoContainer, { opacity: fadeAnim }]}>
        <View style={styles.logoCircle}>
          <Text style={styles.logoText}>Logo</Text>
        </View>
        <Text style={styles.appName}>Food</Text>
        <Text style={styles.appTitle}>Waste</Text>
      </Animated.View>

      <TouchableOpacity
        style={styles.getStartedButton}
        onPress={() => navigation.navigate('SignIn')}
      >
        <Text style={styles.getStartedText}>เริ่มต้นใช้งาน</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 60,
  },
  logoCircle: {
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: '#d1d5db',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 30,
  },
  logoText: {
    fontSize: 36,
    fontWeight: '600',
    color: '#374151',
  },
  appName: {
    fontSize: 48,
    fontWeight: '300',
    color: '#000',
    marginBottom: 5,
  },
  appTitle: {
    fontSize: 64,
    fontWeight: 'bold',
    color: '#000',
  },
  getStartedButton: {
    backgroundColor: '#d1d5db',
    paddingHorizontal: 60,
    paddingVertical: 15,
    borderRadius: 25,
    marginTop: 40,
  },
  getStartedText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
  },
});
