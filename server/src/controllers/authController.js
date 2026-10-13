import { findOrCreateUserFromFirebase } from '../services/userService.js';
import Resume from '../models/Resume.js';
import Profile from '../models/Profile.js';
import { sendSuccess, sendError } from '../utils/apiResponse.js';
import { logger } from '../utils/logger.js';

/**
 * Controller to fetch or synchronize the authenticated Firebase user in MongoDB.
 * Route: GET /api/auth/me
 * Access: Private (Requires valid Firebase ID Token)
 */
export const getCurrentUser = async (req, res) => {
  try {
    const user = await findOrCreateUserFromFirebase(req.user);

    // Check if user has an uploaded resume
    const latestResume = await Resume.findOne({ userId: user._id }).sort({ version: -1 });
    const hasResume = Boolean(
      latestResume && (latestResume.storageUrl || latestResume.parsed?.rawText)
    );

    // Check if user has a created profile with meaningful data
    const userProfile = await Profile.findOne({ userId: user._id });
    const hasProfile = Boolean(userProfile && (userProfile.completionPercentage || 0) >= 15);

    // onboardingCompleted is true only after profile has been confirmed/created
    const onboardingCompleted = Boolean(user.onboardingCompleted && hasProfile && hasResume);

    return sendSuccess(
      res,
      {
        user,
        hasResume,
        hasProfile,
        onboardingCompleted,
      },
      'Authenticated user profile retrieved successfully'
    );
  } catch (error) {
    logger.error('Error in getCurrentUser controller:', error);
    return sendError(res, 'Failed to retrieve or synchronize user profile', 500, error.message);
  }
};

export default {
  getCurrentUser,
};

