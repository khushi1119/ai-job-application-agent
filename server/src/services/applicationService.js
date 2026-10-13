import mongoose from 'mongoose';
import { Application } from '../models/Application.js';
import { Job } from '../models/Job.js';
import { logger } from '../utils/logger.js';

export const VALID_STATUSES = ['Applied', 'Interview', 'Rejected', 'Offer'];

/**
 * Normalizes and validates an application status string against canonical statuses.
 * @param {string} status
 * @returns {string} Normalized canonical status ('Applied', 'Interview', 'Rejected', 'Offer')
 */
export const normalizeStatus = (status) => {
  if (!status || typeof status !== 'string') {
    return 'Applied';
  }

  const trimmed = status.trim().toLowerCase();
  const matched = VALID_STATUSES.find((s) => s.toLowerCase() === trimmed);

  if (!matched) {
    const error = new Error(
      `Invalid status: "${status}". Supported statuses are: ${VALID_STATUSES.join(', ')}`
    );
    error.statusCode = 400;
    error.code = 'INVALID_STATUS';
    throw error;
  }

  return matched;
};

/**
 * Create a new tracked application record.
 * Validates inputs, prevents duplicate tracking when jobId is available,
 * and maintains strict user data isolation.
 *
 * @param {string|mongoose.Types.ObjectId} userId - Authenticated user's MongoDB ID
 * @param {Object} data - Application payload
 * @returns {Promise<Object>} Created Application document
 */
export const createApplication = async (userId, data = {}) => {
  if (!userId) {
    const error = new Error('User ID is required');
    error.statusCode = 400;
    throw error;
  }

  let { jobId, company, jobTitle, applicationUrl, status, appliedAt, notes } = data;

  let validatedJobId = null;
  let jobRecord = null;

  // If a jobId is provided, validate format and verify listing exists
  if (jobId) {
    if (!mongoose.Types.ObjectId.isValid(jobId)) {
      const error = new Error('Invalid job ID format');
      error.statusCode = 400;
      error.code = 'INVALID_ID';
      throw error;
    }

    validatedJobId = new mongoose.Types.ObjectId(jobId);

    // Verify existing Job record
    jobRecord = await Job.findById(validatedJobId).lean();
    if (!jobRecord) {
      const error = new Error('Job listing not found');
      error.statusCode = 404;
      error.code = 'NOT_FOUND';
      throw error;
    }

    // Check for existing tracked application for this user and job
    const existing = await Application.findOne({ userId, jobId: validatedJobId });
    if (existing) {
      const error = new Error('This job listing is already being tracked');
      error.statusCode = 409;
      error.code = 'ALREADY_TRACKED';
      throw error;
    }

    // Default missing company / title / url from the referenced Job record
    if (!company && jobRecord.company) {
      company = jobRecord.company;
    }
    if (!jobTitle && jobRecord.title) {
      jobTitle = jobRecord.title;
    }
    if (!applicationUrl && jobRecord.sourceUrl) {
      applicationUrl = jobRecord.sourceUrl;
    }
  }

  // Validate company name
  if (!company || typeof company !== 'string' || !company.trim()) {
    const error = new Error('Company name is required');
    error.statusCode = 400;
    error.code = 'COMPANY_REQUIRED';
    throw error;
  }

  // Validate job title
  if (!jobTitle || typeof jobTitle !== 'string' || !jobTitle.trim()) {
    const error = new Error('Job title is required');
    error.statusCode = 400;
    error.code = 'JOB_TITLE_REQUIRED';
    throw error;
  }

  const normalizedStatus = normalizeStatus(status || 'Applied');

  let parsedAppliedAt = new Date();
  if (appliedAt) {
    const d = new Date(appliedAt);
    if (!isNaN(d.getTime())) {
      parsedAppliedAt = d;
    }
  }

  try {
    const application = await Application.create({
      userId,
      jobId: validatedJobId,
      company: company.trim(),
      jobTitle: jobTitle.trim(),
      applicationUrl: typeof applicationUrl === 'string' ? applicationUrl.trim() : '',
      status: normalizedStatus,
      appliedAt: parsedAppliedAt,
      notes: typeof notes === 'string' ? notes.trim() : '',
    });

    if (validatedJobId) {
      await application.populate('jobId');
    }

    logger.info(`User ${userId} tracked application for ${company.trim()} - ${jobTitle.trim()}`);
    return application;
  } catch (err) {
    if (err.code === 11000) {
      const error = new Error('This job listing is already being tracked');
      error.statusCode = 409;
      error.code = 'ALREADY_TRACKED';
      throw error;
    }
    throw err;
  }
};

/**
 * List tracked applications for the authenticated user.
 * Supports status filtering and keyword search.
 *
 * @param {string|mongoose.Types.ObjectId} userId - Authenticated user's MongoDB ID
 * @param {Object} [options] - Filter parameters { status, search }
 * @returns {Promise<{applications: Array, total: number}>}
 */
export const getApplications = async (userId, options = {}) => {
  if (!userId) {
    const error = new Error('User ID is required');
    error.statusCode = 400;
    throw error;
  }

  const query = { userId };

  if (options.status && options.status !== 'All') {
    query.status = normalizeStatus(options.status);
  }

  if (options.search && typeof options.search === 'string' && options.search.trim()) {
    const sanitizedSearch = options.search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const searchRegex = new RegExp(sanitizedSearch, 'i');
    query.$or = [{ company: searchRegex }, { jobTitle: searchRegex }];
  }

  const applications = await Application.find(query)
    .sort({ appliedAt: -1, createdAt: -1 })
    .populate('jobId')
    .lean();

  return {
    applications,
    total: applications.length,
  };
};

/**
 * Get aggregated application statistics for the authenticated user.
 *
 * @param {string|mongoose.Types.ObjectId} userId
 * @returns {Promise<{total: number, applied: number, interview: number, rejected: number, offer: number}>}
 */
export const getApplicationStats = async (userId) => {
  if (!userId) {
    return {
      total: 0,
      applied: 0,
      interview: 0,
      rejected: 0,
      offer: 0,
    };
  }

  const [total, applied, interview, rejected, offer] = await Promise.all([
    Application.countDocuments({ userId }),
    Application.countDocuments({ userId, status: 'Applied' }),
    Application.countDocuments({ userId, status: 'Interview' }),
    Application.countDocuments({ userId, status: 'Rejected' }),
    Application.countDocuments({ userId, status: 'Offer' }),
  ]);

  return {
    total,
    applied,
    interview,
    rejected,
    offer,
  };
};

/**
 * Retrieve a single application by ID with strict user isolation.
 *
 * @param {string|mongoose.Types.ObjectId} userId
 * @param {string} applicationId
 * @returns {Promise<Object>}
 */
export const getApplicationById = async (userId, applicationId) => {
  if (!userId) {
    const error = new Error('User ID is required');
    error.statusCode = 400;
    throw error;
  }

  if (!applicationId || !mongoose.Types.ObjectId.isValid(applicationId)) {
    const error = new Error('Invalid application ID format');
    error.statusCode = 400;
    error.code = 'INVALID_ID';
    throw error;
  }

  const application = await Application.findOne({ _id: applicationId, userId })
    .populate('jobId')
    .lean();

  if (!application) {
    const error = new Error('Application record not found');
    error.statusCode = 404;
    error.code = 'NOT_FOUND';
    throw error;
  }

  return application;
};

/**
 * Update an existing application's status, notes, or details.
 *
 * @param {string|mongoose.Types.ObjectId} userId
 * @param {string} applicationId
 * @param {Object} updates
 * @returns {Promise<Object>} Updated Application document
 */
export const updateApplication = async (userId, applicationId, updates = {}) => {
  if (!userId) {
    const error = new Error('User ID is required');
    error.statusCode = 400;
    throw error;
  }

  if (!applicationId || !mongoose.Types.ObjectId.isValid(applicationId)) {
    const error = new Error('Invalid application ID format');
    error.statusCode = 400;
    error.code = 'INVALID_ID';
    throw error;
  }

  const application = await Application.findOne({ _id: applicationId, userId });

  if (!application) {
    const error = new Error('Application record not found');
    error.statusCode = 404;
    error.code = 'NOT_FOUND';
    throw error;
  }

  // Update status if supplied
  if (updates.status !== undefined) {
    application.status = normalizeStatus(updates.status);
  }

  // Update notes if supplied
  if (updates.notes !== undefined) {
    application.notes = typeof updates.notes === 'string' ? updates.notes.trim() : '';
  }

  // Update company if supplied
  if (updates.company !== undefined) {
    const c = String(updates.company).trim();
    if (!c) {
      const error = new Error('Company name cannot be empty');
      error.statusCode = 400;
      error.code = 'COMPANY_REQUIRED';
      throw error;
    }
    application.company = c;
  }

  // Update jobTitle if supplied
  if (updates.jobTitle !== undefined) {
    const jt = String(updates.jobTitle).trim();
    if (!jt) {
      const error = new Error('Job title cannot be empty');
      error.statusCode = 400;
      error.code = 'JOB_TITLE_REQUIRED';
      throw error;
    }
    application.jobTitle = jt;
  }

  // Update applicationUrl if supplied
  if (updates.applicationUrl !== undefined) {
    application.applicationUrl =
      typeof updates.applicationUrl === 'string' ? updates.applicationUrl.trim() : '';
  }

  // Update appliedAt if supplied
  if (updates.appliedAt !== undefined) {
    const d = new Date(updates.appliedAt);
    if (!isNaN(d.getTime())) {
      application.appliedAt = d;
    }
  }

  await application.save();

  if (application.jobId) {
    await application.populate('jobId');
  }

  logger.info(`User ${userId} updated application ${applicationId}`);
  return application;
};

/**
 * Delete an application record with strict user isolation.
 *
 * @param {string|mongoose.Types.ObjectId} userId
 * @param {string} applicationId
 * @returns {Promise<{success: boolean, message: string}>}
 */
export const deleteApplication = async (userId, applicationId) => {
  if (!userId) {
    const error = new Error('User ID is required');
    error.statusCode = 400;
    throw error;
  }

  if (!applicationId || !mongoose.Types.ObjectId.isValid(applicationId)) {
    const error = new Error('Invalid application ID format');
    error.statusCode = 400;
    error.code = 'INVALID_ID';
    throw error;
  }

  const deleted = await Application.findOneAndDelete({ _id: applicationId, userId });

  if (!deleted) {
    const error = new Error('Application record not found');
    error.statusCode = 404;
    error.code = 'NOT_FOUND';
    throw error;
  }

  logger.info(`User ${userId} deleted application ${applicationId}`);
  return { success: true, message: 'Application deleted successfully' };
};

/**
 * Retrieve an array of Job IDs tracked by the user.
 * Enables O(1) tracking status checks on job listing cards.
 *
 * @param {string|mongoose.Types.ObjectId} userId
 * @returns {Promise<Array<string>>}
 */
export const getTrackedJobIds = async (userId) => {
  if (!userId) {
    return [];
  }

  const records = await Application.find({ userId, jobId: { $ne: null } })
    .select('jobId')
    .lean();

  return records
    .filter((r) => r.jobId)
    .map((r) => r.jobId.toString());
};

export default {
  VALID_STATUSES,
  normalizeStatus,
  createApplication,
  getApplications,
  getApplicationStats,
  getApplicationById,
  updateApplication,
  deleteApplication,
  getTrackedJobIds,
};
