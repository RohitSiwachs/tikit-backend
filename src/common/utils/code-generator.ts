import * as crypto from 'crypto';

/** Card code format: DDD-DDD-DDD-DDD (12 digits split into 4 groups). */
const CARD_CODE_REGEX = /^\d{3}-\d{3}-\d{3}-\d{3}$/;

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

/**
 * Returns true if the given string matches the card code format DDD-DDD-DDD-DDD.
 * Use this wherever a code is supplied by an external caller (user input, API body, etc.).
 */
export function isValidCardCode(code: string): boolean {
  return CARD_CODE_REGEX.test(code);
}
