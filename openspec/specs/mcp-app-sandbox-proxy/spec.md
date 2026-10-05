# mcp-app-sandbox-proxy Specification

## Purpose

Defines `apps/mcp-app-sandbox`, the isolated-origin Nx app that serves the MCP Apps double-iframe sandbox-proxy page `@mcp-ui/client` requires to render untrusted tool-supplied HTML, with server-side Origin/Referer validation, a deliberately permissive CSP that relies on origin isolation plus a `frame-ancestors` lock to the validated host, and no-store caching.

## Requirements

### Requirement: `apps/mcp-app-sandbox` is a new, isolated-origin Nx app

`apps/mcp-app-sandbox` SHALL be a separate NestJS Nx app that serves the MCP Apps double-iframe sandbox-proxy page `@mcp-ui/client` requires.

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
- Creation of the inner iframe that ultimately holds the tool-supplied HTML, with its `sandbox` attribute hardcoded to `"allow-scripts allow-same-origin allow-forms"` by this page's own inline script (`apps/mcp-app-sandbox/src/app/sandbox-page.ts`). A `params.sandbox` string override channel exists over `postMessage` (`ui/notifications/sandbox-resource-ready`), but as of the installed `@mcp-ui/client` version, `AppFrame` never sends that field — see the requirement below for the full finding. There is no per-render override reaching this default from `apps/chat` today (corrects the `mcp-app-canvas` spec's earlier claim that `apps/chat`'s renderer overrides this to `allow-scripts`).

No query-param-driven per-tool CSP configuration is implemented (see the CSP requirement below) — unlike the reference implementation's `?csp=` support.

#### Scenario: Route returns a self-contained HTML document

- **WHEN** a validated request hits the sandbox-proxy route
- **THEN** the response body is a complete HTML document with its relay logic inlined, with no additional JS file requests required to render it

---

### Requirement: Server-side Referer validation against an env-configured allowlist

The app SHALL validate the incoming request's host origin against a new env var, `MCP_APP_SANDBOX_ALLOWED_HOST_ORIGINS` (comma-separated origin list), registered in this app's own `EnvironmentVariables` class and validated at boot per `nestjs-best-practices.md`. `SandboxService.validateRefererOrigin` checks the `Origin` header first: when it is present, it must itself be in the allowlist, and `Referer` is ignored (this closes a bypass where a request supplies an allowlisted `Referer` while its actual `Origin` is not the chat host). Only when `Origin` is absent is the origin of the `Referer` header checked. This is a deliberate strengthening over the reference implementation, which validates `document.referrer` client-side against a hardcoded regex — validating server-side means an operator can configure the allowlist without rebuilding the app, and the *validated* origin (from `Origin` or `Referer`, not a client-trusted value) is what gets embedded into the served script for the client-side postMessage-origin checks and into the CSP's `frame-ancestors`.

- `Origin` present but not in the allowlist, or (with no `Origin`) a missing, unparseable, or unlisted `Referer` → `403 ForbiddenException`, and the sandbox HTML is not served.
- `MCP_APP_SANDBOX_ALLOWED_HOST_ORIGINS` unset or empty at boot → the app still boots (consistent with the "absence isn't failure" posture used elsewhere in this change), but every request is rejected with `403` until it's configured — there is no insecure default that serves the page to an unvalidated origin.

#### Scenario: Request from an allowed host origin succeeds

- **WHEN** a request's `Origin` header, or (when `Origin` is absent) its `Referer` header's origin, matches an entry in `MCP_APP_SANDBOX_ALLOWED_HOST_ORIGINS`
- **THEN** the response is `200` with the sandbox HTML

#### Scenario: Request from an unlisted origin is rejected

- **WHEN** a request's `Origin` header is present but not listed, or `Origin` is absent and the `Referer` header's origin is not listed or the header is absent
- **THEN** the response is `403` and no HTML is returned

#### Scenario: Unlisted Origin wins over an allowlisted Referer

- **WHEN** a request carries an allowlisted `Referer` but an `Origin` header that is not in the allowlist
- **THEN** the response is `403`

---

### Requirement: Fixed, permissive CSP locked to the validated host, and no-store caching

The response SHALL carry a `Content-Security-Policy` HTTP header (never a `<meta>` tag — tamper-proof, matching the reference implementation's own stated rationale) built by `buildSandboxCspHeader(validatedOrigin)` in `apps/mcp-app-sandbox/src/app/csp.ts`. The policy is fixed except for `frame-ancestors`, and is deliberately **permissive**, not restrictive:

```
sandbox allow-scripts allow-same-origin allow-forms allow-popups; default-src * 'unsafe-inline' 'unsafe-eval' data: blob:; object-src 'none'; base-uri 'none'; frame-ancestors <validatedOrigin>;
```

- Permissive directives: `default-src *` (any origin for scripts, styles, images, fonts, connections, and frames — there is no `frame-src` or `script-src` restriction), `'unsafe-inline'` and `'unsafe-eval'` (inline script/style and `eval` are allowed), `data:` and `blob:` sources, and a CSP `sandbox` directive that includes `allow-same-origin` and `allow-popups`.
- Restrictive directives: `object-src 'none'`, `base-uri 'none'`, and `frame-ancestors` set to the single validated host origin, so only that host can embed the page.

The stated reason, from the code comment on `csp.ts`: the sandbox CSP cannot restrict script/resource origins because it is not known what the MCP app will load. Isolation comes instead from the `sandbox` directive together with the distinct deployment origin (`allow-same-origin` grants the sandbox proxy's own isolated origin, not the chat app's, so chat cookies, `localStorage`, `sessionStorage`, IndexedDB, and DOM stay inaccessible) and from the dynamic `frame-ancestors <hostOrigin>` lock. The security trade-off is that untrusted tool HTML can load and execute content from any origin inside that isolated origin.

There is no per-tool/per-request `csp` query-param override, unlike the reference implementation's `buildCspHeader`.

The response SHALL also carry `Cache-Control: no-store` — the served script and the `frame-ancestors` value embed the request-validated host origin, so the response must never be served from a shared/browser cache across different validated requests. The controller also sets `X-Content-Type-Options: nosniff` and `Cross-Origin-Resource-Policy: cross-origin`.

#### Scenario: Response headers are set correctly

- **WHEN** a validated request from host origin `https://chat.example.com` receives the `200` sandbox HTML response
- **THEN** the response includes a `Content-Security-Policy` header equal to the policy above with `frame-ancestors https://chat.example.com;`
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

---

### Requirement: Sandbox permissions are not configurable per-render; `allow-popups` is unsupported end-to-end

Sandbox permissions SHALL NOT be configurable per render, and `allow-popups` SHALL remain unsupported end-to-end until `@mcp-ui/client` exposes the outer iframe's `sandbox` attribute.

**Finding from runtime investigation** (triggered by a real bug report: a mounted app's `window.open(...)` call was silently blocked). Both nested sandboxed iframes in the double-iframe architecture are hardcoded and neither includes `allow-popups`:

1. The **outer** host↔proxy iframe — an isolated-origin iframe pointed at `mcpAppSandboxUrl`, created by `@mcp-ui/client`'s `AppFrame` internals (vendored code under `node_modules`, not this repo's source) — is hardcoded to `sandbox="allow-scripts allow-same-origin allow-forms"`. `AppRenderer`'s public `sandbox` prop only forwards `url` and `csp` into this library's internals; there is no prop, in the installed version, that changes this iframe's `sandbox` attribute.
2. The **inner** untrusted-content iframe — created by this app's own `sandbox-page.ts` script — defaults to the identical string. Its `params.sandbox` override channel (received over `postMessage` as part of `ui/notifications/sandbox-resource-ready`) is real and would let this app's own default be overridden, but `@mcp-ui/client`'s `AppFrame` never populates that field when it calls `sendSandboxResourceReady` (only `{ html, csp }` are sent) — so this channel has no caller in the current integration.

Per the HTML sandboxing spec, a nested browsing context's effective permissions are capped by every sandboxed ancestor. Consequently, adding `allow-popups` to only the inner iframe (item 2, the only lever this repo can edit directly) would **not** be sufficient on its own — the outer vendored iframe (item 1) would still block it. Enabling popups end-to-end would require patching `@mcp-ui/client`'s bundled output (no `patch-package` tooling exists in this repo today) in addition to changing this app's own default, or an upstream change to `@mcp-ui/client` that exposes the outer iframe's `sandbox` attribute as a configurable prop.

The response CSP's own `sandbox` directive (see the CSP requirement) does include `allow-popups`, and `@mcp-ui/client`'s `SandboxConfig` type declares a `permissions` field documented as overriding the iframe `sandbox` attribute. Neither changes the outcome: the installed `@mcp-ui/client` (7.1.1) `AppFrame` implementation still sets the outer iframe's `sandbox` attribute to the hardcoded string and never reads `permissions`, and this app's inner iframe default omits `allow-popups`.

**Status:** documented limitation, not fixed. Popups are blocked end-to-end because both iframe `sandbox` attributes omit `allow-popups`, even though the proxy page's CSP `sandbox` directive includes it.

#### Scenario: a tool app's popup call is blocked

- **WHEN** the mounted app calls `window.open(...)` (e.g. to open an external link in a new tab)
- **THEN** the browser blocks the popup because neither the outer nor the inner sandboxed iframe's `sandbox` attribute includes `allow-popups`, regardless of the `allow-popups` token in the proxy page's CSP `sandbox` directive
- **AND** no prop passed by `apps/chat`'s `McpAppCanvasRenderer` can change this outcome
