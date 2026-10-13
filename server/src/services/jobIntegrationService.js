import { Job } from '../models/Job.js';
import { getActiveJobBoards } from '../config/jobBoards.js';
import { invalidateActiveJobsCache } from './recommendationService.js';
import { logger } from '../utils/logger.js';

/**
 * Clean and strip HTML tags and decode common HTML entities.
 *
 * @param {string} html
 * @returns {string} Plain text
 */
export const stripHtml = (html) => {
  if (!html || typeof html !== 'string') return '';
  return html
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/<br\s*[\/]?>/gi, '\n')
    .replace(/<\/(h[1-6]|p|div|tr)>/gi, '\n\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/\n\s*\n\s*\n+/g, '\n\n')
    .trim();
};

/**
 * Extract bullet-point requirements from text or HTML.
 *
 * @param {string} content
 * @returns {Array<string>}
 */
export const extractRequirementsFromText = (content) => {
  if (!content || typeof content !== 'string') return [];
  const clean = stripHtml(content);
  const lines = clean.split('\n');
  const requirements = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (/^[-*•·]\s+(.+)/.test(trimmed)) {
      const item = trimmed.replace(/^[-*•·]\s+/, '').trim();
      if (item.length >= 6 && item.length <= 250) {
        requirements.push(item);
      }
    }
  }

  return requirements.slice(0, 8);
};

const DEFAULT_FETCH_TIMEOUT_MS = 8000;

/**
 * Normalize a Greenhouse API job object to standard Job schema fields.
 *
 * @param {Object} rawJob - Greenhouse job object
 * @param {string} companyName - Display name of the company
 * @returns {Object|null}
 */
export const normalizeGreenhouseJob = (rawJob, companyName = 'Company') => {
  if (!rawJob || !rawJob.id || !rawJob.absolute_url || !rawJob.title) {
    return null;
  }

  const cleanDescription = stripHtml(rawJob.content || '');
  const requirements = extractRequirementsFromText(rawJob.content || '');

  return {
    externalId: String(rawJob.id).trim(),
    title: rawJob.title.trim(),
    company: companyName.trim(),
    location: (rawJob.location?.name || 'Remote').trim(),
    description: cleanDescription,
    requirements,
    sourceUrl: rawJob.absolute_url.trim(),
    platform: 'greenhouse',
    status: 'discovered',
  };
};

/**
 * Normalize a Lever API posting object to standard Job schema fields.
 *
 * @param {Object} rawPosting - Lever posting object
 * @param {string} companyName - Display name of the company
 * @returns {Object|null}
 */
export const normalizeLeverJob = (rawPosting, companyName = 'Company') => {
  if (!rawPosting || !rawPosting.id || !rawPosting.hostedUrl || !rawPosting.text) {
    return null;
  }

  const rawLocation =
    rawPosting.categories?.location ||
    (Array.isArray(rawPosting.categories?.allLocations)
      ? rawPosting.categories.allLocations.join(', ')
      : 'Remote');

  let requirements = [];
  if (Array.isArray(rawPosting.lists)) {
    const reqList = rawPosting.lists.find((l) =>
      /requirement|qualification|what you.*bring|must have/i.test(l.text || '')
    );
    if (reqList && typeof reqList.content === 'string') {
      requirements = extractRequirementsFromText(reqList.content);
    }
  }

  const description = stripHtml(rawPosting.descriptionPlain || rawPosting.description || '');

  return {
    externalId: String(rawPosting.id).trim(),
    title: rawPosting.text.trim(),
    company: companyName.trim(),
    location: (rawLocation || 'Remote').trim(),
    description,
    requirements,
    sourceUrl: rawPosting.hostedUrl.trim(),
    platform: 'lever',
    status: 'discovered',
  };
};

/**
 * Fetch and parse jobs from a Greenhouse board endpoint.
 * URL: https://boards-api.greenhouse.io/v1/boards/{token}/jobs?content=true
 *
 * @param {string} boardToken - Company identifier in Greenhouse
 * @param {string} companyName - Display name
 * @param {Object} [options]
 * @returns {Promise<Array<Object>>}
 */
export const fetchGreenhouseBoard = async (boardToken, companyName, options = {}) => {
  const timeoutMs = options.timeoutMs || DEFAULT_FETCH_TIMEOUT_MS;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  const url = `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(
    boardToken
  )}/jobs?content=true`;
  const returnDetailed = options.detailed === true;

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
      },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const msg = `Greenhouse board '${boardToken}' responded with status ${response.status} (${response.statusText})`;
      logger.warn(msg);
      return returnDetailed
        ? { success: false, isComplete: false, jobs: [], error: msg }
        : [];
    }

    let data;
    try {
      if (typeof response.text === 'function') {
        const text = await response.text();
        if (!text || !text.trim()) {
          const msg = `Greenhouse board '${boardToken}' returned an empty payload`;
          logger.warn(msg);
          return returnDetailed
            ? { success: false, isComplete: false, jobs: [], error: msg }
            : [];
        }
        data = JSON.parse(text);
      } else if (typeof response.json === 'function') {
        data = await response.json();
      }
    } catch (parseErr) {
      const msg = `Greenhouse board '${boardToken}' returned malformed JSON: ${parseErr.message}`;
      logger.warn(msg);
      return returnDetailed
        ? { success: false, isComplete: false, jobs: [], error: msg }
        : [];
    }

    if (!data || typeof data !== 'object' || !Array.isArray(data.jobs)) {
      const msg = `Greenhouse board '${boardToken}' returned unexpected payload structure`;
      logger.warn(msg);
      return returnDetailed
        ? { success: false, isComplete: false, jobs: [], error: msg }
        : [];
    }

    // Check pagination or incompleteness
    const linkHeader = response.headers?.get?.('link') || '';
    const hasNextPage = linkHeader.includes('rel="next"');
    const totalCount = data.meta?.total;
    const isPartial = hasNextPage || (typeof totalCount === 'number' && totalCount > data.jobs.length);

    const normalizedJobs = data.jobs
      .map((job) => normalizeGreenhouseJob(job, companyName))
      .filter(Boolean);

    if (returnDetailed) {
      return {
        success: true,
        isComplete: !isPartial,
        incompleteReason: isPartial ? 'Pagination detected; subsequent pages were not fetched' : null,
        jobs: normalizedJobs,
      };
    }

    return normalizedJobs;
  } catch (err) {
    clearTimeout(timeoutId);
    let msg;
    if (err.name === 'AbortError') {
      msg = `Greenhouse fetch timed out for board '${boardToken}' after ${timeoutMs}ms`;
    } else {
      msg = `Failed to fetch Greenhouse board '${boardToken}': ${err.message}`;
    }
    logger.warn(msg);
    return returnDetailed
      ? { success: false, isComplete: false, jobs: [], error: msg }
      : [];
  }
};

/**
 * Fetch and parse postings from a Lever company board endpoint.
 * URL: https://api.lever.co/v0/postings/{token}?mode=json
 *
 * @param {string} boardToken - Company identifier in Lever
 * @param {string} companyName - Display name
 * @param {Object} [options]
 * @returns {Promise<Array<Object>|Object>}
 */
export const fetchLeverBoard = async (boardToken, companyName, options = {}) => {
  const timeoutMs = options.timeoutMs || DEFAULT_FETCH_TIMEOUT_MS;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  const url = `https://api.lever.co/v0/postings/${encodeURIComponent(boardToken)}?mode=json`;
  const returnDetailed = options.detailed === true;

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
      },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const msg = `Lever board '${boardToken}' responded with status ${response.status} (${response.statusText})`;
      logger.warn(msg);
      return returnDetailed
        ? { success: false, isComplete: false, jobs: [], error: msg }
        : [];
    }

    let data;
    try {
      if (typeof response.text === 'function') {
        const text = await response.text();
        if (!text || !text.trim()) {
          const msg = `Lever board '${boardToken}' returned an empty payload`;
          logger.warn(msg);
          return returnDetailed
            ? { success: false, isComplete: false, jobs: [], error: msg }
            : [];
        }
        data = JSON.parse(text);
      } else if (typeof response.json === 'function') {
        data = await response.json();
      }
    } catch (parseErr) {
      const msg = `Lever board '${boardToken}' returned malformed JSON: ${parseErr.message}`;
      logger.warn(msg);
      return returnDetailed
        ? { success: false, isComplete: false, jobs: [], error: msg }
        : [];
    }

    if (!Array.isArray(data)) {
      const msg = `Lever board '${boardToken}' returned non-array payload`;
      logger.warn(msg);
      return returnDetailed
        ? { success: false, isComplete: false, jobs: [], error: msg }
        : [];
    }

    // Check pagination or link headers
    const linkHeader = response.headers?.get?.('link') || '';
    const hasNextPage = linkHeader.includes('rel="next"');

    const normalizedJobs = data
      .map((posting) => normalizeLeverJob(posting, companyName))
      .filter(Boolean);

    if (returnDetailed) {
      return {
        success: true,
        isComplete: !hasNextPage,
        incompleteReason: hasNextPage ? 'Pagination detected; subsequent pages were not fetched' : null,
        jobs: normalizedJobs,
      };
    }

    return normalizedJobs;
  } catch (err) {
    clearTimeout(timeoutId);
    let msg;
    if (err.name === 'AbortError') {
      msg = `Lever fetch timed out for board '${boardToken}' after ${timeoutMs}ms`;
    } else {
      msg = `Failed to fetch Lever board '${boardToken}': ${err.message}`;
    }
    logger.warn(msg);
    return returnDetailed
      ? { success: false, isComplete: false, jobs: [], error: msg }
      : [];
  }
};

/**
 * Normalize an Ashby API job object to standard Job schema fields.
 * URL: https://api.ashbyhq.com/posting-api/job-board/{token}
 *
 * @param {Object} rawJob - Ashby job object
 * @param {string} companyName - Display name of the company
 * @returns {Object|null}
 */
export const normalizeAshbyJob = (rawJob, companyName = 'Company') => {
  if (!rawJob || !rawJob.id || !rawJob.title || !(rawJob.jobUrl || rawJob.applyUrl)) {
    return null;
  }

  const loc = (rawJob.location || '').trim();
  const location = loc
    ? rawJob.isRemote && !/remote/i.test(loc)
      ? `${loc} (Remote)`
      : loc
    : 'Remote';

  const cleanDescription = stripHtml(rawJob.descriptionPlain || rawJob.descriptionHtml || '');
  const requirements = extractRequirementsFromText(
    rawJob.descriptionHtml || rawJob.descriptionPlain || ''
  );

  return {
    externalId: String(rawJob.id).trim(),
    title: rawJob.title.trim(),
    company: companyName.trim(),
    location,
    description: cleanDescription,
    requirements,
    sourceUrl: (rawJob.jobUrl || rawJob.applyUrl).trim(),
    platform: 'ashby',
    status: 'discovered',
  };
};

/**
 * Fetch and parse jobs from an Ashby company board endpoint.
 * URL: https://api.ashbyhq.com/posting-api/job-board/{token}
 *
 * @param {string} boardToken - Company identifier in Ashby
 * @param {string} companyName - Display name
 * @param {Object} [options]
 * @returns {Promise<Array<Object>|Object>}
 */
export const fetchAshbyBoard = async (boardToken, companyName, options = {}) => {
  const timeoutMs = options.timeoutMs || DEFAULT_FETCH_TIMEOUT_MS;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  const url = `https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(boardToken)}`;
  const returnDetailed = options.detailed === true;

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
      },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const msg = `Ashby board '${boardToken}' responded with status ${response.status} (${response.statusText})`;
      logger.warn(msg);
      return returnDetailed
        ? { success: false, isComplete: false, jobs: [], error: msg }
        : [];
    }

    let data;
    try {
      if (typeof response.text === 'function') {
        const text = await response.text();
        if (!text || !text.trim()) {
          const msg = `Ashby board '${boardToken}' returned an empty payload`;
          logger.warn(msg);
          return returnDetailed
            ? { success: false, isComplete: false, jobs: [], error: msg }
            : [];
        }
        data = JSON.parse(text);
      } else if (typeof response.json === 'function') {
        data = await response.json();
      }
    } catch (parseErr) {
      const msg = `Ashby board '${boardToken}' returned malformed JSON: ${parseErr.message}`;
      logger.warn(msg);
      return returnDetailed
        ? { success: false, isComplete: false, jobs: [], error: msg }
        : [];
    }

    if (!data || typeof data !== 'object' || !Array.isArray(data.jobs)) {
      const msg = `Ashby board '${boardToken}' returned unexpected payload structure`;
      logger.warn(msg);
      return returnDetailed
        ? { success: false, isComplete: false, jobs: [], error: msg }
        : [];
    }

    // Check pagination in Ashby: data.nextCursor or data.hasMore
    const isPartial = Boolean(data.nextCursor || data.hasMore);

    const normalizedJobs = data.jobs
      .map((job) => normalizeAshbyJob(job, companyName))
      .filter(Boolean);

    if (returnDetailed) {
      return {
        success: true,
        isComplete: !isPartial,
        incompleteReason: isPartial ? 'Pagination detected; nextCursor present' : null,
        jobs: normalizedJobs,
      };
    }

    return normalizedJobs;
  } catch (err) {
    clearTimeout(timeoutId);
    let msg;
    if (err.name === 'AbortError') {
      msg = `Ashby fetch timed out for board '${boardToken}' after ${timeoutMs}ms`;
    } else {
      msg = `Failed to fetch Ashby board '${boardToken}': ${err.message}`;
    }
    logger.warn(msg);
    return returnDetailed
      ? { success: false, isComplete: false, jobs: [], error: msg }
      : [];
  }
};

/**
 * Idempotently save normalized jobs to MongoDB, deduplicating on (platform + externalId) or sourceUrl.
 * Preserves user-assigned statuses on existing documents with $setOnInsert.
 * Sets lastVerifiedAt timestamp and confirms job is not closed.
 *
 * @param {Array<Object>} normalizedJobs
 * @param {Object} [options]
 * @param {Date} [options.syncTime]
 * @returns {Promise<number>} Number of successfully processed/persisted jobs
 */
export const persistNormalizedJobs = async (normalizedJobs = [], options = {}) => {
  if (!Array.isArray(normalizedJobs) || normalizedJobs.length === 0) {
    return 0;
  }

  const syncTime = (options && options.syncTime) || new Date();
  let savedCount = 0;

  for (const job of normalizedJobs) {
    try {
      // Stable deduplication filter
      const filter = {
        platform: job.platform,
        ...(job.externalId
          ? { externalId: job.externalId }
          : { sourceUrl: job.sourceUrl }),
      };

      const updateDoc = {
        $set: {
          title: job.title,
          company: job.company,
          location: job.location,
          description: job.description,
          requirements: job.requirements,
          sourceUrl: job.sourceUrl,
          platform: job.platform,
          externalId: job.externalId,
          lastVerifiedAt: syncTime,
          isClosed: false,
          closedAt: null,
        },
        $setOnInsert: {
          status: 'discovered',
        },
      };

      await Job.findOneAndUpdate(filter, updateDoc, {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true,
      });

      savedCount++;
    } catch (err) {
      logger.error(`Error persisting job '${job.title}' (${job.sourceUrl}):`, err.message);
    }
  }

  return savedCount;
};

/**
 * Safely reconciles disappeared jobs for a specific company board upon a confirmed full sync.
 * Scoped strictly to the matching company and platform.
 * Sets isClosed: true and closedAt: syncTime without modifying user application tracking status.
 *
 * @param {Object} board - Board config object { name, platform, token }
 * @param {Array<Object>} liveJobs - Successfully fetched and verified live jobs
 * @param {Date} [syncTime]
 * @returns {Promise<number>} Number of confirmed closed jobs
 */
export const reconcileClosedJobsForBoard = async (board, liveJobs = [], syncTime = new Date()) => {
  if (!board || !board.name || !board.platform) {
    return 0;
  }

  try {
    const liveExternalIds = new Set(
      liveJobs.map((j) => (j.externalId ? String(j.externalId).trim() : null)).filter(Boolean)
    );
    const liveSourceUrls = new Set(
      liveJobs.map((j) => (j.sourceUrl ? String(j.sourceUrl).trim() : null)).filter(Boolean)
    );

    const existingOpenJobs = await Job.find({
      company: board.name,
      platform: board.platform,
      isClosed: { $ne: true },
    })
      .select('_id externalId sourceUrl title company platform status')
      .lean();

    if (!existingOpenJobs || existingOpenJobs.length === 0) {
      return 0;
    }

    const closedJobIds = [];
    for (const openJob of existingOpenJobs) {
      const extId = openJob.externalId ? String(openJob.externalId).trim() : '';
      const srcUrl = openJob.sourceUrl ? String(openJob.sourceUrl).trim() : '';

      const existsByExternalId = extId && liveExternalIds.has(extId);
      const existsBySourceUrl = srcUrl && liveSourceUrls.has(srcUrl);

      if (!existsByExternalId && !existsBySourceUrl) {
        closedJobIds.push(openJob._id);
      }
    }

    if (closedJobIds.length === 0) {
      return 0;
    }

    const updateResult = await Job.updateMany(
      { _id: { $in: closedJobIds } },
      {
        $set: {
          isClosed: true,
          closedAt: syncTime,
        },
      }
    );

    const closedCount =
      updateResult.modifiedCount !== undefined ? updateResult.modifiedCount : closedJobIds.length;
    logger.info(
      `Reconciled board '${board.name}' (${board.platform}): marked ${closedCount} disappeared jobs as closed.`
    );
    return closedCount;
  } catch (err) {
    logger.error(`Error during closure reconciliation for board '${board.name}':`, err.message);
    return 0;
  }
};

/**
 * Fetch and synchronize jobs from a single company board.
 * Safely handles errors, timeouts, and performs closure reconciliation only when
 * the source board fetch is complete and verified.
 *
 * @param {Object} board - Board config object { name, platform, token }
 * @param {Object} [options]
 * @returns {Promise<Object>} Summary of sync execution
 */
export const syncSingleBoard = async (board, options = {}) => {
  const result = {
    board: board.name,
    platform: board.platform,
    fetched: 0,
    saved: 0,
    closed: 0,
    success: false,
    reconciled: false,
    error: null,
  };

  try {
    let fetchRes;
    const fetchOptions = { ...options, detailed: true };

    if (board.platform === 'greenhouse') {
      fetchRes = await fetchGreenhouseBoard(board.token, board.name, fetchOptions);
    } else if (board.platform === 'lever') {
      fetchRes = await fetchLeverBoard(board.token, board.name, fetchOptions);
    } else if (board.platform === 'ashby') {
      fetchRes = await fetchAshbyBoard(board.token, board.name, fetchOptions);
    } else {
      result.error = `Unsupported platform: '${board.platform}'`;
      return result;
    }

    if (!fetchRes.success) {
      result.error = fetchRes.error || 'Board fetch failed';
      result.success = true; // Handled safely without unhandled crash
      logger.warn(`Sync handled safely for ${board.name}: ${result.error}`);
      return result;
    }

    const normalizedJobs = fetchRes.jobs || [];
    result.fetched = normalizedJobs.length;
    const syncTime = options.syncTime || new Date();

    // Persist live jobs idempotently if database persistence is not explicitly disabled
    if (options.persist !== false) {
      result.saved = await persistNormalizedJobs(normalizedJobs, { syncTime });

      // Closure reconciliation: ONLY if the fetch was proven complete
      if (fetchRes.isComplete) {
        result.closed = await reconcileClosedJobsForBoard(board, normalizedJobs, syncTime);
        result.reconciled = true;
      } else {
        logger.warn(
          `Skipping closure reconciliation for board '${board.name}': fetch could not be proven complete (${fetchRes.incompleteReason || 'partial or paginated board response'}).`
        );
      }
    } else {
      result.saved = normalizedJobs.length;
    }

    result.success = true;
  } catch (err) {
    result.error = err.message || 'Unknown sync error';
    logger.error(`Error syncing board ${board.name}:`, err);
  }

  return result;
};

/**
 * Fetch and synchronize jobs across all configured public company boards.
 *
 * @param {Array<Object>} [boardsList] - Optional custom board list
 * @param {Object} [options]
 * @returns {Promise<Object>} Aggregate sync summary
 */
export const syncAllJobBoards = async (boardsList = null, options = {}) => {
  const targetBoards = boardsList || getActiveJobBoards();

  const summary = {
    totalFetched: 0,
    totalSaved: 0,
    totalClosed: 0,
    boardsProcessed: 0,
    boardsFailed: 0,
    results: [],
    errors: [],
  };

  const results = await Promise.allSettled(
    targetBoards.map((board) => syncSingleBoard(board, options))
  );

  for (const res of results) {
    summary.boardsProcessed++;
    if (res.status === 'fulfilled') {
      const data = res.value;
      summary.results.push(data);
      summary.totalFetched += data.fetched;
      summary.totalSaved += data.saved;
      summary.totalClosed += data.closed || 0;
      if (!data.success) {
        summary.boardsFailed++;
        if (data.error) summary.errors.push(`${data.board}: ${data.error}`);
      }
    } else {
      summary.boardsFailed++;
      summary.errors.push(res.reason?.message || 'Sync failed');
    }
  }

  logger.info(
    `Job synchronization completed: ${summary.totalSaved} jobs saved, ${summary.totalClosed} jobs closed across ${summary.boardsProcessed} boards (${summary.boardsFailed} failed)`
  );

  // Invalidate in-memory active jobs cache so recommendations immediately reflect updated catalog
  invalidateActiveJobsCache({ refreshInBackground: true });

  return summary;
};

let syncIntervalId = null;
let isSyncInProgress = false;

/**
 * Execute a safe sync cycle guarding against concurrent runs.
 *
 * @param {Object} [options]
 * @returns {Promise<Object|null>}
 */
export const runScheduledSyncCycle = async (options = {}) => {
  if (isSyncInProgress) {
    logger.warn('Scheduled job sync skipped: a sync cycle is already in progress');
    return null;
  }

  isSyncInProgress = true;
  try {
    logger.info('Starting scheduled job board synchronization cycle...');
    const summary = await syncAllJobBoards(options.boardsList, options);
    logger.info(
      `Scheduled job sync completed: ${summary.totalSaved} jobs synced across ${summary.boardsProcessed} boards (${summary.boardsFailed} failed)`
    );
    return summary;
  } catch (err) {
    logger.error('Error in scheduled job sync cycle:', err.message);
    return null;
  } finally {
    isSyncInProgress = false;
  }
};

/**
 * Start periodic job sync schedule.
 *
 * @param {Object} [config]
 * @param {number} [config.intervalHours] - Interval in hours (default from env or 24)
 * @param {number} [config.intervalMs] - Custom interval in ms (takes priority over intervalHours)
 * @param {boolean} [config.runImmediately] - Whether to trigger an immediate non-blocking sync run on start
 * @returns {NodeJS.Timeout|null}
 */
export const startJobSyncSchedule = (config = {}) => {
  if (syncIntervalId) {
    logger.info('Job sync scheduler already running');
    return syncIntervalId;
  }

  const intervalHours =
    config.intervalHours !== undefined
      ? config.intervalHours
      : parseInt(process.env.JOB_SYNC_INTERVAL_HOURS || '24', 10);

  if (intervalHours <= 0 && !config.intervalMs) {
    logger.info('Job sync scheduler is disabled (JOB_SYNC_INTERVAL_HOURS <= 0)');
    return null;
  }

  const intervalMs =
    config.intervalMs ||
    (intervalHours > 0 ? intervalHours * 60 * 60 * 1000 : 24 * 60 * 60 * 1000);
  const runImmediately =
    config.runImmediately !== undefined
      ? config.runImmediately
      : process.env.JOB_SYNC_ON_STARTUP === 'true';

  logger.info(
    `Initializing periodic job board sync every ${intervalMs}ms (${intervalHours || intervalMs / 3600000}h)`
  );

  if (runImmediately) {
    setImmediate(() => {
      runScheduledSyncCycle().catch((err) => {
        logger.warn('Initial background job sync failed:', err.message);
      });
    });
  }

  syncIntervalId = setInterval(() => {
    runScheduledSyncCycle().catch((err) => {
      logger.warn('Periodic background job sync failed:', err.message);
    });
  }, intervalMs);

  if (typeof syncIntervalId.unref === 'function') {
    syncIntervalId.unref();
  }

  return syncIntervalId;
};

/**
 * Stop periodic job sync schedule cleanly.
 */
export const stopJobSyncSchedule = () => {
  if (syncIntervalId) {
    clearInterval(syncIntervalId);
    syncIntervalId = null;
    logger.info('Job sync scheduler stopped');
  }
};

export default {
  stripHtml,
  extractRequirementsFromText,
  normalizeGreenhouseJob,
  normalizeLeverJob,
  normalizeAshbyJob,
  fetchGreenhouseBoard,
  fetchLeverBoard,
  fetchAshbyBoard,
  persistNormalizedJobs,
  reconcileClosedJobsForBoard,
  syncSingleBoard,
  syncAllJobBoards,
  runScheduledSyncCycle,
  startJobSyncSchedule,
  stopJobSyncSchedule,
};
