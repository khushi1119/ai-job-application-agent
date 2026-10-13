import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  isRemoteJob,
  isFullTimeJob,
  isInternshipJob,
  isEntryOrMidLevelJob,
  filterJobsByPills,
} from '../src/utils/jobFilters.js';
import { formatJobFreshness } from '../src/utils/helpers.js';

describe('Job Filter Utilities (jobFilters.js)', () => {
  const sampleJobs = [
    {
      title: 'Senior Software Engineer',
      company: 'GitHub',
      location: 'Remote',
      description: 'Join GitHub as a Senior Software Engineer. 100% remote position.',
      requirements: ['React', 'TypeScript', 'Node.js'],
      platform: 'greenhouse',
      sourceUrl: 'https://boards.greenhouse.io/github/jobs/1',
    },
    {
      title: 'Junior Frontend Developer',
      company: 'Cloudflare',
      location: 'San Francisco, CA',
      description: 'Full-time junior developer role building customer-facing UI.',
      requirements: ['JavaScript', 'HTML', 'CSS'],
      platform: 'lever',
      sourceUrl: 'https://jobs.lever.co/cloudflare/2',
    },
    {
      title: 'Summer Engineering Intern',
      company: 'Datadog',
      location: 'Remote - US',
      description: 'Summer internship program for university students.',
      requirements: ['Python', 'Algorithms'],
      platform: 'greenhouse',
      sourceUrl: 'https://boards.greenhouse.io/datadog/jobs/3',
    },
    {
      title: 'Staff Platform Architect',
      company: 'Stripe',
      location: 'Seattle, WA',
      description: 'Full-time principal role leading cloud infrastructure.',
      requirements: ['Kubernetes', 'Go', 'AWS'],
      platform: 'lever',
      sourceUrl: 'https://jobs.lever.co/stripe/4',
    },
    {
      title: 'Associate Product Designer',
      company: 'Figma',
      location: 'Remote, Europe',
      description: 'Design digital experiences for collaboration tools.',
      requirements: ['Figma', 'Prototyping'],
      platform: 'greenhouse',
      sourceUrl: 'https://boards.greenhouse.io/figma/jobs/5',
    },
  ];

  describe('isRemoteJob', () => {
    test('identifies remote roles from location', () => {
      assert.equal(isRemoteJob({ location: 'Remote' }), true);
      assert.equal(isRemoteJob({ location: 'Remote - US' }), true);
      assert.equal(isRemoteJob({ location: 'San Francisco, CA (Remote Friendly)' }), true);
      assert.equal(isRemoteJob({ location: 'New York, NY' }), false);
    });

    test('identifies remote roles from title or description fallback', () => {
      assert.equal(isRemoteJob({ location: '', title: 'Remote React Developer' }), true);
      assert.equal(isRemoteJob({ location: 'Austin, TX', description: 'This is a 100% remote position.' }), true);
      assert.equal(isRemoteJob({ location: 'Austin, TX', description: 'On-site 5 days a week.' }), false);
    });

    test('handles null or empty job safely', () => {
      assert.equal(isRemoteJob(null), false);
      assert.equal(isRemoteJob({}), false);
    });
  });

  describe('isFullTimeJob', () => {
    test('identifies full-time roles and rejects internships/part-time', () => {
      assert.equal(isFullTimeJob({ title: 'Software Engineer', description: 'Full-time position' }), true);
      assert.equal(isFullTimeJob({ title: 'Summer Intern - Engineering', description: 'Full-time' }), false);
      assert.equal(isFullTimeJob({ title: 'Part-Time Web Developer' }), false);
    });

    test('defaults permanent corporate postings to full-time if not intern', () => {
      assert.equal(isFullTimeJob({ title: 'Backend Developer', description: 'Build APIs' }), true);
    });

    test('handles null or empty job safely', () => {
      assert.equal(isFullTimeJob(null), false);
      assert.equal(isFullTimeJob({}), false);
    });
  });

  describe('isInternshipJob', () => {
    test('identifies internships and co-ops accurately', () => {
      assert.equal(isInternshipJob({ title: 'Software Engineering Intern' }), true);
      assert.equal(isInternshipJob({ title: 'Summer 2026 Internship' }), true);
      assert.equal(isInternshipJob({ title: 'Co-op Developer' }), true);
      assert.equal(isInternshipJob({ title: 'Senior Software Engineer' }), false);
    });

    test('handles null safely', () => {
      assert.equal(isInternshipJob(null), false);
    });
  });

  describe('isEntryOrMidLevelJob', () => {
    test('accepts junior, associate, and individual contributor roles', () => {
      assert.equal(isEntryOrMidLevelJob({ title: 'Junior Frontend Developer' }), true);
      assert.equal(isEntryOrMidLevelJob({ title: 'Associate Product Designer' }), true);
      assert.equal(isEntryOrMidLevelJob({ title: 'Software Engineer' }), true);
      assert.equal(isEntryOrMidLevelJob({ title: 'Mid-Level React Engineer' }), true);
    });

    test('excludes senior, staff, lead, and executive titles', () => {
      assert.equal(isEntryOrMidLevelJob({ title: 'Senior Software Engineer' }), false);
      assert.equal(isEntryOrMidLevelJob({ title: 'Staff Platform Architect' }), false);
      assert.equal(isEntryOrMidLevelJob({ title: 'Lead Fullstack Developer' }), false);
      assert.equal(isEntryOrMidLevelJob({ title: 'Director of Engineering' }), false);
      assert.equal(isEntryOrMidLevelJob({ title: 'VP of Product' }), false);
    });
  });

  describe('filterJobsByPills', () => {
    test('returns all jobs when no filters are active', () => {
      const result = filterJobsByPills(sampleJobs, {
        remote: false,
        fullTime: false,
        internship: false,
        experience: false,
      });
      assert.equal(result.length, 5);
    });

    test('filters exclusively for remote jobs when remote pill is active', () => {
      const result = filterJobsByPills(sampleJobs, { remote: true });
      assert.equal(result.length, 3);
      assert.ok(result.every((j) => isRemoteJob(j)));
    });

    test('filters exclusively for internship roles', () => {
      const result = filterJobsByPills(sampleJobs, { internship: true });
      assert.equal(result.length, 1);
      assert.equal(result[0].company, 'Datadog');
    });

    test('filters for entry/mid-level roles excluding senior positions', () => {
      const result = filterJobsByPills(sampleJobs, { experience: true });
      // GitHub is Senior, Stripe is Staff -> 3 remaining (Cloudflare, Datadog, Figma)
      assert.equal(result.length, 3);
      assert.ok(!result.some((j) => j.title.includes('Senior') || j.title.includes('Staff')));
    });

    test('combines multiple active filters simultaneously (AND logic)', () => {
      const result = filterJobsByPills(sampleJobs, {
        remote: true,
        experience: true,
      });
      // Remote AND entry/mid: Datadog (Intern) & Figma (Associate Product Designer)
      assert.equal(result.length, 2);
      assert.ok(result.some((j) => j.company === 'Datadog'));
      assert.ok(result.some((j) => j.company === 'Figma'));
    });

    test('handles empty or malformed inputs safely', () => {
      assert.deepEqual(filterJobsByPills(null), []);
      assert.deepEqual(filterJobsByPills([]), []);
    });
  });

  describe('formatJobFreshness (Freshness Indicator)', () => {
    test('returns null for null, undefined, or empty timestamps (never labels unverified jobs)', () => {
      assert.equal(formatJobFreshness(null), null);
      assert.equal(formatJobFreshness(undefined), null);
      assert.equal(formatJobFreshness(''), null);
      assert.equal(formatJobFreshness('invalid-date'), null);
    });

    test('returns "Verified today" for jobs verified within the past 24 hours', () => {
      const now = new Date();
      assert.equal(formatJobFreshness(now.toISOString()), 'Verified today');

      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
      assert.equal(formatJobFreshness(twoHoursAgo.toISOString()), 'Verified today');
    });

    test('returns "Verified 1d ago" for jobs verified 24-48 hours ago', () => {
      const oneDayAgo = new Date(Date.now() - 25 * 60 * 60 * 1000);
      assert.equal(formatJobFreshness(oneDayAgo.toISOString()), 'Verified 1d ago');
    });

    test('returns "Verified 3d ago" for jobs verified 3 days ago', () => {
      const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
      assert.equal(formatJobFreshness(threeDaysAgo.toISOString()), 'Verified 3d ago');
    });

    test('returns "Verified 1w ago" for jobs verified 7 days ago', () => {
      const oneWeekAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);
      assert.equal(formatJobFreshness(oneWeekAgo.toISOString()), 'Verified 1w ago');
    });
  });
});
