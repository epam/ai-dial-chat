## MODIFIED Requirements

### Requirement: Header bearer token authentication

When `AUTH_HEADER_TOKEN_ENABLED` is `true`, the system SHALL authenticate requests carrying an `Authorization: Bearer <token>` header by verifying the token's signature locally against the JWKS of a registered OIDC provider matching the token's `iss` claim, and checking `exp`, `nbf`, and `aud` with the configured clock tolerance. The token's issuer MUST also be present in `AUTH_HEADER_TOKEN_ALLOWED_ISSUERS`. When resolving the registered provider for an Azure AD tenant, an `iss` claim in the Azure AD v1 format (`https://sts.windows.net/{tenant}/`) SHALL be treated as equivalent to the same tenant's v2 format (`https://login.microsoftonline.com/{tenant}/v2.0`) if no provider is registered under the exact issuer string presented.

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

#### Scenario: Feature flag off ignores the header entirely

- **WHEN** `AUTH_HEADER_TOKEN_ENABLED` is `false` (the default) and a request carries an `Authorization: Bearer <token>` header along with a valid session cookie
- **THEN** the request is authenticated via the session cookie exactly as it would be with no `Authorization` header present, and the header's token is never parsed or verified
