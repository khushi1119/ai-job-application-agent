import { Router } from 'express';
import { checkHealth } from '../controllers/healthController.js';

const router = Router();

// GET /api/health
router.get('/', checkHealth);

export default router;
