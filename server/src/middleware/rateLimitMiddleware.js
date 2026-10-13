import { rateLimit } from 'express-rate-limit';
import { sendError } from '../utils/apiResponse.js';
import { env } from '../config/env.js';

/**
 * Key generator extracting client IP safely.
 * Relies on req.ip when trust proxy is configured in Express,
 * falling back to socket remote address.
 */
export const getClientIp = (req) => {
  return req.ip || req.socket?.remoteAddress || '127.0.0.1';
};

/**
 * Checks whether the current process is running in test mode.
 */
export const isTestEnvironment = () => {
  return Boolean(
    process.env.NODE_ENV === 'test' ||
    env.isTest ||
    process.argv.some((arg) => arg.includes('test')) ||
    process.execArgv.some((arg) => arg.includes('test'))
  );
};

/**
 * Helper to bypass rate limiting during automated test runs,
 * UNLESS explicitly testing rate limits using x-test-rate-limit header.
 */
export const shouldSkipLimiter = (req) => {
  if (process.env.DISABLE_RATE_LIMIT === 'true') return true;
  if (isTestEnvironment() && !req?.headers?.['x-test-rate-limit']) return true;
  return false;
};

/**
 * Standard handler for 429 Rate Limit Exceeded responses
 */
const createRateLimitHandler = (customMessage, errorCode = 'RATE_LIMIT_EXCEEDED') => {
  return (req, res, _next, options) => {
    return sendError(
      res,
      customMessage || options.message || 'Too many requests. Please try again later.',
      429,
      errorCode
    );
  };
};

/**
 * Factory for creating custom rate limiters with consistent JSON error responses
 */
export const createLimiter = ({
  windowMs = 15 * 60 * 1000,
  max = 100,
  message = 'Too many requests. Please try again later.',
  errorCode = 'RATE_LIMIT_EXCEEDED',
  skip = shouldSkipLimiter,
  validate = false,
}) => {
  return rateLimit({
    windowMs,
    max,
    standardHeaders: 'draft-7', // RateLimit-* headers
    legacyHeaders: false,
    keyGenerator: getClientIp,
    skip,
    validate,
    handler: createRateLimitHandler(message, errorCode),
  });
};

/**
 * 1. Global API rate limiter (protects against rapid brute-force and scraping loops)
 * Default: 300 requests per 15 minutes per IP
 */
export const globalApiLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  max: 300,
  message: 'Global API rate limit exceeded. Please slow down and try again later.',
  errorCode: 'GLOBAL_RATE_LIMIT_EXCEEDED',
});

/**
 * 2. Resume upload rate limiter (protects Cloudinary upload bandwidth and storage)
 * Default: 10 uploads per 15 minutes per IP
 */
export const resumeUploadLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: 'Too many resume uploads from this IP. Please wait before uploading again.',
  errorCode: 'TOO_MANY_UPLOADS',
});

/**
 * 3. Resume Gemini AI extraction rate limiter (protects Gemini API quota)
 * Default: 5 extractions per 15 minutes per IP
 */
export const resumeExtractLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: 'Too many resume parsing requests. Gemini AI rate limit protected. Please try again later.',
  errorCode: 'TOO_MANY_EXTRACTIONS',
});

/**
 * 4. Job sync rate limiter (protects external ATS boards from scraping abuse)
 * Default: 3 syncs per 15 minutes per IP
 */
export const jobSyncLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  max: 3,
  message: 'Too many job board synchronization requests. Please try again later.',
  errorCode: 'TOO_MANY_SYNCS',
});

/**
 * 5. ML Recommendation rate limiter (protects Python subprocess spawning)
 * Default: 30 requests per 15 minutes per IP
 */
export const recommendationLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: 'Too many recommendation requests. Please try again shortly.',
  errorCode: 'TOO_MANY_RECOMMENDATIONS',
});

export default {
  globalApiLimiter,
  resumeUploadLimiter,
  resumeExtractLimiter,
  jobSyncLimiter,
  recommendationLimiter,
  createLimiter,
};
