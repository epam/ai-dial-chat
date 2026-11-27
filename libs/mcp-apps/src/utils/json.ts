/**
 * Parses `raw` as JSON and returns it when it is a plain object, or `undefined` for invalid JSON, arrays, and scalars.
 * @param raw - JSON text
 */
export const parseJsonObject = (
  raw: string,
): Record<string, unknown> | undefined => {
  try {
    const parsed: unknown = JSON.parse(raw);
    return typeof parsed === 'object' &&
      parsed !== null &&
      !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : undefined;
  } catch {
    return undefined;
  }
};
