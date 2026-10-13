import app from './app.js';
import { env } from './config/env.js';
import { connectDB } from './config/db.js';
import { initFirebaseAdmin, verifyProductionFirebaseConfig } from './config/firebase.js';
import { logger } from './utils/logger.js';
import { prewarmPythonRecommender, prewarmActiveJobsCatalog } from './services/recommendationService.js';
import { startJobSyncSchedule, stopJobSyncSchedule } from './services/jobIntegrationService.js';

const startServer = async () => {
  // Connect to database
  await connectDB();

  // Initialize Firebase Admin SDK and fail closed in production if unconfigured
  verifyProductionFirebaseConfig();

  // Start HTTP server
  const server = app.listen(env.PORT, () => {
    logger.info(`Server running in ${env.NODE_ENV} mode on port ${env.PORT}`);
    logger.info(`Health check available at http://localhost:${env.PORT}/api/health`);
    // Pre-warm Python recommender in background without blocking server startup
    prewarmPythonRecommender().catch((err) => {
      logger.debug('ML recommender pre-warm notice:', err.message);
    });
    // Pre-warm active jobs catalog in background without blocking server startup
    prewarmActiveJobsCatalog().catch((err) => {
      logger.debug('Active jobs catalog pre-warm notice:', err.message);
    });
    // Start periodic background job sync scheduler
    startJobSyncSchedule();
  });

  // Handle process shutdown gracefully
  const shutdown = (signal) => {
    logger.info(`Received ${signal}. Shutting down gracefully...`);
    stopJobSyncSchedule();
    server.close(() => {
      logger.info('HTTP server closed.');
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
};

startServer().catch((error) => {
  logger.error('Failed to start server:', error);
  process.exit(1);
});
