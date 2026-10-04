import { Router } from 'express';
import { protect } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { createMessage, listMessages, markMessagesRead, listChats, createReport } from '../controllers/chatController.js';

const router = Router();
router.use(protect);
router.get('/:bookingId/messages', asyncHandler(listMessages));
router.post('/:bookingId/messages', asyncHandler(createMessage));
router.post('/:bookingId/messages/read', asyncHandler(markMessagesRead));
router.post('/:bookingId/report', asyncHandler(createReport));
export default router;
