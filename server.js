
import 'dotenv/config';
import express from 'express';
import http from 'http';
import cors from 'cors';
import mongoose from 'mongoose';
import { connectDB } from './config/db.js';

import authRoutes from './routes/authRoutes.js';
import partnerRoutes from './routes/partnerRoutes.js';
import bookingRoutes from './routes/bookingRoutes.js';
import reviewRoutes from './routes/reviewRoutes.js';
import paymentRoutes from './routes/paymentRoutes.js';
import chatRoutes from './routes/chatRoutes.js';
import chatInboxRoutes from './routes/chatInboxRoutes.js';
import { attachSocket } from './socket.js';

import { notFound, errorHandler } from './middleware/errorHandler.js';

if (!process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET is required');
}

const app = express();

// CORS
const allowedOrigins = [
  'http://localhost:5173',
  'http://192.168.1.40:5173',
  process.env.CLIENT_URL,
 
].filter(Boolean);

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};

app.options('*', cors(corsOptions));
app.use(cors(corsOptions));

// Body parser
app.use(express.json({ limit: '1mb' }));

// Health check
app.get('/api/health', (req, res) => {
  const isConnected = mongoose.connection.readyState === 1;

  res.status(isConnected ? 200 : 503).json({
    status: isConnected ? 'ok' : 'degraded',
    database: isConnected ? 'connected' : 'disconnected'
  });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/partners', partnerRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/bookings', chatRoutes);
app.use('/api/chats', chatInboxRoutes);

// Error handling
app.use(notFound);
app.use(errorHandler);

const port = process.env.PORT || 5000;

try {
  await connectDB();
  const httpServer = http.createServer(app);
  attachSocket(httpServer, corsOptions);
  httpServer.listen(port, '0.0.0.0', () => {
    console.log(`GarbaMate API listening on port ${port}`);
  });
} catch (error) {
  console.error('Unable to start server:', error.message);
  process.exit(1);
}
