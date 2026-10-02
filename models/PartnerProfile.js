import mongoose from 'mongoose';

const partnerProfileSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  city: { type: String, required: true, trim: true },
  gender: { type: String, required: true, trim: true },
  skillLevel: { type: String, enum: ['beginner', 'intermediate', 'pro'], required: true },
  price: { type: Number, required: true, min: 0 },
  age: { type: Number, min: 18, max: 100 },
  bio: { type: String, default: '', maxlength: 1200 },
  photoUrl: { type: String, default: '' },
  photoPublicId: { type: String, default: '' },
  garbaStyle: { type: String, default: '', maxlength: 120 },
  preferredEvent: { type: String, default: '', maxlength: 160 },
  profileViews: { type: Number, default: 0, min: 0 },
  availableDates: [{ type: Date }],
  listingStatus: { type: String, enum: ['draft', 'pending_payment', 'active', 'rejected', 'inactive'], default: 'active', index: true },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

export default mongoose.model('PartnerProfile', partnerProfileSchema);
