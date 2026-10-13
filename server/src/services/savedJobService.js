import mongoose from 'mongoose';
import { SavedJob } from '../models/SavedJob.js';
import { Job } from '../models/Job.js';
import { logger } from '../utils/logger.js';

/**
 * Save a job for an authenticated user.
 * Prevents duplicate saves and validates job existence.
 *
 * @param {string|mongoose.Types.ObjectId} userId - Authenticated user's MongoDB ID
 * @param {string|mongoose.Types.ObjectId} jobId - Job listing MongoDB ID
 * @param {string} [notes=''] - Optional candidate notes
 * @returns {Promise<Object>} Created SavedJob document populated with job details
 */
export const saveJob = async (userId, jobId, notes = '') => {
  if (!userId) {
    const error = new Error('User ID is required');
    error.statusCode = 400;
    throw error;
  }

  if (!jobId || !mongoose.Types.ObjectId.isValid(jobId)) {
    const error = new Error('Invalid job ID format');
    error.statusCode = 400;
    error.code = 'INVALID_ID';
    throw error;
  }

  // Verify that the job listing actually exists
  const jobExists = await Job.findById(jobId).lean();
  if (!jobExists) {
    const error = new Error('Job listing not found');
    error.statusCode = 404;
    error.code = 'NOT_FOUND';
    throw error;
  }

  // Check if already saved by this user
  const existing = await SavedJob.findOne({ userId, jobId });
  if (existing) {
    const error = new Error('Job is already saved');
    error.statusCode = 409;
    error.code = 'ALREADY_SAVED';
    throw error;
  }

  try {
    const savedJob = await SavedJob.create({
      userId,
      jobId,
      notes: typeof notes === 'string' ? notes.trim() : '',
    });

    await savedJob.populate('jobId');
    logger.info(`User ${userId} saved job ${jobId}`);
    return savedJob;
  } catch (err) {
    // Catch MongoDB duplicate key error if concurrent save race happens
    if (err.code === 11000) {
      const error = new Error('Job is already saved');
      error.statusCode = 409;
      error.code = 'ALREADY_SAVED';
      throw error;
    }
    throw err;
  }
};

/**
 * Remove a saved job for the authenticated user.
 * Guarantees strict user isolation (users cannot delete each other's saved jobs).
 *
 * @param {string|mongoose.Types.ObjectId} userId - Authenticated user's MongoDB ID
 * @param {string|mongoose.Types.ObjectId} jobId - Job ID or SavedJob record ID
 * @returns {Promise<Object>}
 */
export const unsaveJob = async (userId, jobId) => {
  if (!userId) {
    const error = new Error('User ID is required');
    error.statusCode = 400;
    throw error;
  }

  if (!jobId || !mongoose.Types.ObjectId.isValid(jobId)) {
    const error = new Error('Invalid job ID format');
    error.statusCode = 400;
    error.code = 'INVALID_ID';
    throw error;
  }

  // Find and remove matching by (userId + jobId) OR by (userId + _id)
  let deleted = await SavedJob.findOneAndDelete({ userId, jobId });

  if (!deleted) {
    deleted = await SavedJob.findOneAndDelete({ _id: jobId, userId });
  }

  if (!deleted) {
    const error = new Error('Saved job record not found for this user');
    error.statusCode = 404;
    error.code = 'NOT_FOUND';
    throw error;
  }

  logger.info(`User ${userId} unsaved job ${jobId}`);
  return { success: true, message: 'Job removed from saved listings' };
};

/**
 * List all saved jobs for the authenticated user, populated with listing details.
 *
 * @param {string|mongoose.Types.ObjectId} userId - Authenticated user's MongoDB ID
 * @param {Object} [options]
 * @returns {Promise<{savedJobs: Array, total: number}>}
 */
export const getSavedJobs = async (userId, options = {}) => {
  if (!userId) {
    const error = new Error('User ID is required');
    error.statusCode = 400;
    throw error;
  }

  const query = { userId };

  const records = await SavedJob.find(query)
    .sort({ createdAt: -1 })
    .populate('jobId')
    .lean();

  // Filter out any entries where the underlying Job record may have been purged
  const validSavedJobs = records
    .filter((record) => record.jobId !== null && record.jobId !== undefined)
    .map((record) => ({
      _id: record._id,
      savedAt: record.createdAt,
      notes: record.notes,
      job: record.jobId,
    }));

  return {
    savedJobs: validSavedJobs,
    total: validSavedJobs.length,
  };
};

/**
 * Retrieve an array of Job IDs saved by the user.
 * Optimized for O(1) membership checks on the frontend.
 *
 * @param {string|mongoose.Types.ObjectId} userId - Authenticated user's MongoDB ID
 * @returns {Promise<Array<string>>} List of job ID strings
 */
export const getSavedJobIds = async (userId) => {
  if (!userId) {
    return [];
  }

  const records = await SavedJob.find({ userId })
    .select('jobId')
    .lean();

  return records
    .filter((r) => r.jobId)
    .map((r) => r.jobId.toString());
};

/**
 * Check whether a specific job is saved by the user.
 *
 * @param {string|mongoose.Types.ObjectId} userId
 * @param {string|mongoose.Types.ObjectId} jobId
 * @returns {Promise<boolean>}
 */
export const isJobSaved = async (userId, jobId) => {
  if (!userId || !jobId || !mongoose.Types.ObjectId.isValid(jobId)) {
    return false;
  }

  const exists = await SavedJob.exists({ userId, jobId });
  return Boolean(exists);
};

export default {
  saveJob,
  unsaveJob,
  getSavedJobs,
  getSavedJobIds,
  isJobSaved,
};
