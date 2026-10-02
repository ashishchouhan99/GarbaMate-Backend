import crypto from 'crypto';
import os from 'os';
import path from 'path';
import { unlink, writeFile } from 'fs/promises';
import PartnerProfile from '../models/PartnerProfile.js';
import cloudinary, { cloudinaryConfigured } from '../config/cloudinary.js';

async function uploadToCloudinary(file, userId) {
  const publicId = `${String(userId)}-${crypto.randomUUID()}`;
  const temporaryPath = path.join(os.tmpdir(), `garbamate-${publicId}${path.extname(file.originalname).toLowerCase() || '.img'}`);
  await writeFile(temporaryPath, file.buffer);
  try {
    return await cloudinary.uploader.upload(temporaryPath, {
      folder: 'garbamate/partners',
      public_id: publicId,
    });
  } finally {
    await unlink(temporaryPath).catch(() => {});
  }
}

export async function uploadProfilePhoto(req, res) {
  if (!req.file) return res.status(400).json({ message: 'Select a profile photo to upload.' });
  if (!cloudinaryConfigured) return res.status(503).json({ message: 'Profile photo storage is not configured yet.' });
  const profile = await PartnerProfile.findOne({ userId: req.user._id }).select('photoUrl photoPublicId');
  if (!profile) return res.status(400).json({ message: 'Save your partner profile details before uploading a photo.' });

  const uploaded = await uploadToCloudinary(req.file, req.user._id);
  const oldPublicId = profile.photoPublicId;
  const optimizedPhotoUrl = cloudinary.url(uploaded.public_id, {
    secure: true,
    resource_type: 'image',
    transformation: [{ width: 800, height: 800, crop: 'limit', quality: 'auto', fetch_format: 'auto' }],
  });
  let updatedProfile;
  try {
    updatedProfile = await PartnerProfile.findOneAndUpdate({ userId: req.user._id }, { photoUrl: optimizedPhotoUrl, photoPublicId: uploaded.public_id }, { new: true }).select('photoUrl photoPublicId');
    if (!updatedProfile) throw new Error('Partner profile no longer exists.');
  } catch (error) {
    await cloudinary.uploader.destroy(uploaded.public_id, { resource_type: 'image', invalidate: true }).catch(() => {});
    throw error;
  }

  if (oldPublicId && oldPublicId !== uploaded.public_id) {
    await cloudinary.uploader.destroy(oldPublicId, { resource_type: 'image', invalidate: true }).catch((error) => console.error('Could not remove previous profile photo:', error.message));
  }
  res.json({ success: true, photoUrl: updatedProfile.photoUrl, photoPublicId: updatedProfile.photoPublicId });
}
