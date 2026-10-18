import React, { createContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { getApiBaseUrl } from '../services/api';

export interface AuthUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  role?: string;
}

export interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  error: string | null;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  clearError: () => void;
  renderGoogleButton: (containerId: string) => void;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

const STORAGE_KEY_USER = 'ROBOT_ARM_AUTH_USER';
const STORAGE_KEY_TOKEN = 'ROBOT_ARM_AUTH_TOKEN';

// Configurable Google Client ID from environment or fallback
const GOOGLE_CLIENT_ID =
  import.meta.env.VITE_GOOGLE_CLIENT_ID ||
  '860611224060-lsrni5qv5p6v8sq1domna86nt71f3mrt.apps.googleusercontent.com';

declare global {
  interface Window {
    google?: any;
  }
}

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

  const saveUserSession = useCallback((u: AuthUser | null, token?: string) => {
    setUser(u);
    try {
      if (u) {
        localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(u));
        if (token) localStorage.setItem(STORAGE_KEY_TOKEN, token);
      } else {
        localStorage.removeItem(STORAGE_KEY_USER);
        localStorage.removeItem(STORAGE_KEY_TOKEN);
      }
    } catch {
      // ignore storage errors
    }
  }, []);

  // Check existing token and validate session with MongoDB on mount
  useEffect(() => {
    let isMounted = true;

    const verifySession = async () => {
      const token = localStorage.getItem(STORAGE_KEY_TOKEN);
      if (!token) {
        if (isMounted) setLoading(false);
        return;
      }

      try {
        const apiBase = getApiBaseUrl();
        const res = await fetch(`${apiBase}/api/auth/me`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (res.ok && isMounted) {
          const profile = await res.json();
          saveUserSession({
            uid: profile.id,
            email: profile.email,
            displayName: profile.name,
            photoURL: profile.picture,
            role: profile.role,
          });
        } else if (res.status === 401 && isMounted) {
          saveUserSession(null);
        }
      } catch (err) {
        console.warn('Session check warning:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    verifySession();

    return () => {
      isMounted = false;
    };
  }, [saveUserSession]);

  // Handle incoming Google credential from Google Identity Services
  const handleGoogleCredential = useCallback(
    async (credential: string) => {
      setLoading(true);
      setError(null);

      try {
        const apiBase = getApiBaseUrl();
        const res = await fetch(`${apiBase}/api/auth/google`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ credential }),
        });

        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.detail || 'Google authentication failed.');
        }

        saveUserSession(
          {
            uid: data.user.id,
            email: data.user.email,
            displayName: data.user.name,
            photoURL: data.user.picture,
            role: data.user.role,
          },
          data.token
        );
      } catch (err: any) {
        console.error('Google Sign-In Error:', err);
        setError(err.message || 'Failed to authenticate with Google.');
      } finally {
        setLoading(false);
      }
    },
    [saveUserSession]
  );

  // Initialize Google Identity Services
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const initGsi = () => {
      if (window.google?.accounts?.id) {
        window.google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: (response: { credential: string }) => {
            if (response.credential) {
              handleGoogleCredential(response.credential);
            }
          },
          auto_select: false,
          cancel_on_tap_outside: true,
        });
      }
    };

    if (window.google?.accounts?.id) {
      initGsi();
    } else {
      const interval = setInterval(() => {
        if (window.google?.accounts?.id) {
          clearInterval(interval);
          initGsi();
        }
      }, 300);
      return () => clearInterval(interval);
    }
  }, [handleGoogleCredential]);

  // Trigger Google Sign-In prompt
  const signInWithGoogle = useCallback(async () => {
    setError(null);

    if (window.google?.accounts?.id) {
      window.google.accounts.id.prompt((notification: any) => {
        if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
          // If One Tap is skipped, fallback to click popup or direct prompt
          console.log('Google One Tap notice:', notification.getNotDisplayedReason());
        }
      });
    } else {
      setError('Google Identity Services is loading. Please check your internet connection or try again in a moment.');
    }
  }, []);

  // Render official Google button into any container DOM element
  const renderGoogleButton = useCallback(
    (containerId: string) => {
      if (typeof window === 'undefined' || !window.google?.accounts?.id) return;
      const el = document.getElementById(containerId);
      if (!el) return;

      window.google.accounts.id.renderButton(el, {
        type: 'standard',
        theme: 'filled_black',
        size: 'large',
        text: 'signin_with',
        shape: 'pill',
        width: 320,
      });
    },
    []
  );

  const signOut = useCallback(async () => {
    setLoading(true);
    try {
      if (window.google?.accounts?.id) {
        window.google.accounts.id.disableAutoSelect();
      }
      saveUserSession(null);
    } finally {
      setLoading(false);
    }
  }, [saveUserSession]);

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
        renderGoogleButton,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export { useAuth } from './useAuth';
