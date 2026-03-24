// Import the functions you need from the SDKs you need
import { initializeApp, getApps, getApp } from "firebase/app";
import { initializeAuth, getAuth, getReactNativePersistence } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
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

let app;
let auth;

// ⭐ เช็คก่อนว่ามี App อยู่แล้วหรือยัง (ป้องกัน Error เวลา Reload)
if (getApps().length === 0) {
  // ถ้ายังไม่มี ให้สร้างใหม่
  app = initializeApp(firebaseConfig);
  // ตั้งค่า Auth พร้อม Persistence
  auth = initializeAuth(app, {
    persistence: getReactNativePersistence(ReactNativeAsyncStorage)
  });
} else {
  // ถ้ามีแล้ว ให้ดึงตัวเดิมมาใช้
  app = getApp();
  auth = getAuth(app);
}

export const db = getFirestore(app);
export { auth };
export default app;