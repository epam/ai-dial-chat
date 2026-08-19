## Why

Header-based bearer-token authentication rejects valid Azure AD tokens whenever the token's `iss` claim uses the Azure AD v1 issuer format (`https://sts.windows.net/{tenant}/`) but the registered provider was configured with the v2 issuer format (`https://login.microsoftonline.com/{tenant}/v2.0`), or vice versa. Both URLs identify the same tenant, but `ProviderRegistryService.findByIssuer` does an exact string match, so the provider lookup silently fails. The request is rejected with `AUTH_HEADER_TOKEN_UNTRUSTED_ISSUER`, the same code used for a genuinely non-allowlisted issuer, which makes the real cause (a v1/v2 format mismatch, not a missing allowlist entry) hard to diagnose.

## What Changes

- `ProviderRegistryService.findByIssuer` first attempts the existing exact-match lookup; if that misses and the incoming issuer matches the Azure AD v1 pattern (`https://sts.windows.net/{tenant}/`), it derives the tenant's v2 issuer (`https://login.microsoftonline.com/{tenant}/v2.0`) and retries the lookup restricted to the registered `AuthProviderId.AzureAd` provider.
- `HeaderTokenStrategy.authenticate` passes the token's own `iss` claim as the expected issuer to `jwtVerify` (already does today), so signature verification continues to validate against the exact issuer string presented by the token — only JWKS/provider resolution is affected by the fallback.
- **BREAKING**: none. Exact-match behavior for every other provider and issuer format is unchanged; this only adds a fallback path.
- Introduce a distinct error code (`AUTH_HEADER_PROVIDER_NOT_FOUND`) for "issuer is allowlisted but no provider (even after the v1/v2 fallback) is registered for it," separate from `AUTH_HEADER_TOKEN_UNTRUSTED_ISSUER` ("issuer is not allowlisted at all").

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `bff-header-token-auth`: header bearer-token authentication now recognizes Azure AD v1 (`sts.windows.net`) and v2 (`login.microsoftonline.com`) issuer URLs for the same tenant as equivalent when resolving the registered provider, and reports a distinct error code when the issuer is allowlisted but still unmatched to any provider.

## Impact

- `apps/chat-api/src/auth/providers/provider-registry.service.ts` — `findByIssuer` gains the v1→v2 fallback.
- `apps/chat-api/src/auth/strategies/header-token.strategy.ts` — distinguishes "not allowlisted" from "no matching provider" when raising 401s.
- `apps/chat-api/src/auth/session/auth-error-code.enum.ts` — new `HeaderProviderNotFound` member.
- Existing/new unit tests for `ProviderRegistryService` and `HeaderTokenStrategy`.
- No API surface, DTO, or OpenAPI contract changes — this is internal auth-resolution logic, not a public endpoint change.
