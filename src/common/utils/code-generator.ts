import * as crypto from 'crypto';

/**
 * Generates an alphanumeric code in the format DDD-DDD-DDD-DDD
 */
export function generateFormattedCode(): string {
  const hex = crypto.randomBytes(6).toString('hex').toUpperCase();
  return `${hex.slice(0, 3)}-${hex.slice(3, 6)}-${hex.slice(6, 9)}-${hex.slice(9, 12)}`;
}
