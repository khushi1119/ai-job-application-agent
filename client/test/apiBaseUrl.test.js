import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import axios from 'axios';
import { resolveApiBaseUrl } from '../src/utils/helpers.js';

describe('Frontend API Base URL Resolution & Endpoint Contract Tests', () => {
  describe('1. Production Render URL Normalization', () => {
    test('appends /api when production Render URL omits the /api path prefix', () => {
      const input = 'https://ai-job-application-agent.onrender.com';
      const expected = 'https://ai-job-application-agent.onrender.com/api';
      assert.equal(resolveApiBaseUrl(input), expected);
    });

    test('strips trailing slash and appends /api when URL ends with a slash', () => {
      const input = 'https://ai-job-application-agent.onrender.com/';
      const expected = 'https://ai-job-application-agent.onrender.com/api';
      assert.equal(resolveApiBaseUrl(input), expected);
    });

    test('preserves /api and avoids double prefix when URL already contains /api', () => {
      const input = 'https://ai-job-application-agent.onrender.com/api';
      const expected = 'https://ai-job-application-agent.onrender.com/api';
      assert.equal(resolveApiBaseUrl(input), expected);
    });

    test('strips trailing slash while preserving /api when URL ends with /api/', () => {
      const input = 'https://ai-job-application-agent.onrender.com/api/';
      const expected = 'https://ai-job-application-agent.onrender.com/api';
      assert.equal(resolveApiBaseUrl(input), expected);
    });

    test('handles environment values enclosed in quotes cleanly', () => {
      const doubleQuoted = '"https://ai-job-application-agent.onrender.com"';
      const singleQuoted = "'https://ai-job-application-agent.onrender.com'";
      assert.equal(
        resolveApiBaseUrl(doubleQuoted),
        'https://ai-job-application-agent.onrender.com/api'
      );
      assert.equal(
        resolveApiBaseUrl(singleQuoted),
        'https://ai-job-application-agent.onrender.com/api'
      );
    });
  });

  describe('2. Localhost & Relative Dev URL Handling', () => {
    test('normalizes localhost URL without /api', () => {
      assert.equal(resolveApiBaseUrl('http://localhost:5000'), 'http://localhost:5000/api');
      assert.equal(resolveApiBaseUrl('http://localhost:5000/'), 'http://localhost:5000/api');
    });

    test('preserves localhost URL with /api', () => {
      assert.equal(resolveApiBaseUrl('http://localhost:5000/api'), 'http://localhost:5000/api');
      assert.equal(resolveApiBaseUrl('http://localhost:5000/api/'), 'http://localhost:5000/api');
    });

    test('preserves relative /api path for dev proxy or same-domain deployment', () => {
      assert.equal(resolveApiBaseUrl('/api'), '/api');
      assert.equal(resolveApiBaseUrl('/api/'), '/api');
    });
  });

  describe('3. Fallback & Edge Case Resilience', () => {
    test('defaults to /api when raw value is empty, null, undefined, or whitespace', () => {
      assert.equal(resolveApiBaseUrl(''), '/api');
      assert.equal(resolveApiBaseUrl('   '), '/api');
      assert.equal(resolveApiBaseUrl(undefined), '/api');
      assert.equal(resolveApiBaseUrl(null), '/api');
      assert.equal(resolveApiBaseUrl(12345), '/api');
    });

    test('defaults to /api when raw value is just a slash', () => {
      assert.equal(resolveApiBaseUrl('/'), '/api');
      assert.equal(resolveApiBaseUrl('///'), '/api');
    });
  });

  describe('4. Axios URL Resolution Integration', () => {
    const endpoints = [
      { call: '/profile/me', expectedPath: '/api/profile/me' },
      { call: '/resumes/me', expectedPath: '/api/resumes/me' },
      { call: '/health', expectedPath: '/api/health' },
      { call: '/auth/me', expectedPath: '/api/auth/me' },
      { call: '/applications/stats', expectedPath: '/api/applications/stats' },
    ];

    test('resolves production base URL without /api to full backend endpoints matching server routes', () => {
      const normalizedBase = resolveApiBaseUrl('https://ai-job-agent.onrender.com');
      const testAxios = axios.create({ baseURL: normalizedBase });

      for (const { call, expectedPath } of endpoints) {
        const fullUrl = testAxios.getUri({ url: call });
        assert.equal(fullUrl, `https://ai-job-agent.onrender.com${expectedPath}`);
      }
    });

    test('resolves production base URL with existing /api to full backend endpoints without duplicate /api', () => {
      const normalizedBase = resolveApiBaseUrl('https://ai-job-agent.onrender.com/api');
      const testAxios = axios.create({ baseURL: normalizedBase });

      for (const { call, expectedPath } of endpoints) {
        const fullUrl = testAxios.getUri({ url: call });
        assert.equal(fullUrl, `https://ai-job-agent.onrender.com${expectedPath}`);
        assert.equal(fullUrl.includes('/api/api'), false, 'Must not duplicate /api prefix');
      }
    });

    test('resolves relative base URL (/api) for local Vite proxy correctly', () => {
      const normalizedBase = resolveApiBaseUrl(undefined);
      const testAxios = axios.create({ baseURL: normalizedBase });

      for (const { call, expectedPath } of endpoints) {
        const fullUrl = testAxios.getUri({ url: call });
        assert.equal(fullUrl, expectedPath);
      }
    });
  });
});
