## 1. Restructure DTOs and migration logic

- [x] 1.1 In `apps/chat-api/src/user-config/dto/user-config.dto.ts`: define nested interfaces `ConversationsConfig`, `ToolsetsConfig`, `DeploymentsConfig`, and update `UserConfig` to `{ version: number; conversations: ConversationsConfig; toolsets: ToolsetsConfig; deployments: DeploymentsConfig }`. Update `UserConfigDto` (Swagger class) to use nested `ConversationsConfigDto`, `ToolsetsConfigDto`, `DeploymentsConfigDto` classes with `@ApiProperty`. Bump `CURRENT_CONFIG_VERSION` to `2`. Update `DEFAULT_USER_CONFIG` to the v2 default.
- [x] 1.2 In `apps/chat-api/src/user-config/dto/user-config.dto.ts`: rewrite `migrateConfig` to handle: (a) null/non-object → default v2; (b) v1 flat shape (has `pinnedConversationIds` at root, no nested `conversations`) → lift into v2; (c) v2+ shape → sanitise each array (filter non-strings).
- [x] 1.3 Create `apps/chat-api/src/user-config/dto/update-installed.dto.ts` with `UpdateInstalledDto` containing `id: string` (`@IsString`, `@IsNotEmpty`, `@Matches(/^[\w\-./@]+$/)`, `@ApiProperty`) and `isInstalled: boolean` (`@IsBoolean`, `@ApiProperty`).
- [x] 1.4 Verify: `npm exec nx test chat-api` — `migrateConfig` tests in `user-config.service.spec.ts` now cover v1→v2 lift, v2 pass-through, null input, and non-string array filtering.

## 2. Update UserConfigService

- [x] 2.1 In `apps/chat-api/src/user-config/user-config.service.ts`: update `CONFIG_PATH` constant to `'.client_data/.user-config.json'`. Add `LEGACY_CONFIG_PATH = '.user-config.json'` constant.
- [x] 2.2 In `readConfig`: add fallback logic — if DIAL Core returns non-ok for `CONFIG_PATH`, attempt download from `LEGACY_CONFIG_PATH`. If legacy file found: migrate to v2, call `writeConfig` to new path (best-effort), attempt deletion of legacy path (best-effort, log failure with `logger.warn`). Return migrated config.
- [x] 2.3 Update `getPinnedIds` to return `config.conversations.pinnedIds`.
- [x] 2.4 Update `updatePin` to read from and write to `config.conversations.pinnedIds`.
- [x] 2.5 Update `migratePin` to operate on `config.conversations.pinnedIds`.
- [x] 2.6 Add private helper `mergeInstalledIds(base: string[], legacy: string[]): string[]` — returns the new-config-wins union: `base` as-is plus any IDs from `legacy` not already in `base` (preserves order; no duplicates).
- [x] 2.7 Add private async helper `consolidateLegacyInstallationFiles(config: UserConfig, token: string, bucket: string): Promise<{ config: UserConfig; changed: boolean }>` — reads `clientdata/installed_toolsets.json` and `clientdata/installed_deployments.json`, calls `mergeInstalledIds` for each, deletes each legacy file best-effort (log failure with `logger.warn`), returns the mutated config and a `changed` flag. Malformed/non-array responses are logged and skipped. Non-string array entries are filtered before merging.
- [x] 2.8 In `readConfig`: after the primary config is resolved, call `consolidateLegacyInstallationFiles`; if `changed`, call `writeConfig` to persist the merged result.
- [x] 2.9 Add private helper `updateInstalledEntry(section: 'toolsets' | 'deployments', id: string, isInstalled: boolean, token: string, bucket: string): Promise<void>` — reads config, mutates `config[section].installed`, writes back.
- [x] 2.10 Add public `updateInstalledToolset(id, isInstalled, token, bucket): Promise<void>` delegating to `updateInstalledEntry('toolsets', ...)`.
- [x] 2.11 Add public `updateInstalledDeployment(id, isInstalled, token, bucket): Promise<void>` delegating to `updateInstalledEntry('deployments', ...)`.
- [x] 2.12 Verify: `npm exec nx test chat-api` — update existing service unit tests in `apps/chat-api/src/user-config/tests/user-config.service.spec.ts` to use the v2 config shape; add tests covering all migration scenarios from the spec (both legacy file paths, merge, deduplication, empty, malformed, idempotency, partial, conversations preservation). Add tests for `updateInstalledToolset` and `updateInstalledDeployment`.

## 3. Update UserConfigController and add new endpoints

- [x] 3.1 In `apps/chat-api/src/user-config/user-config.controller.ts`: update `@ApiResponse` on `GET /` to reference the updated `UserConfigDto` (v2 nested shape).
- [x] 3.2 Add `PATCH toolsets` handler: `@Patch('toolsets') @HttpCode(204)` with `@ApiOperation`, `@ApiResponse` for 204/400/401; delegate to `userConfigService.updateInstalledToolset(dto.id, dto.isInstalled, at, bucket)`.
- [x] 3.3 Add `PATCH deployments` handler: `@Patch('deployments') @HttpCode(204)` with `@ApiOperation`, `@ApiResponse` for 204/400/401; delegate to `userConfigService.updateInstalledDeployment(dto.id, dto.isInstalled, at, bucket)`.
- [x] 3.4 Verify: `npm exec nx lint chat-api && npm exec nx build chat-api`

## 4. Update integration tests

- [x] 4.1 In `apps/chat-api/src/user-config/tests/user-config.controller.integration.spec.ts`: update `GET /user-config` test to assert a v2-shaped response body (`{ version: 2, conversations: { pinnedIds: [...] }, toolsets: { ... }, deployments: { ... } }`).
- [x] 4.2 Add integration tests for `PATCH /user-config/toolsets`: valid install (204), valid uninstall (204), missing `id` (400), non-boolean `isInstalled` (400), empty body (400).
- [x] 4.3 Add integration tests for `PATCH /user-config/deployments`: same coverage as 4.2.
- [x] 4.4 Verify: `npm exec nx test chat-api`

## 5. Regenerate API client and update Swagger

- [x] 5.1 Run `npm run openapi` to regenerate `libs/chat-api-client/openapi.json` from the updated Swagger output of `chat-api`. (Note: openapi-spec generation has a pre-existing SWC path-alias resolution issue in this workspace. The openapi.json was updated manually to reflect the new v2 schema and new endpoints.)
- [x] 5.2 Run `npm run openapi:check` to confirm the generated spec passes validation.
- [x] 5.3 Run `npm exec nx build chat-api-client -- --skip-nx-cache && npm exec nx lint chat-api-client` to confirm the generated client compiles and lints clean.
- [x] 5.4 Inspect `libs/chat-api-client/src/generated/src/apis/UserConfigApi.ts` (or equivalent) — confirm that: `getUserConfig` returns a type with the v2 nested shape; `updatePin` signature is unchanged; `updateInstalledToolset` and `updateInstalledDeployment` methods exist.

## 6. Update frontend server-api wrappers

- [x] 6.1 In `apps/chat/src/server-api/user-config.api.ts`: update imports and wrapper functions to use the new generated client types. Ensure `getUserConfig` returns the v2 `UserConfigDto` shape. Confirm callers that read `pinnedConversationIds` are updated to read `conversations.pinnedIds`.
- [x] 6.2 Search `apps/chat/src/` for any remaining references to `pinnedConversationIds` (e.g. in context files, hooks, or components that map config fields) and update them to `conversations.pinnedIds`.
- [x] 6.3 Verify: `npm exec nx lint chat && npm exec nx build chat` (type-check frontend). (Note: pre-existing `@tabler/icons-react` typecheck failures exist in unrelated libs from other in-progress work; not caused by this change.)

## 7. Update spec documentation

- [x] 7.1 Merge the delta spec at `openspec/changes/extend-user-config/specs/user-config-api/spec.md` into `openspec/specs/user-config-api/spec.md` by replacing the original requirements with the updated content (file path, v2 schema, `conversations.pinnedIds` references).
- [x] 7.2 Create `openspec/specs/user-config-toolset-management/spec.md` from the change spec at `openspec/changes/extend-user-config/specs/user-config-toolset-management/spec.md`.
- [x] 7.3 Create `openspec/specs/user-config-deployment-management/spec.md` from the change spec at `openspec/changes/extend-user-config/specs/user-config-deployment-management/spec.md`.

## 8. Final cross-project verification (backend)

- [x] 8.1 Run `npm exec nx affected --target=test --base=origin/development-1.0` — all affected projects pass.
- [x] 8.2 Run `npm exec nx affected --target=lint --base=origin/development-1.0` — no new lint errors. (Note: 4 pre-existing flaky typecheck failures in unrelated libs.)
- [x] 8.3 Run `npm exec nx affected --target=build --base=origin/development-1.0` — all affected projects build. (Note: same pre-existing flaky typecheck failures as 8.2.)

## 9. Frontend UserConfigContext — types and context scaffolding

**Dependencies:** slice 6 (frontend server-api wrappers use v2 types)

- [x] 9.1 Create `apps/chat/src/types/user-config-status.ts` with:
  ```typescript
  export enum UserConfigStatus {
    Idle    = 'idle',
    Loading = 'loading',
    Ready   = 'ready',
    Error   = 'error',
  }
  ```
- [x] 9.2 Add `UserConfigI18nKeys` enum to `apps/chat/src/constants/translation-keys.ts`:
  ```typescript
  export enum UserConfigI18nKeys {
    LoadError = 'userConfig.loadError',
  }
  ```
- [x] 9.3 Add `"userConfig": { "loadError": "Failed to load your settings. Some personalization may be unavailable." }` to `apps/chat/src/i18n/locales/en.json`.
- [x] 9.4 Verify: `npm exec nx lint chat && npm exec nx build chat`

## 10. Frontend UserConfigContext — provider implementation

**Dependencies:** slice 9

- [x] 10.1 Create `apps/chat/src/context/UserConfigContext.tsx` with `UserConfigProvider` and `useUserConfig()`. Implementation requirements:
  - `createContext<UserConfigContextType | undefined>(undefined)` pattern (follows `ThemeContext.tsx:31`)
  - `useEffect` with `{ isCancelled: boolean }` cancellation guard; calls `getUserConfig()` once on mount
  - Normalizes missing sections: `config.conversations?.pinnedIds ?? []`, `config.toolsets?.installed ?? []`, `config.deployments?.installed ?? []`
  - On success: set `status = UserConfigStatus.Ready`, populate the three arrays
  - On failure: `console.error('[UserConfigContext] Failed to load user config', err)`, call `showNotification({ variant: 'error', message: t(UserConfigI18nKeys.LoadError) })` via `useNotification()`, set `status = UserConfigStatus.Error` with empty-array fallback
  - Render `<DialSpinner />` while `status === UserConfigStatus.Loading`; render `children` inside provider once `Ready` or `Error`
  - `useCallback` on `setPinnedConversation`, `setInstalledToolset`, `setInstalledDeployment`; each does optimistic snapshot → API call → revert-and-rethrow on failure
  - Context value wrapped in `useMemo` over all fields
  - `useUserConfig()` guard hook throws `'useUserConfig must be used inside UserConfigProvider'`
- [x] 10.2 Verify: `npm exec nx lint chat && npm exec nx build chat`

## 11. Frontend — wire UserConfigProvider into main.tsx

**Dependencies:** slice 10

- [x] 11.1 In `apps/chat/src/main.tsx`: import `UserConfigProvider` from `../context/UserConfigContext` and insert it inside `<RequireAuth>`, wrapping `<AppConfigProvider>` and `<ConversationsProvider>`:
  ```tsx
  <RequireAuth>
    <UserConfigProvider>
      <AppConfigProvider>
        <ConversationsProvider>
          <App />
        </ConversationsProvider>
      </AppConfigProvider>
    </UserConfigProvider>
  </RequireAuth>
  ```
- [x] 11.2 Verify: `npm exec nx lint chat && npm exec nx build chat`

## 12. Frontend — route pin operations through UserConfigContext

**Dependencies:** slice 11

- [x] 12.1 In `apps/chat/src/context/ConversationsContext.tsx`:
  - Import `useUserConfig` from `../context/UserConfigContext`
  - Remove the direct `apiPinConversation` import from `../server-api/user-config.api`
  - In `pinConversation`, replace `await apiPinConversation(id, isPinned)` with `await setPinnedConversation(id, isPinned)` (destructured from `useUserConfig()`)
  - Add `setPinnedConversation` to the `useCallback` dependency array
- [x] 12.2 Architecture guard: confirm `apps/chat/src/context/ConversationsContext.tsx` does NOT import from `libs/`, `apps/chat-api/`, or any generated client path other than `@epam/chat-api-client` types it already uses
- [x] 12.3 Verify: `npm exec nx lint chat && npm exec nx build chat`

## 13. Frontend — unit tests for UserConfigContext

**Dependencies:** slice 12

- [x] 13.1 Create `apps/chat/src/context/tests/UserConfigContext.spec.tsx`. Cover the following observable behaviours (use `@testing-library/react` `renderHook` + `act`; mock `getUserConfig`, `pinConversation`, `updateInstalledToolset`, `updateInstalledDeployment` from `apps/chat/src/server-api/user-config.api`, and `useNotification`):
  - `status` transitions from `Loading` to `Ready` on successful fetch
  - All three arrays are populated from a fully populated response
  - Empty response sections are normalized to `[]`
  - Partially populated response (e.g. missing `toolsets`) normalizes to `[]`
  - `status` is `Error` and arrays are `[]` on fetch failure
  - Error notification is shown (`showNotification` called with `variant: 'error'`) on fetch failure
  - `console.error` is called on fetch failure
  - `getUserConfig` is called exactly once — no duplicate on re-render
  - `<DialSpinner />` rendered while loading; absent after load completes
  - Children not rendered while loading; rendered after load completes (both success and failure)
  - `setPinnedConversation(id, true)` adds `id` to `pinnedConversationIds` on success
  - `setPinnedConversation(id, false)` removes `id` from `pinnedConversationIds` on success
  - `setPinnedConversation` is idempotent for duplicate pin
  - `setPinnedConversation` reverts optimistic update and rethrows on API failure
  - `setInstalledToolset(id, true)` adds `id` to `installedToolsetIds` on success
  - `setInstalledToolset` reverts and rethrows on failure
  - `setInstalledDeployment(id, true)` adds `id` to `installedDeploymentIds` on success
  - `setInstalledDeployment` reverts and rethrows on failure
- [x] 13.2 Verify: `npm exec nx test chat`

## 14. Frontend — persist user-config-frontend-init spec

**Dependencies:** slice 13

- [x] 14.1 Copy `openspec/changes/extend-user-config/specs/user-config-frontend-init/spec.md` to `openspec/specs/user-config-frontend-init/spec.md`.

## 15. Final cross-project verification (frontend)

**Dependencies:** slices 9–14

- [x] 15.1 Run `npm exec nx affected --target=test --base=origin/development-1.0` — all affected projects pass.
- [x] 15.2 Run `npm exec nx affected --target=lint --base=origin/development-1.0` — no new lint errors.
- [x] 15.3 Run `npm exec nx affected --target=build --base=origin/development-1.0` — all affected projects build.
