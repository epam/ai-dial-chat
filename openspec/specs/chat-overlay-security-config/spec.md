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

### Requirement: Incoming SET_OVERLAY_OPTIONS is validated against the same allowlist

The accepted `hostDomain` SHALL be pinned to the message's `event.origin`: if the payload contains `hostDomain`, it must match `event.origin`, and after a host is stored the app SHALL reject active-conversation requests from any different origin, even if that origin is also allowlisted.

The app SHALL validate an inbound `SET_OVERLAY_OPTIONS` message's `event.origin` against `ALLOWED_IFRAME_ORIGINS` (surfaced to the frontend via `chat-overlay-security-config`'s client-config additions) before accepting it as authoritative for `hostDomain`, per `chat-overlay-protocol`'s origin-validation requirement. This is a defense-in-depth check in addition to (not a replacement for) the server-side CSP `frame-ancestors` restriction — CSP prevents the browser from framing the page at all under a disallowed origin, while this check protects against a origin that manages to deliver a `postMessage` despite not being the actual framing origin (e.g. a misconfigured intermediate frame).

#### Scenario: Origin outside the allowlist is rejected even if CSP were bypassed

- **WHEN** a `SET_OVERLAY_OPTIONS` message arrives with `event.origin` not present in the configured `ALLOWED_IFRAME_ORIGINS` list
- **THEN** the app does not adopt its `hostDomain` and sends no response, regardless of CSP enforcement having already been bypassed by some other means

**Authorization:** No end-user identity is involved in this check — it authorizes an *origin*, configured by the deployment operator, not a user or role.

**Observability:** Rejected-origin attempts SHOULD be logged (origin value, no payload contents) at `warn` level for operational visibility, without exposing them to the host page.
