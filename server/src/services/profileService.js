import mongoose from 'mongoose';
import Profile from '../models/Profile.js';
import User from '../models/User.js';
import { logger } from '../utils/logger.js';

/**
 * Calculate the Profile completion percentage (0 - 100) based on filled sections.
 *
 * Canonical Weight Distribution (Total: 100%):
 * - Personal contact info (name, email, phone, location/links): 20%
 * - Professional summary: 10%
 * - Skills (at least 3 skills): 20%
 * - Experience (at least 1 job record): 25%
 * - Education (at least 1 degree record): 15%
 * - Projects (at least 1 project): 5%
 * - Certifications (at least 1 certification): 5%
 *
 * @param {Object} profile - Profile document or object
 * @returns {number} Integer between 0 and 100
 */
export const calculateCompletionPercentage = (profile) => {
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
 * Retrieve user's Profile document by user ID.
 * Automatically synchronizes stored completionPercentage if it differs from the canonical calculation.
 *
 * @param {string|mongoose.Types.ObjectId} userId
 * @returns {Promise<Profile|null>}
 */
export const getMyProfile = async (userId) => {
  if (!userId) throw new Error('User ID is required');
  const profile = await Profile.findOne({ userId });
  if (!profile) return null;

  // Ensure stored completionPercentage matches canonical calculation logic
  const canonicalPercentage = calculateCompletionPercentage(profile);
  if (profile.completionPercentage !== canonicalPercentage) {
    profile.completionPercentage = canonicalPercentage;
    await profile.save();
    logger.info(
      `Synchronized profile completion percentage for user ${userId} to canonical ${canonicalPercentage}%`
    );
  }

  return profile;
};

/**
 * Check if a given value is a valid 24-character hexadecimal ObjectId string or ObjectId instance.
 *
 * @param {*} id
 * @returns {boolean}
 */
export const isValidObjectId = (id) => {
  if (!id) return false;
  if (typeof id === 'string') return /^[0-9a-fA-F]{24}$/.test(id.trim());
  return mongoose.Types.ObjectId.isValid(id);
};

/**
 * Parse human-readable or ISO date values into Date objects or null.
 * Detects ongoing/present employment and education markers.
 *
 * @param {*} val - Input date representation
 * @returns {{ date: Date|null, isPresent: boolean }}
 */
export const parseFlexibleDate = (val) => {
  if (!val) return { date: null, isPresent: false };
  if (val instanceof Date) {
    return isNaN(val.getTime()) ? { date: null, isPresent: false } : { date: val, isPresent: false };
  }
  if (typeof val !== 'string') return { date: null, isPresent: false };
  const trimmed = val.trim();
  if (!trimmed) return { date: null, isPresent: false };

  // Keywords indicating current/ongoing engagement
  if (/^(present|current|ongoing|now|till\s*date|to\s*date)$/i.test(trimmed)) {
    return { date: null, isPresent: true };
  }

  // 4-digit year 'YYYY'
  if (/^\d{4}$/.test(trimmed)) {
    return { date: new Date(parseInt(trimmed, 10), 0, 1), isPresent: false };
  }

  // 'YYYY-MM'
  if (/^\d{4}-\d{2}$/.test(trimmed)) {
    const [y, m] = trimmed.split('-');
    return { date: new Date(parseInt(y, 10), parseInt(m, 10) - 1, 1), isPresent: false };
  }

  // 'Expected YYYY' or 'Expected Month YYYY'
  const expectedMatch = trimmed.match(/expected\s+(?:[a-zA-Z]+\s+)?(\d{4})/i);
  if (expectedMatch) {
    return { date: new Date(parseInt(expectedMatch[1], 10), 4, 1), isPresent: false };
  }

  const parsed = new Date(trimmed);
  if (!isNaN(parsed.getTime())) {
    return { date: parsed, isPresent: false };
  }

  // String containing a 4-digit year e.g. '2022 - 2026'
  const yearMatch = trimmed.match(/\b(19\d{2}|20\d{2})\b/);
  if (yearMatch) {
    return { date: new Date(parseInt(yearMatch[0], 10), 0, 1), isPresent: false };
  }

  return { date: null, isPresent: false };
};

/**
 * Sanitize experience array to conform to Mongoose subdocument schema:
 * - Safely parses start and end dates without throwing CastError
 * - Converts 'Present' into current: true and endDate: null
 * - Strips empty or malformed _id strings to prevent BSONError
 *
 * @param {Array} items
 * @returns {Array}
 */
export const sanitizeExperience = (items) => {
  if (!Array.isArray(items)) return [];
  return items.map((item) => {
    const clean = { ...(item?.toObject?.() || item || {}) };
    if (!isValidObjectId(clean._id)) {
      delete clean._id;
    }
    const start = parseFlexibleDate(clean.startDate);
    const end = parseFlexibleDate(clean.endDate);

    clean.startDate = start.date;
    clean.current = Boolean(clean.current || end.isPresent);
    clean.endDate = clean.current ? null : end.date;

    if (Array.isArray(clean.highlights)) {
      clean.highlights = clean.highlights.filter((h) => typeof h === 'string' && h.trim().length > 0);
    }
    if (Array.isArray(clean.technologies)) {
      clean.technologies = clean.technologies.filter((t) => typeof t === 'string' && t.trim().length > 0);
    }

    return clean;
  });
};

/**
 * Sanitize education array to conform to Mongoose subdocument schema:
 * - Safely parses start and end dates
 * - Converts 'Present' into current: true and endDate: null
 * - Strips empty or malformed _id strings
 *
 * @param {Array} items
 * @returns {Array}
 */
export const sanitizeEducation = (items) => {
  if (!Array.isArray(items)) return [];
  return items.map((item) => {
    const clean = { ...(item?.toObject?.() || item || {}) };
    if (!isValidObjectId(clean._id)) {
      delete clean._id;
    }
    const start = parseFlexibleDate(clean.startDate);
    const end = parseFlexibleDate(clean.endDate);

    clean.startDate = start.date;
    clean.current = Boolean(clean.current || end.isPresent);
    clean.endDate = clean.current ? null : end.date;

    return clean;
  });
};

/**
 * Sanitize certifications array:
 * - Safely parses issue and expiry dates or maps to null
 * - Strips empty or malformed _id strings
 *
 * @param {Array} items
 * @returns {Array}
 */
export const sanitizeCertifications = (items) => {
  if (!Array.isArray(items)) return [];
  return items.map((item) => {
    const clean = { ...(item?.toObject?.() || item || {}) };
    if (!isValidObjectId(clean._id)) {
      delete clean._id;
    }
    clean.issueDate = parseFlexibleDate(clean.issueDate).date;
    clean.expiryDate = parseFlexibleDate(clean.expiryDate).date;
    return clean;
  });
};

/**
 * Sanitize projects array:
 * - Strips empty or malformed _id strings
 * - Cleans technologies list
 *
 * @param {Array} items
 * @returns {Array}
 */
export const sanitizeProjects = (items) => {
  if (!Array.isArray(items)) return [];
  return items.map((item) => {
    const clean = { ...(item?.toObject?.() || item || {}) };
    if (!isValidObjectId(clean._id)) {
      delete clean._id;
    }
    if (Array.isArray(clean.technologies)) {
      clean.technologies = clean.technologies.filter((t) => typeof t === 'string' && t.trim().length > 0);
    }
    return clean;
  });
};

/**
 * Create or update a Profile document for a user.
 * Recalculates completion percentage and associates profileId with the User.
 *
 * @param {string|mongoose.Types.ObjectId} userId
 * @param {Object} profileData - Profile data fields to update
 * @param {boolean} [markOnboardingComplete=false] - Whether to mark user.onboardingCompleted = true
 * @returns {Promise<Profile>}
 */
export const createOrUpdateProfile = async (
  userId,
  profileData = {},
  markOnboardingComplete = false
) => {
  if (!userId) {
    throw new Error('User ID is required to create or update profile');
  }

  let profile = await Profile.findOne({ userId });

  // Sanitize subdocument arrays and dates to match Mongoose schema expectations
  const sanitizedExperience =
    profileData.experience !== undefined
      ? sanitizeExperience(profileData.experience)
      : profile?.experience || [];

  const sanitizedEducation =
    profileData.education !== undefined
      ? sanitizeEducation(profileData.education)
      : profile?.education || [];

  const sanitizedCertifications =
    profileData.certifications !== undefined
      ? sanitizeCertifications(profileData.certifications)
      : profile?.certifications || [];

  const sanitizedProjects =
    profileData.projects !== undefined
      ? sanitizeProjects(profileData.projects)
      : profile?.projects || [];

  const sanitizedSkills =
    profileData.skills !== undefined
      ? Array.isArray(profileData.skills)
        ? profileData.skills.map((s) => (typeof s === 'string' ? s.trim() : '')).filter(Boolean)
        : []
      : profile?.skills || [];

  // Compute merged candidate object to determine completion percentage
  const mergedForScore = {
    personal: {
      ...(profile?.personal?.toObject?.() || profile?.personal || {}),
      ...(profileData.personal || {}),
    },
    summary:
      profileData.summary !== undefined
        ? profileData.summary
        : profile?.summary || '',
    skills: sanitizedSkills,
    education: sanitizedEducation,
    experience: sanitizedExperience,
    projects: sanitizedProjects,
    certifications: sanitizedCertifications,
  };

  const completionPercentage = calculateCompletionPercentage(mergedForScore);

  if (profile) {
    // Update existing profile fields
    if (profileData.personal) {
      profile.personal = mergedForScore.personal;
    }
    if (profileData.summary !== undefined) {
      profile.summary = profileData.summary;
    }
    if (profileData.skills !== undefined) {
      profile.skills = sanitizedSkills;
    }
    if (profileData.education !== undefined) {
      profile.education = sanitizedEducation;
    }
    if (profileData.experience !== undefined) {
      profile.experience = sanitizedExperience;
    }
    if (profileData.projects !== undefined) {
      profile.projects = sanitizedProjects;
    }
    if (profileData.certifications !== undefined) {
      profile.certifications = sanitizedCertifications;
    }

    profile.completionPercentage = completionPercentage;
    profile = await profile.save();
    logger.info(`Updated existing Profile for user ${userId} (${completionPercentage}% completed)`);
  } else {
    // Create new Profile record
    profile = await Profile.create({
      userId,
      personal: mergedForScore.personal,
      summary: mergedForScore.summary,
      skills: sanitizedSkills,
      education: sanitizedEducation,
      experience: sanitizedExperience,
      projects: sanitizedProjects,
      certifications: sanitizedCertifications,
      completionPercentage,
    });
    logger.info(`Created new Profile for user ${userId} (${completionPercentage}% completed)`);
  }

  // Update User reference and onboarding status if requested
  const userUpdates = { profileId: profile._id };
  if (markOnboardingComplete && completionPercentage >= 20) {
    userUpdates.onboardingCompleted = true;
    logger.info(`Marked onboardingCompleted = true for user ${userId}`);
  }

  await User.findByIdAndUpdate(userId, userUpdates);

  return profile;
};

export default {
  getMyProfile,
  createOrUpdateProfile,
  calculateCompletionPercentage,
  parseFlexibleDate,
  sanitizeExperience,
  sanitizeEducation,
  sanitizeCertifications,
  sanitizeProjects,
  isValidObjectId,
};
