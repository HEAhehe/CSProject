import React, { useState, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './firebase.config';

// --- 📂 AUTH Screens ---
import WelcomeScreen from './screens/auth/WelcomeScreen';
import SignInScreen from './screens/auth/SignInScreen';
import SignUpScreen from './screens/auth/SignUpScreen';
import ForgotPasswordScreen from './screens/auth/ForgotPasswordScreen';

// --- 📂 CUSTOMER Screens ---
import HomeScreen from './screens/customer/HomeScreen';
import ProfileScreen from './screens/customer/ProfileScreen';
import EditProfileScreen from './screens/customer/EditProfileScreen';
import MenuScreen from './screens/customer/MenuScreen';
import FoodListScreen from './screens/customer/FoodListScreen';
import FoodDetailScreen from './screens/customer/FoodDetailScreen';
import NotificationsScreen from './screens/customer/NotificationsScreen';
import OrdersScreen from './screens/customer/OrdersScreen';
import OrderDetailScreen from './screens/customer/OrderDetailScreen';
import FavoriteStoresScreen from './screens/customer/FavoriteStoresScreen';
import CartScreen from './screens/customer/CartScreen';

// --- 📂 STORE Screens (เพิ่มใหม่) ---
import AddFoodScreen from './screens/store/AddFoodScreen';
import StoreHomeScreen from './screens/store/HomeScreen';
import RegisterStoreStep1Screen from './screens/store/RegisterStoreStep1Screen';
import RegisterStoreStep2Screen from './screens/store/RegisterStoreStep2Screen';
import RegisterStoreStep3Screen from './screens/store/RegisterStoreStep3Screen';

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
            <Stack.Screen name="Menu" component={MenuScreen} />
            <Stack.Screen name="Profile" component={ProfileScreen} />
            <Stack.Screen name="EditProfile" component={EditProfileScreen} />

            <Stack.Screen name="FoodList" component={FoodListScreen} />
            <Stack.Screen name="FoodDetail" component={FoodDetailScreen} />

            <Stack.Screen name="Cart" component={CartScreen} />

            <Stack.Screen name="Orders" component={OrdersScreen} />
            <Stack.Screen name="OrderDetail" component={OrderDetailScreen} />

            <Stack.Screen name="Notifications" component={NotificationsScreen} />
            <Stack.Screen name="FavoriteStores" component={FavoriteStoresScreen} />


            {/* --- Store Flow (Registration & Management) --- */}
            <Stack.Screen name="StoreHome" component={StoreHomeScreen} />
            <Stack.Screen name="AddFood" component={AddFoodScreen} />
            <Stack.Screen name="RegisterStoreStep1" component={RegisterStoreStep1Screen} />
            <Stack.Screen name="RegisterStoreStep2" component={RegisterStoreStep2Screen} />
            <Stack.Screen name="RegisterStoreStep3" component={RegisterStoreStep3Screen} />

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
  );
}