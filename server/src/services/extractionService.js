import { createRequire } from 'module';
import mammoth from 'mammoth';
import { logger } from '../utils/logger.js';

const require = createRequire(import.meta.url);
const { PDFParse } = require('pdf-parse');

/**
 * Extract raw text from a PDF document buffer using pdf-parse.
 *
 * @param {Buffer} buffer - Binary file buffer
 * @returns {Promise<string>} Clean, extracted plaintext
 */
export const extractTextFromPdf = async (buffer) => {
  if (!buffer || !Buffer.isBuffer(buffer) || buffer.length === 0) {
    throw new Error('Valid, non-empty buffer is required for PDF text extraction');
  }

  let parser = null;
  try {
    parser = new PDFParse({ data: buffer });
    const result = await parser.getText();
    const text = (result?.text || '').trim();

    if (!text) {
      throw new Error(
        'No readable text could be extracted from this PDF. It may be image-only, scanned, or password protected.'
      );
    }

    logger.info(`Successfully extracted ${text.length} characters of text from PDF document.`);
    return text;
  } catch (error) {
    logger.error('PDF text extraction failure:', error?.message);
    throw new Error(`Failed to extract text from PDF: ${error.message}`);
  } finally {
    if (parser && typeof parser.destroy === 'function') {
      try {
        await parser.destroy();
      } catch (destroyErr) {
        // Suppress cleanup warning
      }
    }
  }
};

/**
 * Extract raw text from a DOCX document buffer using mammoth.
 *
 * @param {Buffer} buffer - Binary file buffer
 * @returns {Promise<string>} Clean, extracted plaintext
 */
export const extractTextFromDocx = async (buffer) => {
  if (!buffer || !Buffer.isBuffer(buffer) || buffer.length === 0) {
    throw new Error('Valid, non-empty buffer is required for DOCX text extraction');
  }

  try {
    const result = await mammoth.extractRawText({ buffer });
    const text = (result?.value || '').trim();

    if (!text) {
      throw new Error('No readable text could be extracted from this Word (.docx) document.');
    }

    logger.info(`Successfully extracted ${text.length} characters of text from DOCX document.`);
    return text;
  } catch (error) {
    logger.error('DOCX text extraction failure:', error?.message);
    throw new Error(`Failed to extract text from Word document: ${error.message}`);
  }
};

/**
 * Central text extraction function detecting format by file extension or MIME type.
 *
 * @param {Buffer} buffer - Document buffer
 * @param {string} fileNameOrMime - Original filename or MIME type
 * @returns {Promise<string>} Clean plaintext
 */
export const extractResumeText = async (buffer, fileNameOrMime = '') => {
  if (!buffer || !Buffer.isBuffer(buffer)) {
    throw new Error('Valid file buffer is required for resume text extraction');
  }

  const identifier = (fileNameOrMime || '').toLowerCase();
  const isDocx =
    identifier.endsWith('.docx') ||
    identifier.endsWith('.doc') ||
    identifier.includes('wordprocessingml') ||
    identifier.includes('msword');

  if (isDocx) {
    return extractTextFromDocx(buffer);
  }

  // Default to PDF parser for .pdf or application/pdf
  return extractTextFromPdf(buffer);
};

export default {
  extractResumeText,
  extractTextFromPdf,
  extractTextFromDocx,
};
