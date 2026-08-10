## ADDED Requirements

### Requirement: Pluggable authentication-strategy chain

The system SHALL authenticate every non-public request through an ordered, DI-injected chain of `AuthStrategy` implementations (`AuthSource.Header` before `AuthSource.Cookie`) rather than a single hardcoded credential source. `SessionGuard` SHALL iterate the chain, use the first strategy whose `supports(req)` returns `true`, set both `req.user` and `req.authSource` from that strategy's result, and throw `UnauthorizedException` with error code `AUTH_NO_CREDENTIALS` when no strategy in the chain supports the request.

#### Scenario: Header strategy takes priority when both credentials are present

- **WHEN** a request carries both a valid `Authorization: Bearer <token>` header and a valid session cookie
- **THEN** the request is authenticated via the header strategy, `req.authSource` is `AuthSource.Header`, and the session cookie is not read or refreshed

#### Scenario: Cookie strategy is used when no header is present

- **WHEN** a request carries a valid session cookie and no `Authorization` header
- **THEN** the request is authenticated via the cookie strategy exactly as before this change, and `req.authSource` is `AuthSource.Cookie`

#### Scenario: No supported credential yields 401

- **WHEN** a request carries neither a valid `Authorization` header nor a valid session cookie, on a non-public route
- **THEN** the response is `401` with error code `AUTH_NO_CREDENTIALS`

### Requirement: Cookie-session behavior is preserved unchanged

The extraction of today's cookie-decrypt, transparent-refresh, CSRF-token-stability, and lazy-bucket-resolution logic into a `CookieSessionStrategy` SHALL NOT change any observable behavior of cookie-authenticated requests.

#### Scenario: Transparent refresh still rotates the cookie within 60 seconds of expiry

- **WHEN** a cookie-authenticated request arrives with `at_exp` less than 60 seconds in the future
- **THEN** the access token is refreshed, a new session cookie is set via `Set-Cookie`, and `X-CSRF-Token` is set to the (unchanged) CSRF token from the original payload

#### Scenario: Lazy bucket resolution still happens for a cookie session with no stored bucket

- **WHEN** a cookie-authenticated request's decrypted payload has an empty `bucket`
- **THEN** the bucket is resolved via `BucketService.getUserBucket` and persisted back into the rotated session cookie, exactly as before this change

#### Scenario: DIAL Core unavailable during cookie-session bucket resolution still yields 503

- **WHEN** `BucketService.getUserBucket` fails during lazy bucket resolution for a cookie-authenticated request
- **THEN** the response is `503 Service Unavailable`

### Requirement: Header bearer token authentication

When `AUTH_HEADER_TOKEN_ENABLED` is `true`, the system SHALL authenticate requests carrying an `Authorization: Bearer <token>` header by verifying the token's signature locally against the JWKS of a registered OIDC provider matching the token's `iss` claim, and checking `exp`, `nbf`, and `aud` with the configured clock tolerance. The token's issuer MUST also be present in `AUTH_HEADER_TOKEN_ALLOWED_ISSUERS`.

#### Scenario: Valid token from a registered, allowlisted issuer authenticates the request

- **WHEN** a request carries `Authorization: Bearer <token>` where `<token>` is signed by a registered provider whose issuer is in `AUTH_HEADER_TOKEN_ALLOWED_ISSUERS`, and the token is unexpired
- **THEN** the request is authenticated, `req.user.sub`/`req.user.providerId`/`req.user.claims` are populated from the verified token, and `req.user.at` is the raw bearer token

#### Scenario: Expired header token is rejected with no cookie fallback

- **WHEN** a request carries an `Authorization` header with an expired token, and also carries a valid session cookie
- **THEN** the response is `401` with error code `AUTH_HEADER_TOKEN_EXPIRED`, and the session cookie is never consulted

#### Scenario: Token with invalid signature is rejected

- **WHEN** a request carries an `Authorization` header whose token fails signature verification against the matched provider's JWKS
- **THEN** the response is `401` with error code `AUTH_HEADER_TOKEN_INVALID`

#### Scenario: Token from an unregistered or non-allowlisted issuer is rejected

- **WHEN** a request carries an `Authorization` header whose token's `iss` claim does not match any registered provider, or matches a registered provider not present in `AUTH_HEADER_TOKEN_ALLOWED_ISSUERS`
- **THEN** the response is `401` with error code `AUTH_HEADER_TOKEN_UNTRUSTED_ISSUER`

#### Scenario: Malformed Authorization header is rejected as 401, not 400

- **WHEN** a request carries an `Authorization` header using a non-`Bearer` scheme, an empty token value, or multiple `Authorization` header values
- **THEN** the response is `401` with error code `AUTH_HEADER_MALFORMED`

#### Scenario: Feature flag off ignores the header entirely

- **WHEN** `AUTH_HEADER_TOKEN_ENABLED` is `false` (the default) and a request carries an `Authorization: Bearer <token>` header along with a valid session cookie
- **THEN** the request is authenticated via the session cookie exactly as it would be with no `Authorization` header present, and the header's token is never parsed or verified

### Requirement: JWKS caching, not per-request fetch

The system SHALL cache the remote JWK set used to verify header tokens per provider for the process lifetime, refreshed at most every `AUTH_HEADER_TOKEN_JWKS_CACHE_TTL_SECONDS`, and SHALL NOT fetch a provider's JWKS document on every request.

#### Scenario: Repeated requests reuse the cached JWK set

- **WHEN** two header-authenticated requests for the same provider arrive within `AUTH_HEADER_TOKEN_JWKS_CACHE_TTL_SECONDS` of each other
- **THEN** the provider's `jwks_uri` is fetched at most once across both requests

### Requirement: CSRF is exempt for header-authenticated requests only

`CsrfGuard` SHALL skip both the `Origin`/`Referer` check and the `X-CSRF-Token` check when `req.authSource` is `AuthSource.Header`. Cookie-authenticated requests SHALL continue to require both checks exactly as before this change.

#### Scenario: Mutating request with header auth succeeds without Origin, Referer, or CSRF token

- **WHEN** a `POST` request is authenticated via `AuthSource.Header` and carries no `Origin` header, no `Referer` header, and no `X-CSRF-Token` header
- **THEN** the request is not rejected by `CsrfGuard`

#### Scenario: Mutating request with cookie auth still requires a matching CSRF token

- **WHEN** a `POST` request is authenticated via `AuthSource.Cookie` and does not carry an `X-CSRF-Token` header matching `req.user.csrf`
- **THEN** the response is `403` with error code `CSRF_INVALID`, unchanged from before this change

### Requirement: Per-request bucket resolution with caching for header-authenticated callers

The system SHALL resolve the DIAL Core bucket for a header-authenticated request via `BucketService.getUserBucket(token)`, caching the result under a cache key derived from a hash of the token (never the raw token) with TTL `AUTH_HEADER_TOKEN_BUCKET_CACHE_TTL_SECONDS`, invalidated only by TTL expiry.

#### Scenario: Bucket cache hit avoids a DIAL Core call

- **WHEN** a header-authenticated request arrives for a token whose bucket was resolved and cached within the last `AUTH_HEADER_TOKEN_BUCKET_CACHE_TTL_SECONDS`
- **THEN** `BucketService.getUserBucket` is not called again, and the cached bucket value is used

#### Scenario: Bucket cache miss resolves and stores the bucket

- **WHEN** a header-authenticated request arrives for a token with no cached bucket entry
- **THEN** `BucketService.getUserBucket(token)` is called, its result is used for the request, and the result is stored under key `auth:bucket:<sha256(token)>` with the configured TTL

#### Scenario: DIAL Core unavailable during header-auth bucket resolution yields 503

- **WHEN** `BucketService.getUserBucket` fails for a header-authenticated request with no cached bucket entry
- **THEN** the response is `503 Service Unavailable`

### Requirement: No refresh and no cookie mutation for header-authenticated requests

The system SHALL NOT attempt token refresh for a header-authenticated request, and SHALL NOT set or modify any session cookie as a result of a header-authenticated request.

#### Scenario: Expiring header token is not refreshed

- **WHEN** a header-authenticated request's token has fewer than 60 seconds until `exp`
- **THEN** the request either succeeds using the still-valid token or fails with `401`/`AUTH_HEADER_TOKEN_EXPIRED` if already expired, and no refresh attempt or `Set-Cookie` occurs

### Requirement: OptionalSessionGuard shares the same strategy chain

`OptionalSessionGuard` SHALL use the same ordered `AuthStrategy` chain as `SessionGuard`, in no-throw mode: it SHALL populate `req.user` and `req.authSource` when any strategy in the chain authenticates the request, and SHALL leave both unset (continuing the request) when no strategy does, without duplicating extraction logic.

#### Scenario: Optional guard populates user from a header-authenticated request

- **WHEN** a public route decorated to use `OptionalSessionGuard` receives a request with a valid `Authorization` header and header auth enabled
- **THEN** `req.user` and `req.authSource` are populated from the header strategy, and the request continues

#### Scenario: Optional guard continues without a user when no credential is valid

- **WHEN** a public route decorated to use `OptionalSessionGuard` receives a request with an invalid or absent credential
- **THEN** the request continues with `req.user` unset, and no exception is thrown

### Requirement: /auth/me behavior is defined for both auth sources

`GET /api/v1/auth/me` SHALL compute `isAdmin` from `req.user.claims` and the resolved provider's `adminRoles` regardless of auth source. It SHALL set the `X-CSRF-Token` response header only when `req.authSource` is `AuthSource.Cookie`.

#### Scenario: /auth/me under header auth returns no CSRF token

- **WHEN** `GET /api/v1/auth/me` is called by a header-authenticated caller
- **THEN** the response body reflects `sub`, `providerId`, `claims`-derived fields, and `isAdmin`, and the response carries no `X-CSRF-Token` header

#### Scenario: /auth/me under cookie auth is unchanged

- **WHEN** `GET /api/v1/auth/me` is called by a cookie-authenticated caller
- **THEN** the response carries `X-CSRF-Token` exactly as before this change

### Requirement: /auth/logout is a no-op for header-authenticated callers

`POST /api/v1/auth/logout` SHALL respond successfully without attempting to clear a session cookie or perform RP-initiated logout when called by a header-authenticated caller, since no session was created for that caller.

#### Scenario: Logout succeeds as a no-op under header auth

- **WHEN** `POST /api/v1/auth/logout` is called by a header-authenticated caller
- **THEN** the response is a success status, no `Set-Cookie` clearing header is emitted, and no RP-initiated logout redirect is attempted

### Requirement: OpenAPI documents both authentication schemes

`apps/chat-api`'s OpenAPI document SHALL declare a `bearer` HTTP security scheme alongside the existing `session` cookie scheme, and operations reachable under both auth sources SHALL be annotated with both security requirements.

#### Scenario: Generated OpenAPI document lists both schemes

- **WHEN** the OpenAPI document is generated via `npm run openapi`
- **THEN** the `components.securitySchemes` object contains both a cookie-based scheme and a `bearer` HTTP scheme with `scheme: bearer`
