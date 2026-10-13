export const APP_CONFIG = {
  NAME: 'AI Job Application Agent',
  VERSION: '1.0.0',
  ENV: import.meta.env.MODE,
};

export const API_ENDPOINTS = {
  HEALTH: '/health',
  AUTH: {
    VERIFY: '/auth/verify',
  },
  JOBS: {
    LIST: '/jobs',
  },
};
