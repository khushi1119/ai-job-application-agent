import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import { env } from './config/env.js';
import apiRouter from './routes/index.js';
import { errorHandler } from './middleware/errorHandler.js';
import { notFoundHandler } from './middleware/notFoundHandler.js';

import helmet from 'helmet';
import { globalApiLimiter } from './middleware/rateLimitMiddleware.js';

const app = express();

// Disable x-powered-by header
app.disable('x-powered-by');

// Security HTTP headers via Helmet with safe API defaults
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' }, // Allows cross-origin client to fetch API responses / documents
  })
);

// Reverse-proxy / IP handling configuration
if (env.isProduction || process.env.TRUST_PROXY) {
  const trustProxySetting = process.env.TRUST_PROXY
    ? (!isNaN(process.env.TRUST_PROXY) ? parseInt(process.env.TRUST_PROXY, 10) : process.env.TRUST_PROXY)
    : 1;
  app.set('trust proxy', trustProxySetting);
} else {
  app.set('trust proxy', false);
}

/**
 * Checks whether a given origin is in the allowed origins list.
 */
export const isOriginAllowed = (origin, allowedOrigins = env.ALLOWED_ORIGINS) => {
  if (!origin) return true;
  const normalized = origin.trim().replace(/\/$/, '').toLowerCase();
  return allowedOrigins.some((allowed) => allowed.toLowerCase() === normalized);
};

// CORS configuration
export const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps, curl, or server-to-server)
    if (!origin) return callback(null, true);

    if (isOriginAllowed(origin)) {
      return callback(null, true);
    }

    const error = new Error(`Origin ${origin} not allowed by CORS`);
    error.statusCode = 403;
    return callback(error);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['RateLimit-Limit', 'RateLimit-Remaining', 'RateLimit-Reset'],
  maxAge: 86400,
};

app.use(cors(corsOptions));

// HTTP Request logging
if (env.isDevelopment) {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

// Request parsers
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Root welcome message
app.get('/', (req, res) => {
  res.json({
    name: 'AI Job Application Agent API',
    status: 'online',
    version: '1.0.0',
    documentation: '/api/health',
  });
});

// Primary API Router with global rate limiter
app.use('/api', globalApiLimiter, apiRouter);

// 404 handler
app.use(notFoundHandler);

// Global Error Handler
app.use(errorHandler);

export default app;
