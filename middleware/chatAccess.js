import Booking from '../models/Booking.js';
import PartnerProfile from '../models/PartnerProfile.js';

export const CHAT_EXPIRY_DAYS = 7;

export async function assertChatAccess(bookingId, userId, { write = false } = {}) {
  const booking = await Booking.findById(bookingId).populate('partnerId', 'userId');
  if (!booking) {
    const error = new Error('Booking not found');
    error.statusCode = 404;
    throw error;
  }
  const isSeeker = String(booking.seekerId) === String(userId);
  const isPartner = String(booking.partnerId?.userId) === String(userId);
  if (!isSeeker && !isPartner) {
    const error = new Error('You are not a participant in this booking');
    error.statusCode = 403;
    throw error;
  }
  if (booking.status !== 'confirmed' && booking.status !== 'cancelled') {
    const error = new Error('Chat is available after the booking is confirmed');
    error.statusCode = 403;
    throw error;
  }
  const chatExpiresAt = new Date(booking.date);
  chatExpiresAt.setDate(chatExpiresAt.getDate() + CHAT_EXPIRY_DAYS);
  if (write && new Date() > chatExpiresAt) {
    const error = new Error('This chat expired 7 days after the booking date');
    error.statusCode = 403;
    error.chatExpiresAt = chatExpiresAt;
    throw error;
  }
  const partner = await PartnerProfile.findById(booking.partnerId._id).select('userId');
  return {
    booking,
    chatExpiresAt,
    expired: new Date() > chatExpiresAt,
    seekerId: booking.seekerId,
    partnerId: partner.userId
  };
}

export function chatErrorResponse(error, res) {
  return res.status(error.statusCode || 500).json({ message: error.message || 'Chat access failed', ...(error.chatExpiresAt ? { chatExpiresAt: error.chatExpiresAt } : {}) });
}
