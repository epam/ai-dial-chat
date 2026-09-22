## Context

Auth is a stateless BFF with encrypted cookies. `SessionService.decrypt` is also used for transaction cookies and best-effort logout; it must remain cryptographic decoding, not implicit authorization. `CookieSessionStrategy` owns request authorization and `RefreshService` owns rotation. Follow `apps/chat-api/AGENTS.md` for implementation conventions.

## Goals / Non-Goals

Enforce a rolling, configurable application session lifetime independently of requested scopes. Preserve provider expiry when known, handle rotation, and reject legacy sessions. No separate absolute login limit, new storage, UI, header-auth changes, or mandatory password prompts.

## Decisions

- Introduce version 2 payloads with required `session_exp` and optional `rt_exp`. Keep `iat` as the current cookie issue time. V1 lacks a trustworthy application deadline and requires a new login.
- Add `AUTH_SESSION_MAX_AGE_SECONDS`, default 2592000 seconds, validated as an integer from 1 through 2147483647. Compute `session_exp = now + maxAge` at login and after successful token refresh. Configuration changes apply at those points.
- A shared app-owned expiration utility validates schema/deadlines and returns the remaining cookie lifetime. With a refresh token the effective deadline is `min(session_exp, rt_exp)` if known, otherwise `session_exp`; without one it is `min(session_exp, at_exp)`. Equality with the current timestamp is expired. Validate finite safe integer timestamps and reject absent/malformed session deadlines.
- Required cookie authentication checks before refresh or bucket calls and again after asynchronous work. Locally expired/invalid cookies clear the base cookie and chunks. Upstream refresh failures keep the existing cookie behavior so a losing pod cannot erase a winning pod’s cookie before the frontend recovery probe. Optional authentication returns no user without mutations or refresh, and rejects expired access tokens too.
- Refresh validates before exchanging tokens and after completion against the existing `session_exp`, then renews it. Required authentication triggers refresh within 60 seconds of access-token or effective session expiry, including when the access token is still fresh. Optional reads and bucket-only rewrites do not renew it. `SessionRefreshResult` carries an explicit `refreshed` flag so absorbed races (including coalesced calls and lazy bucket resolution) cannot overwrite a winning cookie or extend the losing session. A rotated refresh token without expiry metadata clears the previous token's deadline. If no replacement token or expiry metadata is supplied, preserve the previous deadline.
- Read numeric `refresh_expires_in` only for Keycloak. A positive integer gives a deadline from the token exchange start time (conservative against network delay); zero means no advertised bound. Missing/unusable metadata is unknown. Do not decode refresh tokens or assume other providers share this extension. Source: [Keycloak TokenManager](https://github.com/keycloak/keycloak/blob/main/services/src/main/java/org/keycloak/protocol/oidc/TokenManager.java), `AccessTokenResponseBuilder.build`.
- Preserve the ten-minute transaction window, including callbacks using a pre-upgrade transaction cookie. Normal session authorization requires v2. Raw decrypt remains available for best-effort logout of legacy/expired sessions.
- Access-token expiry keeps the existing `expires_at` handling. Missing refresh tokens skip the proactive refresh window and remain usable until actual access-token expiration.

Server expiration is checked independently of browser cookie expiry, as in [NextAuth’s JWT decoder](https://github.com/nextauthjs/next-auth/blob/next-auth%404.24.14/packages/next-auth/src/jwt/index.ts). `offline_access` is not a lifetime contract ([OIDC section 11](https://openid.net/specs/openid-connect-core-1_0.html#OfflineAccess)).

## Risks / Trade-offs

- V2 migration requires login again → document rollout. The 30-day rolling default preserves the legacy NextAuth policy; operators can configure the renewal lifetime.
- Provider deadlines can be unknown or revoked early → the current application deadline still applies; provider validates refresh tokens during exchange. Immediate revocation remains outside this stateless design.
- Mixed old/new replicas have inconsistent enforcement → deploy the auth tier together; do not claim migration is transparent.
- Expiration during token exchange must not issue a renewed cookie → recheck after asynchronous work with the current clock.
- SSO may transparently log the user back in → document that local session expiration does not require password/MFA entry.

## Migration Plan

Set the desired lifetime, deploy auth replicas together, and require new login for v1 sessions. No server data migration. Rollback restores the previous implementation and its expiration limitations; coordinate cookie invalidation if reverting.

## Default Policy

The implementation uses a 30-day rolling default, matching [NextAuth v4 session defaults](https://next-auth.js.org/configuration/options#session) and legacy Chat’s `session: { strategy: 'jwt' }` configuration. [NextAuth renews on its session handler](https://github.com/nextauthjs/next-auth/blob/next-auth%404.24.14/packages/next-auth/src/core/routes/session.ts); this BFF renews after a successful token exchange to avoid extra cookie writes on every request. There is no absolute limit from original login, and no background renewal. A fixed eight-hour cap was rejected because it changes product policy. The expiry of OAuth tokens remains separate.
