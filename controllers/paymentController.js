import crypto from 'crypto';
import Razorpay from 'razorpay';
import Payment from '../models/Payment.js';
import PartnerProfile from '../models/PartnerProfile.js';
import { hasProfileAccess } from '../middleware/paidAccess.js';

const amounts = {
  PROFILE_ACCESS: Number(process.env.PROFILE_ACCESS_AMOUNT || 29900),
  PROFILE_LISTING: Number(process.env.PROFILE_LISTING_AMOUNT || 49900),
};
const paymentMode = process.env.PAYMENT_MODE || 'razorpay';
const mockPaymentsEnabled = paymentMode === 'mock' && process.env.NODE_ENV !== 'production';

function razorpayClient() {
  if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) return null;
  return new Razorpay({ key_id: process.env.RAZORPAY_KEY_ID, key_secret: process.env.RAZORPAY_KEY_SECRET });
}

export async function accessStatus(req, res) {
  const [access, profile] = await Promise.all([
    hasProfileAccess(req.user._id),
    PartnerProfile.findOne({ userId: req.user._id }).select('listingStatus isActive'),
  ]);
  res.json({
    hasAccess: Boolean(access),
    listingStatus: profile?.listingStatus || null,
    isListed: Boolean(profile?.isActive && profile?.listingStatus === 'active'),
    prices: Object.fromEntries(Object.entries(amounts).map(([purpose, amount]) => [purpose, amount / 100])),
  });
}

export async function createOrder(req, res) {
  const { purpose } = req.body;
  if (!Object.hasOwn(amounts, purpose)) return res.status(400).json({ message: 'Invalid payment purpose.' });
  if (purpose === 'PROFILE_ACCESS' && await hasProfileAccess(req.user._id)) return res.status(409).json({ message: 'Profile access is already active.', code: 'ALREADY_PAID' });
  if (purpose === 'PROFILE_LISTING') {
    const profile = await PartnerProfile.findOne({ userId: req.user._id });
    if (!profile) return res.status(400).json({ message: 'Complete your partner profile before paying.' });
    if (profile.listingStatus === 'active' && profile.isActive) return res.status(409).json({ message: 'Your profile is already listed.', code: 'ALREADY_LISTED' });
  }
  if (mockPaymentsEnabled) return res.status(201).json({ mode: 'mock', purpose });
  const client = razorpayClient();
  if (!client) return res.status(503).json({ message: 'Payments are not configured yet.' });
  const amount = amounts[purpose];
  if (!Number.isInteger(amount) || amount < 100) return res.status(500).json({ message: 'Payment amount is not configured correctly.' });
  const existingOrder = await Payment.findOne({ userId: req.user._id, purpose, status: 'created' }).sort({ createdAt: -1 });
  if (existingOrder) return res.status(201).json({ orderId: existingOrder.orderId, amount: existingOrder.amount, currency: existingOrder.currency, keyId: process.env.RAZORPAY_KEY_ID, purpose });
  const receipt = `${purpose.slice(0, 3)}-${Date.now()}-${String(req.user._id).slice(-8)}`;
  const order = await client.orders.create({ amount, currency: 'INR', receipt, notes: { purpose, userId: String(req.user._id) } });
  await Payment.create({ userId: req.user._id, purpose, orderId: order.id, amount });
  res.status(201).json({ mode: 'razorpay', orderId: order.id, amount, currency: order.currency, keyId: process.env.RAZORPAY_KEY_ID, purpose });
}

export async function completeMockPayment(req, res) {
  if (!mockPaymentsEnabled) return res.status(404).json({ message: 'Mock payments are disabled.' });
  const { purpose, outcome } = req.body;
  if (!Object.hasOwn(amounts, purpose) || !['success', 'failure'].includes(outcome)) return res.status(400).json({ message: 'Invalid mock payment request.' });
  if (outcome === 'failure') return res.status(400).json({ message: 'Mock payment failed. No access or listing was granted.' });
  if (purpose === 'PROFILE_LISTING' && !await PartnerProfile.exists({ userId: req.user._id })) return res.status(400).json({ message: 'Complete your partner profile before paying.' });
  const existing = await Payment.findOne({ userId: req.user._id, purpose, status: 'paid' });
  if (existing) return res.json({ message: 'Mock payment already completed.', purpose });
  await Payment.create({ userId: req.user._id, purpose, orderId: `mock_${purpose}_${req.user._id}_${Date.now()}`, amount: amounts[purpose], status: 'paid', paidAt: new Date() });
  if (purpose === 'PROFILE_LISTING') await PartnerProfile.findOneAndUpdate({ userId: req.user._id }, { listingStatus: 'active', isActive: true });
  res.json({ message: 'Mock payment completed.', purpose });
}

export async function verifyPayment(req, res) {
  const { razorpay_order_id: orderId, razorpay_payment_id: paymentId, razorpay_signature: signature } = req.body;
  if (!orderId || !paymentId || !signature) return res.status(400).json({ message: 'Incomplete payment response.' });
  if (!process.env.RAZORPAY_KEY_SECRET) return res.status(503).json({ message: 'Payments are not configured yet.' });
  const payment = await Payment.findOne({ orderId }).select('+signature');
  if (!payment || String(payment.userId) !== String(req.user._id)) return res.status(404).json({ message: 'Payment order not found.' });
  if (payment.status === 'paid') return res.json({ message: 'Payment already verified.', purpose: payment.purpose });
  const expected = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET).update(`${orderId}|${paymentId}`).digest('hex');
  const expectedBuffer = Buffer.from(expected);
  const signatureBuffer = Buffer.from(signature);
  if (expectedBuffer.length !== signatureBuffer.length || !crypto.timingSafeEqual(expectedBuffer, signatureBuffer)) {
    payment.status = 'failed';
    await payment.save();
    return res.status(400).json({ message: 'Payment verification failed.' });
  }
  payment.paymentId = paymentId;
  payment.signature = signature;
  payment.status = 'paid';
  payment.paidAt = new Date();
  await payment.save();
  if (payment.purpose === 'PROFILE_LISTING') {
    const profile = await PartnerProfile.findOneAndUpdate({ userId: req.user._id }, { listingStatus: 'active', isActive: true }, { new: true });
    if (!profile) return res.status(409).json({ message: 'Payment verified, but the listing profile could not be activated.' });
  }
  res.json({ message: 'Payment verified successfully.', purpose: payment.purpose });
}
