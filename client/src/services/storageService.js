import { resumeService } from './api.js';

/**
 * Upload resume file using the secure backend Cloudinary pipeline.
 *
 * @param {File} file - Browser File object
 * @param {string} [_userId] - Optional user identifier (managed via auth session)
 * @param {Function} [onProgress] - Upload progress callback (0 - 100)
 * @returns {Promise<{ storageUrl: string, publicId: string, fileName: string, fileSize: number, fileType: string, resume: Object }>}
 */
export const uploadResumeToStorage = async (file, _userId, onProgress = () => {}) => {
  if (!file) {
    throw new Error('No file provided for upload');
  }

  const response = await resumeService.uploadResume(file, onProgress);
  const resume = response?.data?.resume;

  return {
    storageUrl: resume?.storageUrl || '',
    publicId: resume?.publicId || '',
    fileName: resume?.fileName || file.name,
    fileSize: resume?.fileSize || file.size,
    fileType: resume?.fileType || file.type,
    resume,
  };
};

export default {
  uploadResumeToStorage,
};
