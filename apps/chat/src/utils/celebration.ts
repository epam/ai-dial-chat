/** Keep letters from every locale; a phrase must still match the entire input. */
export const normalizeCelebrationPhrase = (text: string): string =>
  text
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^\p{L}\p{M}\p{N}]+/gu, ' ')
    .trim();

export const matchesCelebrationPhrase = (
  text: string,
  phrases: readonly string[],
): boolean => {
  const normalized = normalizeCelebrationPhrase(text);
  return (
    normalized.length > 0 &&
    phrases.some((phrase) => normalizeCelebrationPhrase(phrase) === normalized)
  );
};

/** Empty and single-scene events are valid, too. */
export const pickCelebrationScene = (
  ids: readonly string[],
  previous?: string,
): string | undefined => {
  const unique = [...new Set(ids)];
  const choices =
    unique.length > 1 ? unique.filter((id) => id !== previous) : unique;
  return choices[Math.floor(Math.random() * choices.length)];
};
