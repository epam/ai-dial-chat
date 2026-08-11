/**
 * Fixed, maximally-restrictive Content-Security-Policy for v1 of the sandbox
 * page — no `?csp=`-driven per-tool domain allowlist (see
 * `mcp-app-sandbox-proxy` spec's documented non-goal). Set as a real HTTP
 * response header, never a `<meta>` tag, so it cannot be tampered with by
 * anything running inside the page.
 *
 * `script-src` cannot be nonce-locked: the inner iframe's MCP App content is
 * mounted via `doc.write`/`srcdoc`, which has no URL of its own and so
 * inherits this exact CSP header — and that content's inline scripts are
 * arbitrary, tool-supplied markup this proxy does not control and cannot
 * attach a matching nonce to. A nonce-source in `script-src` makes browsers
 * ignore the `'unsafe-inline'` fallback entirely (per the CSP spec's
 * backwards-compat rule), so nonce-locking here would block every MCP App's
 * own inline script, not just tighten this page's one bootstrap script.
 * `'unsafe-inline'` stays a deliberate, documented tradeoff for v1.
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
