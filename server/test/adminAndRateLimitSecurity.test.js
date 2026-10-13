import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { requireAdmin } from '../src/middleware/adminMiddleware.js';
import {
  getClientIp,
  createLimiter,
  shouldSkipLimiter,
} from '../src/middleware/rateLimitMiddleware.js';
import { env } from '../src/config/env.js';

// Mock request / response helper
const createMockReqRes = (options = {}) => {
  let statusCode = 200;
  let jsonPayload = null;
  let headersSent = {};
  let nextCalled = false;

  const req = {
    user: options.user || null,
    headers: options.headers || {},
    body: options.body || {},
    ip: options.ip || '127.0.0.1',
    socket: { remoteAddress: options.remoteAddress || '127.0.0.1' },
    ...options.reqOverrides,
  };

  const res = {
    status(code) {
      statusCode = code;
      return this;
    },
    json(data) {
      jsonPayload = data;
      return this;
    },
    setHeader(name, value) {
      headersSent[name.toLowerCase()] = value;
      return this;
    },
    getHeader(name) {
      return headersSent[name.toLowerCase()];
    },
  };

  const next = () => {
    nextCalled = true;
  };

  return {
    req,
    res,
    next,
    getStatusCode: () => statusCode,
    getJsonPayload: () => jsonPayload,
    getHeaders: () => headersSent,
    isNextCalled: () => nextCalled,
  };
};

describe('Admin Authorization & Rate Limiting Security Tests', () => {
  describe('A. Job Sync Authorization (requireAdmin Middleware)', () => {
    let origAdminEmails;
    let origAdminUids;
    let origAdminSecret;

    beforeEach(() => {
      origAdminEmails = process.env.ADMIN_EMAILS;
      origAdminUids = process.env.ADMIN_UIDS;
      origAdminSecret = process.env.ADMIN_SYNC_SECRET;
      delete process.env.ADMIN_EMAILS;
      delete process.env.ADMIN_UIDS;
      delete process.env.ADMIN_SYNC_SECRET;
    });

    afterEach(() => {
      if (origAdminEmails !== undefined) process.env.ADMIN_EMAILS = origAdminEmails;
      else delete process.env.ADMIN_EMAILS;
      if (origAdminUids !== undefined) process.env.ADMIN_UIDS = origAdminUids;
      else delete process.env.ADMIN_UIDS;
      if (origAdminSecret !== undefined) process.env.ADMIN_SYNC_SECRET = origAdminSecret;
      else delete process.env.ADMIN_SYNC_SECRET;
    });

    test('rejects unauthenticated request with 401 UNAUTHORIZED', () => {
      const { req, res, next, getStatusCode, getJsonPayload, isNextCalled } = createMockReqRes({ user: null });
      requireAdmin(req, res, next);

      assert.equal(isNextCalled(), false);
      assert.equal(getStatusCode(), 401);
      assert.equal(getJsonPayload().error, 'UNAUTHORIZED');
    });

    test('fails closed: denies sync by default when admin configuration is missing on server', () => {
      // No ADMIN_EMAILS, ADMIN_UIDS, or ADMIN_SYNC_SECRET configured
      const { req, res, next, getStatusCode, getJsonPayload, isNextCalled } = createMockReqRes({
        user: { uid: 'regular-user-123', email: 'regular@example.com' },
      });
      requireAdmin(req, res, next);

      assert.equal(isNextCalled(), false);
      assert.equal(getStatusCode(), 403);
      assert.equal(getJsonPayload().error, 'ADMIN_NOT_CONFIGURED');
      assert.match(getJsonPayload().message, /no administrator is configured on this server/i);
    });

    test('denies non-admin authenticated users with 403 ADMIN_FORBIDDEN when admin is configured', () => {
      process.env.ADMIN_EMAILS = 'lead.admin@company.com';

      const { req, res, next, getStatusCode, getJsonPayload, isNextCalled } = createMockReqRes({
        user: { uid: 'regular-user-123', email: 'regular@example.com' },
      });
      requireAdmin(req, res, next);

      assert.equal(isNextCalled(), false);
      assert.equal(getStatusCode(), 403);
      assert.equal(getJsonPayload().error, 'ADMIN_FORBIDDEN');
    });

    test('never trusts client-supplied admin flags in body or headers', () => {
      process.env.ADMIN_EMAILS = 'lead.admin@company.com';

      // Attacker sends admin=true in body and x-admin header
      const { req, res, next, getStatusCode, getJsonPayload, isNextCalled } = createMockReqRes({
        user: { uid: 'attacker-123', email: 'attacker@example.com' },
        body: { admin: true, isAdmin: true, role: 'admin' },
        headers: { 'x-admin': 'true', 'x-role': 'admin' },
      });
      requireAdmin(req, res, next);

      assert.equal(isNextCalled(), false, 'Must not trust client admin flags');
      assert.equal(getStatusCode(), 403);
      assert.equal(getJsonPayload().error, 'ADMIN_FORBIDDEN');
    });

    test('authorizes user matching server-configured ADMIN_EMAILS (case-insensitive)', () => {
      process.env.ADMIN_EMAILS = 'admin1@company.com, admin2@company.com';

      const { req, res, next, isNextCalled } = createMockReqRes({
        user: { uid: 'admin-123', email: 'Admin1@Company.com' },
      });
      requireAdmin(req, res, next);

      assert.equal(isNextCalled(), true);
      assert.equal(req.isAdmin, true);
    });

    test('authorizes user matching server-configured ADMIN_UIDS', () => {
      process.env.ADMIN_UIDS = 'super-admin-uid-999, other-admin-uid-888';

      const { req, res, next, isNextCalled } = createMockReqRes({
        user: { uid: 'super-admin-uid-999', email: 'any@example.com' },
      });
      requireAdmin(req, res, next);

      assert.equal(isNextCalled(), true);
      assert.equal(req.isAdmin, true);
    });

    test('authorizes user with verified Firebase custom claim when admin is configured', () => {
      process.env.ADMIN_EMAILS = 'lead@company.com';

      const { req, res, next, isNextCalled } = createMockReqRes({
        user: { uid: 'firebase-custom-admin', email: 'custom@company.com', admin: true },
      });
      requireAdmin(req, res, next);

      assert.equal(isNextCalled(), true);
      assert.equal(req.isAdmin, true);
    });

    test('authorizes automated sync matching configured ADMIN_SYNC_SECRET header', () => {
      process.env.ADMIN_SYNC_SECRET = 'super-secret-sync-key-123';

      const { req, res, next, isNextCalled } = createMockReqRes({
        user: { uid: 'service-account' },
        headers: { 'x-admin-sync-secret': 'super-secret-sync-key-123' },
      });
      requireAdmin(req, res, next);

      assert.equal(isNextCalled(), true);
      assert.equal(req.isAdmin, true);
    });

    test('rejects automated sync with incorrect ADMIN_SYNC_SECRET header', () => {
      process.env.ADMIN_SYNC_SECRET = 'super-secret-sync-key-123';

      const { req, res, next, getStatusCode, getJsonPayload, isNextCalled } = createMockReqRes({
        user: { uid: 'attacker-service' },
        headers: { 'x-admin-sync-secret': 'wrong-secret' },
      });
      requireAdmin(req, res, next);

      assert.equal(isNextCalled(), false);
      assert.equal(getStatusCode(), 403);
      assert.equal(getJsonPayload().error, 'ADMIN_FORBIDDEN');
    });
  });

  describe('B. Rate Limiting Enforcements & Proxy IP Safety', () => {
    test('getClientIp extracts client IP correctly', () => {
      assert.equal(getClientIp({ ip: '192.168.1.100' }), '192.168.1.100');
      assert.equal(getClientIp({ socket: { remoteAddress: '10.0.0.1' } }), '10.0.0.1');
      assert.equal(getClientIp({}), '127.0.0.1');
    });

    test('shouldSkipLimiter skips by default in test mode unless x-test-rate-limit is set', () => {
      const normalTestReq = { headers: {} };
      assert.equal(shouldSkipLimiter(normalTestReq), true, 'Should skip in general test suite');

      const rateLimitTestReq = { headers: { 'x-test-rate-limit': 'true' } };
      assert.equal(shouldSkipLimiter(rateLimitTestReq), false, 'Should not skip when x-test-rate-limit is true');
    });

    test('enforces rate limit: allows requests within limit and returns 429 when exceeded', async () => {
      const testLimiter = createLimiter({
        windowMs: 60 * 1000,
        max: 2, // Allow only 2 requests
        message: 'Rate limit exceeded for test.',
        errorCode: 'TEST_RATE_LIMIT_EXCEEDED',
        skip: () => false, // Do not skip in this unit test
      });

      // Request 1: should pass
      const req1 = createMockReqRes({ ip: '10.20.30.40' });
      await new Promise((resolve) => testLimiter(req1.req, req1.res, () => { req1.next(); resolve(); }));
      assert.equal(req1.isNextCalled(), true, 'Request 1 should pass');

      // Request 2: should pass
      const req2 = createMockReqRes({ ip: '10.20.30.40' });
      await new Promise((resolve) => testLimiter(req2.req, req2.res, () => { req2.next(); resolve(); }));
      assert.equal(req2.isNextCalled(), true, 'Request 2 should pass');

      // Request 3: should be BLOCKED with 429
      const req3 = createMockReqRes({ ip: '10.20.30.40' });
      await new Promise((resolve) => {
        testLimiter(req3.req, req3.res, () => {
          req3.next();
          resolve();
        });
        // In express-rate-limit, if blocked, next() is not called; the handler sends res.status(429).json()
        setTimeout(resolve, 50);
      });

      assert.equal(req3.isNextCalled(), false, 'Request 3 must be blocked');
      assert.equal(req3.getStatusCode(), 429, 'Must return HTTP 429');
      const payload = req3.getJsonPayload();
      assert.equal(payload.success, false);
      assert.equal(payload.error, 'TEST_RATE_LIMIT_EXCEEDED');
      assert.match(payload.message, /Rate limit exceeded for test/);
    });

    test('separate IPs do not share rate limit counters', async () => {
      const testLimiter = createLimiter({
        windowMs: 60 * 1000,
        max: 1,
        message: 'IP limit exceeded.',
        errorCode: 'IP_LIMIT_EXCEEDED',
        skip: () => false,
      });

      // User A from IP 1.1.1.1: succeeds
      const reqA1 = createMockReqRes({ ip: '1.1.1.1' });
      await new Promise((resolve) => testLimiter(reqA1.req, reqA1.res, () => { reqA1.next(); resolve(); }));
      assert.equal(reqA1.isNextCalled(), true);

      // User B from IP 2.2.2.2: succeeds (not blocked by User A's traffic)
      const reqB1 = createMockReqRes({ ip: '2.2.2.2' });
      await new Promise((resolve) => testLimiter(reqB1.req, reqB1.res, () => { reqB1.next(); resolve(); }));
      assert.equal(reqB1.isNextCalled(), true);

      // User A second request from IP 1.1.1.1: BLOCKED with 429
      const reqA2 = createMockReqRes({ ip: '1.1.1.1' });
      await new Promise((resolve) => {
        testLimiter(reqA2.req, reqA2.res, () => { reqA2.next(); resolve(); });
        setTimeout(resolve, 50);
      });
      assert.equal(reqA2.isNextCalled(), false);
      assert.equal(reqA2.getStatusCode(), 429);
    });
  });
});
