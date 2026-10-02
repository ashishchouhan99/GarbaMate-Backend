import mongoose from 'mongoose';

const pendingSignupSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 80 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  phone: { type: String, required: true, trim: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['seeker', 'partner'], default: 'seeker' },
  otp: { type: String, required: true },
  otpExpiresAt: { type: Date, required: true }
}, { timestamps: true });

pendingSignupSchema.index({ otpExpiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model('PendingSignup', pendingSignupSchema);
