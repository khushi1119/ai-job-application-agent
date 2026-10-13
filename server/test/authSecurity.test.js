import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { requireAuth } from '../src/middleware/authMiddleware.js';
import { env, isDevAuthBypassAllowed } from '../src/config/env.js';
import { verifyProductionFirebaseConfig } from '../src/config/firebase.js';

describe('Authentication Security & Bypass Regression Tests', () => {
  let originalNodeEnv;
  let originalBypassFlag;
  let originalVercel;
  let originalRender;

  beforeEach(() => {
    originalNodeEnv = process.env.NODE_ENV;
    originalBypassFlag = process.env.ALLOW_DEV_AUTH_BYPASS;
    originalVercel = process.env.VERCEL;
    originalRender = process.env.RENDER;
  });

  afterEach(() => {
    if (originalNodeEnv !== undefined) {
      process.env.NODE_ENV = originalNodeEnv;
    } else {
      delete process.env.NODE_ENV;
    }

    if (originalBypassFlag !== undefined) {
      process.env.ALLOW_DEV_AUTH_BYPASS = originalBypassFlag;
    } else {
      delete process.env.ALLOW_DEV_AUTH_BYPASS;
    }

    if (originalVercel !== undefined) {
      process.env.VERCEL = originalVercel;
    } else {
      delete process.env.VERCEL;
    }

    if (originalRender !== undefined) {
      process.env.RENDER = originalRender;
    } else {
      delete process.env.RENDER;
    }
  });

  const createMockReqRes = (authHeader) => {
    const req = {
      headers: {
        authorization: authHeader,
      },
    };

    let statusCode = null;
    let jsonPayload = null;

    const res = {
      status(code) {
        statusCode = code;
        return this;
      },
      json(payload) {
        jsonPayload = payload;
        return this;
      },
    };

    let nextCalled = false;
    const next = () => {
      nextCalled = true;
    };

    return {
      req,
      res,
      next,
      getStatusCode: () => statusCode,
      getJsonPayload: () => jsonPayload,
      isNextCalled: () => nextCalled,
    };
  };

  describe('1. Forged and Unsigned Token Rejection', () => {
    test('never accepts a JWT merely by decoding its unverified payload', async () => {
      process.env.NODE_ENV = 'development';
      delete process.env.ALLOW_DEV_AUTH_BYPASS;

      // Construct an unsigned 3-part JWT mimicking a Firebase token
      const headerB64 = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64');
      const payloadB64 = Buffer.from(
        JSON.stringify({
          user_id: 'forged-attacker-uid-999',
          email: 'attacker@malicious.com',
          name: 'Forged User',
        })
      ).toString('base64');
      const fakeToken = `${headerB64}.${payloadB64}.fake_unverified_signature`;

      const { req, res, next, getStatusCode, getJsonPayload, isNextCalled } = createMockReqRes(
        `Bearer ${fakeToken}`
      );

      await requireAuth(req, res, next);

      assert.equal(isNextCalled(), false, 'Unsigned/forged JWT must never proceed to next()');
      assert.equal(req.user, undefined, 'req.user must not be set from unverified payload');
      assert.ok(
        getStatusCode() === 401 || getStatusCode() === 503,
        `Expected 401 or 503, got ${getStatusCode()}`
      );
      assert.equal(getJsonPayload().success, false);
    });

    test('rejects forged JWT even if ALLOW_DEV_AUTH_BYPASS=true is set', async () => {
      process.env.NODE_ENV = 'development';
      process.env.ALLOW_DEV_AUTH_BYPASS = 'true';

      const payloadB64 = Buffer.from(
        JSON.stringify({ user_id: 'admin-super-user', email: 'admin@company.com' })
      ).toString('base64');
      const fakeToken = `eyJhbGciOiJIUzI1NiJ9.${payloadB64}.forged_signature`;

      const { req, res, next, isNextCalled } = createMockReqRes(`Bearer ${fakeToken}`);

      await requireAuth(req, res, next);

      assert.equal(isNextCalled(), false, 'Bypass must strictly apply only to demo-token, not arbitrary JWTs');
      assert.equal(req.user, undefined);
    });
  });

  describe('2. Missing NODE_ENV Environment Safety', () => {
    test('disables dev bypass when NODE_ENV is unset/missing even if ALLOW_DEV_AUTH_BYPASS=true', async () => {
      delete process.env.NODE_ENV;
      process.env.ALLOW_DEV_AUTH_BYPASS = 'true';

      assert.equal(isDevAuthBypassAllowed(), false, 'Must not allow bypass when NODE_ENV is missing');
      assert.equal(env.allowDevAuthBypass, false);

      const { req, res, next, isNextCalled } = createMockReqRes('Bearer demo-token-user123');
      await requireAuth(req, res, next);

      assert.equal(isNextCalled(), false, 'Demo token must be rejected when NODE_ENV is missing');
      assert.equal(req.user, undefined);
    });
  });

  describe('3. Production Environment Lockdown', () => {
    test('never allows auth bypass in production even when ALLOW_DEV_AUTH_BYPASS=true', async () => {
      process.env.NODE_ENV = 'production';
      process.env.ALLOW_DEV_AUTH_BYPASS = 'true';

      assert.equal(isDevAuthBypassAllowed(), false);
      assert.equal(env.allowDevAuthBypass, false);
      assert.equal(env.isProduction, true);

      const { req, res, next, isNextCalled } = createMockReqRes('Bearer demo-token-attacker');
      await requireAuth(req, res, next);

      assert.equal(isNextCalled(), false, 'Production must never authenticate demo tokens');
      assert.equal(req.user, undefined);
    });

    test('detects production platform indicators and locks down bypass', async () => {
      process.env.NODE_ENV = 'development';
      process.env.ALLOW_DEV_AUTH_BYPASS = 'true';
      process.env.RENDER = 'true';

      assert.equal(env.isProduction, true);
      assert.equal(isDevAuthBypassAllowed(), false);
      assert.equal(env.allowDevAuthBypass, false);
    });
  });

  describe('4. Explicitly Enabled Local Demo Mode', () => {
    test('accepts demo-token when ALLOW_DEV_AUTH_BYPASS=true in explicit local development', async () => {
      process.env.NODE_ENV = 'development';
      process.env.ALLOW_DEV_AUTH_BYPASS = 'true';
      delete process.env.RENDER;
      delete process.env.VERCEL;

      assert.equal(env.allowDevAuthBypass, true);

      const { req, res, next, isNextCalled } = createMockReqRes('Bearer demo-token-alice');
      await requireAuth(req, res, next);

      assert.equal(isNextCalled(), true);
      assert.equal(req.user.uid, 'alice');
      assert.equal(req.user.email, 'alice@example.com');
      assert.equal(req.user.isDemo, true);
    });

    test('rejects demo-token when ALLOW_DEV_AUTH_BYPASS is not set or false', async () => {
      process.env.NODE_ENV = 'development';
      delete process.env.ALLOW_DEV_AUTH_BYPASS;

      assert.equal(env.allowDevAuthBypass, false);

      const { req, res, next, isNextCalled } = createMockReqRes('Bearer demo-token-alice');
      await requireAuth(req, res, next);

      assert.equal(isNextCalled(), false, 'Demo token must be rejected when bypass flag is absent');
      assert.equal(req.user, undefined);
    });
  });

  describe('5. Production Startup Verification', () => {
    test('verifyProductionFirebaseConfig fails closed in production when credentials are unconfigured', () => {
      process.env.NODE_ENV = 'production';

      assert.throws(
        () => {
          verifyProductionFirebaseConfig(null);
        },
        /Firebase Admin authentication failed to initialize in production environment/
      );
    });

    test('verifyProductionFirebaseConfig does not throw when not in production', () => {
      process.env.NODE_ENV = 'development';

      // In development, does not abort server startup
      assert.doesNotThrow(() => {
        verifyProductionFirebaseConfig(null);
      });
    });
  });

  describe('6. Authorization Header Structure Validation', () => {
    test('rejects request with missing authorization header', async () => {
      const { req, res, next, getStatusCode, getJsonPayload, isNextCalled } = createMockReqRes(undefined);
      await requireAuth(req, res, next);

      assert.equal(isNextCalled(), false);
      assert.equal(getStatusCode(), 401);
      assert.equal(getJsonPayload().error, 'TOKEN_MISSING');
    });

    test('rejects request with non-Bearer authorization scheme', async () => {
      const { req, res, next, getStatusCode, getJsonPayload, isNextCalled } = createMockReqRes('Basic dXNlcjpwYXNz');
      await requireAuth(req, res, next);

      assert.equal(isNextCalled(), false);
      assert.equal(getStatusCode(), 401);
      assert.equal(getJsonPayload().error, 'TOKEN_MISSING');
    });

    test('rejects request with empty Bearer token', async () => {
      const { req, res, next, getStatusCode, getJsonPayload, isNextCalled } = createMockReqRes('Bearer    ');
      await requireAuth(req, res, next);

      assert.equal(isNextCalled(), false);
      assert.equal(getStatusCode(), 401);
      assert.equal(getJsonPayload().error, 'TOKEN_EMPTY');
    });
  });
});
