import axios from 'axios';
import { auth } from '../firebase/firebase.js';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

/**
 * Pre-configured Axios instance for application-wide API communication
 */
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

/**
 * Request Interceptor: Attach Firebase ID token to Authorization header if user is signed in
 */
api.interceptors.request.use(
  async (config) => {
    try {
      if (auth?.currentUser) {
        const token = await auth.currentUser.getIdToken();
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
      }
    } catch (err) {
      console.warn('Failed to attach Firebase auth token to request:', err);
    }
    return config;
  },
  (error) => Promise.reject(error)
);

/**
 * Response Interceptor: Standardize API error formatting
 */
api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    const customError = {
      message: error.response?.data?.message || error.message || 'An unexpected network error occurred',
      status: error.response?.status || 500,
      details: error.response?.data?.error || null,
    };
    return Promise.reject(customError);
  }
);

/**
 * Authentication and User Services
 */
export const authService = {
  getMe: () => api.get('/auth/me'),
};

/**
 * Resume and Onboarding Services
 */
export const resumeService = {
  /**
   * Upload resume file (PDF or DOCX) to backend via multipart/form-data.
   * Backend streams to Cloudinary and persists metadata in MongoDB.
   *
   * @param {File} file - Browser File object
   * @param {Function} [onUploadProgress] - Callback for upload percentage (0 - 100)
   * @returns {Promise<any>}
   */
  uploadResume: (file, onUploadProgress) => {
    jobService.clearRecommendationCache?.();
    const formData = new FormData();
    formData.append('file', file);

    return api.post('/resumes/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      onUploadProgress: (progressEvent) => {
        if (onUploadProgress && progressEvent.total) {
          const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          onUploadProgress(percent);
        }
      },
    });
  },
  extractResume: () => {
    jobService.clearRecommendationCache?.();
    return api.post('/resumes/extract', {}, { timeout: 60000 });
  },
  saveResumeMetadata: (data) => api.post('/resumes', data),
  getMyResume: () => api.get('/resumes/me'),
};

/**
 * Candidate Profile Services
 */
export const profileService = {
  getMyProfile: () => api.get('/profile/me'),
  updateProfile: (profileData) => {
    jobService.clearRecommendationCache?.();
    return api.put('/profile/me', profileData);
  },
};

let inFlightRecommendedPromise = null;
let cachedRecommendations = null;
let cachedRecommendationsTime = 0;
const RECOMMENDATIONS_CACHE_TTL_MS = 60000;

/**
 * Job Search & Integration Services
 */
export const jobService = {
  /**
   * Search jobs with optional keyword, location, platform, page, and limit
   * @param {Object} [params] - Query parameters { q, location, platform, page, limit }
   * @returns {Promise<any>}
   */
  getJobs: (params = {}) => api.get('/jobs', { params }),

  /**
   * Retrieve a single job listing by ID
   * @param {string} id - MongoDB document ID
   * @returns {Promise<any>}
   */
  getJobById: (id) => api.get(`/jobs/${id}`),

  /**
   * Trigger public job board synchronization
   * @returns {Promise<any>}
   */
  syncJobs: () => api.post('/jobs/sync'),

  /**
   * Clears recommendation in-flight promise and memory cache (e.g. after profile/resume updates)
   */
  clearRecommendationCache: () => {
    cachedRecommendations = null;
    cachedRecommendationsTime = 0;
    inFlightRecommendedPromise = null;
  },

  /**
   * Retrieve ML-recommended jobs based on current user's profile and resume.
   * Deduplicates concurrent in-flight requests and provides safe short-lived memory caching.
   * @param {Object} [params] - Query parameters { topK, locationPreference, minScore }
   * @param {Object} [config] - Axios request configuration (e.g. signal for AbortController, forceRefresh)
   * @returns {Promise<any>}
   */
  getRecommendedJobs: (params = {}, config = {}) => {
    const isForce = config?.forceRefresh || params?.refresh;
    const now = Date.now();

    if (!isForce && cachedRecommendations && now - cachedRecommendationsTime < RECOMMENDATIONS_CACHE_TTL_MS) {
      return Promise.resolve(cachedRecommendations);
    }

    if (!isForce && inFlightRecommendedPromise) {
      return inFlightRecommendedPromise;
    }

    const { forceRefresh, ...axiosConfig } = config;
    const promise = api.get('/jobs/recommended', { params, ...axiosConfig })
      .then((res) => {
        cachedRecommendations = res;
        cachedRecommendationsTime = Date.now();
        return res;
      })
      .finally(() => {
        inFlightRecommendedPromise = null;
      });

    if (!isForce) {
      inFlightRecommendedPromise = promise;
    }
    return promise;
  },
};

let inFlightSavedJobIdsPromise = null;
let cachedSavedJobIds = null;
let cachedSavedJobIdsTime = 0;
const SAVED_IDS_CACHE_TTL_MS = 10000;

/**
 * Saved Jobs Services
 */
export const savedJobService = {
  /**
   * List all saved jobs for current authenticated user
   * @returns {Promise<any>}
   */
  getSavedJobs: () => api.get('/saved-jobs'),

  /**
   * Retrieve array of saved job IDs for fast O(1) membership check.
   * Deduplicates concurrent in-flight calls and caches briefly to prevent duplicate initial requests.
   * @param {boolean} [force=false]
   * @returns {Promise<any>}
   */
  getSavedJobIds: (force = false) => {
    const now = Date.now();
    if (!force && cachedSavedJobIds && now - cachedSavedJobIdsTime < SAVED_IDS_CACHE_TTL_MS) {
      return Promise.resolve(cachedSavedJobIds);
    }
    if (!inFlightSavedJobIdsPromise) {
      inFlightSavedJobIdsPromise = api.get('/saved-jobs/ids')
        .then((res) => {
          cachedSavedJobIds = res;
          cachedSavedJobIdsTime = Date.now();
          return res;
        })
        .finally(() => {
          inFlightSavedJobIdsPromise = null;
        });
    }
    return inFlightSavedJobIdsPromise;
  },

  /**
   * Save / bookmark a job
   * @param {string} jobId - MongoDB Job ID
   * @param {string} [notes='']
   * @returns {Promise<any>}
   */
  saveJob: (jobId, notes = '') => {
    cachedSavedJobIds = null;
    return api.post('/saved-jobs', { jobId, notes });
  },

  /**
   * Remove a job from saved listings
   * @param {string} jobId - MongoDB Job ID
   * @returns {Promise<any>}
   */
  unsaveJob: (jobId) => {
    cachedSavedJobIds = null;
    return api.delete(`/saved-jobs/${jobId}`);
  },

  /**
   * Check whether a specific job is saved
   * @param {string} jobId - MongoDB Job ID
   * @returns {Promise<any>}
   */
  checkJobSaved: (jobId) => api.get(`/saved-jobs/check/${jobId}`),
};

let inFlightTrackedJobIdsPromise = null;
let cachedTrackedJobIds = null;
let cachedTrackedJobIdsTime = 0;
const TRACKED_IDS_CACHE_TTL_MS = 10000;

/**
 * Application Tracking Services
 */
export const applicationService = {
  /**
   * Retrieve all tracked applications with optional filter params
   * @param {Object} [params] - { status, search }
   * @returns {Promise<any>}
   */
  getApplications: (params = {}) => api.get('/applications', { params }),

  /**
   * Retrieve application summary statistics (total, applied, interview, rejected, offer)
   * @returns {Promise<any>}
   */
  getApplicationStats: () => api.get('/applications/stats'),

  /**
   * Retrieve array of job IDs currently tracked by user for fast O(1) membership checks.
   * Deduplicates concurrent in-flight calls and caches briefly to prevent duplicate initial requests.
   * @param {boolean} [force=false]
   * @returns {Promise<any>}
   */
  getTrackedJobIds: (force = false) => {
    const now = Date.now();
    if (!force && cachedTrackedJobIds && now - cachedTrackedJobIdsTime < TRACKED_IDS_CACHE_TTL_MS) {
      return Promise.resolve(cachedTrackedJobIds);
    }
    if (!inFlightTrackedJobIdsPromise) {
      inFlightTrackedJobIdsPromise = api.get('/applications/ids')
        .then((res) => {
          cachedTrackedJobIds = res;
          cachedTrackedJobIdsTime = Date.now();
          return res;
        })
        .finally(() => {
          inFlightTrackedJobIdsPromise = null;
        });
    }
    return inFlightTrackedJobIdsPromise;
  },

  /**
   * Retrieve single application by ID
   * @param {string} id - Application MongoDB ID
   * @returns {Promise<any>}
   */
  getApplicationById: (id) => api.get(`/applications/${id}`),

  /**
   * Create / track a new job application
   * @param {Object} data - { jobId, company, jobTitle, applicationUrl, status, appliedAt, notes }
   * @returns {Promise<any>}
   */
  createApplication: (data) => {
    cachedTrackedJobIds = null;
    return api.post('/applications', data);
  },

  /**
   * Update application status, notes, or details
   * @param {string} id - Application MongoDB ID
   * @param {Object} data - { status, notes, company, jobTitle, applicationUrl, appliedAt }
   * @returns {Promise<any>}
   */
  updateApplication: (id, data) => {
    cachedTrackedJobIds = null;
    return api.patch(`/applications/${id}`, data);
  },

  /**
   * Delete tracked application
   * @param {string} id - Application MongoDB ID
   * @returns {Promise<any>}
   */
  deleteApplication: (id) => {
    cachedTrackedJobIds = null;
    return api.delete(`/applications/${id}`);
  },
};

/**
 * System and Health Services
 */
export const healthService = {
  check: () => api.get('/health'),
};

export default api;


