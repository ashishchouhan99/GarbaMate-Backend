import PartnerProfile from '../models/PartnerProfile.js';

export async function listPartners(req, res) {
  const { city, date, gender, skillLevel, event, minPrice, maxPrice } = req.query;
  const filter = { isActive: true, $or: [{ listingStatus: 'active' }, { listingStatus: { $exists: false } }] };
  if (city) filter.city = { $regex: city, $options: 'i' };
  if (gender) filter.gender = { $regex: `^${gender}$`, $options: 'i' };
  if (skillLevel) filter.skillLevel = skillLevel;
  if (event) filter.preferredEvent = { $regex: event, $options: 'i' };
  if (minPrice !== undefined || maxPrice !== undefined) filter.price = {};
  if (minPrice !== undefined) filter.price.$gte = Number(minPrice);
  if (maxPrice !== undefined) filter.price.$lte = Number(maxPrice);
  if (date && !Number.isNaN(Date.parse(date))) filter.availableDates = { $gte: new Date(date), $lt: new Date(new Date(date).setDate(new Date(date).getDate() + 1)) };
  const profiles = await PartnerProfile.find(filter).populate('userId', 'name').sort({ createdAt: -1 });
  res.json(profiles);
}

export async function previewPartners(req, res) {
  const profiles = await PartnerProfile.find({ isActive: true, photoUrl: { $exists: true, $ne: '' }, $or: [{ listingStatus: 'active' }, { listingStatus: { $exists: false } }] })
    .populate('userId', 'name')
    .select('userId city skillLevel age photoUrl garbaStyle preferredEvent')
    .sort({ createdAt: -1 })
    .limit(12);
  res.json(profiles.map((profile) => ({
    id: profile._id,
    name: profile.userId?.name || 'Dance partner',
    city: profile.city,
    skillLevel: profile.skillLevel,
    age: profile.age,
    photoUrl: profile.photoUrl,
    garbaStyle: profile.garbaStyle,
    preferredEvent: profile.preferredEvent,
  })));
}

export async function getPartner(req, res) {
  const profile = await PartnerProfile.findById(req.params.id).populate('userId', 'name');
  if (!profile || (!profile.isActive && String(profile.userId?._id) !== String(req.user?._id))) return res.status(404).json({ message: 'Partner not found' });
  await PartnerProfile.updateOne({ _id: profile._id }, { $inc: { profileViews: 1 } });
  profile.profileViews = (profile.profileViews || 0) + 1;
  res.json(profile);
}

export async function upsertMyProfile(req, res) {
  const fields = ['city', 'gender', 'skillLevel', 'price', 'age', 'bio', 'garbaStyle', 'preferredEvent', 'availableDates'];
  const update = Object.fromEntries(fields.filter((key) => req.body[key] !== undefined).map((key) => [key, req.body[key]]));
  if (!update.city || !update.gender || !update.skillLevel || update.price === undefined) return res.status(400).json({ message: 'city, gender, skillLevel and price are required' });
  const existing = await PartnerProfile.findOne({ userId: req.user._id }).select('listingStatus isActive');
  const listingUpdate = existing?.listingStatus === 'active' && existing.isActive ? {} : { listingStatus: 'pending_payment', isActive: false };
  const profile = await PartnerProfile.findOneAndUpdate({ userId: req.user._id }, { $set: { ...update, ...listingUpdate }, $setOnInsert: { userId: req.user._id } }, { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true });
  res.json(profile);
}

export async function deleteMyProfile(req, res) {
  const profile = await PartnerProfile.findOneAndUpdate({ userId: req.user._id }, { isActive: false }, { new: true });
  if (!profile) return res.status(404).json({ message: 'Partner profile not found' });
  res.json({ message: 'Profile deactivated', profile });
}
