import React, { useState, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './firebase.config';

// Screens
import WelcomeScreen from './screens/WelcomeScreen';
import SignInScreen from './screens/SignInScreen';
import SignUpScreen from './screens/SignUpScreen';
import ForgotPasswordScreen from './screens/ForgotPasswordScreen';
import HomeScreen from './screens/HomeScreen';
import ProfileScreen from './screens/ProfileScreen';
import EditProfileScreen from './screens/EditProfileScreen';

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
          // Authenticated Stack
          <>
            <Stack.Screen name="Home" component={HomeScreen} />
            <Stack.Screen name="Profile" component={ProfileScreen} />
            <Stack.Screen name="EditProfile" component={EditProfileScreen} />
          </>
        ) : (
          // Auth Stack
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
