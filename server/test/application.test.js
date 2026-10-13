import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import {
  VALID_STATUSES,
  normalizeStatus,
  createApplication,
  getApplications,
  getApplicationStats,
  getApplicationById,
  updateApplication,
  deleteApplication,
  getTrackedJobIds,
} from '../src/services/applicationService.js';
import {
  createApplicationHandler,
  getApplicationsHandler,
  getApplicationStatsHandler,
  getTrackedJobIdsHandler,
  getApplicationByIdHandler,
  updateApplicationHandler,
  deleteApplicationHandler,
} from '../src/controllers/applicationController.js';
import { Application } from '../src/models/Application.js';
import { Job } from '../src/models/Job.js';
import User from '../src/models/User.js';

describe('Application Tracking Service & Controller Backend Tests', () => {
  const userAId = new mongoose.Types.ObjectId('607f1f77bcf86cd799439001');
  const userBId = new mongoose.Types.ObjectId('607f1f77bcf86cd799439002');
  const job1Id = new mongoose.Types.ObjectId('507f1f77bcf86cd799439011');
  const job2Id = new mongoose.Types.ObjectId('507f1f77bcf86cd799439012');

  const mockJob1 = {
    _id: job1Id,
    title: 'Senior Frontend Engineer',
    company: 'Stripe',
    location: 'Remote',
    sourceUrl: 'https://stripe.com/jobs/1',
    platform: 'greenhouse',
  };

  describe('Model Schema & Unique Indexes', () => {
    test('Application schema defines partial unique compound index on { userId: 1, jobId: 1 }', () => {
      const indexes = Application.schema.indexes();
      const compoundIndex = indexes.find(
        ([fields, options]) =>
          fields.userId === 1 &&
          fields.jobId === 1 &&
          options?.unique === true &&
          options?.partialFilterExpression?.jobId
      );
      assert.ok(
        compoundIndex,
        'Expected Application schema to define partial unique compound index on { userId: 1, jobId: 1 }'
      );
    });

    test('Supported statuses are Applied, Interview, Rejected, Offer', () => {
      assert.deepEqual(VALID_STATUSES, ['Applied', 'Interview', 'Rejected', 'Offer']);
    });
  });

  describe('Status Normalization & Validation', () => {
    test('normalizes lowercase statuses to canonical casing', () => {
      assert.equal(normalizeStatus('applied'), 'Applied');
      assert.equal(normalizeStatus('interview'), 'Interview');
      assert.equal(normalizeStatus('rejected'), 'Rejected');
      assert.equal(normalizeStatus('offer'), 'Offer');
      assert.equal(normalizeStatus('  INTERVIEW  '), 'Interview');
    });

    test('defaults to Applied when status is empty or omitted', () => {
      assert.equal(normalizeStatus(''), 'Applied');
      assert.equal(normalizeStatus(null), 'Applied');
      assert.equal(normalizeStatus(undefined), 'Applied');
    });

    test('throws 400 Bad Request for unrecognized status', () => {
      assert.throws(
        () => normalizeStatus('accepted'),
        (err) => err.statusCode === 400 && err.code === 'INVALID_STATUS'
      );
      assert.throws(
        () => normalizeStatus('withdrawn'),
        (err) => err.statusCode === 400 && err.code === 'INVALID_STATUS'
      );
    });
  });

  describe('createApplication service', () => {
    test('successfully creates a manual application without jobId', async () => {
      const originalCreate = Application.create;

      Application.create = async (doc) => ({
        _id: new mongoose.Types.ObjectId(),
        ...doc,
      });

      try {
        const result = await createApplication(userAId, {
          company: 'Acme Corp',
          jobTitle: 'Full Stack Engineer',
          applicationUrl: 'https://acme.com/apply',
          status: 'Applied',
          notes: 'Referral through teammate',
        });

        assert.ok(result);
        assert.equal(result.userId.toString(), userAId.toString());
        assert.equal(result.company, 'Acme Corp');
        assert.equal(result.jobTitle, 'Full Stack Engineer');
        assert.equal(result.status, 'Applied');
        assert.equal(result.notes, 'Referral through teammate');
        assert.equal(result.jobId, null);
      } finally {
        Application.create = originalCreate;
      }
    });

    test('successfully tracks an existing job listing and reuses Job details', async () => {
      const originalFindById = Job.findById;
      const originalFindOne = Application.findOne;
      const originalCreate = Application.create;

      Job.findById = () => ({
        lean: async () => mockJob1,
      });
      Application.findOne = async () => null; // not already tracked
      Application.create = async (doc) => ({
        _id: new mongoose.Types.ObjectId(),
        ...doc,
        populate: async () => {},
      });

      try {
        const result = await createApplication(userAId, {
          jobId: job1Id.toString(),
          notes: 'High priority role',
        });

        assert.ok(result);
        assert.equal(result.userId.toString(), userAId.toString());
        assert.equal(result.jobId.toString(), job1Id.toString());
        assert.equal(result.company, 'Stripe'); // Inherited from Job
        assert.equal(result.jobTitle, 'Senior Frontend Engineer'); // Inherited from Job
        assert.equal(result.applicationUrl, 'https://stripe.com/jobs/1');
        assert.equal(result.status, 'Applied');
      } finally {
        Job.findById = originalFindById;
        Application.findOne = originalFindOne;
        Application.create = originalCreate;
      }
    });

    test('prevents duplicate tracking of the same job listing for the same user with 409 Conflict', async () => {
      const originalFindById = Job.findById;
      const originalFindOne = Application.findOne;

      Job.findById = () => ({
        lean: async () => mockJob1,
      });
      Application.findOne = async () => ({
        _id: new mongoose.Types.ObjectId(),
        userId: userAId,
        jobId: job1Id,
      });

      try {
        await assert.rejects(
          async () => {
            await createApplication(userAId, { jobId: job1Id.toString() });
          },
          (err) => {
            assert.equal(err.statusCode, 409);
            assert.equal(err.code, 'ALREADY_TRACKED');
            return true;
          }
        );
      } finally {
        Job.findById = originalFindById;
        Application.findOne = originalFindOne;
      }
    });

    test('rejects creation if company or jobTitle are missing for manual tracking', async () => {
      await assert.rejects(
        async () => {
          await createApplication(userAId, { company: '', jobTitle: 'Developer' });
        },
        (err) => err.statusCode === 400 && err.code === 'COMPANY_REQUIRED'
      );

      await assert.rejects(
        async () => {
          await createApplication(userAId, { company: 'Google', jobTitle: '   ' });
        },
        (err) => err.statusCode === 400 && err.code === 'JOB_TITLE_REQUIRED'
      );
    });

    test('rejects non-existent jobId with 404', async () => {
      const originalFindById = Job.findById;
      Job.findById = () => ({
        lean: async () => null,
      });

      try {
        await assert.rejects(
          async () => {
            await createApplication(userAId, { jobId: job1Id.toString() });
          },
          (err) => err.statusCode === 404 && err.code === 'NOT_FOUND'
        );
      } finally {
        Job.findById = originalFindById;
      }
    });
  });

  describe('User Data Isolation & Security', () => {
    test('User A cannot view User B applications (scoped strictly to userId)', async () => {
      const originalFind = Application.find;

      let capturedQuery = null;
      Application.find = (query) => {
        capturedQuery = query;
        return {
          sort: () => ({
            populate: () => ({
              lean: async () => [],
            }),
          }),
        };
      };

      try {
        await getApplications(userAId);
        assert.ok(capturedQuery);
        assert.equal(capturedQuery.userId.toString(), userAId.toString());
      } finally {
        Application.find = originalFind;
      }
    });

    test('User A cannot view User B single application by ID (returns 404)', async () => {
      const originalFindOne = Application.findOne;

      const appBId = new mongoose.Types.ObjectId();
      Application.findOne = (query) => {
        // Only return if userId matches userBId
        if (query.userId.toString() === userBId.toString() && query._id.toString() === appBId.toString()) {
          return { populate: () => ({ lean: async () => ({ _id: appBId, userId: userBId }) }) };
        }
        return { populate: () => ({ lean: async () => null }) };
      };

      try {
        await assert.rejects(
          async () => {
            await getApplicationById(userAId, appBId.toString());
          },
          (err) => err.statusCode === 404
        );
      } finally {
        Application.findOne = originalFindOne;
      }
    });

    test('User A cannot update User B application (returns 404)', async () => {
      const originalFindOne = Application.findOne;
      const appBId = new mongoose.Types.ObjectId();

      Application.findOne = async (query) => {
        if (query.userId.toString() === userAId.toString()) {
          return null; // isolated
        }
        return { _id: appBId, userId: userBId };
      };

      try {
        await assert.rejects(
          async () => {
            await updateApplication(userAId, appBId.toString(), { status: 'Interview' });
          },
          (err) => err.statusCode === 404
        );
      } finally {
        Application.findOne = originalFindOne;
      }
    });

    test('User A cannot delete User B application (returns 404)', async () => {
      const originalFindOneAndDelete = Application.findOneAndDelete;
      const appBId = new mongoose.Types.ObjectId();

      Application.findOneAndDelete = async (query) => {
        if (query.userId.toString() === userAId.toString()) {
          return null; // user A doesn't own it
        }
        return { _id: appBId, userId: userBId };
      };

      try {
        await assert.rejects(
          async () => {
            await deleteApplication(userAId, appBId.toString());
          },
          (err) => err.statusCode === 404
        );
      } finally {
        Application.findOneAndDelete = originalFindOneAndDelete;
      }
    });
  });

  describe('updateApplication service', () => {
    test('successfully updates status and notes', async () => {
      const originalFindOne = Application.findOne;
      const appId = new mongoose.Types.ObjectId();

      const mockDoc = {
        _id: appId,
        userId: userAId,
        company: 'Netflix',
        jobTitle: 'Backend Engineer',
        status: 'Applied',
        notes: '',
        save: async () => {},
      };

      Application.findOne = async () => mockDoc;

      try {
        const updated = await updateApplication(userAId, appId.toString(), {
          status: 'Interview',
          notes: 'First round technical interview scheduled for Thursday',
        });

        assert.equal(updated.status, 'Interview');
        assert.equal(updated.notes, 'First round technical interview scheduled for Thursday');
      } finally {
        Application.findOne = originalFindOne;
      }
    });

    test('rejects update with invalid status', async () => {
      const originalFindOne = Application.findOne;
      const appId = new mongoose.Types.ObjectId();

      Application.findOne = async () => ({
        _id: appId,
        userId: userAId,
        save: async () => {},
      });

      try {
        await assert.rejects(
          async () => {
            await updateApplication(userAId, appId.toString(), { status: 'BogusStatus' });
          },
          (err) => err.statusCode === 400 && err.code === 'INVALID_STATUS'
        );
      } finally {
        Application.findOne = originalFindOne;
      }
    });
  });

  describe('deleteApplication service', () => {
    test('successfully deletes an application owned by the user', async () => {
      const originalFindOneAndDelete = Application.findOneAndDelete;
      const appId = new mongoose.Types.ObjectId();

      Application.findOneAndDelete = async () => ({
        _id: appId,
        userId: userAId,
      });

      try {
        const result = await deleteApplication(userAId, appId.toString());
        assert.equal(result.success, true);
        assert.equal(result.message, 'Application deleted successfully');
      } finally {
        Application.findOneAndDelete = originalFindOneAndDelete;
      }
    });
  });

  describe('getApplicationStats service', () => {
    test('computes total, applied, interview, rejected, and offer counts', async () => {
      const originalCountDocuments = Application.countDocuments;

      Application.countDocuments = async (query) => {
        if (!query.status) return 10; // total
        if (query.status === 'Applied') return 4;
        if (query.status === 'Interview') return 3;
        if (query.status === 'Rejected') return 2;
        if (query.status === 'Offer') return 1;
        return 0;
      };

      try {
        const stats = await getApplicationStats(userAId);
        assert.equal(stats.total, 10);
        assert.equal(stats.applied, 4);
        assert.equal(stats.interview, 3);
        assert.equal(stats.rejected, 2);
        assert.equal(stats.offer, 1);
      } finally {
        Application.countDocuments = originalCountDocuments;
      }
    });
  });

  describe('getTrackedJobIds service', () => {
    test('returns array of string job IDs for tracked jobs', async () => {
      const originalFind = Application.find;

      Application.find = () => ({
        select: () => ({
          lean: async () => [
            { jobId: job1Id },
            { jobId: job2Id },
          ],
        }),
      });

      try {
        const ids = await getTrackedJobIds(userAId);
        assert.equal(ids.length, 2);
        assert.equal(ids[0], job1Id.toString());
        assert.equal(ids[1], job2Id.toString());
      } finally {
        Application.find = originalFind;
      }
    });
  });

  describe('HTTP Controller Handlers', () => {
    const mockUser = {
      _id: userAId,
      firebaseUid: 'mock-firebase-uid-123',
      email: 'mock-firebase-uid-123@app.user',
      name: 'Test User',
      authProvider: 'password',
      save: async () => {},
    };

    const setupUserMock = () => {
      const origFindOne = User.findOne;
      User.findOne = async () => mockUser;
      return () => {
        User.findOne = origFindOne;
      };
    };

    test('createApplicationHandler returns 201 on success', async () => {
      const restoreUser = setupUserMock();
      const origCreate = Application.create;

      Application.create = async (doc) => ({
        _id: new mongoose.Types.ObjectId(),
        ...doc,
      });

      const req = {
        user: { uid: 'mock-firebase-uid-123' },
        body: { company: 'Vercel', jobTitle: 'Frontend Engineer' },
      };

      let statusCode = 0;
      let jsonPayload = null;
      const res = {
        status: (code) => {
          statusCode = code;
          return {
            json: (payload) => {
              jsonPayload = payload;
              return payload;
            },
          };
        },
      };

      try {
        await createApplicationHandler(req, res);
        assert.equal(statusCode, 201);
        assert.equal(jsonPayload.success, true);
        assert.equal(jsonPayload.data.company, 'Vercel');
      } finally {
        restoreUser();
        Application.create = origCreate;
      }
    });

    test('createApplicationHandler returns 400 on missing jobTitle', async () => {
      const restoreUser = setupUserMock();

      const req = {
        user: { uid: 'mock-firebase-uid-123' },
        body: { company: 'Vercel', jobTitle: '' },
      };

      let statusCode = 0;
      let jsonPayload = null;
      const res = {
        status: (code) => {
          statusCode = code;
          return {
            json: (payload) => {
              jsonPayload = payload;
              return payload;
            },
          };
        },
      };

      try {
        await createApplicationHandler(req, res);
        assert.equal(statusCode, 400);
        assert.equal(jsonPayload.success, false);
      } finally {
        restoreUser();
      }
    });

    test('getApplicationsHandler returns 200 with applications list', async () => {
      const restoreUser = setupUserMock();
      const origFind = Application.find;

      Application.find = () => ({
        sort: () => ({
          populate: () => ({
            lean: async () => [{ company: 'Vercel', jobTitle: 'Engineer', status: 'Applied' }],
          }),
        }),
      });

      const req = {
        user: { uid: 'mock-firebase-uid-123' },
        query: {},
      };

      let statusCode = 0;
      let jsonPayload = null;
      const res = {
        status: (code) => {
          statusCode = code;
          return {
            json: (payload) => {
              jsonPayload = payload;
              return payload;
            },
          };
        },
      };

      try {
        await getApplicationsHandler(req, res);
        assert.equal(statusCode, 200);
        assert.equal(jsonPayload.success, true);
        assert.equal(jsonPayload.data.total, 1);
      } finally {
        restoreUser();
        Application.find = origFind;
      }
    });

    test('getApplicationStatsHandler returns 200 with stats metrics', async () => {
      const restoreUser = setupUserMock();
      const origCount = Application.countDocuments;

      Application.countDocuments = async () => 5;

      const req = { user: { uid: 'mock-firebase-uid-123' } };

      let statusCode = 0;
      let jsonPayload = null;
      const res = {
        status: (code) => {
          statusCode = code;
          return {
            json: (payload) => {
              jsonPayload = payload;
              return payload;
            },
          };
        },
      };

      try {
        await getApplicationStatsHandler(req, res);
        assert.equal(statusCode, 200);
        assert.equal(jsonPayload.success, true);
        assert.equal(jsonPayload.data.total, 5);
      } finally {
        restoreUser();
        Application.countDocuments = origCount;
      }
    });

    test('updateApplicationHandler returns 200 on status update', async () => {
      const restoreUser = setupUserMock();
      const origFindOne = Application.findOne;
      const appId = new mongoose.Types.ObjectId();

      Application.findOne = async () => ({
        _id: appId,
        userId: userAId,
        status: 'Applied',
        save: async () => {},
      });

      const req = {
        user: { uid: 'mock-firebase-uid-123' },
        params: { id: appId.toString() },
        body: { status: 'Interview' },
      };

      let statusCode = 0;
      let jsonPayload = null;
      const res = {
        status: (code) => {
          statusCode = code;
          return {
            json: (payload) => {
              jsonPayload = payload;
              return payload;
            },
          };
        },
      };

      try {
        await updateApplicationHandler(req, res);
        assert.equal(statusCode, 200);
        assert.equal(jsonPayload.success, true);
        assert.equal(jsonPayload.data.status, 'Interview');
      } finally {
        restoreUser();
        Application.findOne = origFindOne;
      }
    });

    test('deleteApplicationHandler returns 200 on successful deletion', async () => {
      const restoreUser = setupUserMock();
      const origFindOneAndDelete = Application.findOneAndDelete;
      const appId = new mongoose.Types.ObjectId();

      Application.findOneAndDelete = async () => ({
        _id: appId,
        userId: userAId,
      });

      const req = {
        user: { uid: 'mock-firebase-uid-123' },
        params: { id: appId.toString() },
      };

      let statusCode = 0;
      let jsonPayload = null;
      const res = {
        status: (code) => {
          statusCode = code;
          return {
            json: (payload) => {
              jsonPayload = payload;
              return payload;
            },
          };
        },
      };

      try {
        await deleteApplicationHandler(req, res);
        assert.equal(statusCode, 200);
        assert.equal(jsonPayload.success, true);
      } finally {
        restoreUser();
        Application.findOneAndDelete = origFindOneAndDelete;
      }
    });
  });
});
