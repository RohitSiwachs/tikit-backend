import { registerAs } from '@nestjs/config';

export default registerAs('jwt', () => ({
  privateKey: (process.env.JWT_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
  publicKey: (process.env.JWT_PUBLIC_KEY || '').replace(/\\n/g, '\n'),
  accessExpiration: process.env.JWT_ACCESS_EXPIRATION || '15m',
  refreshExpiration: process.env.JWT_REFRESH_EXPIRATION || '30d',
}));
