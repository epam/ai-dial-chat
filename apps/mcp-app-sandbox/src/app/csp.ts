/**
 * Fixed, maximally-restrictive Content-Security-Policy for v1 of the sandbox
 * page — no `?csp=`-driven per-tool domain allowlist (see
 * `mcp-app-sandbox-proxy` spec's documented non-goal). Set as a real HTTP
 * response header, never a `<meta>` tag, so it cannot be tampered with by
 * anything running inside the page. `scriptNonce` pins `script-src` to the
 * one inline `<script>` the page itself renders, instead of a blanket
 * `'unsafe-inline'` that would silently permit any future inline script.
 */
export const buildSandboxCspHeader = (scriptNonce: string): string =>
  [
    "default-src 'self'",
    "img-src 'self' data: blob:",
    "font-src 'self' data: blob:",
    "style-src 'self' 'unsafe-inline' data: blob:",
    `script-src 'self' 'nonce-${scriptNonce}'`,
    "frame-src 'none'",
    "object-src 'none'",
    "base-uri 'none'",
  ].join('; ');
