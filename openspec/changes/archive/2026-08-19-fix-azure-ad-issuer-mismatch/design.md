## Context

`ProviderRegistryService` (`apps/chat-api/src/auth/providers/provider-registry.service.ts`) discovers one OIDC client per configured provider at boot and indexes them by `config.id`. `HeaderTokenStrategy` (`apps/chat-api/src/auth/strategies/header-token.strategy.ts`) decodes an incoming bearer token's claims without verification, calls `registry.findByIssuer(claims.iss)` to find the provider whose JWKS should verify the signature, and separately checks `claims.iss` against `AUTH_HEADER_TOKEN_ALLOWED_ISSUERS`. Both checks must pass or the request is rejected with `AuthErrorCode.HeaderTokenUntrustedIssuer` (401).

Azure AD issues tokens whose `iss` claim can be either the legacy v1 form (`https://sts.windows.net/{tenant}/`) or the v2 form (`https://login.microsoftonline.com/{tenant}/v2.0`), depending on token version / endpoint used, for the *same* tenant and app registration. Operators register exactly one issuer string per provider in `AUTH_AZURE_AD_*` env vars (see `provider-builders.ts`), so a deployment that receives both token shapes for the same tenant currently cannot satisfy `findByIssuer`'s exact match for both.

## Goals / Non-Goals

**Goals:**
- Let `findByIssuer` resolve a v1 Azure AD issuer to the registered v2 Azure AD provider for the same tenant (and vice versa is naturally covered since exact match already handles v1-registered/v1-token and v2-registered/v2-token cases).
- Preserve exact-match resolution, unchanged, for every provider and issuer that isn't this Azure AD v1/v2 pair.
- Give operators a way to distinguish "issuer isn't allowlisted" from "issuer is allowlisted but no provider matches it" in logs/error codes, since these currently collapse into one misleading error.

**Non-Goals:**
- Broadening the allowlist check itself: `claims.iss` must still appear verbatim in `AUTH_HEADER_TOKEN_ALLOWED_ISSUERS` — this change only affects provider *lookup*, not the allowlist comparison. Operators must still list whichever issuer format(s) they expect to receive.
- Generalizing v1/v2-style aliasing to other providers (Auth0, Okta, etc.) — no other supported provider is known to emit two issuer formats for one tenant.
- Changing signature verification: `jwtVerify` continues to be called with `issuer: claims.iss` (the exact string from the incoming token), so a token's signature is still checked against its own claimed issuer, not the provider config's configured issuer.

## Decisions

### Decision 1: Fallback lives in `ProviderRegistryService.findByIssuer`, not in `HeaderTokenStrategy`

`findByIssuer` is the single place that maps an issuer string to a provider entry; keeping the v1→v2 tenant-derivation logic there means `HeaderTokenStrategy` (and any other future caller) gets the fix for free without duplicating regex/parsing logic. Alternative considered: patch the comparison in `HeaderTokenStrategy.authenticate` directly — rejected because it would duplicate provider-matching knowledge that belongs in the registry, and would miss other current/future callers of `findByIssuer`.

### Decision 2: Exact match first, regex fallback second, restricted to `AuthProviderId.AzureAd`

`findByIssuer` tries the existing exact-match `Array.find` first (cheap, covers every non-Azure-AD provider and same-format Azure AD deployments unchanged). Only on a miss does it test the incoming issuer against `^https:\/\/sts\.windows\.net\/([^/]+)\/?$`, extract `{tenant}`, build `https://login.microsoftonline.com/{tenant}/v2.0`, and re-search restricted to entries whose `config.id === AuthProviderId.AzureAd`. Restricting to `AzureAd` avoids accidentally matching an unrelated provider that happens to have been configured with that literal v2-shaped issuer string. This mirrors the reference implementation supplied in the bug report, which the reporter verified locally.

### Decision 3: New `AuthErrorCode.HeaderProviderNotFound`, distinct from `HeaderTokenUntrustedIssuer`

`HeaderTokenStrategy.authenticate` currently throws one combined 401 when `!entry || !allowedIssuers.includes(claims.iss)`. Split into two checks:
1. If `claims.iss` is not in `allowedIssuers` → `AuthErrorCode.HeaderTokenUntrustedIssuer` (unchanged meaning: "we don't trust this issuer at all").
2. Else if `entry` is still `undefined` (allowlisted issuer, but no registered provider matches even after the v1/v2 fallback) → new `AuthErrorCode.HeaderProviderNotFound`.

This makes the v1/v2-mismatch failure mode (and any future "allowlisted but unregistered" misconfiguration) diagnosable from the error code and server logs alone, instead of looking identical to a deliberately untrusted issuer. Alternative considered: keep one error code and only improve logging — rejected because the bug report's acceptance criteria explicitly ask for distinguishable error codes, and a machine-readable code is more useful to operators/API consumers than log-only detail.

### Decision 4: No change to JWKS/signature verification call

`verifySignature` receives `entry.client.issuer.metadata['jwks_uri']` (the *matched* provider's JWKS endpoint — correct, since that's where the real keys live) and `issuer: claims.iss` (the *token's own* issuer string, used only as the expected-issuer check inside `jwtVerify`). This is already correct for the fallback case: a v1-issued token's payload really does carry `iss: https://sts.windows.net/{tenant}/`, so asserting `issuer: claims.iss` against that payload still matches. No changes needed here.

## Risks / Trade-offs

- **[Risk]** A deployment could have both a `sts.windows.net` and a `login.microsoftonline.com` issuer independently allowlisted and expect them to resolve to two *different* logical providers → the fallback would collapse them onto whichever single Azure AD provider is registered. **Mitigation:** only one Azure AD provider can be registered per deployment today (`buildProviderConfigs` builds at most one `AuthProviderId.AzureAd` entry from `AUTH_AZURE_AD_*` env vars), so this scenario cannot currently occur; document the assumption in the `findByIssuer` docstring.
- **[Risk]** Regex-based tenant extraction could be fooled by a malformed/attacker-controlled `iss` claim designed to look like a v1 URL. **Mitigation:** the extracted tenant is used only to build a candidate string that must then exactly equal the *registered* provider's configured issuer — an attacker cannot inject a tenant value that isn't already the operator's own configured Azure AD tenant, and the token still has to pass full `jwtVerify` signature/issuer verification against that provider's real JWKS afterward.
- **[Trade-off]** Two error codes instead of one is a small API-shape change for any client parsing `code` from 401 responses. Acceptable since this is an internal/BFF-facing error surface (see `apps/chat-api/AGENTS.md` — auth/session endpoints), not a published public contract, and the bug report explicitly requests the split.
