import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseFlexibleDate,
  sanitizeExperience,
  sanitizeEducation,
  sanitizeCertifications,
  sanitizeProjects,
  isValidObjectId,
  calculateCompletionPercentage,
} from '../src/services/profileService.js';
import Profile from '../src/models/Profile.js';
import mongoose from 'mongoose';

describe('Profile Update & Date Sanitization Regression Tests', () => {
  describe('isValidObjectId helper', () => {
    test('identifies valid 24-char hex ObjectIds and BSON ObjectIDs', () => {
      assert.equal(isValidObjectId('6ab8c24a25507ec0ffac01b0'), true);
      assert.equal(isValidObjectId(new mongoose.Types.ObjectId()), true);
      assert.equal(isValidObjectId(''), false);
      assert.equal(isValidObjectId(null), false);
      assert.equal(isValidObjectId(undefined), false);
      assert.equal(isValidObjectId('invalid-id'), false);
    });
  });

  describe('parseFlexibleDate parser', () => {
    test('correctly identifies ongoing/present markers', () => {
      const markers = ['Present', 'present', 'PRESENT', 'Current', 'current', 'ongoing', 'Now', 'Till Date', 'To Date'];
      for (const m of markers) {
        const res = parseFlexibleDate(m);
        assert.equal(res.isPresent, true, `Expected ${m} to be recognized as isPresent`);
        assert.equal(res.date, null, `Expected ${m} date to be null`);
      }
    });

    test('parses 4-digit years into valid Date objects', () => {
      const res = parseFlexibleDate('2024');
      assert.equal(res.isPresent, false);
      assert.ok(res.date instanceof Date);
      assert.equal(res.date.getFullYear(), 2024);
    });

    test('parses Month Year strings like "Jan 2023"', () => {
      const res = parseFlexibleDate('Jan 2023');
      assert.equal(res.isPresent, false);
      assert.ok(res.date instanceof Date);
      assert.equal(res.date.getFullYear(), 2023);
    });

    test('parses ISO date strings like "2023-05-15"', () => {
      const res = parseFlexibleDate('2023-05-15');
      assert.equal(res.isPresent, false);
      assert.ok(res.date instanceof Date);
      assert.equal(res.date.toISOString().startsWith('2023-05-15'), true);
    });

    test('parses "Expected 2027" without throwing', () => {
      const res = parseFlexibleDate('Expected 2027');
      assert.equal(res.isPresent, false);
      assert.ok(res.date instanceof Date);
      assert.equal(res.date.getFullYear(), 2027);
    });

    test('safely falls back to null for non-date strings or empty values', () => {
      const nonDates = ['', '   ', 'Lifetime', 'N/A', 'None', null, undefined];
      for (const val of nonDates) {
        const res = parseFlexibleDate(val);
        assert.equal(res.date, null, `Expected ${val} to result in null date`);
        assert.equal(res.isPresent, false);
      }
    });
  });

  describe('Subdocument sanitizers', () => {
    test('sanitizeExperience converts "Present" endDate to current: true and null endDate', () => {
      const input = [
        {
          _id: '',
          company: 'Acme Corp',
          role: 'Frontend Developer',
          location: 'Remote',
          startDate: 'Jan 2024',
          endDate: 'Present',
          highlights: ['Built UI components', ''],
          technologies: ['React', ''],
        },
      ];

      const result = sanitizeExperience(input);
      assert.equal(result.length, 1);
      assert.equal(result[0]._id, undefined, 'Empty string _id should be stripped');
      assert.equal(result[0].current, true, 'current should be true when endDate is Present');
      assert.equal(result[0].endDate, null, 'endDate should be null when current');
      assert.ok(result[0].startDate instanceof Date);
      assert.deepEqual(result[0].highlights, ['Built UI components']);
      assert.deepEqual(result[0].technologies, ['React']);
    });

    test('sanitizeEducation preserves valid dates and removes empty _id', () => {
      const input = [
        {
          _id: '',
          institution: 'State University',
          degree: 'B.S. Computer Science',
          startDate: '2020',
          endDate: '2024',
          current: false,
        },
      ];

      const result = sanitizeEducation(input);
      assert.equal(result.length, 1);
      assert.equal(result[0]._id, undefined);
      assert.ok(result[0].startDate instanceof Date);
      assert.ok(result[0].endDate instanceof Date);
      assert.equal(result[0].current, false);
    });

    test('sanitizeCertifications maps "Lifetime" or empty dates to null without throwing', () => {
      const input = [
        {
          _id: '6ab8d88d0ad6a504975c780f',
          name: 'AWS Cloud Practitioner',
          issuer: 'Amazon Web Services',
          issueDate: '2023',
          expiryDate: 'Lifetime',
        },
      ];

      const result = sanitizeCertifications(input);
      assert.equal(result.length, 1);
      assert.equal(result[0]._id, '6ab8d88d0ad6a504975c780f', 'Valid ObjectId should be preserved');
      assert.ok(result[0].issueDate instanceof Date);
      assert.equal(result[0].expiryDate, null, 'Non-date string should map to null');
    });
  });

  describe('Mongoose Document Validation with Sanitized Payloads', () => {
    test('Profile document validates without errors when experience contains "Present"', () => {
      const rawPayload = {
        userId: new mongoose.Types.ObjectId(),
        personal: {
          name: 'Jane Doe',
          email: 'jane@example.com',
          phone: '+1 555-0199',
          location: 'San Francisco, CA',
        },
        summary: 'Experienced full stack software engineer with 5 years in Node and React.',
        skills: ['JavaScript', 'React', 'Node.js'],
        experience: sanitizeExperience([
          {
            _id: '',
            company: 'Tech Corp',
            role: 'Software Engineer',
            location: 'Remote',
            startDate: 'Jan 2024',
            endDate: 'Present',
          },
        ]),
        education: sanitizeEducation([
          {
            _id: '',
            institution: 'MIT',
            degree: 'BS',
            fieldOfStudy: 'CS',
            startDate: '2019',
            endDate: '2023',
          },
        ]),
        projects: sanitizeProjects([
          {
            _id: '',
            title: 'Job Agent',
            description: 'AI platform',
            technologies: ['React', 'Node.js'],
          },
        ]),
        certifications: sanitizeCertifications([
          {
            _id: '',
            name: 'AWS Solutions Architect',
            issuer: 'AWS',
            issueDate: '2023',
            expiryDate: 'Never',
          },
        ]),
      };

      const doc = new Profile(rawPayload);
      const validationError = doc.validateSync();
      assert.equal(
        validationError,
        undefined,
        `Mongoose validation should succeed, but got: ${validationError?.message}`
      );
      assert.equal(calculateCompletionPercentage(rawPayload), 100);
    });
  });
});
