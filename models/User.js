import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 80 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  phone: { type: String, required: true, trim: true },
  password: { type: String, required: true, minlength: 8, select: false },
  role: { type: String, enum: ['seeker', 'partner', 'admin'], default: 'seeker' },
  isVerified: { type: Boolean, default: false }
}, { timestamps: { createdAt: true, updatedAt: false } });

userSchema.pre('save', async function () {
  if (this.isModified('password') && !this.$locals.passwordIsHashed) this.password = await bcrypt.hash(this.password, 12);
});
userSchema.methods.comparePassword = function (candidate) { return bcrypt.compare(candidate, this.password); };
export default mongoose.model('User', userSchema);
