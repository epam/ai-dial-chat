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
 * Builds the `Permissions-Policy` header value delegating the
 * `local-network-access` feature to `'self'` plus every allowlisted iframe
 * origin. Helmet has no built-in support for this header, so `main.ts`
 * applies the returned value via its own middleware. Delegation lets the
 * `/apps-editor` embedded schema iframe — and any window it opens, such as
 * an identity-provider login popup — request the Local Network Access
 * permission needed when the embedded app's or its identity provider's
 * origin resolves to a private/internal IP address.
 */
export const buildPermissionsPolicyHeader = (
  allowedIframeOrigins: string[],
): string =>
  `local-network-access=(self${allowedIframeOrigins.map((origin) => ` ${origin}`).join('')})`;

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
  secureTransport = true,
): HelmetOptions => ({
  crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      /* `data:` covers fonts the bundler inlines as base64 data URIs. */
      fontSrc: ["'self'", 'data:', 'https://fonts.gstatic.com'],
      scriptSrc: [
        "'self'",
        /* Allows the attachment canvas to compile its same-origin OOXML WASM
         * parsers without enabling arbitrary JavaScript evaluation. */
        "'wasm-unsafe-eval'",
      ],
      workerSrc: ["'self'", 'blob:'],
      imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
      mediaSrc: ["'self'", 'blob:'],
      connectSrc: ["'self'", 'blob:'],
      frameSrc: buildFrameSrcDirective(allowedIframeOrigins),
      frameAncestors: buildFrameAncestorsDirective(allowedIframeOrigins),
      upgradeInsecureRequests: secureTransport ? [] : null,
    },
  },
  frameguard: allowedIframeOrigins.length > 0 ? false : undefined,
  hsts: secureTransport
    ? {
        maxAge: 31536000, // 1 year in seconds
        includeSubDomains: true,
        preload: true,
      }
    : false,
});
