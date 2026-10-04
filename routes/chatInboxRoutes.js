import { Router } from 'express';
import { protect } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { listChats } from '../controllers/chatController.js';

const router = Router();
router.use(protect);
router.get('/', asyncHandler(listChats));
export default router;
