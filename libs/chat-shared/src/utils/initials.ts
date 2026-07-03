/** Returns the first Unicode letter character from a word, ignoring leading punctuation. */
const firstLetter = (word: string): string => word.match(/\p{L}/u)?.[0] ?? '';

/**
 * Returns 1–2 uppercase initials derived from a display name.
 *
 * - Empty/whitespace-only → `"?"`
 * - Two or more words → first letter of each of the first two words (skipping leading punctuation like `[` or `(`)
 * - Single word → first two letter characters of that word
 */
export const extractInitials = (name: string): string => {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';

  if (words.length >= 2) {
    const initials = (
      firstLetter(words[0]) + firstLetter(words[1])
    ).toUpperCase();
    return initials || '?';
  }

  const letters = words[0].replace(/[^\p{L}]/gu, '');
  return letters.slice(0, 2).toUpperCase() || '?';
};
