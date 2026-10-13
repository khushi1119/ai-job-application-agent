import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  stripHtml,
  extractRequirementsFromText,
  normalizeGreenhouseJob,
  normalizeLeverJob,
  normalizeAshbyJob,
  fetchGreenhouseBoard,
  fetchLeverBoard,
  fetchAshbyBoard,
  persistNormalizedJobs,
  reconcileClosedJobsForBoard,
  syncSingleBoard,
  syncAllJobBoards,
  runScheduledSyncCycle,
  startJobSyncSchedule,
  stopJobSyncSchedule,
} from '../src/services/jobIntegrationService.js';
import { Job } from '../src/models/Job.js';

describe('Job Integration Service (Greenhouse & Lever ATS Boards)', () => {
  let originalFetch;

  beforeEach(() => {
    originalFetch = global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  // --- HTML sanitization & parsing ---
  describe('HTML sanitization and requirement extraction', () => {
    test('stripHtml decodes entities and strips HTML tags cleanly', () => {
      const html =
        '&lt;div&gt;&lt;h3&gt;About &amp; Us&lt;/h3&gt;&lt;p&gt;We&#39;re hiring!&lt;/p&gt;&lt;br/&gt;&lt;/div&gt;';
      const clean = stripHtml(html);
      assert.equal(clean, "About & Us\n\nWe're hiring!");
    });

    test('extractRequirementsFromText extracts bullet items accurately', () => {
      const content = `
        <h3>Qualifications</h3>
        • 3+ years experience with React and TypeScript
        • Proficiency in Node.js and Express
        - Solid understanding of distributed systems
        * Experience with Docker and cloud deployments
        Some non-bullet paragraph text
      `;
      const reqs = extractRequirementsFromText(content);
      assert.equal(reqs.length, 4);
      assert.equal(reqs[0], '3+ years experience with React and TypeScript');
      assert.equal(reqs[1], 'Proficiency in Node.js and Express');
      assert.equal(reqs[2], 'Solid understanding of distributed systems');
      assert.equal(reqs[3], 'Experience with Docker and cloud deployments');
    });
  });

  // --- Normalization tests ---
  describe('Data Normalization', () => {
    test('normalizeGreenhouseJob maps API fields accurately to Job schema', () => {
      const raw = {
        id: 9876543,
        title: 'Senior Infrastructure Engineer',
        location: { name: 'Remote, US' },
        absolute_url: 'https://boards.greenhouse.io/cloudflare/jobs/9876543',
        content: '&lt;p&gt;Join our cloud team.&lt;/p&gt;&lt;ul&gt;&lt;li&gt;• 5+ years Go or Rust experience&lt;/li&gt;&lt;/ul&gt;',
      };

      const normalized = normalizeGreenhouseJob(raw, 'Cloudflare');
      assert.ok(normalized);
      assert.equal(normalized.externalId, '9876543');
      assert.equal(normalized.title, 'Senior Infrastructure Engineer');
      assert.equal(normalized.company, 'Cloudflare');
      assert.equal(normalized.location, 'Remote, US');
      assert.equal(normalized.platform, 'greenhouse');
      assert.equal(normalized.sourceUrl, 'https://boards.greenhouse.io/cloudflare/jobs/9876543');
      assert.equal(normalized.status, 'discovered');
      assert.equal(normalized.requirements.length, 1);
      assert.equal(normalized.requirements[0], '5+ years Go or Rust experience');
    });

    test('normalizeGreenhouseJob safely rejects malformed or missing required fields', () => {
      assert.equal(normalizeGreenhouseJob(null), null);
      assert.equal(normalizeGreenhouseJob({ title: 'No ID or URL' }), null);
      assert.equal(normalizeGreenhouseJob({ id: 123 }), null);
    });

    test('normalizeLeverJob maps Lever posting accurately to Job schema', () => {
      const raw = {
        id: 'lever-posting-1234',
        text: 'Full Stack Engineer',
        categories: {
          location: 'San Francisco, CA',
          commitment: 'Full-time',
        },
        descriptionPlain: 'Build world-class web applications.',
        hostedUrl: 'https://jobs.lever.co/kinsta/lever-posting-1234',
        lists: [
          {
            text: 'Key Requirements',
            content: '• Strong proficiency with React\n• Node.js experience',
          },
        ],
      };

      const normalized = normalizeLeverJob(raw, 'Kinsta');
      assert.ok(normalized);
      assert.equal(normalized.externalId, 'lever-posting-1234');
      assert.equal(normalized.title, 'Full Stack Engineer');
      assert.equal(normalized.company, 'Kinsta');
      assert.equal(normalized.location, 'San Francisco, CA');
      assert.equal(normalized.platform, 'lever');
      assert.equal(normalized.sourceUrl, 'https://jobs.lever.co/kinsta/lever-posting-1234');
      assert.equal(normalized.status, 'discovered');
      assert.equal(normalized.requirements.length, 2);
    });

    test('normalizeLeverJob safely rejects malformed postings', () => {
      assert.equal(normalizeLeverJob(null), null);
      assert.equal(normalizeLeverJob({ text: 'Missing ID and URL' }), null);
    });

    test('normalizeAshbyJob maps Ashby API job object accurately to Job schema', () => {
      const raw = {
        id: 'ashby-uuid-999',
        title: 'Backend Engineer - Data Platform',
        location: 'Bengaluru, India',
        isRemote: true,
        jobUrl: 'https://jobs.ashbyhq.com/atlan/ashby-uuid-999',
        applyUrl: 'https://jobs.ashbyhq.com/atlan/ashby-uuid-999/application',
        descriptionPlain: 'Join Atlan to build modern data workspace infrastructure.',
        descriptionHtml: '<p>Join Atlan.</p><ul><li>• Experience with Python or Go</li><li>• Knowledge of distributed storage</li></ul>',
      };

      const normalized = normalizeAshbyJob(raw, 'Atlan');
      assert.ok(normalized);
      assert.equal(normalized.externalId, 'ashby-uuid-999');
      assert.equal(normalized.title, 'Backend Engineer - Data Platform');
      assert.equal(normalized.company, 'Atlan');
      assert.equal(normalized.location, 'Bengaluru, India (Remote)');
      assert.equal(normalized.platform, 'ashby');
      assert.equal(normalized.sourceUrl, 'https://jobs.ashbyhq.com/atlan/ashby-uuid-999');
      assert.equal(normalized.status, 'discovered');
      assert.equal(normalized.requirements.length, 2);
      assert.equal(normalized.requirements[0], 'Experience with Python or Go');
    });

    test('normalizeAshbyJob safely rejects malformed or incomplete postings', () => {
      assert.equal(normalizeAshbyJob(null), null);
      assert.equal(normalizeAshbyJob({ title: 'No ID or URL' }), null);
      assert.equal(normalizeAshbyJob({ id: '123', title: 'No URLs' }), null);
    });
  });

  // --- Fetching with Mocked HTTP Responses ---
  describe('Public ATS Board Fetching (Mocked HTTP)', () => {
    test('fetchGreenhouseBoard parses successful mock API response', async () => {
      global.fetch = async (url) => {
        assert.ok(url.includes('boards-api.greenhouse.io/v1/boards/figma/jobs'));
        return {
          ok: true,
          status: 200,
          json: async () => ({
            jobs: [
              {
                id: 101,
                title: 'Product Designer',
                location: { name: 'New York, NY' },
                absolute_url: 'https://boards.greenhouse.io/figma/jobs/101',
                content: '&lt;p&gt;Design user experiences.&lt;/p&gt;',
              },
              {
                id: 102,
                title: 'Software Engineer, Systems',
                location: { name: 'Remote' },
                absolute_url: 'https://boards.greenhouse.io/figma/jobs/102',
                content: '&lt;p&gt;Scale systems.&lt;/p&gt;',
              },
            ],
          }),
        };
      };

      const jobs = await fetchGreenhouseBoard('figma', 'Figma');
      assert.equal(jobs.length, 2);
      assert.equal(jobs[0].title, 'Product Designer');
      assert.equal(jobs[0].company, 'Figma');
      assert.equal(jobs[1].title, 'Software Engineer, Systems');
      assert.equal(jobs[1].platform, 'greenhouse');
    });

    test('fetchLeverBoard parses successful mock API response', async () => {
      global.fetch = async (url) => {
        assert.ok(url.includes('api.lever.co/v0/postings/kinsta'));
        return {
          ok: true,
          status: 200,
          json: async () => [
            {
              id: 'lev-1',
              text: 'Frontend Developer',
              categories: { location: 'Remote' },
              descriptionPlain: 'Work on frontend apps',
              hostedUrl: 'https://jobs.lever.co/kinsta/lev-1',
            },
          ],
        };
      };

      const jobs = await fetchLeverBoard('kinsta', 'Kinsta');
      assert.equal(jobs.length, 1);
      assert.equal(jobs[0].title, 'Frontend Developer');
      assert.equal(jobs[0].platform, 'lever');
    });

    test('fetchAshbyBoard parses successful mock API response', async () => {
      global.fetch = async (url) => {
        assert.ok(url.includes('api.ashbyhq.com/posting-api/job-board/atlan'));
        return {
          ok: true,
          status: 200,
          json: async () => ({
            jobs: [
              {
                id: 'ash-1',
                title: 'Data Platform Engineer',
                location: 'India',
                isRemote: true,
                jobUrl: 'https://jobs.ashbyhq.com/atlan/ash-1',
                descriptionPlain: 'Build scalable data pipelines',
              },
            ],
          }),
        };
      };

      const jobs = await fetchAshbyBoard('atlan', 'Atlan');
      assert.equal(jobs.length, 1);
      assert.equal(jobs[0].title, 'Data Platform Engineer');
      assert.equal(jobs[0].platform, 'ashby');
      assert.equal(jobs[0].location, 'India (Remote)');
    });

    test('fetchAshbyBoard handles 404 / unavailable board safely without throwing', async () => {
      global.fetch = async () => ({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      });

      const jobs = await fetchAshbyBoard('nonexistent-corp', 'Nonexistent');
      assert.deepEqual(jobs, []);
    });

    test('handles 404 / unavailable company board without throwing', async () => {
      global.fetch = async () => ({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      });

      const jobs = await fetchGreenhouseBoard('nonexistent-company-xyz', 'Nonexistent');
      assert.deepEqual(jobs, []);
    });

    test('handles 429 rate limit without crashing', async () => {
      global.fetch = async () => ({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
      });

      const jobs = await fetchLeverBoard('rate-limited-company', 'RateLimited');
      assert.deepEqual(jobs, []);
    });

    test('handles network exceptions / fetch rejections safely', async () => {
      global.fetch = async () => {
        throw new Error('Connection refused (ENOTFOUND)');
      };

      const jobs = await fetchGreenhouseBoard('network-fail', 'FailCorp');
      assert.deepEqual(jobs, []);
    });

    test('handles timeouts gracefully via AbortError', async () => {
      global.fetch = async () => {
        const error = new Error('The operation was aborted');
        error.name = 'AbortError';
        throw error;
      };

      const jobs = await fetchGreenhouseBoard('slow-board', 'SlowCorp', { timeoutMs: 10 });
      assert.deepEqual(jobs, []);
    });

    test('handles malformed JSON response safely', async () => {
      global.fetch = async () => ({
        ok: true,
        status: 200,
        json: async () => {
          throw new SyntaxError('Unexpected token < in JSON at position 0');
        },
      });

      const jobs = await fetchLeverBoard('bad-json', 'BadJsonCorp');
      assert.deepEqual(jobs, []);
    });
  });

  // --- Idempotent Persistence & Deduplication ---
  describe('Idempotent Persistence & Deduplication', () => {
    test('persistNormalizedJobs upserts jobs on (platform + externalId) preserving status', async () => {
      const persistedCalls = [];
      const originalFindOneAndUpdate = Job.findOneAndUpdate;

      Job.findOneAndUpdate = async (filter, updateDoc, options) => {
        persistedCalls.push({ filter, updateDoc, options });
        return { _id: 'fake-id', ...updateDoc.$set };
      };

      const mockJobs = [
        {
          externalId: 'ext-123',
          title: 'Software Engineer',
          company: 'Acme',
          location: 'Remote',
          description: 'Great role',
          requirements: ['Node.js'],
          sourceUrl: 'https://boards.greenhouse.io/acme/jobs/ext-123',
          platform: 'greenhouse',
          status: 'discovered',
        },
      ];

      try {
        const savedCount = await persistNormalizedJobs(mockJobs);
        assert.equal(savedCount, 1);
        assert.equal(persistedCalls.length, 1);

        const call = persistedCalls[0];
        // Validates stable deduplication filter
        assert.equal(call.filter.platform, 'greenhouse');
        assert.equal(call.filter.externalId, 'ext-123');
        // Validates that status is set ONLY on insert (preserves user state)
        assert.equal(call.updateDoc.$setOnInsert.status, 'discovered');
        assert.equal(call.updateDoc.$set.title, 'Software Engineer');
        assert.equal(call.options.upsert, true);
      } finally {
        Job.findOneAndUpdate = originalFindOneAndUpdate;
      }
    });
  });

  // --- Multi-Board Orchestration ---
  describe('Multi-Board Orchestration (syncAllJobBoards)', () => {
    test('syncAllJobBoards coordinates multiple boards and returns aggregate statistics', async () => {
      global.fetch = async (url) => {
        if (url.includes('cloudflare')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              jobs: [
                {
                  id: 1,
                  title: 'Cloud Engineer',
                  location: { name: 'Remote' },
                  absolute_url: 'https://boards.greenhouse.io/cloudflare/jobs/1',
                },
              ],
            }),
          };
        } else if (url.includes('failing-board')) {
          return {
            ok: false,
            status: 500,
            statusText: 'Internal Server Error',
          };
        }
        return {
          ok: false,
          status: 404,
        };
      };

      const customBoards = [
        { name: 'Cloudflare', platform: 'greenhouse', token: 'cloudflare', enabled: true },
        { name: 'Failing Board', platform: 'greenhouse', token: 'failing-board', enabled: true },
      ];

      const summary = await syncAllJobBoards(customBoards, { persist: false });
      assert.equal(summary.boardsProcessed, 2);
      assert.equal(summary.totalFetched, 1);
      assert.equal(summary.results.length, 2);
      assert.equal(summary.results[0].success, true);
      assert.equal(summary.results[0].fetched, 1);
      assert.equal(summary.results[1].success, true); // Handled safely without crash
      assert.equal(summary.results[1].fetched, 0);
    });

    test('syncSingleBoard handles ashby platform board successfully', async () => {
      global.fetch = async () => ({
        ok: true,
        status: 200,
        json: async () => ({
          jobs: [
            {
              id: 'atlan-1',
              title: 'Principal Software Engineer',
              location: 'India',
              jobUrl: 'https://jobs.ashbyhq.com/atlan/atlan-1',
            },
          ],
        }),
      });

      const res = await syncSingleBoard(
        { name: 'Atlan', platform: 'ashby', token: 'atlan' },
        { persist: false }
      );
      assert.equal(res.success, true);
      assert.equal(res.fetched, 1);
      assert.equal(res.platform, 'ashby');
    });
  });

  // --- Periodic Scheduler Tests ---
  describe('Periodic Job Sync Scheduler', () => {
    test('runScheduledSyncCycle triggers sync cycle safely', async () => {
      global.fetch = async () => ({
        ok: true,
        status: 200,
        json: async () => ({ jobs: [] }),
      });

      const summary = await runScheduledSyncCycle({
        boardsList: [{ name: 'TestBoard', platform: 'greenhouse', token: 'test', enabled: true }],
        persist: false,
      });

      assert.ok(summary);
      assert.equal(summary.boardsProcessed, 1);
      assert.equal(summary.totalSaved, 0);
    });

    test('runScheduledSyncCycle guards against concurrent overlapping runs', async () => {
      let fetchResolve;
      global.fetch = () =>
        new Promise((resolve) => {
          fetchResolve = resolve;
        });

      const board = [{ name: 'SlowBoard', platform: 'greenhouse', token: 'slow', enabled: true }];

      // Start first cycle (slow)
      const firstCyclePromise = runScheduledSyncCycle({ boardsList: board, persist: false });

      // Immediate concurrent attempt should be skipped
      const secondCycle = await runScheduledSyncCycle({ boardsList: board, persist: false });
      assert.equal(secondCycle, null);

      // Finish first cycle
      fetchResolve({
        ok: true,
        status: 200,
        json: async () => ({ jobs: [] }),
      });

      const firstCycle = await firstCyclePromise;
      assert.ok(firstCycle);
      assert.equal(firstCycle.boardsProcessed, 1);
    });

    test('startJobSyncSchedule and stopJobSyncSchedule configure and teardown interval cleanly', () => {
      const timer = startJobSyncSchedule({
        intervalMs: 100000,
        runImmediately: false,
      });

      assert.ok(timer);
      stopJobSyncSchedule();
    });
  });

  // --- Freshness Tracking & Safe Closure Reconciliation Tests ---
  describe('Freshness Tracking & Board Closure Reconciliation', () => {
    test('successful full sync sets lastVerifiedAt, isClosed: false, and reopens closed jobs', async () => {
      const originalFindOneAndUpdate = Job.findOneAndUpdate;
      const updates = [];

      Job.findOneAndUpdate = async (filter, updateDoc, options) => {
        updates.push({ filter, updateDoc, options });
        return { _id: 'fake-id', ...updateDoc.$set };
      };

      const syncTime = new Date('2026-10-13T00:00:00.000Z');
      const liveJobs = [
        {
          externalId: 'job-live-1',
          title: 'Staff Software Engineer',
          company: 'Cloudflare',
          location: 'Remote',
          platform: 'greenhouse',
          sourceUrl: 'https://boards.greenhouse.io/cloudflare/jobs/job-live-1',
        },
      ];

      try {
        const saved = await persistNormalizedJobs(liveJobs, { syncTime });
        assert.equal(saved, 1);
        assert.equal(updates.length, 1);

        const call = updates[0];
        assert.equal(call.filter.platform, 'greenhouse');
        assert.equal(call.filter.externalId, 'job-live-1');
        assert.equal(call.updateDoc.$set.lastVerifiedAt, syncTime);
        assert.equal(call.updateDoc.$set.isClosed, false);
        assert.equal(call.updateDoc.$set.closedAt, null);
        assert.equal(call.updateDoc.$setOnInsert.status, 'discovered');
      } finally {
        Job.findOneAndUpdate = originalFindOneAndUpdate;
      }
    });

    test('reconcileClosedJobsForBoard marks missing jobs as closed with closedAt timestamp', async () => {
      const originalFind = Job.find;
      const originalUpdateMany = Job.updateMany;
      let updatedFilter = null;
      let updatePayload = null;

      const mockDbJobs = [
        {
          _id: 'db-job-1',
          externalId: 'job-live-1',
          sourceUrl: 'https://boards.greenhouse.io/cloudflare/jobs/job-live-1',
          company: 'Cloudflare',
          platform: 'greenhouse',
        },
        {
          _id: 'db-job-2',
          externalId: 'job-removed-2',
          sourceUrl: 'https://boards.greenhouse.io/cloudflare/jobs/job-removed-2',
          company: 'Cloudflare',
          platform: 'greenhouse',
        },
      ];

      Job.find = (filter) => ({
        select: () => ({
          lean: async () => {
            assert.equal(filter.company, 'Cloudflare');
            assert.equal(filter.platform, 'greenhouse');
            assert.deepEqual(filter.isClosed, { $ne: true });
            return mockDbJobs;
          },
        }),
      });

      Job.updateMany = async (filter, doc) => {
        updatedFilter = filter;
        updatePayload = doc;
        return { modifiedCount: 1 };
      };

      const syncTime = new Date('2026-10-13T01:00:00.000Z');
      const liveJobs = [
        {
          externalId: 'job-live-1',
          sourceUrl: 'https://boards.greenhouse.io/cloudflare/jobs/job-live-1',
          company: 'Cloudflare',
          platform: 'greenhouse',
        },
      ];

      try {
        const closedCount = await reconcileClosedJobsForBoard(
          { name: 'Cloudflare', platform: 'greenhouse', token: 'cloudflare' },
          liveJobs,
          syncTime
        );

        assert.equal(closedCount, 1);
        assert.ok(updatedFilter);
        assert.deepEqual(updatedFilter._id, { $in: ['db-job-2'] });
        assert.equal(updatePayload.$set.isClosed, true);
        assert.equal(updatePayload.$set.closedAt, syncTime);
      } finally {
        Job.find = originalFind;
        Job.updateMany = originalUpdateMany;
      }
    });

    test('preserves user application tracking status when a job is marked closed', async () => {
      const originalFind = Job.find;
      const originalUpdateMany = Job.updateMany;
      let updateDocRecorded = null;

      Job.find = () => ({
        select: () => ({
          lean: async () => [
            {
              _id: 'applied-job-id',
              externalId: 'external-999',
              sourceUrl: 'https://boards.greenhouse.io/acme/999',
              company: 'Acme',
              platform: 'greenhouse',
              status: 'applied', // User is currently tracking this job as applied!
            },
          ],
        }),
      });

      Job.updateMany = async (filter, doc) => {
        updateDocRecorded = doc;
        return { modifiedCount: 1 };
      };

      try {
        await reconcileClosedJobsForBoard(
          { name: 'Acme', platform: 'greenhouse', token: 'acme' },
          []
        );

        // Verification: $set MUST only touch isClosed and closedAt, never overwriting user's 'applied' status
        assert.ok(updateDocRecorded);
        assert.equal(updateDocRecorded.$set.isClosed, true);
        assert.equal(updateDocRecorded.$set.status, undefined);
      } finally {
        Job.find = originalFind;
        Job.updateMany = originalUpdateMany;
      }
    });

    test('reconciliation strictly isolates target board and never closes jobs from unrelated boards', async () => {
      const originalFind = Job.find;
      const originalUpdateMany = Job.updateMany;
      let queriedCompany = null;
      let queriedPlatform = null;

      Job.find = (filter) => {
        queriedCompany = filter.company;
        queriedPlatform = filter.platform;
        return {
          select: () => ({
            lean: async () => [],
          }),
        };
      };

      Job.updateMany = async () => ({ modifiedCount: 0 });

      try {
        await reconcileClosedJobsForBoard(
          { name: 'Sentry', platform: 'ashby', token: 'sentry' },
          []
        );

        // Must strictly filter by Sentry and ashby
        assert.equal(queriedCompany, 'Sentry');
        assert.equal(queriedPlatform, 'ashby');
      } finally {
        Job.find = originalFind;
        Job.updateMany = originalUpdateMany;
      }
    });

    test('failed requests (404, 500, 429, timeouts) never mark jobs as closed', async () => {
      let reconcileCalled = false;
      const originalFind = Job.find;
      Job.find = () => {
        reconcileCalled = true;
        return { select: () => ({ lean: async () => [] }) };
      };

      // Test 500 server error
      global.fetch = async () => ({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });

      try {
        const res500 = await syncSingleBoard({
          name: 'FailingCorp',
          platform: 'greenhouse',
          token: 'fail',
        });
        assert.ok(res500.error);
        assert.equal(res500.closed, 0);
        assert.equal(res500.reconciled, false);
        assert.equal(reconcileCalled, false);

        // Test timeout error
        global.fetch = async () => {
          const err = new Error('The operation was aborted');
          err.name = 'AbortError';
          throw err;
        };

        const resTimeout = await syncSingleBoard({
          name: 'TimeoutCorp',
          platform: 'lever',
          token: 'timeout',
        });
        assert.ok(resTimeout.error);
        assert.equal(resTimeout.closed, 0);
        assert.equal(resTimeout.reconciled, false);
        assert.equal(reconcileCalled, false);
      } finally {
        Job.find = originalFind;
      }
    });

    test('empty or malformed payloads never mark jobs as closed', async () => {
      let updateManyCalled = false;
      const originalUpdateMany = Job.updateMany;
      Job.updateMany = async () => {
        updateManyCalled = true;
        return { modifiedCount: 0 };
      };

      try {
        // Empty text payload
        global.fetch = async () => ({
          ok: true,
          status: 200,
          text: async () => '',
        });

        const resEmpty = await syncSingleBoard({
          name: 'EmptyBoard',
          platform: 'greenhouse',
          token: 'empty',
        });
        assert.ok(resEmpty.error);
        assert.equal(resEmpty.closed, 0);
        assert.equal(resEmpty.reconciled, false);
        assert.equal(updateManyCalled, false);

        // Malformed non-JSON payload
        global.fetch = async () => ({
          ok: true,
          status: 200,
          text: async () => '<html><body>404 Not Found</body></html>',
        });

        const resHtml = await syncSingleBoard({
          name: 'HtmlBoard',
          platform: 'ashby',
          token: 'html',
        });
        assert.ok(resHtml.error);
        assert.equal(resHtml.closed, 0);
        assert.equal(resHtml.reconciled, false);
        assert.equal(updateManyCalled, false);

        // Unexpected object without jobs array
        global.fetch = async () => ({
          ok: true,
          status: 200,
          text: async () => JSON.stringify({ error: 'unauthorized', status: false }),
        });

        const resMalformed = await syncSingleBoard({
          name: 'MalformedBoard',
          platform: 'greenhouse',
          token: 'malformed',
        });
        assert.ok(resMalformed.error);
        assert.equal(resMalformed.closed, 0);
        assert.equal(resMalformed.reconciled, false);
        assert.equal(updateManyCalled, false);
      } finally {
        Job.updateMany = originalUpdateMany;
      }
    });

    test('pagination: skips closure reconciliation when board response indicates further pages', async () => {
      const originalFindOneAndUpdate = Job.findOneAndUpdate;
      const originalFind = Job.find;
      let reconcileTriggered = false;

      Job.findOneAndUpdate = async () => ({ _id: 'fake-id' });
      Job.find = () => {
        reconcileTriggered = true;
        return { select: () => ({ lean: async () => [] }) };
      };

      // Mock Ashby board with nextCursor indicating pagination
      global.fetch = async () => ({
        ok: true,
        status: 200,
        text: async () =>
          JSON.stringify({
            jobs: [
              {
                id: 'job-page-1',
                title: 'Staff Engineer',
                location: 'Remote',
                jobUrl: 'https://jobs.ashbyhq.com/example/job-page-1',
              },
            ],
            nextCursor: 'cursor_page_2_token',
            hasMore: true,
          }),
      });

      try {
        const res = await syncSingleBoard({
          name: 'PaginatedCorp',
          platform: 'ashby',
          token: 'paginated',
        });

        assert.equal(res.success, true);
        assert.equal(res.fetched, 1);
        assert.equal(res.reconciled, false);
        assert.equal(res.closed, 0);
        assert.equal(reconcileTriggered, false);
      } finally {
        Job.findOneAndUpdate = originalFindOneAndUpdate;
        Job.find = originalFind;
      }
    });
  });
});
