/**
 * Fixed, maximally-restrictive Content-Security-Policy for v1 of the sandbox
 * page — no `?csp=`-driven per-tool domain allowlist (see
 * `mcp-app-sandbox-proxy` spec's documented non-goal). Set as a real HTTP
 * response header, never a `<meta>` tag, so it cannot be tampered with by
 * anything running inside the page.
 */
export const SANDBOX_CSP_HEADER = [
  "default-src 'self'",
  "img-src 'self' data: blob:",
  "font-src 'self' data: blob:",
  "style-src 'self' 'unsafe-inline' data: blob:",
  "script-src 'self' 'unsafe-inline'",
  "frame-src 'none'",
  "object-src 'none'",
  "base-uri 'none'",
].join('; ');
