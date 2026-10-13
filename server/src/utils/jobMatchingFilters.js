/**
 * jobMatchingFilters.js
 * Location eligibility (India & eligible remote) and student-appropriate seniority ranking utilities.
 */

// Explicit cities and regions in India
const INDIA_LOCATION_KEYWORDS = [
  'india',
  'bengaluru',
  'bangalore',
  'hyderabad',
  'mumbai',
  'pune',
  'delhi',
  'noida',
  'gurugram',
  'gurgaon',
  'chennai',
  'kolkata',
  'ahmedabad',
];

// Foreign countries, states, and major cities that denote non-India on-site/hybrid or foreign-restricted roles
const FOREIGN_LOCATION_EXCLUSIONS = [
  // United States & regions
  'united states',
  'u.s.',
  'usa',
  'us only',
  'california',
  'san francisco',
  'new york',
  'austin',
  'seattle',
  'los angeles',
  'boston',
  'chicago',
  'texas',
  'florida',
  'atlanta',
  'denver',
  'washington',
  'west coast',
  'east coast',
  'north america',
  // United Kingdom
  'united kingdom',
  'england',
  'scotland',
  'wales',
  'london',
  'manchester',
  'edinburgh',
  'uk',
  // Europe & individual countries/cities
  'europe',
  'emea',
  'germany',
  'berlin',
  'munich',
  'frankfurt',
  'hamburg',
  'austria',
  'vienna',
  'france',
  'paris',
  'portugal',
  'lisbon',
  'porto',
  'spain',
  'madrid',
  'barcelona',
  'netherlands',
  'amsterdam',
  'rotterdam',
  'ireland',
  'dublin',
  'hungary',
  'budapest',
  'poland',
  'warsaw',
  'krakow',
  'wroclaw',
  'switzerland',
  'zurich',
  'geneva',
  'sweden',
  'stockholm',
  'norway',
  'oslo',
  'denmark',
  'copenhagen',
  'finland',
  'helsinki',
  'belgium',
  'brussels',
  'italy',
  'rome',
  'milan',
  'czech republic',
  'czechia',
  'prague',
  'romania',
  'bucharest',
  'greece',
  'athens',
  // Americas
  'canada',
  'toronto',
  'vancouver',
  'montreal',
  'ottawa',
  'latam',
  'brazil',
  'são paulo',
  'sao paulo',
  'argentina',
  'buenos aires',
  'colombia',
  'bogota',
  'chile',
  'santiago',
  'mexico',
  // Asia-Pacific & Middle East
  'australia',
  'sydney',
  'melbourne',
  'brisbane',
  'new zealand',
  'auckland',
  'singapore',
  'japan',
  'tokyo',
  'philippines',
  'manila',
  'indonesia',
  'jakarta',
  'malaysia',
  'kuala lumpur',
  'thailand',
  'bangkok',
  'vietnam',
  'taiwan',
  'taipei',
  'south korea',
  'korea',
  'seoul',
  'hong kong',
  'china',
  'beijing',
  'shanghai',
  'israel',
  'tel aviv',
  'uae',
  'united arab emirates',
  'dubai',
  'south africa',
  'cape town',
];

// Standalone country/region abbreviations requiring word boundary check to avoid substring collision
const FOREIGN_LOCATION_REGEX = /\b(us|uk|eu|usa|u\.s\.|emea|latam)\b/i;

// Restrictions in description indicating non-India remote
const FOREIGN_RESTRICTION_PATTERNS = [
  /\bmust be located in (the )?(united states|us|uk|europe|eu|austria|germany|canada)\b/i,
  /\bmust reside in (the )?(us|united states|uk|europe|eu|austria|germany|canada)\b/i,
  /\bus work authorization required\b/i,
  /\bus citizenship required\b/i,
  /\bauthorized to work in the (us|united states) only\b/i,
  /\b(us|uk|europe|eu|canada|austria|germany) only\b/i,
  /\beligible to work in the (us|united states|uk|eu)\b/i,
];

/**
 * Checks whether a job listing is based in India or is an open worldwide remote role
 * accessible to candidates in India.
 *
 * @param {Object} job
 * @returns {boolean}
 */
export const isIndiaOrEligibleRemote = (job) => {
  if (!job) return false;

  const loc = (job.location || '').toLowerCase().trim();
  const title = (job.title || '').toLowerCase().trim();

  // 1. Explicit India indicators in location or title
  const hasIndiaKeyword = INDIA_LOCATION_KEYWORDS.some(
    (kw) => loc.includes(kw) || title.includes(kw)
  );
  if (hasIndiaKeyword) {
    return true;
  }

  // 2. Explicit foreign locations (including "Vienna, Austria (Remote)", "Remote (U.S.)", "Berlin, Germany", etc.)
  const hasForeignExclusion =
    FOREIGN_LOCATION_EXCLUSIONS.some((kw) => loc.includes(kw)) ||
    FOREIGN_LOCATION_REGEX.test(loc);
  if (hasForeignExclusion) {
    return false;
  }

  // 3. Ambiguous on-site or hybrid locations without country mention
  // Handled conservatively to avoid recommending local foreign on-site positions
  if (['in-office', 'hybrid', 'hybrid; in-office', 'on-site', 'onsite'].includes(loc)) {
    return false;
  }

  // 4. Remote / Distributed postings
  const isRemote =
    loc.includes('remote') ||
    loc.includes('distributed') ||
    loc.includes('anywhere') ||
    loc.includes('worldwide') ||
    loc.includes('global') ||
    loc.includes('work from home') ||
    loc.includes('wfh') ||
    job.isRemote === true;

  if (!isRemote) {
    return false;
  }

  // 5. Check description for foreign-only work authorization locks
  const desc = (job.description || '').slice(0, 1000);
  for (const pattern of FOREIGN_RESTRICTION_PATTERNS) {
    if (pattern.test(desc)) {
      return false;
    }
  }

  return true;
};

// Seniority Tier Constants
export const SENIORITY_TIERS = {
  TIER_1_STUDENT_ENTRY: 1, // Intern, Co-op, Trainee, Graduate, Fresher, Junior, Entry-Level
  TIER_2_MID_LEVEL_IC: 2,  // Standard Engineer, Developer, Analyst
  TIER_3_SENIOR_LEAD: 3,   // Senior, Lead, Staff, Principal, Architect
  TIER_4_LEADERSHIP: 4,    // Manager, Director, VP, Head, Executive
};

const STUDENT_ENTRY_TITLE_PATTERNS = [
  /\b(intern|internship|co-?op|trainee|apprentice)\b/i,
  /\b(fresher|graduate|new grad|campus)\b/i,
  /\b(entry-?level|junior|jr\.?)\b/i,
  /\b(associate engineer|associate developer|associate consultant|associate analyst)\b/i,
  /\b(level 1|l1|early career)\b/i,
];

const STUDENT_ENTRY_DESC_PATTERNS = [
  /\bno prior experience (required|needed)\b/i,
  /\bfreshers? (are )?welcome\b/i,
  /\b0-?1 years? (of )?experience\b/i,
  /\b0-?2 years? (of )?experience\b/i,
];

const LEADERSHIP_TITLE_PATTERNS = [
  /\b(manager|head of|director|vp|vice president|chief|partner|general manager)\b/i,
];

const SENIOR_LEAD_TITLE_PATTERNS = [
  /\b(senior|sr\.?|lead|staff|principal|distinguished|architect)\b/i,
];

/**
 * Categorizes a job into a seniority tier to support student-appropriate role prioritization.
 *
 * @param {Object} job
 * @returns {number} Seniority tier from 1 (Student/Junior) to 4 (Leadership)
 */
export const getSeniorityTier = (job) => {
  if (!job) return SENIORITY_TIERS.TIER_2_MID_LEVEL_IC;

  const title = (job.title || '').trim();
  const desc = (job.description || '').slice(0, 1000);

  // 1. Leadership / Executive check (highest override so "Director of Interns" is leadership)
  for (const pattern of LEADERSHIP_TITLE_PATTERNS) {
    if (pattern.test(title)) {
      return SENIORITY_TIERS.TIER_4_LEADERSHIP;
    }
  }

  // 2. Student / Entry / Junior check
  for (const pattern of STUDENT_ENTRY_TITLE_PATTERNS) {
    if (pattern.test(title)) {
      return SENIORITY_TIERS.TIER_1_STUDENT_ENTRY;
    }
  }

  for (const pattern of STUDENT_ENTRY_DESC_PATTERNS) {
    if (pattern.test(desc)) {
      return SENIORITY_TIERS.TIER_1_STUDENT_ENTRY;
    }
  }

  // 3. Senior / Staff / Principal check
  for (const pattern of SENIOR_LEAD_TITLE_PATTERNS) {
    if (pattern.test(title)) {
      return SENIORITY_TIERS.TIER_3_SENIOR_LEAD;
    }
  }

  // 4. Default: Mid-level individual contributor
  return SENIORITY_TIERS.TIER_2_MID_LEVEL_IC;
};

/**
 * Returns a human-friendly label for a seniority tier.
 *
 * @param {number} tier
 * @returns {string}
 */
export const getSeniorityLabel = (tier) => {
  switch (tier) {
    case SENIORITY_TIERS.TIER_1_STUDENT_ENTRY:
      return 'Intern / Entry-level';
    case SENIORITY_TIERS.TIER_2_MID_LEVEL_IC:
      return 'Mid-level';
    case SENIORITY_TIERS.TIER_3_SENIOR_LEAD:
      return 'Senior / Staff';
    case SENIORITY_TIERS.TIER_4_LEADERSHIP:
      return 'Lead / Manager';
    default:
      return 'Mid-level';
  }
};
