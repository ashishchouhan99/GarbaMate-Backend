import 'dotenv/config';
import { v2 as cloudinary } from 'cloudinary';

const cleanEnv = (value) => value?.trim().replace(/^['"]|['"]$/g, '');
const cloudName = cleanEnv(process.env.CLOUDINARY_CLOUD_NAME);
const apiKey = cleanEnv(process.env.CLOUDINARY_API_KEY);
const apiSecret = cleanEnv(process.env.CLOUDINARY_API_SECRET);

export const cloudinaryConfigured = Boolean(cloudName && apiKey && apiSecret);

cloudinary.config({
  cloud_name: cloudName,
  api_key: apiKey,
  api_secret: apiSecret,
  secure: true,
});

console.log({ cloudName, apiKeyExists: Boolean(apiKey), apiSecretExists: Boolean(apiSecret) });

export default cloudinary;
