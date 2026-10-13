import mongoose from 'mongoose';

const jobSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    company: {
      type: String,
      required: true,
      trim: true,
    },
    location: {
      type: String,
      default: 'Remote',
    },
    description: {
      type: String,
      default: '',
    },
    requirements: [{ type: String }],
    salaryRange: {
      min: { type: Number },
      max: { type: Number },
      currency: { type: String, default: 'USD' },
    },
    sourceUrl: {
      type: String,
      required: true,
    },
    platform: {
      type: String,
      enum: ['linkedin', 'indeed', 'glassdoor', 'greenhouse', 'lever', 'ashby', 'other'],
      default: 'other',
    },
    status: {
      type: String,
      enum: ['discovered', 'analyzed', 'applied', 'rejected', 'interviewing', 'archived'],
      default: 'discovered',
    },
    externalId: {
      type: String,
      trim: true,
      default: '',
    },
    lastVerifiedAt: {
      type: Date,
      default: null,
      index: true,
    },
    isClosed: {
      type: Boolean,
      default: false,
      index: true,
    },
    closedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for query performance and deduplication
jobSchema.index({ platform: 1, externalId: 1 });
jobSchema.index({ sourceUrl: 1 });
jobSchema.index({ company: 1, platform: 1, isClosed: 1 });
jobSchema.index({ isClosed: 1, status: 1, createdAt: -1 });
jobSchema.index({ title: 'text', company: 'text', description: 'text' });

export const Job = mongoose.model('Job', jobSchema);
export default Job;
