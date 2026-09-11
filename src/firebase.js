import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

// Firebase Web App config. Konfigurasi web Firebase memang digunakan di frontend.
const firebaseConfig = {
  apiKey: "AIzaSyCnybMKpM7Z5gWn49hIsd5ymhFVSVtEuoo",
  authDomain: "it-asset-diskominfo-batang.firebaseapp.com",
  projectId: "it-asset-diskominfo-batang",
  storageBucket: "it-asset-diskominfo-batang.firebasestorage.app",
  messagingSenderId: "1083945766646",
  appId: "1:1083945766646:web:0fbd3b32f88fd34784a6d7"
};

export const isFirebaseConfigured = true;
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
export const db = getFirestore(app);
