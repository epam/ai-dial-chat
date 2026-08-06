## ADDED Requirements

### Requirement: `apps/mcp-app-sandbox` is a new, isolated-origin Nx app

A new minimal NestJS app, `apps/mcp-app-sandbox`, implements the MCP Apps double-iframe sandbox-proxy page that `@mcp-ui/client`'s `AppRenderer`/`AppFrame` requires (see `design.md` D2/D7). It is adapted from `modelcontextprotocol/ext-apps`'s reference implementation (`examples/basic-host/{sandbox.html,src/sandbox.ts,serve.ts}`), not vendored verbatim.

It MUST be deployed at an origin distinct from `apps/chat`'s (different hostname and/or port) — the MCP Apps double-iframe architecture and `@mcp-ui/client`'s own runtime self-test both assume genuine cross-origin isolation between the host page and the sandbox proxy. Reusing `apps/chat-api`'s existing same-origin static-serving pattern (as `chat-overlay-sandbox` does, via `/overlay-sandbox`) is explicitly out of scope here — it would not provide the isolation this app exists for.

#### Scenario: App builds and runs independently of chat/chat-api

- **WHEN** `apps/mcp-app-sandbox` is built and started on its own
- **THEN** it serves its one route without requiring `apps/chat` or `apps/chat-api` to be running

---

### Requirement: Single route serves a self-contained sandbox-proxy page

`GET /` (or an equivalent single top-level route) SHALL return one self-contained HTML response — the relay/self-test script inlined in a `<script>` tag, no separate JS bundle or build step — implementing:

- The outer proxy's referrer/origin validation and double-iframe relay (host ↔ proxy ↔ inner untrusted iframe), per the reference `src/sandbox.ts`.
- The self-test that verifies the browser actually enforced `sandbox` isolation on this page (throws if `window.top` is unexpectedly accessible).
- Creation of the inner iframe that ultimately holds the tool-supplied HTML, with its `sandbox` attribute defaulting to the value negotiated by `@mcp-ui/client`'s `AppBridge` (overridden to `allow-scripts` by `apps/chat`'s renderer — see `mcp-app-canvas`).

No query-param-driven per-tool CSP configuration is implemented in v1 (see the CSP requirement below) — unlike the reference implementation's `?csp=` support.

#### Scenario: Route returns a self-contained HTML document

- **WHEN** a validated request hits the sandbox-proxy route
- **THEN** the response body is a complete HTML document with its relay logic inlined, with no additional JS file requests required to render it

---

### Requirement: Server-side Referer validation against an env-configured allowlist

The app SHALL validate the incoming request's `Referer` header against a new env var, `MCP_APP_SANDBOX_ALLOWED_HOST_ORIGINS` (comma-separated origin list), registered in this app's own `EnvironmentVariables` class and validated at boot per `nestjs-best-practices.md`. This is a deliberate strengthening over the reference implementation, which validates `document.referrer` client-side against a hardcoded regex — validating server-side means an operator can configure the allowlist without rebuilding the app, and the *validated* origin (not a client-trusted value) is what gets embedded into the served script for the client-side postMessage-origin checks.

- Missing `Referer` header, or a `Referer` whose origin is not in the allowlist → `403 ForbiddenException`, and the sandbox HTML is not served.
- `MCP_APP_SANDBOX_ALLOWED_HOST_ORIGINS` unset or empty at boot → the app still boots (consistent with the "absence isn't failure" posture used elsewhere in this change), but every request is rejected with `403` until it's configured — there is no insecure default that serves the page to an unvalidated origin.

#### Scenario: Request from an allowed host origin succeeds

- **WHEN** a request's `Referer` header's origin matches an entry in `MCP_APP_SANDBOX_ALLOWED_HOST_ORIGINS`
- **THEN** the response is `200` with the sandbox HTML

#### Scenario: Request from an unlisted origin is rejected

- **WHEN** a request's `Referer` header's origin does not match any configured entry, or the header is absent
- **THEN** the response is `403` and no HTML is returned

---

### Requirement: Fixed, restrictive CSP and no-store caching

The response SHALL carry a `Content-Security-Policy` HTTP header (never a `<meta>` tag — tamper-proof, matching the reference implementation's own stated rationale) built from a fixed, maximally-restrictive policy for v1: `default-src 'self'`, images/fonts/styles limited to `'self' data: blob:`, `frame-src 'none'`, `object-src 'none'`, `base-uri 'none'`. There is no per-tool/per-request `csp` query-param override in v1, unlike the reference implementation's `buildCspHeader`.

**Non-goal / documented follow-up**: a tool UI that needs to load images/fonts/connect to a third-party domain beyond same-origin will not render correctly under this default. Plumbing an operator- or per-toolset-configured CSP domain allowlist through to this endpoint is deferred, not silently unsupported forever.

The response SHALL also carry `Cache-Control: no-store` — the served script embeds the request-validated host origin, so it must never be served from a shared/browser cache across different validated requests.

#### Scenario: Response headers are set correctly

- **WHEN** a validated request receives the `200` sandbox HTML response
- **THEN** the response includes a `Content-Security-Policy` header matching the fixed v1 policy
- **AND** the response includes `Cache-Control: no-store`

---

### Requirement: `apps/chat-api` exposes the sandbox proxy's URL via existing client config

`apps/chat-api`'s `AppConfigService`/`CONFIG_DEFINITIONS`/`ClientConfigResponseDto` pipeline SHALL gain one new client-visible key, `mcpAppSandboxUrl: string | null`, sourced from a new `MCP_APP_SANDBOX_URL` env var (the deployed sandbox-proxy app's base URL) — following the exact same registration pattern already used for `dialCoreExternalUrl` and `customVisualizers`. No new frontend-only env-injection mechanism is introduced.

`apps/chat` reads this the same way `useCustomVisualizers` reads `customVisualizers` — from the resolved `AppConfigContext`, defaulting to `null`/unavailable while loading or if unset.

#### Scenario: mcpAppSandboxUrl reflects the configured env var

- **WHEN** `MCP_APP_SANDBOX_URL` is set to a valid URL
- **THEN** `GET` client-config response includes `mcpAppSandboxUrl` equal to that URL

#### Scenario: mcpAppSandboxUrl is null when unset

- **WHEN** `MCP_APP_SANDBOX_URL` is not set
- **THEN** the client-config response's `mcpAppSandboxUrl` is `null`
