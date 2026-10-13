import mongoose from 'mongoose';

const resumeSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID reference is required'],
      index: true,
    },
    fileName: {
      type: String,
      required: [true, 'File name is required'],
      trim: true,
    },
    fileType: {
      type: String,
      default: 'application/pdf',
      trim: true,
    },
    fileSize: {
      type: Number,
      default: 0, // In bytes
    },
    storageUrl: {
      type: String,
      default: '',
      trim: true,
    },
    publicId: {
      type: String,
      default: '',
      trim: true,
    },
    version: {
      type: Number,
      default: 1,
      min: 1,
    },
    parsed: {
      type: mongoose.Schema.Types.Mixed,
      default: () => ({
        rawText: '',
        extractedData: null,
        parsingStatus: 'pending', // 'pending' | 'processing' | 'success' | 'failed'
      }),
    },
  },
  {
    timestamps: { createdAt: 'uploadedAt', updatedAt: 'updatedAt' },
  }
);

export const Resume = mongoose.model('Resume', resumeSchema);
export default Resume;
