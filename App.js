import React, { useState, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './firebase.config';
// ✅ 1. Import SafeAreaProvider เข้ามา
import { SafeAreaProvider } from 'react-native-safe-area-context';

// --- 📂 AUTH Screens ---
import WelcomeScreen from './screens/auth/WelcomeScreen';
import SignInScreen from './screens/auth/SignInScreen';
import SignUpScreen from './screens/auth/SignUpScreen';
import ForgotPasswordScreen from './screens/auth/ForgotPasswordScreen';

// --- 📂 CUSTOMER Screens ---
import HomeScreen from './screens/customer/HomeScreen';
import ProfileScreen from './screens/customer/ProfileScreen';
import EditProfileScreen from './screens/customer/EditProfileScreen';
import FoodDetailScreen from './screens/customer/FoodDetailScreen';
import NotificationsScreen from './screens/customer/NotificationsScreen';
import OrdersScreen from './screens/customer/OrdersScreen';
import OrderDetailScreen from './screens/customer/OrderDetailScreen';
import FavoriteStoresScreen from './screens/customer/FavoriteStoresScreen';
import CartScreen from './screens/customer/CartScreen';
import StoreDetailScreen from './screens/customer/StoreDetailScreen';
import WriteReviewScreen from './screens/customer/WriteReviewScreen';
import AddressBookScreen from './screens/customer/AddressBookScreen';
import ImpactHistoryScreen from './screens/customer/ImpactHistoryScreen';
import ChangePasswordScreen from './screens/customer/ChangePasswordScreen';
import NotificationDetailScreen from './screens/customer/NotificationDetailScreen';

// --- 📂 STORE Screens ---
import RegisterStoreStep1Screen from './screens/store/RegisterStoreStep1Screen';
import RegisterStoreStep2Screen from './screens/store/RegisterStoreStep2Screen';
import RegisterStoreStep3Screen from './screens/store/RegisterStoreStep3Screen';
import MyShopScreen from './screens/store/MyShopScreen';
import CreateListingScreen from './screens/store/CreateListingScreen';
import StoreOrdersScreen from './screens/store/StoreOrdersScreen';
import StoreDashboardScreen from './screens/store/StoreDashboardScreen';
import StoreSettingsScreen from './screens/store/StoreSettingsScreen';
import StoreProfileScreen from './screens/store/StoreProfileScreen';
import StoreNotificationsScreen from './screens/store/StoreNotificationsScreen';
import StoreNotificationDetailScreen from './screens/store/StoreNotificationDetailScreen.js'
import StoreImpactHistoryScreen from './screens/store/StoreImpactHistoryScreen';

// --- 📂 ADMIN Screens ---
import AdminHomeScreen from './screens/admin/AdminHomeScreen';
import AdminApprovalsScreen from './screens/admin/AdminApprovalsScreen';
import AdminReportsScreen from './screens/admin/AdminReportsScreen';
import AdminUsersScreen from './screens/admin/AdminUsersScreen';
import AdminProfileScreen from './screens/admin/AdminProfileScreen';

const Stack = createNativeStackNavigator();

export default function App() {
  const [initializing, setInitializing] = useState(true);
  const [user, setUser] = useState(null);

  useEffect(() => {
    const subscriber = onAuthStateChanged(auth, (user) => {
      setUser(user);
      if (initializing) setInitializing(false);
    });
    return subscriber;
  }, []);

  if (initializing) return null;

  return (
    // ✅ 2. ครอบแอปทั้งหมดด้วย SafeAreaProvider
    <SafeAreaProvider>
      <NavigationContainer>
        <Stack.Navigator
          initialRouteName={user ? "Home" : "Welcome"}
          screenOptions={{
            headerShown: false,
            animation: 'slide_from_right',
          }}
        >
          {user ? (
            // ✅ Authenticated Stack (ล็อกอินแล้ว)
            <>
              {/* --- Customer Flow --- */}
              <Stack.Screen name="Home" component={HomeScreen} />
              <Stack.Screen name="Profile" component={ProfileScreen} />
              <Stack.Screen name="EditProfile" component={EditProfileScreen} />
              <Stack.Screen name="ChangePassword" component={ChangePasswordScreen} />
              <Stack.Screen name="AddressBook" component={AddressBookScreen} />
              <Stack.Screen name="FoodDetail" component={FoodDetailScreen} />
              <Stack.Screen name="StoreDetail" component={StoreDetailScreen} options={{ headerShown: false }} />
              <Stack.Screen name="WriteReview" component={WriteReviewScreen} />
              <Stack.Screen name="Cart" component={CartScreen} />
              <Stack.Screen name="Orders" component={OrdersScreen} />
              <Stack.Screen name="OrderDetail" component={OrderDetailScreen} />
              <Stack.Screen name="Notifications" component={NotificationsScreen} />
              <Stack.Screen name="NotificationDetail" component={NotificationDetailScreen} />
              <Stack.Screen name="FavoriteStores" component={FavoriteStoresScreen} />
              <Stack.Screen name="ImpactHistory" component={ImpactHistoryScreen} />

              {/* --- Store Flow (Registration & Management) --- */}
              <Stack.Screen name="MyShop" component={MyShopScreen} />
              <Stack.Screen name="StoreDashboard" component={StoreDashboardScreen} />
              <Stack.Screen name="CreateListing" component={CreateListingScreen} />
              <Stack.Screen name="StoreOrders" component={StoreOrdersScreen} />
              <Stack.Screen name="StoreSettings" component={StoreSettingsScreen} />
              <Stack.Screen name="StoreProfile" component={StoreProfileScreen} />
              <Stack.Screen name="StoreNotifications" component={StoreNotificationsScreen} />
              <Stack.Screen name="StoreNotificationDetail" component={StoreNotificationDetailScreen} />
              <Stack.Screen name="RegisterStoreStep1" component={RegisterStoreStep1Screen} />
              <Stack.Screen name="RegisterStoreStep2" component={RegisterStoreStep2Screen} />
              <Stack.Screen name="RegisterStoreStep3" component={RegisterStoreStep3Screen} />
              <Stack.Screen name="StoreImpactHistory" component={StoreImpactHistoryScreen} />

              {/* --- Admin Flow --- */}
              <Stack.Screen name="AdminHome" component={AdminHomeScreen} />
              <Stack.Screen name="AdminUsers" component={AdminUsersScreen} />
              <Stack.Screen name="AdminApprovals" component={AdminApprovalsScreen} />
              <Stack.Screen name="AdminReports" component={AdminReportsScreen} />
              <Stack.Screen name="AdminProfile" component={AdminProfileScreen} />
            </>
          ) : (
            // 🔒 Auth Stack (ยังไม่ล็อกอิน)
            <>
              <Stack.Screen name="Welcome" component={WelcomeScreen} />
              <Stack.Screen name="SignIn" component={SignInScreen} />
              <Stack.Screen name="SignUp" component={SignUpScreen} />
              <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
            </>
          )}
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}