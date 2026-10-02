import { Router } from 'express';
import { body } from 'express-validator';
import { addReview, reviewsForPartner } from '../controllers/reviewController.js';
import { protect } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/asyncHandler.js';

const router = Router();
router.get('/partner/:partnerId', asyncHandler(reviewsForPartner));
router.post('/', protect, [body('bookingId').isMongoId(), body('rating').isInt({ min: 1, max: 5 })], asyncHandler(addReview));
export default router;
