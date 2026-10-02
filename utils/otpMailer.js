import nodemailer from 'nodemailer';

const emailPass = process.env.EMAIL_PASS?.replace(/\s/g, '');
const transporter = process.env.EMAIL_USER && emailPass
  ? nodemailer.createTransport({
      service: process.env.EMAIL_SERVICE || 'gmail',
  auth: { user: process.env.EMAIL_USER, pass: emailPass },
    })
  : null;

export async function sendOtpEmail(email, otp) {
  if (!transporter) {
    console.warn(`[OTP dev fallback] ${email}: ${otp}`);
    return;
  }

  try {
    const result = await transporter.sendMail({
      from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
      to: email,
      subject: 'Your GarbaJodi verification code',
      text: `Your GarbaJodi verification code is ${otp}. It expires in 10 minutes.`,
      html: `<p>Your GarbaJodi verification code is <strong>${otp}</strong>.</p><p>This code expires in 10 minutes.</p>`,
    });
    console.log(`OTP email accepted by SMTP for ${email}: ${result.messageId}`);
  } catch (error) {
    console.error('OTP email delivery failed; using development fallback.', error.message);
    console.warn(`[OTP dev fallback] ${email}: ${otp}`);
  }
}
