import Message from '../models/Message.js';
import Report from '../models/Report.js';
import Booking from '../models/Booking.js';
import PartnerProfile from '../models/PartnerProfile.js';
import User from '../models/User.js';
import { assertChatAccess, chatErrorResponse } from '../middleware/chatAccess.js';

const messageTimes = new Map();
function checkMessageRate(userId) {
  const now = Date.now();
  const recent = (messageTimes.get(String(userId)) || []).filter((time) => now - time < 60_000);
  if (recent.length >= 20) return false;
  recent.push(now);
  messageTimes.set(String(userId), recent);
  return true;
}

export async function listChats(req, res) {
  const profile = await PartnerProfile.findOne({ userId: req.user._id }).select('_id');
  const participantQuery = [{ seekerId: req.user._id }];
  if (profile) participantQuery.push({ partnerId: profile._id });
  const bookings = await Booking.find({ status: 'confirmed', $or: participantQuery }).populate('partnerId', 'userId');
  const chats = [];
  for (const booking of bookings) {
    try {
      const access = await assertChatAccess(booking._id, req.user._id);
      const otherUserId = String(access.seekerId) === String(req.user._id) ? access.partnerId : access.seekerId;
      const otherUser = await User.findById(otherUserId).select('name');
      const partnerProfile = await PartnerProfile.findOne({ userId: otherUserId }).select('photoUrl');
      const lastMessage = await Message.findOne({ bookingId: booking._id }).sort({ createdAt: -1 }).populate('senderId', 'name');
      const unreadCount = await Message.countDocuments({ bookingId: booking._id, senderId: otherUserId, readBy: { $ne: req.user._id } });
      chats.push({ bookingId: booking._id, status: booking.status, otherUser, photoUrl: partnerProfile?.photoUrl || '', chatExpiresAt: access.chatExpiresAt, expired: access.expired, lastMessage, unreadCount });
    } catch { /* expired chats are not returned */ }
  }
  res.json(chats);
}

export async function listMessages(req, res) {
  try {
    const access = await assertChatAccess(req.params.bookingId, req.user._id);
    const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 100);
    const query = { bookingId: req.params.bookingId };
    if (req.query.before) query.createdAt = { $lt: new Date(req.query.before) };
    const messages = await Message.find(query).sort({ createdAt: -1 }).limit(limit).populate('senderId', 'name');
    res.json({ messages: messages.reverse(), hasMore: messages.length === limit, status: access.booking.status, expired: access.expired, chatExpiresAt: access.chatExpiresAt });
  } catch (error) { chatErrorResponse(error, res); }
}

export async function createMessage(req, res) {
  try {
    const access = await assertChatAccess(req.params.bookingId, req.user._id, { write: true });
    if (!checkMessageRate(req.user._id)) return res.status(429).json({ message: 'Message rate limit exceeded. Please wait a minute.' });
    const text = typeof req.body.text === 'string' ? req.body.text.trim() : '';
    if (!text || text.length > 1000) return res.status(400).json({ message: 'Message text must be between 1 and 1000 characters' });
    const message = await Message.create({ bookingId: req.params.bookingId, senderId: req.user._id, text });
    res.status(201).json(await message.populate('senderId', 'name'));
  } catch (error) { chatErrorResponse(error, res); }
}

export async function markMessagesRead(req, res) {
  try {
    const access = await assertChatAccess(req.params.bookingId, req.user._id);
    const otherUserId = String(access.seekerId) === String(req.user._id) ? access.partnerId : access.seekerId;
    const result = await Message.updateMany({ bookingId: req.params.bookingId, senderId: otherUserId, readBy: { $ne: req.user._id } }, { $addToSet: { readBy: req.user._id } });
    res.json({ updated: result.modifiedCount });
  } catch (error) { chatErrorResponse(error, res); }
}

export async function createReport(req, res) {
  const { bookingId, reason } = req.body;
  if (!bookingId || !reason) return res.status(400).json({ message: 'bookingId and reason are required' });
  let access;
  try {
    access = await assertChatAccess(bookingId, req.user._id);
  } catch (error) { return chatErrorResponse(error, res); }
  const reportedUserId = String(access.seekerId) === String(req.user._id) ? access.partnerId : access.seekerId;
  if (bookingId) {
    try {
      await assertChatAccess(bookingId, req.user._id);
    } catch (error) { return chatErrorResponse(error, res); }
  }
  const report = await Report.create({ reporterId: req.user._id, reportedUserId, bookingId, reason });
  res.status(201).json(report);
}
