import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { sendError } from '../utils/apiResponse.js';

/**
 * Global error handling middleware
 */
export const errorHandler = (err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';

  logger.error(`[${req.method}] ${req.originalUrl} - ${message}`, err.stack);

  return sendError(
    res,
    message,
    statusCode,
    env.isDevelopment ? { stack: err.stack, details: err.details } : null
  );
};
