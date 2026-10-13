import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import {
  saveJob,
  unsaveJob,
  getSavedJobs,
  getSavedJobIds,
  isJobSaved,
} from '../src/services/savedJobService.js';
import {
  saveJobHandler,
  unsaveJobHandler,
  getSavedJobsHandler,
  getSavedJobIdsHandler,
  checkJobSavedHandler,
} from '../src/controllers/savedJobController.js';

import { SavedJob } from '../src/models/SavedJob.js';
import { Job } from '../src/models/Job.js';
import User from '../src/models/User.js';

describe('Saved Jobs Service & Controller Backend Tests', () => {
  const userAId = new mongoose.Types.ObjectId('607f1f77bcf86cd799439001');
  const userBId = new mongoose.Types.ObjectId('607f1f77bcf86cd799439002');
  const job1Id = new mongoose.Types.ObjectId('507f1f77bcf86cd799439011');
  const job2Id = new mongoose.Types.ObjectId('507f1f77bcf86cd799439012');

  const mockJob1 = {
    _id: job1Id,
    title: 'Senior React Developer',
    company: 'TechCorp',
    location: 'Remote',
    sourceUrl: 'https://example.com/jobs/1',
    platform: 'greenhouse',
  };

  describe('Model Schema & Unique Compound Index', () => {
    test('SavedJob schema defines unique compound index on { userId: 1, jobId: 1 }', () => {
      const indexes = SavedJob.schema.indexes();
      const compoundIndex = indexes.find(
        ([fields, options]) =>
          fields.userId === 1 && fields.jobId === 1 && options?.unique === true
      );
      assert.ok(
        compoundIndex,
        'Expected SavedJob schema to have a unique compound index on { userId: 1, jobId: 1 }'
      );
    });
  });

  describe('saveJob service', () => {
    test('successfully saves a job and populates listing details', async () => {
      const originalFindById = Job.findById;
      const originalFindOne = SavedJob.findOne;
      const originalCreate = SavedJob.create;

      Job.findById = () => ({
        lean: async () => mockJob1,
      });

      SavedJob.findOne = async () => null; // Not already saved

      SavedJob.create = async ({ userId, jobId, notes }) => ({
        _id: new mongoose.Types.ObjectId(),
        userId,
        jobId,
        notes,
        populate: async () => { },
      });

      try {
        const result = await saveJob(userAId, job1Id, 'Great match for React skills');
        assert.ok(result);
        assert.equal(result.userId.toString(), userAId.toString());
        assert.equal(result.jobId.toString(), job1Id.toString());
        assert.equal(result.notes, 'Great match for React skills');
      } finally {
        Job.findById = originalFindById;
        SavedJob.findOne = originalFindOne;
        SavedJob.create = originalCreate;
      }
    });

    test('prevents duplicate save for the same user and job with 409 Conflict', async () => {
      const originalFindById = Job.findById;
      const originalFindOne = SavedJob.findOne;

      Job.findById = () => ({
        lean: async () => mockJob1,
      });

      // Existing record exists
      SavedJob.findOne = async () => ({
        _id: new mongoose.Types.ObjectId(),
        userId: userAId,
        jobId: job1Id,
      });

      try {
        await assert.rejects(
          async () => {
            await saveJob(userAId, job1Id);
          },
          (err) => {
            assert.equal(err.statusCode, 409);
            assert.equal(err.code, 'ALREADY_SAVED');
            return true;
          }
        );
      } finally {
        Job.findById = originalFindById;
        SavedJob.findOne = originalFindOne;
      }
    });

    test('rejects saving a non-existent job listing with 404', async () => {
      const originalFindById = Job.findById;
      Job.findById = () => ({
        lean: async () => null, // Job does not exist
      });

      try {
        await assert.rejects(
          async () => {
            await saveJob(userAId, job1Id);
          },
          (err) => {
            assert.equal(err.statusCode, 404);
            return true;
          }
        );
      } finally {
        Job.findById = originalFindById;
      }
    });

    test('rejects invalid ObjectId format with 400', async () => {
      await assert.rejects(
        async () => {
          await saveJob(userAId, 'not-a-valid-id');
        },
        (err) => {
          assert.equal(err.statusCode, 400);
          assert.equal(err.code, 'INVALID_ID');
          return true;
        }
      );
    });
  });

  describe('User Isolation & Security', () => {
    test('User A cannot view User B saved jobs (scoped strictly to userId)', async () => {
      let capturedQuery = null;
      const originalFind = SavedJob.find;

      SavedJob.find = (q) => {
        capturedQuery = q;
        return {
          sort: () => ({
            populate: () => ({
              lean: async () => [
                {
                  _id: new mongoose.Types.ObjectId(),
                  userId: userAId,
                  jobId: mockJob1,
                  notes: 'User A note',
                  createdAt: new Date(),
                },
              ],
            }),
          }),
        };
      };

      try {
        const result = await getSavedJobs(userAId);
        assert.equal(capturedQuery.userId.toString(), userAId.toString());
        assert.equal(result.savedJobs.length, 1);
        assert.equal(result.total, 1);
      } finally {
        SavedJob.find = originalFind;
      }
    });

    test('User A cannot remove/unsave User B saved job', async () => {
      let capturedDeleteFilter = null;
      const originalFindOneAndDelete = SavedJob.findOneAndDelete;

      SavedJob.findOneAndDelete = async (filter) => {
        capturedDeleteFilter = filter;
        // User A trying to delete User B's job -> nothing matches User A's userId
        return null;
      };

      try {
        await assert.rejects(
          async () => {
            await unsaveJob(userAId, job2Id);
          },
          (err) => {
            assert.equal(err.statusCode, 404);
            // Verify query included User A's ID so User B's data is untouched
            assert.equal(capturedDeleteFilter.userId.toString(), userAId.toString());
            return true;
          }
        );
      } finally {
        SavedJob.findOneAndDelete = originalFindOneAndDelete;
      }
    });
  });

  describe('unsaveJob service', () => {
    test('successfully removes a saved job for the owner', async () => {
      const originalFindOneAndDelete = SavedJob.findOneAndDelete;

      SavedJob.findOneAndDelete = async () => ({
        _id: new mongoose.Types.ObjectId(),
        userId: userAId,
        jobId: job1Id,
      });

      try {
        const result = await unsaveJob(userAId, job1Id);
        assert.equal(result.success, true);
      } finally {
        SavedJob.findOneAndDelete = originalFindOneAndDelete;
      }
    });
  });

  describe('getSavedJobIds & isJobSaved', () => {
    test('getSavedJobIds returns array of string IDs', async () => {
      const originalFind = SavedJob.find;

      SavedJob.find = () => ({
        select: () => ({
          lean: async () => [
            { jobId: job1Id },
            { jobId: job2Id },
          ],
        }),
      });

      try {
        const ids = await getSavedJobIds(userAId);
        assert.deepEqual(ids, [job1Id.toString(), job2Id.toString()]);
      } finally {
        SavedJob.find = originalFind;
      }
    });

    test('isJobSaved returns true when saved and false when not', async () => {
      const originalExists = SavedJob.exists;

      SavedJob.exists = async ({ userId, jobId }) =>
        jobId.toString() === job1Id.toString() ? { _id: new mongoose.Types.ObjectId() } : null;

      try {
        assert.equal(await isJobSaved(userAId, job1Id), true);
        assert.equal(await isJobSaved(userAId, job2Id), false);
      } finally {
        SavedJob.exists = originalExists;
      }
    });
  });

  describe('HTTP Controller Handlers', () => {
    const mockUserDoc = {
      _id: userAId,
      firebaseUid: 'mock-firebase-uid-123',
      email: 'mock-firebase-uid-123@app.user',
      name: 'Test User',
      authProvider: 'password',
      save: async () => { },
    };


    test('saveJobHandler returns 201 on success', async () => {
      const originalFindById = Job.findById;
      const originalFindOne = SavedJob.findOne;
      const originalCreate = SavedJob.create;
      const originalUserFindOne = User.findOne;

      User.findOne = async () => mockUserDoc;
      Job.findById = () => ({ lean: async () => mockJob1 });
      SavedJob.findOne = async () => null;
      SavedJob.create = async (doc) => ({
        ...doc,
        _id: new mongoose.Types.ObjectId(),
        populate: async () => { },
      });

      const req = {
        user: { uid: 'mock-firebase-uid-123' },
        body: { jobId: job1Id.toString() },
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
        await saveJobHandler(req, res);
        assert.equal(responseStatus, 201);
        assert.equal(responsePayload.success, true);
      } finally {
        Job.findById = originalFindById;
        SavedJob.findOne = originalFindOne;
        SavedJob.create = originalCreate;
        User.findOne = originalUserFindOne;
      }
    });

    test('saveJobHandler returns 400 when jobId is missing', async () => {
      const originalUserFindOne = User.findOne;
      User.findOne = async () => mockUserDoc;

      const req = {
        user: { uid: 'mock-firebase-uid-123' },
        body: {},
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
        await saveJobHandler(req, res);
        assert.equal(responseStatus, 400);
        assert.equal(responsePayload.success, false);
      } finally {
        User.findOne = originalUserFindOne;
      }
    });

    test('unsaveJobHandler returns 200 on successful removal', async () => {
      const originalUserFindOne = User.findOne;
      const originalFindOneAndDelete = SavedJob.findOneAndDelete;

      User.findOne = async () => mockUserDoc;
      SavedJob.findOneAndDelete = async () => ({ _id: new mongoose.Types.ObjectId() });

      const req = {
        user: { uid: 'mock-firebase-uid-123' },
        params: { jobId: job1Id.toString() },
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
        await unsaveJobHandler(req, res);
        assert.equal(responseStatus, 200);
        assert.equal(responsePayload.success, true);
      } finally {
        User.findOne = originalUserFindOne;
        SavedJob.findOneAndDelete = originalFindOneAndDelete;
      }
    });

    test('getSavedJobsHandler returns 200 with saved jobs array', async () => {
      const originalUserFindOne = User.findOne;
      const originalFind = SavedJob.find;

      User.findOne = async () => mockUserDoc;
      SavedJob.find = () => ({
        sort: () => ({
          populate: () => ({
            lean: async () => [
              {
                _id: new mongoose.Types.ObjectId(),
                userId: userAId,
                jobId: mockJob1,
                notes: '',
                createdAt: new Date(),
              },
            ],
          }),
        }),
      });

      const req = {
        user: { uid: 'mock-firebase-uid-123' },
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
        await getSavedJobsHandler(req, res);
        assert.equal(responseStatus, 200);
        assert.equal(responsePayload.success, true);
        assert.equal(responsePayload.data.savedJobs.length, 1);
      } finally {
        User.findOne = originalUserFindOne;
        SavedJob.find = originalFind;
      }
    });

    test('getSavedJobIdsHandler returns 200 with ids array', async () => {
      const originalUserFindOne = User.findOne;
      const originalFind = SavedJob.find;

      User.findOne = async () => mockUserDoc;
      SavedJob.find = () => ({
        select: () => ({
          lean: async () => [{ jobId: job1Id }],
        }),
      });

      const req = {
        user: { uid: 'mock-firebase-uid-123' },
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
        await getSavedJobIdsHandler(req, res);
        assert.equal(responseStatus, 200);
        assert.equal(responsePayload.success, true);
        assert.deepEqual(responsePayload.data.ids, [job1Id.toString()]);
      } finally {
        User.findOne = originalUserFindOne;
        SavedJob.find = originalFind;
      }
    });
  });
});
