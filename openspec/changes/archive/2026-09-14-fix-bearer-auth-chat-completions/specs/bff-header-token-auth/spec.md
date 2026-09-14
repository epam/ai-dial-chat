## MODIFIED Requirements

### Requirement: Header bearer token authentication

When `AUTH_HEADER_TOKEN_ENABLED` is `true`, the system SHALL authenticate requests carrying an `Authorization: Bearer <token>` header by verifying the token's signature locally against the JWKS of a registered OIDC provider matching the token's `iss` claim, and checking `iss`, `exp`, and `nbf` with the configured clock tolerance.

The `aud` claim is deliberately **not** constrained: the trust boundary here is the pair of checks that the issuer is on the operator's `AUTH_HEADER_TOKEN_ALLOWED_ISSUERS` allowlist **and** that a provider is registered for it, after which DIAL Core itself authorizes the token. Constraining `aud` would additionally require operators to enumerate every client id allowed to call the BFF.

The order of checks SHALL be: decode the token unverified to read `iss`; reject an undecodable token; reject a token with no `iss`; reject an issuer absent from `AUTH_HEADER_TOKEN_ALLOWED_ISSUERS`; reject an allowlisted issuer with no registered provider; then verify the signature and time claims; and finally reject a token whose verified claims carry no `sub`, or whose `sub` is an empty string. The `sub` claim SHALL NOT be coerced to an empty string: it is the server-verified identity that `generation-principal-ownership` derives generation ownership from, so an empty subject would collapse every such caller of one provider into a single owner. Reading `iss` before verification is safe because it is only used to select which JWKS to verify against, and the allowlist is consulted before any key is fetched. When resolving the registered provider for an Azure AD tenant, an `iss` claim in the Azure AD v1 format (`https://sts.windows.net/{tenant}/`) SHALL be treated as equivalent to the same tenant's v2 format (`https://login.microsoftonline.com/{tenant}/v2.0`) if no provider is registered under the exact issuer string presented.

#### Scenario: Valid token from a registered, allowlisted issuer authenticates the request

- **WHEN** a request carries `Authorization: Bearer <token>` where `<token>` is signed by a registered provider whose issuer is in `AUTH_HEADER_TOKEN_ALLOWED_ISSUERS`, and the token is unexpired
- **THEN** the request is authenticated, `req.user.sub`/`req.user.providerId`/`req.user.claims` are populated from the verified token, and `req.user.at` is the raw bearer token

#### Scenario: Expired header token is rejected with no cookie fallback

- **WHEN** a request carries an `Authorization` header with an expired token, and also carries a valid session cookie
- **THEN** the response is `401` with error code `AUTH_HEADER_TOKEN_EXPIRED`, and the session cookie is never consulted

#### Scenario: Token with invalid signature is rejected

- **WHEN** a request carries an `Authorization` header whose token fails signature verification against the matched provider's JWKS
- **THEN** the response is `401` with error code `AUTH_HEADER_TOKEN_INVALID`

#### Scenario: Token from a non-allowlisted issuer is rejected

- **WHEN** a request carries an `Authorization` header whose token's `iss` claim is not present in `AUTH_HEADER_TOKEN_ALLOWED_ISSUERS`
- **THEN** the response is `401` with error code `AUTH_HEADER_TOKEN_UNTRUSTED_ISSUER`

#### Scenario: Allowlisted issuer with no matching registered provider is rejected with a distinct error code

- **WHEN** a request carries an `Authorization` header whose token's `iss` claim is present in `AUTH_HEADER_TOKEN_ALLOWED_ISSUERS`, but no registered provider's issuer matches it exactly, and (for an Azure AD v1-shaped `iss`) no registered Azure AD provider matches the corresponding v2 issuer either
- **THEN** the response is `401` with error code `AUTH_HEADER_PROVIDER_NOT_FOUND`, distinct from `AUTH_HEADER_TOKEN_UNTRUSTED_ISSUER`

#### Scenario: Azure AD v1 issuer resolves to the registered v2 Azure AD provider for the same tenant

- **WHEN** a request carries an `Authorization: Bearer <token>` header where `<token>`'s `iss` claim is `https://sts.windows.net/{tenant}/`, `https://sts.windows.net/{tenant}/` is present in `AUTH_HEADER_TOKEN_ALLOWED_ISSUERS`, no provider is registered with that exact issuer string, and an Azure AD provider is registered with issuer `https://login.microsoftonline.com/{tenant}/v2.0` for the same `{tenant}`
- **THEN** the request is authenticated using that Azure AD provider's JWKS, `req.user.providerId` is the Azure AD provider's id, and the token's signature/claims are verified with `issuer` equal to the token's own `https://sts.windows.net/{tenant}/` value

#### Scenario: Malformed Authorization header is rejected as 401, not 400

- **WHEN** a request carries an `Authorization` header using a non-`Bearer` scheme, an empty token value, or multiple `Authorization` header values
- **THEN** the response is `401` with error code `AUTH_HEADER_MALFORMED`

#### Scenario: A token that is not a decodable JWT is rejected as malformed

- **WHEN** the bearer value parses as a header but is not a decodable JWT
- **THEN** the response is `401` with error code `AUTH_HEADER_MALFORMED`

#### Scenario: A token with no `iss` claim is rejected as invalid

- **WHEN** the bearer token decodes but carries no `iss` claim
- **THEN** the response is `401` with error code `AUTH_HEADER_TOKEN_INVALID`

#### Scenario: A token for another audience is still accepted

- **WHEN** a request carries a signed, unexpired token from an allowlisted, registered issuer whose `aud` is some other client id
- **THEN** the request authenticates, because `aud` is not part of the verification contract

#### Scenario: Feature flag off ignores the header entirely

- **WHEN** `AUTH_HEADER_TOKEN_ENABLED` is `false` (the default) and a request carries an `Authorization: Bearer <token>` header along with a valid session cookie
- **THEN** the request is authenticated via the session cookie exactly as it would be with no `Authorization` header present, and the header's token is never parsed or verified


#### Scenario: A verified token with no `sub` claim is rejected as invalid

- **WHEN** a request carries a bearer token that passes issuer allowlisting, provider matching, and signature/time verification, but whose verified claims contain no `sub` (or a `sub` that is an empty string)
- **THEN** the response is `401` with error code `AUTH_HEADER_TOKEN_INVALID`, and `req.user` is never populated with an empty subject

## ADDED Requirements

### Requirement: No endpoint rejects a header-authenticated caller for lacking a session artifact

`SessionUser.sid` and `SessionUser.csrf` are absent by design for a header-authenticated caller, because no session is created for one. No endpoint SHALL therefore reject an otherwise-authorized request solely because one of those fields is absent, and no endpoint SHALL treat their absence as a reason to return `401`.

Server-side state that needs a stable per-caller identity SHALL derive it from verified identity data per `generation-principal-ownership`, not from `sid`.

#### Scenario: A business endpoint does not demand a cookie session

- **WHEN** a request authenticated as `AuthSource.Header` reaches any non-public endpoint the caller is authorized for
- **THEN** the endpoint does not respond `401` on the grounds that `SessionUser.sid` or `SessionUser.csrf` is absent

#### Scenario: The generation endpoints are reachable under header auth

- **WHEN** a header-authenticated caller posts to `POST /api/v1/conversations/completions`, `POST /api/v1/conversations/completions/stop`, or `POST /api/v1/conversations/completions/attach`
- **THEN** the request is handled on its merits — succeeding, or failing with the endpoint's own documented `404`/`409`/`5xx` — and is never rejected with `401` for the absence of a cookie-authenticated session
