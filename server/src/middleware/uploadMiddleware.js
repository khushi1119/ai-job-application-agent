import multer from 'multer';
import path from 'path';
import { sendError } from '../utils/apiResponse.js';

// Use memory storage so file is buffered in RAM before uploading to Cloudinary
const storage = multer.memoryStorage();

export const ALLOWED_EXTENSIONS = ['.pdf', '.docx', '.doc'];

export const ALLOWED_MIME_TYPES = {
  '.pdf': ['application/pdf', 'application/x-pdf'],
  '.docx': [
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/zip',
    'application/x-zip-compressed',
    'application/octet-stream',
  ],
  '.doc': ['application/msword', 'application/octet-stream'],
};

// Known dangerous/disallowed magic byte signatures
const DISALLOWED_SIGNATURES = [
  { name: 'Windows PE / Executable', bytes: [0x4d, 0x5a] }, // MZ
  { name: 'Linux ELF Executable', bytes: [0x7f, 0x45, 0x4c, 0x46] }, // \x7fELF
  { name: 'Java Class Bytecode', bytes: [0xca, 0xfe, 0xba, 0xbe] },
];

/**
 * Detect the underlying file format from buffer magic bytes.
 * Returns 'pdf' | 'docx' | 'doc' | 'disallowed' | 'zip_non_docx' | 'unknown' | 'empty'
 */
export const detectFileFormat = (buffer) => {
  if (!buffer || !Buffer.isBuffer(buffer) || buffer.length === 0) {
    return 'empty';
  }

  // Check disallowed executable signatures first
  for (const sig of DISALLOWED_SIGNATURES) {
    if (buffer.length >= sig.bytes.length) {
      const matches = sig.bytes.every((b, i) => buffer[i] === b);
      if (matches) return 'disallowed';
    }
  }

  // Check for HTML / script headers
  const textPrefix = buffer
    .subarray(0, Math.min(buffer.length, 512))
    .toString('utf8')
    .trim()
    .toLowerCase();

  if (
    textPrefix.startsWith('<!doctype html') ||
    textPrefix.startsWith('<html') ||
    textPrefix.startsWith('<script') ||
    textPrefix.startsWith('<?php') ||
    textPrefix.startsWith('#!/')
  ) {
    return 'disallowed';
  }

  // PDF signature: Starts with %PDF- (0x25, 0x50, 0x44, 0x46, 0x2D)
  if (buffer.length >= 4 && buffer.subarray(0, 4).toString('ascii') === '%PDF') {
    return 'pdf';
  }

  // DOCX signature: ZIP container (PK\x03\x04: 0x50, 0x4B, 0x03, 0x04)
  // containing OpenPackaging / Office Word structures ([Content_Types].xml or word/)
  if (
    buffer.length >= 4 &&
    buffer[0] === 0x50 &&
    buffer[1] === 0x4b &&
    buffer[2] === 0x03 &&
    buffer[3] === 0x04
  ) {
    const bufferString = buffer.toString('binary');
    if (bufferString.includes('[Content_Types].xml') || bufferString.includes('word/')) {
      return 'docx';
    }
    // Generic zip archive that is not a DOCX document
    return 'zip_non_docx';
  }

  // Legacy Word DOC signature: Compound File Binary (0xD0, 0xCF, 0x11, 0xE0)
  if (
    buffer.length >= 4 &&
    buffer[0] === 0xd0 &&
    buffer[1] === 0xcf &&
    buffer[2] === 0x11 &&
    buffer[3] === 0xe0
  ) {
    return 'doc';
  }

  return 'unknown';
};

/**
 * Validates uploaded file buffer against original filename and MIME type.
 * Ensures the extension is allowed, client MIME type matches extension,
 * and actual content matches expected magic bytes without executable payloads.
 *
 * @param {Buffer} buffer - In-memory file buffer
 * @param {string} originalname - Original file name
 * @param {string} mimetype - Client-supplied MIME type
 * @returns {{ valid: boolean, error?: string, code?: string }}
 */
export const validateResumeBuffer = (buffer, originalname = '', mimetype = '') => {
  if (!buffer || !Buffer.isBuffer(buffer) || buffer.length === 0) {
    return {
      valid: false,
      error: 'Uploaded file is empty. Please upload a valid resume document.',
      code: 'FILE_EMPTY',
    };
  }

  if (buffer.length < 32) {
    return {
      valid: false,
      error: 'File content is too small to be a valid resume document.',
      code: 'INVALID_FILE_CONTENT',
    };
  }

  const ext = path.extname(originalname || '').toLowerCase();
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    return {
      valid: false,
      error: `Invalid file extension (${ext || 'none'}). Only PDF (.pdf) and Word (.docx) documents are allowed.`,
      code: 'INVALID_FILE_TYPE',
    };
  }

  const allowedMimes = ALLOWED_MIME_TYPES[ext] || [];
  const normalizedMime = (mimetype || '').trim().toLowerCase();
  if (normalizedMime && !allowedMimes.includes(normalizedMime)) {
    return {
      valid: false,
      error: `MIME type "${mimetype}" does not match the expected type for ${ext} files.`,
      code: 'FILE_TYPE_MISMATCH',
    };
  }

  const detectedFormat = detectFileFormat(buffer);

  if (detectedFormat === 'disallowed') {
    return {
      valid: false,
      error: 'File contains forbidden executable or script content.',
      code: 'INVALID_FILE_CONTENT',
    };
  }

  if (ext === '.pdf') {
    if (detectedFormat !== 'pdf') {
      return {
        valid: false,
        error:
          detectedFormat === 'docx'
            ? 'File has a .pdf extension but contains Word document (DOCX) content.'
            : 'File content does not match a valid PDF document signature (%PDF-).',
        code: 'FILE_TYPE_MISMATCH',
      };
    }
  } else if (ext === '.docx') {
    if (detectedFormat !== 'docx') {
      return {
        valid: false,
        error:
          detectedFormat === 'pdf'
            ? 'File has a .docx extension but contains PDF document content.'
            : detectedFormat === 'zip_non_docx'
            ? 'File is a ZIP archive but does not contain a valid Word document structure.'
            : 'File content does not match a valid Word document (.docx) structure.',
        code: 'FILE_TYPE_MISMATCH',
      };
    }
  } else if (ext === '.doc') {
    if (detectedFormat !== 'doc') {
      return {
        valid: false,
        error: 'File content does not match a valid legacy Word document (.doc) structure.',
        code: 'FILE_TYPE_MISMATCH',
      };
    }
  }

  return { valid: true };
};

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB limit

const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname || '').toLowerCase();
  const mime = (file.mimetype || '').trim().toLowerCase();

  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    const error = new Error('Invalid file extension. Only PDF (.pdf) and Word (.docx) documents are allowed.');
    error.code = 'INVALID_FILE_TYPE';
    return cb(error, false);
  }

  const allowedMimes = ALLOWED_MIME_TYPES[ext] || [];
  // Require MIME type to match the allowed list for this extension
  if (mime && !allowedMimes.includes(mime)) {
    const error = new Error(`MIME type "${file.mimetype}" does not match extension "${ext}".`);
    error.code = 'FILE_TYPE_MISMATCH';
    return cb(error, false);
  }

  cb(null, true);
};

const upload = multer({
  storage,
  limits: {
    fileSize: MAX_FILE_SIZE_BYTES,
    files: 1,
  },
  fileFilter,
});

/**
 * Middleware wrapper for single resume file upload with field name 'file'.
 * Gracefully handles Multer errors and validates file existence and buffer contents.
 */
export const handleResumeUpload = (req, res, next) => {
  const singleUpload = upload.single('file');

  singleUpload(req, res, (err) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return sendError(
            res,
            'File size exceeds the 10 MB limit. Please upload a smaller file.',
            400,
            'FILE_TOO_LARGE'
          );
        }
        return sendError(res, `Upload validation error: ${err.message}`, 400, err.code);
      }
      if (err.code === 'INVALID_FILE_TYPE') {
        return sendError(
          res,
          'Invalid file format. Please upload a valid PDF (.pdf) or Word document (.docx).',
          400,
          'INVALID_FILE_TYPE'
        );
      }
      if (err.code === 'FILE_TYPE_MISMATCH') {
        return sendError(
          res,
          err.message || 'File extension and MIME type mismatch.',
          400,
          'FILE_TYPE_MISMATCH'
        );
      }
      return sendError(res, err.message || 'File upload failed', 400, 'UPLOAD_ERROR');
    }

    // Validate actual file buffer content if a file was uploaded
    if (req.file) {
      const validation = validateResumeBuffer(
        req.file.buffer,
        req.file.originalname,
        req.file.mimetype
      );

      if (!validation.valid) {
        return sendError(res, validation.error, 400, validation.code);
      }
    }

    next();
  });
};

export default handleResumeUpload;
