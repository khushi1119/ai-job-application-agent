import { sendError } from '../utils/apiResponse.js';

/**
 * 404 handler for unknown routes
 */
export const notFoundHandler = (req, res, next) => {
  return sendError(res, `Route not found: ${req.method} ${req.originalUrl}`, 404);
};
