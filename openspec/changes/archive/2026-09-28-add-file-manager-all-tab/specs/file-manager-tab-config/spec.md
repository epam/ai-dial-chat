## MODIFIED Requirements

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

`ClientConfigDto` (`apps/chat-api/src/app-config/dto/client-config-response.dto.ts`) SHALL expose `fileManagerTabs!: string[]`, populated by `AppConfigService.getClientConfig` from the resolved `fileManager.availableTabs` value. Its Swagger `example` SHALL be `['all', 'my_files', 'shared', 'organization']`.

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

**Active-tab correction:** the hook SHALL run a `useEffect` that, whenever `activeTab` is not among the rendered `tabs`, calls `onTabChange` with the first rendered id in the fixed priority `all` → `my_files` → `shared` → `organization`. It falls back to `my_files` when none is rendered.

**State ownership**: the hook owns no persistent state beyond the correction effect. `activeTab` remains owned by the host's `useDialFileManagerTabs` call. The configured list arrives as the `fileManagerTabs` parameter; the hook reads no context.

**Memoisation**: `tabs` is `useMemo`'d on `allTabs` and `fileManagerTabs`.

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
