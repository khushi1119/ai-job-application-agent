import { Router } from 'express';
import { requireAuth } from '../middleware/authMiddleware.js';
import { getProfile, updateProfile } from '../controllers/profileController.js';

const router = Router();

/**
 * @route   GET /api/profile/me
 * @desc    Get current authenticated user's profile
 * @access  Private (Requires Bearer Firebase ID Token)
 */
router.get('/me', requireAuth, getProfile);

/**
 * @route   PUT /api/profile/me
 * @desc    Create or update profile and associate profileId with user
 * @access  Private (Requires Bearer Firebase ID Token)
 */
router.put('/me', requireAuth, updateProfile);

export default router;
