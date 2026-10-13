import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import {
  escapeRegex,
  searchJobs,
  getJobById,
  MAX_PAGE_LIMIT,
  DEFAULT_PAGE_LIMIT,
} from '../src/services/jobService.js';
import { getJobs, getJob } from '../src/controllers/jobController.js';
import { requireAuth } from '../src/middleware/authMiddleware.js';
import Job from '../src/models/Job.js';

describe('Job Service & API Backend Tests', () => {
  const sampleJobs = [
    {
      _id: new mongoose.Types.ObjectId('507f1f77bcf86cd799439011'),
      title: 'Senior React Developer',
      company: 'TechCorp',
      location: 'Remote',
      description: 'Looking for a seasoned React / Node.js specialist.',
      requirements: ['React', 'TypeScript', 'Node.js'],
      salaryRange: { min: 140000, max: 180000, currency: 'USD' },
      sourceUrl: 'https://example.com/jobs/1',
      platform: 'linkedin',
      status: 'discovered',
      createdAt: new Date('2026-03-01'),
    },
    {
      _id: new mongoose.Types.ObjectId('507f1f77bcf86cd799439012'),
      title: 'Full Stack Engineer (Node.js & Python)',
      company: 'DataFlow Systems',
      location: 'San Francisco, CA',
      description: 'Build real-time event streaming architectures.',
      requirements: ['Python', 'Docker', 'AWS'],
      salaryRange: { min: 150000, max: 190000, currency: 'USD' },
      sourceUrl: 'https://example.com/jobs/2',
      platform: 'greenhouse',
      status: 'discovered',
      createdAt: new Date('2026-03-02'),
    },
    {
      _id: new mongoose.Types.ObjectId('507f1f77bcf86cd799439013'),
      title: 'Frontend Engineer',
      company: 'NextGen AI',
      location: 'New York, NY',
      description: 'Design intuitive interfaces with React & Tailwind CSS.',
      requirements: ['React', 'Tailwind', 'Next.js'],
      salaryRange: { min: 130000, max: 160000, currency: 'USD' },
      sourceUrl: 'https://example.com/jobs/3',
      platform: 'lever',
      status: 'discovered',
      createdAt: new Date('2026-03-03'),
    },
  ];

  // --- Helper regex tests ---
  describe('Regex Sanitization (escapeRegex)', () => {
    test('escapes special characters to prevent ReDoS / injection', () => {
      const malicious = 'c++ (senior|lead) [developer] {5} .*?$';
      const sanitized = escapeRegex(malicious);
      assert.equal(
        sanitized,
        'c\\+\\+ \\(senior\\|lead\\) \\[developer\\] \\{5\\} \\.\\*\\?\\$'
      );
      // Validates that constructing a RegExp from it does not fail
      assert.doesNotThrow(() => new RegExp(sanitized, 'i'));
    });

    test('handles non-string inputs safely', () => {
      assert.equal(escapeRegex(null), '');
      assert.equal(escapeRegex(undefined), '');
      assert.equal(escapeRegex(12345), '');
    });
  });

  // --- Service Tests ---
  describe('jobService.searchJobs & filtering', () => {
    test('Search by keyword (q) across title, company, description', async () => {
      let capturedQuery = null;
      const originalFind = Job.find;
      const originalCount = Job.countDocuments;

      Job.find = (q) => {
        capturedQuery = q;
        return {
          sort: () => ({
            skip: () => ({
              limit: () => ({
                lean: async () => [sampleJobs[0]],
              }),
            }),
          }),
        };
      };
      Job.countDocuments = async (q) => 1;

      try {
        const result = await searchJobs({ q: 'React' });
        assert.ok(capturedQuery.$or, 'Expected $or clause for keyword search');
        assert.equal(capturedQuery.$or.length, 3);
        assert.ok(capturedQuery.$or[0].title instanceof RegExp);
        assert.ok(capturedQuery.$or[1].company instanceof RegExp);
        assert.ok(capturedQuery.$or[2].description instanceof RegExp);
        assert.equal(result.jobs.length, 1);
        assert.equal(result.pagination.total, 1);
      } finally {
        Job.find = originalFind;
        Job.countDocuments = originalCount;
      }
    });

    test('Location and platform filtering', async () => {
      let capturedQuery = null;
      const originalFind = Job.find;
      const originalCount = Job.countDocuments;

      Job.find = (q) => {
        capturedQuery = q;
        return {
          sort: () => ({
            skip: () => ({
              limit: () => ({
                lean: async () => [sampleJobs[0]],
              }),
            }),
          }),
        };
      };
      Job.countDocuments = async () => 1;

      try {
        await searchJobs({ location: 'Remote', platform: 'LinkedIn' });
        assert.ok(capturedQuery.location instanceof RegExp);
        assert.equal(capturedQuery.platform, 'linkedin');
        assert.deepEqual(capturedQuery.isClosed, { $ne: true });
      } finally {
        Job.find = originalFind;
        Job.countDocuments = originalCount;
      }
    });

    test('excludes confirmed-closed jobs and preserves lastVerifiedAt in returned jobs', async () => {
      let capturedQuery = null;
      const originalFind = Job.find;
      const originalCount = Job.countDocuments;

      const verifiedDate = new Date('2026-10-13T00:00:00.000Z');
      const testJobWithVerification = {
        ...sampleJobs[0],
        lastVerifiedAt: verifiedDate,
        isClosed: false,
      };

      Job.find = (q) => {
        capturedQuery = q;
        return {
          sort: () => ({
            skip: () => ({
              limit: () => ({
                lean: async () => [testJobWithVerification],
              }),
            }),
          }),
        };
      };
      Job.countDocuments = async () => 1;

      try {
        const result = await searchJobs();
        assert.deepEqual(capturedQuery.isClosed, { $ne: true });
        assert.equal(result.jobs.length, 1);
        assert.equal(result.jobs[0].lastVerifiedAt, verifiedDate);
      } finally {
        Job.find = originalFind;
        Job.countDocuments = originalCount;
      }
    });

    test('Pagination and total count metadata with limit cap', async () => {
      let capturedSkip = 0;
      let capturedLimit = 0;
      const originalFind = Job.find;
      const originalCount = Job.countDocuments;

      Job.find = () => ({
        sort: () => ({
          skip: (s) => {
            capturedSkip = s;
            return {
              limit: (l) => {
                capturedLimit = l;
                return {
                  lean: async () => sampleJobs,
                };
              },
            };
          },
        }),
      });
      Job.countDocuments = async () => 45;

      try {
        // Request page 2 with limit 20
        const result = await searchJobs({ page: 2, limit: 20 });
        assert.equal(capturedSkip, 20); // (2 - 1) * 20
        assert.equal(capturedLimit, 20);
        assert.equal(result.pagination.page, 2);
        assert.equal(result.pagination.limit, 20);
        assert.equal(result.pagination.total, 45);
        assert.equal(result.pagination.totalPages, 3);
        assert.equal(result.pagination.hasMore, true);

        // Verify limit cap (max 50)
        await searchJobs({ page: 1, limit: 500 });
        assert.equal(capturedLimit, MAX_PAGE_LIMIT);
      } finally {
        Job.find = originalFind;
        Job.countDocuments = originalCount;
      }
    });

    test('Empty job results', async () => {
      const originalFind = Job.find;
      const originalCount = Job.countDocuments;

      Job.find = () => ({
        sort: () => ({
          skip: () => ({
            limit: () => ({
              lean: async () => [],
            }),
          }),
        }),
      });
      Job.countDocuments = async () => 0;

      try {
        const result = await searchJobs({ q: 'nonexistent role 12345' });
        assert.deepEqual(result.jobs, []);
        assert.equal(result.pagination.total, 0);
        assert.equal(result.pagination.totalPages, 0);
        assert.equal(result.pagination.hasMore, false);
      } finally {
        Job.find = originalFind;
        Job.countDocuments = originalCount;
      }
    });
  });

  describe('jobService.getJobById', () => {
    test('fetches single job by valid MongoDB ID', async () => {
      const originalFindById = Job.findById;
      const targetId = sampleJobs[0]._id.toString();

      Job.findById = (id) => ({
        lean: async () => (id === targetId ? sampleJobs[0] : null),
      });

      try {
        const result = await getJobById(targetId);
        assert.ok(result);
        assert.equal(result.title, 'Senior React Developer');
      } finally {
        Job.findById = originalFindById;
      }
    });

    test('returns null for missing job by ID', async () => {
      const originalFindById = Job.findById;
      const missingId = new mongoose.Types.ObjectId().toString();

      Job.findById = () => ({
        lean: async () => null,
      });

      try {
        const result = await getJobById(missingId);
        assert.equal(result, null);
      } finally {
        Job.findById = originalFindById;
      }
    });

    test('rejects invalid MongoDB ID format with ValidationError', async () => {
      await assert.rejects(
        async () => {
          await getJobById('invalid-mongo-id');
        },
        {
          name: 'ValidationError',
          message: 'Invalid job ID format',
          statusCode: 400,
        }
      );
    });
  });

  // --- Controller & Route Tests ---
  describe('jobController HTTP handling', () => {
    test('GET /api/jobs returns 200 with jobs and pagination metadata', async () => {
      const originalFind = Job.find;
      const originalCount = Job.countDocuments;

      Job.find = () => ({
        sort: () => ({
          skip: () => ({
            limit: () => ({
              lean: async () => sampleJobs,
            }),
          }),
        }),
      });
      Job.countDocuments = async () => sampleJobs.length;

      const req = {
        query: { q: 'engineer', location: 'Remote', page: '1', limit: '10' },
      };
      let responseStatusCode = null;
      let responsePayload = null;

      const res = {
        status: (code) => {
          responseStatusCode = code;
          return res;
        },
        json: (payload) => {
          responsePayload = payload;
          return res;
        },
      };

      try {
        await getJobs(req, res);
        assert.equal(responseStatusCode, 200);
        assert.equal(responsePayload.success, true);
        assert.equal(responsePayload.data.jobs.length, 3);
        assert.equal(responsePayload.data.pagination.total, 3);
      } finally {
        Job.find = originalFind;
        Job.countDocuments = originalCount;
      }
    });

    test('GET /api/jobs/:id returns 200 when job is found', async () => {
      const target = sampleJobs[0];
      const originalFindById = Job.findById;

      Job.findById = () => ({
        lean: async () => target,
      });

      const req = { params: { id: target._id.toString() } };
      let responseStatusCode = null;
      let responsePayload = null;

      const res = {
        status: (code) => {
          responseStatusCode = code;
          return res;
        },
        json: (payload) => {
          responsePayload = payload;
          return res;
        },
      };

      try {
        await getJob(req, res);
        assert.equal(responseStatusCode, 200);
        assert.equal(responsePayload.success, true);
        assert.equal(responsePayload.data.job.title, 'Senior React Developer');
      } finally {
        Job.findById = originalFindById;
      }
    });

    test('GET /api/jobs/:id returns 404 when job is missing', async () => {
      const originalFindById = Job.findById;
      Job.findById = () => ({
        lean: async () => null,
      });

      const req = { params: { id: new mongoose.Types.ObjectId().toString() } };
      let responseStatusCode = null;
      let responsePayload = null;

      const res = {
        status: (code) => {
          responseStatusCode = code;
          return res;
        },
        json: (payload) => {
          responsePayload = payload;
          return res;
        },
      };

      try {
        await getJob(req, res);
        assert.equal(responseStatusCode, 404);
        assert.equal(responsePayload.success, false);
        assert.equal(responsePayload.message, 'Job not found');
      } finally {
        Job.findById = originalFindById;
      }
    });

    test('GET /api/jobs/:id returns 400 when invalid MongoDB ID is provided', async () => {
      const req = { params: { id: 'not-an-object-id' } };
      let responseStatusCode = null;
      let responsePayload = null;

      const res = {
        status: (code) => {
          responseStatusCode = code;
          return res;
        },
        json: (payload) => {
          responsePayload = payload;
          return res;
        },
      };

      await getJob(req, res);
      assert.equal(responseStatusCode, 400);
      assert.equal(responsePayload.success, false);
      assert.equal(responsePayload.message, 'Invalid job ID format');
      assert.equal(responsePayload.error, 'INVALID_ID');
    });

    test('Unauthorized requests to protected job endpoints return 401', async () => {
      const req = {
        headers: {}, // Missing Authorization header
      };
      let responseStatusCode = null;
      let responsePayload = null;

      const res = {
        status: (code) => {
          responseStatusCode = code;
          return res;
        },
        json: (payload) => {
          responsePayload = payload;
          return res;
        },
      };

      let nextCalled = false;
      const next = () => {
        nextCalled = true;
      };

      await requireAuth(req, res, next);
      assert.equal(nextCalled, false);
      assert.equal(responseStatusCode, 401);
      assert.equal(responsePayload.success, false);
      assert.equal(responsePayload.error, 'TOKEN_MISSING');
    });
  });
});
