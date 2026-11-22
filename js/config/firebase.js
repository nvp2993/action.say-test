import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

const FIREBASE_CONFIG = {
  apiKey: "AIzaSyDgRS8-JOZuCQU4vq4p77XRur9LqEWAq-g",
  authDomain: "lich-show-test-v2.firebaseapp.com",
  projectId: "lich-show-test-v2",
  storageBucket: "lich-show-test-v2.firebasestorage.app",
  messagingSenderId: "759137446204",
  appId: "1:759137446204:web:a74f8073cc060f1d47d639"
};

export const APP_ID = 'action-say-media-2026';
export const ADMIN_EMAIL = 'nvp0209@gmail.com';
export const MEMBER_EMAIL_DOMAIN = 'actionsay.local';

export const app = initializeApp(FIREBASE_CONFIG);
export const auth = getAuth(app);
export const db = getFirestore(app);