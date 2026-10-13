import { initializeApp, getApps } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';

const rawApiKey = import.meta.env.VITE_FIREBASE_API_KEY;
const rawAuthDomain = import.meta.env.VITE_FIREBASE_AUTH_DOMAIN;
const rawProjectId = import.meta.env.VITE_FIREBASE_PROJECT_ID;
const rawSenderId = import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID;
const rawAppId = import.meta.env.VITE_FIREBASE_APP_ID;

const apiKey = (rawApiKey && typeof rawApiKey === 'string') ? rawApiKey.trim() : '';
const projectId = (rawProjectId && typeof rawProjectId === 'string') ? rawProjectId.trim() : '';
const authDomain = (rawAuthDomain && typeof rawAuthDomain === 'string') ? rawAuthDomain.trim() : '';
const messagingSenderId = (rawSenderId && typeof rawSenderId === 'string') ? rawSenderId.trim() : '';
const appId = (rawAppId && typeof rawAppId === 'string') ? rawAppId.trim() : '';

/**
 * Check if valid, non-placeholder Firebase credentials are provided in client environment.
 */
export const isFirebaseConfigured = Boolean(
  apiKey &&
  projectId &&
  apiKey !== 'your-api-key' &&
  projectId !== 'your-project-id' &&
  apiKey !== 'demo-api-key' &&
  projectId !== 'demo-project'
);

/**
 * Firebase Web Client Configuration
 * Uses VITE_FIREBASE_* environment variables without hardcoded or placeholder keys.
 */
const firebaseConfig = {
  apiKey: apiKey,
  authDomain: authDomain || (projectId ? `${projectId}.firebaseapp.com` : ''),
  projectId: projectId,
  messagingSenderId: messagingSenderId,
  appId: appId,
};

// Initialize Firebase safely only if configured with valid, non-placeholder credentials
let app = null;
let auth = null;
let googleProvider = null;

if (isFirebaseConfigured) {
  try {
    app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
    auth = getAuth(app);
    googleProvider = new GoogleAuthProvider();
    googleProvider.setCustomParameters({ prompt: 'select_account' });
  } catch (error) {
    console.warn('Firebase initialization skipped or failed:', error?.message);
    app = null;
    auth = null;
    googleProvider = null;
  }
}

export { app, auth, googleProvider };

/**
 * Helper to retrieve the current user's Firebase ID token
 * @param {boolean} forceRefresh - Whether to force a token refresh
 * @returns {Promise<string|null>}
 */
export const getIdToken = async (forceRefresh = false) => {
  if (!auth?.currentUser) return null;
  return auth.currentUser.getIdToken(forceRefresh);
};

export default app;
