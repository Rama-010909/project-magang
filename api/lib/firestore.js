import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

function init() {
  if (!getApps().length) {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    if (!raw) throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON belum dikonfigurasi.');
    initializeApp({ credential: cert(JSON.parse(raw)) });
  }
  return getFirestore();
}
export const firestore = init();
