import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  isIndiaOrEligibleRemote,
  getSeniorityTier,
  SENIORITY_TIERS,
} from '../src/utils/jobMatchingFilters.js';

describe('Job Matching Filters & Seniority Classification Tests', () => {
  describe('isIndiaOrEligibleRemote', () => {
    test('returns true for explicit India locations', () => {
      assert.equal(isIndiaOrEligibleRemote({ location: 'Bengaluru, India' }), true);
      assert.equal(isIndiaOrEligibleRemote({ location: 'Hyderabad, Telangana' }), true);
      assert.equal(isIndiaOrEligibleRemote({ location: 'Pune, Maharashtra' }), true);
      assert.equal(isIndiaOrEligibleRemote({ location: 'Mumbai' }), true);
      assert.equal(isIndiaOrEligibleRemote({ location: 'Noida / Delhi NCR' }), true);
      assert.equal(isIndiaOrEligibleRemote({ location: 'Remote India' }), true);
    });

    test('returns true when title specifies India even if location is general', () => {
      assert.equal(
        isIndiaOrEligibleRemote({
          title: 'Account Executive (Bengaluru, India)',
          location: 'Hybrid',
        }),
        true
      );
    });

    test('returns true for open worldwide remote roles', () => {
      assert.equal(
        isIndiaOrEligibleRemote({
          location: 'Remote',
          description: 'We are a distributed team hiring worldwide.',
        }),
        true
      );
      assert.equal(
        isIndiaOrEligibleRemote({
          location: 'Distributed',
          description: 'Global team, flexible hours.',
        }),
        true
      );
    });

    test('excludes clearly foreign-only on-site and hybrid locations', () => {
      assert.equal(isIndiaOrEligibleRemote({ location: 'London, England' }), false);
      assert.equal(isIndiaOrEligibleRemote({ location: 'San Francisco Bay Area' }), false);
      assert.equal(isIndiaOrEligibleRemote({ location: 'New York, NY' }), false);
      assert.equal(isIndiaOrEligibleRemote({ location: 'Berlin, Germany' }), false);
      assert.equal(isIndiaOrEligibleRemote({ location: 'Austin, TX, United States' }), false);
      assert.equal(isIndiaOrEligibleRemote({ location: 'Sydney, Australia' }), false);
      assert.equal(isIndiaOrEligibleRemote({ location: 'Tokyo, Japan' }), false);
      assert.equal(isIndiaOrEligibleRemote({ location: 'Paris, France' }), false);
    });

    test('returns true for legitimate India-remote and global roles', () => {
      assert.equal(isIndiaOrEligibleRemote({ location: 'Remote India' }), true);
      assert.equal(isIndiaOrEligibleRemote({ location: 'India (Remote)' }), true);
      assert.equal(isIndiaOrEligibleRemote({ location: 'Remote - India' }), true);
      assert.equal(isIndiaOrEligibleRemote({ location: 'Bengaluru, India (Remote)' }), true);
      assert.equal(isIndiaOrEligibleRemote({ location: 'Work From Anywhere' }), true);
      assert.equal(isIndiaOrEligibleRemote({ location: 'Worldwide' }), true);
      assert.equal(isIndiaOrEligibleRemote({ location: 'Global (Remote)' }), true);
    });

    test('excludes Sentry Vienna, Austria roles even if isRemote is true or location has (Remote)', () => {
      // Sentry internship & new grad roles reported in audit
      assert.equal(
        isIndiaOrEligibleRemote({
          title: 'Software Engineer, Intern (Summer 2027)',
          company: 'Sentry',
          location: 'Vienna, Austria (Remote)',
        }),
        false
      );
      assert.equal(
        isIndiaOrEligibleRemote({
          title: 'Software Engineer, New Grad (2027)',
          company: 'Sentry',
          location: 'Vienna, Austria',
          isRemote: true,
        }),
        false
      );
      assert.equal(
        isIndiaOrEligibleRemote({
          title: 'Software Engineer, Intern',
          company: 'Sentry',
          location: 'Vienna, Austria',
        }),
        false
      );
      assert.equal(
        isIndiaOrEligibleRemote({
          title: 'Backend Engineer',
          company: 'Sentry',
          location: 'Austria (Remote)',
          isRemote: true,
        }),
        false
      );
      assert.equal(
        isIndiaOrEligibleRemote({
          title: 'Full Stack Engineer',
          company: 'Sentry',
          location: 'Remote - Vienna, Austria',
        }),
        false
      );
    });

    test('excludes foreign-restricted remote postings and foreign regions', () => {
      assert.equal(isIndiaOrEligibleRemote({ location: 'Remote (U.S.)' }), false);
      assert.equal(isIndiaOrEligibleRemote({ location: 'Remote (US)' }), false);
      assert.equal(isIndiaOrEligibleRemote({ location: 'Remote (UK)' }), false);
      assert.equal(isIndiaOrEligibleRemote({ location: 'Remote (EU)' }), false);
      assert.equal(isIndiaOrEligibleRemote({ location: 'Remote (West Coast)' }), false);
      assert.equal(isIndiaOrEligibleRemote({ location: 'San Francisco Bay Area (or Remote U.S.)' }), false);
      assert.equal(
        isIndiaOrEligibleRemote({
          location: 'Remote',
          description: 'Must be located in the United States. US citizenship required.',
        }),
        false
      );
      assert.equal(
        isIndiaOrEligibleRemote({
          location: 'Remote',
          description: 'Role based in Austria. Must reside in Austria or Germany.',
        }),
        false
      );
    });

    test('conservatively excludes ambiguous on-site or hybrid roles without country', () => {
      assert.equal(isIndiaOrEligibleRemote({ location: 'In-Office' }), false);
      assert.equal(isIndiaOrEligibleRemote({ location: 'Hybrid' }), false);
      assert.equal(isIndiaOrEligibleRemote({ location: 'Hybrid; In-Office' }), false);
      assert.equal(isIndiaOrEligibleRemote({ location: '' }), false);
      assert.equal(isIndiaOrEligibleRemote(null), false);
    });
  });

  describe('getSeniorityTier', () => {
    test('classifies internships and co-ops as Tier 1 (Student/Entry)', () => {
      assert.equal(
        getSeniorityTier({ title: 'Software Engineer Intern' }),
        SENIORITY_TIERS.TIER_1_STUDENT_ENTRY
      );
      assert.equal(
        getSeniorityTier({ title: 'Frontend Developer Internship' }),
        SENIORITY_TIERS.TIER_1_STUDENT_ENTRY
      );
      assert.equal(
        getSeniorityTier({ title: 'Co-op Software Developer' }),
        SENIORITY_TIERS.TIER_1_STUDENT_ENTRY
      );
      assert.equal(
        getSeniorityTier({ title: 'Engineering Trainee' }),
        SENIORITY_TIERS.TIER_1_STUDENT_ENTRY
      );
    });

    test('classifies graduate, fresher, and junior roles as Tier 1', () => {
      assert.equal(
        getSeniorityTier({ title: 'Graduate Software Engineer' }),
        SENIORITY_TIERS.TIER_1_STUDENT_ENTRY
      );
      assert.equal(
        getSeniorityTier({ title: 'Junior Frontend Developer' }),
        SENIORITY_TIERS.TIER_1_STUDENT_ENTRY
      );
      assert.equal(
        getSeniorityTier({ title: 'Entry-Level Software Engineer' }),
        SENIORITY_TIERS.TIER_1_STUDENT_ENTRY
      );
      assert.equal(
        getSeniorityTier({ title: 'Associate Engineer' }),
        SENIORITY_TIERS.TIER_1_STUDENT_ENTRY
      );
      assert.equal(
        getSeniorityTier({
          title: 'Software Developer',
          description: 'No prior experience required. Freshers welcome with 0-1 years of experience.',
        }),
        SENIORITY_TIERS.TIER_1_STUDENT_ENTRY
      );
    });

    test('classifies standard engineering roles as Tier 2 (Mid-Level IC) and does NOT default them to entry-level', () => {
      assert.equal(
        getSeniorityTier({ title: 'Software Engineer' }),
        SENIORITY_TIERS.TIER_2_MID_LEVEL_IC
      );
      assert.equal(
        getSeniorityTier({ title: 'Full Stack Developer' }),
        SENIORITY_TIERS.TIER_2_MID_LEVEL_IC
      );
      assert.equal(
        getSeniorityTier({ title: 'Data Scientist' }),
        SENIORITY_TIERS.TIER_2_MID_LEVEL_IC
      );
    });

    test('classifies senior, staff, lead, and architect roles as Tier 3', () => {
      assert.equal(
        getSeniorityTier({ title: 'Senior Software Engineer' }),
        SENIORITY_TIERS.TIER_3_SENIOR_LEAD
      );
      assert.equal(
        getSeniorityTier({ title: 'Staff Systems Engineer' }),
        SENIORITY_TIERS.TIER_3_SENIOR_LEAD
      );
      assert.equal(
        getSeniorityTier({ title: 'Lead Frontend Developer' }),
        SENIORITY_TIERS.TIER_3_SENIOR_LEAD
      );
      assert.equal(
        getSeniorityTier({ title: 'Principal Architect' }),
        SENIORITY_TIERS.TIER_3_SENIOR_LEAD
      );
    });

    test('classifies management, director, and VP roles as Tier 4', () => {
      assert.equal(
        getSeniorityTier({ title: 'Engineering Manager' }),
        SENIORITY_TIERS.TIER_4_LEADERSHIP
      );
      assert.equal(
        getSeniorityTier({ title: 'Director of Engineering' }),
        SENIORITY_TIERS.TIER_4_LEADERSHIP
      );
      assert.equal(
        getSeniorityTier({ title: 'VP of Technology' }),
        SENIORITY_TIERS.TIER_4_LEADERSHIP
      );
      assert.equal(
        getSeniorityTier({ title: 'Director of Internship Program' }),
        SENIORITY_TIERS.TIER_4_LEADERSHIP
      );
    });
  });
});
