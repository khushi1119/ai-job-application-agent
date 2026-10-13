import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { env } from './env.js';
import { logger } from '../utils/logger.js';

let firebaseApp = null;
let firebaseAuth = null;

/**
 * Initialize Firebase Admin SDK using service account credentials.
 * If credentials are not present in environment, logs a warning and returns null.
 */
export const initFirebaseAdmin = () => {
  if (firebaseApp && firebaseAuth) {
    return { app: firebaseApp, auth: firebaseAuth };
  }

  const existingApps = getApps();
  if (existingApps.length > 0) {
    firebaseApp = existingApps[0];
    firebaseAuth = getAuth(firebaseApp);
    return { app: firebaseApp, auth: firebaseAuth };
  }

  const { PROJECT_ID, CLIENT_EMAIL, PRIVATE_KEY } = env.FIREBASE;

  if (!PROJECT_ID || !CLIENT_EMAIL || !PRIVATE_KEY) {
    if (env.isProduction) {
      logger.error('Firebase Admin credentials not configured in production environment.');
    } else {
      logger.warn('Firebase Admin credentials not configured in environment.');
    }
    return null;
  }

  try {
    logger.info('Initializing Firebase Admin SDK with provided credentials...');
    firebaseApp = initializeApp({
      credential: cert({
        projectId: PROJECT_ID,
        clientEmail: CLIENT_EMAIL,
        privateKey: PRIVATE_KEY,
      }),
    });
    firebaseAuth = getAuth(firebaseApp);
    logger.info('Firebase Admin SDK initialized successfully.');
    return { app: firebaseApp, auth: firebaseAuth };
  } catch (error) {
    logger.error('Failed to initialize Firebase Admin SDK:', error.message);
    firebaseApp = null;
    firebaseAuth = null;
    return null;
  }
};

/**
 * Get active FirebaseAuth instance or initialize if possible
 */
export const getFirebaseAuth = () => {
  if (!firebaseAuth) {
    const initialized = initFirebaseAdmin();
    return initialized ? initialized.auth : null;
  }
  return firebaseAuth;
};

/**
 * Get active FirebaseApp instance
 */
export const getFirebaseApp = () => {
  if (!firebaseApp) {
    const initialized = initFirebaseAdmin();
    return initialized ? initialized.app : null;
  }
  return firebaseApp;
};

/**
 * Verifies that Firebase Admin is properly initialized in production.
 * In production, fails closed and throws an Error without exposing secrets or private keys.
 */
export const verifyProductionFirebaseConfig = (firebaseInstance = initFirebaseAdmin()) => {
  if (!env.isProduction) return true;
  if (!firebaseInstance?.auth) {
    throw new Error(
      'Firebase Admin authentication failed to initialize in production environment. Server startup aborted to prevent unauthenticated operation.'
    );
  }
  return true;
};

export default {
  initFirebaseAdmin,
  getFirebaseAuth,
  getFirebaseApp,
  verifyProductionFirebaseConfig,
};
