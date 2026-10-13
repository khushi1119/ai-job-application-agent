import mongoose from 'mongoose';

const educationSchema = new mongoose.Schema(
  {
    institution: { type: String, default: '', trim: true },
    degree: { type: String, default: '', trim: true },
    fieldOfStudy: { type: String, default: '', trim: true },
    startDate: { type: Date, default: null },
    endDate: { type: Date, default: null },
    current: { type: Boolean, default: false },
    gpa: { type: String, default: '', trim: true },
  },
  { _id: true }
);

const experienceSchema = new mongoose.Schema(
  {
    company: { type: String, default: '', trim: true },
    role: { type: String, default: '', trim: true },
    location: { type: String, default: '', trim: true },
    startDate: { type: Date, default: null },
    endDate: { type: Date, default: null },
    current: { type: Boolean, default: false },
    highlights: [{ type: String, trim: true }],
    technologies: [{ type: String, trim: true }],
  },
  { _id: true }
);

const projectSchema = new mongoose.Schema(
  {
    title: { type: String, default: '', trim: true },
    description: { type: String, default: '', trim: true },
    liveUrl: { type: String, default: '', trim: true },
    githubUrl: { type: String, default: '', trim: true },
    technologies: [{ type: String, trim: true }],
  },
  { _id: true }
);

const certificationSchema = new mongoose.Schema(
  {
    name: { type: String, default: '', trim: true },
    issuer: { type: String, default: '', trim: true },
    issueDate: { type: Date, default: null },
    expiryDate: { type: Date, default: null },
    credentialId: { type: String, default: '', trim: true },
    url: { type: String, default: '', trim: true },
  },
  { _id: true }
);

const profileSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID reference is required'],
      unique: true,
      index: true,
    },
    personal: {
      name: { type: String, default: '', trim: true },
      email: { type: String, default: '', trim: true, lowercase: true },
      phone: { type: String, default: '', trim: true },
      location: { type: String, default: '', trim: true },
      portfolioUrl: { type: String, default: '', trim: true },
      linkedinUrl: { type: String, default: '', trim: true },
      githubUrl: { type: String, default: '', trim: true },
    },
    summary: {
      type: String,
      default: '',
      trim: true,
    },
    skills: [
      {
        type: String,
        trim: true,
      },
    ],
    education: [educationSchema],
    experience: [experienceSchema],
    projects: [projectSchema],
    certifications: [certificationSchema],
    completionPercentage: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
  },
  {
    timestamps: true,
  }
);

export const Profile = mongoose.model('Profile', profileSchema);
export default Profile;
