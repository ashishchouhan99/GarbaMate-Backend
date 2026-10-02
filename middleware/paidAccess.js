import Payment from '../models/Payment.js';
import { asyncHandler } from './asyncHandler.js';

export const hasProfileAccess = async (userId) => Payment.exists({ userId, purpose: 'PROFILE_ACCESS', status: 'paid' });

export const requireProfileAccess = asyncHandler(async (req, res, next) => {
  if (!(await hasProfileAccess(req.user._id))) return res.status(402).json({ message: 'Payment required', code: 'PROFILE_ACCESS_REQUIRED' });
  next();
});
