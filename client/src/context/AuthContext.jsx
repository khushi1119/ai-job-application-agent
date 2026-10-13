import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  onAuthStateChanged,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  updateProfile,
  signOut,
} from 'firebase/auth';
import { auth, googleProvider, isFirebaseConfigured, getIdToken as getFirebaseIdToken } from '../firebase/firebase.js';
import { authService } from '../services/api.js';

/**
 * Format Firebase error codes into human-readable messages
 */
export const formatAuthError = (error) => {
  if (!error) return 'An unexpected error occurred.';
  const code = error.code || '';

  switch (code) {
    case 'auth/email-already-in-use':
      return 'An account with this email address already exists.';
    case 'auth/invalid-email':
      return 'Please provide a valid email address.';
    case 'auth/weak-password':
      return 'Password should be at least 6 characters.';
    case 'auth/user-not-found':
      return 'No account found with this email address.';
    case 'auth/wrong-password':
      return 'Incorrect password. Please try again.';
    case 'auth/invalid-credential':
      return 'Invalid email or password. Please verify your credentials.';
    case 'auth/user-disabled':
      return 'This user account has been disabled.';
    case 'auth/popup-closed-by-user':
      return 'Sign-in popup was closed before completing.';
    case 'auth/popup-blocked':
      return 'Sign-in popup was blocked by your browser. Please allow popups for this site.';
    case 'auth/network-request-failed':
      return 'Network connection error. Please check your internet connection.';
    case 'auth/api-key-not-valid':
    case 'auth/invalid-api-key':
      return 'The Firebase API key is invalid. Please check the VITE_FIREBASE_API_KEY value in client/.env.';
    case 'auth/too-many-requests':
      return 'Too many failed login attempts. Please try again later.';
    default:
      return error.message || 'Authentication failed. Please try again.';
  }
};

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [mongoUser, setMongoUser] = useState(null);
  const [loading, setLoading] = useState(true);

  /**
   * Synchronize the authenticated user with backend MongoDB (/api/auth/me)
   */
  const syncUserWithBackend = async () => {
    try {
      const response = await authService.getMe();
      const payload = response?.data || {};
      const user = payload.user
        ? {
            ...payload.user,
            hasResume: payload.hasResume ?? false,
            hasProfile: payload.hasProfile ?? false,
            onboardingCompleted:
              payload.onboardingCompleted ?? payload.user.onboardingCompleted ?? false,
          }
        : null;
      setMongoUser(user);
      return user;
    } catch (syncError) {
      console.warn('Backend MongoDB sync skipped or failed:', syncError?.message || syncError);
      setMongoUser(null);
      return null;
    }
  };

  /**
   * Listen for Firebase auth state changes on mount
   */
  useEffect(() => {
    if (!isFirebaseConfigured || !auth) {
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        await syncUserWithBackend();
      } else {
        setMongoUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  /**
   * Sign in with Google Popup
   */
  const loginWithGoogle = async () => {
    if (!isFirebaseConfigured || !auth || !googleProvider) {
      throw new Error('Firebase credentials are not configured in client environment.');
    }
    try {
      const userCredential = await signInWithPopup(auth, googleProvider);
      await syncUserWithBackend();
      return userCredential;
    } catch (error) {
      error.friendlyMessage = formatAuthError(error);
      throw error;
    }
  };

  /**
   * Sign in with Email and Password
   */
  const login = async (email, password) => {
    if (!isFirebaseConfigured || !auth) {
      throw new Error('Firebase credentials are not configured in client environment.');
    }
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      await syncUserWithBackend();
      return userCredential;
    } catch (error) {
      error.friendlyMessage = formatAuthError(error);
      throw error;
    }
  };

  /**
   * Register with Email and Password, optionally setting displayName
   */
  const signup = async (email, password, displayName = '') => {
    if (!isFirebaseConfigured || !auth) {
      throw new Error('Firebase credentials are not configured in client environment.');
    }
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      if (displayName && userCredential.user) {
        await updateProfile(userCredential.user, { displayName });
      }
      await syncUserWithBackend();
      return userCredential;
    } catch (error) {
      error.friendlyMessage = formatAuthError(error);
      throw error;
    }
  };

  /**
   * Send password reset email
   */
  const resetPassword = async (email) => {
    if (!isFirebaseConfigured || !auth) {
      throw new Error('Firebase credentials are not configured in client environment.');
    }
    try {
      return await sendPasswordResetEmail(auth, email);
    } catch (error) {
      error.friendlyMessage = formatAuthError(error);
      throw error;
    }
  };

  /**
   * Sign out current user
   */
  const logout = async () => {
    if (!isFirebaseConfigured || !auth) {
      setCurrentUser(null);
      setMongoUser(null);
      return Promise.resolve();
    }
    try {
      await signOut(auth);
      setCurrentUser(null);
      setMongoUser(null);
    } catch (error) {
      error.friendlyMessage = formatAuthError(error);
      throw error;
    }
  };

  /**
   * Retrieve current user's Firebase ID token
   */
  const getIdToken = (forceRefresh = false) => {
    return getFirebaseIdToken(forceRefresh);
  };

  const value = {
    currentUser,
    mongoUser,
    loading,
    isConfigured: isFirebaseConfigured,
    // Core Auth Methods
    login,
    loginWithEmail: login,
    signup,
    signupWithEmail: signup,
    loginWithGoogle,
    logout,
    resetPassword,
    sendPasswordReset: resetPassword,
    // Utilities
    syncUser: syncUserWithBackend,
    getIdToken,
    formatAuthError,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;
