import { getFirebaseAuth } from '../config/firebase.js';
import { sendError } from '../utils/apiResponse.js';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

/**
 * Authentication middleware that verifies Firebase ID tokens.
 * Expected header: Authorization: Bearer <id_token>
 */
export const requireAuth = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return sendError(
      res,
      'Unauthorized: Missing or malformed authorization header',
      401,
      'TOKEN_MISSING'
    );
  }

  const token = authHeader.split('Bearer ')[1].trim();

  if (!token) {
    return sendError(
      res,
      'Unauthorized: Bearer token is empty',
      401,
      'TOKEN_EMPTY'
    );
  }

  // 1. Explicit Development Demo Bypass (Only when ALLOW_DEV_AUTH_BYPASS=true in local dev/test environment)
  if (env.allowDevAuthBypass && token.startsWith('demo-token-')) {
    const mockUid = token.replace('demo-token-', '').trim() || 'demo-user-123';
    req.user = {
      uid: mockUid,
      email: `${mockUid}@example.com`,
      name: 'Demo User',
      picture: '',
      isDemo: true,
    };
    return next();
  }

  const auth = getFirebaseAuth();

  // If Firebase Admin credentials are not configured in environment
  if (!auth) {
    return sendError(
      res,
      'Authentication service is unconfigured. Please configure Firebase Admin credentials in server/.env',
      503,
      'AUTH_UNCONFIGURED'
    );
  }

  try {
    const decodedToken = await auth.verifyIdToken(token);
    req.user = decodedToken;
    return next();
  } catch (error) {
    logger.warn(`Firebase token verification failed: ${error.code || error.message}`);

    if (error.code === 'auth/id-token-expired') {
      return sendError(
        res,
        'Unauthorized: Authentication token has expired',
        401,
        'TOKEN_EXPIRED'
      );
    }

    if (
      error.code === 'auth/argument-error' ||
      error.code === 'auth/invalid-id-token' ||
      error.code === 'auth/invalid-argument'
    ) {
      return sendError(
        res,
        'Unauthorized: Invalid authentication token format',
        401,
        'INVALID_TOKEN'
      );
    }

    if (error.code === 'auth/id-token-revoked') {
      return sendError(
        res,
        'Unauthorized: Authentication token has been revoked',
        401,
        'TOKEN_REVOKED'
      );
    }

    return sendError(
      res,
      'Unauthorized: Failed to authenticate token',
      401,
      error.message
    );
  }
};

export default requireAuth;
