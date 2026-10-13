import { Readable } from 'stream';
import path from 'path';
import { cloudinary, isCloudinaryConfigured } from '../config/cloudinary.js';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

/**
 * Upload a resume buffer to Cloudinary under user-specific folder using resource_type: "raw".
 *
 * @param {Buffer} fileBuffer - File buffer from multer memory storage
 * @param {string} fileName - Original file name
 * @param {string} userId - MongoDB User ID
 * @returns {Promise<{ secureUrl: string, publicId: string, bytes: number }>}
 */
export const uploadResumeToCloudinary = async (fileBuffer, fileName, userId) => {
  if (!fileBuffer || !Buffer.isBuffer(fileBuffer)) {
    throw new Error('Valid file buffer is required for Cloudinary upload');
  }
  if (!userId) {
    throw new Error('User ID is required for user-specific resume storage');
  }

  const ext = path.extname(fileName || '').toLowerCase() || '.pdf';
  const rawBaseName = path.basename(fileName || 'resume', ext);
  const sanitizedBaseName = rawBaseName.replace(/[^a-zA-Z0-9_-]/g, '_');
  const timestamp = Date.now();

  // For raw resources in Cloudinary, include extension in public_id
  const fileNameWithExt = `${timestamp}_${sanitizedBaseName}${ext}`;
  const folderPath = `resumes/${userId}`;
  const fullPublicId = `${folderPath}/${fileNameWithExt}`;

  // Fail clearly if Cloudinary is not configured in environment
  if (!isCloudinaryConfigured) {
    throw new Error(
      'Cloudinary credentials are not configured. Please set valid CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET in server/.env'
    );
  }

  return new Promise((resolve, reject) => {
    try {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: folderPath,
          public_id: fileNameWithExt,
          resource_type: 'raw',
          use_filename: false,
          unique_filename: false,
          overwrite: true,
        },
        (error, result) => {
          if (error) {
            logger.error('Cloudinary raw upload stream failed:', error);
            return reject(new Error(error.message || 'Cloudinary upload failed'));
          }

          logger.info(`Successfully uploaded resume to Cloudinary: ${result.secure_url}`);
          resolve({
            secureUrl: result.secure_url,
            publicId: result.public_id,
            bytes: result.bytes || fileBuffer.length,
          });
        }
      );

      // Pipe the memory buffer to the upload stream
      Readable.from(fileBuffer).pipe(uploadStream);
    } catch (err) {
      logger.error('Unexpected exception during Cloudinary upload stream creation:', err);
      reject(err);
    }
  });
};

/**
 * Remove an old resume file from Cloudinary by its publicId.
 *
 * @param {string} publicId - Cloudinary publicId
 * @returns {Promise<void>}
 */
export const deleteResumeFromCloudinary = async (publicId) => {
  if (!publicId || !isCloudinaryConfigured) return;

  try {
    const result = await cloudinary.uploader.destroy(publicId, { resource_type: 'raw' });
    logger.info(`Deleted old Cloudinary asset (${publicId}):`, result);
  } catch (error) {
    logger.warn(`Failed to delete previous Cloudinary asset (${publicId}):`, error?.message);
  }
};

/**
 * Download a resume file buffer from Cloudinary.
 * Uses private_download_url when publicId is present (handles private/raw assets).
 * Falls back to direct fetch of storageUrl.
 *
 * @param {string} publicId - Cloudinary public ID
 * @param {string} storageUrl - Direct storage URL fallback
 * @returns {Promise<Buffer>}
 */
export const downloadResumeFromCloudinary = async (publicId, storageUrl) => {
  let downloadUrl = '';

  if (publicId && isCloudinaryConfigured) {
    try {
      downloadUrl = cloudinary.utils.private_download_url(publicId, '', {
        resource_type: 'raw',
        type: 'upload',
      });
    } catch (signErr) {
      logger.warn('Failed to generate private download URL for Cloudinary:', signErr.message);
    }
  }

  if (!downloadUrl && storageUrl) {
    downloadUrl = storageUrl;
  }

  if (!downloadUrl) {
    throw new Error('No valid publicId or storageUrl provided to download resume from Cloudinary');
  }

  const response = await fetch(downloadUrl);
  if (!response.ok) {
    // If private download failed and storageUrl is different, try storageUrl
    if (storageUrl && downloadUrl !== storageUrl) {
      const fallbackResp = await fetch(storageUrl);
      if (fallbackResp.ok) {
        return Buffer.from(await fallbackResp.arrayBuffer());
      }
    }
    throw new Error(
      `Failed to download resume file from Cloudinary (${response.status} ${response.statusText})`
    );
  }

  return Buffer.from(await response.arrayBuffer());
};

/**
 * Generate a secure, time-limited signed download URL for a resume asset.
 * Uses Cloudinary HMAC-SHA1 signature and timestamp-based expiry.
 *
 * @param {string} publicId - Cloudinary public ID
 * @param {number} [expiresInSeconds=3600] - Expiration duration in seconds (default 1 hr)
 * @returns {string} Signed download URL or empty string
 */
export const generateSignedResumeUrl = (publicId, expiresInSeconds = 3600) => {
  if (!publicId || !isCloudinaryConfigured) return '';

  try {
    const expiresAt = Math.floor(Date.now() / 1000) + expiresInSeconds;
    return cloudinary.utils.private_download_url(publicId, '', {
      resource_type: 'raw',
      type: 'upload',
      expires_at: expiresAt,
    });
  } catch (err) {
    logger.warn('Failed to generate signed download URL for resume:', err?.message);
    return '';
  }
};

export default {
  uploadResumeToCloudinary,
  deleteResumeFromCloudinary,
  downloadResumeFromCloudinary,
  generateSignedResumeUrl,
};
