## Purpose

Define the chat application's Content Security Policy, including approved runtime
styles, per-response HTML nonces, staged enforcement and reporting, and the
execution contexts that retain WebAssembly permission for document previews.

## ADDED Requirements

### Requirement: Nonce-backed frontend HTML

The server SHALL issue a fresh cryptographic nonce for every frontend HTML response,
including deep links and direct index requests. The document and its CSP SHALL use
the same nonce. HTML SHALL NOT be cached or returned as a conditional 304.

#### Scenario: Repeated and conditional navigation
- **WHEN** two requests fetch the same HTML, including an If-None-Match request
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
