import { env } from '../config/env.js';
import { sendError } from '../utils/apiResponse.js';
import { logger } from '../utils/logger.js';

/**
 * Middleware that strictly authorizes administrative operations (e.g. POST /api/jobs/sync).
 *
 * Requirements:
 * 1. Requires valid authentication (req.user must be populated by requireAuth).
 * 2. Fail Closed: If no server-side administrator is configured in environment, denies all requests.
 * 3. Never trusts client-supplied admin flags (e.g. req.body.admin or req.headers['x-admin']).
 * 4. Authorizes verified server-side configured admin emails/UIDs, verified Firebase custom claims,
 *    or server-side configured ADMIN_SYNC_SECRET via x-admin-sync-secret header.
 */
export const requireAdmin = (req, res, next) => {
  // 1. Must be authenticated
  if (!req.user || (!req.user.uid && !req.user.email)) {
    return sendError(
      res,
      'Unauthorized: Authentication required for administrative operations.',
      401,
      'UNAUTHORIZED'
    );
  }

  const configuredEmails = env.ADMIN?.EMAILS || [];
  const configuredUids = env.ADMIN?.UIDS || [];
  const configuredSyncSecret = env.ADMIN?.SYNC_SECRET || '';

  const hasAnyAdminConfig =
    configuredEmails.length > 0 ||
    configuredUids.length > 0 ||
    Boolean(configuredSyncSecret);

  // 2. Fail Closed: Deny by default if server has no administrator configured
  if (!hasAnyAdminConfig) {
    logger.warn('Administrative action denied: No administrator configured on server.');
    return sendError(
      res,
      'Forbidden: Administrative operations are disabled because no administrator is configured on this server.',
      403,
      'ADMIN_NOT_CONFIGURED'
    );
  }

  const userEmail = (req.user.email || '').trim().toLowerCase();
  const userUid = (req.user.uid || '').trim();

  // 3. Check verified server-side configured admin list
  const isEmailAdmin = Boolean(userEmail && configuredEmails.includes(userEmail));
  const isUidAdmin = Boolean(userUid && configuredUids.includes(userUid));

  // 4. Check verified Firebase custom claim (set server-side via Firebase Admin SDK, never client)
  const isFirebaseCustomClaimAdmin = Boolean(
    req.user.admin === true || req.user.roles?.includes?.('admin')
  );

  // 5. Check optional automated sync secret header
  const syncSecretHeader = req.headers['x-admin-sync-secret'];
  const isSecretValid = Boolean(
    configuredSyncSecret &&
    syncSecretHeader &&
    syncSecretHeader === configuredSyncSecret
  );

  if (isEmailAdmin || isUidAdmin || isFirebaseCustomClaimAdmin || isSecretValid) {
    req.isAdmin = true;
    return next();
  }

  // Deny all non-admin users
  logger.warn(
    `Non-admin user denied administrative access: ${userEmail || userUid || 'unknown'}`
  );
  return sendError(
    res,
    'Forbidden: Administrative privileges required to perform this operation.',
    403,
    'ADMIN_FORBIDDEN'
  );
};

export default requireAdmin;
