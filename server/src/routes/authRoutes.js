import { Router } from 'express';
import { requireAuth } from '../middleware/authMiddleware.js';
import { getCurrentUser } from '../controllers/authController.js';

const router = Router();

/**
 * @route   GET /api/auth/me
 * @desc    Get or sync current authenticated user profile
 * @access  Private (Requires Bearer Firebase ID Token)
 */
router.get('/me', requireAuth, getCurrentUser);

export default router;
