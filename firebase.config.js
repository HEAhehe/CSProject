// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
// แก้ไข 1: เปลี่ยนการ import auth เป็นแบบใหม่
import { initializeAuth, getReactNativePersistence } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
// แก้ไข 2: import ตัวช่วยจำ (AsyncStorage)
import ReactNativeAsyncStorage from '@react-native-async-storage/async-storage';

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDYTj2UPGXEZLEy4_hDcMEJjOSQZQYo19s",
  authDomain: "foodwaste-v2.firebaseapp.com",
  projectId: "foodwaste-v2",
  storageBucket: "foodwaste-v2.firebasestorage.app",
  messagingSenderId: "591059790207",
  appId: "1:591059790207:web:c19e0fc4ead246ebe3124a",
  measurementId: "G-13D2Y3MDGK"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase services
// แก้ไข 3: ใช้ initializeAuth แทน getAuth เพื่อใส่ setting การจำค่า
export const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(ReactNativeAsyncStorage)
});

export const db = getFirestore(app);

export default app;