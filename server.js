
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import { connectDB } from './config/db.js';

import authRoutes from './routes/authRoutes.js';
import partnerRoutes from './routes/partnerRoutes.js';
import bookingRoutes from './routes/bookingRoutes.js';
import reviewRoutes from './routes/reviewRoutes.js';
import paymentRoutes from './routes/paymentRoutes.js';

import { notFound, errorHandler } from './middleware/errorHandler.js';

if (!process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET is required');
}

const app = express();

// CORS
const allowedOrigins = [
  'http://localhost:5173',
  'http://192.168.1.40:5173',
  process.env.CLIENT_URL
].filter(Boolean);

app.use(
  cors({
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
  })
);
app.options('*', cors());

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

// Error handling
app.use(notFound);
app.use(errorHandler);

const port = process.env.PORT || 5000;

try {
  await connectDB();

  app.listen(port, '0.0.0.0', () => {
    console.log(`GarbaMate API listening on port ${port}`);
  });
} catch (error) {
  console.error('Unable to start server:', error.message);
  process.exit(1);
}
