import mongoose from 'mongoose';

const paymentSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  purpose: { type: String, enum: ['PROFILE_ACCESS', 'PROFILE_LISTING'], required: true, index: true },
  orderId: { type: String, required: true, unique: true },
  paymentId: { type: String, sparse: true, unique: true },
  signature: { type: String, select: false },
  amount: { type: Number, required: true, min: 1 },
  currency: { type: String, default: 'INR' },
  status: { type: String, enum: ['created', 'paid', 'failed'], default: 'created', index: true },
  paidAt: Date,
}, { timestamps: true });

export default mongoose.model('Payment', paymentSchema);
