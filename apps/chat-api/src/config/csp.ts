import type { HelmetOptions } from 'helmet';

export enum CspMode {
  ReportOnly = 'report-only',
  Enforce = 'enforce',
}

export const CSP_NONCE_PLACEHOLDER = '__DIAL_CSP_NONCE__';

interface CspOptions {
  nonce?: string;
  allowWasm?: boolean;
  allowInlineStyles?: boolean;
  reportOnly?: boolean;
  reportUri?: string;
}

export const buildFrameSrcDirective = (
  allowedIframeOrigins: string[],
): string[] => ["'self'", ...allowedIframeOrigins];

/** Returns the origin of `url`, or `undefined` when it cannot be parsed. */
export const extractOrigin = (url: string): string | undefined => {
  try {
    return new URL(url).origin;
  } catch {
    return undefined;
  }
};

/**
 * Returns whether `url`'s origin is covered by `allowedIframeOrigins`, which
 * `frame-src` is built from — either by an exact origin entry or by a
 * leading-wildcard-label entry (`scheme://*.host[:port]`). `'self'` is not
 * considered, so a same-origin URL reads as not covered; callers that only
 * warn should say so. An unparseable `url` returns `false`.
 */
export const isOriginAllowedForIframe = (
  url: string,
  allowedIframeOrigins: string[],
): boolean => {
  const origin = extractOrigin(url);
  if (origin == null) {
    return false;
  }
  const target = new URL(origin);

  return allowedIframeOrigins.some((entry) => {
    const trimmed = entry.trim();
    if (trimmed === '') {
      return false;
    }
    /* A wildcard entry only ever carries the single leading label form the
     * env validator enforces, so stripping `*.` yields a parseable origin
     * whose host is the suffix the pattern accepts. */
    const isWildcard = trimmed.includes('*.');
    const candidate = extractOrigin(trimmed.replace('*.', ''));
    if (candidate == null) {
      return false;
    }
    if (!isWildcard) {
      return candidate === origin;
    }
    const pattern = new URL(candidate);
    /* A strict subdomain only: CSP's `*.example.com` does not cover the bare
     * apex, so treating it as covered would suppress the warning in a case the
     * browser blocks. */
    return (
      target.protocol === pattern.protocol &&
      target.port === pattern.port &&
      target.hostname.endsWith(`.${pattern.hostname}`)
    );
  });
};

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
 *
 * `referrerPolicy` is overridden from Helmet's `no-referrer` default to
 * `strict-origin-when-cross-origin` (the modern browser default). This app's
 * pages embed sandboxed origins (e.g. the MCP app sandbox) in an iframe, and
 * that sandbox validates the iframe navigation's `Referer` header against its
 * own host-origin allowlist. `no-referrer` would strip the header entirely,
 * making every such embed fail with a 403 in the sandbox regardless of how
 * correctly its allowlist is configured.
 */
export const createHelmetOptions = (
  allowedIframeOrigins: string[],
  secureTransport = true,
  {
    nonce,
    allowWasm = false,
    allowInlineStyles = false,
    reportOnly = false,
    reportUri,
  }: CspOptions = {},
): HelmetOptions => ({
  crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  contentSecurityPolicy: {
    reportOnly,
    directives: {
      defaultSrc: ["'self'"],
      baseUri: ["'self'"],
      objectSrc: ["'none'"],
      styleSrc: [
        "'self'",
        'https://fonts.googleapis.com',
        ...(allowInlineStyles ? ["'unsafe-inline'"] : []),
        ...(!allowInlineStyles && nonce ? [`'nonce-${nonce}'`] : []),
      ],
      styleSrcAttr: [allowInlineStyles ? "'unsafe-inline'" : "'none'"],
      /* `data:` covers fonts the bundler inlines as base64 data URIs. */
      fontSrc: ["'self'", 'data:', 'https://fonts.gstatic.com'],
      scriptSrc: [
        "'self'",
        /* This permission belongs to the executing document/worker, never
         * to the API response returning document bytes or a WASM binary. */
        ...(allowWasm ? ["'wasm-unsafe-eval'"] : []),
      ],
      scriptSrcAttr: ["'none'"],
      workerSrc: ["'self'", 'blob:'],
      imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
      mediaSrc: ["'self'", 'blob:'],
      connectSrc: ["'self'", 'blob:'],
      frameSrc: buildFrameSrcDirective(allowedIframeOrigins),
      frameAncestors: buildFrameAncestorsDirective(allowedIframeOrigins),
      upgradeInsecureRequests: secureTransport ? [] : null,
      ...(reportUri ? { reportUri: [reportUri], reportTo: ['csp'] } : {}),
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
