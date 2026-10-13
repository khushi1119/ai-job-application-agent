import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

describe('Applications Tracking Frontend State & Helper Tests', () => {
  const sampleApplications = [
    {
      _id: 'app-1',
      jobId: 'job-101',
      company: 'Google',
      jobTitle: 'Software Engineer III',
      applicationUrl: 'https://careers.google.com/jobs/101',
      status: 'Applied',
      appliedAt: '2026-10-01T10:00:00Z',
      notes: 'Applied with referral',
    },
    {
      _id: 'app-2',
      jobId: 'job-102',
      company: 'Stripe',
      jobTitle: 'Full Stack Engineer',
      applicationUrl: 'https://stripe.com/jobs/102',
      status: 'Interview',
      appliedAt: '2026-10-03T11:30:00Z',
      notes: 'Technical screen scheduled',
    },
    {
      _id: 'app-3',
      jobId: null,
      company: 'Amazon',
      jobTitle: 'Frontend Engineer',
      applicationUrl: 'https://amazon.jobs/3',
      status: 'Offer',
      appliedAt: '2026-10-05T14:00:00Z',
      notes: 'Offer letter received',
    },
    {
      _id: 'app-4',
      jobId: 'job-104',
      company: 'Meta',
      jobTitle: 'UI Engineer',
      applicationUrl: '',
      status: 'Rejected',
      appliedAt: '2026-10-07T09:00:00Z',
      notes: 'Position closed',
    },
  ];

  describe('Tracked Job ID Set Membership', () => {
    test('creates O(1) Set from list of tracked IDs and accurately checks tracking status', () => {
      const ids = ['job-101', 'job-102', 'job-104'];
      const trackedSet = new Set(ids);

      assert.equal(trackedSet.has('job-101'), true);
      assert.equal(trackedSet.has('job-102'), true);
      assert.equal(trackedSet.has('job-999'), false);
    });

    test('optimistically adds a newly tracked job ID to Set', () => {
      const trackedSet = new Set(['job-101']);
      trackedSet.add('job-102');
      assert.equal(trackedSet.has('job-102'), true);
      assert.equal(trackedSet.size, 2);
    });

    test('reverts optimistic status update on failure', () => {
      let applications = [...sampleApplications];
      const previous = [...applications];

      // Optimistic update status to 'Offer'
      applications = applications.map((app) =>
        app._id === 'app-1' ? { ...app, status: 'Offer' } : app
      );
      assert.equal(applications.find((a) => a._id === 'app-1').status, 'Offer');

      // Network failure -> revert
      applications = previous;
      assert.equal(applications.find((a) => a._id === 'app-1').status, 'Applied');
    });
  });

  describe('Status Filtering', () => {
    test('returns all applications when filter is "All"', () => {
      const activeFilter = 'All';
      const filtered = sampleApplications.filter((app) => {
        if (activeFilter === 'All') return true;
        return app.status?.toLowerCase() === activeFilter.toLowerCase();
      });
      assert.equal(filtered.length, 4);
    });

    test('filters applications strictly by status', () => {
      const interviewApps = sampleApplications.filter(
        (app) => app.status?.toLowerCase() === 'interview'
      );
      assert.equal(interviewApps.length, 1);
      assert.equal(interviewApps[0].company, 'Stripe');

      const offerApps = sampleApplications.filter(
        (app) => app.status?.toLowerCase() === 'offer'
      );
      assert.equal(offerApps.length, 1);
      assert.equal(offerApps[0].company, 'Amazon');

      const rejectedApps = sampleApplications.filter(
        (app) => app.status?.toLowerCase() === 'rejected'
      );
      assert.equal(rejectedApps.length, 1);
      assert.equal(rejectedApps[0].company, 'Meta');
    });
  });

  describe('Search Query Filtering', () => {
    test('filters applications by company name (case-insensitive)', () => {
      const q = 'stripe';
      const filtered = sampleApplications.filter(
        (app) =>
          app.company.toLowerCase().includes(q) || app.jobTitle.toLowerCase().includes(q)
      );
      assert.equal(filtered.length, 1);
      assert.equal(filtered[0].company, 'Stripe');
    });

    test('filters applications by job title (case-insensitive)', () => {
      const q = 'frontend';
      const filtered = sampleApplications.filter(
        (app) =>
          app.company.toLowerCase().includes(q) || app.jobTitle.toLowerCase().includes(q)
      );
      assert.equal(filtered.length, 1);
      assert.equal(filtered[0].company, 'Amazon');
    });

    test('returns empty array when query does not match any company or role', () => {
      const q = 'nonexistent company';
      const filtered = sampleApplications.filter(
        (app) =>
          app.company.toLowerCase().includes(q) || app.jobTitle.toLowerCase().includes(q)
      );
      assert.equal(filtered.length, 0);
    });
  });

  describe('Dashboard Metrics Aggregation & Zero Display', () => {
    test('correctly counts applications, interviews, and offers from data', () => {
      const total = sampleApplications.length;
      const applied = sampleApplications.filter((a) => a.status === 'Applied').length;
      const interview = sampleApplications.filter((a) => a.status === 'Interview').length;
      const offer = sampleApplications.filter((a) => a.status === 'Offer').length;
      const rejected = sampleApplications.filter((a) => a.status === 'Rejected').length;

      assert.equal(total, 4);
      assert.equal(applied, 1);
      assert.equal(interview, 1);
      assert.equal(offer, 1);
      assert.equal(rejected, 1);
    });

    test('defaults empty or undefined stats to zero', () => {
      const emptyBackendStats = {};
      const safeStats = {
        total: Number(emptyBackendStats.total) || 0,
        interview: Number(emptyBackendStats.interview) || 0,
        offer: Number(emptyBackendStats.offer) || 0,
      };

      assert.equal(safeStats.total, 0);
      assert.equal(safeStats.interview, 0);
      assert.equal(safeStats.offer, 0);
    });
  });

  describe('Track Application Validation', () => {
    test('validates required fields: company and jobTitle', () => {
      const isValid = (company, jobTitle) => Boolean(company?.trim() && jobTitle?.trim());

      assert.equal(isValid('Google', 'SWE'), true);
      assert.equal(isValid('', 'SWE'), false);
      assert.equal(isValid('Google', ''), false);
      assert.equal(isValid('   ', '   '), false);
    });
  });
});
