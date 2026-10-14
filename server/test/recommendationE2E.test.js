import { test, describe, before, after, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import app from '../src/app.js';
import Profile from '../src/models/Profile.js';
import Resume from '../src/models/Resume.js';
import Job from '../src/models/Job.js';
import User from '../src/models/User.js';
import {
  prewarmPythonRecommender,
  invalidateActiveJobsCache,
} from '../src/services/recommendationService.js';

describe('End-to-End Recommendation Endpoint Tests (GET /api/jobs/recommended)', () => {
  let server;
  let port;
  let baseUrl;
  let origDevBypass;
  let origNodeEnv;

  before(async () => {
    origDevBypass = process.env.ALLOW_DEV_AUTH_BYPASS;
    origNodeEnv = process.env.NODE_ENV;
    process.env.ALLOW_DEV_AUTH_BYPASS = 'true';
    process.env.NODE_ENV = 'test';

    // Pre-warm Python ML subprocess
    await prewarmPythonRecommender();

    // Start ephemeral server
    server = app.listen(0);
    port = server.address().port;
    baseUrl = `http://127.0.0.1:${port}`;
  });

  after(async () => {
    if (origDevBypass !== undefined) process.env.ALLOW_DEV_AUTH_BYPASS = origDevBypass;
    else delete process.env.ALLOW_DEV_AUTH_BYPASS;

    if (origNodeEnv !== undefined) process.env.NODE_ENV = origNodeEnv;
    else delete process.env.NODE_ENV;

    if (server) {
      await new Promise((res) => server.close(res));
    }
  });

  beforeEach(() => {
    invalidateActiveJobsCache();
  });

  const testUserId = new mongoose.Types.ObjectId('607f1f77bcf86cd799439999');
  const reactJobId = new mongoose.Types.ObjectId('507f1f77bcf86cd799439991');
  const pythonJobId = new mongoose.Types.ObjectId('507f1f77bcf86cd799439992');
  const agriJobId = new mongoose.Types.ObjectId('507f1f77bcf86cd799439993');

  const mockReactJob = {
    _id: reactJobId,
    title: 'Frontend React Developer',
    company: 'Fintech Innovations',
    location: 'Bengaluru, India',
    description: 'Build enterprise interfaces using React, Next.js, TypeScript, Tailwind CSS, and RESTful APIs.',
    requirements: ['React', 'TypeScript', 'Tailwind CSS', 'Next.js'],
    status: 'discovered',
    isClosed: false,
  };

  const mockPythonJob = {
    _id: pythonJobId,
    title: 'Python Backend Engineer',
    company: 'Cloud Scale',
    location: 'Remote',
    description: 'Develop microservices using Python, Django, PostgreSQL, and Kubernetes.',
    requirements: ['Python', 'Django', 'PostgreSQL'],
    status: 'discovered',
    isClosed: false,
  };

  const mockAgriJob = {
    _id: agriJobId,
    title: 'Agricultural Sales Field Representative',
    company: 'Farm Supplies',
    location: 'Pune, India',
    description: 'Promote crop seeds and fertilizers to local farmers and rural cooperatives.',
    requirements: ['Sales', 'Negotiation'],
    status: 'discovered',
    isClosed: false,
  };

  test('1. Unauthorized request without Bearer token returns 401', async () => {
    const res = await fetch(`${baseUrl}/api/jobs/recommended`);
    assert.equal(res.status, 401);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.match(body.message, /Unauthorized/);
  });

  test('2. Authenticated user with empty profile returns 200 with emptyProfile: true', async () => {
    const origUserFindOne = User.findOne;
    const origProfileFindOne = Profile.findOne;
    const origResumeFindOne = Resume.findOne;

    User.findOne = async () => ({
      _id: testUserId,
      firebaseUid: 'e2e-empty-user',
      email: 'e2e-empty@example.com',
      save: async () => {},
    });
    Profile.findOne = () => ({ lean: async () => null });
    Resume.findOne = () => ({ sort: () => ({ lean: async () => null }) });

    try {
      const res = await fetch(`${baseUrl}/api/jobs/recommended`, {
        headers: {
          Authorization: 'Bearer demo-token-e2e-empty-user',
        },
      });

      assert.equal(res.status, 200);
      const body = await res.json();
      assert.equal(body.success, true);
      assert.equal(body.data.emptyProfile, true);
      assert.equal(body.data.jobs.length, 0);
    } finally {
      User.findOne = origUserFindOne;
      Profile.findOne = origProfileFindOne;
      Resume.findOne = origResumeFindOne;
    }
  });

  test('3. Full end-to-end pipeline: HTTP request spawns Python ML process and ranks React job #1', async () => {
    const origUserFindOne = User.findOne;
    const origProfileFindOne = Profile.findOne;
    const origResumeFindOne = Resume.findOne;
    const origJobFind = Job.find;

    User.findOne = async () => ({
      _id: testUserId,
      firebaseUid: 'e2e-react-dev',
      email: 'e2e-react@example.com',
      save: async () => {},
    });

    Profile.findOne = () => ({
      lean: async () => ({
        personal: { name: 'Priya Sharma', location: 'Bengaluru, India' },
        skills: ['React', 'TypeScript', 'Next.js', 'Tailwind CSS', 'Redux'],
        summary: 'Full Stack Frontend Engineer with experience building modern React and TypeScript web apps.',
        experience: [
          {
            role: 'Frontend Developer',
            company: 'Tech Innovators',
            technologies: ['React', 'TypeScript', 'REST APIs'],
            highlights: ['Built responsive dashboards with React and Tailwind CSS'],
          },
        ],
      }),
    });

    Resume.findOne = () => ({ sort: () => ({ lean: async () => null }) });

    Job.find = () => ({
      select: () => ({
        lean: async () => [mockReactJob, mockPythonJob, mockAgriJob],
      }),
    });

    try {
      const res = await fetch(`${baseUrl}/api/jobs/recommended?topK=5&minScore=0.05`, {
        headers: {
          Authorization: 'Bearer demo-token-e2e-react-dev',
        },
      });

      assert.equal(res.status, 200);
      const body = await res.json();

      assert.equal(body.success, true);
      assert.ok(Array.isArray(body.data.jobs));
      assert.ok(body.data.jobs.length >= 1, 'Must return matching jobs');

      // Top ranked job must be the React Developer position
      const topJob = body.data.jobs[0];
      assert.equal(topJob._id, reactJobId.toString());
      assert.equal(topJob.title, 'Frontend React Developer');
      assert.ok(topJob.matchScore > 0.15, `Match score ${topJob.matchScore} should be substantial`);
      assert.ok(topJob.matchPercentage >= 20, `Match percentage ${topJob.matchPercentage} should be >= 20%`);
      assert.ok(Array.isArray(topJob.matchedSkills));
      assert.ok(topJob.matchedSkills.includes('React'));

      // Unrelated agricultural sales job must be filtered out by minScore
      const jobIds = body.data.jobs.map((j) => j._id);
      assert.ok(!jobIds.includes(agriJobId.toString()), 'Agricultural sales job must be excluded');

      // Personalization domain classification must identify "tech"
      assert.equal(body.data.personalization.detectedDomain, 'tech');
    } finally {
      User.findOne = origUserFindOne;
      Profile.findOne = origProfileFindOne;
      Resume.findOne = origResumeFindOne;
      Job.find = origJobFind;
    }
  });
});
