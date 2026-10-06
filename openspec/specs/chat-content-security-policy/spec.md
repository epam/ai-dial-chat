# chat-content-security-policy Specification

## Purpose

Define the chat application's Content Security Policy, including approved runtime
styles, per-response HTML nonces, staged enforcement and reporting, and the
execution contexts that retain WebAssembly permission for document previews.

## Requirements

### Requirement: Nonce-backed frontend HTML

The server SHALL issue a fresh cryptographic nonce for every frontend HTML response,
including deep links and direct index requests. Nonce-aware documents and their CSP
SHALL use the same nonce. Legacy templates without the marker SHALL be served
unchanged only in report-only mode. HTML SHALL NOT be cached or returned as a
conditional 304.

#### Scenario: Repeated and conditional navigation
- **WHEN** two requests fetch the same nonce-aware HTML, including an If-None-Match request
- **THEN** both return complete HTML with different nonces matching their headers
- **AND** both carry `Cache-Control: no-store`

### Requirement: Approved styles and strict execution

Strict enforcement SHALL permit same-origin/existing Google stylesheets and trusted
runtime styles carrying the nonce. It SHALL block arbitrary inline styles, inline
event handlers, inline scripts, and JavaScript eval. Application integration SHALL
use narrowly scoped build adaptation for trusted bundled style producers that cannot
receive a shared application nonce setting, never a global DOM patch.

#### Scenario: Grid and an injected style
- **WHEN** the application renders a grid and an unapproved style element is inserted
- **THEN** grid styles are applied and the unapproved style is blocked

### Requirement: Staged enforcement and reporting

`CSP_MODE` SHALL accept only `report-only` and `enforce`, defaulting to `report-only`.
Report-only mode SHALL retain the prior enforced HTML policy and emit the candidate
strict policy. Enforce mode SHALL enforce the candidate. A configured, validated
`CSP_REPORT_URI` SHALL enable legacy and Reporting API delivery to that destination.

#### Scenario: Candidate rollout
- **WHEN** report-only mode is active
- **THEN** the response includes both policy headers and existing JavaScript
  restrictions remain enforced

#### Scenario: Enforcement enabled
- **WHEN** enforce mode is active
- **THEN** the enforced policy does not contain `'unsafe-inline'` or `'unsafe-eval'`

#### Scenario: Legacy frontend during rollout
- **WHEN** report-only mode is active, explicitly or by default, and chat or an
  enabled overlay sandbox has HTML without the nonce marker
- **THEN** the server starts and logs one warning per legacy template requesting
  a frontend rebuild before enforcement
- **AND** it serves the unchanged HTML with the prior enforced policy and the
  strict report-only candidate, retaining inline JavaScript and eval restrictions

#### Scenario: Legacy frontend with enforcement requested
- **WHEN** enforce mode is active and chat or an enabled overlay sandbox has HTML
  without the nonce marker
- **THEN** startup fails with a rebuild error without downgrading the CSP mode

### Requirement: Configurable external connection origins

The server SHALL accept `ALLOWED_CONNECT_ORIGINS` as a comma-separated list of
trusted HTTP(S) origins, defaulting to an empty list. It SHALL trim entries and
ignore empty entries. Each nonempty entry SHALL be an origin
(`scheme://host[:port]`) or a single leading-wildcard-label origin
(`scheme://*.host[:port]`), without credentials, paths, queries, fragments, or
header/directive delimiters. Invalid entries SHALL fail startup validation.

Configured origins SHALL extend `connect-src 'self' blob:` in the enforced policy
and, when present, the report-only candidate. This SHALL apply to chat HTML,
including embedded chat and deep links, and enabled overlay sandbox HTML.
Connection origins SHALL NOT grant script-loading or iframe permissions.
Configuration SHALL remain owned by `chat-api`; viewer libraries SHALL NOT read
environment variables or encode deployment-specific origins. Direct external
document fetches SHALL remain subject to remote-server CORS and authorization.

#### Scenario: No external origins configured

- **WHEN** `ALLOWED_CONNECT_ORIGINS` is unset or empty
- **THEN** `connect-src` permits only `'self'` and `blob:`

#### Scenario: External document in enforce mode

- **WHEN** `https://documents.example.com` is configured and `CSP_MODE=enforce`
- **THEN** the chat HTML policy includes that origin in `connect-src`, allowing
  the PDF or Office viewer to attempt a direct fetch
- **AND** the setting does not add that origin to `script-src`, `frame-src`, or
  `frame-ancestors`

#### Scenario: External document during report-only rollout

- **WHEN** a connection origin is configured and `CSP_MODE=report-only`
- **THEN** both the enforced and report-only HTML policies include that origin
  in `connect-src`, including embedded chat and enabled overlay sandbox pages
- **AND** the enforced baseline does not retain a conflicting self-only
  connection restriction

#### Scenario: Subdomain family

- **WHEN** `https://*.reports.example.com` is configured
- **THEN** `connect-src` permits HTTPS connections to its subdomains
- **AND** it does not permit the bare `https://reports.example.com` origin unless
  that origin is listed separately

#### Scenario: Invalid connection origin

- **WHEN** an entry is a bare `*`, a scheme-only source, a URL with credentials,
  path, query, or fragment, or contains a directive/header injection
- **THEN** startup validation rejects the configuration and identifies
  `ALLOWED_CONNECT_ORIGINS`

### Requirement: PDF credentials follow the existing connection allowlist

The chat app SHALL supply its PDF viewers with a host-owned loader that uses
`credentials: 'include'` only for external HTTP(S) URLs matching
`ALLOWED_CONNECT_ORIGINS`, received through `config.allowedConnectOrigins`.
Matching SHALL include exact origins and leading `*.` subdomain patterns, with
scheme and port boundaries. No additional environment variable or service-specific
domain SHALL be required. The attachment library SHALL accept the loader through
the optional `loadPdf` callback without reading configuration or owning auth policy.

#### Scenario: Allowed external PDF

- **WHEN** an external PDF URL matches the configured connection allowlist
- **THEN** the loader requests it with browser-managed credentials and
  `redirect: 'error'`, rejecting redirects before following them
- **AND** the external server must support credentialed CORS for the chat origin
  and the browser must permit the relevant session cookies

#### Scenario: Other PDF sources

- **WHEN** the URL is same-origin, a blob URL, or an external origin absent from
  the allowlist, or the allowlist is empty
- **THEN** the loader retains `credentials: 'same-origin'` and normal redirect behavior
- **AND** a wildcard entry does not match its bare parent domain or a different port

### Requirement: WebAssembly permission follows its execution context

Only chat HTML and the bundled PDF worker response SHALL carry WebAssembly
permission. Generic APIs, static assets, and overlay sandbox HTML SHALL NOT carry
it. Chat HTML SHALL retain permission while its OOXML runtime uses that context.

#### Scenario: Document data download
- **WHEN** an API returns document bytes or a static asset returns WASM bytes
- **THEN** its policy has no WebAssembly permission, without affecting the
  permission granted to the executing chat document

### Requirement: HTML file downloads carry their own preview-scoped CSP

The file-download route SHALL overwrite the response's `Content-Security-Policy`
header with a dedicated, more permissive policy — built by
`createHtmlPreviewCspHeader(allowedIframeOrigins)` in `apps/chat-api/src/config/csp.ts` — whenever the
downloaded file's `content-type` starts with `text/html`, and SHALL remove any
`Content-Security-Policy-Report-Only` header from that response. Every other
download response SHALL keep the chat app's normal enforced/report-only policy
from the global security-headers middleware, unmodified.

This exists so an HTML file attachment can be previewed by loading this route's
response directly into an iframe (`src=`, not `srcdoc`) without its inline
`<script>`/`<style>` being blocked by the strict policy the chat app enforces for
its own document — that policy has no `'unsafe-inline'`/`'unsafe-eval'`, but an
arbitrary previewed HTML file cannot be expected to carry a nonce or avoid inline
styles. Both the download route and `html-preview-frame` pass the configured
`ALLOWED_IFRAME_ORIGINS`, and the preview-scoped policy's `frame-ancestors` is
built by `buildDownloadFrameAncestorsDirective` as `'self'` followed by every
`ALLOWED_IFRAME_ORIGINS` entry: `'self'` covers this app's own preview iframe,
and the overlay-host origins are required because `frame-ancestors` validates the
entire ancestor chain, so when this app is itself embedded in an overlay host a
bare `'self'` would fail the check for the host page's origin.

As with the WebAssembly exception above, this CSP relaxation is scoped to one
response and never substitutes for document policy. The primary control that
prevents the previewed HTML from reading this app's cookies, session, or APIs is
the policy's own `sandbox allow-scripts` directive (no `allow-same-origin`),
which forces the response to render at an opaque origin even when it is opened
directly (new tab, bookmark, external link) rather than through the preview
iframe. The policy also sets `connect-src`, `object-src`, `base-uri`,
`form-action`, `worker-src`, `frame-src`, and `child-src` each explicitly to
`'none'`, and `script-src` to `'unsafe-inline'` only (no `'unsafe-eval'`, no
remote/data/blob script sources). The iframe's `sandbox="allow-scripts"`
attribute set by the attachment-canvas viewer is redundant defense-in-depth on
top of that directive. See the `attachment-canvas-html-viewer` spec's `HtmlContent`
renderer requirement for the sandbox rationale.

#### Scenario: HTML download gets the preview CSP
- **WHEN** the file-download route returns a response whose `content-type` starts
  with `text/html`
- **THEN** the response's `Content-Security-Policy` header is
  `createHtmlPreviewCspHeader()`'s value, not the global enforced/report-only
  policy
- **AND** no `Content-Security-Policy-Report-Only` header is present on that
  response

#### Scenario: Preview CSP allows the overlay host chain and sandboxes itself
- **GIVEN** `ALLOWED_IFRAME_ORIGINS` is `https://host.example`
- **WHEN** the file-download route returns a `text/html` response, or
  `GET /api/v1/files/html-preview-frame` is requested
- **THEN** the preview CSP contains `frame-ancestors 'self' https://host.example`
  and `sandbox allow-scripts`
- **AND** it contains `connect-src 'none'`

#### Scenario: Non-HTML download keeps the standard policy
- **WHEN** the file-download route returns a response whose `content-type` does
  not start with `text/html`
- **THEN** the response's CSP headers are the global security-headers
  middleware's unmodified output

### Requirement: In-memory HTML previews load a preview-scoped bootstrap document

HTML with no file URL (an attachment carried inline as `data`) SHALL NOT be
previewed through the iframe `srcdoc` attribute when the host supplies a
bootstrap document, because a `srcdoc` document inherits the chat document's
enforced CSP. `GET /api/v1/files/html-preview-frame` SHALL return a static
bootstrap document whose `Content-Security-Policy` is
`createHtmlPreviewCspHeader()`'s value, with no
`Content-Security-Policy-Report-Only` header. The document SHALL accept a single
`{ type: 'dial-html-preview:render', html }` message, only from its parent
window, and replace itself with `html` via `document.write`, so the HTML renders
under that response's sandboxed policy.

#### Scenario: Inline HTML attachment renders its inline styles and scripts
- **WHEN** an assistant message carries a `text/html` attachment with `data` and
  no `url`, and the user opens its preview
- **THEN** the preview iframe loads `/api/v1/files/html-preview-frame` via `src`
  with `sandbox="allow-scripts"` and receives the HTML over `postMessage`
- **AND** the HTML's inline `<style>` and `<script>` are not refused by the chat
  document's CSP

#### Scenario: Bootstrap document carries the preview CSP
- **WHEN** `GET /api/v1/files/html-preview-frame` is requested
- **THEN** the response's `Content-Security-Policy` header is
  `createHtmlPreviewCspHeader()`'s value, not the global enforced/report-only
  policy

### Requirement: Static routing compatibility

The server SHALL preserve asset MIME types and missing-asset 404s, API route
exclusion, and the optional overlay sandbox feature flag.

#### Scenario: Reserved missing resource
- **WHEN** a missing API or `/assets/` URL is requested
- **THEN** the server returns 404 rather than nonce-bearing SPA HTML
