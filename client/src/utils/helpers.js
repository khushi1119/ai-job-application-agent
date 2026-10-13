/**
 * Formats seconds into human-readable uptime string (e.g. "12m 30s")
 */
export const formatUptime = (seconds) => {
  if (!seconds || isNaN(seconds)) return '0s';
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hrs > 0) {
    return `${hrs}h ${mins}m ${secs}s`;
  }
  if (mins > 0) {
    return `${mins}m ${secs}s`;
  }
  return `${secs}s`;
};

/**
 * Format ISO date string into readable timestamp
 */
export const formatDate = (isoString) => {
  if (!isoString) return 'N/A';
  try {
    return new Date(isoString).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return isoString;
  }
};

/**
 * Calculate the Profile completion percentage (0 - 100) based on filled sections.
 * Canonical Weight Distribution (Total: 100%):
 * - Personal contact info (name, email, phone, location/links): 20%
 * - Professional summary: 10%
 * - Skills (at least 3 skills): 20%
 * - Experience (at least 1 job record): 25%
 * - Education (at least 1 degree record): 15%
 * - Projects (at least 1 project): 5%
 * - Certifications (at least 1 certification): 5%
 *
 * @param {Object} profile - Profile document or object with candidate sections
 * @returns {number} Integer between 0 and 100
 */
export const calculateProfileCompletion = (profile) => {
  if (!profile) return 0;
  let score = 0;

  // Personal Info (20% total, 5% each)
  const personal = profile.personal || {};
  if (personal.name && personal.name.trim().length > 0) score += 5;
  if (personal.email && personal.email.trim().length > 0) score += 5;
  if (personal.phone && personal.phone.trim().length > 0) score += 5;
  if (
    (personal.location && personal.location.trim().length > 0) ||
    (personal.linkedinUrl && personal.linkedinUrl.trim().length > 0) ||
    (personal.githubUrl && personal.githubUrl.trim().length > 0)
  ) {
    score += 5;
  }

  // Summary (10%)
  if (profile.summary && profile.summary.trim().length > 15) {
    score += 10;
  }

  // Skills (20%)
  if (Array.isArray(profile.skills) && profile.skills.length > 0) {
    score += profile.skills.length >= 3 ? 20 : 10;
  }

  // Experience (25%)
  if (Array.isArray(profile.experience) && profile.experience.length > 0) {
    score += 25;
  }

  // Education (15%)
  if (Array.isArray(profile.education) && profile.education.length > 0) {
    score += 15;
  }

  // Projects (5%)
  if (Array.isArray(profile.projects) && profile.projects.length > 0) {
    score += 5;
  }

  // Certifications (5%)
  if (Array.isArray(profile.certifications) && profile.certifications.length > 0) {
    score += 5;
  }

  return Math.min(100, Math.max(0, Math.round(score)));
};

/**
 * Calculate completion status and percentage for each individual Master Profile section
 * based on the canonical weights and completion rules.
 *
 * Section rules:
 * - Personal Information (4 checks worth 5% each towards overall 20%):
 *     1. name
 *     2. email
 *     3. phone
 *     4. location or LinkedIn/GitHub link
 *     -> section percentage: 0%, 25%, 50%, 75%, 100%
 * - Summary (10% overall): length > 15 -> 0% or 100%
 * - Skills (20% overall): >= 3 skills -> 100%, 1-2 skills -> 50%, 0 skills -> 0%
 * - Experience (25% overall): >= 1 record -> 0% or 100%
 * - Education (15% overall): >= 1 record -> 0% or 100%
 * - Projects (5% overall): >= 1 record -> 0% or 100%
 * - Certifications (5% overall): >= 1 record -> 0% or 100%
 *
 * @param {Object} profile - Candidate profile document or object
 * @returns {Object} Section breakdown with percentage and completion status
 */
export const calculateSectionCompletion = (profile) => {
  const personal = profile?.personal || {};

  // 1. Personal Information (4 distinct checks)
  const personalChecks = {
    name: Boolean(personal.name && personal.name.trim().length > 0),
    email: Boolean(personal.email && personal.email.trim().length > 0),
    phone: Boolean(personal.phone && personal.phone.trim().length > 0),
    locationOrLink: Boolean(
      (personal.location && personal.location.trim().length > 0) ||
      (personal.linkedinUrl && personal.linkedinUrl.trim().length > 0) ||
      (personal.githubUrl && personal.githubUrl.trim().length > 0)
    ),
  };

  const personalPassedCount = Object.values(personalChecks).filter(Boolean).length;
  const personalPercentage = Math.round((personalPassedCount / 4) * 100);

  // 2. Summary: length > 15
  const summaryComplete = Boolean(profile?.summary && profile.summary.trim().length > 15);
  const summaryPercentage = summaryComplete ? 100 : 0;

  // 3. Skills: >= 3 skills is 100%, 1-2 is 50%, 0 is 0%
  const skillsCount = Array.isArray(profile?.skills) ? profile.skills.length : 0;
  const skillsPercentage = skillsCount >= 3 ? 100 : (skillsCount > 0 ? 50 : 0);
  const skillsComplete = skillsCount >= 3;

  // 4. Experience: >= 1 record
  const experienceCount = Array.isArray(profile?.experience) ? profile.experience.length : 0;
  const experienceComplete = experienceCount > 0;
  const experiencePercentage = experienceComplete ? 100 : 0;

  // 5. Education: >= 1 record
  const educationCount = Array.isArray(profile?.education) ? profile.education.length : 0;
  const educationComplete = educationCount > 0;
  const educationPercentage = educationComplete ? 100 : 0;

  // 6. Projects: >= 1 record
  const projectsCount = Array.isArray(profile?.projects) ? profile.projects.length : 0;
  const projectsComplete = projectsCount > 0;
  const projectsPercentage = projectsComplete ? 100 : 0;

  // 7. Certifications: >= 1 record
  const certificationsCount = Array.isArray(profile?.certifications) ? profile.certifications.length : 0;
  const certificationsComplete = certificationsCount > 0;
  const certificationsPercentage = certificationsComplete ? 100 : 0;

  return {
    personal: {
      percentage: personalPercentage,
      isComplete: personalPassedCount === 4,
      checks: personalChecks,
      passedCount: personalPassedCount,
    },
    summary: {
      percentage: summaryPercentage,
      isComplete: summaryComplete,
    },
    skills: {
      percentage: skillsPercentage,
      isComplete: skillsComplete,
      count: skillsCount,
    },
    experience: {
      percentage: experiencePercentage,
      isComplete: experienceComplete,
      count: experienceCount,
    },
    education: {
      percentage: educationPercentage,
      isComplete: educationComplete,
      count: educationCount,
    },
    projects: {
      percentage: projectsPercentage,
      isComplete: projectsComplete,
      count: projectsCount,
    },
    certifications: {
      percentage: certificationsPercentage,
      isComplete: certificationsComplete,
      count: certificationsCount,
    },
  };
};

/**
 * Returns a human-friendly freshness label if the job has been verified upstream.
 * Returns null if the job is unverified (do not claim unverified jobs are open).
 *
 * @param {string|Date|null} lastVerifiedAt
 * @returns {string|null}
 */
export const formatJobFreshness = (lastVerifiedAt) => {
  if (!lastVerifiedAt) return null;
  try {
    const verifiedTime = new Date(lastVerifiedAt).getTime();
    if (isNaN(verifiedTime)) return null;

    const now = Date.now();
    const diffMs = now - verifiedTime;
    if (diffMs < 0) return 'Verified today'; // Clock skew safeguard

    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    if (diffHours < 24) {
      return 'Verified today';
    }

    const diffDays = Math.floor(diffHours / 24);
    if (diffDays === 1) {
      return 'Verified 1d ago';
    }
    if (diffDays < 7) {
      return `Verified ${diffDays}d ago`;
    }
    const diffWeeks = Math.floor(diffDays / 7);
    if (diffWeeks === 1) {
      return 'Verified 1w ago';
    }
    return `Verified ${diffWeeks}w ago`;
  } catch {
    return null;
  }
};

