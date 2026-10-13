import { env } from '../config/env.js';
import { getDBStatus } from '../config/db.js';
import { sendSuccess } from '../utils/apiResponse.js';

/**
 * Controller to handle API health checks
 * GET /api/health
 */
export const checkHealth = (req, res) => {
  const healthData = {
    status: 'healthy',
    name: 'AI Job Application Agent API',
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    environment: env.NODE_ENV,
    services: {
      api: 'online',
      database: getDBStatus(),
    },
    version: '1.0.0',
  };

  return sendSuccess(res, healthData, 'API is operational');
};
