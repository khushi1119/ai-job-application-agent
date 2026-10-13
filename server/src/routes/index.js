import { Router } from 'express';
import healthRoutes from './healthRoutes.js';
import authRoutes from './authRoutes.js';
import resumeRoutes from './resumeRoutes.js';
import profileRoutes from './profileRoutes.js';
import jobRoutes from './jobRoutes.js';
import savedJobRoutes from './savedJobRoutes.js';
import applicationRoutes from './applicationRoutes.js';

const router = Router();

// Mount modular sub-routers
router.use('/health', healthRoutes);
router.use('/auth', authRoutes);
router.use('/resumes', resumeRoutes);
router.use('/profile', profileRoutes);
router.use('/jobs', jobRoutes);
router.use('/saved-jobs', savedJobRoutes);
router.use('/applications', applicationRoutes);
// router.use('/users', userRoutes);

export default router;

