# chat-hooks-domain-utilities Specification

## Purpose

The bulk of `apps/chat/src/utils/`'s remaining pure and mostly-pure domain
utilities — conversation/message helpers, DIAL-file path/URL parsing,
attachment-display mapping, catalog entity/prompt/scheduled-task/skill
DTO-to-UI mapping, and locale/formatting/string helpers — published from
`@epam/ai-dial-chat-hooks`, with every host-owned i18n/URL/context piece
injected as a parameter rather than imported.

## Requirements

### Requirement: Fully pure `apps/chat/src/utils/` files publish unchanged from `@epam/ai-dial-chat-hooks`

Every file among `announcement-message.ts`, `application-schema.ts`, `browser-timezone.ts`, `cron-weekday.ts`, `custom-apps.ts`, `deployment-endpoint-url.ts`, `deployment-id.ts`, `display-name-watch.ts`, `export-prompt.ts`, `external-services.ts`, `file-name.ts`, `file-path.ts`, `footer-message.ts`, `formatting.ts`, `greeting.ts`, `map-deployment-limits-to-input.ts`, `mcp-endpoint-url.ts`, `message-factory.ts`, `message-utils.ts`, `overlay-messages.ts`, `quick-app-conversation-starters.ts`, `scheduled-task-trigger.ts`, `skill-file-preview.ts`, `skill.ts`, `starter-option.ts`, and `string-utils.ts` — none of which import any host-owned module (`../server-api/*`, `../context/*`, `../constants/routes`, `../i18n/*`, `../constants/translation-keys`) or touch `localStorage`, cookies, or a literal `/api/...` path — SHALL be exported from `@epam/ai-dial-chat-hooks` with their exact current algorithm and signatures, requiring zero injected parameters.

#### Scenario: Every exported function keeps its current behavior
- **WHEN** any of the listed files' exported functions is called with the same arguments it was called with before the move
- **THEN** it returns the exact same result, with no behavior change

#### Scenario: No host-owned import is introduced
- **WHEN** the moved module is inspected inside `libs/chat-hooks/src/**`
- **THEN** it imports nothing from `apps/chat/src/**`, no `ApiEndpoints`, no `react-i18next`, and touches no browser storage API

### Requirement: `PromptFieldError` moves alongside `prompt.ts`'s validators

`@epam/ai-dial-chat-hooks` SHALL export `PromptFieldError` (the enum currently declared in `apps/chat/src/types/prompt.ts`) alongside `validatePromptName`, `validatePromptDescription`, `validatePromptContent`, `getRemainingCharacters`, and `buildPromptPath`, since these validators have no dependency other than that enum. `apps/chat/src/types/prompt.ts` SHALL re-export `PromptFieldError` from `@epam/ai-dial-chat-hooks` for its own other consumers.

#### Scenario: Validators resolve the same enum instance
- **WHEN** `apps/chat/src/pages/PromptEditor/PromptEditor.tsx` compares a validator's return value against `PromptFieldError` imported from `apps/chat/src/types/prompt.ts`
- **THEN** the comparison succeeds, because both resolve to the same `@epam/ai-dial-chat-hooks`-exported enum

### Requirement: `dial-file.ts`'s pure DIAL resource-path parsing is a public export; host-owned URL building stays app-owned

`@epam/ai-dial-chat-hooks` SHALL export `isDialFileId`, `resolveRelativeDialFilePath`, and `resolveDialFileBucketAndPath` with their exact current parsing behavior. `resolveDialFileDownloadUrl` and `resolveDialUrl` (which hardcode the `/api/v1/files/download` BFF path) SHALL remain in `apps/chat/src/utils/dial-file.ts`, which SHALL import the three pure functions from `@epam/ai-dial-chat-hooks` and continue re-exporting them under their current names so every existing `apps/chat` consumer's import path is unaffected.

#### Scenario: `apps/chat` consumers see no import-path change
- **WHEN** `apps/chat/src/utils/icon-path.ts` or any other current consumer imports `isDialFileId`/`resolveRelativeDialFilePath` from `../utils/dial-file` (or `./dial-file`)
- **THEN** the import continues to resolve successfully, now to a re-export of the `@epam/ai-dial-chat-hooks` implementation

#### Scenario: `useAttachmentAction` consolidates onto the shared implementation
- **WHEN** `libs/chat-hooks/src/attachment/useAttachmentAction/useAttachmentAction.ts` is inspected after this change
- **THEN** it imports `isDialFileId` from the new shared module instead of keeping its own private duplicate

### Requirement: Attachment-display mapping takes its resolvers as an explicit parameter

`@epam/ai-dial-chat-hooks` SHALL export `attachmentDtoToDisplayAttachment(dto, resolvers: AttachmentDisplayResolvers)`, `attachmentDtosToDisplayAttachments(dtos, resolvers)`, and `annotationToDisplayAttachment(annotation)` (fully pure, no resolvers needed), reproducing `apps/chat/src/utils/attachment-dto-to-display.ts`'s current mapping exactly. `apps/chat` SHALL supply `{ resolvePreviewUrl: (dto) => resolveCatalogIconUrl(dto.url), resolvePlayUrl: (dto) => dto.url && resolveDialFileDownloadUrl(dto.url) }` at its call site.

#### Scenario: Resolvers are invoked with the same arguments as before
- **WHEN** `attachmentDtoToDisplayAttachment` is called with a resolvers object
- **THEN** `resolvePreviewUrl`/`resolvePlayUrl` are invoked with exactly the arguments the pre-move `attachmentDisplayResolvers` closure received

### Requirement: Attachment-canvas content resolution takes DIAL-URL resolution as an injected parameter

`@epam/ai-dial-chat-hooks` SHALL export `apps/chat/src/utils/attachment-canvas.ts`'s content-resolution functions (blob/text fetch with caching, PDF/Image/HTML/JSON/Visualizer content builders, `getUrlFileName`, `isExternalSourcePreviewable`, `clearAttachmentCache`), taking an injected `resolvers: AttachmentCanvasUrlResolvers` parameter (`resolveDialFileDownloadUrl`, `resolveDialUrl`) in place of the host-owned pieces of `./dial-file` those functions read today. `isDialFileId` is already a pure export of the moved `dial-file.ts` module, so it is imported directly rather than injected. `apps/chat` SHALL supply `resolveDialFileDownloadUrl`/`resolveDialUrl` from its own `dial-file.ts` at its call site.

#### Scenario: Caching behavior is unaffected by the injected parameter
- **WHEN** the same attachment is resolved twice with the same injected resolvers
- **THEN** the second resolution is served from the existing LRU cache, matching pre-move behavior

### Requirement: Locale utilities move; `PRIMARY_LOCALE` and the one i18n-touching function stay app-owned

`@epam/ai-dial-chat-hooks` SHALL export `toBaseLocale`, `appendLocaleCode`, `composeLocalePayload`, `decomposeLocalizedFields`, and `buildAdditionalLocaleOptions` from `apps/chat/src/utils/locale.ts`. `resolveLocalizedText` SHALL be exported with an additional required `primaryLocale: string` parameter (in place of the module-level `PRIMARY_LOCALE` constant it read internally), and `buildAdditionalLocaleOptions` SHALL take `additionalLocaleCodes: string[]` and `primaryLocale: string` as explicit parameters in place of the module-level `ADDITIONAL_CONTENT_LOCALE_CODES`/`PRIMARY_LOCALE` constants it read internally. `PRIMARY_LOCALE` (derived from the host-owned `SUPPORTED_LANGUAGES`/`useLanguage` hook, which libs must not import per the no-i18n-in-libs rule) and `buildLocaleFieldLabels` (the only export that calls `t()`) SHALL remain in `apps/chat/src/utils/locale.ts`, which SHALL re-export `resolveLocalizedText`/`buildAdditionalLocaleOptions` as thin wrappers that supply `PRIMARY_LOCALE` (and, for the latter, `ADDITIONAL_CONTENT_LOCALE_CODES`) automatically, so every existing 2-arg/0-arg app call site is unchanged.

#### Scenario: Every non-i18n locale consumer resolves the moved export with unchanged behavior
- **WHEN** `apps/chat/src/components/ConversationPanel/ConversationPanelView.tsx` (or any of the other current consumers) calls `resolveLocalizedText(value, activeLocale)` via the app-owned wrapper in `apps/chat/src/utils/locale.ts`
- **THEN** it resolves through `@epam/ai-dial-chat-hooks`'s `resolveLocalizedText(value, activeLocale, PRIMARY_LOCALE)` with identical behavior to the pre-move implementation

### Requirement: Catalog entity/prompt/skill mapping utilities inject their i18n label resolution

`@epam/ai-dial-chat-hooks` SHALL export `mapDeploymentToCatalogItem`, `mapToolsetToCatalogItem`, `mapPromptToCatalogItem`, `mapSkillToCatalogItem`, and their pure helper functions (`resolveSkillManifestFileId`, `resolveSkillFileDownloadPath`, `buildSkillContentTree`, `readSkillFileBytes`, `readSkillManifest`, etc.) from `map-deployment-to-catalog-item.ts`, `map-prompt-to-catalog-item.ts`, and `map-skill-to-catalog-item.ts`, with each function's `t()`-derived folder/overview label resolution replaced by explicit `folderLabels: DeploymentFolderLabels` / `overviewLabels: PromptOverviewLabels` / `overviewLabels: SkillOverviewLabels` parameters instead of importing `../constants/translation-keys` directly. `map-deployment-to-catalog-item.ts`'s own `mapToolsetCredentials` (operating on `DialToolsetAuthSettingsDto`) SHALL be renamed to `mapDeploymentToolsetCredentials` on the move, since `map-entity-details-to-catalog.ts` already exports a same-named, differently-shaped function (operating on `ToolsetEntityDetails`) — an `export *` barrel cannot re-export two functions under the same name. `map-entity-details-to-catalog.ts`'s `mapEntityDetailsToCatalogDetails`/`mapDeploymentDetailsDtoToEntityDetails` SHALL drop the `CatalogI18nKeys` import and the `t` parameter entirely — every label already had a hardcoded English fallback, so no seam is needed. `isPublicToolsetId` (currently imported from the host-owned `apps/chat/src/utils/toolsets.ts`) SHALL become a private, non-exported duplicate inside each moved module that needs it, matching the established pattern of not widening an unrelated host file's export surface for one small pure helper. Each mapper's companion pure type file (`apps/chat/src/types/entity-details.ts`, `apps/chat/src/types/prompt.ts`'s `PromptSource`/resource-URL helpers, `apps/chat/src/types/skill.ts`'s `SkillSource`/constants/resource-URL helpers) SHALL move alongside it into `libs/chat-hooks/src/catalog/entity-details.ts`, `libs/chat-hooks/src/prompt/prompt-resource.ts`, and `libs/chat-hooks/src/skill/skill-types.ts` respectively, since the lib cannot import types back from the app; each app types file SHALL re-export from `@epam/ai-dial-chat-hooks` for its other existing consumers.

#### Scenario: Folder/overview-label resolution is behavior-preserving with the injected seam
- **WHEN** `mapDeploymentToCatalogItem`/`mapToolsetToCatalogItem`/`mapPromptToCatalogItem`/`mapSkillToCatalogItem` are called with the same pre-resolved label objects the pre-move `t()` calls would have produced
- **THEN** the returned catalog item is identical to the pre-move output

#### Scenario: `mapEntityDetailsToCatalogDetails` behaves identically with no `t` parameter
- **WHEN** `mapEntityDetailsToCatalogDetails` is called with just its `details` argument, as `apps/chat`'s current call site now does
- **THEN** every label resolves to its hardcoded English fallback, identical to today's behavior

#### Scenario: Both `mapToolsetCredentials`-shaped functions remain independently callable
- **WHEN** `apps/chat` imports both `mapToolsetCredentials` (from `map-entity-details-to-catalog.ts`) and `mapDeploymentToolsetCredentials` (from `map-deployment-to-catalog-item.ts`) from `@epam/ai-dial-chat-hooks`
- **THEN** each resolves to its own distinct, behavior-preserved implementation

### Requirement: `publish.ts`'s pure DTO mapping moves; its i18n label builder and entity-type enum dependency are resolved

`@epam/ai-dial-chat-hooks` SHALL export `toPublishEntityType`, `mapPublishHistoryEntryDto`, and `mapPublishConversationResultDto` from `apps/chat/src/utils/publish.ts`, with `toPublishEntityType`'s return type re-declared as a plain string-literal union matching `CatalogPublishEntityType`'s current values instead of importing that type from `../server-api/publish.api`. `getAccessRulesLabels` (the only `t()`-calling export) SHALL remain in `apps/chat/src/utils/publish.ts`.

#### Scenario: Publish entity-type mapping is unaffected by the type re-declaration
- **WHEN** `toPublishEntityType` is called with any `CatalogEntityType` value
- **THEN** it returns the same publish entity-type value (now typed as a string-literal union) it returned before the move

### Requirement: Toolset-login broadcast events are generic over the credentials-level type

`@epam/ai-dial-chat-hooks` SHALL export a generic `ToolsetLoginSuccessDetail<T>`, `emitToolsetLoginSuccess<T>`, and `subscribeToolsetLoginSuccess<T>`, reproducing `apps/chat/src/utils/toolset-login-events.ts`'s current `EventTarget`-based broadcast behavior exactly, with the app-owned `ToolsetCredentialsLevel` type supplied by `apps/chat` as the type argument at its call sites instead of being imported by the library.

#### Scenario: Broadcast and subscription still round-trip the same detail shape
- **WHEN** `apps/chat` calls `emitToolsetLoginSuccess<ToolsetCredentialsLevel>(detail)` and a subscriber calls `subscribeToolsetLoginSuccess<ToolsetCredentialsLevel>(listener)`
- **THEN** the listener receives the exact `detail` object that was emitted, typed as `ToolsetCredentialsLevel`

### Requirement: `file-download.ts` splits into a pure destination resolver and an app-owned DOM trigger

`@epam/ai-dial-chat-hooks` SHALL export `prepareDownloadDestination` and the `DownloadDestinationType` it resolves to, reproducing `apps/chat/src/utils/file-download.ts`'s current decision logic exactly. `triggerBrowserDownload` (which creates and clicks a DOM `<a>` element) SHALL remain in `apps/chat/src/utils/file-download.ts`, which SHALL re-export `prepareDownloadDestination` from `@epam/ai-dial-chat-hooks` for its existing consumers' unchanged import path.

#### Scenario: Existing consumers see no import-path change
- **WHEN** `apps/chat/src/components/CatalogView/CatalogView.tsx` imports `prepareDownloadDestination` from `../../utils/file-download`
- **THEN** the import continues to resolve successfully, now to a re-export of the `@epam/ai-dial-chat-hooks` implementation

### Requirement: `skill.ts` and `skill-manifest.ts` resolve their `parseSkillManifest` naming collision

`@epam/ai-dial-chat-hooks` SHALL export `skill.ts`'s `parseSkillManifest` (SKILL.md YAML-frontmatter parser) under its current name. `skill-manifest.ts`'s differently-shaped manifest parser SHALL be exported as `parseSkillManifestDocument` instead of `parseSkillManifest`, so the package barrel never re-exports two functions under the same name.

#### Scenario: Both parsers remain independently callable
- **WHEN** `apps/chat` imports both `parseSkillManifest` and `parseSkillManifestDocument` from `@epam/ai-dial-chat-hooks`
- **THEN** each resolves to its own distinct, behavior-preserved implementation

### Requirement: `apps/chat/src/utils/request-api-key.ts` is deleted as dead code

`apps/chat/src/utils/request-api-key.ts` (`transformDateString`, `EMAIL_REGEX`) SHALL be deleted. It SHALL NOT be migrated to `@epam/ai-dial-chat-hooks`, since it has zero consumers anywhere in `apps/chat/src`.

#### Scenario: No reference to the deleted file remains
- **WHEN** the repository is inspected after this change
- **THEN** no file imports from `apps/chat/src/utils/request-api-key` and the file does not exist

### Requirement: Host-owned `apps/chat/src/utils/` files are unaffected

`collect-stream.ts`, `conversation-id-match.ts`, `conversation-stream-transport.ts`, `entity-notification.ts`, `favorites.ts`, `icon-path.ts`, `local-storage.ts`, `apply-theme-colors.ts`, `map-deployment-limits-to-catalog.ts`, `map-scheduled-task-dto.ts`, `map-scheduled-task-run-dto.ts`, `map-usage-data-to-dashboard.ts`, `map-user-usage-to-model-limits.ts`, `scheduled-task-form-validation.ts`, `signin-interrupt.ts`, `toolsets.ts`, and `attachment-network-error-notification.tsx` SHALL NOT be modified by this change, since each either touches host-owned integration state directly or has its translated output as its entire purpose with nothing left to extract.

#### Scenario: No host-owned file is imported by `@epam/ai-dial-chat-hooks`
- **WHEN** `libs/chat-hooks/src/**` is inspected after this change
- **THEN** it contains no import of any of the listed host-owned files
