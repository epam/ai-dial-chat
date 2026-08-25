/*
 * The sandbox CSP cannot restrict script/resource origins because we don't know
 * what the MCP app will load. Isolation is achieved instead through:
 *   - `sandbox allow-scripts allow-same-origin allow-forms allow-popups` —
 *     `allow-same-origin` grants the sandbox proxy's own isolated origin (not the
 *     chat application's origin) to the inner iframe. Chat cookies, localStorage,
 *     sessionStorage, IndexedDB, and DOM remain inaccessible because the sandbox
 *     proxy is deployed at a distinct origin from the chat app.
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
