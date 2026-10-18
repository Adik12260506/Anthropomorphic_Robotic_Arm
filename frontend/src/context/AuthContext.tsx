import React, { createContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { FirebaseAuthentication, type User as CapacitorFirebaseUser } from '@capacitor-firebase/authentication';
import { onAuthStateChanged, signInWithPopup, signOut as firebaseSignOut, type User as FirebaseWebUser } from 'firebase/auth';
import { auth, googleAuthProvider } from '../services/firebase';
import { isCapacitorNative } from '../services/api';

export interface AuthUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
}

export interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  error: string | null;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  clearError: () => void;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

const STORAGE_KEY_USER = 'ROBOT_ARM_AUTH_USER';

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_USER);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const saveUser = useCallback((u: AuthUser | null) => {
    setUser(u);
    try {
      if (u) {
        localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(u));
      } else {
        localStorage.removeItem(STORAGE_KEY_USER);
      }
    } catch {
      // ignore storage errors
    }
  }, []);

  // Initialize and listen to Auth state changes
  useEffect(() => {
    let isMounted = true;

    const initAuth = async () => {
      const isNative = isCapacitorNative();

      if (isNative) {
        try {
          // Check native Capacitor Firebase current user
          const result = await FirebaseAuthentication.getCurrentUser();
          if (result.user && isMounted) {
            saveUser({
              uid: result.user.uid,
              email: result.user.email ?? null,
              displayName: result.user.displayName ?? null,
              photoURL: result.user.photoUrl ?? null,
            });
          }
        } catch {
          // Native user not signed in yet
        }
      }

      // Also listen to Firebase Web SDK auth state changes
      const unsubscribeWeb = onAuthStateChanged(auth, (webUser: FirebaseWebUser | null) => {
        if (!isMounted) return;
        if (webUser) {
          saveUser({
            uid: webUser.uid,
            email: webUser.email,
            displayName: webUser.displayName,
            photoURL: webUser.photoURL,
          });
        } else if (!isNative) {
          saveUser(null);
        }
        setLoading(false);
      });

      // Listen to Capacitor native auth state changes
      let listenerHandle: any = null;
      if (isNative) {
        try {
          listenerHandle = await FirebaseAuthentication.addListener(
            'authStateChange',
            (change: { user: CapacitorFirebaseUser | null }) => {
              if (!isMounted) return;
              if (change.user) {
                saveUser({
                  uid: change.user.uid,
                  email: change.user.email ?? null,
                  displayName: change.user.displayName ?? null,
                  photoURL: change.user.photoUrl ?? null,
                });
              } else {
                saveUser(null);
              }
              setLoading(false);
            }
          );
        } catch {
          // ignore
        }
      }

      // Safety timeout for loading state
      setTimeout(() => {
        if (isMounted) setLoading(false);
      }, 1500);

      return () => {
        unsubscribeWeb();
        if (listenerHandle) {
          listenerHandle.remove();
        }
      };
    };

    initAuth();

    return () => {
      isMounted = false;
    };
  }, [saveUser]);

  const signInWithGoogle = useCallback(async () => {
    setError(null);
    setLoading(true);

    try {
      const isNative = isCapacitorNative();

      if (isNative) {
        // Native Android Google Sign-In sheet via Google Play Services
        const result = await FirebaseAuthentication.signInWithGoogle();
        if (result.user) {
          saveUser({
            uid: result.user.uid,
            email: result.user.email ?? null,
            displayName: result.user.displayName ?? null,
            photoURL: result.user.photoUrl ?? null,
          });
        }
      } else {
        // Web Browser Popup Sign-In
        const result = await signInWithPopup(auth, googleAuthProvider);
        if (result.user) {
          saveUser({
            uid: result.user.uid,
            email: result.user.email,
            displayName: result.user.displayName,
            photoURL: result.user.photoURL,
          });
        }
      }
    } catch (err: any) {
      console.error('Google Sign-In Error:', err);
      let errorMsg = err?.message || 'Failed to sign in with Google.';

      if (err?.code === 'auth/popup-closed-by-user' || err?.message?.includes('closed')) {
        errorMsg = 'Sign-in cancelled. Please try again.';
      } else if (err?.code === 'auth/network-request-failed') {
        errorMsg = 'Network error. Please check your internet connection.';
      } else if (err?.message?.includes('10:') || err?.message?.includes('Developer Error')) {
        errorMsg = 'Android SHA-1 fingerprint configuration required in Firebase Console for native sign-in.';
      }

      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  }, [saveUser]);

  const signOut = useCallback(async () => {
    setLoading(true);
    try {
      if (isCapacitorNative()) {
        await FirebaseAuthentication.signOut().catch(() => {});
      }
      await firebaseSignOut(auth).catch(() => {});
      saveUser(null);
    } catch (err: any) {
      console.error('Sign Out Error:', err);
    } finally {
      setLoading(false);
    }
  }, [saveUser]);

  const clearError = useCallback(() => setError(null), []);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        error,
        signInWithGoogle,
        signOut,
        clearError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export { useAuth } from './useAuth';

