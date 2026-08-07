## Context

`SessionGuard` (`apps/chat-api/src/auth/session/session.guard.ts`) is registered as an
`APP_GUARD` and hardcodes a single credential source: it calls
`SessionService.decryptFromRequest(req)`, which reads the chunked, AEAD-encrypted,
HttpOnly session cookie, decrypts it, transparently refreshes the access token when it is
within 60s of expiry (rotating the cookie, keeping the CSRF token stable), lazily resolves
the DIAL Core bucket on first use, and sets `req.user`. `CsrfGuard` runs after it and
requires `req.user.csrf` to match `X-CSRF-Token` on any non-safe method, plus an
`Origin`/`Referer` check. `OptionalSessionGuard` duplicates the decrypt-and-populate logic
in a no-throw variant used on a handful of public routes. There is currently no code path
that reads an `Authorization` header anywhere in `apps/chat-api`.

We need a second credential source — a bearer access token in a request header — that:
takes precedence over the cookie when both are present, never silently falls back to the
cookie on failure, is exempt from CSRF (CSRF exists to protect ambient browser
credentials; a header token is deliberately attached by the caller, so there is no
forged-request risk to mitigate), and is off by default because it widens the trust
boundary from "our SPA in a browser, protected by CSRF" to "anyone holding a valid IdP
access token, unprotected by CSRF."

Constraints from `apps/chat-api/AGENTS.md`: thin controllers, typed HTTP exceptions,
env validated at boot on `EnvironmentVariables`, `Logger` never logs secrets, DTOs use
class-validator, OpenAPI is part of the endpoint contract. `@nestjs/passport` is not
installed; `jose` and `openid-client` are.

## Goals / Non-Goals

**Goals:**
- A general, ordered, DI-injected authentication-strategy chain that both `SessionGuard`
  and `OptionalSessionGuard` consume, so adding a third credential source later means
  registering a new strategy, not editing a guard.
- Zero behavior change to the existing cookie flow (byte-for-byte: refresh timing, cookie
  rotation, CSRF-token stability, lazy bucket resolution, error types).
- A header-token strategy that verifies the token locally against a registered OIDC
  provider's JWKS, resolves the bucket per request with caching, and never mutates cookies.
- CSRF exemption scoped precisely to header-authenticated requests.
- The feature is inert unless explicitly enabled by configuration.

**Non-Goals:**
- Changing the SPA or `spa-auth-session` — cookie flow with `credentials: 'include'` is
  untouched.
- Token issuance, minting, or a token-exchange endpoint on the BFF.
- A server-side session store or new OIDC providers.
- Accepting `DIAL_API_KEY`/`Api-Key` as a caller credential (that stays server→DIAL Core).
- Browser `EventSource`/SSE with header auth (EventSource cannot set headers) — SSE
  consumers keep using the cookie.
- Introspection-based verification (see Decisions) or a full Passport migration.

## Decisions

### 1. Strategy-chain architecture inside `SessionGuard`, not a new top-level guard

Add, under `apps/chat-api/src/auth/`:

- `auth-source.enum.ts` — `export enum AuthSource { Header = 'header', Cookie = 'cookie' }`
  (string enum per repo convention, not a literal union).
- `strategies/auth-strategy.interface.ts`:
  ```ts
  export interface AuthStrategy {
    readonly source: AuthSource;
    supports(req: Request): boolean;
    authenticate(req: Request, res: Response): Promise<SessionUser | null>;
    authenticateOptional?(req: Request): Promise<SessionUser | null>;
  }
  ```
  `authenticate` returns `null` only for "this strategy has nothing to say" (should not
  happen once `supports` gated it) — invalid/expired credentials that this strategy *does*
  claim to own throw immediately (see Decision 3, no fallback).

  `authenticateOptional` was added once implementation reached `OptionalSessionGuard`: that
  guard's existing JSDoc documents it as deliberately **not** performing token refresh or
  bucket resolution (used on public routes like `app-config` that should stay cheap and
  side-effect-free even when a session happens to be present). Reusing
  `CookieSessionStrategy.authenticate` as-is would have silently added a refresh + bucket
  round-trip + `Set-Cookie` to every optional-guard call — a real behavior change the
  original plan didn't account for. `authenticateOptional` is an optional method precisely
  because most strategies don't need it: `CookieSessionStrategy` implements it as a
  decrypt-only, no-side-effect read; `HeaderTokenStrategy` has no refresh concept in the
  first place, so it has nothing extra to opt out of and the guard falls back to its plain
  `authenticate` (with exceptions swallowed).
- `strategies/header-token.strategy.ts` — `AuthStrategy` implementation for
  `AuthSource.Header`.
- `strategies/cookie-session.strategy.ts` — today's `SessionGuard` body, moved verbatim
  behind the interface, for `AuthSource.Cookie`.
- `strategies/auth-strategies.token.ts` — `export const AUTH_STRATEGIES = Symbol('AUTH_STRATEGIES')`.
- `session/express.d.ts` gains `authSource?: AuthSource` on `Request`.

`AuthModule` registers both strategies as ordinary providers, then assembles the ordered
list via a factory provider (vanilla NestJS has no Angular-style `multi: true` provider
aggregation — a factory is the idiomatic equivalent):
```ts
HeaderTokenStrategy,
CookieSessionStrategy,
{
  provide: AUTH_STRATEGIES,
  useFactory: (header: HeaderTokenStrategy, cookie: CookieSessionStrategy) => [header, cookie],
  inject: [HeaderTokenStrategy, CookieSessionStrategy],
},
```
The factory's return-array order is how strategy priority (header before cookie) is
expressed — no separate priority field needed.

`SessionGuard` becomes:
```ts
constructor(@Inject(AUTH_STRATEGIES) private readonly strategies: AuthStrategy[], ...)

async canActivate(context) {
  // ...isPublic check unchanged...
  for (const strategy of this.strategies) {
    if (!strategy.supports(req)) continue;
    const user = await strategy.authenticate(req, res); // throws on invalid creds
    if (user) {
      req.user = user;
      req.authSource = strategy.source;
      return true;
    }
  }
  throw new UnauthorizedException();
}
```
`OptionalSessionGuard` gets the same loop but swallows exceptions from `authenticate` and
returns `true` unconditionally, exactly mirroring today's try/catch-and-continue shape.

**Alternative (a) — `@nestjs/passport` + `passport-http-bearer` + a custom cookie
strategy.** Rejected. Passport's mental model (strategy → `req.user` via
`passport.authenticate`) is a reasonable fit in the abstract, but adopting it here means:
introducing a new runtime dependency and its NestJS adapter package purely to reinvent
what a 15-line interface already gives us; rewriting the cookie flow's refresh-and-rotate
side effects (which need direct `Response` access to set cookies and headers) around
Passport's `done(err, user, info)` callback shape, which is designed for a simpler
authenticate-and-attach model, not "authenticate, then possibly mutate the outgoing
response before continuing"; and losing the ability to thread bucket-resolution errors
through as `ServiceUnavailableException` without fighting Passport's error-normalization.
The plain-interface chain gives the same pluggability with none of that friction and no
new dependency to justify.

**Alternative (b) — branch inside `SessionGuard`** (`if (authHeader) {...} else
{decryptFromRequest...}`). Rejected per the proposal's explicit requirement: it is not
extensible (a third source means editing the guard again), it's harder to unit test in
isolation (both paths coupled in one method), and it invites the exact `if/else` sprawl
the change is meant to avoid.

**Alternative (c) — NestJS middleware that normalizes credentials before guards run.**
Rejected. Middleware runs before route matching and before `Reflector`-based metadata
(`@Public()`) is resolved in the request pipeline the way guards see it, so the
public-route short-circuit would have to be re-implemented in middleware, duplicating
logic that already lives correctly in `SessionGuard`/`CsrfGuard`. It also can't cleanly
express "throw 401 with this specific body" the way a guard can via Nest's exception
filters, and DI-scoped services (e.g. per-request caching) are more awkward to reach from
raw middleware than from an injectable strategy class.

### 2. Header token verification: local JWKS verification via `jose`, not pass-through, not introspection

`HeaderTokenStrategy.authenticate`:
1. Parse `Authorization: Bearer <token>` — reject (see Decision 4) any other scheme, empty
   value, or multiple `Authorization` headers.
2. Decode the token's `iss` claim without verifying (via `jose`'s
   `decodeJwt`) to select a candidate provider.
3. Look up that issuer against `ProviderRegistryService.listProviders()` /
   `getProvider(id)` — reuses the existing discovered-provider set (no separate registry).
   Reject if the issuer is not registered or not on the configured allowlist
   (`AUTH_HEADER_TOKEN_ALLOWED_ISSUERS`, see Decision 5).
4. Verify signature with `jose.createRemoteJWKSet(new URL(provider's jwks_uri))` +
   `jose.jwtVerify(token, jwks, { issuer, audience, clockTolerance })`. One
   `createRemoteJWKSet` instance per provider, memoized for the process lifetime — `jose`'s
   remote JWK set already caches keys internally and de-duplicates concurrent fetches, so
   the memoization here is only about reusing the `JWTVerifyGetKey` function per issuer,
   not re-fetching JWKS per request.
5. On any verification failure (bad signature, expired, wrong audience, unregistered
   issuer, network failure resolving JWKS) throw `UnauthorizedException` with the
   dedicated error code (Decision 4) — never return `null` and never let the chain
   continue to `CookieSessionStrategy`.
6. On success, build `SessionUser` (Decision 6) and return it.

**Alternative — pass-through trust (accept the token, decode without verifying, trust
`iss`/`sub`/claims as asserted).** Rejected: a forwarded/attacker-supplied JWT-shaped
string would be accepted as-is; `isAdmin` and role claims must be trustworthy at the BFF
because `auth.controller.ts` computes `isAdmin` from claims, and downstream UI decisions
key off it before DIAL Core ever sees the token.

**Alternative — OIDC token introspection (`openid_client`'s `Client.introspect`).**
Rejected as the default: introspection is a synchronous network round-trip to the IdP on
every request (or requires its own cache with its own staleness window), adds a hard
runtime dependency on introspection endpoint availability per request, and most of the
nine configured providers already expose a `jwks_uri` through the discovery document
`ProviderRegistryService` already fetches — local verification reuses that. Introspection
remains a reasonable choice for providers issuing opaque (non-JWT) tokens, but is out of
scope: this design assumes JWT access tokens, consistent with what all nine currently
configured provider types issue.

DIAL Core still independently validates the token when the BFF calls it — local
verification here is about trusting `claims`/`isAdmin` inside the BFF, not a substitute
for DIAL Core's own checks.

### 3. Precedence: header wins, no fallback on failure

`HeaderTokenStrategy.supports(req)` returns `true` whenever an `Authorization` header is
present and the feature flag is enabled — `CookieSessionStrategy.supports(req)` returns
`true` whenever a session cookie is present. Because strategies are registered
header-first, `SessionGuard`'s loop tries the header first. If `supports` is true but
`authenticate` throws, the loop does **not** continue to the next strategy — the guard
lets that exception propagate directly (matches the sketch in Decision 1: `authenticate`
throwing is a hard 401, not a `null` continue-signal). This is what "no silent fallback"
means in an ordered-chain shape without needing an extra flag.

### 4. Error codes: extend the existing `CsrfErrorCode`-style pattern with an `AuthErrorCode`

Add `apps/chat-api/src/auth/session/auth-error-code.enum.ts`:
```ts
export enum AuthErrorCode {
  HeaderTokenExpired = 'AUTH_HEADER_TOKEN_EXPIRED',
  HeaderTokenInvalid = 'AUTH_HEADER_TOKEN_INVALID',
  HeaderTokenUntrustedIssuer = 'AUTH_HEADER_TOKEN_UNTRUSTED_ISSUER',
  HeaderMalformed = 'AUTH_HEADER_MALFORMED',
  NoCredentials = 'AUTH_NO_CREDENTIALS',
}
```
`UnauthorizedException` bodies carry `{ code, error: 'Unauthorized', message, statusCode: 401 }`,
mirroring `CsrfGuard`'s `ForbiddenException` body shape. A malformed `Authorization`
header (unknown scheme, empty, duplicated) maps to `HeaderMalformed`/401 — not 400 —
because it is a credential-presentation failure the same guard layer owns, not a DTO
validation failure a controller would raise.

### 5. CSRF exemption keyed off `req.authSource`, decided inside `CsrfGuard`

`CsrfGuard.canActivate` gains, immediately after the existing public-route check:
```ts
if (req.authSource === AuthSource.Header) {
  return true; // no Origin/Referer check, no X-CSRF-Token check
}
```
Security reasoning: CSRF exists to stop a browser from being tricked into replaying
*ambient* credentials (cookies sent automatically by the browser) toward our origin from
another site. A header-authenticated caller must explicitly construct and attach the
`Authorization` header on every request — a third-party page has no mechanism to make a
victim's browser do that involuntarily (unlike cookies, which the browser attaches
automatically without any script needing to run). Non-browser callers (scripts, service
integrations) also have no `Origin`/`Referer` header to check against and no prior
`X-CSRF-Token` handshake, so enforcing the existing check would make every mutating
header-authenticated request fail with `403` unconditionally, not just under attack. The
exemption is scoped to exactly the requests where `SessionGuard` already independently
verified the credential via signature verification (Decision 2) — it is not a blanket
CSRF bypass, since cookie-authenticated requests are untouched by this branch.

**Alternative — keep CSRF enforcement for header-authenticated requests too.** Rejected:
it's not just redundant, it's unsatisfiable for legitimate non-browser callers (no
`Origin`, no prior CSRF handshake), so it would make the feature unusable for exactly the
callers it's meant to serve.

### 6. `SessionUser` fields for header-authenticated principals

Make `sid`, `csrf` optional on `SessionUser` (not synthesized placeholders — a
synthesized `sid`/`csrf` could be mistaken for a real session identifier or a valid CSRF
token by code that doesn't know to check `authSource` first):
```ts
export interface SessionUser {
  sid?: string;   // absent for header-authenticated callers — no session was created
  sub: string;
  providerId: string;
  claims: Record<string, unknown>;
  at: string;     // the verified bearer token itself, reused as-is for downstream DIAL Core calls
  bucket: string;
  csrf?: string;  // absent for header-authenticated callers — CsrfGuard never checks it (Decision 5)
}
```
`rt` (refresh token) was never on `SessionUser` (only on `SessionPayload`), so no change
needed there — header callers simply never populate a payload at all. Every existing
consumer of `req.user` that only reads `sub`/`providerId`/`claims`/`at`/`bucket` keeps
compiling unchanged; consumers that read `sid` or `csrf` must already be guarded to the
cookie path (route-level, since only session-scoped features like logout read `sid`) and
will be updated in the tasks that touch them to check `req.authSource` first where
relevant.

### 7. Bucket resolution: per-request `BucketService.getUserBucket(token)` cached by token hash

There is no cookie to persist a resolved bucket into for header callers, so
`HeaderTokenStrategy` calls `BucketService.getUserBucket(token)` on every request unless a
cache hit exists. Cache via the existing global `CacheModule`/`CACHE_MANAGER` (same
mechanism as `ThemeService`), keyed `auth:bucket:<sha256(token)>` — hashing the token
before using it as a key follows the "never log/store the raw token" principle from
`AGENTS.md`'s security defaults even though a cache key isn't a log line, since cache
backends and their metrics/debug tooling can expose keys. TTL configurable via
`AUTH_HEADER_TOKEN_BUCKET_CACHE_TTL_SECONDS` (see Decision 8), independent of the token's
own `exp` — an entry may still be evicted before token expiry if TTL is shorter; that's
acceptable since a cache miss just means one extra DIAL Core round trip, not a failure.
On DIAL Core unavailability, throw `ServiceUnavailableException` exactly as
`CookieSessionStrategy` does today — same failure semantics for both strategies.

### 8. Configuration: new `AUTH_*` variables, off by default

Added to `EnvironmentVariables` (`apps/chat-api/src/config/environment.config.ts`),
following the existing `@IsOptional`/boolean-`@Transform`/comma-split-`@Transform` style:

| Variable | Type | Default | Purpose |
|---|---|---|---|
| `AUTH_HEADER_TOKEN_ENABLED` | boolean | `false` | Master feature flag. When `false`, `HeaderTokenStrategy.supports()` always returns `false` and the `Authorization` header is never read for auth purposes. |
| `AUTH_HEADER_TOKEN_ALLOWED_ISSUERS` | string[] (comma-split) | unset (= none allowed) | Allowlist of `iss` values accepted, beyond "is a registered provider." Boot fails if `AUTH_HEADER_TOKEN_ENABLED=true` and this is unset — see below. |
| `AUTH_HEADER_TOKEN_CLOCK_TOLERANCE_SECONDS` | number | `30` | Passed to `jose.jwtVerify`'s `clockTolerance`. |
| `AUTH_HEADER_TOKEN_JWKS_CACHE_TTL_SECONDS` | number | `600` | How long a `createRemoteJWKSet` instance is kept before being recreated (bounds key-rotation staleness; the underlying `jose` cache also has its own internal cooldown). |
| `AUTH_HEADER_TOKEN_BUCKET_CACHE_TTL_SECONDS` | number | `60` | TTL for the `auth:bucket:<hash>` cache entries (Decision 7). |

Default-off rationale: enabling header auth moves the BFF's trust boundary from "our SPA,
in a browser, cookie ambient-credential + CSRF-protected" to "anyone presenting a token
signed by a registered provider, unauthenticated by CSRF." That is a meaningful widening
of what an operator is implicitly trusting, so it must be an explicit opt-in per
deployment, not inherited by upgrading `chat-api`. Boot-time validation (matching the
"partial provider configuration fails boot" pattern in `auth-provider-env-config`):
if `AUTH_HEADER_TOKEN_ENABLED=true` and `AUTH_HEADER_TOKEN_ALLOWED_ISSUERS` is empty or
unset, fail application boot with a descriptive error — silently accepting every
registered provider's issuer with no explicit allowlist is exactly the kind of implicit
trust-widening this flag is meant to prevent.

### 9. `/auth/me` and `/auth/logout` under header auth

`GET /api/v1/auth/me` (`auth.controller.ts`): continues to compute `isAdmin` from
`req.user.claims` and the resolved provider's `adminRoles`, unchanged. It currently sets
`X-CSRF-Token` unconditionally; that call is gated on `req.authSource === AuthSource.Cookie`
— a header-authenticated caller receives no `X-CSRF-Token` header at all (there is no
session to protect with one).

`POST /api/v1/auth/logout`: for a header-authenticated caller there is no session
(`sid`), no cookie to clear, and no RP-initiated logout flow tied to an `it` (ID token)
the BFF stored — the BFF never stored anything for this caller. The endpoint responds
successfully as a no-op for header-authenticated callers (clearing a cookie that was
never set is not an error) rather than throwing, so a generic client that always calls
logout on sign-out doesn't need to branch on how it authenticated.

Implementation note: `/auth/logout` is `@Public()` and always was — it hand-rolls its own
cookie read and CSRF-style Origin check rather than going through `SessionGuard`, so
`req.authSource` is never populated on this route regardless of this change. Detecting a
header-authenticated logout call is therefore a direct `Authorization` header presence
check inside the controller, evaluated before the existing manual Origin check (a header
caller has no `Origin` and would otherwise be rejected by that check).

### 10. OpenAPI

`apps/chat-api/src/openapi/openapi.config.ts` gains
`.addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, 'bearer')`
alongside the existing `.addCookieAuth('session')`. Endpoints reachable under both auth
sources get `@ApiSecurity('bearer')` in addition to their existing cookie security
annotation. The pre-existing `"cookie"`-vs-`"session"` naming mismatch between the
generated scheme key and the `/auth/me` reference is left out of scope for this change —
noted in tasks.md as a call-out, not silently fixed as a drive-by, since it is orthogonal
to adding a second scheme and changing it here would make the diff harder to review for
the actual feature.

## Risks / Trade-offs

- **[Trust-boundary widening]** → Mitigated by default-off flag + mandatory issuer
  allowlist at boot (Decision 8) + local signature verification (Decision 2), not
  pass-through trust.
- **[CSRF exemption misapplied to a cookie-authenticated request due to a bug in
  `authSource` resolution]** → `req.authSource` is set exactly once, inside `SessionGuard`,
  from the strategy that actually authenticated the request; `CsrfGuard` reads it, never
  infers it independently. Covered by an explicit test asserting cookie-authenticated
  mutating requests still 403 without `X-CSRF-Token` (tasks.md).
- **[JWKS endpoint unreachable at verification time]** → surfaces as
  `UnauthorizedException` (can't verify signature ⇒ can't trust the token), not
  `ServiceUnavailableException` — from the caller's perspective this is indistinguishable
  from "your token doesn't verify," which is the safe default (fail closed, not open).
- **[Per-request bucket resolution adds latency/DIAL Core load vs. the cookie path's
  cache-in-cookie approach]** → Mitigated by the `CACHE_MANAGER`-backed
  `auth:bucket:<hash>` cache (Decision 7); TTL is configurable per deployment.
  Accepted trade-off since header callers have no cookie to persist state into.
  Rate-limiting question (IP-keyed vs. `sub`-keyed throttling) is called out as a
  non-goal/open question below rather than solved here.
- **[`SessionUser.sid`/`csrf` becoming optional could let an existing call site silently
  read `undefined` where it previously always had a string]** → Mitigated by TypeScript
  strict mode surfacing every such read as a compile error; tasks.md includes an explicit
  slice to grep and fix every `req.user.sid`/`req.user.csrf` read site.

## Migration Plan

No data migration. Deploy-time change is purely additive: existing deployments that don't
set any `AUTH_HEADER_TOKEN_*` variables get `AUTH_HEADER_TOKEN_ENABLED=false` and see zero
behavior change (verified by the task-1 slice keeping all existing auth tests green with
no assertions changed). Rollback is a config flip (`AUTH_HEADER_TOKEN_ENABLED=false`) with
no code rollback required, since the strategy is simply never consulted when disabled.

## Open Questions

- **Rate limiting key for header-authenticated callers**: stay IP-keyed (current
  `@nestjs/throttler` behavior, simplest, but weak for shared-egress service callers) or
  key by `sub`? Proposed default: leave IP-keyed for this change (matches existing
  behavior for all callers) and flag `sub`-keyed throttling as a explicit non-goal/follow-up
  in tasks.md rather than deciding it under this change's scope.
- **`AUTH_HEADER_TOKEN_ALLOWED_ISSUERS` granularity**: this design allowlists by issuer
  only (not per-audience-per-issuer). If a future need arises to accept only specific
  `aud` values per issuer, that's a schema extension, not a redesign — noted here so it
  isn't rediscovered as a surprise later.
