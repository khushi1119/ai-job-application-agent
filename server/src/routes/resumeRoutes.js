import { Router } from 'express';
import { requireAuth } from '../middleware/authMiddleware.js';
import { handleResumeUpload } from '../middleware/uploadMiddleware.js';
import {
  resumeUploadLimiter,
  resumeExtractLimiter,
} from '../middleware/rateLimitMiddleware.js';
import {
  uploadResume,
  extractResumeData,
  saveResume,
  getMyResume,
  downloadMyResume,
} from '../controllers/resumeController.js';

const router = Router();

/**
 * @route   POST /api/resumes/upload
 * @desc    Upload resume document (PDF/DOCX) to Cloudinary and persist metadata in MongoDB
 * @access  Private (Requires Bearer Firebase ID Token)
 */
router.post('/upload', requireAuth, resumeUploadLimiter, handleResumeUpload, uploadResume);

/**
 * @route   POST /api/resumes/extract
 * @desc    Extract text and parse resume using Gemini AI to populate candidate profile
 * @access  Private (Requires Bearer Firebase ID Token)
 */
router.post('/extract', requireAuth, resumeExtractLimiter, extractResumeData);

/**
 * @route   POST /api/resumes
 * @desc    Upload resume document (multipart) or save resume metadata in MongoDB
 * @access  Private (Requires Bearer Firebase ID Token)
 */
router.post('/', requireAuth, resumeUploadLimiter, handleResumeUpload, (req, res, next) => {
  if (req.file) {
    return uploadResume(req, res, next);
  }
  return saveResume(req, res, next);
});

/**
 * @route   GET /api/resumes/me
 * @desc    Get current authenticated user's resume document
 * @access  Private (Requires Bearer Firebase ID Token)
 */
router.get('/me', requireAuth, getMyResume);

/**
 * @route   GET /api/resumes/download
 * @desc    Securely download/stream current user's resume document
 * @access  Private (Requires Bearer Firebase ID Token)
 */
router.get('/download', requireAuth, downloadMyResume);

export default router;

