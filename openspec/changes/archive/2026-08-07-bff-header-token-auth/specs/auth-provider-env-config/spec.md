## ADDED Requirements

### Requirement: Header-token authentication environment variables

The system SHALL read the following environment variables into `EnvironmentVariables`, controlling header bearer-token authentication independently of the per-provider OIDC configuration:

- `AUTH_HEADER_TOKEN_ENABLED` (boolean, default `false`): master feature flag.
- `AUTH_HEADER_TOKEN_ALLOWED_ISSUERS` (comma-separated string list, no default): allowlist of `iss` values accepted for header tokens, in addition to those values needing to match a registered provider's issuer.
- `AUTH_HEADER_TOKEN_CLOCK_TOLERANCE_SECONDS` (number, default `30`): clock-skew tolerance applied when verifying `exp`/`nbf`.
- `AUTH_HEADER_TOKEN_JWKS_CACHE_TTL_SECONDS` (number, default `600`): how long a provider's remote JWK set is reused before being recreated.
- `AUTH_HEADER_TOKEN_BUCKET_CACHE_TTL_SECONDS` (number, default `60`): TTL for cached DIAL Core bucket lookups keyed by hashed header token.

#### Scenario: Header-token auth is disabled by default

- **WHEN** the application boots with none of the `AUTH_HEADER_TOKEN_*` variables set
- **THEN** `AUTH_HEADER_TOKEN_ENABLED` resolves to `false` and every other `AUTH_HEADER_TOKEN_*` variable resolves to its documented default

#### Scenario: Explicit enablement with an issuer allowlist

- **WHEN** `AUTH_HEADER_TOKEN_ENABLED=true` and `AUTH_HEADER_TOKEN_ALLOWED_ISSUERS=https://accounts.google.com,https://example-tenant.b2clogin.com/...` are set
- **THEN** the application boots successfully and header tokens are accepted only from those two issuers (subject also to matching a registered provider)

### Requirement: Enabling header-token auth without an issuer allowlist fails boot

When `AUTH_HEADER_TOKEN_ENABLED` is `true`, the system SHALL require `AUTH_HEADER_TOKEN_ALLOWED_ISSUERS` to be set and non-empty, and SHALL fail application boot with a descriptive error naming `AUTH_HEADER_TOKEN_ALLOWED_ISSUERS` when it is not.

#### Scenario: Missing allowlist with the feature enabled fails boot

- **WHEN** `AUTH_HEADER_TOKEN_ENABLED=true` is set and `AUTH_HEADER_TOKEN_ALLOWED_ISSUERS` is unset
- **THEN** application boot fails with an error message naming `AUTH_HEADER_TOKEN_ALLOWED_ISSUERS`

#### Scenario: Disabled flag does not require an allowlist

- **WHEN** `AUTH_HEADER_TOKEN_ENABLED` is `false` (or unset) and `AUTH_HEADER_TOKEN_ALLOWED_ISSUERS` is unset
- **THEN** application boot succeeds
