import type { HelmetOptions } from 'helmet';

export const buildFrameSrcDirective = (
  allowedIframeOrigins: string[],
): string[] => ["'self'", ...allowedIframeOrigins];

/**
 * Builds the CSP `frame-ancestors` directive controlling which origins may
 * embed this app in an iframe. Defaults to a full deny (`'none'`) when no
 * origin is allowlisted; does not implicitly add `'self'`.
 */
export const buildFrameAncestorsDirective = (
  allowedOverlayOrigins: string[],
): string[] =>
  allowedOverlayOrigins.length > 0 ? allowedOverlayOrigins : ["'none'"];

/**
 * Builds the Helmet options used by `main.ts`'s security-headers middleware.
 * Disables `frameguard` (which sends `X-Frame-Options: SAMEORIGIN` by
 * default) only once at least one origin is allowlisted, relying solely on
 * CSP `frame-ancestors` for framing control in that case; the empty-allowlist
 * default-deny posture (frameguard enabled) is otherwise unchanged. Uses
 * `same-origin-allow-popups` for COOP so navigating an OAuth popup to an
 * external identity provider does not sever the opener's WindowProxy and
 * make an active popup look closed. The popup clears its own `window.opener`
 * before that navigation, preserving reverse-tabnabbing protection.
 */
export const createHelmetOptions = (
  allowedIframeOrigins: string[],
): HelmetOptions => ({
  crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      scriptSrc: ["'self'"],
      workerSrc: ["'self'", 'blob:'],
      imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
      connectSrc: ["'self'", 'blob:'],
      frameSrc: buildFrameSrcDirective(allowedIframeOrigins),
      frameAncestors: buildFrameAncestorsDirective(allowedIframeOrigins),
    },
  },
  frameguard: allowedIframeOrigins.length > 0 ? false : undefined,
  hsts: {
    maxAge: 31536000, // 1 year in seconds
    includeSubDomains: true,
    preload: true,
  },
});
