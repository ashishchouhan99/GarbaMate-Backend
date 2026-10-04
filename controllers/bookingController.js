import Booking from '../models/Booking.js';
import PartnerProfile from '../models/PartnerProfile.js';

export async function createBooking(req, res) {
  const { partnerId, date } = req.body;
  if (!partnerId || !date || Number.isNaN(Date.parse(date))) return res.status(400).json({ message: 'A valid partnerId and date are required' });
  const partner = await PartnerProfile.findById(partnerId);
  if (!partner || !partner.isActive) return res.status(404).json({ message: 'Partner not found' });
  if (String(partner.userId) === String(req.user._id)) return res.status(400).json({ message: 'You cannot book your own profile' });
  const existing = await Booking.findOne({ seekerId: req.user._id, partnerId }).select('status');
  if (existing) return res.status(409).json({ message: 'You have already sent a request to this partner.', status: existing.status });
  let booking;
  try {
    booking = await Booking.create({ seekerId: req.user._id, partnerId, date: new Date(date) });
  } catch (error) {
    if (error?.code === 11000) {
      const duplicate = await Booking.findOne({ seekerId: req.user._id, partnerId }).select('status');
      return res.status(409).json({ message: 'You have already sent a request to this partner.', status: duplicate?.status });
    }
    throw error;
  }
  res.status(201).json(await booking.populate([{ path: 'seekerId', select: 'name' }, { path: 'partnerId', populate: { path: 'userId', select: 'name' } }]));
}

export async function myBookings(req, res) {
  const [asSeeker, partnerProfile] = await Promise.all([
    Booking.find({ seekerId: req.user._id }).populate('seekerId', 'name').populate({ path: 'partnerId', populate: { path: 'userId', select: 'name' } }).sort({ createdAt: -1 }),
    PartnerProfile.findOne({ userId: req.user._id }).select('_id')
  ]);
  const asPartner = partnerProfile ? await Booking.find({ partnerId: partnerProfile._id }).populate('seekerId', 'name').populate({ path: 'partnerId', populate: { path: 'userId', select: 'name' } }).sort({ createdAt: -1 }) : [];
  if (asPartner.length) {
    const seekerIds = asPartner.map((booking) => booking.seekerId?._id).filter(Boolean);
    const seekerProfiles = await PartnerProfile.find({ userId: { $in: seekerIds } }).select('userId photoUrl');
    const photos = new Map(seekerProfiles.map((profile) => [String(profile.userId), profile.photoUrl]));
    asPartner.forEach((booking) => { booking.seekerId = { ...booking.seekerId.toObject(), photoUrl: photos.get(String(booking.seekerId._id)) || '' }; });
  }
  res.json({ asSeeker, asPartner });
}

export async function updateBookingStatus(req, res) {
  const { status } = req.body;
  if (!['confirmed', 'rejected', 'cancelled'].includes(status)) return res.status(400).json({ message: 'Invalid booking status' });
  const booking = await Booking.findById(req.params.id).populate('partnerId');
  if (!booking) return res.status(404).json({ message: 'Booking not found' });
  const partnerOwns = String(booking.partnerId.userId) === String(req.user._id);
  const seekerOwns = String(booking.seekerId) === String(req.user._id);
  if (status === 'cancelled' ? !seekerOwns : !partnerOwns) return res.status(403).json({ message: 'Not allowed to update this booking' });
  if (booking.status !== 'pending') return res.status(400).json({ message: 'Only pending bookings can be updated' });
  booking.status = status;
  await booking.save();
  res.json(booking);
}
