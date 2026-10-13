import { v2 as cloudinary } from 'cloudinary';
import { env } from './env.js';
import { logger } from '../utils/logger.js';

let isCloudinaryConfigured = false;

if (
  env.CLOUDINARY.CLOUD_NAME &&
  env.CLOUDINARY.API_KEY &&
  env.CLOUDINARY.API_SECRET &&
  env.CLOUDINARY.CLOUD_NAME !== 'your-cloudinary-cloud-name'
) {
  try {
    cloudinary.config({
      cloud_name: env.CLOUDINARY.CLOUD_NAME,
      api_key: env.CLOUDINARY.API_KEY,
      api_secret: env.CLOUDINARY.API_SECRET,
      secure: true,
    });
    isCloudinaryConfigured = true;
    logger.info('Cloudinary configured successfully.');
  } catch (err) {
    logger.error('Failed to configure Cloudinary:', err?.message);
    isCloudinaryConfigured = false;
  }
} else {
  logger.warn(
    'Cloudinary credentials not provided or incomplete. Please set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET in server/.env'
  );
}

export { cloudinary, isCloudinaryConfigured };
export default cloudinary;
