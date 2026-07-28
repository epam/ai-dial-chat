# Testing the Current Auth Implementation

This guide covers the auth behavior that exists today:

- Implemented: BFF OIDC login, callback, encrypted session cookie, `GET /api/v1/auth/me`, global `SessionGuard`, and transparent refresh.
- Not implemented yet: SPA auth integration, `POST /api/v1/auth/logout`, CSRF guard, and multi-provider manual smoke beyond configured local providers.

## 1. Automated Verification

Run all auth-related backend tests:

```bash
npm exec nx run @epam/chat-api:test-ci--src/auth/tests/auth.controller.spec.ts
npm exec nx run @epam/chat-api:test-ci--src/auth/tests/session/session.guard.spec.ts
npm exec nx run @epam/chat-api:test-ci--src/auth/tests/session/session.service.spec.ts
npm exec nx run @epam/chat-api:test-ci--src/auth/tests/keys/keys.service.spec.ts
npm exec nx run @epam/chat-api:test-ci--src/auth/tests/providers/provider-registry.service.spec.ts
npm exec nx run @epam/chat-api:test-ci--src/auth/tests/refresh/refresh.service.spec.ts
npm exec nx run @epam/chat-api:test-ci--src/auth/tests/csrf/csrf.guard.spec.ts
npm exec nx run @epam/chat-api:test-ci--src/auth/tests/utils/callback-url.util.spec.ts
```

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
8. Confirm the session cookie exists. With secure defaults it is either `__Host-chat.sess` or chunked cookies like `__Host-chat.sess.0`, `__Host-chat.sess.1`; all have `HttpOnly`, `Secure`, `SameSite=Lax`, and `Path=/`. With local `AUTH_COOKIE_SECURE=false`, names become `chat.sess` / `chat.sess.0` and do not have `Secure`.
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

## 5. Negative Cases

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

## 6. Current Known Gaps

- The Swagger setup still needs final cookie-auth documentation cleanup.
