import mongoose from 'mongoose';

const bookingSchema = new mongoose.Schema({
  seekerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  partnerId: { type: mongoose.Schema.Types.ObjectId, ref: 'PartnerProfile', required: true },
  date: { type: Date, required: true },
  status: { type: String, enum: ['pending', 'confirmed', 'rejected', 'cancelled'], default: 'pending' }
}, { timestamps: { createdAt: true, updatedAt: false } });

bookingSchema.index({ seekerId: 1, partnerId: 1 }, { unique: true, name: 'unique_seeker_partner' });

export default mongoose.model('Booking', bookingSchema);
