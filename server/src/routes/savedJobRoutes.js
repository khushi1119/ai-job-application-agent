import { Router } from 'express';
import { requireAuth } from '../middleware/authMiddleware.js';
import {
  saveJobHandler,
  unsaveJobHandler,
  getSavedJobsHandler,
  getSavedJobIdsHandler,
  checkJobSavedHandler,
} from '../controllers/savedJobController.js';

const router = Router();

/**
 * @route   GET /api/saved-jobs
 * @desc    List all saved jobs for current authenticated user
 * @access  Private (Requires Bearer Firebase ID Token)
 */
router.get('/', requireAuth, getSavedJobsHandler);

/**
 * @route   GET /api/saved-jobs/ids
 * @desc    Get array of all job IDs saved by current user
 * @access  Private (Requires Bearer Firebase ID Token)
 */
router.get('/ids', requireAuth, getSavedJobIdsHandler);

/**
 * @route   GET /api/saved-jobs/check/:jobId
 * @desc    Check whether a specific job is saved by current user
 * @access  Private (Requires Bearer Firebase ID Token)
 */
router.get('/check/:jobId', requireAuth, checkJobSavedHandler);

/**
 * @route   POST /api/saved-jobs
 * @desc    Save a job listing
 * @access  Private (Requires Bearer Firebase ID Token)
 */
router.post('/', requireAuth, saveJobHandler);

/**
 * @route   DELETE /api/saved-jobs/:jobId
 * @desc    Unsave a job listing
 * @access  Private (Requires Bearer Firebase ID Token)
 */
router.delete('/:jobId', requireAuth, unsaveJobHandler);

export default router;
