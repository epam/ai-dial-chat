## 1. Backend response DTOs

- [x] 1.1 Rename fields on `DialToolsetAuthSettingsDto` (`apps/chat-api/src/openapi/openapi-response.dto.ts`) to camelCase: `authentication_type`→`authenticationType`, `api_key_header`→`apiKeyHeader`, `client_id`→`clientId`, `redirect_uri`→`redirectUri`, `authorization_endpoint`→`authorizationEndpoint`, `token_endpoint`→`tokenEndpoint`, `code_challenge`→`codeChallenge`, `code_challenge_method`→`codeChallengeMethod`, `scopes_supported`→`scopesSupported`, `global_auth_status`→`globalAuthStatus`, `user_level_auth_status`→`userLevelAuthStatus`.
- [x] 1.2 Rename fields on `DialToolsetDto` to camelCase: `display_name`→`displayName`, `display_version`→`displayVersion`, `icon_url`→`iconUrl`, `description_keywords`→`descriptionKeywords`, `max_retry_attempts`→`maxRetryAttempts`, `created_at`→`createdAt`, `updated_at`→`updatedAt`, `allowed_tools`→`allowedTools`, `auth_settings`→`authSettings`, `is_installed`→`isInstalled`, `is_my`→`isMy`, `can_edit`→`canEdit`, `shared_with_me`→`sharedWithMe`.
- [x] 1.3 Add a new `DialToolsetFeaturesDto` (camelCase, mirroring `DialModelFeaturesDto`'s field set) and repoint `DialToolsetDto.features` to it — `DialModelFeaturesDto` itself stays snake_case/unchanged since it's also used by the out-of-scope, intentionally-raw-passthrough `DialModelDto` (`GET /api/v1/models`).

## 2. Backend service mapping

- [x] 2.1 In `apps/chat-api/src/toolsets/toolsets.service.ts`, rewrite `withDisplayName` to read the raw DIAL Core `display_name` and populate the camelCase `displayName` field (matching `getResourceDisplayNameFallback` fallback behavior).
- [x] 2.2 Rewrite `redactToolsetSecrets` to redact `client_secret`/`code_verifier` on the raw snake_case `auth_settings` input while producing a camelCase `authSettings` output (no longer keeping a separate `auth_settings` key).
- [x] 2.3 Add a `mapDialToolsetToDto` (or similarly named) explicit field-by-field mapper — modeled on `deployments.service.ts`'s `mapToDeploymentItem` — that converts a raw DIAL Core toolset payload into the full camelCase `DialToolsetDto` shape (all fields from tasks 1.1/1.2/1.3, including a `mapToolsetFeatures` sub-mapper for the new `DialToolsetFeaturesDto`), and wire it into `listToolsets`, `getToolset`, `getCustomToolset`, and `mergeCustomToolsetDetails` so every response path produces the same camelCase shape.
- [x] 2.4 Rewrite `enrichToolsetWithOwnership` to set `isInstalled`, `isMy`, `canEdit`, `sharedWithMe` (camelCase) instead of the current snake_case keys.
- [x] 2.5 Update `isMyToolset`/`getAuthSettings` and any other helper reading `toolset.id`, `rawToolset.authSettings ?? rawToolset.auth_settings` to operate against the new single camelCase shape (drop the snake_case fallback branch once the mapper in 2.3 guarantees camelCase input).

## 3. Backend tests

- [x] 3.1 Update `apps/chat-api/src/toolsets/tests/toolsets.service.spec.ts` fixtures and assertions from snake_case (`auth_settings`, `is_installed`, `is_my`, `can_edit`, `shared_with_me`, `authentication_type`, `client_secret`, etc.) to the new camelCase field names.
- [x] 3.2 Run `npm exec nx test chat-api` and fix any remaining failures.
- [x] 3.3 Run `npm exec nx lint chat-api`.

## 4. OpenAPI contract and generated client

- [x] 4.1 Run `npm run openapi` to regenerate the OpenAPI spec from the updated DTOs.
- [x] 4.2 Run `npm run openapi:check` and resolve any diff outside the expected toolsets field renames.
- [x] 4.3 Rebuild and lint `chat-api-client` (`nx build chat-api-client --skip-nx-cache`, `nx lint chat-api-client`) and confirm the generated `DialToolsetDto`/`DialToolsetAuthSettingsDto` models now expose camelCase fields.

## 5. Frontend adapter cleanup

- [x] 5.1 Delete `normalizeToolset`, `normalizeFeatures`, `normalizeAuthSettings` and the `RawDialToolsetDto`/`RawDialModelFeaturesDto`/`RawToolsetAuthSettingsDto` types from `apps/chat/src/server-api/toolsets.ts`.
- [x] 5.2 Simplify `listToolsets`/`getToolset` in `apps/chat/src/server-api/toolsets.ts` to return the generated client response directly, with no field remapping.
- [x] 5.3 Update `apps/chat/src/server-api/tests/toolsets.api.spec.ts` (or equivalent) to drop normalizer-specific test cases and assert on direct passthrough behavior.
- [x] 5.4 Run `npm exec nx test chat` for `apps/chat/src/server-api`, `apps/chat/src/utils` (catalog mapper), and `CatalogView`/`ToolsetEditor` specs to confirm no regressions from the removed normalization layer.

## 6. Spec and verification

- [x] 6.1 Confirm `openspec/specs/catalog-toolsets/spec.md` will be updated by this change's delta spec at archive time (no manual action beyond what's already in `specs/catalog-toolsets/spec.md` in this change).
- [x] 6.2 Manually verify end-to-end: start `npm run start:all`, open the Catalog Toolsets tab, confirm toolset install/ownership/edit/share state renders correctly, and inspect the network response for `GET /api/v1/toolsets` to confirm all-camelCase fields. **Partially done in this session**: confirmed the route is wired and auth-guarded (`GET /api/v1/toolsets` → 401 unauthenticated against a live chat-api instance) and confirmed the real dev DIAL Core (`core.aks.dev.dial.parts`) returns the exact raw snake_case wire shape `mapDialToolsetToDto`/`mapToolsetFeatures`/`mapAuthSettings` were written against. Full authenticated browser walkthrough of the Catalog Toolsets tab was not performed — no OIDC test credentials available in this session. A human with login access should complete this step before merge.
