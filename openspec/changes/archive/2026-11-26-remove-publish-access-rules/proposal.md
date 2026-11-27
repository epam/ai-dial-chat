## Why

The publish flows carry a full publication access-rules feature — the "Allow access if all match" editor, a folder-rules pre-fill lookup, a `rules` field on both publish endpoints, and a `PUBLICATION_FILTER_SOURCES`-driven source list — that the product no longer wants to expose in DIAL Chat. Keeping it costs a large surface across one backend domain, three publish hosts, two feature libs, `chat-hooks`, the generated client, i18n and eleven specs. This change removes the feature end to end.

## What Changes

- **BREAKING (UI):** The access-rules section disappears from every publish surface: the catalog details Publish view (applications, toolsets, prompts, skills), the conversation and project publish panels, and the Change-folder view of the resource Save panel for Organization destinations.
- **BREAKING (lib API, `@epam/ai-dial-publish-panel`):** remove `PublishAccessRules`, `PublishAccessRuleEditor`, `PublicationRule`, `PublicationRuleFunction`, their `*Props`/`*Labels`/`*Colors`/`*Styles` types, `PublishPanelProps.rules`/`onRulesChange`/`ruleSourceOptions`/`accessRulesLabels`/`styles.accessRules`, the same props on `StandalonePublishPanel`, `SaveToFolderAccessRulesProps` (`StandaloneSaveToFolderPanel.accessRules`) and `FolderDestinationRoot.hasAccessRules`. `usePublishFlow` loses `onFetchExistingRules`, `rules`, `setRules`, `isRulesLoading`, `hasRulesLoadError`, and `onPublish` becomes `(item, folderPath, author, publishCredentials)` — the `rules` positional argument is dropped.
- **BREAKING (lib API, `@epam/ai-dial-catalog`):** remove `CatalogProps.ruleSourceOptions`, `hidePublishAccessRules`, `onFetchExistingRules` and their `DetailsPanel`/`DetailsPublishContent` threading.
- **`@epam/ai-dial-chat-hooks`:** `useResourceSavePanel`, `runResourceSave` and `createPublishApi` stop owning, fetching and sending rules; the e2e fixture drops the rules route.
- **BREAKING (HTTP):** remove `GET /api/v1/publish/rules` (`PublishRulesController`, `PublishRulesService`, `GetPublishRulesQueryDto`, `PublishRulesResultDto`) and the `rules` field (`PublishRuleDto`, `PublishRuleFunction`) from `POST /api/v1/publish` and `POST /api/v1/conversations/publish`. With the global `forbidNonWhitelisted` pipe a stale client that still sends `rules` gets 400; the SPA and the BFF ship together, so no in-repo caller is affected.
- Publish requests to DIAL Core **omit** `rules` instead of sending `rules: []` (see design D2), so a folder's existing Core rules are left untouched rather than replaced.
- **BREAKING (config):** remove `PUBLICATION_FILTER_SOURCES`, the `publish.publicationFilterSources` registry key, its admission, and `config.publicationFilterSources` from `GET /api/v1/client-config` and `AppConfigContext`.
- Regenerate `@epam/ai-dial-chat-api-client` (`getPublishRules` op and rule/filter-source models disappear).
- Remove the app wrapper `apps/chat/src/server-api/publish-rules.api.ts`, `getAccessRulesLabels` in `apps/chat/src/utils/publish.ts`, `PublishAccessRulesI18nKeys` and the `publishAccessRules.*` strings in every locale.
- Update READMEs (`publish-panel`, `catalog`, `chat-hooks`, `apps/chat-api`), `docs/architecture.md`, `docs/legacy-chat-migration-guide.md` and `docs/host-install-matrix.md` if regenerated.

Non-goals: changing who may publish, the publish request/approval flow, publish history, author, credentials, dependencies, direct org-unit writes, or deleting rules already stored on DIAL Core folders. Admins keep managing folder rules in DIAL Core / DIAL Admin.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `publish-access-rules-editor`: every requirement removed (capability retired).
- `publish-rules-lookup-api`: the rules-lookup endpoint requirement removed (capability retired).
- `catalog-publish-api`: the access-rules request requirement is removed; the publish request and Core payload carry no `rules`.
- `conversation-publish-api`: the conversation publish request and Core payload carry no `rules`.
- `catalog-publish-flow`: the rules-editor wiring and pre-fill requirements are removed; author, Save-panel dependency and direct-write requirements no longer mention rules.
- `conversation-publish-flow`: the rules-editor wiring and pre-fill requirements are removed; the author requirement no longer references rules.
- `publish-panel-library`: the public surface, `usePublishFlow` options/result/`onPublish` signature, author/credentials/dependencies placement, save-to-folder panel and direct-write requirements drop rules.
- `resource-save-panel`: the Save panel state and the Organization save-then-publish sequencing carry no rules.
- `client-config-endpoint`: `publicationFilterSources` is removed from the response and `AppConfigContext`; the assembly-order scenario and the example response drop it.
- `project-view-ui`: the project publish container no longer uses `getPublishRules`.
- `config-registry-and-env-provider`: the `publish.publicationFilterSources` registry requirement is removed.
- `managed-config-contract`: the local-only key list and the reclassification scenarios drop `publish.publicationFilterSources`.
- `org-units-folder-permissions`: direct writes into a unit no longer mention hiding an access-rules editor.

## Impact

- **Backend (`apps/chat-api`)**: `src/publish/` (controller, service, module, DTOs, tests), `src/conversations/` publish service/DTO/tests, `src/app-config/` (mapper, registry, env provider, admission, response DTO, fixtures), `src/config/env/client-ui.env.ts` and its composition snapshot; OpenAPI regenerated.
- **Frontend (`apps/chat`)**: `CatalogView`, `PublishConversationPanelContainer`, `PublishProjectPanelContainer`, `ResourceSavePanelContainer`, `useCatalogPublishing`, `AppConfigContext`, `server-api/publish-rules.api.ts`, `conversation-publish.api.ts`, `utils/publish.ts`, i18n keys and locales, and their tests.
- **Libs**: `publish-panel` (components, models, `use-publish-flow`, `index.ts`, styles), `catalog` (props threading), `chat-hooks` (resource save, publish API, e2e fixture), `chat-api-client` (regenerated only).
- **Isolation**: the change only removes props and callbacks; no new host knowledge enters a lib. Every lib still receives behaviour through props.
- **i18n**: no new strings; the `publishAccessRules.*` keys are deleted from every locale.
- **Rollback**: a plain `git revert` restores the feature; no data migration. DIAL Core rules stay intact because publish now omits `rules`.
- **Scope note**: touches shared libs (`publish-panel`, `catalog`, `chat-hooks`) and a global provider (`AppConfigContext`) — removals only.
