## 1. Error code

- [x] 1.1 Add `HeaderProviderNotFound = 'AUTH_HEADER_PROVIDER_NOT_FOUND'` to `AuthErrorCode` in `apps/chat-api/src/auth/session/auth-error-code.enum.ts`.

## 2. Provider registry lookup fallback

- [x] 2.1 In `apps/chat-api/src/auth/providers/provider-registry.service.ts`, update `findByIssuer` to keep the existing exact-match lookup, then on a miss test the issuer against the Azure AD v1 pattern `^https:\/\/sts\.windows\.net\/([^/]+)\/?$`, derive `https://login.microsoftonline.com/{tenant}/v2.0` from the captured tenant, and retry the lookup restricted to entries with `config.id === AuthProviderId.AzureAd`.
- [x] 2.2 Update the `findByIssuer` docstring to describe the v1/v2 fallback and the single-Azure-AD-provider-per-deployment assumption it relies on.

## 3. Split "untrusted issuer" vs "provider not found"

- [x] 3.1 In `apps/chat-api/src/auth/strategies/header-token.strategy.ts` (`authenticate`), replace the single combined `!entry || !allowedIssuers.includes(claims.iss)` check with two sequential checks: throw `AuthErrorCode.HeaderTokenUntrustedIssuer` when `claims.iss` is not in `allowedIssuers`, then throw the new `AuthErrorCode.HeaderProviderNotFound` when `entry` is still `undefined`.
- [x] 3.2 Confirm `verifySignature` continues to receive `issuer: claims.iss` (the token's own issuer, unchanged) and the matched `entry`'s JWKS URI — no changes needed there, but re-check after the refactor.

## 4. Tests

- [x] 4.1 Add unit tests to `apps/chat-api/src/auth/providers/provider-registry.service.spec.ts` (or existing test file) covering: exact match unchanged for a non-Azure-AD provider; v1 issuer resolves to a registered v2 Azure AD provider for the same tenant; v1 issuer with a *different* tenant than the registered v2 provider does not match; no Azure AD provider registered at all returns `undefined` for a v1 issuer.
- [x] 4.2 Update `apps/chat-api/src/auth/strategies/tests/header-token.strategy.spec.ts` to cover: non-allowlisted issuer still yields `AUTH_HEADER_TOKEN_UNTRUSTED_ISSUER`; allowlisted-but-unmatched issuer yields the new `AUTH_HEADER_PROVIDER_NOT_FOUND`; an allowlisted Azure AD v1 issuer with a registered v2 provider authenticates successfully with the correct `providerId`.
- [x] 4.3 Update `apps/chat-api/src/auth.controller.spec.ts` if it asserts on the old combined untrusted-issuer behavior for this scenario. (No such assertion exists — no change needed.)

## 5. Verification

- [x] 5.1 Run `npm exec nx test chat-api`. (2499/2499 tests pass)
- [x] 5.2 Run `npm exec nx lint chat-api`. (0 errors; 2 pre-existing unrelated warnings)
