# Testing the Current Auth Implementation

This guide covers the auth behavior that exists today:

- Implemented: BFF OIDC login, callback, encrypted session cookie, `GET /api/v1/auth/me`, global `SessionGuard`, and transparent refresh.
- Not implemented yet: SPA auth integration, `POST /api/v1/auth/logout`, CSRF guard, and multi-provider manual smoke beyond configured local providers.

## 1. Automated Verification

Run all auth-related backend tests:

```bash
npm exec nx run @epam/chat-api:test-ci--src/auth/auth.controller.spec.ts
npm exec nx run @epam/chat-api:test-ci--src/auth/session.guard.spec.ts
npm exec nx run @epam/chat-api:test-ci--src/auth/session.service.spec.ts
npm exec nx run @epam/chat-api:test-ci--src/auth/keys.service.spec.ts
npm exec nx run @epam/chat-api:test-ci--src/auth/provider-registry.service.spec.ts
npm exec nx run @epam/chat-api:test-ci--src/auth/refresh.service.spec.ts
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

Create or update `apps/chat-api/.env.local` or the workspace-root `.env.local` with a real OIDC provider that allows this callback URL:

```bash
PORT=3005
API_PREFIX=api
CORS_ORIGIN=http://localhost:4207

AUTH_SESSION_SECRET=00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff
AUTH_CALLBACK_BASE_URL=http://localhost:3005
AUTH_PROVIDERS=[{"id":"keycloak","issuer":"https://your-idp.example.com/realms/your-realm","clientId":"your-client-id","clientSecret":"your-client-secret","scope":"openid email profile offline_access","rolesClaim":"roles","adminRoles":["admin"],"postLogoutRedirectUri":"http://localhost:4207"}]
```

The provider must register this redirect URI:

```text
http://localhost:3005/api/v1/auth/callback/keycloak
```

If the provider id is not `keycloak`, replace the final path segment with the configured `id`.

Start the API through Nx:

```bash
npm exec nx run @epam/chat-api:serve
```

Optional, start the current SPA separately. It does not yet perform auth bootstrap or redirect handling, but it is useful for checking that the API redirect returns to `/`:

```bash
npm exec nx run @epam/chat:serve
```

## 3. Browser Smoke Test

Use a normal browser session and DevTools.

1. Open `http://localhost:3005/api/v1/auth/providers`.
2. Confirm the response is a JSON array with the configured provider, for example `[{ "id": "keycloak", "label": "Keycloak" }]`.
3. Open `http://localhost:3005/api/v1/auth/login/keycloak`.
4. Confirm the browser is redirected to the IdP.
5. Complete login at the IdP.
6. Confirm the callback redirects back to `/`.
7. In DevTools, inspect cookies for `localhost`.
8. Confirm `__Host-chat.sess` exists and has `HttpOnly`, `Secure`, `SameSite=Lax`, and `Path=/`.
9. Confirm `__Host-chat.tx` is cleared after callback.
10. In the browser console, run `document.cookie` and confirm it does not expose tokens.
11. Open `http://localhost:3005/api/v1/auth/me`.
12. Confirm the response is a user profile containing `sub`, `providerId`, and `claims`, with no `access_token` or `refresh_token` fields.

If the browser does not retain `Secure` cookies on your local HTTP URL, repeat the smoke test through an HTTPS local URL or a development proxy that terminates TLS.

## 4. Protected Endpoint Smoke

The global `SessionGuard` protects non-public API routes.

In a fresh browser profile or after deleting `__Host-chat.sess`, open:

```text
http://localhost:3005/api/themes
```

Expected result: `401 Unauthorized`.

After completing the login flow, open the same URL again:

```text
http://localhost:3005/api/themes
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

Expected without `__Host-chat.sess`: `401`.

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

- `POST /api/v1/auth/logout` is not implemented yet; do not treat logout smoke as a required pass for the current backend state.
- The React app does not yet call `/api/v1/auth/me`, send `credentials: 'include'`, show a login page, or render a user menu.
- CSRF protection is planned but not currently enforced.
- The Swagger setup still needs final cookie-auth documentation cleanup.
