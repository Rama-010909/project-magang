import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

export const isFirebaseConfigured = Boolean(
  import.meta.env.VITE_FIREBASE_API_KEY && import.meta.env.VITE_FIREBASE_PROJECT_ID
);

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyDemoFallbackKeyDiskominfoBatang',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'diskominfo-batang.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'diskominfo-batang-bmd',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'diskominfo-batang-bmd.appspot.com',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '100000000001',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:100000000001:web:abcdef1234567890'
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
export const db = getFirestore(app);