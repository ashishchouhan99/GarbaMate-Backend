import 'dotenv/config';
import mongoose from 'mongoose';
import Booking from '../models/Booking.js';
import { connectDB } from '../config/db.js';

// Safe by default: report duplicates and the index plan without changing data.
const apply = process.argv.includes('--apply');
await connectDB();
const duplicates = await Booking.aggregate([
  { $sort: { createdAt: 1, _id: 1 } },
  { $group: { _id: { seekerId: '$seekerId', partnerId: '$partnerId' }, ids: { $push: '$_id' }, dates: { $push: '$date' }, count: { $sum: 1 } } },
  { $match: { count: { $gt: 1 } } }
]);
console.log(`Found ${duplicates.length} duplicate booking key(s).`);
for (const duplicate of duplicates) console.log(`Duplicate ${duplicate._id.seekerId}/${duplicate._id.partnerId}: keep ${duplicate.ids[0]}, delete ${duplicate.ids.slice(1).join(', ')}`);
if (!apply) {
  console.log('Dry run only. No records or indexes were changed. Re-run with --apply to delete duplicates and create the unique index.');
  await mongoose.disconnect();
  process.exit(0);
}
for (const duplicate of duplicates) {
  const deleteIds = duplicate.ids.slice(1);
  await Booking.deleteMany({ _id: { $in: deleteIds } });
  console.log(`Deleted ${deleteIds.length} duplicate booking(s) for ${duplicate._id.seekerId}/${duplicate._id.partnerId}.`);
}
await Booking.collection.createIndex({ seekerId: 1, partnerId: 1 }, { unique: true, name: 'unique_seeker_partner' });
console.log('Unique booking index created.');
await mongoose.disconnect();
