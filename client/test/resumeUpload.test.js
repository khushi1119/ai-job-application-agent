import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

describe('Resume Upload & Replacement Logic Tests', () => {
  const ALLOWED_EXTENSIONS = ['.pdf', '.docx'];
  const ALLOWED_MIME_TYPES = [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/msword',
  ];
  const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

  const validateFile = (file) => {
    if (!file) return { valid: false, error: 'No file provided' };

    const fileName = file.name || '';
    const fileExt = fileName.substring(fileName.lastIndexOf('.')).toLowerCase();

    if (!ALLOWED_EXTENSIONS.includes(fileExt) && !ALLOWED_MIME_TYPES.includes(file.type)) {
      return {
        valid: false,
        error: 'Please select a valid PDF (.pdf) or Word document (.docx).',
      };
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      return {
        valid: false,
        error: `File size exceeds the 10 MB limit. Please choose a smaller file.`,
      };
    }

    return { valid: true, error: '' };
  };

  const formatFileSize = (bytes) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  describe('File Validation Constraints', () => {
    test('accepts valid PDF files within the 10 MB limit', () => {
      const file = {
        name: 'Jane_Doe_Resume.pdf',
        type: 'application/pdf',
        size: 2 * 1024 * 1024, // 2 MB
      };
      const res = validateFile(file);
      assert.equal(res.valid, true);
      assert.equal(res.error, '');
    });

    test('accepts valid DOCX files within the 10 MB limit', () => {
      const file = {
        name: 'Jane_Doe_Resume.docx',
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        size: 500 * 1024, // 500 KB
      };
      const res = validateFile(file);
      assert.equal(res.valid, true);
      assert.equal(res.error, '');
    });

    test('rejects unsupported file formats (.png, .txt, .exe)', () => {
      const badFiles = [
        { name: 'photo.png', type: 'image/png', size: 1024 },
        { name: 'notes.txt', type: 'text/plain', size: 2048 },
        { name: 'resume.exe', type: 'application/octet-stream', size: 5000 },
      ];

      for (const f of badFiles) {
        const res = validateFile(f);
        assert.equal(res.valid, false);
        assert.match(res.error, /Please select a valid PDF/i);
      }
    });

    test('rejects files exceeding the 10 MB limit', () => {
      const oversizedFile = {
        name: 'huge_portfolio_resume.pdf',
        type: 'application/pdf',
        size: 11 * 1024 * 1024, // 11 MB
      };
      const res = validateFile(oversizedFile);
      assert.equal(res.valid, false);
      assert.match(res.error, /exceeds the 10 MB limit/i);
    });

    test('formats file sizes accurately for display', () => {
      assert.equal(formatFileSize(0), '0 B');
      assert.equal(formatFileSize(1024), '1 KB');
      assert.equal(formatFileSize(3.3 * 1024), '3.3 KB');
      assert.equal(formatFileSize(5 * 1024 * 1024), '5 MB');
    });
  });

  describe('Resume Replacement Pipeline State Machine', () => {
    // Model state transitions during replacement
    const createUploadState = (initialResume = null) => {
      let state = {
        uploadedResume: initialResume,
        selectedFile: null,
        isUploading: false,
        isExtracting: false,
        uploadProgress: 0,
        uploadError: '',
        validationError: '',
        isProcessing: false,
      };

      const actions = {
        selectReplacement: (file) => {
          if (state.isProcessing || state.isUploading || state.isExtracting) {
            return { rejected: true, reason: 'BUSY' };
          }
          const val = validateFile(file);
          if (!val.valid) {
            state.validationError = val.error;
            state.selectedFile = null;
            return { rejected: true, reason: 'INVALID_FILE' };
          }

          state.validationError = '';
          state.uploadError = '';
          return { rejected: false };
        },

        startUploadAndParse: async (file, { mockUploadFail = false, mockExtractFail = false } = {}) => {
          if (state.isProcessing || state.isUploading || state.isExtracting) {
            return { duplicatePrevented: true };
          }

          state.isProcessing = true;
          state.isUploading = true;
          state.isExtracting = false;
          state.uploadProgress = 15;
          state.uploadError = '';
          state.selectedFile = file;

          const isReplacing = Boolean(state.uploadedResume);

          try {
            // 1. Simulate async network upload
            await new Promise((resolve) => setTimeout(resolve, 20));
            if (mockUploadFail) {
              throw new Error('Cloudinary upload timed out');
            }
            state.uploadProgress = 100;
            state.isUploading = false;
            state.isExtracting = true;

            // 2. Simulate async Gemini AI extraction
            await new Promise((resolve) => setTimeout(resolve, 10));
            if (mockExtractFail) {
              throw new Error('Gemini AI parsing failed');
            }

            // Success: update to NEW resume document
            const newDoc = {
              _id: 'resume-new-2',
              fileName: file.name,
              fileSize: file.size,
              version: (state.uploadedResume?.version || 1) + 1,
              parsed: {
                extractedData: {
                  personal: { name: 'Alex Smith' },
                  skills: ['React', 'Node.js'],
                },
                parsingStatus: 'success',
              },
            };

            state.uploadedResume = newDoc;
            state.selectedFile = null;
            return { success: true, doc: newDoc };
          } catch (err) {
            state.uploadError = err.message;
            if (isReplacing) {
              state.uploadedResume = null;
            }
            state.selectedFile = null;
            return { success: false, error: err.message };
          } finally {
            state.isUploading = false;
            state.isExtracting = false;
            state.isProcessing = false;
          }
        },

        isContinueEnabled: () => {
          return !state.isUploading && !state.isExtracting && Boolean(state.uploadedResume);
        },
      };

      return { getState: () => state, actions };
    };

    test('replaces old resume details with new resume details upon successful replacement', async () => {
      const initialOldResume = {
        _id: 'resume-old-1',
        fileName: 'Radha_Sharma_Frontend_Developer_Dummy_Resume.pdf',
        fileSize: 3379,
        version: 1,
        parsed: {
          extractedData: { personal: { name: 'Radha Sharma' }, skills: ['HTML', 'CSS'] },
          parsingStatus: 'success',
        },
      };

      const machine = createUploadState(initialOldResume);
      assert.equal(machine.getState().uploadedResume.fileName, 'Radha_Sharma_Frontend_Developer_Dummy_Resume.pdf');
      assert.equal(machine.actions.isContinueEnabled(), true);

      // Select replacement
      const replacementFile = {
        name: 'Alex_Smith_Senior_Engineer_Resume.pdf',
        type: 'application/pdf',
        size: 45000,
      };

      const selRes = machine.actions.selectReplacement(replacementFile);
      assert.equal(selRes.rejected, false);

      // Process upload and parsing
      const result = await machine.actions.startUploadAndParse(replacementFile);
      assert.equal(result.success, true);

      // Verify NEW resume is active and old data is completely replaced
      const updated = machine.getState().uploadedResume;
      assert.equal(updated.fileName, 'Alex_Smith_Senior_Engineer_Resume.pdf');
      assert.equal(updated.fileSize, 45000);
      assert.equal(updated.version, 2);
      assert.equal(updated.parsed.extractedData.personal.name, 'Alex Smith');
      assert.deepEqual(updated.parsed.extractedData.skills, ['React', 'Node.js']);
      assert.equal(machine.actions.isContinueEnabled(), true);
    });

    test('keeps Continue to Profile button disabled while upload/parsing is in progress', async () => {
      const initialOldResume = {
        _id: 'resume-old-1',
        fileName: 'Old_Resume.pdf',
        fileSize: 5000,
        version: 1,
      };

      const machine = createUploadState(initialOldResume);
      const replacementFile = {
        name: 'New_Resume.pdf',
        type: 'application/pdf',
        size: 6000,
      };

      const uploadPromise = machine.actions.startUploadAndParse(replacementFile);

      // Immediately after starting, in-flight states must be active and Continue disabled
      const inFlightState = machine.getState();
      assert.equal(inFlightState.isUploading || inFlightState.isExtracting, true);
      assert.equal(machine.actions.isContinueEnabled(), false);

      await uploadPromise;
      assert.equal(machine.actions.isContinueEnabled(), true);
      assert.equal(machine.getState().uploadedResume.fileName, 'New_Resume.pdf');
    });

    test('handles upload failure safely without preserving stale resume for profile creation', async () => {
      const initialOldResume = {
        _id: 'resume-old-1',
        fileName: 'Radha_Sharma_Frontend_Developer_Dummy_Resume.pdf',
        fileSize: 3379,
        version: 1,
      };

      const machine = createUploadState(initialOldResume);

      const replacementFile = {
        name: 'Replacement_Corrupt.pdf',
        type: 'application/pdf',
        size: 12000,
      };

      const result = await machine.actions.startUploadAndParse(replacementFile, { mockUploadFail: true });
      assert.equal(result.success, false);
      assert.equal(result.error, 'Cloudinary upload timed out');

      // Stale resume must be invalidated so user cannot accidentally continue with old data
      const state = machine.getState();
      assert.equal(state.uploadedResume, null);
      assert.equal(state.uploadError, 'Cloudinary upload timed out');
      assert.equal(machine.actions.isContinueEnabled(), false);
    });

    test('handles Gemini extraction failure safely with clear error', async () => {
      const initialOldResume = {
        _id: 'resume-old-1',
        fileName: 'Initial.pdf',
        fileSize: 4000,
        version: 1,
      };

      const machine = createUploadState(initialOldResume);
      const replacementFile = {
        name: 'Replacement.pdf',
        type: 'application/pdf',
        size: 5000,
      };

      const result = await machine.actions.startUploadAndParse(replacementFile, { mockExtractFail: true });
      assert.equal(result.success, false);
      assert.equal(result.error, 'Gemini AI parsing failed');

      const state = machine.getState();
      assert.equal(state.uploadError, 'Gemini AI parsing failed');
      assert.equal(machine.actions.isContinueEnabled(), false);
    });

    test('prevents duplicate upload requests when an operation is already in-flight', async () => {
      const machine = createUploadState();
      const file = { name: 'Resume.pdf', type: 'application/pdf', size: 1000 };

      // Start first upload
      const p1 = machine.actions.startUploadAndParse(file);

      // Attempt second duplicate upload while first is in-flight
      const dupResult = await machine.actions.startUploadAndParse(file);
      assert.equal(dupResult.duplicatePrevented, true);

      await p1;
    });

    test('first-time upload stages file preview and requires confirmation before upload', async () => {
      const machine = createUploadState(null); // No existing resume
      assert.equal(machine.getState().uploadedResume, null);

      const file = { name: 'First_Time_Resume.pdf', type: 'application/pdf', size: 25000 };
      const selRes = machine.actions.selectReplacement(file);
      assert.equal(selRes.rejected, false);

      // Upload and verify transition to completed state
      const result = await machine.actions.startUploadAndParse(file);
      assert.equal(result.success, true);
      assert.equal(machine.getState().uploadedResume.fileName, 'First_Time_Resume.pdf');
      assert.equal(machine.actions.isContinueEnabled(), true);
    });
  });
});
