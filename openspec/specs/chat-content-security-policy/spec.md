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

### Requirement: Static routing compatibility

The server SHALL preserve asset MIME types and missing-asset 404s, API route
exclusion, and the optional overlay sandbox feature flag.

#### Scenario: Reserved missing resource
- **WHEN** a missing API or `/assets/` URL is requested
- **THEN** the server returns 404 rather than nonce-bearing SPA HTML
