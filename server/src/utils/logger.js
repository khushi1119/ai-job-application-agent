import { env } from '../config/env.js';

const getTimestamp = () => new Date().toISOString();

export const logger = {
  info: (message, meta = '') => {
    console.log(`[${getTimestamp()}] [INFO] ${message}`, meta ? meta : '');
  },
  warn: (message, meta = '') => {
    console.warn(`[${getTimestamp()}] [WARN] ${message}`, meta ? meta : '');
  },
  error: (message, error = '') => {
    console.error(`[${getTimestamp()}] [ERROR] ${message}`, error ? error : '');
  },
  debug: (message, meta = '') => {
    if (env.isDevelopment) {
      console.debug(`[${getTimestamp()}] [DEBUG] ${message}`, meta ? meta : '');
    }
  },
};
