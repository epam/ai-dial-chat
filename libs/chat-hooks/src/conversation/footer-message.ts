import DOMPurify, { type Config } from 'dompurify';

const FOOTER_HTML_SANITIZE_OPTIONS: Config = {
  ALLOWED_TAGS: ['a', 'span', 'strong', 'u', 'em', 'br', 'p'],
  ALLOWED_ATTR: ['href', 'target', 'rel'],
};

/** Sanitizes footer message HTML to the allowed tag/attribute set. */
export const sanitizeFooterHtml = (html: string): string =>
  DOMPurify.sanitize(html, FOOTER_HTML_SANITIZE_OPTIONS) as string;

/**
 * Normalises a version string for display. The server falls back to a bare
 * `package.json` version (`0.45.0`), while a CI-supplied `CHAT_VERSION` is
 * often already tagged (`v0.45.0`) — prefixing unconditionally would render
 * `vv0.45.0`.
 */
export const formatAppVersion = (version: string): string => {
  const trimmed = version.trim();
  return /^v/i.test(trimmed) ? trimmed : `v${trimmed}`;
};
