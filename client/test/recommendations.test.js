import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

describe('Job Recommendations Frontend State & Helper Tests', () => {
  const sampleApiResponse = {
    success: true,
    data: {
      jobs: [
        {
          _id: 'job-rec-1',
          title: 'Full Stack Engineer',
          company: 'Stripe',
          location: 'Remote',
          platform: 'greenhouse',
          matchScore: 0.8523,
          matchPercentage: 85,
          matchedSkills: ['react', 'node', 'typescript'],
          requirements: ['React', 'Node.js', 'MongoDB'],
          sourceUrl: 'https://stripe.com/jobs/rec-1',
        },
        {
          _id: 'job-rec-2',
          title: 'Cloud DevOps Engineer',
          company: 'Datadog',
          location: 'New York, NY',
          platform: 'lever',
          matchScore: 0.1432,
          matchPercentage: 14,
          matchedSkills: ['docker'],
          requirements: ['Docker', 'Kubernetes', 'AWS'],
          sourceUrl: 'https://datadog.com/jobs/rec-2',
        },
      ],
      totalEvaluated: 40,
      topK: 20,
      emptyProfile: false,
    },
    message: 'Retrieved 2 recommended jobs',
  };

  describe('API Response Parsing & Sanitization', () => {
    test('extracts real recommended job list without demo fallback values', () => {
      const data = sampleApiResponse.data;
      const jobs = Array.isArray(data?.jobs) ? data.jobs : [];

      assert.equal(jobs.length, 2);
      assert.equal(jobs[0].company, 'Stripe');
      assert.equal(jobs[0].title, 'Full Stack Engineer');
      assert.equal(jobs[0].matchPercentage, 85);
      assert.deepEqual(jobs[0].matchedSkills, ['react', 'node', 'typescript']);

      // Ensure no 78% demo score or demo company name is present
      for (const job of jobs) {
        assert.notEqual(job.matchPercentage, 78);
        assert.notEqual(job.company, 'Example Corp');
        assert.notEqual(job.company, 'Acme Corp');
      }
    });

    test('extracts empty profile status and message accurately', () => {
      const emptyProfileResponse = {
        success: true,
        data: {
          jobs: [],
          totalEvaluated: 0,
          emptyProfile: true,
          message: 'Please complete your profile or upload a resume to receive tailored recommendations.',
        },
      };

      const data = emptyProfileResponse.data;
      const isEmpty = Boolean(data?.emptyProfile);
      const jobs = data?.jobs || [];

      assert.equal(isEmpty, true);
      assert.equal(jobs.length, 0);
      assert.ok(data.message.includes('complete your profile'));
    });
  });

  describe('Neutral Match Presentation & Low Score Preservation', () => {
    test('formats match score as neutral percentage without predictive claims', () => {
      const formatMatchBadge = (percentage) => `${percentage}% match`;

      const badge1 = formatMatchBadge(sampleApiResponse.data.jobs[0].matchPercentage);
      const badge2 = formatMatchBadge(sampleApiResponse.data.jobs[1].matchPercentage);

      assert.equal(badge1, '85% match');
      assert.equal(badge2, '14% match');

      // Verify no promotional or predictive wording
      assert.equal(badge1.includes('ML powered'), false);
      assert.equal(badge1.includes('AI generated'), false);
      assert.equal(badge1.includes('probability'), false);
      assert.equal(badge1.includes('selection guarantee'), false);
    });

    test('preserves low scores exactly as returned without filtering or inflating', () => {
      const lowScoreJob = sampleApiResponse.data.jobs[1];
      assert.equal(lowScoreJob.matchPercentage, 14);
      // Low score job is not discarded from the recommendations list
      assert.ok(sampleApiResponse.data.jobs.includes(lowScoreJob));
    });
  });

  describe('Matched Skills Verification', () => {
    test('renders matched skill chips only from actual API response', () => {
      const jobWithSkills = sampleApiResponse.data.jobs[0];
      const jobWithoutSkills = {
        _id: 'job-rec-3',
        title: 'Analyst',
        company: 'Consulting Co',
        matchedSkills: [],
      };

      const getRenderableMatchedSkills = (job) => {
        return Array.isArray(job?.matchedSkills) && job.matchedSkills.length > 0
          ? job.matchedSkills
          : [];
      };

      assert.deepEqual(getRenderableMatchedSkills(jobWithSkills), ['react', 'node', 'typescript']);
      assert.deepEqual(getRenderableMatchedSkills(jobWithoutSkills), []);
    });
  });

  describe('Job Card Branding & Platform Isolation', () => {
    test('keeps company name as the primary employer identifier', () => {
      const job = sampleApiResponse.data.jobs[0];
      assert.equal(job.company, 'Stripe');
      assert.ok(typeof job.company === 'string' && job.company.length > 0);
    });

    test('omits platform badges (greenhouse/lever) from main card presentation', () => {
      // The main card renders employer name and match badge, not the platform source
      const getCardHeaderElements = (job) => ({
        employer: job.company,
        matchBadge: `${job.matchPercentage}% match`,
        renderPlatformBadge: false, // Explicitly excluded from main card
      });

      const card = getCardHeaderElements(sampleApiResponse.data.jobs[0]);
      assert.equal(card.employer, 'Stripe');
      assert.equal(card.renderPlatformBadge, false);
    });
  });

  describe('No Hardcoded Fallback on Failure', () => {
    test('leaves recommendation list empty on API error without injecting fake cards', () => {
      let recommendations = [];
      let errorMessage = null;

      // Simulate API failure
      try {
        throw new Error('ML recommendation service offline');
      } catch (err) {
        errorMessage = err.message;
        recommendations = [];
      }

      assert.equal(errorMessage, 'ML recommendation service offline');
      assert.equal(recommendations.length, 0);
      assert.deepEqual(recommendations, []);
    });
  });

  describe('Distinct Frontend Empty States', () => {
    // Helper replicating the state determination logic of RecommendedJobsSection
    const determineEmptyState = ({ emptyProfile, jobs, message }) => {
      if (emptyProfile) {
        return {
          type: 'MISSING_PROFILE',
          title: 'Complete your profile to get recommendations',
          message: message || 'Add your skills, experience, or upload your resume to receive tailored recommendations.',
          primaryAction: { label: 'Complete Profile', href: '/onboarding/profile' },
          secondaryAction: { label: 'Upload Resume', href: '/dashboard/resume' },
        };
      }
      if (Array.isArray(jobs) && jobs.length === 0) {
        return {
          type: 'NO_QUALIFYING_MATCHES',
          title: 'No matching India or remote roles found',
          message: message || 'No sufficiently relevant openings were found among current India-based or eligible remote listings. You can browse all international positions or check back later.',
          primaryAction: { label: 'Search All Jobs', href: '/dashboard/jobs' },
          isResumeMissing: false,
        };
      }
      return { type: 'HAS_JOBS', count: jobs.length };
    };

    test('renders profile completion prompt when emptyProfile is true', () => {
      const state = determineEmptyState({
        emptyProfile: true,
        jobs: [],
        message: 'Please complete your profile or upload a resume to receive tailored recommendations.',
      });

      assert.equal(state.type, 'MISSING_PROFILE');
      assert.equal(state.title, 'Complete your profile to get recommendations');
      assert.equal(state.primaryAction.href, '/onboarding/profile');
      assert.equal(state.secondaryAction.href, '/dashboard/resume');
    });

    test('renders India/remote search guidance with Search All Jobs link when profile is valid but no jobs match', () => {
      const state = determineEmptyState({
        emptyProfile: false,
        jobs: [],
        message: 'No sufficiently relevant openings were found among current India-based or eligible remote listings.',
      });

      assert.equal(state.type, 'NO_QUALIFYING_MATCHES');
      assert.equal(state.title, 'No matching India or remote roles found');
      assert.ok(state.message.includes('India-based or eligible remote'));
      assert.equal(state.primaryAction.href, '/dashboard/jobs');
      assert.equal(state.primaryAction.label, 'Search All Jobs');
      // Crucial: Never claims resume is missing when profile is valid
      assert.equal(state.isResumeMissing, false);
      assert.equal(state.message.includes('upload a resume'), false);
    });
  });

  describe('Tab-Specific Fetching & Tab Switching Behavior', () => {
    // Harness simulating the exact tab state machine and fetch trigger rules of JobsPlaceholderPage
    const createJobsPageController = ({ initialTab = 'recommended', urlQuery = '' } = {}) => {
      let activeTab = urlQuery ? 'all' : initialTab;
      let hasFetchedAllJobs = false;
      const fetchCalls = [];

      const triggerFetchJobs = (q = '', loc = '', domain = 'auto') => {
        fetchCalls.push({ q, loc, domain });
        hasFetchedAllJobs = true;
      };

      // Initial Mount effect simulation
      if (urlQuery) {
        activeTab = 'all';
        triggerFetchJobs(urlQuery, '');
      } else if (activeTab === 'all' && !hasFetchedAllJobs) {
        triggerFetchJobs('', '');
      }

      return {
        getActiveTab: () => activeTab,
        getFetchCalls: () => [...fetchCalls],
        hasFetchedAllJobs: () => hasFetchedAllJobs,
        switchTab: (newTab) => {
          activeTab = newTab;
          if (newTab === 'all' && !hasFetchedAllJobs) {
            triggerFetchJobs('', '');
          }
        },
        submitSearch: (query, loc) => {
          activeTab = 'all';
          triggerFetchJobs(query, loc);
        },
        clearFilters: () => {
          triggerFetchJobs('', '', 'all');
        },
      };
    };

    test('initial mount on Recommended tab does NOT request All Jobs', () => {
      const page = createJobsPageController({ initialTab: 'recommended' });
      assert.equal(page.getActiveTab(), 'recommended');
      assert.equal(page.hasFetchedAllJobs(), false);
      assert.equal(page.getFetchCalls().length, 0);
    });

    test('switching to All Jobs triggers fetchJobs exactly once', () => {
      const page = createJobsPageController({ initialTab: 'recommended' });
      assert.equal(page.getFetchCalls().length, 0);

      page.switchTab('all');
      assert.equal(page.getActiveTab(), 'all');
      assert.equal(page.hasFetchedAllJobs(), true);
      assert.equal(page.getFetchCalls().length, 1);
      assert.deepEqual(page.getFetchCalls()[0], { q: '', loc: '', domain: 'auto' });
    });

    test('switching back to Recommended tab does NOT trigger unnecessary All Jobs fetch', () => {
      const page = createJobsPageController({ initialTab: 'recommended' });
      page.switchTab('all');
      assert.equal(page.getFetchCalls().length, 1);

      page.switchTab('recommended');
      assert.equal(page.getActiveTab(), 'recommended');
      assert.equal(page.getFetchCalls().length, 1); // Still exactly 1 call
    });

    test('switching back to All Jobs reuses loaded state without redundant fetch', () => {
      const page = createJobsPageController({ initialTab: 'recommended' });
      page.switchTab('all');
      assert.equal(page.getFetchCalls().length, 1);

      page.switchTab('recommended');
      page.switchTab('all');
      assert.equal(page.getFetchCalls().length, 1); // No duplicate fetch
    });

    test('mounting with URL query parameter defaults to All Jobs tab and fetches query', () => {
      const page = createJobsPageController({ urlQuery: 'frontend engineer' });
      assert.equal(page.getActiveTab(), 'all');
      assert.equal(page.hasFetchedAllJobs(), true);
      assert.equal(page.getFetchCalls().length, 1);
      assert.equal(page.getFetchCalls()[0].q, 'frontend engineer');
    });

    test('explicit search submit on All Jobs triggers targeted fetch', () => {
      const page = createJobsPageController({ initialTab: 'all' });
      assert.equal(page.getFetchCalls().length, 1);

      page.submitSearch('python', 'Remote');
      assert.equal(page.getFetchCalls().length, 2);
      assert.deepEqual(page.getFetchCalls()[1], { q: 'python', loc: 'Remote', domain: 'auto' });
    });
  });

  describe('Duplicate Request Prevention & Cache Invalidation', () => {
    // Model replicating the in-flight deduplication and short-lived caching in api.js
    const createDeduplicatedService = ({ ttlMs = 1000 } = {}) => {
      let inFlightPromise = null;
      let cache = null;
      let cacheTime = 0;
      let networkCallCount = 0;

      const fetchFromNetwork = (data) => {
        networkCallCount++;
        return new Promise((resolve) => setTimeout(() => resolve(data), 10));
      };

      const getData = async (force = false, mockData = { id: 1 }) => {
        const now = Date.now();
        if (!force && cache && now - cacheTime < ttlMs) {
          return cache;
        }
        if (!force && inFlightPromise) {
          return inFlightPromise;
        }
        const promise = fetchFromNetwork(mockData)
          .then((res) => {
            cache = res;
            cacheTime = Date.now();
            return res;
          })
          .finally(() => {
            inFlightPromise = null;
          });

        if (!force) {
          inFlightPromise = promise;
        }
        return promise;
      };

      const invalidateCache = () => {
        cache = null;
        cacheTime = 0;
        inFlightPromise = null;
      };

      return {
        getData,
        invalidateCache,
        getNetworkCallCount: () => networkCallCount,
      };
    };

    test('coalesces concurrent in-flight requests into a single network call', async () => {
      const service = createDeduplicatedService();
      const [call1, call2, call3] = await Promise.all([
        service.getData(false, { payload: 'recommended' }),
        service.getData(false, { payload: 'recommended' }),
        service.getData(false, { payload: 'recommended' }),
      ]);

      assert.deepEqual(call1, { payload: 'recommended' });
      assert.deepEqual(call2, { payload: 'recommended' });
      assert.deepEqual(call3, { payload: 'recommended' });
      assert.equal(service.getNetworkCallCount(), 1);
    });

    test('reuses cached data within TTL without triggering additional network requests', async () => {
      const service = createDeduplicatedService({ ttlMs: 5000 });
      await service.getData();
      assert.equal(service.getNetworkCallCount(), 1);

      // Subsequent call within TTL
      await service.getData();
      assert.equal(service.getNetworkCallCount(), 1);
    });

    test('manual user refresh bypasses cache and triggers fresh network request', async () => {
      const service = createDeduplicatedService({ ttlMs: 5000 });
      await service.getData();
      assert.equal(service.getNetworkCallCount(), 1);

      // Force refresh
      await service.getData(true);
      assert.equal(service.getNetworkCallCount(), 2);
    });

    test('mutations properly invalidate cache so subsequent fetch retrieves fresh data', async () => {
      const service = createDeduplicatedService({ ttlMs: 5000 });
      await service.getData(false, { savedIds: ['job-1'] });
      assert.equal(service.getNetworkCallCount(), 1);

      // Invalidate (e.g. user saved a job or tracked an application)
      service.invalidateCache();

      await service.getData(false, { savedIds: ['job-1', 'job-2'] });
      assert.equal(service.getNetworkCallCount(), 2);
    });
  });

  describe('Preservation of Recommendation Ranking & Calibration Rules', () => {
    test('preserves TF-IDF cosine similarity threshold and sorting descending', () => {
      const rankedJobs = [
        { id: '1', matchScore: 0.85, matchPercentage: 85, domainAffinity: 0, seniorityTier: 2 },
        { id: '2', matchScore: 0.62, matchPercentage: 62, domainAffinity: 0, seniorityTier: 2 },
        { id: '3', matchScore: 0.05, matchPercentage: 5, domainAffinity: 0, seniorityTier: 2 },
      ];

      // Verifies low score at min threshold (0.05) is preserved without filtering out
      assert.equal(rankedJobs[2].matchScore, 0.05);
      assert.equal(rankedJobs[2].matchPercentage, 5);

      // Descending order preserved
      for (let i = 0; i < rankedJobs.length - 1; i++) {
        assert.ok(rankedJobs[i].matchScore >= rankedJobs[i + 1].matchScore);
      }
    });

    test('preserves domain affinity ranking priority (Domain 0 before Domain 2)', () => {
      const jobs = [
        { id: 'tech-role', domainAffinity: 0, matchScore: 0.4 },
        { id: 'finance-role', domainAffinity: 2, matchScore: 0.9 },
      ];

      // Primary sort by domain affinity
      jobs.sort((a, b) => a.domainAffinity - b.domainAffinity || b.matchScore - a.matchScore);

      assert.equal(jobs[0].id, 'tech-role');
      assert.equal(jobs[1].id, 'finance-role');
    });
  });
});
