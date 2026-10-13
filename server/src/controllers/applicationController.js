import {
  createApplication,
  getApplications,
  getApplicationStats,
  getApplicationById,
  updateApplication,
  deleteApplication,
  getTrackedJobIds,
} from '../services/applicationService.js';
import { findOrCreateUserFromFirebase } from '../services/userService.js';
import { sendSuccess, sendError } from '../utils/apiResponse.js';
import { logger } from '../utils/logger.js';

/**
 * Controller to create / track a new job application.
 * Route: POST /api/applications
 */
export const createApplicationHandler = async (req, res) => {
  try {
    const user = await findOrCreateUserFromFirebase(req.user);
    const application = await createApplication(user._id, req.body);

    return sendSuccess(
      res,
      application,
      'Application tracked successfully',
      201
    );
  } catch (error) {
    logger.error('Error in createApplicationHandler:', error);
    const statusCode = error.statusCode || 500;
    return sendError(
      res,
      error.message || 'Failed to track application',
      statusCode,
      error.code || error.message
    );
  }
};

/**
 * Controller to list tracked applications for authenticated user.
 * Route: GET /api/applications
 */
export const getApplicationsHandler = async (req, res) => {
  try {
    const user = await findOrCreateUserFromFirebase(req.user);
    const result = await getApplications(user._id, req.query);

    return sendSuccess(
      res,
      result,
      'Applications retrieved successfully',
      200
    );
  } catch (error) {
    logger.error('Error in getApplicationsHandler:', error);
    const statusCode = error.statusCode || 500;
    return sendError(
      res,
      error.message || 'Failed to retrieve applications',
      statusCode,
      error.code || error.message
    );
  }
};

/**
 * Controller to get summary stats (total, applied, interview, rejected, offer).
 * Route: GET /api/applications/stats
 */
export const getApplicationStatsHandler = async (req, res) => {
  try {
    const user = await findOrCreateUserFromFirebase(req.user);
    const stats = await getApplicationStats(user._id);

    return sendSuccess(
      res,
      stats,
      'Application statistics retrieved successfully',
      200
    );
  } catch (error) {
    logger.error('Error in getApplicationStatsHandler:', error);
    const statusCode = error.statusCode || 500;
    return sendError(
      res,
      error.message || 'Failed to retrieve application statistics',
      statusCode,
      error.code || error.message
    );
  }
};

/**
 * Controller to get list of Job IDs tracked by current user.
 * Route: GET /api/applications/ids
 */
export const getTrackedJobIdsHandler = async (req, res) => {
  try {
    const user = await findOrCreateUserFromFirebase(req.user);
    const ids = await getTrackedJobIds(user._id);

    return sendSuccess(
      res,
      { ids },
      'Tracked job IDs retrieved successfully',
      200
    );
  } catch (error) {
    logger.error('Error in getTrackedJobIdsHandler:', error);
    const statusCode = error.statusCode || 500;
    return sendError(
      res,
      error.message || 'Failed to retrieve tracked job IDs',
      statusCode,
      error.code || error.message
    );
  }
};

/**
 * Controller to retrieve a single application by ID.
 * Route: GET /api/applications/:id
 */
export const getApplicationByIdHandler = async (req, res) => {
  try {
    const user = await findOrCreateUserFromFirebase(req.user);
    const application = await getApplicationById(user._id, req.params.id);

    return sendSuccess(
      res,
      application,
      'Application retrieved successfully',
      200
    );
  } catch (error) {
    logger.error(`Error in getApplicationByIdHandler for id ${req.params?.id}:`, error);
    const statusCode = error.statusCode || 500;
    return sendError(
      res,
      error.message || 'Failed to retrieve application',
      statusCode,
      error.code || error.message
    );
  }
};

/**
 * Controller to update application status, notes, or details.
 * Route: PUT/PATCH /api/applications/:id
 */
export const updateApplicationHandler = async (req, res) => {
  try {
    const user = await findOrCreateUserFromFirebase(req.user);
    const application = await updateApplication(user._id, req.params.id, req.body);

    return sendSuccess(
      res,
      application,
      'Application updated successfully',
      200
    );
  } catch (error) {
    logger.error(`Error in updateApplicationHandler for id ${req.params?.id}:`, error);
    const statusCode = error.statusCode || 500;
    return sendError(
      res,
      error.message || 'Failed to update application',
      statusCode,
      error.code || error.message
    );
  }
};

/**
 * Controller to delete an application.
 * Route: DELETE /api/applications/:id
 */
export const deleteApplicationHandler = async (req, res) => {
  try {
    const user = await findOrCreateUserFromFirebase(req.user);
    const result = await deleteApplication(user._id, req.params.id);

    return sendSuccess(
      res,
      result,
      'Application deleted successfully',
      200
    );
  } catch (error) {
    logger.error(`Error in deleteApplicationHandler for id ${req.params?.id}:`, error);
    const statusCode = error.statusCode || 500;
    return sendError(
      res,
      error.message || 'Failed to delete application',
      statusCode,
      error.code || error.message
    );
  }
};

export default {
  createApplicationHandler,
  getApplicationsHandler,
  getApplicationStatsHandler,
  getTrackedJobIdsHandler,
  getApplicationByIdHandler,
  updateApplicationHandler,
  deleteApplicationHandler,
};
