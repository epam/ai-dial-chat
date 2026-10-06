# file-manager-tab-config Specification

## Purpose

The operator-configurable file-manager tab list, from the config registry through to active-tab correction in the UI.
## Requirements
### Requirement: fileManager.availableTabs config-registry key

`apps/chat-api/src/app-config/config-registry/config-registry.constants.ts` SHALL declare a `fileManager.availableTabs` entry in `CONFIG_DEFINITIONS`: `type: 'config'`, `valueType: 'json'`, `visibility: 'client'`, `defaultValue: ['all', 'my_files', 'shared', 'organization']`, `critical: false`, `envVar: 'FILE_MANAGER_AVAILABLE_TABS'`.

**State ownership**: `AppConfigService`/`CompositeConfigProvider` own resolution. No new NestJS module is introduced; the entry is registered in the existing `AppConfigModule`.

**Caching**: resolved through the existing `/api/v1/client-config` response, cached under the existing `app-config:client:{appId}:user:{userId}:roles:{roles}` key with the existing 60s TTL. No new cache key or TTL is introduced.

#### Scenario: Config definition is registered as client-visible

- **WHEN** `GET /api/v1/client-config?appId=chat-ui` resolves the client config
- **THEN** the `fileManager.availableTabs` definition is included among the resolved `client`-visibility definitions

#### Scenario: Default value lists all first

- **WHEN** the `fileManager.availableTabs` definition is read from `CONFIG_DEFINITIONS`
- **THEN** its `defaultValue` is `['all', 'my_files', 'shared', 'organization']`

---

### Requirement: FILE_MANAGER_AVAILABLE_TABS environment variable

`EnvironmentVariables` (`apps/chat-api/src/config/environment.config.ts`) SHALL declare `FILE_MANAGER_AVAILABLE_TABS?: string[]`, parsed via the same comma-separated-string-to-trimmed-`string[]` `@Transform` already used by `FEATURED_MODEL_IDS`/`HIDDEN_ENTITY_TAGS`/`ASR_ENABLED_ROLES`, defaulting to `[]` when unset.

#### Scenario: Unset env var parses to an empty array

- **WHEN** `FILE_MANAGER_AVAILABLE_TABS` is not set
- **THEN** `EnvironmentVariables.FILE_MANAGER_AVAILABLE_TABS` is `[]`

#### Scenario: Comma-separated value parses to a trimmed array

- **WHEN** `FILE_MANAGER_AVAILABLE_TABS=my_files, organization`
- **THEN** `EnvironmentVariables.FILE_MANAGER_AVAILABLE_TABS` is `['my_files', 'organization']`

---

### Requirement: EnvConfigProvider resolves and validates the tab list

`EnvConfigProvider.resolve` SHALL special-case `key === 'fileManager.availableTabs'`, following the existing inline-branch pattern already used for `features.asrEnabled`/`features.llmConversationNaming`:

- It reads `FILE_MANAGER_AVAILABLE_TABS`. If that is empty or unset, it returns `undefined`, falling through to `StaticDefaultsProvider`'s `defaultValue`.
- Otherwise it filters the array against the allow-list `['all', 'my_files', 'shared', 'organization']`, dropping any other value (including `review`).
- If the filtered result is empty, it returns `undefined` (falling through to the default). Otherwise it returns the filtered array.

#### Scenario: Unset env var falls through to the default four tabs

- **WHEN** `FILE_MANAGER_AVAILABLE_TABS` is unset
- **THEN** `EnvConfigProvider.resolve('fileManager.availableTabs', ...)` returns `undefined`
- **AND** `CompositeConfigProvider` falls through to `StaticDefaultsProvider`, resolving `['all', 'my_files', 'shared', 'organization']`

#### Scenario: Valid subset is honored

- **WHEN** `FILE_MANAGER_AVAILABLE_TABS=my_files,organization`
- **THEN** the resolved value is `['my_files', 'organization']`

#### Scenario: all is an accepted id

- **WHEN** `FILE_MANAGER_AVAILABLE_TABS=all,my_files,shared`
- **THEN** the resolved value is `['all', 'my_files', 'shared']`

#### Scenario: Unknown ids are dropped

- **WHEN** `FILE_MANAGER_AVAILABLE_TABS=my_files,review,bogus`
- **THEN** the resolved value is `['my_files']`, with `review` and `bogus` dropped

#### Scenario: Fully-invalid value falls back to the default

- **WHEN** `FILE_MANAGER_AVAILABLE_TABS=review,bogus` (every entry invalid)
- **THEN** `EnvConfigProvider` returns `undefined`, and the default `['all', 'my_files', 'shared', 'organization']` is used

---

### Requirement: ClientConfigResponseDto exposes fileManagerTabs

`ClientConfigDto` (`apps/chat-api/src/app-config/dto/client-config-response.dto.ts`) SHALL expose `fileManagerTabs!: string[]`, populated during `AppConfigService.getClientConfig` by the `fileManager.availableTabs` → `fileManagerTabs` mapping in `apps/chat-api/src/app-config/client-config.mapper.ts` (`applyClientConfigValue`), which forwards the resolved array and falls back to the mapper's own `DEFAULT_FILE_MANAGER_TABS` when the resolved value is not an array. Its Swagger `example` SHALL be `['all', 'my_files', 'shared', 'organization']`.

#### Generated-client impact

- **operationId**: unchanged (`getClientConfig`). The field's shape is unchanged; only its Swagger example changes, and `npm run openapi` regenerates the artifact.
- **Response DTO**: `ClientConfigDto.fileManagerTabs: string[]`.
- **Frontend caller**: `apps/chat/src/server-api/app-config.api.ts`'s existing `getClientConfig` is unchanged (normal, non-`Raw` method).

**Example response** (`GET /api/v1/client-config?appId=chat-ui`):

```json
{
  "appId": "chat-ui",
  "features": { "asrEnabled": false },
  "config": {
    "asrModelId": null,
    "transcribeSizeLimitBytes": 5242880,
    "defaultDeploymentId": null,
    "fileManagerTabs": ["all", "my_files", "shared", "organization"]
  },
  "metadata": { "resolvedAt": "2026-09-28T00:00:00.000Z", "cacheTtlSeconds": 60 }
}
```

Error codes are unchanged from the existing endpoint.

#### Scenario: Default deployment returns the four-tab default

- **WHEN** `FILE_MANAGER_AVAILABLE_TABS` is unset and `GET /api/v1/client-config?appId=chat-ui` is called
- **THEN** the response's `config.fileManagerTabs` is `["all", "my_files", "shared", "organization"]`

---

### Requirement: AppConfigContext exposes fileManagerTabs

`AppConfigState.config` (`apps/chat/src/context/AppConfigContext.tsx`) SHALL expose `fileManagerTabs: string[]`. `INITIAL_STATE.config.fileManagerTabs` (`DEFAULT_FILE_MANAGER_TABS`) SHALL be `['all', 'my_files', 'shared', 'organization']`, matching the BFF default, so hosts that read it before the config request resolves see the same tab set as a default deployment. `loadConfig` SHALL map `response.config?.fileManagerTabs ?? DEFAULT_FILE_MANAGER_TABS` into state.

**State ownership**: the existing `AppConfigContext`/`useAppConfig` owns this field. No new context is introduced.

**Memoisation**: unchanged. `AppConfigProvider`'s existing `useMemo(() => state, [state])` covers the field.

#### Scenario: Context exposes the default before the config request resolves

- **WHEN** a component reads `useAppConfig().config.fileManagerTabs` while `status === UserConfigStatus.Loading`
- **THEN** the value is `['all', 'my_files', 'shared', 'organization']`

#### Scenario: Context reflects the resolved deployment value once loaded

- **WHEN** `getClientConfig` resolves with `config.fileManagerTabs: ['my_files', 'organization']`
- **THEN** `useAppConfig().config.fileManagerTabs` becomes `['my_files', 'organization']`

---

### Requirement: useDialFileManagerTabConfig hook filters tabs and owns active-tab correction

`libs/chat-hooks/src/files/useDialFileManagerTabConfig/useDialFileManagerTabConfig.ts` (`@epam/ai-dial-chat-hooks`) SHALL export `useDialFileManagerTabConfig(activeTab, onTabChange, allTabs, fileManagerTabs)`, returning `{ tabs }`.

**Tab filtering:**

- A tab id is *enabled* when `fileManagerTabs` is `undefined` or contains it.
- `tabs` is `allTabs` filtered to enabled ids.
- `DialFileManagerTabs.All` is additionally removed unless at least two of `my_files`/`shared`/`organization` are enabled.

**Active-tab correction:** the hook SHALL run a `useEffect` that, whenever `activeTab` is not enabled (by the configured list plus the All rule above), calls `onTabChange` with the first enabled id in the fixed priority `all` → `my_files` → `shared` → `organization` (`TAB_PRIORITY_ORDER`). It falls back to `my_files` when none is enabled.

**State ownership**: the hook owns no persistent state beyond the correction effect. `activeTab` remains owned by the host's `useDialFileManagerTabs` call. The configured list arrives as the `fileManagerTabs` parameter; the hook reads no context. Its callers are `DialFileManagerPage` (passing `useAppConfig().config.fileManagerTabs` directly) and `useFileAttachmentPicker` in `libs/chat-hooks` (passing its `allowedTabs` option, which `DialFileManagerModal` sets from `fileManagerTabs`).

**Memoisation**: `tabs` is `useMemo`'d on `allTabs` and the `isTabEnabled` callback, which is `useCallback`'d on `fileManagerTabs`.

#### Scenario: Default config renders four tabs with All first

- **WHEN** `fileManagerTabs` is `['all', 'my_files', 'shared', 'organization']` (the default) and `allTabs` comes from `useDialFileManagerTabs`
- **THEN** `tabs` is All, My files, Shared, Organization, in that order

#### Scenario: Legacy explicit config without all is unchanged

- **WHEN** `fileManagerTabs` is `['my_files', 'shared', 'organization']`
- **THEN** `tabs` is exactly My files, Shared, Organization, and no All chip is rendered

#### Scenario: All is hidden when only one source tab is enabled

- **WHEN** `fileManagerTabs` is `['all', 'organization']`
- **THEN** `tabs` is Organization only
- **AND** an `activeTab` of `all` is corrected to `organization`

#### Scenario: Narrowed config hides a tab

- **WHEN** `fileManagerTabs` is `['my_files', 'organization']`
- **THEN** no Shared tab is rendered, and `my_files` remains the active tab

#### Scenario: Config excluding my_files corrects the active tab on mount

- **WHEN** `fileManagerTabs` is `['shared', 'organization']` and the host mounts with `activeTab === DialFileManagerTabs.MyFiles`
- **THEN** the effect calls `onTabChange(DialFileManagerTabs.Shared)`

#### Scenario: Active tab is corrected when config arrives after mount with a narrower set

- **WHEN** a host mounts with `activeTab === DialFileManagerTabs.All` while the config is still at its initial default, and the config later resolves to `fileManagerTabs: ['my_files', 'organization']`
- **THEN** All stays rendered (two source tabs are enabled) and no correction fires
- **AND** a later change to `['my_files']` corrects the active tab to `my_files`

#### Scenario: Frontend defensively re-filters against the known tab list

- **WHEN** `fileManagerTabs` includes an id that the deployed frontend's `allTabs` does not recognize
- **THEN** that id is silently ignored, because the filter intersects against `allTabs` first

### Requirement: No ENABLED_FEATURES_ROLES gating

`fileManager.availableTabs` SHALL NOT be gated behind `ENABLED_FEATURES` / `ENABLED_FEATURES_ROLES` — it is a `type: 'config'` (non-boolean) registry entry, and `allowedRolesEnvVar`-based role gating is only supported for `type: 'feature'` entries in the current config-registry type system. Visibility of the resolved tab list is deployment-wide, not per-role, in this change.

#### Scenario: Tab configuration applies uniformly regardless of caller roles

- **WHEN** two users with different roles both call `GET /api/v1/client-config?appId=chat-ui` against the same deployment
- **THEN** both receive the identical `config.fileManagerTabs` value

---

### Requirement: File-level sharedWithMe/publishedWithMe filters are explicitly waived

This capability SHALL NOT implement client-side or BFF-side filtering of individual files by a `sharedWithMe`/`publishedWithMe` provenance flag. `ListFilesItemDto` and the generated `ListFilesItemDto` carry no such fields today. This is not a DIAL Core limitation — `apps/chat-api/src/conversations/listing/conversation-listing.service.ts` already implements the equivalent merge-and-flag pattern for conversations — but porting it to files would require introducing a combined, cross-tab listing capability that does not exist in the current per-tab-endpoint file-manager architecture (see design.md D4/Open Questions). This waiver applies only to per-item provenance flags; tab-scoped listing (each tab already fetching from its own bucket/endpoint per `file-manager-tabs`) is unaffected and continues to work as already specified.

#### Scenario: No per-file provenance field is introduced

- **WHEN** the file listing endpoints (`/list`, `/shared`, `/shared-by-me`, organization listing) are inspected
- **THEN** none of their response DTOs carry a `sharedWithMe` or `publishedWithMe` field on individual file items

