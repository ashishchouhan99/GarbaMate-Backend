import { Router } from 'express';
import { body } from 'express-validator';
import { login, register, resendOtp, verifyOtp } from '../controllers/authController.js';
import { asyncHandler } from '../middleware/asyncHandler.js';

const router = Router();
router.post('/register', [body('name').trim().notEmpty(), body('email').isEmail().normalizeEmail(), body('phone').trim().notEmpty(), body('password').isLength({ min: 8 })], asyncHandler(register));
router.post('/login', [body('email').isEmail(), body('password').notEmpty()], asyncHandler(login));
router.post('/verify-otp', [body('email').isEmail().normalizeEmail(), body('otp').matches(/^\d{6}$/)], asyncHandler(verifyOtp));
router.post('/resend-otp', [body('email').isEmail().normalizeEmail()], asyncHandler(resendOtp));
export default router;
