import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import {
  ALLOWED_EXTENSIONS,
  ALLOWED_MIME_TYPES,
  detectFileFormat,
  validateResumeBuffer,
} from '../src/middleware/uploadMiddleware.js';
import {
  generateSignedResumeUrl,
} from '../src/services/cloudinaryService.js';
import {
  uploadResume,
  saveResume,
  getMyResume,
  downloadMyResume,
} from '../src/controllers/resumeController.js';
import User from '../src/models/User.js';
import Resume from '../src/models/Resume.js';
import * as cloudinaryService from '../src/services/cloudinaryService.js';

// --- Sample document buffers for testing ---
const VALID_PDF_BUFFER = Buffer.from(
  '%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [] /Count 0 >>\nendobj\nxref\n0 3\n0000000000 65535 f \ntrailer\n<< /Root 1 0 R /Size 3 >>\nstartxref\n115\n%%EOF'
);

// Minimal DOCX-like buffer: PK\x03\x04 header containing [Content_Types].xml and word/document.xml
const VALID_DOCX_BUFFER = Buffer.concat([
  Buffer.from([0x50, 0x4b, 0x03, 0x04]),
  Buffer.from(' PK\x01\x02 [Content_Types].xml word/document.xml sample docx content payload padding extra bytes 1234567890'),
]);

// Generic ZIP buffer lacking Word OpenXML structure
const GENERIC_ZIP_BUFFER = Buffer.concat([
  Buffer.from([0x50, 0x4b, 0x03, 0x04]),
  Buffer.from(' PK\x01\x02 test.txt file_content_not_docx padding extra bytes 1234567890'),
]);

// Disallowed payloads
const WINDOWS_EXE_BUFFER = Buffer.concat([
  Buffer.from([0x4d, 0x5a, 0x90, 0x00]), // MZ
  Buffer.from(' This program cannot be run in DOS mode. padding bytes 1234567890'),
]);

const LINUX_ELF_BUFFER = Buffer.concat([
  Buffer.from([0x7f, 0x45, 0x4c, 0x46]), // \x7fELF
  Buffer.from(' Linux ELF binary executable sample padding bytes 1234567890'),
]);

const HTML_SCRIPT_BUFFER = Buffer.from(
  '<!DOCTYPE html><html><head><script>alert("phishing")</script></head><body>Resume</body></html>'
);

const PHP_SCRIPT_BUFFER = Buffer.from(
  '<?php echo system($_GET["cmd"]); ?> // disguised script padding bytes 1234567890'
);

const SHELL_SCRIPT_BUFFER = Buffer.from(
  '#!/bin/bash\nrm -rf /tmp/data\necho "exploit"\n# padding bytes 1234567890'
);

// Helper to mock express req/res
const createMockReqRes = (user = null, file = null, body = {}) => {
  let statusCode = 200;
  let jsonPayload = null;
  let headersSent = {};
  let sentData = null;

  const req = {
    user,
    file,
    body,
  };

  const res = {
    status(code) {
      statusCode = code;
      return this;
    },
    json(data) {
      jsonPayload = data;
      return this;
    },
    setHeader(name, value) {
      headersSent[name.toLowerCase()] = value;
      return this;
    },
    send(data) {
      sentData = data;
      return this;
    },
  };

  return {
    req,
    res,
    getStatusCode: () => statusCode,
    getJsonPayload: () => jsonPayload,
    getHeaders: () => headersSent,
    getSentData: () => sentData,
  };
};

describe('Resume Upload Security & Privacy Tests', () => {
  describe('1. File Extension & MIME Type Matching', () => {
    test('rejects disallowed file extensions', () => {
      const badExtensions = ['.exe', '.sh', '.html', '.php', '.png', '.jpg', '.tar', '.js'];
      for (const ext of badExtensions) {
        const result = validateResumeBuffer(VALID_PDF_BUFFER, `resume${ext}`, 'application/pdf');
        assert.equal(result.valid, false, `Should reject ${ext}`);
        assert.equal(result.code, 'INVALID_FILE_TYPE');
      }
    });

    test('rejects spoofed or mismatched MIME types for .pdf extension', () => {
      const badMimes = [
        'image/png',
        'image/jpeg',
        'text/html',
        'application/x-sh',
        'application/octet-stream',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      ];
      for (const mime of badMimes) {
        const result = validateResumeBuffer(VALID_PDF_BUFFER, 'resume.pdf', mime);
        assert.equal(result.valid, false, `Should reject MIME ${mime} for .pdf`);
        assert.equal(result.code, 'FILE_TYPE_MISMATCH');
      }
    });

    test('rejects spoofed or mismatched MIME types for .docx extension', () => {
      const badMimes = ['application/pdf', 'image/png', 'text/html', 'application/x-sh'];
      for (const mime of badMimes) {
        const result = validateResumeBuffer(VALID_DOCX_BUFFER, 'resume.docx', mime);
        assert.equal(result.valid, false, `Should reject MIME ${mime} for .docx`);
        assert.equal(result.code, 'FILE_TYPE_MISMATCH');
      }
    });

    test('accepts valid matching extension and MIME type for PDF', () => {
      const result = validateResumeBuffer(VALID_PDF_BUFFER, 'resume.pdf', 'application/pdf');
      assert.equal(result.valid, true);
    });

    test('accepts valid matching extension and MIME type for DOCX', () => {
      const result = validateResumeBuffer(
        VALID_DOCX_BUFFER,
        'resume.docx',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      );
      assert.equal(result.valid, true);
    });
  });

  describe('2. Magic-Byte Content Detection & Payload Rejection', () => {
    test('rejects empty buffer with FILE_EMPTY', () => {
      const emptyBuffer = Buffer.alloc(0);
      const result = validateResumeBuffer(emptyBuffer, 'resume.pdf', 'application/pdf');
      assert.equal(result.valid, false);
      assert.equal(result.code, 'FILE_EMPTY');
    });

    test('rejects tiny/truncated buffer with INVALID_FILE_CONTENT', () => {
      const tinyBuffer = Buffer.from('%PDF'); // Only 4 bytes
      const result = validateResumeBuffer(tinyBuffer, 'resume.pdf', 'application/pdf');
      assert.equal(result.valid, false);
      assert.equal(result.code, 'INVALID_FILE_CONTENT');
    });

    test('rejects Windows PE executable payload renamed to .pdf', () => {
      const result = validateResumeBuffer(WINDOWS_EXE_BUFFER, 'resume.pdf', 'application/pdf');
      assert.equal(result.valid, false);
      assert.equal(result.code, 'INVALID_FILE_CONTENT');
    });

    test('rejects Linux ELF executable payload renamed to .pdf', () => {
      const result = validateResumeBuffer(LINUX_ELF_BUFFER, 'resume.pdf', 'application/pdf');
      assert.equal(result.valid, false);
      assert.equal(result.code, 'INVALID_FILE_CONTENT');
    });

    test('rejects HTML/phishing payload renamed to .pdf', () => {
      const result = validateResumeBuffer(HTML_SCRIPT_BUFFER, 'resume.pdf', 'application/pdf');
      assert.equal(result.valid, false);
      assert.equal(result.code, 'INVALID_FILE_CONTENT');
    });

    test('rejects PHP shell payload renamed to .pdf', () => {
      const result = validateResumeBuffer(PHP_SCRIPT_BUFFER, 'resume.pdf', 'application/pdf');
      assert.equal(result.valid, false);
      assert.equal(result.code, 'INVALID_FILE_CONTENT');
    });

    test('rejects bash script payload renamed to .pdf', () => {
      const result = validateResumeBuffer(SHELL_SCRIPT_BUFFER, 'resume.pdf', 'application/pdf');
      assert.equal(result.valid, false);
      assert.equal(result.code, 'INVALID_FILE_CONTENT');
    });

    test('rejects arbitrary plain text buffer renamed to .pdf', () => {
      const textBuffer = Buffer.from('John Doe Resume: Software Engineer with 5 years experience in Python and Node.js');
      const result = validateResumeBuffer(textBuffer, 'resume.pdf', 'application/pdf');
      assert.equal(result.valid, false);
      assert.equal(result.code, 'FILE_TYPE_MISMATCH');
    });

    test('detects extension mismatch: DOCX content renamed to .pdf', () => {
      const result = validateResumeBuffer(VALID_DOCX_BUFFER, 'resume.pdf', 'application/pdf');
      assert.equal(result.valid, false);
      assert.equal(result.code, 'FILE_TYPE_MISMATCH');
      assert.match(result.error, /contains Word document/i);
    });

    test('detects extension mismatch: PDF content renamed to .docx', () => {
      const result = validateResumeBuffer(
        VALID_PDF_BUFFER,
        'resume.docx',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      );
      assert.equal(result.valid, false);
      assert.equal(result.code, 'FILE_TYPE_MISMATCH');
      assert.match(result.error, /contains PDF document/i);
    });

    test('rejects generic ZIP archive lacking DOCX structure named as .docx', () => {
      const result = validateResumeBuffer(
        GENERIC_ZIP_BUFFER,
        'resume.docx',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      );
      assert.equal(result.valid, false);
      assert.equal(result.code, 'FILE_TYPE_MISMATCH');
      assert.match(result.error, /ZIP archive but does not contain a valid Word document/i);
    });
  });

  describe('3. Cloudinary Private Access & Signed URLs', () => {
    test('generates time-limited signed URL with HMAC signature and expiry', () => {
      const publicId = 'resumes/6ab7cce602a1b26683338c51/sample_resume.pdf';
      const signedUrl = generateSignedResumeUrl(publicId, 1800);

      assert.ok(signedUrl, 'Signed URL must be generated');
      assert.match(signedUrl, /api\.cloudinary\.com/, 'Must point to Cloudinary API');
      assert.match(signedUrl, /signature=/, 'Must include HMAC signature');
      assert.match(signedUrl, /expires_at=/, 'Must include expires_at parameter');
      assert.match(signedUrl, /api_key=/, 'Must include public api_key');
      // Must NOT contain api_secret
      assert.equal(signedUrl.includes(process.env.CLOUDINARY_API_SECRET), false, 'Must never leak api_secret');
    });

    test('returns empty string safely when publicId is empty or null', () => {
      assert.equal(generateSignedResumeUrl(''), '');
      assert.equal(generateSignedResumeUrl(null), '');
      assert.equal(generateSignedResumeUrl(undefined), '');
    });
  });

  describe('4. Controller Security & Defense-in-Depth', () => {
    test('uploadResume rejects request when file is missing', async () => {
      const { req, res, getStatusCode, getJsonPayload } = createMockReqRes({ uid: 'test-uid' }, null);
      await uploadResume(req, res);

      assert.equal(getStatusCode(), 400);
      assert.equal(getJsonPayload().error, 'FILE_MISSING');
    });

    test('uploadResume rejects request when file buffer contains executable payload', async () => {
      const badFile = {
        buffer: WINDOWS_EXE_BUFFER,
        originalname: 'resume.pdf',
        mimetype: 'application/pdf',
        size: WINDOWS_EXE_BUFFER.length,
      };

      const { req, res, getStatusCode, getJsonPayload } = createMockReqRes({ uid: 'test-uid' }, badFile);
      await uploadResume(req, res);

      assert.equal(getStatusCode(), 400);
      assert.equal(getJsonPayload().error, 'INVALID_FILE_CONTENT');
    });

    test('saveResume rejects disallowed file extension in metadata', async () => {
      const { req, res, getStatusCode, getJsonPayload } = createMockReqRes(
        { uid: 'test-uid' },
        null,
        { fileName: 'malware.exe', fileType: 'application/octet-stream' }
      );
      await saveResume(req, res);

      assert.equal(getStatusCode(), 400);
      assert.equal(getJsonPayload().error, 'INVALID_FILE_TYPE');
    });

    test('downloadMyResume returns 404 when user has no stored resume', async () => {
      const fakeUserId = new mongoose.Types.ObjectId();
      const originalUserFindOne = User.findOne;
      const originalResumeFindOne = Resume.findOne;

      const mockUser = {
        _id: fakeUserId,
        firebaseUid: 'mock-firebase-uid',
        email: 'mock-firebase-uid@app.user',
        name: 'Test User',
        authProvider: 'password',
        save: async () => {},
      };

      User.findOne = async () => mockUser;
      Resume.findOne = () => ({
        sort: () => null,
      });

      const { req, res, getStatusCode, getJsonPayload } = createMockReqRes({ uid: 'mock-firebase-uid' });

      try {
        await downloadMyResume(req, res);
        assert.equal(getStatusCode(), 404);
        assert.equal(getJsonPayload().error, 'RESUME_NOT_FOUND');
      } finally {
        User.findOne = originalUserFindOne;
        Resume.findOne = originalResumeFindOne;
      }
    });

    test('downloadMyResume returns 404 when resume has missing storage locations', async () => {
      const fakeUserId = new mongoose.Types.ObjectId();
      const originalUserFindOne = User.findOne;
      const originalResumeFindOne = Resume.findOne;

      const mockUser = {
        _id: fakeUserId,
        firebaseUid: 'mock-firebase-uid',
        email: 'mock-firebase-uid@app.user',
        name: 'Test User',
        authProvider: 'password',
        save: async () => {},
      };

      User.findOne = async () => mockUser;
      Resume.findOne = () => ({
        sort: () => ({
          userId: fakeUserId,
          fileName: 'empty_location.pdf',
          publicId: '',
          storageUrl: '',
        }),
      });

      const { req, res, getStatusCode, getJsonPayload } = createMockReqRes({ uid: 'mock-firebase-uid' });

      try {
        await downloadMyResume(req, res);
        assert.equal(getStatusCode(), 404);
        assert.equal(getJsonPayload().error, 'STORAGE_URL_MISSING');
      } finally {
        User.findOne = originalUserFindOne;
        Resume.findOne = originalResumeFindOne;
      }
    });

    test('getMyResume enriches storageUrl with signed URL and enforces user isolation', async () => {
      const userAId = new mongoose.Types.ObjectId();
      const originalUserFindOne = User.findOne;
      const originalResumeFindOne = Resume.findOne;

      const mockUserA = {
        _id: userAId,
        firebaseUid: 'alice-firebase-uid',
        email: 'alice-firebase-uid@app.user',
        name: 'Alice',
        authProvider: 'password',
        save: async () => {},
      };

      User.findOne = async () => mockUserA;
      Resume.findOne = ({ userId }) => {
        // Enforce user isolation: only returns document if userId matches User A
        if (userId.toString() !== userAId.toString()) return { sort: () => null };

        return {
          sort: () => ({
            userId: userAId,
            fileName: 'alice_resume.pdf',
            publicId: 'resumes/userA/alice_resume.pdf',
            storageUrl: 'https://res.cloudinary.com/dummy/raw/upload/original.pdf',
            toObject: function () {
              return {
                userId: this.userId,
                fileName: this.fileName,
                publicId: this.publicId,
                storageUrl: this.storageUrl,
              };
            },
          }),
        };
      };

      const { req, res, getStatusCode, getJsonPayload } = createMockReqRes({ uid: 'alice-firebase-uid' });

      try {
        await getMyResume(req, res);
        assert.equal(getStatusCode(), 200);
        const resume = getJsonPayload().data.resume;
        assert.ok(resume);
        assert.equal(resume.fileName, 'alice_resume.pdf');
        // If Cloudinary configured, storageUrl is enriched with time-limited signed URL
        assert.match(resume.storageUrl, /api\.cloudinary\.com/);
        assert.match(resume.storageUrl, /signature=/);
      } finally {
        User.findOne = originalUserFindOne;
        Resume.findOne = originalResumeFindOne;
      }
    });
  });
});
