import { Router } from 'express';
import { requireAuth } from '../middleware/authMiddleware.js';
import {
  createApplicationHandler,
  getApplicationsHandler,
  getApplicationStatsHandler,
  getTrackedJobIdsHandler,
  getApplicationByIdHandler,
  updateApplicationHandler,
  deleteApplicationHandler,
} from '../controllers/applicationController.js';

const router = Router();

/**
 * @route   GET /api/applications/stats
 * @desc    Get aggregated application metrics for current user (total, applied, interview, rejected, offer)
 * @access  Private (Requires Bearer Firebase ID Token)
 */
router.get('/stats', requireAuth, getApplicationStatsHandler);

/**
 * @route   GET /api/applications/ids
 * @desc    Get array of Job IDs currently tracked by current user
 * @access  Private (Requires Bearer Firebase ID Token)
 */
router.get('/ids', requireAuth, getTrackedJobIdsHandler);

/**
 * @route   GET /api/applications
 * @desc    List all tracked applications for current user with optional status filter and search
 * @access  Private (Requires Bearer Firebase ID Token)
 */
router.get('/', requireAuth, getApplicationsHandler);

/**
 * @route   POST /api/applications
 * @desc    Create/track a new application
 * @access  Private (Requires Bearer Firebase ID Token)
 */
router.post('/', requireAuth, createApplicationHandler);

/**
 * @route   GET /api/applications/:id
 * @desc    Get a single application by ID
 * @access  Private (Requires Bearer Firebase ID Token)
 */
router.get('/:id', requireAuth, getApplicationByIdHandler);

/**
 * @route   PUT /api/applications/:id
 * @desc    Update application status, notes, or details
 * @access  Private (Requires Bearer Firebase ID Token)
 */
router.put('/:id', requireAuth, updateApplicationHandler);

/**
 * @route   PATCH /api/applications/:id
 * @desc    Partial update application status, notes, or details
 * @access  Private (Requires Bearer Firebase ID Token)
 */
router.patch('/:id', requireAuth, updateApplicationHandler);

/**
 * @route   DELETE /api/applications/:id
 * @desc    Delete a tracked application
 * @access  Private (Requires Bearer Firebase ID Token)
 */
router.delete('/:id', requireAuth, deleteApplicationHandler);

export default router;
