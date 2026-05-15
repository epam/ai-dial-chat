# Tasks: auth-bff-encrypted-cookie

Implementation is split into five thin vertical slices. Each slice is independently testable and shippable. Work through slices in order.

---

## Slice 1 — Single provider (Keycloak), happy-path login + session + `/auth/me`

### Dependencies

- [x] Install runtime dependencies
  - Add to `apps/chat-api/package.json`:
    - `openid-client: "~5.7.0"` (pin to v5 — v6 has a different functional API and does not match this design)
    - `jose: "^5"`
    - `cookie-parser: "^1"`
  - Add to `apps/chat-api/package.json` devDependencies: `@types/cookie-parser: "^1"`
  - Run `npm install` from workspace root

### Environment config

- [x] Extend `apps/chat-api/src/config/environment.config.ts`
  - Add `AUTH_SESSION_SECRET: string` (`@IsString()`, `@IsNotEmpty()`, `@Matches(/^[0-9a-f]{64}$/i)` — 32 bytes as hex)
  - Add `AUTH_SESSION_PREV_SECRET?: string` (`@IsOptional()`, same hex pattern)
  - Add `AUTH_SESSION_COOKIE_NAME: string` (`@IsOptional()`, default `__Host-chat.sess`)
  - Add `AUTH_TRANSACTION_COOKIE_NAME: string` (`@IsOptional()`, default `__Host-chat.tx`)
  - Add `AUTH_COOKIE_SECURE: boolean` (`@IsOptional()`, default `true`; `false` only for local HTTP smoke testing)
  - Add `AUTH_CALLBACK_BASE_URL: string` (`@IsUrl({ require_tld: false })`, `@IsNotEmpty()`)
  - Add `AUTH_PROVIDERS: string` (`@IsString()`, `@IsNotEmpty()` — raw JSON, parsed in `ProviderRegistryService`)

### Shared types

- [x] Create `libs/chat-shared/src/models/auth.ts`
  - Export `UserProfile { sub: string; providerId: string; claims: Record<string, unknown> }`

### Auth module scaffold

> `auth.module.ts` and `auth.controller.ts` live at the domain root; implementation files are grouped by concern under `session/`, `providers/`, `keys/`, `refresh/`, `csrf/`, `cookies/`, and `utils/`. Tests live under `auth/tests/`, mirroring the source concern folders.

- [x] Create `apps/chat-api/src/auth/providers/provider.types.ts`
  - Export `ProviderConfig` class with `class-validator` decorators on each field (id, issuer, clientId, clientSecret, scope, audience?, rolesClaim?, adminRoles?, postLogoutRedirectUri) so that `AUTH_PROVIDERS` JSON can be structurally validated, not just JSON-parsed
  - `id` MUST match `/^[a-z0-9][a-z0-9-]*$/` (allowlist — anti-injection in URL path segment)

- [x] Create `apps/chat-api/src/auth/session/session.types.ts`
  - Export `SessionPayload` (includes `csrf: string` field — random per-session token used by the double-submit CSRF guard in Slice 5; populated at login/refresh) and `SessionUser` interfaces

- [x] Create `apps/chat-api/src/auth/session/express.d.ts`
  - TypeScript module augmentation: `declare module 'express-serve-static-core' { interface Request { user?: SessionUser } }`
  - Without this the controller / guard will not type-check when accessing `request.user`

- [x] Create `apps/chat-api/src/auth/keys/keys.service.ts`
  - Implement `KeysService` reading `AUTH_SESSION_SECRET` + `AUTH_SESSION_PREV_SECRET`
  - Validate key length (32 bytes from hex) in `onModuleInit`; throw on invalid

- [x] Create `apps/chat-api/src/auth/session/session.service.ts`
  - Implement `SessionService.encrypt(payload): Promise<string>` using `jose` `CompactEncrypt`, `alg: dir`, `enc: A256GCM`
  - Implement `SessionService.decrypt(token): Promise<SessionPayload>` — try active key, fallback to previous key
  - Throw `UnauthorizedException` on decryption failure
  - Implement `SessionService.decryptFromRequest(req): Promise<SessionPayload>` — reads cookie, delegates to `decrypt` (shared by the local guard in Slice 1 and the global guard in Slice 2)

- [x] Create `apps/chat-api/src/auth/session/session.guard.ts` **scaffold only** for Slice 1
  - Implement `CanActivate` minimal: read cookie → `SessionService.decryptFromRequest` → attach `SessionUser` to `request.user`
  - Throw `UnauthorizedException` on missing/invalid cookie
  - Used **locally** via `@UseGuards(SessionGuard)` on `GET /api/v1/auth/me` only (no `APP_GUARD` yet — that comes in Slice 2 together with refresh logic)

- [x] Create `apps/chat-api/src/auth/providers/provider-registry.service.ts`
  - Parse `AUTH_PROVIDERS` JSON in `onModuleInit`
  - Validate each entry against `ProviderConfig` using `plainToInstance` + `validateSync` — throw on missing/invalid fields (not just on malformed JSON)
  - Call `Issuer.discover(issuer)` for each provider; store `Client` instances
  - Implement `getProvider(id)` (throws `NotFoundException`) and `listProviders()`

- [x] Create `apps/chat-api/src/auth/auth.controller.ts`
  - Use `@Controller({ path: 'auth', version: '1' })` so routes resolve to `/api/v1/auth/*` (mandatory per `apps/chat-api/AGENTS.md` §2)
  - Implement `GET /api/v1/auth/providers` → `listProviders()`
  - Implement `GET /api/v1/auth/login/:providerId` → generate PKCE params, build `tx` cookie (`__Host-chat.tx`, `Path=/`, AEAD-encrypted), redirect to IdP
  - Implement `GET /api/v1/auth/callback/:providerId` → exchange code, validate state, set session cookie (`__Host-chat.sess`), delete `tx` cookie, redirect to `/`
  - Implement `GET /api/v1/auth/me` → return `UserProfile` from `request.user`; protect with `@UseGuards(SessionGuard)` (local)
  - Annotate all endpoints with `@ApiOperation`, `@ApiResponse`, `@Throttle`
  - Mark login/callback/providers with `@Public()` (no-op until Slice 2 wires `APP_GUARD`, but keeps the decorator surface stable)
  - Validate `:providerId` via DTO + `@Matches(/^[a-z0-9][a-z0-9-]*$/)` to prevent URL-path injection and align with anti-traversal allowlist convention

- [x] Create `@Public()` decorator at `apps/chat-api/src/common/decorators/public.decorator.ts`
  - Use `SetMetadata('isPublic', true)`

- [x] Create `apps/chat-api/src/auth/auth.module.ts`
  - Declare all auth providers and controllers
  - Provide `SessionGuard` so it can be `@UseGuards()`-applied locally
  - Do NOT register `SessionGuard` as `APP_GUARD` yet (added in Slice 2)

- [x] Register `AuthModule` in `apps/chat-api/src/app/app.module.ts`

- [x] Update `apps/chat-api/src/main.ts`
  - Add `app.use(cookieParser())`
  - Add `app.enableVersioning({ type: VersioningType.URI })` — currently MISSING in the codebase; required by `apps/chat-api/AGENTS.md` §2 and a prerequisite for `/api/v1/auth/*` routes

### Tests — Slice 1

- [x] Create `apps/chat-api/src/auth/tests/keys/keys.service.spec.ts`
  - Test: valid 64-char hex key is accepted
  - Test: invalid key length throws on module init
  - Test: previous key is optional

- [x] Create `apps/chat-api/src/auth/tests/session/session.service.spec.ts`
  - Test: `encrypt` → `decrypt` round-trip returns original payload
  - Test: tampered ciphertext throws `UnauthorizedException`
  - Test: payload encrypted with previous key decrypts successfully
  - Test: payload encrypted with unknown key throws `UnauthorizedException`

- [x] Create `apps/chat-api/src/auth/tests/providers/provider-registry.service.spec.ts`
  - Mock `Issuer.discover` to avoid network calls
  - Test: known provider id returns a `Client`
  - Test: unknown provider id throws `NotFoundException`
  - Test: malformed `AUTH_PROVIDERS` JSON throws on init
  - Test: `AUTH_PROVIDERS` with a structurally invalid entry (e.g. missing `clientSecret` or `issuer`) throws on init via `validateSync` — not on first `Issuer.discover` call
  - Test: provider id that violates the allowlist regex throws on init

- [x] Create `apps/chat-api/src/auth/tests/auth.controller.spec.ts` (integration with supertest)
  - Test: `GET /api/v1/auth/providers` returns provider list
  - Test: `GET /api/v1/auth/login/keycloak` redirects to IdP URL and sets `__Host-chat.tx` cookie with `Path=/`, `HttpOnly`, `Secure`, `SameSite=Lax`
  - Test: `GET /api/v1/auth/login/unknown` returns 404
  - Test: `GET /api/v1/auth/login/%2e%2e` (path traversal attempt) returns 400 (DTO `@Matches` rejection)
  - Test: `GET /api/v1/auth/callback/keycloak` with valid code + state sets `__Host-chat.sess` and redirects to `/`
  - Test: `GET /api/v1/auth/callback/keycloak` with mismatched state returns 400
  - Test: `GET /api/v1/auth/me` with valid session cookie returns `UserProfile`
  - Test: `GET /api/v1/auth/me` without session cookie returns 401
  - Test: `GET /api/v1/auth/me` with tampered cookie returns 401

### Follow-up — Application callback URL

This follow-up supersedes the initial Slice 1 callback behaviour that always redirected to `/` on the callback request origin.

- [x] Add `apps/chat-api/src/auth/dto/login-query.dto.ts`
  - Replace the relative-only `returnTo` query with optional `callbackUrl`
  - Accept both absolute `http(s)` URLs and relative app paths at the DTO boundary; reject obviously invalid scalar values early
  - Keep the property name `callbackUrl` in Swagger/API docs to match the BFF login contract

- [x] Add `apps/chat-api/src/auth/utils/callback-url.util.ts`
  - Export a resolver that receives the raw `callbackUrl`, `CORS_ORIGIN`, and `AUTH_CALLBACK_BASE_URL`
  - Resolve relative paths against the configured application origin (`CORS_ORIGIN` when it is a concrete URL)
  - Accept absolute URLs only when their origin is in the allow-list derived from `CORS_ORIGIN` plus `AUTH_CALLBACK_BASE_URL`
  - Reject protocol-relative URLs (`//example.com`), non-HTTP schemes, URLs with username/password credentials, malformed URLs, and off-origin URLs
  - Return a fully qualified safe URL for redirects

- [x] Add `apps/chat-api/src/auth/tests/utils/callback-url.util.spec.ts`
  - Test: missing `callbackUrl` resolves to the app root (`CORS_ORIGIN` origin when configured)
  - Test: relative `/conversation?x=1` resolves to the app origin
  - Test: absolute `http://localhost:4207/conversation` is accepted when `CORS_ORIGIN=http://localhost:4207`
  - Test: absolute API-origin callback is accepted only when it matches the allow-list
  - Test: `https://evil.example.com`, `javascript:alert(1)`, `//evil.example.com`, and URLs with credentials are rejected

- [x] Update `apps/chat-api/src/auth/auth.controller.ts`
  - In `login()`, resolve and validate `query.callbackUrl` before creating the IdP authorization URL
  - Store only the resolved safe `callbackUrl` inside the encrypted `tx` cookie
  - In `callback()`, read `callbackUrl` from the decrypted transaction payload and redirect to that exact validated URL after setting `__Host-chat.sess`
  - Remove `returnTo` handling from new code paths; do not emit or document `returnTo`

- [x] Update `apps/chat-api/src/auth/tests/auth.controller.spec.ts`
  - Test: login with `?callbackUrl=http%3A%2F%2Flocalhost%3A4207%2Fconversation` returns 302 to IdP and later callback redirects to `http://localhost:4207/conversation`
  - Test: login with relative `?callbackUrl=%2Fconversation` later redirects to `http://localhost:4207/conversation`
  - Test: login without `callbackUrl` later redirects to the configured app root
  - Test: unsafe callback URL returns 400 and does not set `__Host-chat.tx`

- [x] Verify the follow-up: `npm exec nx run @epam/chat-api:test`, `npm exec nx run @epam/chat-api:lint`, and `npm exec nx run @epam/chat-api:build`

### Verification

- [x] Run `npm exec nx run @epam/chat-api:test`
- [x] Run `npm exec nx run @epam/chat-api:lint`
- [x] Run `npm exec nx run @epam/chat-api:build` (Slice 1 changes `main.ts` bootstrap — versioning + cookie-parser — so a build check is warranted)

### Incidental fixes uncovered by Slice 1 manual smoke

- [x] Fix `ServeStaticModule.exclude` pattern in `apps/chat-api/src/app/app.module.ts`
  - Pre-existing bug: `exclude: ['/api*']` is invalid under `path-to-regexp` v8 (pulled in by Express 5). Every request that triggers a route-excluded check (including the auth callback's redirect to `/`) crashed with `PathError [TypeError]: Missing parameter name at index 5: /api*`.
  - Replaced with named-wildcard syntax: `exclude: ['/api{/*splat}']`.
  - Latent until Slice 1 because the SPA static-serve path was rarely exercised before auth introduced the `/api/v1/auth/callback → /` redirect.

### Manual smoke

- [ ] Manual smoke against a local Keycloak (Docker), full checklist:
  1. Happy path: `GET /api/v1/auth/login/keycloak?callbackUrl=http%3A%2F%2Flocalhost%3A4207%2F` → IdP login → callback with Keycloak extras (`iss`, `session_state`) succeeds with 302 back to the callback URL (regression guard for the DTO `forbidNonWhitelisted` fix).
  2. Cookie attributes in DevTools: `__Host-chat.sess` has `HttpOnly` + `Secure` + `SameSite=Lax` + `Path=/`; `__Host-chat.tx` is deleted on callback.
  3. `document.cookie` in browser console does NOT contain any token.
  4. `GET /api/v1/auth/me` returns the user profile (no tokens in the body).
  5. Error branch: `?error=access_denied&error_description=...` → 400 with `error_description` surfaced in the response body.
  6. RFC 9207 issuer mismatch: `?iss=https://evil.example.com` → 400 "Issuer mismatch".
  7. Robustness: missing `code` → 400; no session cookie → 401; tampered cookie → 401; unknown `:providerId` → 404; path-traversal `:providerId` → 400.

---

## Slice 2 — Session guard (global) + transparent access-token refresh

### Session guard

- [x] Extend `apps/chat-api/src/auth/session/session.guard.ts` (scaffolded in Slice 1)
  - Honour `isPublic` metadata — skip cookie check
  - If `at_exp < now + 60` call `RefreshService.refresh`
  - Set refreshed cookie on response if refresh occurred
  - Keep existing behaviour (decrypt → attach `SessionUser` → throw `UnauthorizedException` on failure)

- [x] Register `SessionGuard` as `APP_GUARD` in `apps/chat-api/src/auth/auth.module.ts`
- [x] Remove the local `@UseGuards(SessionGuard)` on `GET /api/v1/auth/me` (now redundant under the global guard)

### Refresh service

- [x] Create `apps/chat-api/src/auth/refresh/refresh.service.ts`
  - Implement `refresh(payload: SessionPayload): Promise<SessionPayload>`
  - Per-pod `Map<sid, Promise>` mutex to prevent concurrent refresh races
  - Call `client.refresh(rt)` from openid-client
  - On `invalid_grant`: throw `UnauthorizedException`
  - On success: return new `SessionPayload` with updated `at`, `at_exp`, and `rt`/`rt_exp` if rotated

### Tests — Slice 2

- [x] Create `apps/chat-api/src/auth/tests/session/session.guard.spec.ts`
  - Test: missing cookie → 401
  - Test: tampered cookie → 401
  - Test: valid cookie with non-expired `at` → passes through, `request.user` set
  - Test: valid cookie with near-expired `at` → calls `RefreshService.refresh`, sets new cookie
  - Test: public route → no cookie required

- [x] Create `apps/chat-api/src/auth/tests/refresh/refresh.service.spec.ts`
  - Mock `openid-client` `client.refresh`
  - Test: successful refresh returns new `SessionPayload`
  - Test: `invalid_grant` throws `UnauthorizedException`
  - Test: concurrent calls for same `sid` coalesce to a single upstream request

- [x] Add integration tests to `auth.controller.spec.ts`
  - Test: protected route with valid session returns 200
  - Test: protected route without session returns 401
  - Test: protected route with near-expired `at` triggers refresh and returns new cookie

### Incidental fixes uncovered by Slice 2 (`@Public()` hotfix)

- [x] Add `@Public()` to `apps/chat-api/src/themes/theme.controller.ts` (class-level)
  - The global `APP_GUARD` introduced in Slice 2 blocked `GET /api/themes` and `GET /api/themes/icon` with 401. Themes are fetched by the SPA before authentication and must remain public.
- [x] Add `@Public()` to `apps/chat-api/src/health/health.controller.ts` (class-level)
  - Same root cause: health probes from load balancers / Kubernetes must never require a session.
- [x] Add `APP_GUARD`-aware tests to `apps/chat-api/src/themes/tests/theme.controller.spec.ts`
  - Test: `GET /themes` accessible without session (`@Public`)
  - Test: `GET /themes/icon` accessible without session (`@Public`)
- [x] Create `apps/chat-api/src/health/health.controller.spec.ts`
  - Test: `GET /health` returns 200 with `status: ok`
  - Test: `GET /health` accessible without session (`@Public`)

### Verification

- [x] Run `npm exec nx run @epam/chat-api:test`
- [x] Run `npm exec nx run @epam/chat-api:lint`
- [x] Manual smoke: access `/api/v1/themes` without cookie → 200; `GET /api/v1/auth/me` without cookie → 401

---

## Slice 3 — Logout (local + federated)

### Controller update

- [x] Add `POST /api/v1/auth/logout` to `apps/chat-api/src/auth/auth.controller.ts`
  - Decrypt session cookie to get `providerId`
  - Set cookie `Max-Age=0` to delete it
  - Best-effort call to provider revocation endpoint
  - Redirect to `end_session_endpoint` if provider supports it; otherwise redirect to `/`
  - Mark with `@Public()` so guard doesn't block an expired session from being able to log out

### Tests — Slice 3

- [x] Add logout tests to `auth.controller.spec.ts`
  - Test: `POST /api/v1/auth/logout` clears session cookie (`Max-Age=0`)
  - Test: `POST /api/v1/auth/logout` redirects to `end_session_endpoint` when provider supports it
  - Test: `POST /api/v1/auth/logout` with no session cookie still responds 302 (graceful)

### Verification

- [x] Run `npm exec nx run @epam/chat-api:test`
- [ ] Manual smoke: log in, log out, verify cookie cleared, verify redirect to IdP logout

---

## Slice 4 — Second provider (Auth0)

### Provider registry validation

- [ ] Add Auth0 provider config to local `.env.local` for development
- [ ] Verify `ProviderRegistryService` discovers Auth0 OIDC metadata without code changes
- [ ] Verify `SessionPayload.providerId` correctly routes refresh and logout to Auth0

### Tests — Slice 4

- [x] Add provider-registry integration test with a mocked Auth0 issuer
  - Test: provider with `audience` claim is passed in token request
  - Test: provider with custom `rolesClaim` extracts roles from correct JWT field
  - Test: two providers registered simultaneously — requests route independently

### Verification

- [x] Run `npm exec nx run @epam/chat-api:test`
- [ ] Manual smoke: complete Auth0 login flow end-to-end

---

## Slice 5 — CSRF hardening, key rotation, CSP audit

### CSRF guard

- [x] Create `apps/chat-api/src/auth/csrf/csrf.guard.ts`
  - Double-submit CSRF token pattern
  - Validate `Origin`/`Referer` against the configured same-origin application URL for state-mutating requests
  - Read `X-CSRF-Token` header; verify it matches the `csrf` field in the decrypted `SessionPayload` (field defined in Slice 1)
  - Apply to all state-mutating endpoints (`POST`, `PUT`, `PATCH`, `DELETE`) except `/api/v1/auth/login`, `/api/v1/auth/callback`, `/api/v1/auth/logout`
  - Expose CSRF token to SPA via a response header on `GET /api/v1/auth/me`

### Key rotation support

- [x] Update `SessionService.decrypt` to try both active and previous key (already required in Slice 1, verify fully covered)
- [x] Document key rotation procedure in `docs/auth/auth-bff-encrypted-cookie.md` (update "Open Decisions" section 9)

### Cookie size handling

- [x] Add session cookie chunking after encrypting session
  - If JWE > 3800 bytes: split it into numbered cookies (`<session-cookie-name>.0`, `<session-cookie-name>.1`, ...)
  - Update `SessionService.decryptFromRequest` to reassemble numbered chunks before decrypting
  - Update `AuthController.logout` and refreshed-cookie writes to clear stale base/chunk cookies

### Security headers audit

- [x] Review `main.ts` `helmet` CSP directives
  - Tighten `scriptSrc` to `'self'` only (remove `'unsafe-inline'`)
  - Verify no inline scripts are used in the frontend before applying
- [x] Add `X-Frame-Options: DENY` (already set by helmet default; verify not overridden)

### Already shipped in Slice 1 (scope shift — record only, no work)

- [x] **RFC 9207 issuer check on callback** — pulled forward from this slice to Slice 1 when the callback DTO was extended to accept `iss`/`session_state`. The same handler block that validates `state` also enforces `iss === providerConfig.issuer` when `iss` is present. See `apps/chat-api/src/auth/auth.controller.ts` (`callback` method) and the test `returns 400 on issuer mismatch (RFC 9207)` in `auth.controller.spec.ts`.

### Tests — Slice 5

- [x] Create `apps/chat-api/src/auth/tests/csrf/csrf.guard.spec.ts`
  - Test: missing `X-CSRF-Token` on POST → 403
  - Test: mismatched CSRF token → 403
  - Test: correct CSRF token → passes
  - Test: GET requests are not checked

- [x] Add key-rotation tests to `session.service.spec.ts`
  - Test: rotating active key (old key → previous, new key → active): tokens encrypted with old key still decrypt

### Frontend: CSRF token wiring

- [x] Add CSRF token to `UserContext` in `apps/chat/src/context/UserContext.tsx`
  - Extract `X-CSRF-Token` response header from `GET /api/v1/auth/me`
  - Include `X-CSRF-Token` header in all non-GET API calls via the `post`/`put`/`del` helpers in `apps/chat/src/server-api/base.ts`

### Verification

- [x] Run `npm exec nx run @epam/chat-api:test`
- [x] Run `npm exec nx run @epam/chat:test`
- [x] Run `npm exec nx run @epam/chat-api:lint`
- [x] Run `npm exec nx run @epam/chat:lint`
- [x] Run `npm exec nx affected --target=lint --base=origin/development`

---

## Final cross-slice tasks

- [x] Update Swagger setup in `apps/chat-api/src/main.ts`
  - Replace `.addBearerAuth()` with `.addCookieAuth('session')`
  - Add `@ApiCookieAuth('session')` to all protected endpoints

- [x] Update `docs/auth/auth-bff-encrypted-cookie.md`
  - Mark "Open Decisions" (section 9) with resolution for each decision taken
  - Update status from `Proposal` to `Implemented`
  - Replace the `NestJS Module Layout (Proposed)` block in §6 with the grouped layout actually shipped (see `apps/chat-api/AGENTS.md` §1 and the rewritten `design.md` "Module Structure")

- [x] Run full test suite and lint: `npm run test` + `npm exec nx affected --target=lint --base=origin/development`
