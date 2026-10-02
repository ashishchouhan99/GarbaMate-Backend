import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { validationResult } from 'express-validator';
import bcrypt from 'bcryptjs';
import User from '../models/User.js';
import PendingSignup from '../models/PendingSignup.js';
import { sendOtpEmail } from '../utils/otpMailer.js';

const OTP_TTL_MS = 10 * 60 * 1000;
const RESEND_COOLDOWN_MS = 30 * 1000;
const resendAt = new Map();

function tokenFor(user) {
  return jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '7d' });
}
function publicUser(user) { return { id: user._id, name: user.name, email: user.email, phone: user.phone, role: user.role, isVerified: user.isVerified }; }
function newOtp() { return String(crypto.randomInt(0, 1000000)).padStart(6, '0'); }
function hashOtp(otp) { return crypto.createHash('sha256').update(otp).digest('hex'); }
async function issuePendingOtp(pending) {
  const otp = newOtp();
  pending.otp = hashOtp(otp);
  pending.otpExpiresAt = new Date(Date.now() + OTP_TTL_MS);
  await pending.save();
  await sendOtpEmail(pending.email, otp);
}

export async function register(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ message: errors.array()[0].msg, errors: errors.array() });
  const { name, email, phone, password, role } = req.body;
  const normalizedEmail = email.toLowerCase();
  const existingUser = await User.findOne({ email: normalizedEmail });
  if (existingUser?.isVerified) return res.status(409).json({ message: 'An account with this email already exists.' });
  if (existingUser && !existingUser.isVerified) return res.status(409).json({ message: 'This email belongs to an unverified legacy account. Contact support to reset it before registering again.' });
  const existingPending = await PendingSignup.findOne({ email: normalizedEmail });
  if (existingPending) {
    existingPending.name = name;
    existingPending.phone = phone;
    existingPending.password = await bcrypt.hash(password, 12);
    existingPending.role = role === 'partner' ? 'partner' : 'seeker';
    await issuePendingOtp(existingPending);
    return res.status(201).json({ message: 'A fresh verification code has been sent.', email: existingPending.email });
  }
  const otp = newOtp();
  const pending = await PendingSignup.create({
    name,
    email: normalizedEmail,
    phone,
    password: await bcrypt.hash(password, 12),
    role: role === 'partner' ? 'partner' : 'seeker',
    otp: hashOtp(otp),
    otpExpiresAt: new Date(Date.now() + OTP_TTL_MS),
  });
  // Swap sendOtpEmail for SendGrid, Resend, or another provider without changing OTP generation or verification.
  await sendOtpEmail(pending.email, otp);
  res.status(201).json({ message: 'Registration successful. Check your email for the verification code.', email: pending.email });
}

export async function login(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ message: errors.array()[0].msg, errors: errors.array() });
  const user = await User.findOne({ email: req.body.email?.toLowerCase() }).select('+password');
  if (!user || !(await user.comparePassword(req.body.password))) return res.status(401).json({ message: 'Invalid email or password' });
  if (!user.isVerified) return res.status(403).json({ message: 'Please verify your email before logging in.' });
  res.json({ token: tokenFor(user), user: publicUser(user) });
}

export async function verifyOtp(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ message: errors.array()[0].msg, errors: errors.array() });
  const email = req.body.email.toLowerCase();
  const pending = await PendingSignup.findOne({ email });
  if (!pending) {
    if (await User.exists({ email })) return res.json({ message: 'Email is already verified.' });
    return res.status(404).json({ message: 'No pending signup found for this email.' });
  }
  if (!pending.otpExpiresAt || pending.otpExpiresAt < new Date()) return res.status(400).json({ message: 'This code has expired. Please request a new one.' });
  if (hashOtp(req.body.otp) !== pending.otp) return res.status(400).json({ message: 'Incorrect verification code.' });
  const existingUser = await User.findOne({ email });
  if (existingUser?.isVerified) return res.status(409).json({ message: 'An account with this email already exists.' });
  const user = existingUser || new User({ email: pending.email });
  user.name = pending.name;
  user.phone = pending.phone;
  user.password = pending.password;
  user.role = pending.role;
  user.isVerified = true;
  user.$locals.passwordIsHashed = true;
  await user.save();
  await PendingSignup.deleteOne({ _id: pending._id });
  res.json({ message: 'Email verified successfully.' });
}

export async function resendOtp(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ message: errors.array()[0].msg, errors: errors.array() });
  const email = req.body.email.toLowerCase();
  const pending = await PendingSignup.findOne({ email });
  if (!pending) {
    if (await User.exists({ email })) return res.status(400).json({ message: 'This email is already verified.' });
    return res.status(404).json({ message: 'No pending signup found for this email.' });
  }
  const lastSent = resendAt.get(email) || 0;
  const waitSeconds = Math.ceil((lastSent + RESEND_COOLDOWN_MS - Date.now()) / 1000);
  if (waitSeconds > 0) return res.status(429).json({ message: `Please wait ${waitSeconds} seconds before requesting another code.`, retryAfter: waitSeconds });
  await issuePendingOtp(pending);
  resendAt.set(email, Date.now());
  res.json({ message: 'A new verification code has been sent.' });
}
