/**
 * Firebase Client SDK Initialization.
 * Credentials populated from frontend/android/app/google-services.json
 * with optional environment variable overrides.
 */
import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, type Auth } from 'firebase/auth';

export const firebaseConfig = {
  apiKey:
    import.meta.env.VITE_FIREBASE_API_KEY ||
    'AIzaSyBZ6OhLmVBVUJbWfNgcezWSagnm73bg3VU',
  authDomain:
    import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ||
    'robotic-arm-vision-7f1f1.firebaseapp.com',
  projectId:
    import.meta.env.VITE_FIREBASE_PROJECT_ID ||
    'robotic-arm-vision-7f1f1',
  storageBucket:
    import.meta.env.VITE_FIREBASE_STORAGE_BUCKET ||
    'robotic-arm-vision-7f1f1.firebasestorage.app',
  messagingSenderId:
    import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID ||
    '860611224060',
  appId:
    import.meta.env.VITE_FIREBASE_APP_ID ||
    '1:860611224060:android:b3e859182c9c6f1ee15279',
};

// Initialize or reuse existing Firebase App instance
export const app: FirebaseApp =
  getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Initialize Firebase Auth
export const auth: Auth = getAuth(app);

// Configure Google Auth Provider
export const googleAuthProvider = new GoogleAuthProvider();
googleAuthProvider.setCustomParameters({
  prompt: 'select_account',
});
