import {
  saveJob,
  unsaveJob,
  getSavedJobs,
  getSavedJobIds,
  isJobSaved,
} from '../services/savedJobService.js';
import { findOrCreateUserFromFirebase } from '../services/userService.js';
import { sendSuccess, sendError } from '../utils/apiResponse.js';
import { logger } from '../utils/logger.js';

/**
 * Controller to save a job for the authenticated user.
 * Route: POST /api/saved-jobs
 */
export const saveJobHandler = async (req, res) => {
  try {
    const user = await findOrCreateUserFromFirebase(req.user);
    const { jobId, notes } = req.body;

    if (!jobId) {
      return sendError(res, 'Job ID is required in request body', 400, 'JOB_ID_REQUIRED');
    }

    const savedJob = await saveJob(user._id, jobId, notes);

    return sendSuccess(
      res,
      savedJob,
      'Job bookmarked successfully',
      201
    );
  } catch (error) {
    logger.error('Error in saveJobHandler:', error);
    const statusCode = error.statusCode || 500;
    return sendError(
      res,
      error.message || 'Failed to save job',
      statusCode,
      error.code || error.message
    );
  }
};

/**
 * Controller to remove a saved job for the authenticated user.
 * Route: DELETE /api/saved-jobs/:jobId
 */
export const unsaveJobHandler = async (req, res) => {
  try {
    const user = await findOrCreateUserFromFirebase(req.user);
    const { jobId } = req.params;

    if (!jobId) {
      return sendError(res, 'Job ID is required in URL parameter', 400, 'JOB_ID_REQUIRED');
    }

    const result = await unsaveJob(user._id, jobId);

    return sendSuccess(
      res,
      result,
      'Job removed from saved listings',
      200
    );
  } catch (error) {
    logger.error(`Error in unsaveJobHandler for jobId ${req.params?.jobId}:`, error);
    const statusCode = error.statusCode || 500;
    return sendError(
      res,
      error.message || 'Failed to remove saved job',
      statusCode,
      error.code || error.message
    );
  }
};

/**
 * Controller to list all saved jobs for the authenticated user.
 * Route: GET /api/saved-jobs
 */
export const getSavedJobsHandler = async (req, res) => {
  try {
    const user = await findOrCreateUserFromFirebase(req.user);
    const result = await getSavedJobs(user._id);

    return sendSuccess(
      res,
      result,
      'Saved jobs retrieved successfully',
      200
    );
  } catch (error) {
    logger.error('Error in getSavedJobsHandler:', error);
    const statusCode = error.statusCode || 500;
    return sendError(
      res,
      error.message || 'Failed to retrieve saved jobs',
      statusCode,
      error.code || error.message
    );
  }
};

/**
 * Controller to get all saved job IDs for the authenticated user.
 * Route: GET /api/saved-jobs/ids
 */
export const getSavedJobIdsHandler = async (req, res) => {
  try {
    const user = await findOrCreateUserFromFirebase(req.user);
    const ids = await getSavedJobIds(user._id);

    return sendSuccess(
      res,
      { ids },
      'Saved job IDs retrieved successfully',
      200
    );
  } catch (error) {
    logger.error('Error in getSavedJobIdsHandler:', error);
    const statusCode = error.statusCode || 500;
    return sendError(
      res,
      error.message || 'Failed to retrieve saved job IDs',
      statusCode,
      error.code || error.message
    );
  }
};

/**
 * Controller to check if a specific job is saved.
 * Route: GET /api/saved-jobs/check/:jobId
 */
export const checkJobSavedHandler = async (req, res) => {
  try {
    const user = await findOrCreateUserFromFirebase(req.user);
    const { jobId } = req.params;

    const isSaved = await isJobSaved(user._id, jobId);

    return sendSuccess(
      res,
      { isSaved },
      'Job saved status retrieved',
      200
    );
  } catch (error) {
    logger.error(`Error in checkJobSavedHandler for jobId ${req.params?.jobId}:`, error);
    const statusCode = error.statusCode || 500;
    return sendError(
      res,
      error.message || 'Failed to check saved job status',
      statusCode,
      error.code || error.message
    );
  }
};

export default {
  saveJobHandler,
  unsaveJobHandler,
  getSavedJobsHandler,
  getSavedJobIdsHandler,
  checkJobSavedHandler,
};
