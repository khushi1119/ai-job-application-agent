import Resume from '../models/Resume.js';
import User from '../models/User.js';
import { deleteResumeFromCloudinary } from './cloudinaryService.js';
import { logger } from '../utils/logger.js';

/**
 * Create or update a Resume document for a user.
 * If a resume already exists for the user, increments version and updates metadata.
 *
 * @param {Object} params
 * @param {string|mongoose.Types.ObjectId} params.userId - MongoDB User ID
 * @param {string} params.fileName - Original file name
 * @param {string} params.fileType - MIME type
 * @param {number} params.fileSize - File size in bytes
 * @param {string} params.storageUrl - Secure URL in Cloudinary
 * @param {string} [params.publicId] - Cloudinary asset public ID
 * @returns {Promise<Resume>} Created or updated Resume document
 */
export const createOrUpdateResume = async ({
  userId,
  fileName,
  fileType = 'application/pdf',
  fileSize = 0,
  storageUrl = '',
  publicId = '',
  rawText = '',
  extractedData = null,
  parsingStatus = 'pending',
}) => {
  if (!userId) {
    throw new Error('User ID is required to associate resume document');
  }
  if (!fileName) {
    throw new Error('File name is required');
  }

  // Verify that the user exists in MongoDB
  const user = await User.findById(userId);
  if (!user) {
    throw new Error('User not found');
  }

  // Find existing resume for this user
  let existingResume = await Resume.findOne({ userId }).sort({ version: -1 });

  let resume;
  if (existingResume) {
    const nextVersion = (existingResume.version || 1) + 1;
    logger.info(`Updating existing Resume document for user ${userId} to version ${nextVersion}`);

    // If an older publicId exists and differs, clean up previous file from Cloudinary in background
    if (existingResume.publicId && existingResume.publicId !== publicId) {
      deleteResumeFromCloudinary(existingResume.publicId).catch((err) =>
        logger.warn('Failed to delete old resume from Cloudinary:', err?.message)
      );
    }

    existingResume.fileName = fileName;
    existingResume.fileType = fileType;
    existingResume.fileSize = fileSize;
    existingResume.storageUrl = storageUrl;
    existingResume.publicId = publicId || existingResume.publicId || '';
    existingResume.version = nextVersion;
    existingResume.parsed = {
      rawText: rawText || '',
      extractedData: extractedData || null,
      parsingStatus: parsingStatus || 'pending',
    };
    existingResume.uploadedAt = new Date();

    resume = await existingResume.save();
  } else {
    logger.info(`Creating initial Resume document for user ${userId}`);

    resume = await Resume.create({
      userId,
      fileName,
      fileType,
      fileSize,
      storageUrl,
      publicId,
      version: 1,
      parsed: {
        rawText: rawText || '',
        extractedData: extractedData || null,
        parsingStatus: parsingStatus || 'pending',
      },
    });
  }

  return resume;
};

/**
 * Retrieve the latest resume for a user
 * @param {string|mongoose.Types.ObjectId} userId
 * @returns {Promise<Resume|null>}
 */
export const getResumeByUserId = async (userId) => {
  return Resume.findOne({ userId }).sort({ version: -1 });
};

export default {
  createOrUpdateResume,
  getResumeByUserId,
};
