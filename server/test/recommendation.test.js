import { test, describe, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import {
  hasUsableProfileData,
  resolvePythonExecutable,
  resolveRecommenderScript,
  invokePythonRecommender,
  getRecommendedJobsForUser,
  DEFAULT_MIN_SCORE,
  getInFlightRequestCount,
  prewarmPythonRecommender,
  prewarmActiveJobsCatalog,
  refreshActiveJobsCatalog,
  fetchActiveJobsCatalog,
  invalidateActiveJobsCache,
  getCachedActiveJobs,
  getActiveJobsCatalogStatus,
  ACTIVE_JOBS_CACHE_TTL_MS,
  RECOMMENDATION_JOBS_PROJECTION,
} from '../src/services/recommendationService.js';
import { getRecommendedJobs } from '../src/controllers/jobController.js';
import Profile from '../src/models/Profile.js';
import Resume from '../src/models/Resume.js';
import Job from '../src/models/Job.js';
import User from '../src/models/User.js';
import {
  searchJobs,
  CANDIDATE_WINDOW_LIMIT,
  SEARCH_JOBS_PROJECTION,
} from '../src/services/jobService.js';

describe('ML Job Recommendation Service & Controller Tests', () => {
  before(async () => {
    // Pre-warm Python environment and scikit-learn cache so concurrent test suites don't hit cold-start timeouts
    await prewarmPythonRecommender();
  });

  beforeEach(() => {
    invalidateActiveJobsCache();
  });

  const userAId = new mongoose.Types.ObjectId('607f1f77bcf86cd799439001');
  const userBId = new mongoose.Types.ObjectId('607f1f77bcf86cd799439002');
  const job1Id = new mongoose.Types.ObjectId('507f1f77bcf86cd799439011');
  const job2Id = new mongoose.Types.ObjectId('507f1f77bcf86cd799439012');

  const mockJob1 = {
    _id: job1Id,
    title: 'Frontend Engineer',
    company: 'Stripe',
    location: 'Remote',
    description: 'Build user interfaces using React, Next.js, and TypeScript.',
    requirements: ['React', 'TypeScript', 'Tailwind CSS'],
    salaryRange: { min: 140000, max: 180000, currency: 'USD' },
    sourceUrl: 'https://stripe.com/jobs/1',
    platform: 'greenhouse',
    status: 'discovered',
  };

  const mockJob2 = {
    _id: job2Id,
    title: 'Executive Pastry Chef',
    company: 'Artisan Bakery',
    location: 'New York, NY',
    description: 'Bake bread, design dessert menus, supervise culinary staff.',
    requirements: ['Pastry arts degree', 'Food safety certified'],
    salaryRange: { min: 60000, max: 75000, currency: 'USD' },
    sourceUrl: 'https://bakery.com/jobs/2',
    platform: 'lever',
    status: 'discovered',
  };

  describe('hasUsableProfileData helper', () => {
    test('returns true when skills exist', () => {
      assert.equal(hasUsableProfileData({ skills: ['JavaScript', 'React'] }), true);
    });

    test('returns true when summary exists', () => {
      assert.equal(hasUsableProfileData({ skills: [], summary: 'Experienced software engineer' }), true);
    });

    test('returns true when experience or projects exist', () => {
      assert.equal(hasUsableProfileData({ skills: [], experience: [{ role: 'Developer' }] }), true);
      assert.equal(hasUsableProfileData({ skills: [], projects: [{ title: 'App' }] }), true);
    });

    test('returns true when resume has rawText fallback', () => {
      assert.equal(
        hasUsableProfileData(null, { parsed: { rawText: 'Extensive background in React and Node.' } }),
        true
      );
    });

    test('returns false when profile and resume are empty or null', () => {
      assert.equal(hasUsableProfileData(null, null), false);
      assert.equal(hasUsableProfileData({ skills: [], summary: '' }, null), false);
      assert.equal(hasUsableProfileData({}, { parsed: { rawText: '' } }), false);
    });
  });

  describe('Path Resolution', () => {
    test('resolves a valid Python executable path', () => {
      const pythonPath = resolvePythonExecutable();
      assert.ok(typeof pythonPath === 'string' && pythonPath.length > 0);
    });

    test('resolves existing recommender script path', () => {
      const scriptPath = resolveRecommenderScript();
      assert.ok(scriptPath.endsWith('ml\\recommender.py') || scriptPath.endsWith('ml/recommender.py'));
    });
  });

  describe('Live Python Subprocess Execution (invokePythonRecommender)', () => {
    test('successfully computes similarity and ranks jobs via real Python virtualenv', async () => {
      const payload = {
        candidate: {
          skills: ['React', 'TypeScript', 'Next.js'],
          summary: 'Frontend engineer specializing in React and modern UI.',
        },
        jobs: [
          {
            id: job1Id.toString(),
            title: mockJob1.title,
            company: mockJob1.company,
            description: mockJob1.description,
            requirements: mockJob1.requirements,
          },
          {
            id: job2Id.toString(),
            title: mockJob2.title,
            company: mockJob2.company,
            description: mockJob2.description,
            requirements: mockJob2.requirements,
          },
        ],
        options: { topK: 10 },
      };

      const result = await invokePythonRecommender(payload);
      assert.equal(result.success, true);
      assert.equal(result.totalEvaluated, 2);
      assert.ok(Array.isArray(result.recommendations));
      assert.equal(result.recommendations.length, 2);

      // Frontend engineer should score strictly higher than Chef
      const topRec = result.recommendations[0];
      const bottomRec = result.recommendations[1];
      assert.equal(topRec.jobId, job1Id.toString());
      assert.ok(topRec.score > bottomRec.score);
      assert.ok(topRec.matchPercentage > bottomRec.matchPercentage);
      assert.ok(topRec.matchedSkills.includes('React'));
    });

    test('gracefully handles empty candidate profile without throwing', async () => {
      const payload = {
        candidate: { skills: [], summary: '' },
        jobs: [
          {
            id: job1Id.toString(),
            title: mockJob1.title,
            description: mockJob1.description,
          },
        ],
      };

      const result = await invokePythonRecommender(payload);
      assert.equal(result.success, true);
      assert.equal(result.emptyCandidate, true);
      assert.deepEqual(result.recommendations, []);
    });

    test('proves rawText from parsed resume is included alongside structured skills and enhances score', async () => {
      const devOpsJob = {
        id: 'job-devops-1',
        title: 'Platform Infrastructure Engineer',
        description: 'Manage production systems with Kubernetes clusters, Docker containers, and CI/CD pipelines.',
        requirements: ['Kubernetes', 'Docker'],
      };

      const payloadWithoutRawText = {
        candidate: {
          skills: ['React'],
          summary: 'Frontend developer',
          rawText: '',
        },
        jobs: [devOpsJob],
        options: { topK: 1, minScore: 0.0 },
      };

      const payloadWithRawText = {
        candidate: {
          skills: ['React'],
          summary: 'Frontend developer',
          rawText: 'Experienced with Kubernetes clusters, Docker containerization, and microservices deployment.',
        },
        jobs: [devOpsJob],
        options: { topK: 1, minScore: 0.0 },
      };

      const resultWithout = await invokePythonRecommender(payloadWithoutRawText);
      const resultWith = await invokePythonRecommender(payloadWithRawText);

      assert.equal(resultWithout.success, true);
      assert.equal(resultWith.success, true);

      const scoreWithout = resultWithout.recommendations[0].score;
      const scoreWith = resultWith.recommendations[0].score;

      assert.ok(
        scoreWith > scoreWithout,
        `Expected score with rawText (${scoreWith}) to be strictly greater than without (${scoreWithout})`
      );
    });
  });

  describe('getRecommendedJobsForUser service', () => {
    test('returns emptyProfile: true without running ML when user profile is empty', async () => {
      const origProfileFindOne = Profile.findOne;
      const origResumeFindOne = Resume.findOne;

      Profile.findOne = () => ({ lean: async () => null });
      Resume.findOne = () => ({ sort: () => ({ lean: async () => null }) });

      try {
        const result = await getRecommendedJobsForUser(userAId);
        assert.equal(result.emptyProfile, true);
        assert.deepEqual(result.jobs, []);
        assert.equal(result.totalEvaluated, 0);
      } finally {
        Profile.findOne = origProfileFindOne;
        Resume.findOne = origResumeFindOne;
      }
    });

    test('user data isolation: fetches strictly the authenticated user profile and jobs', async () => {
      const origProfileFindOne = Profile.findOne;
      const origResumeFindOne = Resume.findOne;
      const origJobFind = Job.find;

      let capturedProfileQuery = null;

      Profile.findOne = (query) => {
        capturedProfileQuery = query;
        return {
          lean: async () => ({
            userId: userAId,
            skills: ['React', 'TypeScript'],
            summary: 'React developer',
          }),
        };
      };

      Resume.findOne = () => ({ sort: () => ({ lean: async () => null }) });

      let capturedJobQuery = null;
      let capturedJobSelect = null;

      const verifiedDate = new Date('2026-10-13T00:00:00.000Z');
      const verifiedMockJob1 = {
        ...mockJob1,
        lastVerifiedAt: verifiedDate,
      };

      Job.find = (q) => {
        capturedJobQuery = q;
        return {
          select: (sel) => {
            capturedJobSelect = sel;
            return {
              lean: async () => [verifiedMockJob1, mockJob2],
            };
          },
        };
      };

      try {
        const result = await getRecommendedJobsForUser(userAId, { topK: 5 });
        assert.equal(capturedProfileQuery.userId.toString(), userAId.toString());
        assert.deepEqual(capturedJobQuery.isClosed, { $ne: true });
        assert.ok(capturedJobSelect.includes('lastVerifiedAt'));
        assert.equal(result.emptyProfile, false);
        assert.ok(result.jobs.length > 0);

        // Top recommendation must be Frontend Engineer with lastVerifiedAt preserved
        assert.equal(result.jobs[0]._id.toString(), job1Id.toString());
        assert.equal(result.jobs[0].lastVerifiedAt, verifiedDate);
        assert.ok(result.jobs[0].matchScore > 0);
        assert.ok(result.jobs[0].matchPercentage > 0);
        assert.ok(result.jobs[0].matchedSkills.includes('React'));

        // Crucial security check: Ensure NO private resume text or candidate email is attached to job objects
        for (const job of result.jobs) {
          assert.equal(job.rawText, undefined);
          assert.equal(job.email, undefined);
          assert.equal(job.phone, undefined);
          assert.equal(job.userId, undefined);
        }
      } finally {
        Profile.findOne = origProfileFindOne;
        Resume.findOne = origResumeFindOne;
        Job.find = origJobFind;
      }
    });

    test('respects bounded topK option', async () => {
      const origProfileFindOne = Profile.findOne;
      const origResumeFindOne = Resume.findOne;
      const origJobFind = Job.find;

      Profile.findOne = () => ({
        lean: async () => ({ skills: ['React'] }),
      });
      Resume.findOne = () => ({ sort: () => ({ lean: async () => null }) });
      Job.find = () => ({
        select: () => ({
          lean: async () => [mockJob1, mockJob2],
        }),
      });

      try {
        const result = await getRecommendedJobsForUser(userAId, { topK: 1 });
        assert.equal(result.jobs.length, 1);
      } finally {
        Profile.findOne = origProfileFindOne;
        Resume.findOne = origResumeFindOne;
        Job.find = origJobFind;
      }
    });

    test('filters jobs by India and open remote by default, excluding foreign on-site jobs', async () => {
      const origProfileFindOne = Profile.findOne;
      const origResumeFindOne = Resume.findOne;
      const origJobFind = Job.find;

      const indiaJob = {
        _id: new mongoose.Types.ObjectId(),
        title: 'Full Stack Engineer',
        company: 'Bangalore Tech Labs',
        location: 'Bengaluru, Karnataka, India',
        description: 'Build web applications using React and Node.js.',
        requirements: ['React', 'Node.js'],
      };
      const remoteJob = {
        _id: new mongoose.Types.ObjectId(),
        title: 'Frontend Developer',
        company: 'Global Distributed',
        location: 'Remote',
        description: 'Build user interfaces with React and TypeScript worldwide.',
        requirements: ['React'],
      };
      const foreignJob = {
        _id: new mongoose.Types.ObjectId(),
        title: 'Software Engineer',
        company: 'London Corp',
        location: 'London, United Kingdom',
        description: 'On-site engineering in Central London using React.',
        requirements: ['React'],
      };

      Profile.findOne = () => ({
        lean: async () => ({ skills: ['React', 'Node.js'] }),
      });
      Resume.findOne = () => ({ sort: () => ({ lean: async () => null }) });
      Job.find = () => ({
        select: () => ({
          lean: async () => [indiaJob, remoteJob, foreignJob],
        }),
      });

      try {
        const defaultResult = await getRecommendedJobsForUser(userAId, { minScore: 0 });
        assert.equal(defaultResult.totalEvaluated, 2); // only India and Remote evaluated
        const returnedIds = defaultResult.jobs.map((j) => j._id.toString());
        assert.ok(returnedIds.includes(indiaJob._id.toString()));
        assert.ok(returnedIds.includes(remoteJob._id.toString()));
        assert.ok(!returnedIds.includes(foreignJob._id.toString()));

        // With locationPreference: 'all', all 3 should be evaluated
        const allResult = await getRecommendedJobsForUser(userAId, { locationPreference: 'all', minScore: 0 });
        assert.equal(allResult.totalEvaluated, 3);
        const allReturnedIds = allResult.jobs.map((j) => j._id.toString());
        assert.ok(allReturnedIds.includes(foreignJob._id.toString()));
      } finally {
        Profile.findOne = origProfileFindOne;
        Resume.findOne = origResumeFindOne;
        Job.find = origJobFind;
      }
    });

    test('freshers: excludes Tier 3 Senior/Staff and Tier 4 Leadership while preserving and ranking Tier 1 ahead of Tier 2', async () => {
      const origProfileFindOne = Profile.findOne;
      const origResumeFindOne = Resume.findOne;
      const origJobFind = Job.find;

      const internJob = {
        _id: new mongoose.Types.ObjectId(),
        title: 'Frontend Engineering Intern',
        company: 'Startup India',
        location: 'Bengaluru, India',
        description: 'Software engineering internship for students. Learn React, modern web development, and team collaboration.',
        requirements: ['React', 'JavaScript'],
      };
      const midJob = {
        _id: new mongoose.Types.ObjectId(),
        title: 'Frontend Developer',
        company: 'Tech Solutions India',
        location: 'Bengaluru, India',
        description: 'Build user interfaces with React, modern web standards, and JavaScript APIs.',
        requirements: ['React', 'JavaScript'],
      };
      const seniorJob = {
        _id: new mongoose.Types.ObjectId(),
        title: 'Senior Staff Frontend Architect',
        company: 'Enterprise India',
        location: 'Remote',
        description: 'Senior staff architect leading React architecture, TypeScript design systems, and frontend team direction.',
        requirements: ['React', 'TypeScript', 'System Design'],
      };
      const managerJob = {
        _id: new mongoose.Types.ObjectId(),
        title: 'Engineering Manager - Frontend',
        company: 'Global Corp',
        location: 'Bengaluru, India',
        description: 'Lead and manage frontend engineering teams, oversee hiring, and set technical roadmaps.',
        requirements: ['Engineering Management', 'React'],
      };

      Profile.findOne = () => ({
        lean: async () => ({ skills: ['React', 'JavaScript'], summary: 'Student looking for internship' }),
      });
      Resume.findOne = () => ({ sort: () => ({ lean: async () => null }) });
      Job.find = () => ({
        select: () => ({
          lean: async () => [managerJob, seniorJob, midJob, internJob],
        }),
      });

      try {
        const result = await getRecommendedJobsForUser(userAId, { minScore: 0 });
        // Tier 3 (Senior/Staff) and Tier 4 (Leadership) must be excluded for freshers
        assert.equal(result.jobs.length, 2);
        assert.equal(result.personalization.isFresher, true);

        // Tier 1 (Intern) must be ranked ahead of Tier 2 (Mid-level)
        assert.equal(result.jobs[0]._id.toString(), internJob._id.toString());
        assert.equal(result.jobs[0].seniorityTier, 1);
        assert.equal(result.jobs[1]._id.toString(), midJob._id.toString());
        assert.equal(result.jobs[1].seniorityTier, 2);

        // Ensure Senior and Manager roles are not present
        const returnedIds = result.jobs.map((j) => j._id.toString());
        assert.ok(!returnedIds.includes(seniorJob._id.toString()));
        assert.ok(!returnedIds.includes(managerJob._id.toString()));

        // Actual ML similarity scores must remain honest
        assert.ok(typeof result.jobs[0].matchScore === 'number');
        assert.ok(typeof result.jobs[1].matchScore === 'number');
      } finally {
        Profile.findOne = origProfileFindOne;
        Resume.findOne = origResumeFindOne;
        Job.find = origJobFind;
      }
    });

    test('experienced candidates: preserves and includes Tier 3 Senior/Staff roles in recommendations', async () => {
      const origProfileFindOne = Profile.findOne;
      const origResumeFindOne = Resume.findOne;
      const origJobFind = Job.find;

      const midJob = {
        _id: new mongoose.Types.ObjectId(),
        title: 'Frontend Developer',
        company: 'Tech Solutions India',
        location: 'Bengaluru, India',
        description: 'Build user interfaces with React, modern web standards, and JavaScript APIs.',
        requirements: ['React', 'JavaScript'],
      };
      const seniorJob = {
        _id: new mongoose.Types.ObjectId(),
        title: 'Senior Staff Frontend Architect',
        company: 'Enterprise India',
        location: 'Remote',
        description: 'Senior staff architect leading React architecture, TypeScript design systems, and frontend team direction.',
        requirements: ['React', 'TypeScript', 'System Design'],
      };

      Profile.findOne = () => ({
        lean: async () => ({
          skills: ['React', 'TypeScript', 'System Design'],
          summary: 'Senior Frontend Engineer with 5+ years experience building large scale applications.',
          experience: [
            {
              role: 'Senior Software Engineer',
              company: 'Tech Corp',
              startDate: new Date('2019-01-01'),
              endDate: new Date('2024-01-01'),
              current: false,
            },
          ],
        }),
      });
      Resume.findOne = () => ({ sort: () => ({ lean: async () => null }) });
      Job.find = () => ({
        select: () => ({
          lean: async () => [seniorJob, midJob],
        }),
      });

      try {
        const result = await getRecommendedJobsForUser(userAId, { minScore: 0 });
        assert.equal(result.personalization.isFresher, false);
        // Senior job must be preserved for experienced candidate
        assert.equal(result.jobs.length, 2);
        const returnedIds = result.jobs.map((j) => j._id.toString());
        assert.ok(returnedIds.includes(seniorJob._id.toString()));
      } finally {
        Profile.findOne = origProfileFindOne;
        Resume.findOne = origResumeFindOne;
        Job.find = origJobFind;
      }
    });

    test('preserves senior and staff jobs in Search All Jobs (jobService.searchJobs)', async () => {
      const origFind = Job.find;
      const origCount = Job.countDocuments;

      const mockJobs = [
        { _id: new mongoose.Types.ObjectId(), title: 'Software Engineer Intern', location: 'Bangalore, India', createdAt: new Date() },
        { _id: new mongoose.Types.ObjectId(), title: 'Frontend Developer', location: 'Bangalore, India', createdAt: new Date() },
        { _id: new mongoose.Types.ObjectId(), title: 'Senior Staff Frontend Architect', location: 'Bangalore, India', createdAt: new Date() },
      ];

      Job.find = () => {
        const queryObj = {
          sort: () => ({
            skip: () => ({
              limit: () => ({
                lean: async () => mockJobs,
              }),
            }),
          }),
        };
        queryObj.select = () => queryObj;
        return queryObj;
      };
      Job.countDocuments = async () => 3;

      try {
        const result = await searchJobs({ domain: 'tech', page: 1, limit: 10 });
        assert.equal(result.jobs.length, 3);
        const seniorJob = result.jobs.find((j) => j.title === 'Senior Staff Frontend Architect');
        assert.ok(seniorJob, 'Senior Staff job must remain searchable in All Jobs');
        assert.equal(seniorJob.seniorityTier, 3);
      } finally {
        Job.find = origFind;
        Job.countDocuments = origCount;
      }
    });

    test('filters out low-relevance background noise using minScore threshold', async () => {
      const origProfileFindOne = Profile.findOne;
      const origResumeFindOne = Resume.findOne;
      const origJobFind = Job.find;

      const relevantJob = {
        _id: new mongoose.Types.ObjectId(),
        title: 'Junior React Developer',
        company: 'Dev Co',
        location: 'Remote',
        description: 'Build user interfaces with React, Redux, and modern JavaScript.',
        requirements: ['React', 'Redux', 'JavaScript'],
      };
      const unrelatedJob = {
        _id: new mongoose.Types.ObjectId(),
        title: 'Agricultural Sales Associate',
        company: 'Agri World',
        location: 'Pune, India',
        description: 'Responsible for agricultural fertilizer sales, vendor negotiation, and farm client relationships.',
        requirements: ['Sales experience', 'Driving license'],
      };

      Profile.findOne = () => ({
        lean: async () => ({ skills: ['React', 'JavaScript', 'Redux'], summary: 'Frontend web developer' }),
      });
      Resume.findOne = () => ({ sort: () => ({ lean: async () => null }) });
      Job.find = () => ({
        select: () => ({
          lean: async () => [relevantJob, unrelatedJob],
        }),
      });

      try {
        // Calibrated minScore (e.g. DEFAULT_MIN_SCORE = 0.05). Unrelated job should be dropped
        const result = await getRecommendedJobsForUser(userAId, { minScore: DEFAULT_MIN_SCORE });
        const ids = result.jobs.map((j) => j._id.toString());
        assert.ok(ids.includes(relevantJob._id.toString()));
        assert.ok(!ids.includes(unrelatedJob._id.toString()));
      } finally {
        Profile.findOne = origProfileFindOne;
        Resume.findOne = origResumeFindOne;
        Job.find = origJobFind;
      }
    });

    test('returns empty recommendation list with clear message when no jobs qualify above threshold', async () => {
      const origProfileFindOne = Profile.findOne;
      const origResumeFindOne = Resume.findOne;
      const origJobFind = Job.find;

      // Only unrelated jobs available in eligible location
      const unrelatedJob = {
        _id: new mongoose.Types.ObjectId(),
        title: 'Agricultural Sales Associate',
        company: 'Agri World',
        location: 'Pune, India',
        description: 'Responsible for agricultural fertilizer sales, vendor negotiation, and farm client relationships.',
        requirements: ['Sales experience', 'Driving license'],
      };

      Profile.findOne = () => ({
        lean: async () => ({ skills: ['React', 'JavaScript'], summary: 'Frontend web developer' }),
      });
      Resume.findOne = () => ({ sort: () => ({ lean: async () => null }) });
      Job.find = () => ({
        select: () => ({
          lean: async () => [unrelatedJob],
        }),
      });

      try {
        const result = await getRecommendedJobsForUser(userAId, { minScore: DEFAULT_MIN_SCORE });
        assert.equal(result.emptyProfile, false);
        assert.equal(result.jobs.length, 0);
        assert.deepEqual(result.jobs, []);
        assert.ok(result.message.includes('No sufficiently relevant openings'));
      } finally {
        Profile.findOne = origProfileFindOne;
        Resume.findOne = origResumeFindOne;
        Job.find = origJobFind;
      }
    });

    test('fails safely on Python subprocess timeout without fabricating recommendations', async () => {
      // Simulate extreme short timeout (1ms) to verify timeout rejection
      const payload = {
        candidate: { skills: ['React'] },
        jobs: [{ id: '123', title: 'Developer', description: 'React dev' }],
      };

      await assert.rejects(
        async () => {
          await invokePythonRecommender(payload, { timeoutMs: 1 });
        },
        /ML recommender timed out/
      );
    });
  });

  describe('HTTP Controller getRecommendedJobs', () => {
    const mockUserDoc = {
      _id: userAId,
      firebaseUid: 'mock-firebase-uid-123',
      email: 'mock-firebase-uid-123@app.user',
      name: 'Test User',
      authProvider: 'password',
      save: async () => {},
    };

    test('returns 200 with recommended jobs array', async () => {
      const origUserFindOne = User.findOne;
      const origProfileFindOne = Profile.findOne;
      const origResumeFindOne = Resume.findOne;
      const origJobFind = Job.find;

      User.findOne = async () => mockUserDoc;
      Profile.findOne = () => ({
        lean: async () => ({ skills: ['React', 'TypeScript'] }),
      });
      Resume.findOne = () => ({ sort: () => ({ lean: async () => null }) });
      Job.find = () => ({
        select: () => ({
          lean: async () => [mockJob1, mockJob2],
        }),
      });

      const req = {
        user: { uid: 'mock-firebase-uid-123' },
        query: { topK: '10' },
      };

      let responseStatus = null;
      let responsePayload = null;
      const res = {
        status: (code) => {
          responseStatus = code;
          return {
            json: (payload) => {
              responsePayload = payload;
              return payload;
            },
          };
        },
      };

      try {
        await getRecommendedJobs(req, res);
        assert.equal(responseStatus, 200);
        assert.equal(responsePayload.success, true);
        assert.ok(Array.isArray(responsePayload.data.jobs));
        assert.ok(responsePayload.data.jobs.length > 0);
        assert.equal(responsePayload.data.emptyProfile, false);
      } finally {
        User.findOne = origUserFindOne;
        Profile.findOne = origProfileFindOne;
        Resume.findOne = origResumeFindOne;
        Job.find = origJobFind;
      }
    });

    test('returns 200 with emptyProfile: true when candidate has no profile', async () => {
      const origUserFindOne = User.findOne;
      const origProfileFindOne = Profile.findOne;
      const origResumeFindOne = Resume.findOne;

      User.findOne = async () => mockUserDoc;
      Profile.findOne = () => ({ lean: async () => null });
      Resume.findOne = () => ({ sort: () => ({ lean: async () => null }) });

      const req = {
        user: { uid: 'mock-firebase-uid-123' },
        query: {},
      };

      let responseStatus = null;
      let responsePayload = null;
      const res = {
        status: (code) => {
          responseStatus = code;
          return {
            json: (payload) => {
              responsePayload = payload;
              return payload;
            },
          };
        },
      };

      try {
        await getRecommendedJobs(req, res);
        assert.equal(responseStatus, 200);
        assert.equal(responsePayload.success, true);
        assert.equal(responsePayload.data.emptyProfile, true);
        assert.deepEqual(responsePayload.data.jobs, []);
      } finally {
        User.findOne = origUserFindOne;
        Profile.findOne = origProfileFindOne;
        Resume.findOne = origResumeFindOne;
      }
    });
  });

  describe('Concurrency, In-Flight Deduplication & Cancellation Tests', () => {
    test('coalesces concurrent requests for the same user into a single in-flight process', async () => {
      const origProfileFindOne = Profile.findOne;
      const origResumeFindOne = Resume.findOne;
      const origJobFind = Job.find;

      Profile.findOne = () => ({
        lean: async () => ({ skills: ['React', 'TypeScript'] }),
      });
      Resume.findOne = () => ({ sort: () => ({ lean: async () => null }) });
      Job.find = () => ({
        select: () => ({
          lean: async () => [mockJob1],
        }),
      });

      try {
        assert.equal(getInFlightRequestCount(), 0);

        // Launch 2 concurrent calls for the exact same userId
        const [res1, res2] = await Promise.all([
          getRecommendedJobsForUser(userAId, { topK: 1 }),
          getRecommendedJobsForUser(userAId, { topK: 1 }),
        ]);

        // Both callers should receive valid recommendation results
        assert.equal(res1.jobs.length, 1);
        assert.equal(res2.jobs.length, 1);
        assert.equal(res1.jobs[0]._id.toString(), mockJob1._id.toString());
        assert.equal(res2.jobs[0]._id.toString(), mockJob1._id.toString());

        // In-flight map must be completely clean after completion
        assert.equal(getInFlightRequestCount(), 0);
      } finally {
        Profile.findOne = origProfileFindOne;
        Resume.findOne = origResumeFindOne;
        Job.find = origJobFind;
      }
    });

    test('cleans up in-flight request entry after successful execution without stale caching', async () => {
      const origProfileFindOne = Profile.findOne;
      const origResumeFindOne = Resume.findOne;
      const origJobFind = Job.find;

      Profile.findOne = () => ({
        lean: async () => ({ skills: ['React'] }),
      });
      Resume.findOne = () => ({ sort: () => ({ lean: async () => null }) });
      Job.find = () => ({
        select: () => ({
          lean: async () => [mockJob1],
        }),
      });

      try {
        const firstResult = await getRecommendedJobsForUser(userAId);
        assert.ok(firstResult.jobs.length > 0);
        assert.equal(getInFlightRequestCount(), 0);

        // Next call should run fresh and also clean up
        const secondResult = await getRecommendedJobsForUser(userAId);
        assert.ok(secondResult.jobs.length > 0);
        assert.equal(getInFlightRequestCount(), 0);
      } finally {
        Profile.findOne = origProfileFindOne;
        Resume.findOne = origResumeFindOne;
        Job.find = origJobFind;
      }
    });

    test('cleans up in-flight request map immediately when ML recommender fails', async () => {
      const origProfileFindOne = Profile.findOne;
      const origResumeFindOne = Resume.findOne;
      const origJobFind = Job.find;

      Profile.findOne = () => ({
        lean: async () => ({ skills: ['React'] }),
      });
      Resume.findOne = () => ({ sort: () => ({ lean: async () => null }) });
      Job.find = () => ({
        select: () => ({
          lean: async () => {
            throw new Error('Database connection failed');
          },
        }),
      });

      try {
        await assert.rejects(
          async () => {
            await getRecommendedJobsForUser(userAId);
          },
          /Database connection failed/
        );

        // Map must be cleared and not retain failed error permanently
        assert.equal(getInFlightRequestCount(), 0);
      } finally {
        Profile.findOne = origProfileFindOne;
        Resume.findOne = origResumeFindOne;
        Job.find = origJobFind;
      }
    });

    test('cancels safely: aborting one subscriber does not abort the shared process for another active subscriber', async () => {
      const origProfileFindOne = Profile.findOne;
      const origResumeFindOne = Resume.findOne;
      const origJobFind = Job.find;

      Profile.findOne = () => ({
        lean: async () => ({ skills: ['React', 'TypeScript'] }),
      });
      Resume.findOne = () => ({ sort: () => ({ lean: async () => null }) });
      Job.find = () => ({
        select: () => ({
          lean: async () => [mockJob1],
        }),
      });

      const abortCtrl1 = new AbortController();

      try {
        const call1 = getRecommendedJobsForUser(userAId, { signal: abortCtrl1.signal });
        const call2 = getRecommendedJobsForUser(userAId);

        // Abort the first request while in flight
        abortCtrl1.abort();

        // Call 1 should reject due to abort
        await assert.rejects(call1, (err) => err.name === 'AbortError' || /aborted/i.test(err.message));

        // Call 2 should succeed because it was still subscribed and shared process continued
        const res2 = await call2;
        assert.ok(res2.jobs.length > 0);
        assert.equal(getInFlightRequestCount(), 0);
      } finally {
        Profile.findOne = origProfileFindOne;
        Resume.findOne = origResumeFindOne;
        Job.find = origJobFind;
      }
    });

    test('terminates child process and cleans up when all subscribers abort', async () => {
      const origProfileFindOne = Profile.findOne;
      const origResumeFindOne = Resume.findOne;
      const origJobFind = Job.find;

      Profile.findOne = () => ({
        lean: async () => ({ skills: ['React'] }),
      });
      Resume.findOne = () => ({ sort: () => ({ lean: async () => null }) });
      Job.find = () => ({
        select: () => ({
          lean: async () => [mockJob1],
        }),
      });

      const abortCtrl = new AbortController();

      try {
        const call = getRecommendedJobsForUser(userAId, { signal: abortCtrl.signal });
        abortCtrl.abort();

        await assert.rejects(call, (err) => err.name === 'AbortError' || /aborted/i.test(err.message));
        assert.equal(getInFlightRequestCount(), 0);
      } finally {
        Profile.findOne = origProfileFindOne;
        Resume.findOne = origResumeFindOne;
        Job.find = origJobFind;
      }
    });

    test('prewarmPythonRecommender resolves safely without errors', async () => {
      await assert.doesNotReject(async () => {
        await prewarmPythonRecommender();
      });
    });
  });

  describe('Active Jobs Catalog In-Memory Caching & Projection Tests', () => {
    beforeEach(() => {
      invalidateActiveJobsCache();
    });

    test('fetchActiveJobsCatalog caches results in memory and avoids second database call', async () => {
      let dbCalls = 0;
      const origJobFind = Job.find;
      Job.find = () => {
        dbCalls++;
        return {
          select: (projection) => {
            assert.equal(projection, RECOMMENDATION_JOBS_PROJECTION);
            return {
              lean: async () => [mockJob1, mockJob2],
            };
          },
        };
      };

      try {
        const first = await fetchActiveJobsCatalog();
        assert.equal(dbCalls, 1);
        assert.equal(first.length, 2);

        const second = await fetchActiveJobsCatalog();
        assert.equal(dbCalls, 1); // Served from in-memory cache!
        assert.deepEqual(second, first);
        assert.ok(getCachedActiveJobs() !== null);
      } finally {
        Job.find = origJobFind;
        invalidateActiveJobsCache();
      }
    });

    test('invalidateActiveJobsCache purges cached jobs and forces fresh database fetch', async () => {
      let dbCalls = 0;
      const origJobFind = Job.find;
      Job.find = () => {
        dbCalls++;
        return {
          select: () => ({
            lean: async () => [mockJob1],
          }),
        };
      };

      try {
        await fetchActiveJobsCatalog();
        assert.equal(dbCalls, 1);

        invalidateActiveJobsCache();
        assert.equal(getCachedActiveJobs(), null);

        await fetchActiveJobsCatalog();
        assert.equal(dbCalls, 2);
      } finally {
        Job.find = origJobFind;
        invalidateActiveJobsCache();
      }
    });

    test('fetchActiveJobsCatalog supports forceRefresh to bypass valid cache', async () => {
      let dbCalls = 0;
      const origJobFind = Job.find;
      Job.find = () => {
        dbCalls++;
        return {
          select: () => ({
            lean: async () => [mockJob1],
          }),
        };
      };

      try {
        await fetchActiveJobsCatalog();
        assert.equal(dbCalls, 1);
        assert.ok(getCachedActiveJobs() !== null);

        await fetchActiveJobsCatalog({ forceRefresh: true });
        assert.equal(dbCalls, 2);
      } finally {
        Job.find = origJobFind;
        invalidateActiveJobsCache();
      }
    });

    test('ACTIVE_JOBS_CACHE_TTL_MS is set to exactly 5 minutes', () => {
      assert.equal(ACTIVE_JOBS_CACHE_TTL_MS, 5 * 60 * 1000);
    });

    test('searchJobs applies SEARCH_JOBS_PROJECTION and respects CANDIDATE_WINDOW_LIMIT', async () => {
      let selectArg = null;
      let limitArg = null;
      const origJobFind = Job.find;
      const origCount = Job.countDocuments;

      Job.find = () => ({
        select: (proj) => {
          selectArg = proj;
          return {
            sort: () => ({
              skip: () => ({
                limit: (lim) => {
                  limitArg = lim;
                  return {
                    lean: async () => [mockJob1],
                  };
                },
              }),
            }),
          };
        },
      });
      Job.countDocuments = async () => 1;

      try {
        const res = await searchJobs({ prioritizeFresher: true });
        assert.equal(selectArg, SEARCH_JOBS_PROJECTION);
        assert.equal(limitArg, CANDIDATE_WINDOW_LIMIT);
        assert.equal(CANDIDATE_WINDOW_LIMIT, 100);
        assert.equal(res.jobs.length, 1);
      } finally {
        Job.find = origJobFind;
        Job.countDocuments = origCount;
      }
    });

    test('prewarmActiveJobsCatalog pre-warms catalog asynchronously without throwing errors', async () => {
      let dbCalls = 0;
      const origJobFind = Job.find;
      Job.find = () => {
        dbCalls++;
        return {
          select: () => ({
            lean: async () => [mockJob1, mockJob2],
          }),
        };
      };

      try {
        const jobs = await prewarmActiveJobsCatalog();
        assert.equal(dbCalls, 1);
        assert.equal(jobs.length, 2);
        assert.equal(getActiveJobsCatalogStatus().isCached, true);
        assert.equal(getActiveJobsCatalogStatus().count, 2);
      } finally {
        Job.find = origJobFind;
        invalidateActiveJobsCache({ reset: true });
      }
    });

    test('stale-while-revalidate serves last known-good catalog immediately and triggers background refresh', async () => {
      let dbCalls = 0;
      const origJobFind = Job.find;

      // 1. Initial population with mockJob1
      Job.find = () => {
        dbCalls++;
        return {
          select: () => ({
            lean: async () => [mockJob1],
          }),
        };
      };

      try {
        const initial = await fetchActiveJobsCatalog();
        assert.equal(dbCalls, 1);
        assert.equal(initial.length, 1);

        // 2. Mark cache stale (simulate expiry or post-sync)
        invalidateActiveJobsCache({ reset: false });
        assert.equal(getActiveJobsCatalogStatus().isStale, true);

        // Update Job.find to return newly synced mockJob1 + mockJob2
        Job.find = () => {
          dbCalls++;
          return {
            select: () => ({
              lean: async () => [mockJob1, mockJob2],
            }),
          };
        };

        // 3. Stale-while-revalidate: immediate return of stale known-good data
        const servedStale = await fetchActiveJobsCatalog();
        assert.equal(servedStale.length, 1, 'Must serve last known-good catalog immediately');
        assert.equal(servedStale[0].title, mockJob1.title);

        // Allow background revalidation to settle
        await new Promise((resolve) => setTimeout(resolve, 30));

        // 4. Verify background refresh completed and updated cache
        assert.equal(dbCalls, 2);
        const revalidated = getCachedActiveJobs();
        assert.equal(revalidated.length, 2, 'Cache must reflect revalidated listings after background refresh');
      } finally {
        Job.find = origJobFind;
        invalidateActiveJobsCache({ reset: true });
      }
    });

    test('refresh failure preserves last known-good catalog and does not wipe cache', async () => {
      const origJobFind = Job.find;

      // 1. Initial population with valid catalog
      Job.find = () => ({
        select: () => ({
          lean: async () => [mockJob1],
        }),
      });

      try {
        const initial = await fetchActiveJobsCatalog();
        assert.equal(initial.length, 1);

        // 2. Mock a catastrophic database failure during refresh
        Job.find = () => ({
          select: () => ({
            lean: async () => {
              throw new Error('Atlas cluster connection timeout');
            },
          }),
        });

        // 3. Force refresh should safely return last known-good catalog
        const fallback = await refreshActiveJobsCatalog();
        assert.equal(fallback.length, 1);
        assert.equal(fallback[0].title, mockJob1.title);
        assert.equal(getCachedActiveJobs()?.length, 1, 'Valid cache must NOT be wiped on refresh error');
      } finally {
        Job.find = origJobFind;
        invalidateActiveJobsCache({ reset: true });
      }
    });

    test('concurrent refreshes share a single in-flight database promise', async () => {
      let dbCalls = 0;
      const origJobFind = Job.find;
      Job.find = () => {
        dbCalls++;
        return {
          select: () => ({
            lean: async () => {
              await new Promise((resolve) => setTimeout(resolve, 20));
              return [mockJob1, mockJob2];
            },
          }),
        };
      };

      try {
        // Trigger 5 concurrent requests simultaneously on a cold cache
        const results = await Promise.all([
          fetchActiveJobsCatalog(),
          fetchActiveJobsCatalog(),
          fetchActiveJobsCatalog(),
          fetchActiveJobsCatalog(),
          fetchActiveJobsCatalog(),
        ]);

        assert.equal(dbCalls, 1, 'All parallel callers must coalesce into exactly 1 database retrieval');
        for (const res of results) {
          assert.equal(res.length, 2);
        }
      } finally {
        Job.find = origJobFind;
        invalidateActiveJobsCache({ reset: true });
      }
    });

    test('invalidateActiveJobsCache with refreshInBackground triggers background revalidation', async () => {
      let dbCalls = 0;
      const origJobFind = Job.find;
      Job.find = () => {
        dbCalls++;
        return {
          select: () => ({
            lean: async () => [mockJob1, mockJob2],
          }),
        };
      };

      try {
        // Initial catalog
        await fetchActiveJobsCatalog();
        assert.equal(dbCalls, 1);

        // Post-sync invalidation
        invalidateActiveJobsCache({ refreshInBackground: true });
        await new Promise((resolve) => setTimeout(resolve, 30));

        assert.equal(dbCalls, 2);
        assert.equal(getCachedActiveJobs()?.length, 2);
      } finally {
        Job.find = origJobFind;
        invalidateActiveJobsCache({ reset: true });
      }
    });
  });
});
