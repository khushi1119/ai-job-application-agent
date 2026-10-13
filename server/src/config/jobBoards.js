/**
 * Configuration for supported free public company job boards.
 *
 * Supported ATS platforms:
 * 1. 'greenhouse': Endpoint pattern https://boards-api.greenhouse.io/v1/boards/{token}/jobs?content=true
 * 2. 'lever': Endpoint pattern https://api.lever.co/v0/postings/{token}?mode=json
 * 3. 'ashby': Endpoint pattern https://api.ashbyhq.com/posting-api/job-board/{token}
 *
 * How to add a company board:
 * Simply add an object to the DEFAULT_JOB_BOARDS list:
 * {
 *   name: 'Company Display Name',
 *   platform: 'greenhouse' | 'lever' | 'ashby',
 *   token: 'company-board-token',
 *   enabled: true,
 * }
 */
export const DEFAULT_JOB_BOARDS = [
  // --- Existing Global Platforms ---
  {
    name: 'Cloudflare',
    platform: 'greenhouse',
    token: 'cloudflare',
    enabled: true,
  },
  {
    name: 'Figma',
    platform: 'greenhouse',
    token: 'figma',
    enabled: true,
  },
  {
    name: 'Discord',
    platform: 'greenhouse',
    token: 'discord',
    enabled: true,
  },
  {
    name: 'Kinsta',
    platform: 'lever',
    token: 'kinsta',
    enabled: true,
  },

  // --- Verified Indian Tech & Global Remote (Greenhouse) ---
  {
    name: 'HackerRank',
    platform: 'greenhouse',
    token: 'hackerrank',
    enabled: true,
  },
  {
    name: 'Groww',
    platform: 'greenhouse',
    token: 'groww',
    enabled: true,
  },
  {
    name: 'InMobi',
    platform: 'greenhouse',
    token: 'inmobi',
    enabled: true,
  },
  {
    name: 'Thoughtworks',
    platform: 'greenhouse',
    token: 'thoughtworks',
    enabled: true,
  },
  {
    name: 'Druva',
    platform: 'greenhouse',
    token: 'druva',
    enabled: true,
  },
  {
    name: 'Wikimedia Foundation',
    platform: 'greenhouse',
    token: 'wikimedia',
    enabled: true,
  },

  // --- Verified Indian Tech (Lever) ---
  {
    name: 'Meesho',
    platform: 'lever',
    token: 'meesho',
    enabled: true,
  },
  {
    name: 'Zeta',
    platform: 'lever',
    token: 'zeta',
    enabled: true,
  },
  {
    name: 'Paytm',
    platform: 'lever',
    token: 'paytm',
    enabled: true,
  },

  // --- Verified Tech (Ashby) ---
  {
    name: 'Atlan',
    platform: 'ashby',
    token: 'atlan',
    enabled: true,
  },
  {
    name: 'Sentry',
    platform: 'ashby',
    token: 'sentry',
    enabled: true,
  },
];

/**
 * Get active job boards.
 * Supports overriding or extending via optional JSON environment variable JOB_BOARDS_JSON.
 *
 * @returns {Array<Object>}
 */
export const getActiveJobBoards = () => {
  if (process.env.JOB_BOARDS_JSON) {
    try {
      const parsed = JSON.parse(process.env.JOB_BOARDS_JSON);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.filter((b) => b.enabled !== false);
      }
    } catch {
      // Fallback to defaults if malformed
    }
  }

  return DEFAULT_JOB_BOARDS.filter((b) => b.enabled !== false);
};

export default {
  DEFAULT_JOB_BOARDS,
  getActiveJobBoards,
};
