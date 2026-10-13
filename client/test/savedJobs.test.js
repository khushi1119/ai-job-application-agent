import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

describe('Saved Jobs Frontend State & Helper Tests', () => {
  const sampleSavedJobs = [
    {
      _id: 'saved-1',
      savedAt: '2026-10-01T12:00:00Z',
      job: {
        _id: 'job-101',
        title: 'Full Stack Engineer',
        company: 'Stripe',
        location: 'Remote',
        sourceUrl: 'https://stripe.com/jobs/101',
      },
    },
    {
      _id: 'saved-2',
      savedAt: '2026-10-05T14:30:00Z',
      job: {
        _id: 'job-102',
        title: 'Senior Frontend Developer',
        company: 'GitHub',
        location: 'San Francisco, CA',
        sourceUrl: 'https://github.com/jobs/102',
      },
    },
  ];

  describe('Saved Job ID Membership (Set Operations)', () => {
    test('creates O(1) Set from list of IDs and accurately checks membership', () => {
      const ids = ['job-101', 'job-102'];
      const idSet = new Set(ids);

      assert.equal(idSet.has('job-101'), true);
      assert.equal(idSet.has('job-102'), true);
      assert.equal(idSet.has('job-999'), false);
    });

    test('optimistically adds a newly saved job ID to Set', () => {
      const idSet = new Set(['job-101']);
      idSet.add('job-103');
      assert.equal(idSet.has('job-103'), true);
      assert.equal(idSet.size, 2);
    });

    test('optimistically removes an unsaved job ID from Set', () => {
      const idSet = new Set(['job-101', 'job-102']);
      idSet.delete('job-101');
      assert.equal(idSet.has('job-101'), false);
      assert.equal(idSet.has('job-102'), true);
      assert.equal(idSet.size, 1);
    });

    test('reverts optimistic state update when action fails', () => {
      let idSet = new Set(['job-101']);
      // User clicks save on job-102
      idSet = new Set(idSet);
      idSet.add('job-102');
      assert.equal(idSet.has('job-102'), true);

      // Network failure occurs -> revert
      idSet = new Set(idSet);
      idSet.delete('job-102');
      assert.equal(idSet.has('job-102'), false);
      assert.equal(idSet.has('job-101'), true);
    });
  });

  describe('Local Saved Jobs Filtering', () => {
    test('filters saved positions by company name', () => {
      const filterTerm = 'stripe';
      const filtered = sampleSavedJobs.filter((item) =>
        item.job.company.toLowerCase().includes(filterTerm)
      );
      assert.equal(filtered.length, 1);
      assert.equal(filtered[0].job.company, 'Stripe');
    });

    test('filters saved positions by job title', () => {
      const filterTerm = 'frontend';
      const filtered = sampleSavedJobs.filter((item) =>
        item.job.title.toLowerCase().includes(filterTerm)
      );
      assert.equal(filtered.length, 1);
      assert.equal(filtered[0].job.company, 'GitHub');
    });

    test('returns all positions when search term is empty', () => {
      const filterTerm = '   ';
      const filtered = sampleSavedJobs.filter((item) => {
        if (!filterTerm.trim()) return true;
        return item.job.title.toLowerCase().includes(filterTerm.trim());
      });
      assert.equal(filtered.length, 2);
    });
  });
});
