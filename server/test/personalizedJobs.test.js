import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import {
  CAREER_DOMAINS,
  DOMAIN_LABELS,
  classifyJobDomain,
  detectCandidateDomain,
  isCandidateStudentOrFresher,
  getDomainTitleRegex,
} from '../src/utils/careerDomainClassifier.js';
import {
  getSeniorityTier,
  getSeniorityLabel,
  SENIORITY_TIERS,
} from '../src/utils/jobMatchingFilters.js';
import { searchJobs } from '../src/services/jobService.js';
import { getJobs } from '../src/controllers/jobController.js';
import { getDomainAffinity } from '../src/services/recommendationService.js';
import Profile from '../src/models/Profile.js';
import Resume from '../src/models/Resume.js';
import Job from '../src/models/Job.js';
import User from '../src/models/User.js';

describe('Resume-Based Personalized Job Discovery Tests', () => {
  const userIdTech = new mongoose.Types.ObjectId('607f1f77bcf86cd799439001');
  const userIdBba = new mongoose.Types.ObjectId('607f1f77bcf86cd799439002');
  const userIdBcom = new mongoose.Types.ObjectId('607f1f77bcf86cd799439003');
  const userIdCrossDomain = new mongoose.Types.ObjectId('607f1f77bcf86cd799439004');
  const userIdEmpty = new mongoose.Types.ObjectId('607f1f77bcf86cd799439005');

  // --- 1. Career Domain Classifier Tests ---
  describe('detectCandidateDomain explainable classifier', () => {
    test('Technical profile receives tech domain by default', () => {
      const profile = {
        education: [{ degree: 'B.Tech', fieldOfStudy: 'Computer Science and Engineering' }],
        skills: ['JavaScript', 'React', 'Node.js', 'MongoDB', 'Python'],
        projects: [{ title: 'E-commerce Platform', technologies: ['React', 'Node.js'] }],
      };
      const detection = detectCandidateDomain(profile);
      assert.equal(detection.domain, CAREER_DOMAINS.TECH);
      assert.equal(detection.label, DOMAIN_LABELS.tech);
      assert.equal(detection.isAmbiguous, false);
      assert.ok(detection.scores.tech > 10);
      assert.ok(detection.evidenceSummary.includes('Software & IT'));
    });

    test('BBA profile receives business domain by default', () => {
      const profile = {
        education: [{ degree: 'BBA', fieldOfStudy: 'Business Administration' }],
        skills: ['Operations Management', 'Project Management', 'Agile', 'Strategy'],
        experience: [{ role: 'Operations Associate' }],
      };
      const detection = detectCandidateDomain(profile);
      assert.equal(detection.domain, CAREER_DOMAINS.BUSINESS);
      assert.equal(detection.label, DOMAIN_LABELS.business);
      assert.equal(detection.isAmbiguous, false);
      assert.ok(detection.evidenceSummary.includes('Business & Management'));
    });

    test('B.Com profile receives finance domain by default', () => {
      const profile = {
        education: [{ degree: 'B.Com', fieldOfStudy: 'Accounting and Finance' }],
        skills: ['Financial Accounting', 'Taxation', 'Tally', 'Auditing'],
      };
      const detection = detectCandidateDomain(profile);
      assert.equal(detection.domain, CAREER_DOMAINS.FINANCE);
      assert.equal(detection.label, DOMAIN_LABELS.finance);
      assert.equal(detection.isAmbiguous, false);
      assert.ok(detection.evidenceSummary.includes('Finance & Commerce'));
    });

    test('Non-technical degree with strong programming skills discovers technical jobs', () => {
      const profile = {
        education: [{ degree: 'B.Com', fieldOfStudy: 'General Commerce' }],
        skills: ['JavaScript', 'TypeScript', 'React', 'Node.js', 'Express', 'MongoDB', 'Python'],
        projects: [
          { title: 'Full Stack App', technologies: ['React', 'Node.js', 'MongoDB'] },
          { title: 'API Server', technologies: ['Express', 'Docker'] },
        ],
      };
      const detection = detectCandidateDomain(profile);
      // Skills & projects give 7*3 + 2*2 + 2*2 = 29 tech points vs 5 finance points
      assert.equal(detection.domain, CAREER_DOMAINS.TECH);
      assert.equal(detection.label, DOMAIN_LABELS.tech);
      assert.ok(detection.scores.tech > detection.scores.finance);
      assert.ok(detection.evidenceSummary.includes('Software & IT'));
    });

    test('Ambiguous or empty profiles can use All Domains or choose a category', () => {
      const emptyDetection = detectCandidateDomain(null, null);
      assert.equal(emptyDetection.domain, CAREER_DOMAINS.ALL);
      assert.equal(emptyDetection.isAmbiguous, true);

      const sparseProfile = { skills: [], education: [] };
      const sparseDetection = detectCandidateDomain(sparseProfile);
      assert.equal(sparseDetection.domain, CAREER_DOMAINS.ALL);
      assert.equal(sparseDetection.isAmbiguous, true);
    });
  });

  // --- 2. Job Listing Domain Classifier Tests ---
  describe('classifyJobDomain on job listings', () => {
    test('correctly identifies technical jobs', () => {
      assert.equal(classifyJobDomain({ title: 'Software Engineer Intern' }), CAREER_DOMAINS.TECH);
      assert.equal(classifyJobDomain({ title: 'Frontend Developer (React)' }), CAREER_DOMAINS.TECH);
      assert.equal(classifyJobDomain({ title: 'Junior QA Engineer' }), CAREER_DOMAINS.TECH);
      assert.equal(classifyJobDomain({ title: 'DevOps Engineer' }), CAREER_DOMAINS.TECH);
    });

    test('correctly identifies data & analytics jobs', () => {
      assert.equal(classifyJobDomain({ title: 'Data Scientist' }), CAREER_DOMAINS.DATA);
      assert.equal(classifyJobDomain({ title: 'Machine Learning Engineer' }), CAREER_DOMAINS.DATA);
      assert.equal(classifyJobDomain({ title: 'Business Intelligence Analyst' }), CAREER_DOMAINS.DATA);
    });

    test('correctly identifies finance & commerce jobs', () => {
      assert.equal(classifyJobDomain({ title: 'Staff Accountant' }), CAREER_DOMAINS.FINANCE);
      assert.equal(classifyJobDomain({ title: 'Tax Analyst' }), CAREER_DOMAINS.FINANCE);
      assert.equal(classifyJobDomain({ title: 'Internal Audit Associate' }), CAREER_DOMAINS.FINANCE);
    });

    test('correctly identifies business & management jobs', () => {
      assert.equal(classifyJobDomain({ title: 'Operations Associate' }), CAREER_DOMAINS.BUSINESS);
      assert.equal(classifyJobDomain({ title: 'Associate Product Manager' }), CAREER_DOMAINS.BUSINESS);
      assert.equal(classifyJobDomain({ title: 'Account Executive' }), CAREER_DOMAINS.BUSINESS);
    });

    test('correctly identifies marketing & hr jobs', () => {
      assert.equal(classifyJobDomain({ title: 'Talent Acquisition Coordinator' }), CAREER_DOMAINS.MARKETING_HR);
      assert.equal(classifyJobDomain({ title: 'Content Marketing Specialist' }), CAREER_DOMAINS.MARKETING_HR);
      assert.equal(classifyJobDomain({ title: 'People Operations Specialist' }), CAREER_DOMAINS.MARKETING_HR);
    });

    test('regression: Web Graphic Designer classifies as marketing_hr, NOT tech', () => {
      const domain = classifyJobDomain({
        title: 'Web Graphic Designer',
        description: 'Design banners, visual brand assets, and creative layouts in Photoshop and Illustrator',
      });
      assert.equal(domain, CAREER_DOMAINS.MARKETING_HR);
      assert.notEqual(domain, CAREER_DOMAINS.TECH);
    });

    test('regression: Graphic Designer & Illustrator classifies as marketing_hr, NOT tech', () => {
      const domain = classifyJobDomain({
        title: 'Graphic Designer & Illustrator',
        description: 'Create illustrations, vector graphics, and visual design assets',
      });
      assert.equal(domain, CAREER_DOMAINS.MARKETING_HR);
      assert.notEqual(domain, CAREER_DOMAINS.TECH);
    });

    test('regression: Area Collection Manager - Lending Collections (Frontend) classifies as finance, NOT tech', () => {
      const domain = classifyJobDomain({
        title: 'Area Collection Manager - Manager - Lending Collections (Frontend)',
        description: 'Managing end-to-end collections across bucket segments, driving recovery performance and field visits',
      });
      assert.equal(domain, CAREER_DOMAINS.FINANCE);
      assert.notEqual(domain, CAREER_DOMAINS.TECH);
    });

    test('regression: Senior AI Data Operations Manager classifies as business, NOT tech', () => {
      const domain = classifyJobDomain({
        title: 'Senior AI Data Operations Manager',
        description: 'Manage operations team, track KPI delivery, lead vendor and stakeholder coordination',
      });
      assert.equal(domain, CAREER_DOMAINS.BUSINESS);
      assert.notEqual(domain, CAREER_DOMAINS.TECH);
    });

    test('regression: genuine software and engineering roles classify as tech', () => {
      assert.equal(classifyJobDomain({ title: 'Full Stack Developer' }), CAREER_DOMAINS.TECH);
      assert.equal(classifyJobDomain({ title: 'React Frontend Developer' }), CAREER_DOMAINS.TECH);
      assert.equal(classifyJobDomain({ title: 'Backend Node Engineer' }), CAREER_DOMAINS.TECH);
      assert.equal(classifyJobDomain({ title: 'DevOps Engineer' }), CAREER_DOMAINS.TECH);
      assert.equal(classifyJobDomain({ title: 'QA / SDET Engineer' }), CAREER_DOMAINS.TECH);
      assert.equal(
        classifyJobDomain({ title: 'Staff AI Platform Engineer - Inference & Agentic Systems' }),
        CAREER_DOMAINS.TECH
      );
    });

    test('regression: Senior technical roles are technical but separate from fresher suitability', () => {
      const seniorAi = {
        title: 'Senior AI Engineer',
        location: 'Toronto, Canada',
      };
      const staffAi = {
        title: 'Staff AI Platform Engineer - Inference & Agentic Systems',
        location: 'Toronto, Canada',
      };
      const internTech = {
        title: 'React Frontend Intern',
        location: 'Bangalore, India',
      };

      // Domain classification: senior technical roles remain technical
      const seniorAiDomain = classifyJobDomain(seniorAi);
      assert.ok(seniorAiDomain === CAREER_DOMAINS.DATA || seniorAiDomain === CAREER_DOMAINS.TECH);
      assert.equal(classifyJobDomain(staffAi), CAREER_DOMAINS.TECH);
      assert.equal(classifyJobDomain(internTech), CAREER_DOMAINS.TECH);

      // Seniority tier & label separation
      assert.equal(getSeniorityTier(seniorAi), SENIORITY_TIERS.TIER_3_SENIOR_LEAD);
      assert.equal(getSeniorityLabel(SENIORITY_TIERS.TIER_3_SENIOR_LEAD), 'Senior / Staff');

      assert.equal(getSeniorityTier(staffAi), SENIORITY_TIERS.TIER_3_SENIOR_LEAD);
      assert.equal(getSeniorityLabel(SENIORITY_TIERS.TIER_3_SENIOR_LEAD), 'Senior / Staff');

      assert.equal(getSeniorityTier(internTech), SENIORITY_TIERS.TIER_1_STUDENT_ENTRY);
      assert.equal(getSeniorityLabel(SENIORITY_TIERS.TIER_1_STUDENT_ENTRY), 'Intern / Entry-level');
    });
  });

  // --- 3. Domain Title Regex for MongoDB queries ---
  describe('getDomainTitleRegex', () => {
    test('tech regex matches software and IT variations', () => {
      const regex = getDomainTitleRegex('tech');
      assert.ok(regex.test('Software Engineer'));
      assert.ok(regex.test('Frontend Developer'));
      assert.ok(regex.test('MERN Stack Developer'));
      assert.ok(regex.test('QA Engineer'));
      assert.ok(regex.test('Machine Learning Engineer'));
      assert.equal(regex.test('Pastry Chef'), false);
    });

    test('regression: getDomainTitleRegex tech excludes problem roles while matching genuine roles', () => {
      const regex = getDomainTitleRegex('tech');
      // Excluded
      assert.equal(regex.test('Web Graphic Designer'), false);
      assert.equal(regex.test('Graphic Designer & Illustrator'), false);
      assert.equal(regex.test('Area Collection Manager - Manager - Lending Collections (Frontend)'), false);
      assert.equal(regex.test('Senior AI Data Operations Manager'), false);
      assert.equal(regex.test('Delinquency Recovery Manager'), false);

      // Matched
      assert.ok(regex.test('Software Engineer'));
      assert.ok(regex.test('Full Stack Developer'));
      assert.ok(regex.test('Frontend Developer (React)'));
      assert.ok(regex.test('Backend Engineer'));
      assert.ok(regex.test('QA Engineer'));
      assert.ok(regex.test('DevOps Engineer'));
      assert.ok(regex.test('Senior AI Engineer'));
      assert.ok(regex.test('Staff AI Platform Engineer - Inference & Agentic Systems'));
    });

    test('finance regex matches accounting and finance titles', () => {
      const regex = getDomainTitleRegex('finance');
      assert.ok(regex.test('Financial Analyst'));
      assert.ok(regex.test('Senior Accountant'));
      assert.ok(regex.test('Tax Specialist'));
      assert.equal(regex.test('Full Stack Developer'), false);
    });

    test('all returns null so no restrictive filter is applied', () => {
      assert.equal(getDomainTitleRegex('all'), null);
    });
  });

  // --- 4. Fresher / Student Detection ---
  describe('isCandidateStudentOrFresher helper', () => {
    test('returns true for student with 0 experience', () => {
      assert.equal(isCandidateStudentOrFresher({ experience: [] }), true);
      assert.equal(isCandidateStudentOrFresher(null), true);
    });

    test('returns true for student with currently active degree', () => {
      const profile = {
        education: [{ degree: 'B.Tech', current: true }],
        experience: [{ role: 'Developer', startDate: new Date('2023-01-01') }],
      };
      assert.equal(isCandidateStudentOrFresher(profile), true);
    });

    test('returns false for candidate with 5+ years of senior experience', () => {
      const profile = {
        education: [{ degree: 'B.Tech', current: false }],
        experience: [
          {
            role: 'Senior Software Engineer',
            startDate: new Date('2018-01-01'),
            endDate: new Date('2024-01-01'),
          },
        ],
      };
      assert.equal(isCandidateStudentOrFresher(profile), false);
    });
  });

  // --- 5. searchJobs domain filtering ---
  describe('searchJobs domain filtering in jobService', () => {
    const mockJobsCatalog = [
      { _id: new mongoose.Types.ObjectId(), title: 'Software Engineer', platform: 'greenhouse' },
      { _id: new mongoose.Types.ObjectId(), title: 'Senior Frontend Developer', platform: 'lever' },
      { _id: new mongoose.Types.ObjectId(), title: 'Tax Accountant', platform: 'ashby' },
      { _id: new mongoose.Types.ObjectId(), title: 'Associate Product Manager', platform: 'ashby' },
    ];

    test('filters queries by requested domain in MongoDB query', async () => {
      const origFind = Job.find;
      const origCount = Job.countDocuments;
      let capturedQuery = null;

      Job.find = (query) => {
        capturedQuery = query;
        return {
          sort: () => ({
            skip: () => ({
              limit: () => ({
                lean: async () => [mockJobsCatalog[0], mockJobsCatalog[1]],
              }),
            }),
          }),
        };
      };
      Job.countDocuments = async () => 2;

      try {
        const result = await searchJobs({ domain: 'tech', page: 1, limit: 10 });
        assert.ok(capturedQuery.title instanceof RegExp);
        assert.ok(capturedQuery.title.test('Software Engineer'));
        assert.equal(capturedQuery.title.test('Tax Accountant'), false);
        assert.equal(result.jobs.length, 2);
      } finally {
        Job.find = origFind;
        Job.countDocuments = origCount;
      }
    });

    test('domain: all does not add domain title restriction', async () => {
      const origFind = Job.find;
      const origCount = Job.countDocuments;
      let capturedQuery = null;

      Job.find = (query) => {
        capturedQuery = query;
        return {
          sort: () => ({
            skip: () => ({
              limit: () => ({
                lean: async () => mockJobsCatalog,
              }),
            }),
          }),
        };
      };
      Job.countDocuments = async () => 4;

      try {
        const result = await searchJobs({ domain: 'all' });
        assert.equal(capturedQuery.title, undefined);
        assert.equal(result.jobs.length, 4);
      } finally {
        Job.find = origFind;
        Job.countDocuments = origCount;
      }
    });

    test('regression: searchJobs annotates jobs with seniority metadata and prioritizes freshers', async () => {
      const mockPool = [
        { _id: new mongoose.Types.ObjectId(), title: 'Staff AI Platform Engineer', location: 'Toronto, Canada', createdAt: new Date('2026-10-12') },
        { _id: new mongoose.Types.ObjectId(), title: 'Software Engineer Intern', location: 'Bangalore, India', createdAt: new Date('2026-10-10') },
        { _id: new mongoose.Types.ObjectId(), title: 'Frontend Developer', location: 'Bangalore, India', createdAt: new Date('2026-10-11') },
      ];

      const origFind = Job.find;
      const origCount = Job.countDocuments;

      Job.find = () => ({
        sort: () => ({
          skip: () => ({
            limit: () => ({
              lean: async () => mockPool,
            }),
          }),
        }),
      });
      Job.countDocuments = async () => 3;

      try {
        const result = await searchJobs({ domain: 'tech', prioritizeFresher: true, page: 1, limit: 10 });
        assert.equal(result.jobs.length, 3);
        // Entry-level intern is prioritized to the top
        assert.equal(result.jobs[0].title, 'Software Engineer Intern');
        assert.equal(result.jobs[0].seniorityTier, 1);
        assert.equal(result.jobs[0].seniorityLabel, 'Intern / Entry-level');
        assert.equal(result.jobs[0].isEntryLevel, true);

        // Mid-level developer is next
        assert.equal(result.jobs[1].title, 'Frontend Developer');
        assert.equal(result.jobs[1].seniorityTier, 2);
        assert.equal(result.jobs[1].seniorityLabel, 'Mid-level');

        // Staff engineer is still present and discoverable (not silently deleted)
        assert.equal(result.jobs[2].title, 'Staff AI Platform Engineer');
        assert.equal(result.jobs[2].seniorityTier, 3);
        assert.equal(result.jobs[2].seniorityLabel, 'Senior / Staff');
      } finally {
        Job.find = origFind;
        Job.countDocuments = origCount;
      }
    });
  });

  // --- 6. getJobs Controller Personalization & User Isolation ---
  describe('getJobs HTTP Controller Personalization & Security', () => {
    test('Personalizes search to tech domain for technical candidate', async () => {
      const origUserFindOne = User.findOne;
      const origProfileFindOne = Profile.findOne;
      const origResumeFindOne = Resume.findOne;
      const origJobFind = Job.find;
      const origJobCount = Job.countDocuments;

      User.findOne = async () => ({
        _id: userIdTech,
        firebaseUid: 'mock-tech-uid',
        email: 'tech@example.com',
        name: 'Tech Candidate',
        authProvider: 'password',
        save: async () => {},
      });

      Profile.findOne = (query) => ({
        lean: async () => ({
          userId: userIdTech,
          education: [{ degree: 'B.Tech', fieldOfStudy: 'Computer Science' }],
          skills: ['React', 'Node.js', 'Python'],
        }),
      });
      Resume.findOne = () => ({ sort: () => ({ lean: async () => null }) });

      Job.find = () => ({
        sort: () => ({
          skip: () => ({
            limit: () => ({
              lean: async () => [{ title: 'Frontend Developer' }],
            }),
          }),
        }),
      });
      Job.countDocuments = async () => 1;

      const req = {
        user: { uid: 'mock-tech-uid', email: 'tech@example.com' },
        query: {}, // No domain specified -> auto-detect
      };

      let statusCode = null;
      let responsePayload = null;
      const res = {
        status: (code) => {
          statusCode = code;
          return res;
        },
        json: (payload) => {
          responsePayload = payload;
          return res;
        },
      };

      try {
        await getJobs(req, res);
        assert.equal(statusCode, 200);
        assert.equal(responsePayload.data.personalization.detectedDomain, 'tech');
        assert.equal(responsePayload.data.personalization.activeDomain, 'tech');
        assert.equal(responsePayload.data.personalization.isPersonalized, true);
        assert.ok(responsePayload.data.personalization.evidenceSummary.includes('Software & IT'));
      } finally {
        User.findOne = origUserFindOne;
        Profile.findOne = origProfileFindOne;
        Resume.findOne = origResumeFindOne;
        Job.find = origJobFind;
        Job.countDocuments = origJobCount;
      }
    });

    test('Allows user to override detected domain to "all"', async () => {
      const origUserFindOne = User.findOne;
      const origProfileFindOne = Profile.findOne;
      const origResumeFindOne = Resume.findOne;
      const origJobFind = Job.find;
      const origJobCount = Job.countDocuments;

      User.findOne = async () => ({
        _id: userIdTech,
        firebaseUid: 'mock-tech-uid',
        email: 'tech@example.com',
        name: 'Tech Candidate',
        authProvider: 'password',
        save: async () => {},
      });

      Profile.findOne = () => ({
        lean: async () => ({
          userId: userIdTech,
          education: [{ degree: 'B.Tech', fieldOfStudy: 'Computer Science' }],
          skills: ['React', 'Node.js'],
        }),
      });
      Resume.findOne = () => ({ sort: () => ({ lean: async () => null }) });

      Job.find = () => ({
        sort: () => ({
          skip: () => ({
            limit: () => ({
              lean: async () => [{ title: 'Accountant' }, { title: 'Developer' }],
            }),
          }),
        }),
      });
      Job.countDocuments = async () => 2;

      const req = {
        user: { uid: 'mock-tech-uid', email: 'tech@example.com' },
        query: { domain: 'all' }, // User explicitly asks for All Domains
      };

      let statusCode = null;
      let responsePayload = null;
      const res = {
        status: (code) => {
          statusCode = code;
          return res;
        },
        json: (payload) => {
          responsePayload = payload;
          return res;
        },
      };

      try {
        await getJobs(req, res);
        assert.equal(statusCode, 200);
        assert.equal(responsePayload.data.personalization.activeDomain, 'all');
        assert.equal(responsePayload.data.personalization.isPersonalized, false);
      } finally {
        User.findOne = origUserFindOne;
        Profile.findOne = origProfileFindOne;
        Resume.findOne = origResumeFindOne;
        Job.find = origJobFind;
        Job.countDocuments = origJobCount;
      }
    });

    test('User isolation: does not accept arbitrary userId in query param', async () => {
      const origUserFindOne = User.findOne;
      const origProfileFindOne = Profile.findOne;
      const origResumeFindOne = Resume.findOne;
      const origJobFind = Job.find;
      const origJobCount = Job.countDocuments;

      User.findOne = async () => ({
        _id: userIdTech,
        firebaseUid: 'my-actual-uid',
        email: 'actual@example.com',
        name: 'Actual User',
        authProvider: 'password',
        save: async () => {},
      });

      let capturedUserIdInQuery = null;
      Profile.findOne = (query) => {
        capturedUserIdInQuery = query.userId;
        return {
          lean: async () => ({
            userId: userIdTech,
            skills: ['React'],
          }),
        };
      };
      Resume.findOne = () => ({ sort: () => ({ lean: async () => null }) });

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

      const req = {
        user: { uid: 'my-actual-uid', email: 'actual@example.com' },
        query: { userId: 'attacker-arbitrary-id' }, // Attacker tries to inject another user's ID
      };

      const res = {
        status: () => res,
        json: () => res,
      };

      try {
        await getJobs(req, res);
        // Captured query must NOT match the attacker's query param
        assert.notEqual(capturedUserIdInQuery?.toString(), 'attacker-arbitrary-id');
        assert.equal(capturedUserIdInQuery?.toString(), userIdTech.toString());
      } finally {
        User.findOne = origUserFindOne;
        Profile.findOne = origProfileFindOne;
        Resume.findOne = origResumeFindOne;
        Job.find = origJobFind;
        Job.countDocuments = origJobCount;
      }
    });
  });

  // --- 7. Domain Affinity in Recommendation Service ---
  describe('Domain affinity ranking logic', () => {
    test('domain affinity levels correctly prioritize matching and adjacent domains', () => {
      // Tech candidate
      assert.equal(getDomainAffinity('tech', 'tech'), 0); // Exact match
      assert.equal(getDomainAffinity('tech', 'data'), 1); // Adjacent
      assert.equal(getDomainAffinity('tech', 'finance'), 2); // Unaligned
      assert.equal(getDomainAffinity('tech', 'marketing_hr'), 2); // Unaligned

      // Business candidate
      assert.equal(getDomainAffinity('business', 'business'), 0);
      assert.equal(getDomainAffinity('business', 'finance'), 1);
      assert.equal(getDomainAffinity('business', 'tech'), 2);

      // Unconstrained / all candidate
      assert.equal(getDomainAffinity('all', 'tech'), 0);
      assert.equal(getDomainAffinity('all', 'finance'), 0);
    });
  });
});
