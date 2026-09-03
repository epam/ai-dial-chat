# chat-overlay-security-config Specification

## Purpose

Embedding security for overlay mode: CSP `frame-ancestors`, the overlay-eligibility flag, and validation of incoming overlay options.

## Requirements

### Requirement: CSP frame-ancestors gates embedding, defaulting to deny

`apps/chat-api/src/config/csp.ts` SHALL gain a `buildFrameAncestorsDirective(allowedOverlayOrigins: string[]): string[]` function returning `["'none'"]` when the list is empty, or the list of origins (no `'self'` added implicitly) when non-empty. `apps/chat-api/src/main.ts`'s Helmet configuration SHALL set `contentSecurityPolicy.directives.frameAncestors` from this function, reusing the existing `ALLOWED_IFRAME_ORIGINS` environment variable (`EnvironmentVariables.ALLOWED_IFRAME_ORIGINS`) as the source list — no new env var is introduced for the allowlist itself, preserving backward compatibility with any deployment that already sets it for the existing `frame-src` behavior.

#### Scenario: Empty allowlist denies all embedding

- **WHEN** `ALLOWED_IFRAME_ORIGINS` is unset or empty
- **THEN** the CSP response header includes `frame-ancestors 'none'`

#### Scenario: Configured origins are allowed

- **WHEN** `ALLOWED_IFRAME_ORIGINS=https://partner.example.com`
- **THEN** the CSP response header includes `frame-ancestors https://partner.example.com`

#### Scenario: Existing frame-src behavior is unchanged

- **WHEN** `ALLOWED_IFRAME_ORIGINS` is set
- **THEN** the existing `frame-src` directive (`buildFrameSrcDirective`) continues to include `'self'` plus the configured origins exactly as before this change

### Requirement: X-Frame-Options no longer blocks configured embedding

Helmet's `frameguard` middleware SHALL be disabled (`frameguard: false`) whenever `ALLOWED_IFRAME_ORIGINS` is non-empty, relying solely on CSP `frame-ancestors` (respected by all currently-supported browsers) for framing control. When `ALLOWED_IFRAME_ORIGINS` is empty, `frameguard` SHALL remain enabled with its default (`SAMEORIGIN`) behavior, matching today's default-deny posture.

#### Scenario: X-Frame-Options is absent when embedding is configured

- **WHEN** `ALLOWED_IFRAME_ORIGINS` is set to a non-empty list
- **THEN** the response does NOT include an `X-Frame-Options` header

#### Scenario: X-Frame-Options still protects the default deployment

- **WHEN** `ALLOWED_IFRAME_ORIGINS` is unset
- **THEN** the response includes `X-Frame-Options: SAMEORIGIN`, matching current behavior

### Requirement: A dedicated flag gates overlay-mode eligibility independent of CSP

A new `EnvironmentVariables.OVERLAY_ENABLED` boolean (default `false`) SHALL control whether the app's overlay runtime mode (`chat-overlay-app-mode`) is reachable at all — distinct from the CSP allowlist, so an operator can allow `frame-ancestors` for unrelated reasons without silently turning on overlay mode, and vice versa turn on overlay mode only once at least one origin is allowlisted. `OVERLAY_ENABLED=true` with an empty `ALLOWED_IFRAME_ORIGINS` SHALL have no effect (nothing can embed the app, so overlay mode is unreachable in practice) — this is not treated as a misconfiguration, just a no-op combination.

#### Scenario: Overlay mode is off by default

- **WHEN** `OVERLAY_ENABLED` is unset
- **THEN** `GET /api/v1/client-config` reports the overlay-enabled config key as `false`

#### Scenario: Overlay mode requires both flags to have any effect

- **WHEN** `OVERLAY_ENABLED=true` and `ALLOWED_IFRAME_ORIGINS` is empty
- **THEN** `GET /api/v1/client-config` reports overlay-enabled as `true`, but no origin can successfully frame the app (CSP `frame-ancestors 'none'`), so overlay mode never activates client-side

### Requirement: Env vars are documented with rollback notes

`apps/chat-api/.env.template` SHALL document `OVERLAY_ENABLED` and the overlay-related use of `ALLOWED_IFRAME_ORIGINS` (cross-referencing its existing CSP `frame-src` role) with a one-line rollback note: unsetting `OVERLAY_ENABLED` (or emptying `ALLOWED_IFRAME_ORIGINS`) fully reverts to pre-change CSP/`X-Frame-Options` behavior with no deploy of different code required.

#### Scenario: Template documents both variables together

- **WHEN** `apps/chat-api/.env.template` is inspected
- **THEN** it documents `OVERLAY_ENABLED` adjacent to `ALLOWED_IFRAME_ORIGINS`, noting both the CSP and overlay-eligibility effects of the latter

### Requirement: ALLOWED_IFRAME_ORIGINS accepts a leading-wildcard-label origin pattern

In addition to today's exact-origin entries (`scheme://host[:port]`, no path/query/fragment), `EnvironmentVariables.ALLOWED_IFRAME_ORIGINS` SHALL accept an entry whose host is a single `*.` wildcard label followed by a normal dotted hostname, e.g. `https://*.example.com` or `http://*.example.internal:8080` — mirroring CSP's own host-source wildcard grammar, so the value can be forwarded verbatim into `frame-src`/`frame-ancestors` (per the existing `chat-overlay-security-config` CSP requirements) without server-side rewriting. Exact-origin and wildcard entries MAY be mixed in the same comma-separated list. An entry is rejected, and env validation fails at boot with the existing `Environment validation failed` error, when it contains a bare `*` host, a `*` anywhere other than the leftmost label, more than one `*`, or any path/query/fragment on either form.

#### Scenario: A wildcard subdomain pattern is accepted

- **WHEN** `ALLOWED_IFRAME_ORIGINS=https://*.example.com` is set
- **THEN** the app boots successfully and `EnvironmentVariables.ALLOWED_IFRAME_ORIGINS` is `['https://*.example.com']`

#### Scenario: Exact and wildcard entries can be mixed

- **WHEN** `ALLOWED_IFRAME_ORIGINS=https://quickapps.test,https://*.example.com` is set
- **THEN** the app boots successfully and `EnvironmentVariables.ALLOWED_IFRAME_ORIGINS` is `['https://quickapps.test', 'https://*.example.com']`

#### Scenario: A bare wildcard host is rejected

- **WHEN** `ALLOWED_IFRAME_ORIGINS=https://*` is set
- **THEN** env validation fails at boot with the existing `Environment validation failed` error and the app does not start

#### Scenario: A wildcard outside the leftmost label is rejected

- **WHEN** `ALLOWED_IFRAME_ORIGINS=https://foo.*.example.com` is set
- **THEN** env validation fails at boot and the app does not start

#### Scenario: A wildcard entry with a path is rejected

- **WHEN** `ALLOWED_IFRAME_ORIGINS=https://*.example.com/embed` is set
- **THEN** env validation fails at boot and the app does not start

### Requirement: Incoming SET_OVERLAY_OPTIONS is validated against the same allowlist

The accepted `hostDomain` SHALL be pinned to the message's `event.origin`: if the payload contains `hostDomain`, it must match `event.origin`, and after a host is stored the app SHALL reject active-conversation requests from any different origin, even if that origin is also allowlisted.

The app SHALL validate an inbound `SET_OVERLAY_OPTIONS` message's `event.origin` against `ALLOWED_IFRAME_ORIGINS` (surfaced to the frontend via `chat-overlay-security-config`'s client-config additions) before accepting it as authoritative for `hostDomain`, per `chat-overlay-protocol`'s origin-validation requirement. This is a defense-in-depth check in addition to (not a replacement for) the server-side CSP `frame-ancestors` restriction — CSP prevents the browser from framing the page at all under a disallowed origin, while this check protects against a origin that manages to deliver a `postMessage` despite not being the actual framing origin (e.g. a misconfigured intermediate frame).

The allowlist check SHALL be wildcard-aware: an `ALLOWED_IFRAME_ORIGINS` entry of the form `scheme://*.host[:port]` matches an incoming origin when the origin's scheme matches exactly and the origin's remainder (host, optionally `:port`) ends with `.host[:port]` — the bare `host[:port]` itself (no subdomain label) does not match. A non-wildcard entry continues to require an exact string match against the full origin, unchanged from before this capability's wildcard support.

#### Scenario: Origin outside the allowlist is rejected even if CSP were bypassed

- **WHEN** a `SET_OVERLAY_OPTIONS` message arrives with `event.origin` not present in the configured `ALLOWED_IFRAME_ORIGINS` list
- **THEN** the app does not adopt its `hostDomain` and sends no response, regardless of CSP enforcement having already been bypassed by some other means

#### Scenario: An origin matching a wildcard allowlist entry is accepted

- **GIVEN** `ALLOWED_IFRAME_ORIGINS=https://*.example.com`
- **WHEN** a `SET_OVERLAY_OPTIONS` message arrives with `event.origin` equal to `https://portal.example.com`
- **THEN** the app accepts `https://portal.example.com` as the trusted `hostDomain`

#### Scenario: A nested subdomain still matches a wildcard allowlist entry

- **GIVEN** `ALLOWED_IFRAME_ORIGINS=https://*.example.com`
- **WHEN** a `SET_OVERLAY_OPTIONS` message arrives with `event.origin` equal to `https://a.b.example.com`
- **THEN** the app accepts `https://a.b.example.com` as the trusted `hostDomain`

#### Scenario: The apex domain alone does not match a wildcard allowlist entry

- **GIVEN** `ALLOWED_IFRAME_ORIGINS=https://*.example.com` (and no exact entry for the apex)
- **WHEN** a `SET_OVERLAY_OPTIONS` message arrives with `event.origin` equal to `https://example.com`
- **THEN** the app rejects the message and does not adopt `https://example.com` as `hostDomain`

#### Scenario: A different scheme does not match a wildcard allowlist entry

- **GIVEN** `ALLOWED_IFRAME_ORIGINS=https://*.example.com`
- **WHEN** a `SET_OVERLAY_OPTIONS` message arrives with `event.origin` equal to `http://portal.example.com`
- **THEN** the app rejects the message and does not adopt `http://portal.example.com` as `hostDomain`

**Authorization:** No end-user identity is involved in this check — it authorizes an *origin*, configured by the deployment operator, not a user or role.

**Observability:** Rejected-origin attempts SHOULD be logged (origin value, no payload contents) at `warn` level for operational visibility, without exposing them to the host page.

### Requirement: Permissions-Policy delegates Local Network Access to allowlisted iframe origins

`apps/chat-api/src/config/csp.ts` SHALL export `buildPermissionsPolicyHeader(allowedIframeOrigins: string[]): string`, which returns a `Permissions-Policy` header value delegating the `local-network-access` feature to `'self'` plus every origin in `allowedIframeOrigins`, formatted as `local-network-access=(self <origin> <origin> ...)`. When `allowedIframeOrigins` is empty, the returned value SHALL delegate to `'self'` only (`local-network-access=(self)`).

`apps/chat-api/src/main.ts` SHALL apply this header via a dedicated `app.use` middleware registered immediately after the existing `helmet(...)` middleware, passing the same `allowedIframeOrigins` value already read from `ALLOWED_IFRAME_ORIGINS` and passed into `createHelmetOptions`. This delegation allows the `/apps-editor` embedded schema iframe (see `app-editor-flow` capability, "App editor iframe component" requirement) — and any window it opens, such as an identity-provider login popup — to request the Local Network Access permission needed when the embedded app's or its identity provider's origin resolves to a private/internal IP address.

#### Scenario: Permissions-Policy header lists allowlisted origins

- **WHEN** `ALLOWED_IFRAME_ORIGINS` is `["https://quickapps.example.com"]`
- **THEN** the response includes `Permissions-Policy: local-network-access=(self https://quickapps.example.com)`

#### Scenario: Permissions-Policy header defaults to self when no origins are allowlisted

- **WHEN** `ALLOWED_IFRAME_ORIGINS` is empty
- **THEN** the response includes `Permissions-Policy: local-network-access=(self)`

#### Scenario: Permissions-Policy header lists multiple allowlisted origins

- **WHEN** `ALLOWED_IFRAME_ORIGINS` is `["https://quickapps.example.com", "https://skills.example.com"]`
- **THEN** the response includes `Permissions-Policy: local-network-access=(self https://quickapps.example.com https://skills.example.com)`
