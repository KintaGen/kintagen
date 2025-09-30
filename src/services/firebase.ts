import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// --- IMPORTANT ---
// Your web app's Firebase configuration
// Replace this with your actual configuration from the Firebase console
const firebaseConfig = {
    apiKey: "AIzaSyAazP1E1_gKmTz2QLy2p-Yf2csWgTpR66o",
    authDomain: "kgdemo-ea8b2.firebaseapp.com",
    projectId: "kgdemo-ea8b2",
    storageBucket: "kgdemo-ea8b2.firebasestorage.app",
    messagingSenderId: "581458558038",
    appId: "1:581458558038:web:ca048ab4b66db9b12f8ff7",
    measurementId: "G-ED3WENYD1L"
  };
  
  // --- INITIALIZE FIREBASE ---
  // This line creates the '[DEFAULT]' Firebase app instance.
  // It should only be called ONCE in your entire application.
  const app = initializeApp(firebaseConfig);
  
  
  // --- INITIALIZE SERVICES ---
  // Get the Analytics instance associated with the app.
  // We export this so other parts of our app can use it.
  export const analytics = getAnalytics(app);