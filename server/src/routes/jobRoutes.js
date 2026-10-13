import { Router } from 'express';
import { requireAuth } from '../middleware/authMiddleware.js';
import { requireAdmin } from '../middleware/adminMiddleware.js';
import { jobSyncLimiter, recommendationLimiter } from '../middleware/rateLimitMiddleware.js';
import { getJobs, getJob, syncJobs, getRecommendedJobs } from '../controllers/jobController.js';

const router = Router();

/**
 * @route   GET /api/jobs
 * @desc    Search and filter job listings with pagination
 * @access  Private (Requires Bearer Firebase ID Token)
 */
router.get('/', requireAuth, getJobs);

/**
 * @route   POST /api/jobs/sync
 * @desc    Trigger safe synchronization of job listings from configured ATS boards
 * @access  Private (Requires Bearer Firebase ID Token with Administrator authorization)
 */
router.post('/sync', requireAuth, requireAdmin, jobSyncLimiter, syncJobs);

/**
 * @route   GET /api/jobs/recommended
 * @desc    Get ML-recommended job listings based on candidate profile and resume
 * @access  Private (Requires Bearer Firebase ID Token)
 */
router.get('/recommended', requireAuth, recommendationLimiter, getRecommendedJobs);

/**
 * @route   GET /api/jobs/:id
 * @desc    Retrieve a single job listing by ID
 * @access  Private (Requires Bearer Firebase ID Token)
 */
router.get('/:id', requireAuth, getJob);

export default router;
