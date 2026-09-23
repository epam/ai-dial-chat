## Why

The OIDC callback invents a refresh-token expiry of 30 days when the requested scope includes `offline_access`, or one hour otherwise (`apps/chat-api/src/auth/auth.controller.ts:456`). The cookie strategy does not enforce that deadline on the server. Documentation incorrectly describes it as the provider's refresh-token lifetime.

## What Changes

- Add a validated, scope-independent `AUTH_SESSION_MAX_AGE_SECONDS` setting with a default of 2592000 seconds (30 days).
- Separate rolling `session_exp` from optional provider-reported `rt_exp`, and enforce the effective deadline for required and optional cookie authentication.
- Respect Keycloak's `refresh_expires_in` contract at login and refresh, preserving unknown expiry for providers without supported metadata.
- Bound cookies by the remaining deadline, handle missing refresh tokens, and renew the session only after successful token exchange.
- **BREAKING**: legacy session cookies require a new login. Existing transaction cookies may complete their original ten-minute login window.
- Update auth documentation, diagrams, environment reference, and regression tests.

## Capabilities

### New Capabilities

- `bff-session-expiration`: configurable rolling session lifetime, token deadlines, server enforcement, and migration.

### Modified Capabilities

None. Provider scope defaults and frontend session recovery remain unchanged.

## Impact

App-owned auth/config code and documentation only; no libraries, dependencies, public DTOs, generated-client changes, new routes, or UI/i18n changes. Follow the existing `SessionService`, `CookieSessionStrategy`, and environment validation patterns. The existing global guard still delegates to the same strategies.

### Non-goals

Absolute lifetime from the original login, shared session storage, immediate remote revocation, mandatory IdP password/MFA prompts, and changing provider scope defaults.

### Alternatives considered

Changing only the constant leaves server enforcement broken. Deriving lifetime solely from the provider cannot work when refresh expiry is unknown. An explicit rolling application lifetime plus optional provider deadlines fixes both cases without introducing session storage. A fixed eight-hour limit would change the legacy NextAuth policy without a product requirement; retain its 30-day rolling default.

### Acceptance criteria

Expired or legacy cookies cannot authorize requests even with a valid access token; successful refresh renews `session_exp` only before the current deadline; failed/absorbed refreshes cannot renew or overwrite a winning cookie; no refresh token means no refresh attempt; Keycloak zero lifetime is not immediate expiry; cookie lifetime matches the effective deadline; regressions cover login, refresh, optional auth, and key rotation.

### Compatibility and rollback

Deploy auth replicas together to avoid mixing old enforcement with new cookies. Users sign in again once. Rollback restores the old implementation and its limitations; clear session cookies or rotate the session encryption secret as part of a coordinated rollback if necessary. No stored server-side data needs migration.
