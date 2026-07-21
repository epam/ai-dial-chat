## 1. Environment schema

- [x] 1.1 Add app-wide `AUTH_POST_LOGOUT_REDIRECT_URI`, `ADMIN_ROLE_NAMES` (default `admin`, comma-separated → `string[]`), and `DIAL_ROLES_FIELD` (default `dial_roles`) fields to `EnvironmentVariables` in `apps/chat-api/src/config/environment.config.ts`.
- [x] 1.2 Add the discrete per-provider optional string fields to `EnvironmentVariables` for all 9 providers (Auth0, Azure AD, Azure B2C, GitLab, Google, Keycloak, PingID, Cognito, Okta), grouped under a `// Auth providers` comment block, following the field names and comma-separated-role transforms in design.md §2–4.
- [x] 1.3 ~~Remove~~ Add back the `AUTH_PROVIDERS?: string` field (now optional, legacy) to `EnvironmentVariables` — reversed per follow-up request to keep a temporary dual-mode (see task 6).

## 2. Provider assembly

- [x] 2.1 Create `apps/chat-api/src/auth/providers/provider-builders.ts` with hardcoded id constants, per-provider default-scope and default-label maps, and one `build{Provider}Config(env): ProviderConfig | undefined` function per provider implementing: presence check on `CLIENT_ID`, throw-on-partial-config, issuer derivation (design.md §3), scope/label defaults (design.md §4), admin-roles/roles-claim fallback chain (design.md §4), and `postLogoutRedirectUri` from `AUTH_POST_LOGOUT_REDIRECT_URI`.
- [x] 2.2 Update `ProviderRegistryService.onModuleInit()` (`apps/chat-api/src/auth/providers/provider-registry.service.ts`) to call all 9 builders when `AUTH_PROVIDERS` is unset, filter out `undefined` results, and keep the existing `validateSync(ProviderConfig)` pass per assembled entry. (Revised: the `JSON.parse(AUTH_PROVIDERS)` path is kept, not removed — see task 6.)
- [x] 2.3 Update `ProviderRegistryService.listProviders()`'s label fallback to use the per-provider default-label map from `provider-builders.ts` instead of the mechanical `id.charAt(0).toUpperCase() + id.slice(1)` capitalization. (Superseded: labels are now defaulted inside each builder, so `listProviders()` only needs `config.label ?? config.id` as a defensive fallback.)

## 3. Tests

- [x] 3.1 Rewrite `apps/chat-api/src/auth/providers/provider-registry.service.spec.ts` fixtures to set discrete per-provider env vars instead of an `AUTH_PROVIDERS` JSON string; cover: single provider configured, multiple providers configured, unconfigured provider silently skipped, partial-config boot failure (missing secret and missing host/tenant cases), Azure B2C issuer formula fallback vs. explicit `AUTH_AZURE_B2C_ISSUER` override, Okta direct issuer, default scope applied vs. overridden, default label applied vs. overridden, provider-specific admin-roles/roles-claim override vs. app-wide fallback, and `AUTH_POST_LOGOUT_REDIRECT_URI` applied to every entry / missing-when-configured boot failure.
- [x] 3.2 Update `apps/chat-api/src/config/validation.spec.ts` and `apps/chat-api/src/config/tests/validation.spec.ts` to drop `AUTH_PROVIDERS` fixtures and cover the new `EnvironmentVariables` fields (valid values pass, malformed comma-separated role lists still parse per existing `ASR_ENABLED_ROLES`-style transform behavior).

## 4. Documentation

- [x] 4.1 Update `apps/chat-api/README.md` to document the new per-provider environment variables (replacing the `AUTH_PROVIDERS` JSON example) and the new `AUTH_POST_LOGOUT_REDIRECT_URI` / `ADMIN_ROLE_NAMES` / `DIAL_ROLES_FIELD` app-wide variables.
- [x] 4.2 Update `docs/environment-variables-migration-guide.md`: replace the `AUTH_PROVIDERS` row with the full per-provider variable tables, and add a "migrating from AUTH_PROVIDERS" section mapping each old JSON field (`id`, `issuer`, `clientId`, `clientSecret`, `scope`, `label`, `audience`, `rolesClaim`, `adminRoles`, `postLogoutRedirectUri`) to its new environment variable(s) per provider.

## 5. Verification

- [x] 5.1 Run `npm exec nx test chat-api` and `npm exec nx lint chat-api`. (`nx test chat-api`'s vitest worker pool crashes on this machine independent of this change — reproduced identically on the pre-change codebase; `npx vitest run --config apps/chat-api/vitest.config.ts` is the reliable equivalent and passes. `npm exec nx lint chat-api` passes after `--fix`.)
- [ ] 5.2 Boot `apps/chat-api` locally with a discrete-variable Auth0 (or Google) configuration and confirm `GET /api/v1/auth/providers` returns the expected `{ id, label }[]` shape, and that login/logout still round-trip end to end. (Not run — requires network access to a real or mocked OIDC discovery endpoint, which this session doesn't have. Deferred to the user/reviewer with real IdP credentials.)

## 6. Temporary dual-mode (AUTH_PROVIDERS kept as legacy fallback)

- [x] 6.1 Add `AUTH_PROVIDERS?: string` back to `EnvironmentVariables` as optional (`@IsOptional() @IsString()`), documented as a temporary legacy field.
- [x] 6.2 Add `ProviderRegistryService.buildLegacyProviderConfigs(raw: string): ProviderConfig[]` (the original `JSON.parse` + `plainToInstance(ProviderConfig, entry)` logic) and branch `onModuleInit()` on `env.AUTH_PROVIDERS`: legacy path when set, `buildProviderConfigs(env)` otherwise. Shared `validateSync` still runs on the result of either path.
- [x] 6.3 Add tests to `provider-registry.service.spec.ts` for the legacy path: registers from `AUTH_PROVIDERS` JSON, malformed JSON fails boot, structurally invalid entry fails boot, and `AUTH_PROVIDERS` takes precedence over discrete variables when both are set.
- [x] 6.4 Update `apps/chat-api/README.md` and `docs/environment-variables-migration-guide.md` with a legacy-mode callout describing the precedence rule and that it's transitional.
- [x] 6.5 Re-run `npx vitest run --config apps/chat-api/vitest.config.ts` and `npm exec nx lint chat-api -- --fix`; confirm green.
