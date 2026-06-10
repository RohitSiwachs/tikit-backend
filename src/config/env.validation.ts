import * as Joi from 'joi';

export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),
  PORT: Joi.number().default(3000),

  // Database
  DATABASE_URL: Joi.string().required(),

  // JWT — RS256 asymmetric keys
  JWT_PRIVATE_KEY: Joi.string().required(),
  JWT_PUBLIC_KEY: Joi.string().required(),
  JWT_EXPIRATION: Joi.string().default('15m'),
  JWT_REFRESH_EXPIRATION_DAYS: Joi.number().default(30),

  // CORS — required in production; multiple origins comma-separated
  CORS_ORIGIN: Joi.string().when('NODE_ENV', {
    is: 'production',
    then: Joi.required(),
    otherwise: Joi.optional().default('http://localhost:3001'),
  }),

  // Frontend URL for password reset links
  FRONTEND_URL: Joi.string().when('NODE_ENV', {
    is: 'production',
    then: Joi.required(),
    otherwise: Joi.optional().default('http://localhost:3001'),
  }),

  // Cloudflare R2 (S3-compatible object storage)
  R2_ENDPOINT: Joi.string().optional().allow(''),
  R2_ACCESS_KEY_ID: Joi.string().optional().allow(''),
  R2_SECRET_ACCESS_KEY: Joi.string().optional().allow(''),
  R2_BUCKET_NAME: Joi.string().optional().default('tikit-media'),
  R2_PUBLIC_URL: Joi.string().optional().allow(''),

  // SMS provider selection (mock | hellosms) — defaults to mock
  SMS_PROVIDER: Joi.string().valid('mock', 'hellosms').default('mock'),
  HELLOSMS_USERNAME: Joi.string().when('SMS_PROVIDER', {
    is: 'hellosms',
    then: Joi.required(),
    otherwise: Joi.optional().allow(''),
  }),
  HELLOSMS_PASSWORD: Joi.string().when('SMS_PROVIDER', {
    is: 'hellosms',
    then: Joi.required(),
    otherwise: Joi.optional().allow(''),
  }),

  // Resend Email (optional — falls back to console logger in dev)
  RESEND_API_KEY: Joi.string().optional().allow(''),

  // Redis (required — BullMQ queue backend)
  REDIS_URL: Joi.string().required(),

  // Expo Push Notifications access token (optional — improves rate limits)
  EXPO_ACCESS_TOKEN: Joi.string().optional().allow(''),
});
