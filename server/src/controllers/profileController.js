import { getMyProfile, createOrUpdateProfile } from '../services/profileService.js';
import { findOrCreateUserFromFirebase } from '../services/userService.js';
import { sendSuccess, sendError } from '../utils/apiResponse.js';
import { logger } from '../utils/logger.js';

/**
 * Controller to fetch the authenticated user's Candidate Profile.
 * Route: GET /api/profile/me
 * Access: Private (Requires Bearer Firebase ID Token)
 */
export const getProfile = async (req, res) => {
  try {
    const user = await findOrCreateUserFromFirebase(req.user);
    const profile = await getMyProfile(user._id);

    return sendSuccess(
      res,
      { profile },
      profile ? 'Profile retrieved successfully' : 'No profile found for this user'
    );
  } catch (error) {
    logger.error('Error in getProfile controller:', error);
    return sendError(res, 'Failed to retrieve profile', 500, error.message);
  }
};

/**
 * Controller to create or update the authenticated user's Candidate Profile.
 * Associating profileId with User and marking onboardingCompleted=true when verified.
 * Route: PUT /api/profile/me
 * Access: Private (Requires Bearer Firebase ID Token)
 */
export const updateProfile = async (req, res) => {
  try {
    const user = await findOrCreateUserFromFirebase(req.user);

    // Update profile and mark onboardingCompleted = true
    const profile = await createOrUpdateProfile(user._id, req.body, true);

    return sendSuccess(
      res,
      { profile },
      'Profile updated and verified successfully',
      200
    );
  } catch (error) {
    logger.error('Error in updateProfile controller:', error);
    if (error.name === 'ValidationError') {
      return sendError(res, error.message || 'Validation failed for profile data', 400, error.message);
    }
    return sendError(res, 'Failed to update profile', 500, error.message);
  }
};

export default {
  getProfile,
  updateProfile,
};
