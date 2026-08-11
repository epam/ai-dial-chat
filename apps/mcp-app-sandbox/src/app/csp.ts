/*
 * The sandbox CSP cannot restrict script/resource origins because we don't know
 * what the MCP app will load. Isolation is achieved instead through:
 *   - `sandbox allow-scripts allow-forms allow-popups` — drops `allow-same-origin`,
 *     giving the page a null origin so it cannot access cookies, localStorage,
 *     sessionStorage, or IndexedDB.
 *   - `frame-ancestors <hostOrigin>` — built dynamically so only the validated
 *     chat host can embed the sandbox page.
 */
const SANDBOX_CSP_BASE =
  'sandbox allow-scripts allow-same-origin allow-forms allow-popups; ' +
  "default-src * 'unsafe-inline' 'unsafe-eval' data: blob:; " +
  "object-src 'none'; " +
  "base-uri 'none';";

export const buildSandboxCspHeader = (hostOrigin: string): string =>
  `${SANDBOX_CSP_BASE} frame-ancestors ${hostOrigin};`;
