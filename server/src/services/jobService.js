import mongoose from 'mongoose';
import { Job } from '../models/Job.js';
import { logger } from '../utils/logger.js';

/**
 * Safely escape regular expression special characters to prevent ReDoS
 * or query injection vulnerabilities.
 *
 * @param {string} str
 * @returns {string}
 */
export const escapeRegex = (str) => {
  if (typeof str !== 'string') return '';
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

export const MAX_PAGE_LIMIT = 50;
export const DEFAULT_PAGE_LIMIT = 10;
export const CANDIDATE_WINDOW_LIMIT = 100;
export const SEARCH_JOBS_PROJECTION =
  '_id title company location description requirements salaryRange sourceUrl platform createdAt lastVerifiedAt status isClosed';

import { getDomainTitleRegex } from '../utils/careerDomainClassifier.js';
import {
  getSeniorityTier,
  getSeniorityLabel,
  isIndiaOrEligibleRemote,
  SENIORITY_TIERS,
} from '../utils/jobMatchingFilters.js';

const getSortPriority = (job) => {
  const tier = getSeniorityTier(job);
  const isEligibleLocation = isIndiaOrEligibleRemote(job);
  if (tier === SENIORITY_TIERS.TIER_1_STUDENT_ENTRY) return isEligibleLocation ? 0 : 2;
  if (tier === SENIORITY_TIERS.TIER_2_MID_LEVEL_IC) return isEligibleLocation ? 1 : 3;
  if (tier === SENIORITY_TIERS.TIER_3_SENIOR_LEAD) return isEligibleLocation ? 4 : 5;
  return 6;
};

/**
 * Search and filter job listings with pagination, experience level support, and domain metadata.
 *
 * @param {Object} [params] - Query options
 * @param {string} [params.q] - Keyword to search title, company, or description
 * @param {string} [params.location] - Location filter (e.g. 'Remote', 'San Francisco')
 * @param {string} [params.platform] - Platform filter (e.g. 'linkedin', 'indeed')
 * @param {string} [params.domain] - Domain filter ('tech', 'data', 'finance', 'business', 'marketing_hr', 'all')
 * @param {string} [params.experienceLevel] - Experience filter ('entry', 'mid', 'senior', 'all')
 * @param {boolean} [params.prioritizeFresher=false] - Prioritize student/entry-level roles at the top of results
 * @param {number|string} [params.page=1] - 1-indexed page number
 * @param {number|string} [params.limit=10] - Number of results per page (max 50)
 * @returns {Promise<{jobs: Array, pagination: Object}>}
 */
export const searchJobs = async (params = {}) => {
  const { q, location, platform, domain, experienceLevel, prioritizeFresher, page, limit } = params;

  const query = {
    status: { $ne: 'archived' },
    isClosed: { $ne: true },
  };

  const andConditions = [];

  // 1. Text keyword search across title, company, and description
  if (q && typeof q === 'string' && q.trim().length > 0) {
    const escapedKeyword = escapeRegex(q.trim());
    const keywordRegex = new RegExp(escapedKeyword, 'i');
    andConditions.push({
      $or: [
        { title: keywordRegex },
        { company: keywordRegex },
        { description: keywordRegex },
      ],
    });
  }

  // 2. Career domain filter
  if (domain && typeof domain === 'string' && domain.trim().toLowerCase() !== 'all') {
    const domainRegex = getDomainTitleRegex(domain.trim().toLowerCase());
    if (domainRegex) {
      andConditions.push({ title: domainRegex });
    }
  }

  if (andConditions.length === 1) {
    Object.assign(query, andConditions[0]);
  } else if (andConditions.length > 1) {
    query.$and = andConditions;
  }

  // 3. Location filter (case-insensitive substring match)
  if (location && typeof location === 'string' && location.trim().length > 0) {
    const escapedLoc = escapeRegex(location.trim());
    query.location = new RegExp(escapedLoc, 'i');
  }

  // 4. Platform filter (normalized enum match)
  if (platform && typeof platform === 'string' && platform.trim().length > 0) {
    query.platform = platform.trim().toLowerCase();
  }

  // 5. Pagination normalization
  const parsedPage = parseInt(page, 10);
  const pageNum = Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1;

  const parsedLimit = parseInt(limit, 10);
  const limitNum =
    Number.isFinite(parsedLimit) && parsedLimit > 0
      ? Math.min(MAX_PAGE_LIMIT, parsedLimit)
      : DEFAULT_PAGE_LIMIT;

  const skip = (pageNum - 1) * limitNum;

  // 6. Query execution and fresher prioritization
  let jobs = [];
  let total = 0;

  if (prioritizeFresher || (experienceLevel && experienceLevel !== 'all')) {
    // When prioritizing early career or filtering by experience tier, retrieve candidates
    // with projection and a 100-job candidate window to optimize performance and prevent query timeouts
    let candidateQuery = Job.find(query);
    if (typeof candidateQuery.select === 'function') {
      candidateQuery = candidateQuery.select(SEARCH_JOBS_PROJECTION);
    }

    const [allCandidateJobs, count] = await Promise.all([
      candidateQuery
        .sort({ createdAt: -1 })
        .skip(0)
        .limit(CANDIDATE_WINDOW_LIMIT)
        .lean(),
      Job.countDocuments(query),
    ]);

    let filtered = [...(allCandidateJobs || [])];
    if (experienceLevel === 'entry') {
      filtered = filtered.filter((j) => getSeniorityTier(j) === SENIORITY_TIERS.TIER_1_STUDENT_ENTRY);
    } else if (experienceLevel === 'mid') {
      filtered = filtered.filter((j) => getSeniorityTier(j) === SENIORITY_TIERS.TIER_2_MID_LEVEL_IC);
    } else if (experienceLevel === 'senior') {
      filtered = filtered.filter((j) => getSeniorityTier(j) >= SENIORITY_TIERS.TIER_3_SENIOR_LEAD);
    }

    if (prioritizeFresher) {
      filtered.sort((a, b) => {
        const pA = getSortPriority(a);
        const pB = getSortPriority(b);
        if (pA !== pB) return pA - pB;
        return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
      });
    }

    total = experienceLevel && experienceLevel !== 'all' ? filtered.length : count;
    const paged = filtered.slice(skip, skip + limitNum);

    jobs = paged.map((j) => {
      const tier = getSeniorityTier(j);
      return {
        ...j,
        seniorityTier: tier,
        seniorityLabel: getSeniorityLabel(tier),
        isEntryLevel: tier === SENIORITY_TIERS.TIER_1_STUDENT_ENTRY,
        isIndiaOrEligibleRemote: isIndiaOrEligibleRemote(j),
      };
    });
  } else {
    let rawQuery = Job.find(query);
    if (typeof rawQuery.select === 'function') {
      rawQuery = rawQuery.select(SEARCH_JOBS_PROJECTION);
    }

    const [rawJobs, count] = await Promise.all([
      rawQuery
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Job.countDocuments(query),
    ]);

    total = count;
    jobs = (rawJobs || []).map((j) => {
      const tier = getSeniorityTier(j);
      return {
        ...j,
        seniorityTier: tier,
        seniorityLabel: getSeniorityLabel(tier),
        isEntryLevel: tier === SENIORITY_TIERS.TIER_1_STUDENT_ENTRY,
        isIndiaOrEligibleRemote: isIndiaOrEligibleRemote(j),
      };
    });
  }

  const totalPages = Math.ceil(total / limitNum) || 0;
  const hasMore = pageNum < totalPages;

  return {
    jobs,
    pagination: {
      total,
      page: pageNum,
      limit: limitNum,
      totalPages,
      hasMore,
    },
  };
};

/**
 * Retrieve a single job listing by MongoDB ID.
 *
 * @param {string|mongoose.Types.ObjectId} id - MongoDB ObjectId string
 * @returns {Promise<Object|null>} Job document or null
 */
export const getJobById = async (id) => {
  if (!id || !mongoose.Types.ObjectId.isValid(id)) {
    const error = new Error('Invalid job ID format');
    error.name = 'ValidationError';
    error.statusCode = 400;
    throw error;
  }

  return Job.findById(id).lean();
};

export default {
  escapeRegex,
  searchJobs,
  getJobById,
  MAX_PAGE_LIMIT,
  DEFAULT_PAGE_LIMIT,
};
