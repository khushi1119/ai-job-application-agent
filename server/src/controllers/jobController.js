import mongoose from 'mongoose';
import { searchJobs, getJobById } from '../services/jobService.js';
import { syncAllJobBoards } from '../services/jobIntegrationService.js';
import {
  getRecommendedJobsForUser,
  invalidateActiveJobsCache,
} from '../services/recommendationService.js';
import { findOrCreateUserFromFirebase } from '../services/userService.js';
import Profile from '../models/Profile.js';
import Resume from '../models/Resume.js';
import {
  detectCandidateDomain,
  isCandidateStudentOrFresher,
  CAREER_DOMAINS,
  DOMAIN_LABELS,
} from '../utils/careerDomainClassifier.js';
import { sendSuccess, sendError } from '../utils/apiResponse.js';
import { logger } from '../utils/logger.js';

/**
 * Controller to search and filter job listings.
 * Adapts default category and ranking to the authenticated candidate's profile/resume.
 * Route: GET /api/jobs
 * Access: Private (Requires Bearer Firebase ID Token)
 */
export const getJobs = async (req, res) => {
  try {
    const { q, location, platform, page, limit, domain, experienceLevel } = req.query;

    let user = null;
    let profile = null;
    let resume = null;

    if (req.user) {
      try {
        user = await findOrCreateUserFromFirebase(req.user);
        if (user?._id) {
          [profile, resume] = await Promise.all([
            Profile.findOne({ userId: user._id }).lean(),
            Resume.findOne({ userId: user._id }).sort({ version: -1 }).lean(),
          ]);
        }
      } catch (userErr) {
        logger.warn('Non-fatal: Unable to load profile for personalization in getJobs:', userErr.message);
      }
    }

    const domainDetection = detectCandidateDomain(profile, resume);
    const isFresher = isCandidateStudentOrFresher(profile);

    // Determine active domain:
    // If explicitly requested (including 'all'), respect user choice.
    // Otherwise, default to detected domain if unambiguous, else 'all'.
    let activeDomain = CAREER_DOMAINS.ALL;
    if (domain && typeof domain === 'string' && domain.trim().toLowerCase() !== 'auto') {
      activeDomain = domain.trim().toLowerCase();
    } else if (domainDetection.domain && domainDetection.domain !== CAREER_DOMAINS.ALL && !domainDetection.isAmbiguous) {
      activeDomain = domainDetection.domain;
    }

    const result = await searchJobs({
      q,
      location,
      platform,
      domain: activeDomain,
      experienceLevel,
      prioritizeFresher: isFresher,
      page,
      limit,
    });

    return sendSuccess(
      res,
      {
        jobs: result.jobs,
        pagination: result.pagination,
        personalization: {
          detectedDomain: domainDetection.domain,
          detectedDomainLabel: domainDetection.label,
          activeDomain,
          activeDomainLabel: DOMAIN_LABELS[activeDomain] || 'All Domains',
          confidence: domainDetection.confidence,
          isPersonalized: activeDomain !== CAREER_DOMAINS.ALL && activeDomain === domainDetection.domain,
          evidenceSummary: domainDetection.evidenceSummary,
          experienceLevel: experienceLevel || 'all',
          isFresher,
          availableDomains: [
            { id: 'all', label: 'All Domains' },
            { id: 'tech', label: 'Software & IT' },
            { id: 'data', label: 'Data & Analytics' },
            { id: 'finance', label: 'Finance & Commerce' },
            { id: 'business', label: 'Business & Management' },
            { id: 'marketing_hr', label: 'Marketing & HR' },
          ],
        },
      },
      'Jobs retrieved successfully',
      200
    );
  } catch (error) {
    logger.error('Error in getJobs controller:', error);
    return sendError(
      res,
      'Failed to retrieve job listings',
      error.statusCode || 500,
      error.message
    );
  }
};

/**
 * Controller to retrieve a single job listing by MongoDB ID.
 * Route: GET /api/jobs/:id
 * Access: Private (Requires Bearer Firebase ID Token)
 */
export const getJob = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return sendError(res, 'Invalid job ID format', 400, 'INVALID_ID');
    }

    const job = await getJobById(id);

    if (!job) {
      return sendError(res, 'Job not found', 404, 'NOT_FOUND');
    }

    return sendSuccess(
      res,
      { job },
      'Job retrieved successfully',
      200
    );
  } catch (error) {
    logger.error(`Error in getJob controller for ID ${req.params?.id}:`, error);
    const statusCode = error.statusCode || 500;
    return sendError(
      res,
      'Failed to retrieve job details',
      statusCode,
      error.message
    );
  }
};

/**
 * Controller to trigger public job board synchronization.
 * Route: POST /api/jobs/sync
 * Access: Private (Requires Bearer Firebase ID Token)
 */
export const syncJobs = async (req, res) => {
  try {
    const summary = await syncAllJobBoards();
    invalidateActiveJobsCache({ refreshInBackground: true });
    return sendSuccess(
      res,
      summary,
      `Synchronized ${summary.totalSaved} job listings across ${summary.boardsProcessed} company boards`,
      200
    );
  } catch (error) {
    logger.error('Error in syncJobs controller:', error);
    return sendError(
      res,
      'Failed to synchronize job listings',
      500,
      error.message
    );
  }
};

/**
 * Controller to get ML-recommended job listings based on candidate profile.
 * Route: GET /api/jobs/recommended
 * Access: Private (Requires Bearer Firebase ID Token)
 */
export const getRecommendedJobs = async (req, res) => {
  const abortController = new AbortController();
  const onClose = () => {
    if (!res.writableEnded && !res.headersSent) {
      abortController.abort();
    }
  };
  if (typeof req?.on === 'function') {
    req.on('close', onClose);
  }

  try {
    const user = await findOrCreateUserFromFirebase(req.user);
    const { topK, locationPreference, minScore } = req.query;

    const parsedMinScore = minScore !== undefined ? parseFloat(minScore) : undefined;

    const result = await getRecommendedJobsForUser(user._id, {
      topK,
      locationPreference,
      minScore: Number.isFinite(parsedMinScore) ? parsedMinScore : undefined,
      signal: abortController.signal,
    });

    return sendSuccess(
      res,
      result,
      result.message || (result.emptyProfile ? 'Profile is incomplete' : `Retrieved ${result.jobs.length} recommended jobs`),
      200
    );
  } catch (error) {
    if (abortController.signal.aborted || error.name === 'AbortError') {
      logger.debug('Client closed connection before recommendations finished');
      return;
    }
    logger.error('Error in getRecommendedJobs controller:', error);
    const statusCode = error.statusCode || 500;
    return sendError(
      res,
      error.message || 'Failed to generate job recommendations',
      statusCode,
      error.code || error.message
    );
  } finally {
    if (typeof req?.off === 'function') {
      req.off('close', onClose);
    }
  }
};

export default {
  getJobs,
  getJob,
  syncJobs,
  getRecommendedJobs,
};
