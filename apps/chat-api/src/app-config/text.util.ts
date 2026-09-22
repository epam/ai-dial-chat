/* Blank and whitespace-only operator values are treated as "unset" so the
 * banner never reserves space for an empty string. */
export const toNullableText = (value: unknown): string | null => {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};
