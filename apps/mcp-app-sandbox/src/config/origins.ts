/**
 * Reduces an allowlist entry to the bare origin a browser sends in `Origin` (no trailing slash,
 * path or default port). Returns the entry unchanged when it has no parsable origin, so the
 * URL validation still rejects it.
 * @param entry - one trimmed value of `MCP_APP_SANDBOX_ALLOWED_HOST_ORIGINS`
 */
export const normalizeOrigin = (entry: string): string => {
  try {
    const { origin } = new URL(entry);
    return origin === 'null' ? entry : origin;
  } catch {
    return entry;
  }
};
