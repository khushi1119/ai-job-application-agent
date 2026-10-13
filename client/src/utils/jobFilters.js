/**
 * Utility functions for filtering job postings on the client side
 * where the available job data supports them.
 */

/**
 * Check if a job matches remote work criteria
 * @param {Object} job - Job document
 * @returns {boolean}
 */
export const isRemoteJob = (job) => {
  if (!job) return false;
  const loc = (job.location || '').toLowerCase();
  const title = (job.title || '').toLowerCase();
  const desc = (job.description || '').toLowerCase();

  return (
    loc.includes('remote') ||
    title.includes('remote') ||
    desc.includes('100% remote') ||
    desc.includes('fully remote') ||
    desc.includes('work from anywhere') ||
    desc.includes('remote friendly')
  );
};

/**
 * Check if a job matches full-time criteria
 * @param {Object} job - Job document
 * @returns {boolean}
 */
export const isFullTimeJob = (job) => {
  if (!job || (!job.title && !job.description)) return false;
  const title = (job.title || '').toLowerCase();
  const desc = (job.description || '').toLowerCase();

  // Explicitly not full-time
  if (
    title.includes('intern') ||
    title.includes('internship') ||
    title.includes('part-time') ||
    title.includes('part time') ||
    title.includes('contractor')
  ) {
    return false;
  }

  // Explicit full-time indicator in title or description
  if (
    title.includes('full-time') ||
    title.includes('full time') ||
    desc.includes('full-time') ||
    desc.includes('full time')
  ) {
    return true;
  }

  // Standard ATS permanent corporate postings default to full-time unless noted otherwise
  return !desc.includes('internship') && !desc.includes('part-time');
};


/**
 * Check if a job matches internship / co-op criteria
 * @param {Object} job - Job document
 * @returns {boolean}
 */
export const isInternshipJob = (job) => {
  if (!job) return false;
  const title = (job.title || '').toLowerCase();
  const desc = (job.description || '').toLowerCase();

  return (
    title.includes('intern') ||
    title.includes('internship') ||
    title.includes('co-op') ||
    desc.includes('summer intern') ||
    desc.includes('engineering internship')
  );
};

/**
 * Check if a job matches entry or mid-level criteria (non-senior)
 * @param {Object} job - Job document
 * @returns {boolean}
 */
export const isEntryOrMidLevelJob = (job) => {
  if (!job || !job.title) return false;
  const title = (job.title || '').toLowerCase();

  // Exclude explicit senior / executive roles
  const seniorPattern = /\b(senior|sr\.?|lead|principal|staff|director|head of|vp|vice president|chief)\b/i;
  if (seniorPattern.test(title)) {
    return false;
  }

  // Check for entry / mid level signals or general individual contributor titles
  const entryPattern = /\b(entry|junior|jr\.?|associate|mid[-\s]?level|grad|graduate|intern|internship|engineer i\b|engineer 1\b|developer i\b|developer 1\b)\b/i;
  if (entryPattern.test(title)) {
    return true;
  }

  // Roles like "Software Engineer", "Frontend Developer", "Product Designer" default to entry/mid unless marked senior
  return true;
};


/**
 * Filter an array of jobs against active UI pill filters
 *
 * @param {Array<Object>} jobs - List of raw or normalized job objects
 * @param {Object} activeFilters - Active toggle state
 * @param {boolean} [activeFilters.remote]
 * @param {boolean} [activeFilters.fullTime]
 * @param {boolean} [activeFilters.internship]
 * @param {boolean} [activeFilters.experience]
 * @returns {Array<Object>} Filtered list of jobs
 */
export const filterJobsByPills = (jobs = [], activeFilters = {}) => {
  if (!Array.isArray(jobs)) return [];

  const { remote, fullTime, internship, experience } = activeFilters;

  // If no filters are enabled, return all jobs
  if (!remote && !fullTime && !internship && !experience) {
    return jobs;
  }

  return jobs.filter((job) => {
    if (remote && !isRemoteJob(job)) {
      return false;
    }
    if (fullTime && !isFullTimeJob(job)) {
      return false;
    }
    if (internship && !isInternshipJob(job)) {
      return false;
    }
    if (experience && !isEntryOrMidLevelJob(job)) {
      return false;
    }
    return true;
  });
};
