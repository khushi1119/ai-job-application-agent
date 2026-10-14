import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import axios from 'axios';
import { resolveApiBaseUrl, PRODUCTION_RENDER_API_URL } from '../src/utils/helpers.js';

describe('Frontend API Base URL Resolution & Endpoint Contract Tests', () => {
  describe('1. Production Render URL Normalization', () => {
    test('appends /api when production Render URL omits the /api path prefix', () => {
      const input = 'https://ai-job-application-agent-y2tj.onrender.com';
      const expected = 'https://ai-job-application-agent-y2tj.onrender.com/api';
      assert.equal(resolveApiBaseUrl(input), expected);
    });

    test('strips trailing slash and appends /api when URL ends with a slash', () => {
      const input = 'https://ai-job-application-agent-y2tj.onrender.com/';
      const expected = 'https://ai-job-application-agent-y2tj.onrender.com/api';
      assert.equal(resolveApiBaseUrl(input), expected);
    });

    test('preserves /api and avoids double prefix when URL already contains /api', () => {
      const input = 'https://ai-job-application-agent-y2tj.onrender.com/api';
      const expected = 'https://ai-job-application-agent-y2tj.onrender.com/api';
      assert.equal(resolveApiBaseUrl(input), expected);
    });

    test('strips trailing slash while preserving /api when URL ends with /api/', () => {
      const input = 'https://ai-job-application-agent-y2tj.onrender.com/api/';
      const expected = 'https://ai-job-application-agent-y2tj.onrender.com/api';
      assert.equal(resolveApiBaseUrl(input), expected);
    });

    test('handles environment values enclosed in quotes cleanly', () => {
      const doubleQuoted = '"https://ai-job-application-agent-y2tj.onrender.com"';
      const singleQuoted = "'https://ai-job-application-agent-y2tj.onrender.com'";
      assert.equal(resolveApiBaseUrl(doubleQuoted), 'https://ai-job-application-agent-y2tj.onrender.com/api');
      assert.equal(resolveApiBaseUrl(singleQuoted), 'https://ai-job-application-agent-y2tj.onrender.com/api');
    });
  });

  describe('2. Protection Against Vercel Frontend Origin', () => {
    test('rejects Vercel preview domain without /api and routes to Render backend', () => {
      const input = 'https://ai-job-application-agent-5ztlb05xo.vercel.app';
      assert.equal(resolveApiBaseUrl(input), PRODUCTION_RENDER_API_URL);
    });

    test('rejects Vercel preview domain with /api and routes to Render backend', () => {
      const input = 'https://ai-job-application-agent-5ztlb05xo.vercel.app/api';
      assert.equal(resolveApiBaseUrl(input), PRODUCTION_RENDER_API_URL);
    });

    test('rejects generic *.vercel.app domain and routes to Render backend', () => {
      const input = 'https://my-frontend.vercel.app';
      assert.equal(resolveApiBaseUrl(input), PRODUCTION_RENDER_API_URL);
    });

    test('in production, relative /api routes to Render backend, never Vercel origin', () => {
      assert.equal(
        resolveApiBaseUrl('/api', { isProduction: true }),
        PRODUCTION_RENDER_API_URL
      );
    });
  });

  describe('3. Localhost & Relative Dev URL Handling', () => {
    test('normalizes localhost URL without /api', () => {
      assert.equal(resolveApiBaseUrl('http://localhost:5000'), 'http://localhost:5000/api');
      assert.equal(resolveApiBaseUrl('http://localhost:5000/'), 'http://localhost:5000/api');
    });

    test('preserves localhost URL with /api', () => {
      assert.equal(resolveApiBaseUrl('http://localhost:5000/api'), 'http://localhost:5000/api');
      assert.equal(resolveApiBaseUrl('http://localhost:5000/api/'), 'http://localhost:5000/api');
    });

    test('preserves relative /api path in development for Vite dev proxy', () => {
      assert.equal(resolveApiBaseUrl('/api', { isProduction: false }), '/api');
      assert.equal(resolveApiBaseUrl(undefined, { isProduction: false }), '/api');
    });
  });

  describe('4. Fallback & Edge Case Resilience', () => {
    test('in production, defaults to Render backend URL when raw value is empty, null, undefined, or whitespace', () => {
      assert.equal(resolveApiBaseUrl('', { isProduction: true }), PRODUCTION_RENDER_API_URL);
      assert.equal(resolveApiBaseUrl('   ', { isProduction: true }), PRODUCTION_RENDER_API_URL);
      assert.equal(resolveApiBaseUrl(undefined, { isProduction: true }), PRODUCTION_RENDER_API_URL);
      assert.equal(resolveApiBaseUrl(null, { isProduction: true }), PRODUCTION_RENDER_API_URL);
      assert.equal(resolveApiBaseUrl(12345, { isProduction: true }), PRODUCTION_RENDER_API_URL);
    });

    test('in development, defaults to /api when raw value is empty, null, or undefined', () => {
      assert.equal(resolveApiBaseUrl('', { isProduction: false }), '/api');
      assert.equal(resolveApiBaseUrl(undefined, { isProduction: false }), '/api');
      assert.equal(resolveApiBaseUrl(null, { isProduction: false }), '/api');
    });
  });

  describe('5. Axios URL Resolution Integration', () => {
    const endpoints = [
      { call: '/profile/me', expectedPath: '/api/profile/me' },
      { call: '/resumes/me', expectedPath: '/api/resumes/me' },
      { call: '/health', expectedPath: '/api/health' },
      { call: '/auth/me', expectedPath: '/api/auth/me' },
      { call: '/applications/stats', expectedPath: '/api/applications/stats' },
      { call: '/jobs/recommended', expectedPath: '/api/jobs/recommended' },
      { call: '/jobs', expectedPath: '/api/jobs' },
      { call: '/saved-jobs', expectedPath: '/api/saved-jobs' },
    ];

    test('resolves production base URL to full Render endpoints matching server routes', () => {
      const normalizedBase = resolveApiBaseUrl('https://ai-job-application-agent-y2tj.onrender.com');
      const testAxios = axios.create({ baseURL: normalizedBase });

      for (const { call, expectedPath } of endpoints) {
        const fullUrl = testAxios.getUri({ url: call });
        assert.equal(fullUrl, `https://ai-job-application-agent-y2tj.onrender.com${expectedPath}`);
      }
    });

    test('when Vercel frontend URL is passed, Axios still targets Render backend', () => {
      const normalizedBase = resolveApiBaseUrl('https://ai-job-application-agent-5ztlb05xo.vercel.app');
      const testAxios = axios.create({ baseURL: normalizedBase });

      for (const { call, expectedPath } of endpoints) {
        const fullUrl = testAxios.getUri({ url: call });
        assert.equal(fullUrl, `https://ai-job-application-agent-y2tj.onrender.com${expectedPath}`);
        assert.ok(!fullUrl.includes('vercel.app'), 'Must never target Vercel frontend origin');
      }
    });

    test('when env var is omitted in production build, Axios still targets Render backend', () => {
      const normalizedBase = resolveApiBaseUrl(undefined, { isProduction: true });
      const testAxios = axios.create({ baseURL: normalizedBase });

      for (const { call, expectedPath } of endpoints) {
        const fullUrl = testAxios.getUri({ url: call });
        assert.equal(fullUrl, `https://ai-job-application-agent-y2tj.onrender.com${expectedPath}`);
      }
    });

    test('resolves relative base URL (/api) for local Vite proxy in dev mode', () => {
      const normalizedBase = resolveApiBaseUrl(undefined, { isProduction: false });
      const testAxios = axios.create({ baseURL: normalizedBase });

      for (const { call, expectedPath } of endpoints) {
        const fullUrl = testAxios.getUri({ url: call });
        assert.equal(fullUrl, expectedPath);
      }
    });
  });
});

