import path from 'path';
import { createOrUpdateResume, getResumeByUserId } from '../services/resumeService.js';
import {
  uploadResumeToCloudinary,
  downloadResumeFromCloudinary,
  generateSignedResumeUrl,
} from '../services/cloudinaryService.js';
import { isCloudinaryConfigured } from '../config/cloudinary.js';
import {
  validateResumeBuffer,
  ALLOWED_EXTENSIONS,
} from '../middleware/uploadMiddleware.js';
import { extractResumeText } from '../services/extractionService.js';
import { parseResumeWithGemini } from '../services/geminiService.js';
import { createOrUpdateProfile } from '../services/profileService.js';
import { findOrCreateUserFromFirebase } from '../services/userService.js';
import Resume from '../models/Resume.js';
import { sendSuccess, sendError } from '../utils/apiResponse.js';
import { logger } from '../utils/logger.js';

// Map of active user ID -> in-flight extraction promise to prevent duplicate concurrent Gemini requests
const inFlightExtractions = new Map();

/**
 * Controller to upload a resume file directly to Cloudinary and persist metadata in MongoDB.
 * Route: POST /api/resumes/upload or POST /api/resumes (multipart/form-data)
 * Access: Private (Requires Bearer Firebase ID Token)
 */
export const uploadResume = async (req, res) => {
  try {
    const uploadStart = Date.now();

    if (!req.file) {
      return sendError(
        res,
        'Please select a valid resume document (.pdf or .docx) to upload',
        400,
        'FILE_MISSING'
      );
    }

    // Defense-in-depth buffer content validation
    const validation = validateResumeBuffer(
      req.file.buffer,
      req.file.originalname,
      req.file.mimetype
    );
    if (!validation.valid) {
      return sendError(res, validation.error, 400, validation.code);
    }

    // Resolve or sync MongoDB user record
    const user = await findOrCreateUserFromFirebase(req.user);

    logger.info(
      `Uploading resume file "${req.file.originalname}" (${req.file.size} bytes) for user ${user._id} to Cloudinary...`
    );

    // Concurrently upload raw buffer to Cloudinary and extract plaintext from buffer
    const [cloudinaryResult, rawText] = await Promise.all([
      uploadResumeToCloudinary(
        req.file.buffer,
        req.file.originalname,
        user._id.toString()
      ),
      extractResumeText(req.file.buffer, req.file.originalname).catch((extractErr) => {
        logger.warn('Text extraction during upload skipped or failed:', extractErr.message);
        return '';
      }),
    ]);

    // Persist or update Resume record in MongoDB
    const resume = await createOrUpdateResume({
      userId: user._id,
      fileName: req.file.originalname,
      fileType: req.file.mimetype || 'application/pdf',
      fileSize: req.file.size,
      storageUrl: cloudinaryResult.secureUrl,
      publicId: cloudinaryResult.publicId,
      rawText,
    });

    const uploadDurationMs = Date.now() - uploadStart;
    logger.info(`Resume uploaded and stored successfully in ${uploadDurationMs}ms for user ${user._id}`);

    return sendSuccess(
      res,
      { resume, uploadDurationMs },
      'Resume uploaded and stored in Cloudinary successfully',
      201
    );
  } catch (error) {
    logger.error('Error in uploadResume controller:', error);
    return sendError(
      res,
      error.message || 'Failed to upload and store resume',
      500,
      'RESUME_UPLOAD_FAILED'
    );
  }
};

/**
 * Controller to extract raw text, parse via Gemini AI, and populate candidate profile.
 * Route: POST /api/resumes/extract
 * Access: Private (Requires Bearer Firebase ID Token)
 */
export const extractResumeData = async (req, res) => {
  try {
    const user = await findOrCreateUserFromFirebase(req.user);
    const userIdStr = user._id.toString();

    // Deduplicate concurrent extraction requests for the same candidate
    if (inFlightExtractions.has(userIdStr)) {
      logger.info(`Resume extraction already in-flight for user ${user._id}, awaiting existing task...`);
      const result = await inFlightExtractions.get(userIdStr);
      return sendSuccess(
        res,
        result,
        'Resume text extracted, parsed with Gemini AI, and profile created successfully',
        200
      );
    }

    const extractionPromise = (async () => {
      const extractStart = Date.now();

      // 1. Locate the user's latest Resume document
      const resume = await Resume.findOne({ userId: user._id }).sort({ version: -1 });
      if (!resume) {
        const err = new Error('No resume found for this user. Please upload a resume first.');
        err.statusCode = 404;
        err.code = 'RESUME_NOT_FOUND';
        throw err;
      }

      let rawText = (resume.parsed?.rawText || '').trim();

      // 2. If rawText is not yet cached in MongoDB, download and extract
      if (!rawText) {
        if (!resume.storageUrl && !resume.publicId) {
          const err = new Error('Resume file storage information is missing. Please re-upload your resume.');
          err.statusCode = 400;
          err.code = 'STORAGE_URL_MISSING';
          throw err;
        }

        logger.info(`Fetching resume document (${resume.publicId || resume.storageUrl})...`);
        const fileBuffer = await downloadResumeFromCloudinary(resume.publicId, resume.storageUrl);
        rawText = await extractResumeText(fileBuffer, resume.fileName || resume.fileType);
      }

      if (!rawText || !rawText.trim()) {
        const err = new Error(
          'Could not extract readable text from the resume document. The file may be image-only or empty.'
        );
        err.statusCode = 422;
        err.code = 'EXTRACTION_EMPTY';
        throw err;
      }

      // Mark parsingStatus as processing non-blockingly without delaying Gemini execution
      Resume.updateOne(
        { _id: resume._id },
        { $set: { 'parsed.parsingStatus': 'processing' } }
      ).catch((statusErr) => logger.warn('Non-blocking status update failed:', statusErr.message));

      // 3. Send extracted text to Gemini AI for structured resume parsing
      logger.info(`Sending extracted text (${rawText.length} chars) to Gemini AI for user ${user._id}...`);
      const extractedData = await parseResumeWithGemini(rawText);

      // 4. Update Resume record in memory
      resume.parsed = {
        rawText,
        extractedData,
        parsingStatus: 'success',
      };

      // 5. Concurrently save parsed Resume document and create/update candidate Profile
      const [savedResume, profile] = await Promise.all([
        resume.save(),
        createOrUpdateProfile(user._id, extractedData, false),
      ]);

      const extractDurationMs = Date.now() - extractStart;
      logger.info(
        `Resume extraction and profile synchronization completed in ${extractDurationMs}ms for user ${user._id}`
      );

      return {
        resume: savedResume,
        profile,
        extractedData,
        extractDurationMs,
      };
    })();

    inFlightExtractions.set(userIdStr, extractionPromise);

    try {
      const result = await extractionPromise;
      return sendSuccess(
        res,
        result,
        'Resume text extracted, parsed with Gemini AI, and profile created successfully',
        200
      );
    } finally {
      inFlightExtractions.delete(userIdStr);
    }
  } catch (error) {
    logger.error('Error during resume extraction & Gemini parsing:', error);

    try {
      if (req.user) {
        const user = await findOrCreateUserFromFirebase(req.user);
        await Resume.findOneAndUpdate(
          { userId: user._id },
          { 'parsed.parsingStatus': 'failed' },
          { sort: { version: -1 } }
        );
      }
    } catch (statusErr) {
      // Ignore status update failure
    }

    return sendError(
      res,
      error.message || 'Failed to extract and parse resume data',
      error.statusCode || 500,
      error.code || 'EXTRACTION_FAILED'
    );
  }
};

/**
 * Controller to save resume metadata in MongoDB (JSON payload fallback).
 * Route: POST /api/resumes
 * Access: Private (Requires Bearer Firebase ID Token)
 */
export const saveResume = async (req, res) => {
  try {
    const { fileName, fileType, fileSize, storageUrl, publicId } = req.body;

    if (!fileName) {
      return sendError(res, 'File name is required', 400, 'FILE_NAME_REQUIRED');
    }

    const ext = path.extname(fileName || '').toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      return sendError(
        res,
        `Invalid file extension (${ext || 'none'}). Only PDF (.pdf) and Word (.docx) documents are allowed.`,
        400,
        'INVALID_FILE_TYPE'
      );
    }

    // Resolve or sync MongoDB user record
    const user = await findOrCreateUserFromFirebase(req.user);

    const resume = await createOrUpdateResume({
      userId: user._id,
      fileName,
      fileType: fileType || 'application/pdf',
      fileSize: Number(fileSize) || 0,
      storageUrl: storageUrl || '',
      publicId: publicId || '',
    });

    return sendSuccess(
      res,
      { resume },
      'Resume metadata saved successfully',
      201
    );
  } catch (error) {
    logger.error('Error in saveResume controller:', error);
    return sendError(res, 'Failed to save resume metadata', 500, error.message);
  }
};

/**
 * Controller to fetch current authenticated user's resume document.
 * Route: GET /api/resumes/me
 * Access: Private (Requires Bearer Firebase ID Token)
 */
export const getMyResume = async (req, res) => {
  try {
    const user = await findOrCreateUserFromFirebase(req.user);
    const resumeDoc = await getResumeByUserId(user._id);

    if (!resumeDoc) {
      return sendSuccess(
        res,
        { resume: null },
        'No resume document found for user'
      );
    }

    const resume = resumeDoc.toObject ? resumeDoc.toObject() : { ...resumeDoc };

    // If Cloudinary is configured and publicId exists, generate a fresh time-limited signed URL
    if (resume.publicId && isCloudinaryConfigured) {
      const signedUrl = generateSignedResumeUrl(resume.publicId, 3600);
      if (signedUrl) {
        resume.storageUrl = signedUrl;
      }
    }

    return sendSuccess(
      res,
      { resume },
      'Resume retrieved successfully'
    );
  } catch (error) {
    logger.error('Error in getMyResume controller:', error);
    return sendError(res, 'Failed to retrieve resume document', 500, error.message);
  }
};

/**
 * Controller to securely download/view current authenticated user's resume document directly.
 * Route: GET /api/resumes/download
 * Access: Private (Requires Bearer Firebase ID Token)
 */
export const downloadMyResume = async (req, res) => {
  try {
    const user = await findOrCreateUserFromFirebase(req.user);
    const resume = await getResumeByUserId(user._id);

    if (!resume) {
      return sendError(
        res,
        'No resume document found for this user',
        404,
        'RESUME_NOT_FOUND'
      );
    }

    if (!resume.publicId && !resume.storageUrl) {
      return sendError(
        res,
        'Resume file location is missing',
        404,
        'STORAGE_URL_MISSING'
      );
    }

    const fileBuffer = await downloadResumeFromCloudinary(resume.publicId, resume.storageUrl);

    res.setHeader('Content-Type', resume.fileType || 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${encodeURIComponent(resume.fileName || 'resume.pdf')}"`
    );
    return res.send(fileBuffer);
  } catch (error) {
    logger.error('Error in downloadMyResume controller:', error);
    return sendError(res, 'Failed to download resume file', 500, 'DOWNLOAD_FAILED');
  }
};

export default {
  uploadResume,
  extractResumeData,
  saveResume,
  getMyResume,
  downloadMyResume,
};

