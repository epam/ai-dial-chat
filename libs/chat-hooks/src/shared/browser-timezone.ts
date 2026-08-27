/**
 * Resolves the browser's current IANA timezone for request-scoped downstream
 * context. Detection is best-effort because embedded or restricted runtimes
 * may expose an incomplete `Intl` implementation.
 */
export const getBrowserTimezone = (): string | undefined => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || undefined;
  } catch {
    return undefined;
  }
};
