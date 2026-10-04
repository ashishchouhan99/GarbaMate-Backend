import jwt from 'jsonwebtoken';
import { Server } from 'socket.io';
import Booking from './models/Booking.js';
import Message from './models/Message.js';
import { assertChatAccess } from './middleware/chatAccess.js';

export function attachSocket(server, corsOptions) {
  const io = new Server(server, { cors: corsOptions });
  const userSockets = new Map();
  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token || socket.handshake.headers.authorization?.replace(/^Bearer\s+/, '');
      if (!token) return next(new Error('Authentication required'));
      socket.user = jwt.verify(token, process.env.JWT_SECRET);
      if (!socket.user.id) return next(new Error('Invalid token'));
      next();
    } catch { next(new Error('Invalid or expired token')); }
  });

  const messageTimes = new Map();
  io.on('connection', (socket) => {
    const userId = String(socket.user.id);
    const sockets = userSockets.get(userId) || new Set();
    sockets.add(socket.id);
    userSockets.set(userId, sockets);
    const isOnline = (id) => (userSockets.get(String(id))?.size || 0) > 0;
    io.emit('presence', { userId, online: true });
    const notifyPresence = (room, participantId) => {
      io.to(room).emit('presence', { userId: String(participantId), online: isOnline(participantId) });
    };
    socket.on('join', async (bookingId, acknowledge) => {
      try {
        const access = await assertChatAccess(bookingId, userId);
        const room = `booking:${bookingId}`;
        socket.join(room);
        socket.data.chatRooms = socket.data.chatRooms || new Map();
        socket.data.chatRooms.set(String(bookingId), { seekerId: String(access.seekerId), partnerId: String(access.partnerId) });
        const otherUserId = String(access.seekerId) === userId ? access.partnerId : access.seekerId;
        const otherOnline = isOnline(otherUserId);
        socket.emit('presence', { userId: String(otherUserId), online: otherOnline });
        notifyPresence(room, userId);
        if (typeof acknowledge === 'function') acknowledge({ ok: true, chatExpiresAt: access.chatExpiresAt, participantId: String(otherUserId), participantOnline: otherOnline });
      } catch (error) {
        if (typeof acknowledge === 'function') acknowledge({ ok: false, message: error.message });
      }
    });
    socket.on('message', async (payload, acknowledge) => {
      try {
        const access = await assertChatAccess(payload?.bookingId, userId, { write: true });
        const now = Date.now();
        const recent = (messageTimes.get(userId) || []).filter((time) => now - time < 60_000);
        if (recent.length >= 20) {
          if (typeof acknowledge === 'function') acknowledge({ ok: false, message: 'Message rate limit exceeded (20 per minute)' });
          return;
        }
        const text = typeof payload.text === 'string' ? payload.text.trim() : '';
        if (!text || text.length > 1000) throw new Error('Message text must be between 1 and 1000 characters');
        recent.push(now);
        messageTimes.set(userId, recent);
        const message = await Message.create({ bookingId: payload.bookingId, senderId: userId, text });
        const result = await message.populate('senderId', 'name');
        io.to(`booking:${payload.bookingId}`).emit('message', result);
        if (typeof acknowledge === 'function') acknowledge({ ok: true, message: result });
      } catch (error) {
        if (typeof acknowledge === 'function') acknowledge({ ok: false, message: error.message });
      }
    });
    socket.on('typing', async (payload) => {
      try {
        await assertChatAccess(payload?.bookingId, userId, { write: true });
        if (socket.rooms.has(`booking:${payload.bookingId}`)) socket.to(`booking:${payload.bookingId}`).emit('typing', { bookingId: payload.bookingId, userId, typing: Boolean(payload.typing) });
      } catch (error) {
        socket.emit('chat:error', { message: error.message || 'Chat access failed' });
      }
    });
    socket.on('read', async (payload, acknowledge) => {
      try {
        const access = await assertChatAccess(payload?.bookingId, userId);
        const otherUserId = String(access.seekerId) === userId ? access.partnerId : access.seekerId;
        await Message.updateMany({ bookingId: payload.bookingId, senderId: otherUserId, readBy: { $ne: userId } }, { $addToSet: { readBy: userId } });
        io.to(`booking:${payload.bookingId}`).emit('read', { bookingId: payload.bookingId, userId });
        if (typeof acknowledge === 'function') acknowledge({ ok: true });
      } catch (error) { if (typeof acknowledge === 'function') acknowledge({ ok: false, message: error.message }); }
    });
    socket.on('presence:check', (participantId, acknowledge) => {
      const online = isOnline(participantId);
      if (typeof acknowledge === 'function') acknowledge({ userId: String(participantId), online });
      socket.emit('presence', { userId: String(participantId), online });
    });
    socket.on('presence:ping', (participantId, acknowledge) => {
      const online = isOnline(participantId);
      if (typeof acknowledge === 'function') acknowledge({ userId: String(participantId), online });
    });
    socket.on('disconnect', () => {
      const activeSockets = userSockets.get(userId);
      activeSockets?.delete(socket.id);
      if (activeSockets?.size === 0) userSockets.delete(userId);
      if (!activeSockets || activeSockets.size === 0) io.emit('presence', { userId, online: false });
      for (const [bookingId] of socket.data.chatRooms || []) {
        notifyPresence(`booking:${bookingId}`, userId);
      }
    });
  });
  return io;
}
