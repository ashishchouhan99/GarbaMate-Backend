import { Router } from 'express';
import { body } from 'express-validator';
import { protect } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { accessStatus, completeMockPayment, createOrder, verifyPayment } from '../controllers/paymentController.js';

const router = Router();
router.use(protect);
router.get('/access', asyncHandler(accessStatus));
router.post('/create-order', [body('purpose').isIn(['PROFILE_ACCESS', 'PROFILE_LISTING'])], asyncHandler(createOrder));
router.post('/mock-complete', [body('purpose').isIn(['PROFILE_ACCESS', 'PROFILE_LISTING']), body('outcome').isIn(['success', 'failure'])], asyncHandler(completeMockPayment));
router.post('/verify', [body('razorpay_order_id').isString().notEmpty(), body('razorpay_payment_id').isString().notEmpty(), body('razorpay_signature').isString().notEmpty()], asyncHandler(verifyPayment));
export default router;
