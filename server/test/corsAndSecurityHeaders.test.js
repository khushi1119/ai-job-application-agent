import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { env } from '../src/config/env.js';
import app, { isOriginAllowed, corsOptions } from '../src/app.js';

describe('CORS & Security Headers Hardening Tests', () => {
  let origNodeEnv;
  let origClientUrl;
  let origAllowedOrigins;
  let origAllowProdLocalhost;

  beforeEach(() => {
    origNodeEnv = process.env.NODE_ENV;
    origClientUrl = process.env.CLIENT_URL;
    origAllowedOrigins = process.env.ALLOWED_ORIGINS;
    origAllowProdLocalhost = process.env.ALLOW_PRODUCTION_LOCALHOST;
  });

  afterEach(() => {
    if (origNodeEnv !== undefined) process.env.NODE_ENV = origNodeEnv;
    else delete process.env.NODE_ENV;

    if (origClientUrl !== undefined) process.env.CLIENT_URL = origClientUrl;
    else delete process.env.CLIENT_URL;

    if (origAllowedOrigins !== undefined) process.env.ALLOWED_ORIGINS = origAllowedOrigins;
    else delete process.env.ALLOWED_ORIGINS;

    if (origAllowProdLocalhost !== undefined) process.env.ALLOW_PRODUCTION_LOCALHOST = origAllowProdLocalhost;
    else delete process.env.ALLOW_PRODUCTION_LOCALHOST;
  });

  describe('1. Security Headers & Disabled X-Powered-By', () => {
    test('X-Powered-By is disabled on Express app', () => {
      assert.equal(app.get('x-powered-by'), false, 'x-powered-by must be disabled');
    });

    test('HTTP response includes Helmet security headers and excludes X-Powered-By', async () => {
      let server;
      try {
        server = app.listen(0);
        const port = server.address().port;
        const res = await fetch(`http://127.0.0.1:${port}/`);

        assert.equal(res.status, 200);
        // Header assertions
        assert.equal(res.headers.get('x-powered-by'), null, 'Must NOT contain x-powered-by header');
        assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
        assert.equal(res.headers.get('x-frame-options'), 'SAMEORIGIN');
        assert.equal(res.headers.get('cross-origin-resource-policy'), 'cross-origin');
        assert.ok(res.headers.get('referrer-policy'), 'Must include Referrer-Policy header');
      } finally {
        if (server) server.close();
      }
    });
  });

  describe('2. Production CORS Origin Restrictions', () => {
    test('production allows only explicitly configured CLIENT_URL and ALLOWED_ORIGINS', () => {
      process.env.NODE_ENV = 'production';
      process.env.CLIENT_URL = 'https://ai-job-agent.production.app';
      process.env.ALLOWED_ORIGINS = 'https://admin.production.app, https://mobile.production.app';
      delete process.env.ALLOW_PRODUCTION_LOCALHOST;

      const origins = env.ALLOWED_ORIGINS;
      assert.ok(origins.includes('https://ai-job-agent.production.app'));
      assert.ok(origins.includes('https://admin.production.app'));
      assert.ok(origins.includes('https://mobile.production.app'));

      assert.equal(isOriginAllowed('https://ai-job-agent.production.app'), true);
      assert.equal(isOriginAllowed('https://admin.production.app'), true);
      assert.equal(isOriginAllowed('https://mobile.production.app'), true);
    });

    test('production strictly rejects localhost origins by default', () => {
      process.env.NODE_ENV = 'production';
      process.env.CLIENT_URL = 'https://ai-job-agent.production.app';
      delete process.env.ALLOW_PRODUCTION_LOCALHOST;

      assert.equal(isOriginAllowed('http://localhost:5173'), false, 'Must reject localhost:5173 in prod');
      assert.equal(isOriginAllowed('http://127.0.0.1:5173'), false, 'Must reject 127.0.0.1:5173 in prod');
      assert.equal(isOriginAllowed('http://localhost:3000'), false, 'Must reject localhost:3000 in prod');
    });

    test('production rejects unauthorized / malicious third-party origins', () => {
      process.env.NODE_ENV = 'production';
      process.env.CLIENT_URL = 'https://ai-job-agent.production.app';
      delete process.env.ALLOW_PRODUCTION_LOCALHOST;

      assert.equal(isOriginAllowed('https://malicious-attacker.xyz'), false);
      assert.equal(isOriginAllowed('https://evil.com'), false);
      assert.equal(isOriginAllowed('https://phishing-job-agent.com'), false);
    });

    test('production allows localhost ONLY when ALLOW_PRODUCTION_LOCALHOST=true is explicitly configured', () => {
      process.env.NODE_ENV = 'production';
      process.env.CLIENT_URL = 'https://ai-job-agent.production.app';
      process.env.ALLOW_PRODUCTION_LOCALHOST = 'true';

      assert.equal(isOriginAllowed('http://localhost:5173'), true);
      assert.equal(isOriginAllowed('http://127.0.0.1:5173'), true);
      assert.equal(isOriginAllowed('https://evil.com'), false);
    });
  });

  describe('3. Development CORS Behavior', () => {
    test('development allows local development Vite/React origins by default', () => {
      process.env.NODE_ENV = 'development';
      delete process.env.ALLOW_PRODUCTION_LOCALHOST;

      assert.equal(isOriginAllowed('http://localhost:5173'), true);
      assert.equal(isOriginAllowed('http://127.0.0.1:5173'), true);
      assert.equal(isOriginAllowed('http://localhost:3000'), true);
    });

    test('development rejects unauthorized external web origins', () => {
      process.env.NODE_ENV = 'development';

      assert.equal(isOriginAllowed('https://malicious-website.com'), false);
      assert.equal(isOriginAllowed('https://attacker.org'), false);
    });

    test('allows requests with no origin (e.g. mobile apps, curl, server-to-server)', () => {
      assert.equal(isOriginAllowed(undefined), true);
      assert.equal(isOriginAllowed(null), true);
      assert.equal(isOriginAllowed(''), true);
    });
  });

  describe('4. CORS Middleware Credentials & Wildcard Safety', () => {
    test('corsOptions preserves credentials: true and never sets wildcard origin', () => {
      assert.equal(corsOptions.credentials, true, 'Must preserve credentials: true for authenticated sessions');
      assert.equal(typeof corsOptions.origin, 'function', 'Origin must be a validation function, not a wildcard string');
    });

    test('corsOptions origin callback succeeds for allowed origin and errors for disallowed origin', () => {
      process.env.NODE_ENV = 'development';

      // Allowed origin
      corsOptions.origin('http://localhost:5173', (err, allow) => {
        assert.equal(err, null);
        assert.equal(allow, true);
      });

      // Disallowed origin returns 403 error
      corsOptions.origin('https://evil.com', (err, allow) => {
        assert.ok(err instanceof Error);
        assert.equal(err.statusCode, 403);
        assert.match(err.message, /not allowed by CORS/);
      });

      // No origin (curl/mobile/health) succeeds
      corsOptions.origin(null, (err, allow) => {
        assert.equal(err, null);
        assert.equal(allow, true);
      });
    });

    test('preflight OPTIONS request succeeds with exact origin and credentials header', async () => {
      process.env.NODE_ENV = 'development';
      let server;
      try {
        server = app.listen(0);
        const port = server.address().port;

        // Preflight OPTIONS request with valid dev origin
        const res = await fetch(`http://127.0.0.1:${port}/api/health`, {
          method: 'OPTIONS',
          headers: {
            Origin: 'http://localhost:5173',
            'Access-Control-Request-Method': 'GET',
          },
        });

        assert.equal(res.headers.get('access-control-allow-origin'), 'http://localhost:5173');
        assert.equal(res.headers.get('access-control-allow-credentials'), 'true');
        assert.notEqual(res.headers.get('access-control-allow-origin'), '*', 'Must never return wildcard with credentials');
      } finally {
        if (server) server.close();
      }
    });

    test('preflight OPTIONS request for disallowed origin returns 403 error', async () => {
      process.env.NODE_ENV = 'development';
      let server;
      try {
        server = app.listen(0);
        const port = server.address().port;

        const res = await fetch(`http://127.0.0.1:${port}/api/health`, {
          method: 'OPTIONS',
          headers: {
            Origin: 'https://evil.com',
            'Access-Control-Request-Method': 'GET',
          },
        });

        assert.equal(res.status, 403);
        assert.equal(res.headers.get('access-control-allow-origin'), null);
      } finally {
        if (server) server.close();
      }
    });
  });
});
