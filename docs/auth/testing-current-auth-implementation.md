# Testing the Current Auth Implementation

This guide covers the auth behavior that exists today:

- Implemented: BFF OIDC login, callback, encrypted session cookie, `GET /api/v1/auth/me`, `POST /api/v1/auth/logout`, global `SessionGuard`, global `CsrfGuard` on mutating requests, transparent refresh, and an optional header bearer-token authentication path (§7).
- Not implemented yet: SPA auth integration and multi-provider manual smoke beyond configured local providers.

## 1. Automated Verification

Run all auth-related backend tests:

```bash
npm exec nx test chat-api -- src/auth
```

That includes the cookie-session path (`strategies/tests/cookie-session.strategy.spec.ts`,
`session/tests/session.guard.spec.ts`, `session/tests/optional-session.guard.spec.ts`), the
header bearer-token path (`strategies/tests/header-token.strategy.spec.ts`), CSRF exemption
(`csrf/csrf.guard.spec.ts`), and the integration tests in `auth.controller.spec.ts`.

Run the whole API test target when you want the broader regression check:

```bash
npm exec nx run @epam/chat-api:test
```

Run lint and build before handing off a backend auth change:

```bash
npm exec nx run @epam/chat-api:lint
npm exec nx run @epam/chat-api:build
```

The frontend auth integration is currently still specified under `openspec/changes/auth-frontend-integration/` and is not wired into `apps/chat` yet. For frontend-only smoke, verify that the app still builds and existing tests pass:

```bash
npm exec nx run @epam/chat:test
npm exec nx run @epam/chat:lint
npm exec nx run @epam/chat:build
```

## 2. Local Runtime Setup

Start both the API and the SPA dev server in separate terminals:

```bash
# Terminal 1 — API (port 5000)
npm exec nx run @epam/chat-api:serve

# Terminal 2 — SPA dev server (port 4207, proxies /api → localhost:5000)
npm exec nx run @epam/chat:serve
```

Create or update `apps/chat-api/.env.local` (or the workspace-root `.env.local`) with:

```bash
PORT=5000
API_PREFIX=api
CORS_ORIGIN=http://localhost:4207

AUTH_SESSION_SECRET=<64-character-hex-secret>
AUTH_CALLBACK_BASE_URL=http://localhost:4207
AUTH_POST_LOGOUT_REDIRECT_URI=http://localhost:4207
AUTH_KEYCLOAK_CLIENT_ID=your-client-id
AUTH_KEYCLOAK_SECRET=<client-secret>
AUTH_KEYCLOAK_HOST=your-idp.example.com/realms/your-realm
AUTH_KEYCLOAK_ADMIN_ROLE_NAMES=admin
```

> **Callback URL vs. OIDC callback base**
> `AUTH_CALLBACK_BASE_URL` is used to build the OIDC `redirect_uri` registered in the provider.
> The final app landing page is controlled by `callbackUrl` on `/api/v1/auth/login/*`.
> In local dev, `CORS_ORIGIN=http://localhost:4207` is also the default app return origin when `callbackUrl` is omitted.

The provider must register this redirect URI in its client configuration:

```text
http://localhost:4207/api/v1/auth/callback/keycloak
```

If the provider id is not `keycloak`, replace the final path segment with the configured `id`.

## 3. Browser Smoke Test

Use a normal browser session and DevTools. All steps go through the **SPA origin** (`localhost:4207`) — the Vite proxy forwards API calls to the backend automatically.

1. Open `http://localhost:4207/api/v1/auth/providers`.
2. Confirm the response is a JSON array with the configured provider, for example `[{ "id": "keycloak", "label": "Keycloak" }]`.
3. Open `http://localhost:4207/api/v1/auth/login/keycloak?callbackUrl=http%3A%2F%2Flocalhost%3A4207%2F`.
4. Confirm the browser is redirected to the IdP.
5. Complete login at the IdP.
6. Confirm the callback redirects back to `http://localhost:4207/` (the SPA).
7. In DevTools → Application → Cookies, inspect cookies for `localhost`.
8. Confirm the session cookie exists. With secure defaults it is either `__Host-chat.sess` or chunked cookies like `__Host-chat.sess.0`, `__Host-chat.sess.1`; all have `HttpOnly`, `Secure`, resolved `SameSite`, and `Path=/`. Normal app auth uses `SameSite=Lax`; secure overlay embedding uses `SameSite=None; Secure`. With local `AUTH_COOKIE_SECURE=false`, names become `chat.sess` / `chat.sess.0` and do not have `Secure`.
9. Confirm the tx cookie (`__Host-chat.tx`, or `chat.tx` when `AUTH_COOKIE_SECURE=false`) is cleared after callback.
10. In the browser console, run `document.cookie` and confirm it does not expose tokens.
11. Open `http://localhost:4207/api/v1/auth/me`.
12. Confirm the response is a user profile containing `sub`, `providerId`, and `claims`, with no `access_token` or `refresh_token` fields.

> **Local HTTP smoke:** for `http://localhost` testing, set `AUTH_COOKIE_SECURE=false` in `apps/chat-api/.env.local`. Production-like HTTPS testing should keep the secure defaults.

## 4. Protected Endpoint Smoke

The global `SessionGuard` protects non-public API routes.

In a fresh browser profile or after deleting `__Host-chat.sess` / `chat.sess` and any numbered chunks, open:

```text
http://localhost:4207/api/themes
```

Expected result: `401 Unauthorized`.

After completing the login flow, open the same URL again:

```text
http://localhost:4207/api/themes
```

Expected auth result: the request passes the auth guard. The final HTTP status may still be `200`, `404`, `502`, or `503` depending on `THEMES_CONFIG_URL` and the external themes service, but it should no longer be `401`.

## 5. Testing CSRF-Protected Mutation Endpoints Externally

The global `CsrfGuard` (`apps/chat-api/src/auth/csrf/csrf.guard.ts`) protects every mutating
request (`POST`/`PATCH`/`PUT`/`DELETE`) on a non-`@Public()` route. It rejects the request
with `403 Forbidden` (`{ "code": "CSRF_INVALID", ... }` when the token check fails) unless
**both** of these hold:

1. The `Origin` header (or, if absent, `Referer`'s origin) matches `CORS_ORIGIN`.
2. The `X-CSRF-Token` request header exactly matches the CSRF secret bound to the caller's
   session.

Calling a mutation endpoint straight from Postman/curl with only the session cookie — as in
[issue #7728](https://github.com/epam/ai-dial-chat/issues/7728) — hits this guard and returns
`403 Origin check failed` or `403 CSRF_INVALID` before the request ever reaches the handler.
This is intended behavior, not a bug: the guard is what stops a third-party site from forging
a mutating request using a victim's browser session. To exercise a mutation endpoint (e.g.
`PATCH /api/v1/user-config/toolsets`) from an external HTTP client, obtain both a valid
session and a matching CSRF token first:

1. Complete the login flow (Section 3, steps 1–6) so the session cookie is set.
2. Fetch the current CSRF token from any authenticated response header — the simplest source
   is `GET /api/v1/auth/me`, which always sets `X-CSRF-Token` on the response
   (`apps/chat-api/src/auth/auth.controller.ts`, `getCurrentUser`). Using curl with a cookie
   jar:

   ```bash
   curl -i -c cookies.txt -b cookies.txt http://localhost:4207/api/v1/auth/me
   # read the X-CSRF-Token response header
   ```

3. Send the mutation with the same cookie jar, the captured token in `X-CSRF-Token`, and an
   `Origin` header matching `CORS_ORIGIN`:

   ```bash
   curl -i -b cookies.txt \
     -H "Content-Type: application/json" \
     -H "X-CSRF-Token: <token from step 2>" \
     -H "Origin: http://localhost:4207" \
     -X PATCH http://localhost:4207/api/v1/user-config/toolsets \
     -d '{"id":"toolset-abc","isInstalled":true}'
   ```

   Expected: `204` for a valid body, `400` for a body that fails DTO validation (e.g. missing
   `id`, non-boolean `isInstalled`) — never `403`, once the cookie/token/origin are all
   correct.

The token rotates on some responses (`X-CSRF-Token` may reappear with a new value); if a
mutation unexpectedly 403s with `CSRF_INVALID` partway through a longer manual session,
re-fetch `GET /api/v1/auth/me` and use its latest token.

**In the browser instead of curl:** the session cookie is `HttpOnly`, so it cannot be read
from `document.cookie` — but it is sent automatically. Open DevTools on the SPA origin
(`http://localhost:4207`) after logging in, find the `X-CSRF-Token` response header on any
recent `Network` request (or from step 2 above), and issue the request from the **Console**
tab so the browser attaches the session cookie and same-page `Origin`/`Referer` automatically:

```js
fetch('/api/v1/user-config/toolsets', {
  method: 'PATCH',
  headers: {
    'Content-Type': 'application/json',
    'X-CSRF-Token': '<token from a Network tab response header>',
  },
  body: JSON.stringify({ id: 'toolset-abc', isInstalled: true }),
})
  .then((r) => r.status)
  .then(console.log);
```

## 6. Negative Cases

Check these directly in the browser or with an HTTP client:

```text
GET /api/v1/auth/login/unknown
```

Expected: `404`.

```text
GET /api/v1/auth/login/%2e%2e
```

Expected: `400`.

```text
GET /api/v1/auth/me
```

Expected without the session cookie/chunks: `401`.

Tamper with the session cookie value in DevTools, then call:

```text
GET /api/v1/auth/me
```

Expected: `401`.

To verify callback hardening, replay a callback URL with an issuer mismatch:

```text
GET /api/v1/auth/callback/keycloak?code=anything&state=<real-state>&iss=https%3A%2F%2Fevil.example.com
```

Expected: `400` with `Issuer mismatch`. Use the real provider id and a real in-flight transaction cookie when checking this manually.

## 7. Header Bearer-Token Authentication (Optional Extension)

This path is off by default (`AUTH_HEADER_TOKEN_ENABLED=false`). To smoke test it locally:

1. Set in `apps/chat-api/.env.local`:

   ```bash
   AUTH_HEADER_TOKEN_ENABLED=true
   AUTH_HEADER_TOKEN_ALLOWED_ISSUERS=https://your-idp.example.com/realms/your-realm
   ```

   (use the exact `issuer` value the configured provider derives — see
   `apps/chat-api/README.md` "Auth provider environment variables").

2. Obtain a real access token from the same provider (e.g. via a password/client-credentials
   grant against your IdP, or by extracting `at` from a decrypted session during local
   testing) and call a protected endpoint directly with it:

   ```bash
   curl -i http://localhost:5000/api/v1/auth/me \
     -H "Authorization: Bearer <access_token>"
   ```

   Expected: `200` with the user profile and **no** `X-CSRF-Token` response header.

3. Confirm precedence: repeat the call with both a valid session cookie (from Section 3) and
   the `Authorization` header set — the response should reflect the header token's identity,
   not the cookie's.

4. Confirm no silent fallback: repeat with an expired or tampered bearer token, still with a
   valid session cookie present. Expected: `401` with a body containing
   `"code": "AUTH_HEADER_TOKEN_EXPIRED"` or `"code": "AUTH_HEADER_TOKEN_INVALID"` — the cookie
   must never be consulted.

5. Confirm CSRF exemption: a mutating request authenticated via the header (e.g.
   `POST /api/v1/auth/logout` or, once header auth is enabled for a mutating business
   endpoint) succeeds with **no** `Origin`, `Referer`, or `X-CSRF-Token` header:

   ```bash
   curl -i -X POST http://localhost:5000/api/v1/auth/logout \
     -H "Authorization: Bearer <access_token>"
   ```

   Expected: `200`, no `Set-Cookie` header.

6. Confirm the feature stays off unless explicitly enabled: with
   `AUTH_HEADER_TOKEN_ENABLED=false` (or unset), the same `Authorization` header is ignored
   entirely — a request with only a valid cookie behaves identically to before this feature
   existed, and a request with only the header (no cookie) gets `401`.

## 8. Current Known Gaps

- The Swagger setup still needs final cookie-auth documentation cleanup.
