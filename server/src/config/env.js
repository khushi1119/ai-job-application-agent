import dotenv from 'dotenv';

dotenv.config();

/**
 * Checks whether development authentication bypass is strictly allowed.
 * Requires explicit ALLOW_DEV_AUTH_BYPASS=true and an explicit local development/test NODE_ENV.
 * Always returns false in production or when production indicators exist.
 */
export const isDevAuthBypassAllowed = () => {
  const rawNodeEnv = process.env.NODE_ENV;
  const isExplicitDevOrTest = rawNodeEnv === 'development' || rawNodeEnv === 'test';
  const hasProdMarker = Boolean(
    rawNodeEnv === 'production' ||
    process.env.ENVIRONMENT === 'production' ||
    process.env.VERCEL ||
    process.env.RENDER ||
    process.env.RAILWAY_ENVIRONMENT ||
    process.env.FLY_APP_NAME ||
    process.env.K_SERVICE ||
    process.env.AWS_EXECUTION_ENV
  );

  return Boolean(
    process.env.ALLOW_DEV_AUTH_BYPASS === 'true' &&
    isExplicitDevOrTest &&
    !hasProdMarker
  );
};

export const env = {
  get NODE_ENV() {
    return process.env.NODE_ENV || 'development';
  },
  PORT: parseInt(process.env.PORT || '5000', 10),
  get CLIENT_URL() {
    if (process.env.CLIENT_URL) return process.env.CLIENT_URL.trim();
    return this.isProduction ? '' : 'http://localhost:5173';
  },
  get ALLOWED_ORIGINS() {
    const list = [];
    if (process.env.ALLOWED_ORIGINS) {
      list.push(...process.env.ALLOWED_ORIGINS.split(',').map((o) => o.trim().replace(/\/$/, '')));
    }
    if (process.env.CLIENT_URL) {
      list.push(...process.env.CLIENT_URL.split(',').map((o) => o.trim().replace(/\/$/, '')));
    }

    if (this.isProduction) {
      // In production, localhost is disallowed unless explicitly configured
      if (process.env.ALLOW_PRODUCTION_LOCALHOST === 'true') {
        list.push('http://localhost:5173', 'http://127.0.0.1:5173');
      }
    } else {
      // In development and test, allow standard local dev ports by default
      list.push(
        'http://localhost:5173',
        'http://127.0.0.1:5173',
        'http://localhost:3000',
        'http://127.0.0.1:3000'
      );
    }

    return Array.from(new Set(list.filter(Boolean)));
  },
  MONGODB_URI: process.env.MONGODB_URI || 'mongodb://localhost:27017/ai_job_application_agent',
  FIREBASE: {
    get PROJECT_ID() {
      return process.env.FIREBASE_PROJECT_ID || '';
    },
    get CLIENT_EMAIL() {
      return process.env.FIREBASE_CLIENT_EMAIL || '';
    },
    get PRIVATE_KEY() {
      return process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n') || '';
    },
  },
  CLOUDINARY: {
    CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME?.trim() || '',
    API_KEY: process.env.CLOUDINARY_API_KEY?.trim() || '',
    API_SECRET: process.env.CLOUDINARY_API_SECRET?.trim() || '',
  },
  GEMINI: {
    API_KEY: process.env.GEMINI_API_KEY?.trim() || '',
    MODEL: process.env.GEMINI_MODEL?.trim() || 'gemini-3.5-flash',
  },
  JOB_SYNC: {
    INTERVAL_HOURS: parseInt(process.env.JOB_SYNC_INTERVAL_HOURS || '24', 10),
    ON_STARTUP: process.env.JOB_SYNC_ON_STARTUP === 'true',
  },
  ADMIN: {
    get EMAILS() {
      return (process.env.ADMIN_EMAILS || '')
        .split(',')
        .map((e) => e.trim().toLowerCase())
        .filter(Boolean);
    },
    get UIDS() {
      return (process.env.ADMIN_UIDS || '')
        .split(',')
        .map((u) => u.trim())
        .filter(Boolean);
    },
    get SYNC_SECRET() {
      return process.env.ADMIN_SYNC_SECRET?.trim() || '';
    },
  },
  get TRUST_PROXY() {
    return process.env.TRUST_PROXY || '';
  },
  get isDevelopment() {
    return process.env.NODE_ENV === 'development' && !this.isProduction;
  },
  get isTest() {
    return process.env.NODE_ENV === 'test';
  },
  get isProduction() {
    const raw = process.env.NODE_ENV;
    return Boolean(
      raw === 'production' ||
      process.env.ENVIRONMENT === 'production' ||
      process.env.VERCEL ||
      process.env.RENDER ||
      process.env.RAILWAY_ENVIRONMENT ||
      process.env.FLY_APP_NAME ||
      process.env.K_SERVICE ||
      process.env.AWS_EXECUTION_ENV
    );
  },
  get allowDevAuthBypass() {
    return isDevAuthBypassAllowed();
  },
};
