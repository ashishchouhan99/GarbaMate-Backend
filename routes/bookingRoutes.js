import { Router } from 'express';
import { body } from 'express-validator';
import { createBooking, myBookings, updateBookingStatus } from '../controllers/bookingController.js';
import { protect } from '../middleware/auth.js';
import { requireProfileAccess } from '../middleware/paidAccess.js';
import { asyncHandler } from '../middleware/asyncHandler.js';

const router = Router();
router.use(protect);
router.post('/', requireProfileAccess, [body('partnerId').isMongoId(), body('date').isISO8601()], asyncHandler(createBooking));
router.get('/mine', asyncHandler(myBookings));
router.patch('/:id/status', [body('status').isIn(['confirmed', 'rejected', 'cancelled'])], asyncHandler(updateBookingStatus));
export default router;
