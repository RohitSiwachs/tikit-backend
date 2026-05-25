import * as Joi from 'joi';

export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
  PORT: Joi.number().default(3000),

  // Database
  DATABASE_URL: Joi.string().required(),

  // JWT — RS256 asymmetric keys
  JWT_PRIVATE_KEY: Joi.string().required(),
  JWT_PUBLIC_KEY: Joi.string().required(),
  JWT_EXPIRATION: Joi.string().default('15m'),
  JWT_REFRESH_EXPIRATION_DAYS: Joi.number().default(30),

  // AWS S3 (Optional - allows boot even without S3 credentials configured)
  AWS_REGION: Joi.string().optional().default('eu-north-1'),
  AWS_ACCESS_KEY_ID: Joi.string().optional().allow(''),
  AWS_SECRET_ACCESS_KEY: Joi.string().optional().allow(''),
  AWS_S3_BUCKET: Joi.string().optional().default('tikit-uploads'),

  // 46elks SMS (optional — falls back to mock in dev)
  ELKS_USERNAME: Joi.string().optional(),
  ELKS_PASSWORD: Joi.string().optional(),
});
