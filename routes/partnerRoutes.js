import { Router } from 'express';
import { listPartners, previewPartners, getPartner, upsertMyProfile, deleteMyProfile } from '../controllers/partnerController.js';
import { protect } from '../middleware/auth.js';
import { requireProfileAccess } from '../middleware/paidAccess.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import upload from '../middleware/profileUpload.js';
import { uploadProfilePhoto } from '../controllers/profilePhotoController.js';

const router = Router();
router.get('/preview', asyncHandler(previewPartners));
router.get('/', protect, requireProfileAccess, asyncHandler(listPartners));
router.post('/photo', protect, upload.single('photo'), asyncHandler(uploadProfilePhoto));
router.get('/me', protect, asyncHandler(async (req, res) => { const Partner = (await import('../models/PartnerProfile.js')).default; const profile = await Partner.findOne({ userId: req.user._id }); res.json(profile); }));
router.put('/me', protect, asyncHandler(upsertMyProfile));
router.delete('/me', protect, asyncHandler(deleteMyProfile));
router.get('/:id', protect, requireProfileAccess, asyncHandler(getPartner));
export default router;
