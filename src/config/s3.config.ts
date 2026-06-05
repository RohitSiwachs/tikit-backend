import { registerAs } from '@nestjs/config';

export default registerAs('s3', () => ({
  region: 'auto',
  endpoint: process.env.R2_ENDPOINT || '',
  accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
  secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
  bucket: process.env.R2_BUCKET_NAME || 'tikit-media',
  publicUrl: process.env.R2_PUBLIC_URL || '',
}));
