import { Router } from 'express';
import { protect } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { createReport } from '../controllers/chatController.js';

const router = Router();
router.use(protect);
router.post('/', asyncHandler(createReport));
export default router;
