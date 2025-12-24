// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyC_kBtswH2SsGMT6QBK0l_ZO9-Y0fcYp5E",
  authDomain: "foodwaste-50060.firebaseapp.com",
  projectId: "foodwaste-50060",
  storageBucket: "foodwaste-50060.firebasestorage.app",
  messagingSenderId: "1012268413610",
  appId: "1:1012268413610:web:a03621e4f9a7d71c8f96d3",
  measurementId: "G-CCM5SYVBQV"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);