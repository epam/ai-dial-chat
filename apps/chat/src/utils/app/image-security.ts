/**
 * Helpers that decide whether a markdown image is safe to auto-load.
 *
 * Rendering an external `<img>` lets the browser silently issue a GET request,
 * which can be abused to exfiltrate conversation data via the URL query string
 * (markdown pixel-tracking / indirect prompt-injection exfiltration). Only
 * same-origin images, `data:` URIs (no network egress) and an explicit
 * admin-configured allowlist of hosts are permitted; everything else is
 * stripped from the rendered output.
 */

/**
 * Parses the `ALLOWED_IMAGE_SOURCES` setting (a whitespace-separated list of
 * origins/hosts, mirroring the CSP-style `ALLOWED_IFRAME_SOURCES`) into a list
 * of bare, lower-cased hosts.
 */
export const parseAllowedImageHosts = (
  allowedImageSources: string | undefined,
): string[] => {
  if (!allowedImageSources) {
    return [];
  }

  return allowedImageSources
    .split(/\s+/)
    .map((source) => source.trim())
    .filter(Boolean)
    .map((source) => {
      try {
        // Accept both `https://host[:port]` and bare `host[:port]` entries.
        return new URL(
          source.includes('://') ? source : `https://${source}`,
        ).host.toLowerCase();
      } catch {
        return source.toLowerCase();
      }
    })
    .filter(Boolean);
};

/**
 * Returns `true` when an image `src` is safe to render/auto-load.
 *
 * SSR-safe: relies on URL shape only, never on `window`.
 * - falsy             -> false
 * - `data:`           -> true (no network request is made)
 * - relative / `/api` -> true (same-origin)
 * - absolute http(s)  -> true only if the host is in `allowedHosts`
 */
export const isAllowedImageUrl = (
  src: string | undefined,
  allowedHosts: string[],
): boolean => {
  if (!src) {
    return false;
  }

  const normalized = src.trim().toLowerCase();

  if (normalized.startsWith('data:')) {
    return true;
  }

  const isAbsolute =
    normalized.startsWith('//') ||
    normalized.startsWith('http://') ||
    normalized.startsWith('https://');

  // Relative URLs (e.g. `/api/...`, `api/files/...`) resolve same-origin.
  if (!isAbsolute) {
    return true;
  }

  try {
    const host = new URL(
      normalized.startsWith('//') ? `https:${normalized}` : normalized,
    ).host.toLowerCase();

    return allowedHosts.includes(host);
  } catch {
    return false;
  }
};
