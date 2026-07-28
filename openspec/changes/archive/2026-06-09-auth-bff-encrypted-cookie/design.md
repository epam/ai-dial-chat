# Design: auth-bff-encrypted-cookie

## Overview

The `AuthModule` turns `apps/chat-api` into a confidential OIDC client. It performs the Authorization Code + PKCE flow on behalf of the browser, encrypts the resulting tokens into a JWE `HttpOnly` cookie, and enforces session validity on every protected route. The React SPA never reads or writes tokens directly.

---

## Module Structure

The auth domain keeps its public NestJS entrypoints at `auth/` root and groups internal
implementation by concern. Tests live under `auth/tests/`, mirroring the source concern folders.

```
apps/chat-api/src/auth/
├── auth.module.ts                      # Wires controllers + services; promotes SessionGuard to APP_GUARD in Slice 2
├── auth.controller.ts                  # /api/v1/auth/* endpoints
├── cookies/
│   └── cookie-options.ts               # Cookie names, chunking, read/write helpers
├── csrf/
│   └── csrf.guard.ts                   # Slice 5: double-submit CSRF guard (reads SessionPayload.csrf)
├── dto/
│   ├── provider-id-param.dto.ts        # :providerId with @Matches allowlist
│   └── auth-callback.query.dto.ts      # code, state from IdP callback
├── keys/
│   └── keys.service.ts                 # Active + previous keys (hex from env), validated on OnModuleInit
├── providers/
│   ├── provider-registry.service.ts    # AUTH_PROVIDERS parse + structural validate + Issuer.discover
│   └── provider.types.ts               # ProviderConfig (class with class-validator decorators)
├── refresh/
│   └── refresh.service.ts              # Slice 2: server-side token refresh + per-pod sid-keyed mutex
├── session/
│   ├── express.d.ts                    # Request.user augmentation for express-serve-static-core
│   ├── session.guard.ts                # Slice 1: local @UseGuards on /auth/me. Slice 2: APP_GUARD + refresh
│   ├── session.service.ts              # JWE encrypt/decrypt (jose) + decryptFromRequest()
│   └── session.types.ts                # SessionPayload, SessionUser
├── tests/
│   ├── auth.controller.spec.ts         # Supertest integration
│   ├── csrf/csrf.guard.spec.ts
│   ├── keys/keys.service.spec.ts
│   ├── providers/provider-registry.service.spec.ts
│   ├── refresh/refresh.service.spec.ts
│   ├── session/session.guard.spec.ts
│   ├── session/session.service.spec.ts
│   └── utils/callback-url.util.spec.ts
└── utils/
    └── callback-url.util.ts            # Validates and normalizes callbackUrl
```

The reusable `@Public()` decorator lives at `apps/chat-api/src/common/decorators/public.decorator.ts` per `AGENTS.md` §1 (cross-cutting concerns go to `common/`, not into a specific domain).

### Integration with existing AppModule

- `AuthModule` is imported in `app.module.ts`.
- `SessionGuard` is registered as `APP_GUARD` (global) starting from Slice 2. It is skipped for routes decorated with `@Public()`.
- In Slice 1 (no global guard yet) `SessionGuard` is applied locally via `@UseGuards(SessionGuard)` to `GET /api/v1/auth/me` so the slice can ship an end-to-end happy path.
- New environment variables are added to `EnvironmentVariables` in `config/environment.config.ts`.
- `main.ts` gets `cookie-parser` middleware, `app.enableVersioning({ type: VersioningType.URI })`, and a Swagger `addBearerAuth` removal (replaced with cookie session docs).
- The `AuthController` uses `@Controller({ path: 'auth', version: '1' })` so routes resolve to `/api/v1/auth/*` — mandatory per `apps/chat-api/AGENTS.md` §2 for business endpoints.

---

## Environment Variables

Added to `apps/chat-api/src/config/environment.config.ts`:

| Variable                       | Type                 | Required | Description                                                                                                                                                                                                                                                                                                                                                    |
| ------------------------------ | -------------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `AUTH_SESSION_SECRET`          | string (32-byte hex) | Yes      | Active JWE encryption key                                                                                                                                                                                                                                                                                                                                      |
| `AUTH_SESSION_PREV_SECRET`     | string (32-byte hex) | No       | Previous key for rotation grace period                                                                                                                                                                                                                                                                                                                         |
| `AUTH_SESSION_COOKIE_NAME`     | string               | No       | Default: `__Host-chat.sess`                                                                                                                                                                                                                                                                                                                                    |
| `AUTH_TRANSACTION_COOKIE_NAME` | string               | No       | Default: `__Host-chat.tx`                                                                                                                                                                                                                                                                                                                                      |
| `AUTH_COOKIE_SECURE`           | boolean              | No       | Default: `true`; set to `false` only for local HTTP smoke testing. When disabled, runtime cookie names drop the `__Host-` prefix because that prefix requires `Secure`.                                                                                                                                                                                        |
| `AUTH_CALLBACK_BASE_URL`       | URL                  | Yes      | Base URL used to build the OIDC `redirect_uri`, e.g. `https://api.example.com` or `http://localhost:5000`. This is where the IdP sends the authorization response; it does **not** decide where the browser lands after the BFF creates the session. The post-auth landing page is controlled by the validated `callbackUrl` query parameter on `/auth/login`. |
| `AUTH_PROVIDERS`               | JSON string          | Yes      | Array of `ProviderConfig` objects (see below)                                                                                                                                                                                                                                                                                                                  |

`AUTH_PROVIDERS` JSON schema (per entry):

```ts
interface ProviderConfig {
  id: string; // e.g. "keycloak"
  issuer: string; // OIDC discovery URL root
  clientId: string;
  clientSecret: string;
  scope: string; // e.g. "openid email profile"
  audience?: string;
  rolesClaim?: string; // JWT claim path for roles, default "roles"
  adminRoles?: string[];
  postLogoutRedirectUri: string;
}
```

---

## Data Types

### `SessionPayload` (cookie plaintext, in `apps/chat-api/src/auth/session/session.types.ts`)

```ts
interface SessionPayload {
  v: 1;
  sid: string; // random UUID, changes on every login
  providerId: string;
  sub: string;
  at: string; // access_token (opaque or JWT)
  rt: string; // refresh_token
  at_exp: number; // Unix seconds
  rt_exp: number; // Unix seconds
  iat: number; // issued-at (Unix seconds)
  csrf: string; // random per-session token used by the double-submit CSRF guard (Slice 5)
  claims: Record<string, unknown>; // roles, email, etc.
}
```

The `csrf` field is generated alongside `sid` at login and rotated on every refresh (so a stolen header value cannot survive a refresh). It is sealed inside the JWE and therefore unreadable by JavaScript; the SPA only ever sees the value through the `X-CSRF-Token` response header on `GET /api/v1/auth/me`.

### `SessionUser` (attached to `request.user` after guard decryption)

```ts
interface SessionUser {
  sid: string;
  sub: string;
  providerId: string;
  claims: Record<string, unknown>;
  at: string; // forwarded to upstream DIAL Core
}
```

---

## API Endpoints

All endpoints live under `/api/v1/auth/*` — URI-versioned per `apps/chat-api/AGENTS.md` §2 (business domain).

### Public endpoints (decorated with `@Public()`)

#### `GET /api/v1/auth/providers`

Returns the list of configured provider IDs for the SPA login-picker UI.

**Response 200:**

```json
[{ "id": "keycloak", "label": "Keycloak" }]
```

No sensitive data is exposed (no clientSecret, no issuer URL).

---

#### `GET /api/v1/auth/login/:providerId`

Starts the OIDC flow. Generates `state`, `nonce`, `code_verifier` (PKCE), stores them in a transient `tx` cookie, and redirects the browser to the IdP authorization endpoint.

**Path params:** `providerId` — must match a registered provider id.

**Query params:**

| Param         | Required | Validation                                                                                                                                                                                                                                                                                                                                                                                                      | Description                                                                                                                                                      |
| ------------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `callbackUrl` | No       | Must resolve to an allowed application URL. Relative paths are resolved against the configured application origin; absolute URLs must use `http:` or `https:` and match the application-origin allow-list derived from `CORS_ORIGIN` plus the origin of `AUTH_CALLBACK_BASE_URL`. Protocol-relative URLs (`//host/path`), non-HTTP schemes, URLs with credentials, and off-origin URLs are rejected with `400`. | Final browser landing URL after a successful BFF callback. Preserves the correct app origin/page even when the OIDC callback itself is served by the API origin. |

If `callbackUrl` is omitted, the BFF defaults to the application root derived from `CORS_ORIGIN` when it is a concrete URL, otherwise `/` on the current callback origin.

**Transient `tx` cookie:**

- Name: `__Host-chat.tx` by default, or `chat.tx` when `AUTH_COOKIE_SECURE=false`
- Attributes: `HttpOnly`, `Secure` by default, `SameSite=Lax`, `Path=/`, `Max-Age=600`
- Payload (JWE-encrypted same as session): `{ state, nonce, codeVerifier, providerId, callbackUrl }`

> The `__Host-` prefix mandates `Path=/` and `Secure`, and disallows `Domain`. Narrowing the path
> to `/api/v1/auth/callback` is therefore not possible while keeping the prefix. The cookie is
> AEAD-encrypted (JWE) and short-lived (10 min), and is deleted unconditionally on callback,
> so a broader path is acceptable. If a narrower path is required, the cookie name MUST drop
> to `__Secure-chat.tx`.

**Response:** `302 Redirect` to IdP authorization URL.

**Errors:** `400` if `callbackUrl` is unsafe or malformed; `404` if `providerId` is unknown.

---

#### `GET /api/v1/auth/callback/:providerId`

Handles the IdP redirect after user authentication.

**Query params (`AuthCallbackQueryDto`):**

| Param               | When sent                                              | Validation                                                                        |
| ------------------- | ------------------------------------------------------ | --------------------------------------------------------------------------------- |
| `code`              | Success branch (OIDC standard)                         | `@IsOptional()` at DTO level — required in controller on the success branch       |
| `state`             | Success branch (OIDC standard)                         | `@IsOptional()` at DTO level — required and matched against `tx` cookie           |
| `iss`               | Optional; sent by Keycloak 18+, Auth0, Okta (RFC 9207) | `@IsOptional()` — if present, MUST equal `providerConfig.issuer` (mix-up defense) |
| `session_state`     | Keycloak-specific session monitoring                   | `@IsOptional()` — accepted, not used                                              |
| `error`             | Error branch (e.g. user cancels)                       | `@IsOptional()` — short-circuits handler with 400                                 |
| `error_description` | Error branch                                           | `@IsOptional()` — surfaced in the 400 response body                               |

> All real-world IdPs send query parameters beyond the OIDC minimum. The global `ValidationPipe` is configured with `forbidNonWhitelisted: true`, so every legitimately expected parameter MUST be declared on the DTO; otherwise the handler rejects the entire callback with `400 "property X should not exist"` and login becomes impossible.

**Steps:**

1. If `error` is present → log a warning and reject with `BadRequestException(error_description ?? error)`.
2. If `code` or `state` is missing → reject with `BadRequestException('Missing required callback parameters (code, state)')`.
3. Read and decrypt the `tx` cookie; verify `state` matches and `providerId` matches `:providerId`; extract `code_verifier` and the already-validated `callbackUrl`.
4. If `iss` is present and ≠ `providerConfig.issuer` → reject with `BadRequestException('Issuer mismatch')` (RFC 9207 mix-up defense).
5. Exchange `code` for tokens via `openid-client` (PKCE).
6. Validate `id_token`; extract `sub` and claims.
7. Build `SessionPayload`; encrypt to JWE; set session cookie.
8. Delete `tx` cookie (set `Max-Age=0`).
9. Redirect browser to the pre-validated `callbackUrl`.

**Session cookie attributes:**

| Attribute  | Value                                                                                        |
| ---------- | -------------------------------------------------------------------------------------------- |
| Name       | `__Host-chat.sess` (or `AUTH_SESSION_COOKIE_NAME`)                                           |
| `HttpOnly` | `true`                                                                                       |
| `Secure`   | `true` by default; `false` only when `AUTH_COOKIE_SECURE=false` for local HTTP smoke testing |
| `SameSite` | `Lax`                                                                                        |
| `Path`     | `/`                                                                                          |
| `Max-Age`  | `rt_exp - now`                                                                               |

**Errors:**

| Status | Reason                                                                                                                                                         |
| ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `400`  | Missing `tx` cookie / invalid `tx` cookie / state mismatch / provider mismatch / issuer mismatch (RFC 9207) / IdP returned `error` / missing `code` or `state` |
| `502`  | Token exchange against the IdP failed                                                                                                                          |

---

#### `POST /api/v1/auth/logout`

Clears the session cookie and optionally redirects to the IdP `end_session_endpoint`.

**Steps:**

1. Decrypt session cookie to extract `providerId` and IdP hint.
2. Set cookie `Max-Age=0` to delete it.
3. Attempt token revocation via provider revocation endpoint (best-effort; no error on failure).
4. Redirect to `end_session_endpoint` if the provider supports it, otherwise redirect to `/`.

**Response:** `302 Redirect`.

---

### Protected endpoint (requires valid session)

#### `GET /api/v1/auth/me`

Returns the current user's profile — no tokens.

> Slice 1: protected via local `@UseGuards(SessionGuard)` (the same guard is later promoted to `APP_GUARD` in Slice 2). The slice can ship an end-to-end happy path because the guard is wired locally, not globally.

**Response 200:**

```json
{
  "sub": "user-123",
  "providerId": "keycloak",
  "claims": { "email": "u@x.io", "roles": ["admin"] }
}
```

**Errors:** `401` if no valid session (handled by `SessionGuard`).

---

## Session Guard (`apps/chat-api/src/auth/session/session.guard.ts`)

Implements `CanActivate`. Applied **locally** via `@UseGuards(SessionGuard)` on `GET /api/v1/auth/me` in Slice 1, then promoted to global `APP_GUARD` in Slice 2 (when refresh logic is added).

```
1. Check if route is decorated with @Public() → allow through       (Slice 2)
2. Read cookie AUTH_SESSION_COOKIE_NAME from request
3. SessionService.decrypt(cookie) → SessionPayload
   - Try active key first; on failure try previous key (rotation)
   - Throw UnauthorizedException on any decryption failure
4. If at_exp < now + 60s → RefreshService.refresh(payload) → new    (Slice 2)
   - Set new encrypted cookie on response
5. Attach SessionUser to request.user
6. Allow through
```

Steps 1 and 4 are no-ops in Slice 1 (no public-metadata short-circuit, no refresh service yet); they are added when the guard is promoted to `APP_GUARD`.

### TypeScript: `request.user` augmentation

Express's `Request` type does not declare a `user` property. `apps/chat-api/src/auth/session/express.d.ts` augments it so guards and controllers can read/write `request.user: SessionUser` without `as any` casts:

```ts
import type { SessionUser } from './session.types';
declare module 'express-serve-static-core' {
  interface Request {
    user?: SessionUser;
  }
}
```

---

## Session Service (`apps/chat-api/src/auth/session/session.service.ts`)

Wraps `jose` `CompactEncrypt` / `compactDecrypt`.

```ts
class SessionService {
  async encrypt(payload: SessionPayload): Promise<string>; // → JWE compact string
  async decrypt(token: string): Promise<SessionPayload>; // throws on failure/tamper
}
```

- Algorithm: `alg: dir`, `enc: A256GCM` (256-bit AEAD, no separate wrapping step).
- Key material: raw 32-byte Buffer from hex env var (validated at startup).
- Key rotation: `decrypt` tries active key; on failure tries previous key. `encrypt` always uses active key.

---

## Keys Service (`apps/chat-api/src/auth/keys/keys.service.ts`)

```ts
class KeysService {
  get activeKey(): Uint8Array;
  get previousKey(): Uint8Array | undefined;
}
```

Reads `AUTH_SESSION_SECRET` and `AUTH_SESSION_PREV_SECRET` from `ConfigService`. Validates length (exactly 32 bytes after hex decoding) on module init via `OnModuleInit`.

---

## Provider Registry Service (`apps/chat-api/src/auth/providers/provider-registry.service.ts`)

```ts
class ProviderRegistryService implements OnModuleInit {
  async onModuleInit(): Promise<void>; // discovers OIDC metadata for each provider
  getProvider(id: string): { client: Client; config: ProviderConfig }; // throws NotFoundException if unknown
  listProviders(): Array<{ id: string; label: string }>;
}
```

Uses `openid-client`'s `Issuer.discover(issuer)` to fetch `.well-known/openid-configuration` at startup. Stores one `Client` instance per provider (confidential client, client_secret_basic auth).

---

## Refresh Service (`apps/chat-api/src/auth/refresh/refresh.service.ts`)

```ts
class RefreshService {
  async refresh(payload: SessionPayload): Promise<SessionPayload>;
}
```

- Uses `client.refresh(rt)` from `openid-client`.
- Per-pod in-memory mutex keyed by `sid` to prevent concurrent refresh races in multi-tab scenarios.
- On success: builds new `SessionPayload` with new `at`, `at_exp`, and optionally new `rt`/`rt_exp` (if provider rotates).
- On `invalid_grant` (refresh token expired or revoked): throws `UnauthorizedException`.

---

## Cookie Size Handling

Standard cookies are capped at ~4 KB. Entra ID access tokens can exceed this.

**Strategy:** use a single cookie while the encrypted JWE is ≤ 3800 bytes. If the encrypted value exceeds that conservative browser limit, split the value into numbered chunks:

- `__Host-chat.sess` — single-cookie mode.
- `__Host-chat.sess.0`, `__Host-chat.sess.1`, ... — chunked mode.

Each chunk uses the same `HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/`, and `Max-Age` attributes as the single cookie. When local `AUTH_COOKIE_SECURE=false` is enabled, runtime chunk names drop the `__Host-` prefix (`chat.sess.0`, `chat.sess.1`, ...). The BFF reassembles chunks before decrypting, and clears stale base/chunk cookies whenever it writes or clears a session.

---

## Security Properties

| Risk                               | Mitigation in this design                                                                                                                                                                            |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| XSS reads tokens                   | `HttpOnly` + AES-GCM encrypted; tokens never appear in JS                                                                                                                                            |
| CSRF                               | `SameSite=Lax` limits cross-site cookie sending; Slice 5 adds `Origin` validation and a double-submit CSRF token                                                                                     |
| Cookie tampering                   | AES-GCM authenticated tag; `decrypt` fails on any byte change → 401                                                                                                                                  |
| Key compromise                     | Key rotation with previous key fallback; no forced logout during rotation                                                                                                                            |
| Session fixation                   | New `sid` generated on every `callback`                                                                                                                                                              |
| Open redirect                      | `callbackUrl` is validated before it is stored in the encrypted `tx` cookie. Relative paths resolve against the configured application origin; absolute URLs must match the allowed app-origin list. |
| IdP mix-up attack (multi-provider) | RFC 9207 `iss` query param verified against `providerConfig.issuer` on callback (shipped in Slice 1 alongside the callback DTO fix)                                                                  |
| Token in URL                       | Tokens are never returned in URLs; the callback receives only an authorization `code` query parameter                                                                                                |
| Refresh replay                     | RT rotation; `sid` + `jti` in payload; `invalid_grant` → 401                                                                                                                                         |
| Cookie overflow (Entra)            | Size check with numbered cookie chunking                                                                                                                                                             |
| Multi-tab race                     | Per-pod in-memory mutex on `sid` in `RefreshService`                                                                                                                                                 |

**Mandatory transport:** HTTPS everywhere; HSTS already configured in `main.ts` via `helmet`; `Secure` cookie attribute enforced except for explicit local HTTP smoke testing with `AUTH_COOKIE_SECURE=false`.

---

## Frontend Integration (`apps/chat`)

Minimal changes required:

1. **Bootstrap call** — on app mount, `GET /api/v1/auth/me`:
   - 200 → user is authenticated; store `SessionUser` in a `UserContext`.
   - 401 → redirect to `/api/v1/auth/login/:defaultProviderId?callbackUrl=<encoded-current-app-url>` (or show provider picker if `GET /api/v1/auth/providers` returns multiple).

2. **API calls** — no changes needed; cookies are sent automatically by the browser on same-origin requests.

3. **Logout button** — `POST /api/v1/auth/logout` (follow the redirect).

> The Slice 1 backend deliverable does **not** include the SPA bootstrap. Frontend wiring is sequenced into Slice 2 (alongside the global guard so a missing-session redirect path actually exists) and Slice 5 (CSRF header). Slice 1 is smoke-tested via DevTools / curl.

New type in `libs/chat-shared/src/models/auth.ts`:

```ts
export interface UserProfile {
  sub: string;
  providerId: string;
  claims: Record<string, unknown>;
}
```

New context in `apps/chat/src/context/UserContext.tsx` — follows the `ThemeContext` pattern: `createContext<UserProfile | null>(null)`, `useMemo` on value, guard hook `useUser()` throws if outside provider.

---

## Dependencies to Add

```jsonc
// apps/chat-api package.json additions
"openid-client": "~5.7.0",   // pinned to v5 — v6 has a fully different functional API
"jose": "^5",
"cookie-parser": "^1",
"@types/cookie-parser": "^1"  // devDependencies
```

All are stable, widely-used libraries with no transitive security issues. `jose` is the recommended library in the architecture document; `openid-client` v5 is the de-facto OIDC RP library for Node.js and matches this design (`Issuer.discover` + `Client` instances). `openid-client@^6` removes the class-based API entirely; do **not** unpin without rewriting `ProviderRegistryService` and `RefreshService`.

---

## Swagger Documentation Updates

- Add `@ApiCookieAuth('session')` to protected endpoints.
- Document all `/auth/*` endpoints with `@ApiOperation` + `@ApiResponse` for all status codes.
- Add `.addCookieAuth('session')` to the `DocumentBuilder` in `main.ts`.
- Remove `.addBearerAuth()` (no bearer auth in this design).
