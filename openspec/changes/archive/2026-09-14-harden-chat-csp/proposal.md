## Why

The deployed chat permits arbitrary inline CSS through `style-src 'unsafe-inline'`.
Removing it without integration blocks AG Grid's generated styles. The current
WebAssembly exception is also emitted on every response, although most responses
do not need it.

## What Changes

- Serve the chat HTML with a fresh cryptographic style nonce and no shared caching.
- Adapt trusted bundled grid, OOXML, and overlay style creation during the
  application build. Keep arbitrary inline scripts, event
  handlers, style attributes, and unapproved style elements blocked in strict mode.
- Add an explicit report-only rollout mode and optional CSP report destination;
  retain the existing enforced policy while monitoring the stricter policy.
- Limit the WebAssembly exception to chat HTML and the PDF worker response.
- Document the rollout and the remaining need for document-context isolation to
  remove WebAssembly from chat HTML entirely.

## Capabilities

### New Capabilities

- `chat-content-security-policy`: Nonce integration, staged enforcement, reporting,
  and response-specific WebAssembly policy.

### Modified Capabilities

None.

## Impact

Backend HTML serving and security configuration, frontend Vite builds,
the optional overlay sandbox build, tests, and deployment documentation. No business
API, generated client, user-facing strings, or library public API changes.

## Acceptance criteria

- A strict-mode browser renders the installed grid and approved runtime styles,
  while blocking injected CSS/JavaScript and JavaScript evaluation.
- HTML and CSP carry matching, unpredictable, per-response nonces, including deep
  links, direct `index.html` requests, HEAD, and conditional requests.
- API and asset responses do not inherit the HTML-only WebAssembly permission.
- Report-only mode preserves existing enforcement and emits the candidate policy.

## Alternatives and rollback

A header-only edit breaks the grid. Global DOM monkey-patching would authorize
unrelated styles. The installed UI Kit bundles its own grid runtime, which the native global
nonce setting does not reach. Use a build adapter scoped to known style producers. Roll back enforcement with `CSP_MODE=report-only` while
investigating violations; this intentionally retains the original inline-CSS risk.

## Non-goals

MCP sandbox policy changes, redesigning document viewers around an iframe, removing
required resource sources without compatibility evidence, or deployment to production.
