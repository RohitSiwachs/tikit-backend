import * as crypto from 'crypto';

/**
 * Generates a numeric code in the format DDD-DDD-DDD-DDD
 * where D is a digit from 0-9.
 */
export function generateFormattedCode(): string {
  let digits = '';
  for (let i = 0; i < 12; i++) {
    digits += crypto.randomInt(0, 10).toString();
  }
  return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6, 9)}-${digits.slice(9, 12)}`;
}
