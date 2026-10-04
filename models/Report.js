import mongoose from 'mongoose';

const reportSchema = new mongoose.Schema({
  reporterId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  reportedUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  bookingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking' },
  messageId: { type: mongoose.Schema.Types.ObjectId, ref: 'Message' },
  reason: { type: String, required: true, trim: true, maxlength: 120 },
  details: { type: String, default: '', trim: true, maxlength: 2000 },
  status: { type: String, enum: ['open', 'reviewing', 'resolved', 'dismissed'], default: 'open' }
}, { timestamps: true });

export default mongoose.model('Report', reportSchema);
