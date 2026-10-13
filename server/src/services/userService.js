import User from '../models/User.js';
import { logger } from '../utils/logger.js';

/**
 * Find or create a MongoDB User record from authenticated Firebase user data.
 * @param {Object} firebaseUser - Decoded Firebase ID token object from requireAuth
 * @returns {Promise<User>} The MongoDB User document
 */
export const findOrCreateUserFromFirebase = async (firebaseUser) => {
  if (!firebaseUser || !firebaseUser.uid) {
    throw new Error('Valid Firebase user data with uid is required');
  }

  const firebaseUid = firebaseUser.uid;
  const email = (firebaseUser.email || `${firebaseUid}@app.user`).toLowerCase().trim();
  const name = (firebaseUser.name || firebaseUser.displayName || '').trim();
  const authProvider =
    firebaseUser.firebase?.sign_in_provider ||
    (firebaseUser.isDemo ? 'demo' : 'password');

  // Search for existing user in MongoDB by firebaseUid
  let user = await User.findOne({ firebaseUid });

  if (!user) {
    logger.info(`Creating new MongoDB user record for Firebase UID: ${firebaseUid}`);
    user = await User.create({
      firebaseUid,
      name,
      email,
      authProvider,
      profileId: null,
      onboardingCompleted: false,
    });
    return user;
  }

  // Synchronize details if newly available from Firebase
  let hasChanges = false;

  if (email && user.email !== email) {
    user.email = email;
    hasChanges = true;
  }

  if (name && !user.name) {
    user.name = name;
    hasChanges = true;
  }

  if (authProvider && (!user.authProvider || user.authProvider === 'password')) {
    user.authProvider = authProvider;
    hasChanges = true;
  }

  if (hasChanges) {
    await user.save();
    logger.info(`Synchronized MongoDB user details for Firebase UID: ${firebaseUid}`);
  }

  return user;
};

/**
 * Retrieve user by Firebase UID
 * @param {string} firebaseUid
 * @returns {Promise<User|null>}
 */
export const getUserByFirebaseUid = async (firebaseUid) => {
  return User.findOne({ firebaseUid });
};

/**
 * Retrieve user by MongoDB ID
 * @param {string} id
 * @returns {Promise<User|null>}
 */
export const getUserById = async (id) => {
  return User.findById(id);
};

export default {
  findOrCreateUserFromFirebase,
  getUserByFirebaseUid,
  getUserById,
};
