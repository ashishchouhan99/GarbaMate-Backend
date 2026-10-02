import mongoose from 'mongoose';

export async function connectDB() {
  if (!process.env.MONGO_URI) throw new Error('MONGO_URI is not configured');
  mongoose.connection.on('connected', () => console.log('MongoDB connected'));
  mongoose.connection.on('error', (err) => console.error('MongoDB error:', err.message));
  await mongoose.connect(process.env.MONGO_URI);
}
