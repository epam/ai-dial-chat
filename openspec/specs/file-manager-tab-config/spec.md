# file-manager-tab-config Specification

## Purpose

The operator-configurable file-manager tab list, from the config registry through to active-tab correction in the UI.

## Requirements

### Requirement: fileManager.availableTabs config-registry key

`apps/chat-api/src/app-config/config-registry/config-registry.constants.ts` SHALL declare a `fileManager.availableTabs` entry in `CONFIG_DEFINITIONS`: `type: 'config'`, `valueType: 'json'`, `visibility: 'client'`, `defaultValue: ['my_files', 'shared', 'organization']`, `critical: false`, `envVar: 'FILE_MANAGER_AVAILABLE_TABS'`.

**State ownership**: `AppConfigService`/`CompositeConfigProvider` own resolution; no new NestJS module is introduced (registered in the existing `AppConfigModule`).

**Caching**: resolved through the existing `/api/v1/client-config` response, cached under the existing `app-config:client:{appId}:user:{userId}:roles:{roles}` key with the existing 60s TTL — no new cache key or TTL is introduced.

#### Scenario: Config definition is registered as client-visible

- **WHEN** `GET /api/v1/client-config?appId=chat-ui` resolves the client config
- **THEN** the `fileManager.availableTabs` definition is included among the resolved `client`-visibility definitions

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

`EnvConfigProvider.resolve` SHALL special-case `key === 'fileManager.availableTabs'` (following the existing inline-branch pattern already used for `features.asrEnabled`/`features.llmConversationNaming`): read `FILE_MANAGER_AVAILABLE_TABS`; if empty or unset, return `undefined` (falling through to `StaticDefaultsProvider`'s `defaultValue`); otherwise filter the array against the allow-list `['my_files', 'shared', 'organization']`, dropping any other value (including `review`); if the filtered result is empty, return `undefined` (fall through to the default); otherwise return the filtered array.

#### Scenario: Unset env var falls through to the default three tabs

- **WHEN** `FILE_MANAGER_AVAILABLE_TABS` is unset
- **THEN** `EnvConfigProvider.resolve('fileManager.availableTabs', ...)` returns `undefined`, and `CompositeConfigProvider` falls through to `StaticDefaultsProvider`, resolving `['my_files', 'shared', 'organization']`

#### Scenario: Valid subset is honored

- **WHEN** `FILE_MANAGER_AVAILABLE_TABS=my_files,organization`
- **THEN** the resolved value is `['my_files', 'organization']`

#### Scenario: Unknown ids are dropped

- **WHEN** `FILE_MANAGER_AVAILABLE_TABS=my_files,review,bogus`
- **THEN** the resolved value is `['my_files']` — `review` and `bogus` are dropped

#### Scenario: Fully-invalid value falls back to the default

- **WHEN** `FILE_MANAGER_AVAILABLE_TABS=review,bogus` (every entry invalid)
- **THEN** `EnvConfigProvider` returns `undefined`, and the default `['my_files', 'shared', 'organization']` is used

---

### Requirement: ClientConfigResponseDto exposes fileManagerTabs

`ClientConfigDto` (`apps/chat-api/src/app-config/dto/client-config-response.dto.ts`) SHALL gain `fileManagerTabs!: string[]`, populated by `AppConfigService.getClientConfig` from the resolved `fileManager.availableTabs` value.

#### Generated-client impact

- **operationId**: unchanged (`getClientConfig` already exists) — the response DTO gains one field, no new SDK method.
- **Response DTO**: `ClientConfigDto.fileManagerTabs: string[]`.
- **Frontend caller**: `apps/chat/src/server-api/app-config.api.ts`'s existing `getClientConfig` is unchanged; the new field flows through automatically once the generated client is rebuilt.

**Example response** (`GET /api/v1/client-config?appId=chat-ui`):
```json
{
  "appId": "chat-ui",
  "features": { "asrEnabled": false },
  "config": {
    "asrModelId": null,
    "transcribeSizeLimitBytes": 5242880,
    "defaultDeploymentId": null,
    "fileManagerTabs": ["my_files", "shared", "organization"]
  },
  "metadata": { "resolvedAt": "2026-07-15T00:00:00.000Z", "cacheTtlSeconds": 60 }
}
```

#### Scenario: Default deployment returns the three-tab default

- **WHEN** `FILE_MANAGER_AVAILABLE_TABS` is unset and `GET /api/v1/client-config?appId=chat-ui` is called
- **THEN** the response's `config.fileManagerTabs` is `["my_files", "shared", "organization"]`

---

### Requirement: AppConfigContext exposes fileManagerTabs

`AppConfigState.config` (`apps/chat/src/context/AppConfigContext.tsx`) SHALL gain `fileManagerTabs: string[]`. `INITIAL_STATE.config.fileManagerTabs` SHALL be `['my_files', 'shared', 'organization']` (matching the BFF default), so hosts reading it before the config request resolves see the same tab set as today's hardcoded behavior rather than an empty array. `loadConfig` SHALL map `response.config?.fileManagerTabs ?? ['my_files', 'shared', 'organization']` into state.

**State ownership**: `AppConfigContext`/`useAppConfig` (existing context) owns this field; no new context is introduced.

**Memoisation**: unchanged — `AppConfigProvider`'s existing `useMemo(() => state, [state])` covers the new field since it is part of `state.config`.

#### Scenario: Context exposes the default before the config request resolves

- **WHEN** a component reads `useAppConfig().config.fileManagerTabs` while `status === UserConfigStatus.Loading`
- **THEN** the value is `['my_files', 'shared', 'organization']`

#### Scenario: Context reflects the resolved deployment value once loaded

- **WHEN** `getClientConfig` resolves with `config.fileManagerTabs: ['my_files', 'organization']`
- **THEN** `useAppConfig().config.fileManagerTabs` becomes `['my_files', 'organization']`

---

### Requirement: useDialFileManagerTabConfig hook filters tabs and owns active-tab correction

`apps/chat/src/hooks/files/useDialFileManagerTabConfig.ts` SHALL export `useDialFileManagerTabConfig(activeTab: DialFileManagerTabs, onTabChange: (tab: DialFileManagerTabs) => void, allTabs: ToolbarOptions['tabs'])`, returning `{ tabs: ToolbarOptions['tabs'] }` where `tabs = allTabs?.filter((tab) => fileManagerTabs.includes(tab.id))` and `fileManagerTabs` is read from `useAppConfig().config.fileManagerTabs`.

The hook SHALL run a `useEffect` (dependencies: `fileManagerTabs`, `activeTab`, `onTabChange`) that, whenever `activeTab` is not present in `fileManagerTabs`, calls `onTabChange` with the first id present in `fileManagerTabs` following the fixed priority `my_files` → `shared` → `organization`, falling back to `my_files` if `fileManagerTabs` is empty.

**State ownership**: the hook owns no persistent state of its own beyond the `useEffect`'s correction side-effect; `activeTab` itself remains owned by whichever `useDialFileManagerTabs` call the host already has.

`DialFileManagerModal` and `DialFileManagerPage` SHALL both replace their hardcoded `tabs = allTabs?.filter((tab) => tab.id !== DialFileManagerTabs.Review)` with a call to this hook.

#### Scenario: Default config preserves today's exact tab set

- **WHEN** `fileManagerTabs` is `['my_files', 'shared', 'organization']` (the default)
- **THEN** both hosts render exactly the same three tabs as before this change, with `my_files` as the initial tab, and the correction effect never fires (`activeTab` is already present in `fileManagerTabs`)

#### Scenario: Narrowed config hides a tab

- **WHEN** `fileManagerTabs` is `['my_files', 'organization']`
- **THEN** neither host renders a Shared tab, and `my_files` remains the active tab

#### Scenario: Config excluding my_files corrects the active tab on mount

- **WHEN** `fileManagerTabs` is `['shared', 'organization']` (no `my_files`) and the host mounts with `activeTab` defaulted to `DialFileManagerTabs.MyFiles`
- **THEN** the hook's effect calls `onTabChange(DialFileManagerTabs.Shared)` (first match in priority order)

#### Scenario: Active tab is corrected when config arrives after mount with a narrower set

- **WHEN** a host mounts with `activeTab === DialFileManagerTabs.Shared` while `useAppConfig()` is still in its initial state (`fileManagerTabs` defaulting to all three tabs), and the config request later resolves to `fileManagerTabs: ['my_files', 'organization']` (Shared excluded)
- **THEN** the hook's effect fires once the resolved value changes, correcting the active tab to `my_files`

#### Scenario: Frontend defensively re-filters against ui-kit's known tab list

- **WHEN** `fileManagerTabs` (from a possibly-newer BFF) includes an id the deployed frontend's `allTabs` (ui-kit) does not recognize
- **THEN** that id is silently ignored when building the rendered `tabs` array, since the filter intersects against `allTabs` first

---

### Requirement: No ENABLED_FEATURES_ROLES gating

`fileManager.availableTabs` SHALL NOT be gated behind `ENABLED_FEATURES` / `ENABLED_FEATURES_ROLES` — it is a `type: 'config'` (non-boolean) registry entry, and `allowedRolesEnvVar`-based role gating is only supported for `type: 'feature'` entries in the current config-registry type system. Visibility of the resolved tab list is deployment-wide, not per-role, in this change.

#### Scenario: Tab configuration applies uniformly regardless of caller roles

- **WHEN** two users with different roles both call `GET /api/v1/client-config?appId=chat-ui` against the same deployment
- **THEN** both receive the identical `config.fileManagerTabs` value

---

### Requirement: File-level sharedWithMe/publishedWithMe filters are explicitly waived

This capability SHALL NOT implement client-side or BFF-side filtering of individual files by a `sharedWithMe`/`publishedWithMe` provenance flag. `ListFilesItemDto` and the generated `ListFilesItemDto` carry no such fields today. This is not a DIAL Core limitation — `apps/chat-api/src/conversations/listing/conversation-listing.service.ts` already implements the equivalent merge-and-flag pattern for conversations — but porting it to files would require introducing a combined, cross-tab listing capability that does not exist in the current per-tab-endpoint file-manager architecture (see design.md D4/Open Questions). This waiver applies only to per-item provenance flags; tab-scoped listing (each tab already fetching from its own bucket/endpoint per `file-manager-tabs`) is unaffected and continues to work as already specified.

#### Scenario: No per-file provenance field is introduced

- **WHEN** the file listing endpoints (`/list`, `/shared`, `/shared-by-me`, organization listing) are inspected after this change
- **THEN** none of their response DTOs carry a `sharedWithMe` or `publishedWithMe` field on individual file items
