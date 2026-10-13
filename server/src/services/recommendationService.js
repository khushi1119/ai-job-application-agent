import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import Profile from '../models/Profile.js';
import Resume from '../models/Resume.js';
import Job from '../models/Job.js';
import { logger } from '../utils/logger.js';
import {
  isIndiaOrEligibleRemote,
  getSeniorityTier,
  getSeniorityLabel,
  SENIORITY_TIERS,
} from '../utils/jobMatchingFilters.js';
import {
  classifyJobDomain,
  detectCandidateDomain,
  isCandidateStudentOrFresher,
} from '../utils/careerDomainClassifier.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DEFAULT_TIMEOUT_MS = 12000;
const DEFAULT_TOP_K = 20;
const MAX_TOP_K = 50;
export const DEFAULT_MIN_SCORE = 0.05;

/**
 * Calculates domain affinity level between candidate's detected domain and a job listing.
 * 0: Direct match (or unconstrained candidate)
 * 1: Related adjacent domain
 * 2: Unaligned domain
 */
export const getDomainAffinity = (candDomain, jDomain) => {
  if (!candDomain || candDomain === 'all') return 0;
  if (jDomain === candDomain) return 0;
  // Related adjacent domains
  if (candDomain === 'tech' && jDomain === 'data') return 1;
  if (candDomain === 'data' && jDomain === 'tech') return 1;
  if (candDomain === 'business' && (jDomain === 'finance' || jDomain === 'marketing_hr')) return 1;
  if (candDomain === 'finance' && jDomain === 'business') return 1;
  return 2;
};

/**
 * Resolves the absolute path to the Python interpreter in the local virtual environment.
 * Falls back to PYTHON_PATH or system 'python' if the virtual environment is absent.
 */
export const resolvePythonExecutable = () => {
  if (process.env.PYTHON_PATH) {
    return process.env.PYTHON_PATH;
  }

  const venvBinaryName = process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python';
  const candidatePath = path.resolve(__dirname, '../../../ml/.venv', venvBinaryName);

  if (fs.existsSync(candidatePath)) {
    return candidatePath;
  }

  // Fallback to system python
  return process.platform === 'win32' ? 'python' : 'python3';
};

/**
 * Resolves the absolute path to ml/recommender.py.
 */
export const resolveRecommenderScript = () => {
  return path.resolve(__dirname, '../../../ml/recommender.py');
};

/**
 * In-flight recommendation requests map keyed strictly by authenticated userId.
 * Prevents concurrent duplicate requests for the same candidate from spawning multiple Python processes.
 * Automatically cleared in finally block upon completion or failure.
 */
const inFlightRequests = new Map();

/**
 * Returns current count of active in-flight recommendation processes (used in tests & diagnostics).
 */
export const getInFlightRequestCount = () => inFlightRequests.size;

/**
 * 5-minute in-memory active job catalog cache configuration
 */
export const ACTIVE_JOBS_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
export const RECOMMENDATION_JOBS_PROJECTION =
  '_id title company location description requirements salaryRange sourceUrl platform lastVerifiedAt';

let cachedActiveJobs = null;
let cachedActiveJobsTimestamp = 0;
let inFlightActiveJobsPromise = null;

/**
 * Returns diagnostic metadata about the active jobs catalog cache.
 */
export const getActiveJobsCatalogStatus = () => {
  const now = Date.now();
  const hasCache = Array.isArray(cachedActiveJobs);
  return {
    isCached: hasCache,
    count: hasCache ? cachedActiveJobs.length : 0,
    timestamp: cachedActiveJobsTimestamp,
    isStale: hasCache ? now - cachedActiveJobsTimestamp >= ACTIVE_JOBS_CACHE_TTL_MS : true,
    isRefreshing: Boolean(inFlightActiveJobsPromise),
  };
};

/**
 * Refreshes the active jobs catalog from MongoDB with field projection.
 * - Coalesces parallel calls into a single shared in-flight promise.
 * - Preserves the last known-good catalog if the database call fails.
 *
 * @returns {Promise<Array>}
 */
export const refreshActiveJobsCatalog = async () => {
  if (inFlightActiveJobsPromise) {
    return inFlightActiveJobsPromise;
  }

  inFlightActiveJobsPromise = (async () => {
    try {
      const jobs = await Job.find({ status: { $ne: 'archived' }, isClosed: { $ne: true } })
        .select(RECOMMENDATION_JOBS_PROJECTION)
        .lean();

      if (Array.isArray(jobs)) {
        cachedActiveJobs = jobs;
        cachedActiveJobsTimestamp = Date.now();
        logger.info(`Active jobs catalog refreshed in memory (${jobs.length} jobs)`);
      }
      return cachedActiveJobs;
    } catch (err) {
      logger.warn(`Failed to refresh active jobs catalog: ${err.message}`);
      // Safety guarantee: preserve last known-good catalog on refresh failure
      if (Array.isArray(cachedActiveJobs)) {
        return cachedActiveJobs;
      }
      throw err;
    } finally {
      inFlightActiveJobsPromise = null;
    }
  })();

  return inFlightActiveJobsPromise;
};

/**
 * Pre-warms the active jobs catalog in memory asynchronously.
 * Fails safely without throwing unhandled exceptions.
 */
export const prewarmActiveJobsCatalog = async () => {
  try {
    return await refreshActiveJobsCatalog();
  } catch (err) {
    logger.debug('Active jobs catalog pre-warm notice:', err.message);
    return cachedActiveJobs || [];
  }
};

/**
 * Invalidates or resets the active jobs catalog cache.
 *
 * @param {Object} [options]
 * @param {boolean} [options.reset=false] - If true, immediately purges cached data to null (for test resets)
 * @param {boolean} [options.refreshInBackground=false] - If true, triggers immediate background refresh
 */
export const invalidateActiveJobsCache = (options = {}) => {
  if (options.reset || Object.keys(options).length === 0) {
    cachedActiveJobs = null;
    cachedActiveJobsTimestamp = 0;
    inFlightActiveJobsPromise = null;
    return;
  }

  // Mark existing catalog stale so it serves last-known-good while triggering fresh revalidation
  cachedActiveJobsTimestamp = 0;
  if (options.refreshInBackground) {
    refreshActiveJobsCatalog().catch((err) => {
      logger.debug('Post-sync catalog revalidation notice:', err.message);
    });
  }
};

/**
 * Returns current cached active jobs if within TTL, else null.
 */
export const getCachedActiveJobs = () => {
  const now = Date.now();
  if (cachedActiveJobs && now - cachedActiveJobsTimestamp < ACTIVE_JOBS_CACHE_TTL_MS) {
    return cachedActiveJobs;
  }
  return null;
};

/**
 * Fetches active unarchived and unclosed job listings using Stale-While-Revalidate:
 * 1. If fresh cache exists, serves immediately from memory.
 * 2. If cached data exists but is expired/stale, serves the last known-good catalog
 *    immediately without blocking, while triggering a non-blocking background refresh.
 * 3. If cold (no data in memory yet), awaits the shared in-flight catalog retrieval.
 *
 * @param {Object} [options] - { forceRefresh: boolean }
 * @returns {Promise<Array>}
 */
export const fetchActiveJobsCatalog = async (options = {}) => {
  const now = Date.now();
  const hasCache = Array.isArray(cachedActiveJobs);
  const isFresh = hasCache && now - cachedActiveJobsTimestamp < ACTIVE_JOBS_CACHE_TTL_MS;

  if (options.forceRefresh) {
    return refreshActiveJobsCatalog();
  }

  // 1. Fresh cache hit: serve immediately
  if (isFresh) {
    return cachedActiveJobs;
  }

  // 2. Stale-While-Revalidate: serve stale data immediately while refreshing in background
  if (hasCache) {
    refreshActiveJobsCatalog().catch((err) => {
      logger.debug('Background catalog revalidation notice:', err.message);
    });
    return cachedActiveJobs;
  }

  // 3. Cold cache: await shared retrieval promise
  return refreshActiveJobsCatalog();
};

let isPrewarmed = false;

/**
 * Pre-warms the Python environment and scikit-learn in the background on server boot.
 * Non-blocking, fails gracefully, does not delay HTTP server startup.
 */
export const prewarmPythonRecommender = () => {
  if (isPrewarmed) return Promise.resolve();

  return new Promise((resolve) => {
    const pythonPath = resolvePythonExecutable();
    const scriptPath = resolveRecommenderScript();

    const child = spawn(pythonPath, [scriptPath], {
      shell: false,
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
    });

    const prewarmTimer = setTimeout(() => {
      try {
        child.kill('SIGTERM');
      } catch (_) {}
      resolve();
    }, 15000);

    child.on('error', (err) => {
      clearTimeout(prewarmTimer);
      logger.debug('ML recommender pre-warm notice (non-fatal):', err.message);
      resolve();
    });

    child.on('close', (code) => {
      clearTimeout(prewarmTimer);
      if (code === 0) {
        isPrewarmed = true;
        logger.info('ML Python recommender environment pre-warmed successfully.');
      } else {
        logger.debug(`ML recommender pre-warm exited with code ${code}`);
      }
      resolve();
    });

    try {
      const minimalPayload = JSON.stringify({
        candidate: { skills: ['software', 'react', 'node'] },
        jobs: [{ id: 'prewarm', title: 'Developer', description: 'React and Node developer' }],
        options: { topK: 1, minScore: 0.1 },
      });
      child.stdin.end(minimalPayload, 'utf8');
    } catch (_) {
      clearTimeout(prewarmTimer);
      resolve();
    }
  });
};

/**
 * Spawns the Python ML recommender process with piped stdin/stdout and enforces a timeout.
 * Uses an argument array with NO shell to prevent command injection.
 * Supports cancellation via optional AbortSignal.
 *
 * @param {Object} payload - { candidate, jobs, options }
 * @param {Object} [options] - { timeoutMs, pythonPath, scriptPath, signal }
 * @returns {Promise<Object>} Parsed output from Python script
 */
export const invokePythonRecommender = (payload, options = {}) => {
  const timeoutMs = options.timeoutMs || DEFAULT_TIMEOUT_MS;
  const pythonPath = options.pythonPath || resolvePythonExecutable();
  const scriptPath = options.scriptPath || resolveRecommenderScript();
  const signal = options.signal;

  if (signal?.aborted) {
    const abortError = new Error('ML recommendation aborted');
    abortError.name = 'AbortError';
    abortError.statusCode = 499;
    return Promise.reject(abortError);
  }

  return new Promise((resolve, reject) => {
    let stdoutData = '';
    let stderrData = '';
    let isSettled = false;

    // Spawn Python subprocess with no shell
    const child = spawn(pythonPath, [scriptPath], {
      shell: false,
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
    });

    const cleanup = () => {
      clearTimeout(timer);
      if (signal) {
        signal.removeEventListener('abort', onSignalAbort);
      }
    };

    const settleReject = (err) => {
      if (isSettled) return;
      isSettled = true;
      cleanup();
      reject(err);
    };

    const settleResolve = (val) => {
      if (isSettled) return;
      isSettled = true;
      cleanup();
      resolve(val);
    };

    const onSignalAbort = () => {
      if (!isSettled) {
        try {
          child.kill('SIGTERM');
        } catch (_) {}
        const abortError = new Error('ML recommendation aborted');
        abortError.name = 'AbortError';
        abortError.statusCode = 499;
        settleReject(abortError);
      }
    };

    if (signal) {
      signal.addEventListener('abort', onSignalAbort, { once: true });
    }

    const timer = setTimeout(() => {
      if (!isSettled) {
        try {
          child.kill('SIGTERM');
        } catch (_) {}
        const timeoutError = new Error(`ML recommender timed out after ${timeoutMs}ms`);
        timeoutError.statusCode = 504;
        timeoutError.code = 'ML_TIMEOUT';
        settleReject(timeoutError);
      }
    }, timeoutMs);

    child.stdout.on('data', (chunk) => {
      stdoutData += chunk.toString('utf8');
    });

    child.stderr.on('data', (chunk) => {
      stderrData += chunk.toString('utf8');
    });

    child.on('error', (err) => {
      logger.error('Failed to spawn Python ML process:', err);
      const spawnError = new Error(`Failed to start ML recommender process: ${err.message}`);
      spawnError.statusCode = 500;
      spawnError.code = 'ML_SPAWN_FAILED';
      settleReject(spawnError);
    });

    child.on('close', (code) => {
      if (isSettled) return;

      if (stderrData.trim()) {
        logger.debug(`ML Recommender stderr: ${stderrData.trim()}`);
      }

      if (code !== 0) {
        const exitError = new Error(
          `ML recommender process exited with code ${code}: ${stderrData.trim() || 'Unknown error'}`
        );
        exitError.statusCode = 500;
        exitError.code = 'ML_EXECUTION_FAILED';
        return settleReject(exitError);
      }

      try {
        const parsed = JSON.parse(stdoutData.trim());
        if (parsed.success === false) {
          const mlError = new Error(parsed.error || 'ML recommendation failed');
          mlError.statusCode = 500;
          mlError.code = 'ML_PROCESSING_ERROR';
          return settleReject(mlError);
        }
        return settleResolve(parsed);
      } catch (parseErr) {
        logger.error('Failed to parse Python ML stdout JSON:', stdoutData);
        const formatError = new Error('ML recommender returned invalid output format');
        formatError.statusCode = 500;
        formatError.code = 'ML_MALFORMED_OUTPUT';
        return settleReject(formatError);
      }
    });

    // Write JSON payload to Python stdin and close stream cleanly
    try {
      const jsonString = JSON.stringify(payload);
      child.stdin.end(jsonString, 'utf8');
    } catch (writeErr) {
      try {
        child.kill();
      } catch (_) {}
      settleReject(writeErr);
    }
  });
};

/**
 * Checks if a candidate profile has enough data for meaningful ML recommendation.
 *
 * @param {Object} profile
 * @param {Object} [resume]
 * @returns {boolean}
 */
export const hasUsableProfileData = (profile, resume = null) => {
  if (!profile) {
    return Boolean(resume?.parsed?.rawText && resume.parsed.rawText.trim().length > 20);
  }

  const hasSkills = Array.isArray(profile.skills) && profile.skills.length > 0;
  const hasSummary = Boolean(profile.summary && profile.summary.trim().length > 10);
  const hasEducation = Array.isArray(profile.education) && profile.education.length > 0;
  const hasExperience = Array.isArray(profile.experience) && profile.experience.length > 0;
  const hasProjects = Array.isArray(profile.projects) && profile.projects.length > 0;
  const hasRawResume = Boolean(resume?.parsed?.rawText && resume.parsed.rawText.trim().length > 20);

  return hasSkills || hasSummary || hasEducation || hasExperience || hasProjects || hasRawResume;
};

/**
 * Internal worker that executes full database query, payload preparation, ML execution, and ranking.
 *
 * @param {string|mongoose.Types.ObjectId} userId
 * @param {Object} [options]
 * @returns {Promise<Object>}
 */
const executeRecommendationForUser = async (userId, options = {}) => {
  // Parse bounded topK parameter
  const rawTopK = parseInt(options.topK, 10);
  const topK = Number.isFinite(rawTopK) && rawTopK > 0
    ? Math.min(MAX_TOP_K, rawTopK)
    : DEFAULT_TOP_K;

  // 1. Fetch user's Profile and latest Resume in parallel
  const [profile, resume] = await Promise.all([
    Profile.findOne({ userId }).lean(),
    Resume.findOne({ userId }).sort({ version: -1 }).lean(),
  ]);

  if (options.signal?.aborted) {
    const abortError = new Error('Request aborted');
    abortError.name = 'AbortError';
    abortError.statusCode = 499;
    throw abortError;
  }

  // 2. Early-exit if profile has no usable skills or text
  if (!hasUsableProfileData(profile, resume)) {
    return {
      jobs: [],
      totalEvaluated: 0,
      emptyProfile: true,
      message: 'Please complete your profile or upload a resume to receive tailored recommendations.',
    };
  }

  // 3. Fetch active job listings with in-memory 5-minute catalog caching and field projection
  const activeJobs = await fetchActiveJobsCatalog();

  if (options.signal?.aborted) {
    const abortError = new Error('Request aborted');
    abortError.name = 'AbortError';
    abortError.statusCode = 499;
    throw abortError;
  }

  if (!activeJobs || activeJobs.length === 0) {
    return {
      jobs: [],
      totalEvaluated: 0,
      emptyProfile: false,
      message: 'No active job listings are currently available.',
    };
  }

  // 4. Pre-filter by location preference (Default: India & eligible worldwide remote)
  const locationPreference = options.locationPreference || 'india_remote';
  const eligibleJobs = locationPreference === 'all'
    ? activeJobs
    : activeJobs.filter(isIndiaOrEligibleRemote);

  if (eligibleJobs.length === 0) {
    return {
      jobs: [],
      totalEvaluated: activeJobs.length,
      emptyProfile: false,
      locationPreference,
      message: 'No India-based or eligible remote openings are currently available.',
    };
  }

  // 5. Construct candidate representation payload
  const candidatePayload = {
    skills: Array.isArray(profile?.skills) ? profile.skills : [],
    summary: profile?.summary || '',
    education: Array.isArray(profile?.education)
      ? profile.education.map((e) => ({
          degree: e.degree || '',
          fieldOfStudy: e.fieldOfStudy || '',
          institution: e.institution || '',
        }))
      : [],
    experience: Array.isArray(profile?.experience)
      ? profile.experience.map((e) => ({
          role: e.role || '',
          company: e.company || '',
          highlights: e.highlights || [],
          technologies: e.technologies || [],
        }))
      : [],
    projects: Array.isArray(profile?.projects)
      ? profile.projects.map((p) => ({
          title: p.title || '',
          description: p.description || '',
          technologies: p.technologies || [],
        }))
      : [],
    rawText: resume?.parsed?.rawText || '',
  };

  // 6. Construct jobs representation payload with bounded descriptions to speed up TF-IDF
  const jobsPayload = eligibleJobs.map((j) => ({
    id: j._id.toString(),
    title: j.title || '',
    company: j.company || '',
    location: j.location || 'Remote',
    description: (j.description || '').slice(0, 2500),
    requirements: Array.isArray(j.requirements) ? j.requirements : [],
  }));

  // 7. Invoke ML Recommender Subprocess with calibrated relevance threshold
  const minScore = typeof options.minScore === 'number'
    ? options.minScore
    : DEFAULT_MIN_SCORE;

  const mlResponse = await invokePythonRecommender(
    {
      candidate: candidatePayload,
      jobs: jobsPayload,
      options: {
        topK: Math.max(topK * 2, 40), // Retrieve enough matching candidates for seniority re-ranking
        minScore,
      },
    },
    {
      timeoutMs: options.timeoutMs || DEFAULT_TIMEOUT_MS,
      signal: options.signal,
    }
  );

  const recommendations = mlResponse.recommendations || [];
  const totalEvaluated = mlResponse.totalEvaluated || eligibleJobs.length;

  // 8. Domain and experience detection for personalized ranking
  const candidateDomain = detectCandidateDomain(profile, resume);
  const isFresher = isCandidateStudentOrFresher(profile);

  // 9. Map recommended IDs back to sanitized public Job documents with ML match metadata and seniority tiers
  const jobMap = new Map();
  for (const job of eligibleJobs) {
    jobMap.set(job._id.toString(), job);
  }

  const enrichedJobs = [];
  for (const rec of recommendations) {
    const jobDoc = jobMap.get(rec.jobId);
    if (!jobDoc) continue;

    const seniorityTier = getSeniorityTier(jobDoc);

    // For students and freshers, exclude Tier 3 (Senior/Staff, 5+ yrs) and Tier 4 (Leadership/Managerial)
    // from "Recommended for You". Senior positions remain discoverable in "Search All Jobs".
    if (isFresher && seniorityTier >= SENIORITY_TIERS.TIER_3_SENIOR_LEAD) {
      continue;
    }

    const jobDomain = classifyJobDomain(jobDoc);
    const domainAffinity = getDomainAffinity(candidateDomain.domain, jobDomain);

    enrichedJobs.push({
      _id: jobDoc._id,
      title: jobDoc.title,
      company: jobDoc.company,
      location: jobDoc.location,
      description: jobDoc.description,
      requirements: jobDoc.requirements,
      salaryRange: jobDoc.salaryRange,
      sourceUrl: jobDoc.sourceUrl,
      platform: jobDoc.platform,
      lastVerifiedAt: jobDoc.lastVerifiedAt || null,
      // ML match metadata (unmanipulated text similarity)
      matchScore: rec.score,
      matchPercentage: rec.matchPercentage,
      matchedSkills: rec.matchedSkills || [],
      // Career domain and seniority tier
      jobDomain,
      seniorityTier,
      seniorityLabel: getSeniorityLabel(seniorityTier),
      isEntryLevel: seniorityTier === SENIORITY_TIERS.TIER_1_STUDENT_ENTRY,
      domainAffinity,
    });
  }

  // 10. Multi-stage personalized ranking:
  // - Domain affinity: Roles matching candidate's career domain (Level 0) rank ahead of unaligned roles (Level 2).
  // - Seniority appropriateness:
  //   For students/freshers, Tier 1 (Internship, Graduate, Junior) ranks ahead of Tier 2 (Mid-Level IC),
  //   which ranks ahead of Tier 3 (Senior/Lead) and Tier 4 (Manager/Executive).
  //   For experienced candidates, Mid/Senior roles rank ahead of internships.
  // - Within same domain affinity and tier, sort by ML matchScore descending.
  enrichedJobs.sort((a, b) => {
    // 1. Domain affinity
    if (a.domainAffinity !== b.domainAffinity) {
      return a.domainAffinity - b.domainAffinity;
    }

    // 2. Seniority appropriateness
    if (isFresher) {
      if (a.seniorityTier !== b.seniorityTier) {
        return a.seniorityTier - b.seniorityTier;
      }
    } else {
      const getExpTierScore = (tier) => (tier === 1 ? 4 : tier);
      const tierDiff = getExpTierScore(a.seniorityTier) - getExpTierScore(b.seniorityTier);
      if (tierDiff !== 0) {
        return tierDiff;
      }
    }

    // 3. Raw TF-IDF Cosine Similarity
    return b.matchScore - a.matchScore;
  });

  const finalJobs = enrichedJobs.slice(0, topK);

  logger.info(
    `Generated ${finalJobs.length} ML recommendations for user ${userId} (domain: ${candidateDomain.domain}, isFresher: ${isFresher}, evaluated ${totalEvaluated} jobs)`
  );

  const message = finalJobs.length === 0
    ? (locationPreference === 'india_remote'
        ? 'No sufficiently relevant openings were found among current India-based or eligible remote listings.'
        : 'No sufficiently relevant job openings were found matching your profile.')
    : `Retrieved ${finalJobs.length} recommended jobs`;

  return {
    jobs: finalJobs,
    totalEvaluated,
    emptyProfile: false,
    locationPreference,
    personalization: {
      detectedDomain: candidateDomain.domain,
      detectedDomainLabel: candidateDomain.label,
      confidence: candidateDomain.confidence,
      evidenceSummary: candidateDomain.evidenceSummary,
      isFresher,
    },
    message,
  };
};

/**
 * Retrieve recommended job listings for an authenticated user based on their Profile and Resume.
 * Strictly scopes data to the authenticated user and guarantees zero leakage of private candidate data.
 * Deduplicates in-flight requests per authenticated userId to prevent concurrent process explosion.
 *
 * @param {string|mongoose.Types.ObjectId} userId - Authenticated user's MongoDB ID
 * @param {Object} [options] - { topK, minScore, locationPreference, signal }
 * @returns {Promise<{jobs: Array, totalEvaluated: number, emptyProfile: boolean, message?: string}>}
 */
export const getRecommendedJobsForUser = async (userId, options = {}) => {
  if (!userId) {
    const error = new Error('User ID is required');
    error.statusCode = 400;
    throw error;
  }

  const userIdKey = String(userId);
  const callerSignal = options.signal;

  if (callerSignal?.aborted) {
    const abortError = new Error('Request aborted');
    abortError.name = 'AbortError';
    abortError.statusCode = 499;
    throw abortError;
  }

  let inFlight = inFlightRequests.get(userIdKey);
  const subscriberId = Symbol('recommendation_subscriber');

  if (!inFlight) {
    const sharedAbortController = new AbortController();
    const subscribers = new Set([subscriberId]);

    const promise = (async () => {
      try {
        return await executeRecommendationForUser(userId, {
          ...options,
          signal: sharedAbortController.signal,
        });
      } finally {
        // Guarantee immediate removal of completed or failed in-flight request
        inFlightRequests.delete(userIdKey);
      }
    })();

    inFlight = {
      promise,
      abortController: sharedAbortController,
      subscribers,
    };
    inFlightRequests.set(userIdKey, inFlight);
  } else {
    logger.debug(`Joining existing in-flight recommendation request for user ${userIdKey}`);
    inFlight.subscribers.add(subscriberId);
  }

  const onCallerAbort = () => {
    inFlight.subscribers.delete(subscriberId);
    // Only cancel the underlying shared process if ALL subscribers have disconnected
    if (inFlight.subscribers.size === 0) {
      inFlight.abortController.abort();
    }
  };

  if (callerSignal) {
    callerSignal.addEventListener('abort', onCallerAbort, { once: true });
  }

  try {
    if (!callerSignal) {
      return await inFlight.promise;
    }

    return await Promise.race([
      inFlight.promise,
      new Promise((_, reject) => {
        callerSignal.addEventListener(
          'abort',
          () => {
            const abortError = new Error('Request aborted');
            abortError.name = 'AbortError';
            abortError.statusCode = 499;
            reject(abortError);
          },
          { once: true }
        );
      }),
    ]);
  } finally {
    if (callerSignal) {
      callerSignal.removeEventListener('abort', onCallerAbort);
    }
    inFlight.subscribers.delete(subscriberId);
  }
};

export default {
  resolvePythonExecutable,
  resolveRecommenderScript,
  invokePythonRecommender,
  hasUsableProfileData,
  getRecommendedJobsForUser,
  prewarmPythonRecommender,
  prewarmActiveJobsCatalog,
  refreshActiveJobsCatalog,
  getInFlightRequestCount,
  fetchActiveJobsCatalog,
  invalidateActiveJobsCache,
  getCachedActiveJobs,
  getActiveJobsCatalogStatus,
  ACTIVE_JOBS_CACHE_TTL_MS,
  RECOMMENDATION_JOBS_PROJECTION,
};
