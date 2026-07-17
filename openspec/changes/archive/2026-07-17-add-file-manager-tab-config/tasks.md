## 1. Backend: env var and config-registry definition

- [x] 1.1 Add `FILE_MANAGER_AVAILABLE_TABS?: string[]` to `apps/chat-api/src/config/environment.config.ts`, using the existing CSV-to-trimmed-`string[]` `@Transform` pattern already used by `FEATURED_MODEL_IDS`/`HIDDEN_ENTITY_TAGS`/`ASR_ENABLED_ROLES`, defaulting to `[]`.
- [x] 1.2 Add the `fileManager.availableTabs` entry to `CONFIG_DEFINITIONS` (`apps/chat-api/src/app-config/config-registry/config-registry.constants.ts`): `type: 'config'`, `valueType: 'json'`, `visibility: 'client'`, `defaultValue: ['my_files', 'shared', 'organization']`, `envVar: 'FILE_MANAGER_AVAILABLE_TABS'`.
- [x] 1.3 Add an inline special-cased branch for `key === 'fileManager.availableTabs'` in `EnvConfigProvider.resolve` (`apps/chat-api/src/app-config/config-registry/env-config.provider.ts`), following the existing `features.asrEnabled`/`features.llmConversationNaming` pattern: read the env var, return `undefined` if empty, filter against the allow-list `['my_files', 'shared', 'organization']`, return `undefined` if the filtered result is empty, otherwise return the filtered array.

## 2. Backend: expose fileManagerTabs on client-config

- [x] 2.1 Add `fileManagerTabs!: string[]` to `ClientConfigDto` (`apps/chat-api/src/app-config/dto/client-config-response.dto.ts`) with `@ApiProperty`.
- [x] 2.2 In `AppConfigService.getClientConfig`, add a branch mapping the resolved `fileManager.availableTabs` value into `config.fileManagerTabs` (defaulting to `['my_files', 'shared', 'organization']` when the resolved value is not an array).

## 3. Generated client

- [x] 3.1 Run `npm run openapi` and `npm run openapi:check` to regenerate `libs/chat-api-client/openapi.json` with the new `ClientConfigDto.fileManagerTabs` field.
- [x] 3.2 Build and lint `chat-api-client`.

## 4. Frontend: AppConfigContext

- [x] 4.1 Add `fileManagerTabs: string[]` to `AppConfigState.config` (`apps/chat/src/context/AppConfigContext.tsx`), with `INITIAL_STATE.config.fileManagerTabs = ['my_files', 'shared', 'organization']`.
- [x] 4.2 In `loadConfig`, map `response.config?.fileManagerTabs ?? ['my_files', 'shared', 'organization']` into state.

## 5. Frontend: useDialFileManagerTabConfig hook

- [x] 5.1 Create `apps/chat/src/hooks/files/useDialFileManagerTabConfig.ts` — one hook per file, JSDoc explaining WHY it owns both the tab filter and the active-tab-reset side effect (both hosts need identical behavior, keeping it in one place avoids duplicated `useEffect` logic per design.md D3). Define the fixed priority order (`my_files` → `shared` → `organization`) as a module-level constant, reused by both the tab filter and the reset fallback.
- [x] 5.2 Implement `tabs = allTabs?.filter((tab) => fileManagerTabs.includes(tab.id))` sourced from `useAppConfig().config.fileManagerTabs`.
- [x] 5.3 Implement the correction `useEffect`: when `activeTab` is not in `fileManagerTabs`, call `onTabChange` with the first id in the priority order present in `fileManagerTabs`, falling back to `my_files`.

## 6. Frontend: both hosts consume the hook

- [x] 6.1 In `apps/chat/src/components/DialFileManagerModal/DialFileManagerModal.tsx`, replace `tabs = allTabs?.filter((tab) => tab.id !== DialFileManagerTabs.Review)` with `const { tabs } = useDialFileManagerTabConfig(activeTab, handleTabChange, allTabs)`.
- [x] 6.2 Apply the identical change in `apps/chat/src/pages/DialFileManagerPage/DialFileManagerPage.tsx`.

## 7. Unit tests

- [x] 7.1 Backend: extend `apps/chat-api/src/app-config/tests/app-config.service.spec.ts` and add coverage for `EnvConfigProvider`'s new branch: unset env var → default three tabs; valid subset honored; unknown ids dropped; fully-invalid value falls back to default.
- [x] 7.2 Frontend: extend `apps/chat/src/context/tests/AppConfigContext.spec.tsx` for the new `fileManagerTabs` field (initial default, loaded value).
- [x] 7.3 Frontend: add `apps/chat/src/hooks/files/tests/useDialFileManagerTabConfig.spec.ts` covering: default config preserves the 3-tab set with no reset firing; narrowed config hides a tab; active tab resets on mount when `my_files` is excluded; active tab resets when config arrives after mount with a narrower set that excludes the currently-active tab; unrecognized ids from config are ignored when intersected against `allTabs`.
- [x] 7.4 Frontend: extend `DialFileManagerModal`/`DialFileManagerPage` tests to assert both hosts render the config-filtered tab set via the shared hook (not a host-local filter).
- [x] 7.5 Test names describe observable behavior, not implementation details; use role/label/text queries.

## 8. i18n and docs

- [x] 8.1 No new i18n keys are introduced (existing `dialFileManager.tab.myFiles`/`shared`/`organization` keys are reused unchanged).
- [x] 8.2 No `docs/ENABLED_FEATURES_ROLES.md` or deployment-configuration doc enumerating client-config keys exists in this repo; added `FILE_MANAGER_AVAILABLE_TABS` to `apps/chat-api/.env.template` and the env var table in `apps/chat-api/README.md` instead, matching how `FEATURED_MODEL_IDS`/`ALLOWED_IFRAME_ORIGINS` are documented.

## 9. RTL

- [x] 9.1 Confirm no new UI/layout is introduced (tab filtering is a data-level change; ui-kit already owns tab rendering/RTL per the existing `file-manager-tabs` spec) — no new RTL-specific task is required.

## 10. Verification

- [x] 10.1 Run `npm exec nx test chat-api` and `npm exec nx test chat` for the touched projects.
- [x] 10.2 Run `npm exec nx lint chat-api` and `npm exec nx lint chat`.
- [x] 10.3 Run `npm exec nx build chat-api` (env var + DTO changes affect Nest startup/Swagger).
- [x] 10.4 Close with `npm exec nx affected --target=test --base=origin/development-1.0` and `npm exec nx affected --target=lint --base=origin/development-1.0`.
