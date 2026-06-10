# Proposal: auth-bff-encrypted-cookie

## What

Implement a stateless Backend-for-Frontend (BFF) authentication layer in the NestJS API (`apps/chat-api`) that performs the full OIDC Authorization Code + PKCE flow and stores the resulting tokens inside an AES-GCM encrypted `HttpOnly` cookie. The React SPA (`apps/chat`) never touches `access_token` or `refresh_token`; all token handling happens exclusively server-side.

## Why

The current implementation has no authentication. The two standard client-side alternatives are off the table:

- **Pure SPA OIDC** — exposes tokens to JavaScript; violates IETF BCP 212 recommendations for browser-based apps.
- **Hybrid SPA + JWKS** — same exposure problem; iframe-based silent refresh is broken in modern browsers with third-party cookie restrictions.

The chosen pattern — BFF + encrypted cookie — is the only option that satisfies all four constraints simultaneously:

| Constraint                                                    | Why it matters                                        |
| ------------------------------------------------------------- | ----------------------------------------------------- |
| Tokens must not be readable by JavaScript                     | XSS mitigation; `HttpOnly` + AEAD encryption          |
| Multiple identity providers (Keycloak, Auth0, Okta, Entra ID) | OIDC is provider-neutral; registry pattern covers all |
| No Redis or external session store                            | Full session lives inside the cookie as JWE           |
| IETF BCP 212 compliance                                       | Authorization Code + PKCE, no implicit flow           |

## Goals

1. Implement the NestJS `AuthModule` with OIDC Authorization Code + PKCE login/callback/logout for at least one provider (Keycloak).
2. Encrypt and decrypt sessions as JWE (`alg: dir`, `enc: A256GCM`) using the `jose` library.
3. Protect all `/api/*` routes (except `/auth/*`) with a session guard that transparently refreshes near-expired access tokens.
4. Support a multi-provider registry; the active provider is encoded in the session cookie so refresh and logout always use the correct IdP.
5. Expose `GET /api/v1/auth/me` returning the current user profile (no tokens) for the SPA to consume.

## Non-Goals

- Redis-backed or database-backed session storage.
- Implicit or hybrid OAuth flows.
- Social login providers beyond the OIDC-compliant preset list.
- Frontend UI for the login page (the SPA redirects to the IdP login page; no custom login form is in scope).
- KMS-based key management in v1 (env var secrets are sufficient for the first slice).
- CSRF protection hardening (double-submit token) — deferred to Slice 5 after the core auth flow is stable.

## Proposed Solution

### Architecture summary

```
Browser (SPA)
  │  GET /api/v1/auth/login/:providerId?callbackUrl=<app-url>
  ▼
NestJS BFF (apps/chat-api)
  │  openid-client → redirects to IdP
  ▼
Identity Provider (Keycloak / Auth0 / …)
  │  Authorization Code + PKCE callback
  ▼
NestJS BFF
  │  exchanges code → tokens
  │  encrypts tokens → JWE cookie (__Host-chat.sess)
  │  sets HttpOnly Secure SameSite=Lax cookie
  │  redirects to validated callbackUrl
  ▼
Browser — all subsequent API calls carry the cookie automatically
  │  GET /api/v1/…
  ▼
NestJS BFF session guard
  │  decrypts cookie → validates → attaches principal
  │  refreshes access_token server-side if near-expiry
  ▼
Protected business logic
```

All business endpoints (including `/auth/*`) are URI-versioned per `apps/chat-api/AGENTS.md` §2; `main.ts` enables `VersioningType.URI` and the auth controller declares `@Controller({ path: 'auth', version: '1' })`.

### Cookie design

The session cookie `__Host-chat.sess` is a compact JWE whose plaintext contains:

```json
{
  "v": 1,
  "sid": "<random>",
  "providerId": "keycloak",
  "sub": "user-123",
  "at": "<access_token>",
  "rt": "<refresh_token>",
  "at_exp": 1715600000,
  "rt_exp": 1715686400,
  "iat": 1715596400,
  "csrf": "<random-csrf-token>",
  "claims": { "roles": ["admin"], "email": "u@x.io" }
}
```

Attributes: `HttpOnly`, `Secure` by default, `SameSite=Lax`, `Path=/`, `Max-Age=rt_exp`, name prefix `__Host-`. Local HTTP smoke tests may set `AUTH_COOKIE_SECURE=false`, which also drops the `__Host-` prefix at runtime.

### Incremental implementation slices

Following the `incremental-implementation` approach, work is split into five thin vertical slices:

| Slice | Scope                                                                                                 |
| ----- | ----------------------------------------------------------------------------------------------------- |
| 1     | Single provider (Keycloak), happy-path login + cookie + `/auth/me`                                    |
| 1a    | Application `callbackUrl` support so the BFF returns users to the correct SPA origin/page after login |
| 2     | Session guard on `/api/*` + transparent access-token refresh                                          |
| 3     | Logout (local cookie clear + federated `end_session_endpoint`)                                        |
| 4     | Second provider (Auth0) — validates registry abstraction                                              |
| 5     | CSRF hardening, key rotation with `kid`, CSP security headers audit                                   |

## Success Criteria

- A browser making an API call without a valid session receives `401`.
- After completing login, the browser holds an `HttpOnly` cookie; `document.cookie` does not expose any token.
- Completing login redirects the browser to the validated application `callbackUrl`, not blindly to `/` on the API origin.
- Refreshing the page preserves the session without a new login (verified end-to-end starting from Slice 2 — Slice 1 is backend-only, smoke-tested via DevTools).
- Logging out clears the cookie and optionally redirects the browser to the IdP logout endpoint.
- All new code passes `npm exec nx run @epam/chat-api:test` and `npm exec nx run @epam/chat-api:lint`.

## Impact Assessment

- **Scope**: `apps/chat-api` (new `auth` module); `apps/chat` (minimal — add `/auth/me` fetch to bootstrap context).
- **Shared libs**: `UserProfile` is exported from `libs/chat-shared` in Slice 1.
- **i18n**: no new user-visible strings in this change (login/error pages use IdP-hosted UI in v1).
- **Breaking changes**: none — existing unauthenticated routes remain public until the guard is applied.
