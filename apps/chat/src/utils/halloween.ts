import { HALLOWEEN_SECRET_PHRASE } from '../constants/halloween';

/**
 * Collapses anything that is not a latin letter into single spaces, so
 * "Trick-or-Treat!" and "trick  or  treat" both reach the stored phrase.
 */
const normalizePhrase = (text: string): string =>
  text
    .toLowerCase()
    .replace(/[^a-z]+/g, ' ')
    .trim();

/**
 * Whether `text` is the Halloween easter egg's secret phrase, ignoring case,
 * punctuation, and surrounding whitespace. Deliberately an exact match on the
 * whole input: a message that merely mentions the phrase still sends normally.
 */
export const isHalloweenSecretPhrase = (text: string): boolean =>
  normalizePhrase(text) === HALLOWEEN_SECRET_PHRASE;
