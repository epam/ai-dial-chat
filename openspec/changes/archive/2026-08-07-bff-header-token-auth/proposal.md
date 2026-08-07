## Why

`apps/chat-api` currently authenticates every request through exactly one path:
`SessionGuard` reads the AEAD-encrypted HttpOnly session cookie via
`SessionService.decryptFromRequest(req)`. No code path reads an `Authorization` header,
so non-browser callers (service integrations, scripts, tools holding a valid OIDC access
token) cannot call the BFF at all — they would have to go through the interactive
cookie-session flow, which doesn't make sense for them. We need a second, header-based
credential path that coexists with the cookie path without disturbing it, built as a
general mechanism so a third credential source can be added later without touching the
guard again.

## What Changes

- Introduce an ordered, DI-injected chain of authentication strategies in the `auth`
  domain (`AuthSource` string enum, `AuthStrategy` interface, `AUTH_STRATEGIES` multi
  provider token), replacing `SessionGuard`'s hardcoded call to
  `SessionService.decryptFromRequest` with iteration over the chain.
- Extract today's cookie-decrypt → transparent-refresh → lazy-bucket-resolution behavior
  into a `CookieSessionStrategy` with no behavior change.
- Add a `HeaderTokenStrategy` that authenticates from a bearer token in the
  `Authorization` header: local OIDC verification via `jose` (`createRemoteJWKSet`
  against the matching provider's `jwks_uri`, `iss`/`aud`/`exp`/`nbf` checks), per-request
  bucket resolution via `BucketService.getUserBucket(token)` cached by a hash of the
  token, no refresh, no `Set-Cookie`.
- Header wins over cookie when both are present. An invalid/expired/untrusted header
  token is a `401` with a dedicated machine-readable error code — never a silent fallback
  to the cookie.
- `CsrfGuard` skips both the `Origin`/`Referer` check and the `X-CSRF-Token` check for
  header-authenticated requests; cookie-authenticated requests keep today's behavior
  unchanged.
- `OptionalSessionGuard` reuses the same strategy chain in no-throw mode instead of
  duplicating extraction logic.
- `GET /api/v1/auth/me` and `POST /api/v1/auth/logout` get defined behavior under header
  auth (no bogus `X-CSRF-Token` issued; `isAdmin` computed from verified claims).
- New `AUTH_*` environment variables gate the feature behind an explicit flag that is
  **off by default** (widens the trust boundary and bypasses CSRF), plus issuer/audience
  allowlisting, JWKS cache TTL, clock tolerance, and bucket cache TTL. When the flag is
  off, any `Authorization` header is ignored entirely.
- OpenAPI gains `addBearerAuth` alongside the existing `addCookieAuth`; affected
  operations are annotated with both schemes; `chat-api-client` is regenerated.
- **BREAKING**: none for existing callers — the cookie flow and SPA behavior are
  unchanged; this is additive.

## Capabilities

### New Capabilities

- `bff-header-token-auth`: the pluggable authentication-source chain, the header bearer
  strategy, precedence and no-fallback rules, CSRF exemption for header-authenticated
  requests, the token verification model, and per-request bucket resolution/caching for
  header-authenticated callers.

### Modified Capabilities

- `auth-provider-env-config`: adds the new `AUTH_*` environment variables that enable and
  configure header-token authentication (feature flag, issuer/audience allowlist, JWKS
  cache TTL, clock tolerance, bucket cache TTL) and their boot-time validation rules.

## Impact

- Code: `apps/chat-api/src/auth/**` (new strategy abstraction, `CookieSessionStrategy`,
  `HeaderTokenStrategy`, `SessionGuard`, `OptionalSessionGuard`, `CsrfGuard`,
  `AuthModule`, `express.d.ts`, `auth.controller.ts`), `apps/chat-api/src/config/environment.config.ts`,
  `apps/chat-api/src/openapi/openapi.config.ts`, `apps/chat-api/README.md`, env templates.
- Generated client: `libs/chat-api-client/src/generated/**` (regenerated, not hand-edited).
- Docs: `docs/auth/auth-bff-encrypted-cookie.md`, `docs/auth/testing-current-auth-implementation.md`,
  `docs/auth/auth-diagrams/**` (`.mmd` + regenerated `.svg`).
- No changes to `apps/chat` (SPA) or the `spa-auth-session` capability.
- No new dependencies expected — reuses `jose` and `openid-client`, already installed;
  `@nestjs/passport` is explicitly not introduced (see design.md for the rationale).
