import Booking from '../models/Booking.js';
import Review from '../models/Review.js';

export async function addReview(req, res) {
  const { bookingId, rating, comment } = req.body;
  const numericRating = Number(rating);
  if (!bookingId || !Number.isInteger(numericRating) || numericRating < 1 || numericRating > 5) return res.status(400).json({ message: 'bookingId and a rating from 1 to 5 are required' });
  const booking = await Booking.findById(bookingId);
  if (!booking) return res.status(404).json({ message: 'Booking not found' });
  if (String(booking.seekerId) !== String(req.user._id)) return res.status(403).json({ message: 'Only the seeker can review this booking' });
  if (booking.status !== 'confirmed') return res.status(400).json({ message: 'Only confirmed bookings can be reviewed' });
  res.status(201).json(await Review.create({ bookingId, reviewerId: req.user._id, rating: numericRating, comment }));
}

export async function reviewsForPartner(req, res) {
  const bookings = await Booking.find({ partnerId: req.params.partnerId, status: 'confirmed' }).select('_id');
  res.json(await Review.find({ bookingId: { $in: bookings.map((item) => item._id) } }).populate('reviewerId', 'name').sort({ createdAt: -1 }));
}
