## Why

`GET /api/v1/toolsets` and `GET /api/v1/toolsets/{toolsetName}` return raw DIAL Core snake_case fields (`is_installed`, `is_my`, `can_edit`, `shared_with_me`, `display_name`, `allowed_tools`, `auth_settings`, etc.), while the equivalent `/api/v1/deployments` endpoint fully normalizes every field — including computed ownership flags and passthrough DIAL SDK fields — to camelCase in `deployments.service.ts` (`mapToDeploymentItem`). This inconsistency forces `apps/chat/src/server-api/toolsets.ts` to carry a bespoke `normalizeToolset`/`normalizeFeatures`/`normalizeAuthSettings` normalization layer that duplicates logic the backend should own, and leaves the toolsets API as the only business endpoint in the app that isn't camelCase end-to-end.

## What Changes

- **BREAKING**: `DialToolsetDto` and `DialToolsetAuthSettingsDto` (`apps/chat-api/src/openapi/openapi-response.dto.ts`) are renamed to camelCase field-by-field (`display_name`→`displayName`, `display_version`→`displayVersion`, `icon_url`→`iconUrl`, `description_keywords`→`descriptionKeywords`, `max_retry_attempts`→`maxRetryAttempts`, `created_at`→`createdAt`, `updated_at`→`updatedAt`, `allowed_tools`→`allowedTools`, `auth_settings`→`authSettings`, `is_installed`→`isInstalled`, `is_my`→`isMy`, `can_edit`→`canEdit`, `shared_with_me`→`sharedWithMe`; `DialToolsetAuthSettingsDto`'s `authentication_type`, `api_key_header`, `client_id`, `redirect_uri`, `authorization_endpoint`, `token_endpoint`, `code_challenge`, `code_challenge_method`, `scopes_supported`, `global_auth_status`, `user_level_auth_status` get the same treatment). Fields with no case distinction (`id`, `toolset`, `description`, `intro`, `owner`, `object`, `status`, `endpoint`, `transport`, `reference`) are unaffected by name.
- A new `DialToolsetFeaturesDto` (camelCase) replaces `DialModelFeaturesDto` as the type of `DialToolsetDto.features`. `DialModelFeaturesDto` stays snake_case and unchanged — it is also used by `DialModelDto` (`GET /api/v1/models`), a separate, intentionally-raw-passthrough endpoint (`models.service.ts` casts the DIAL Core response directly with no field mapping) that is out of scope for this change. Renaming the shared DTO in place would have silently flipped the models endpoint's response shape too; toolsets gets its own DTO instead.
- `apps/chat-api/src/toolsets/toolsets.service.ts` maps every raw DIAL Core response field into the camelCase `DialToolsetDto`/`DialToolsetAuthSettingsDto` shape before returning it — mirroring the manual field-by-field remap pattern in `deployments.service.ts`'s `mapToDeploymentItem` — instead of passing most fields through as-is and only computing a few in snake_case.
- `apps/chat/src/server-api/toolsets.ts` drops the now-redundant `normalizeToolset`, `normalizeFeatures`, `normalizeAuthSettings` functions and their `Raw*` types; `listToolsets`/`getToolset` become direct passthroughs of the generated client response.
- Regenerate `libs/chat-api-client` from the updated OpenAPI contract (`npm run openapi`, `npm run openapi:check`, rebuild/lint `chat-api-client`) so its generated `DialToolsetDto`/`DialToolsetAuthSettingsDto` models match.
- Update `apps/chat-api/src/toolsets/tests/toolsets.service.spec.ts` fixtures/assertions to camelCase.
- Update `openspec/specs/catalog-toolsets/spec.md` requirement "Catalog toolsets are loaded from the dedicated toolsets API" to document the full camelCase response contract.

Out of scope: `deployments.service.ts`'s `buildToolsetDetails`/`mapToolsetAuthSettings`, which build a separate `DeploymentDetailsDto.toolsetDetails` shape for `/api/v1/deployments/{id}` and are already independently camelCase — no change needed there.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `catalog-toolsets`: the `GET /api/v1/toolsets` / `GET /api/v1/toolsets/{toolsetName}` response contract changes from mixed snake_case/computed-field naming to fully camelCase, matching the `/api/v1/deployments` convention. The frontend no longer needs to normalize the response.

## Impact

- **Affected code**: `apps/chat-api/src/openapi/openapi-response.dto.ts` (`DialToolsetDto`, `DialToolsetAuthSettingsDto`), `apps/chat-api/src/toolsets/toolsets.service.ts`, `apps/chat-api/src/toolsets/tests/toolsets.service.spec.ts`, `apps/chat/src/server-api/toolsets.ts` (+ its tests), `libs/chat-api-client` (regenerated).
- **Breaking API change**: any external client of `GET /api/v1/toolsets`/`GET /api/v1/toolsets/{toolsetName}` reading the old snake_case field names must switch to camelCase. Internal consumers (`DeploymentsContext`, `CatalogView`, `ToolsetEditor`, catalog mapper) already read only the camelCase `DialToolsetDto` fields produced by the frontend normalizer today, so they are unaffected once the normalizer is removed.
- **Not affected**: `/api/v1/deployments` endpoints and `DeploymentDetailsDto.toolsetDetails` (already camelCase, built independently in `deployments.service.ts`).
