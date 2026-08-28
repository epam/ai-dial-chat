## MODIFIED Requirements

### Requirement: Catalog entity/prompt/skill mapping utilities inject their i18n label resolution

`@epam/ai-dial-chat-hooks` SHALL export `mapDeploymentToCatalogItem`, `mapToolsetToCatalogItem`, `mapPromptToCatalogItem`, `mapSkillToCatalogItem`, and their pure helper functions (`resolveSkillManifestFileId`, `resolveSkillFileDownloadPath`, `buildSkillContentTree`, `readSkillFileBytes`, `readSkillManifest`, etc.) from `map-deployment-to-catalog-item.ts`, `map-prompt-to-catalog-item.ts`, and `map-skill-to-catalog-item.ts`, with each function's `t()`-derived folder/overview label resolution replaced by explicit `folderLabels: DeploymentFolderLabels` / `overviewLabels: PromptOverviewLabels` / `overviewLabels: SkillOverviewLabels` parameters instead of importing `../constants/translation-keys` directly. `map-deployment-to-catalog-item.ts`'s own `mapToolsetCredentials` (operating on `DialToolsetAuthSettingsDto`) SHALL be renamed to `mapDeploymentToolsetCredentials` on the move, since `map-entity-details-to-catalog.ts` already exports a same-named, differently-shaped function (operating on `ToolsetEntityDetails`) — an `export *` barrel cannot re-export two functions under the same name. `map-entity-details-to-catalog.ts`'s `mapEntityDetailsToCatalogDetails`/`mapDeploymentDetailsDtoToEntityDetails` SHALL drop the `CatalogI18nKeys` import and the `t` parameter entirely — every label already had a hardcoded English fallback, so no seam is needed. `isPublicToolsetId` SHALL be owned by `libs/chat-hooks/src/oauth/toolset-id.ts` and imported from there by every module that needs it. The private, non-exported duplicate this requirement originally prescribed — which landed in **two** modules, `map-entity-details-to-catalog.ts` and `map-deployment-to-catalog-item.ts` — SHALL NOT exist: the helper moved into the library along with the rest of the toolset OAuth flow, so the compromise that duplication existed to avoid (widening a host file's export surface) no longer applies. Each mapper's companion pure type file (`apps/chat/src/types/entity-details.ts`, `apps/chat/src/types/prompt.ts`'s `PromptSource`/resource-URL helpers, `apps/chat/src/types/skill.ts`'s `SkillSource`/constants/resource-URL helpers) SHALL move alongside it into `libs/chat-hooks/src/catalog/entity-details.ts`, `libs/chat-hooks/src/prompt/prompt-resource.ts`, and `libs/chat-hooks/src/skill/skill-types.ts` respectively, since the lib cannot import types back from the app; each app types file SHALL re-export from `@epam/ai-dial-chat-hooks` for its other existing consumers.

#### Scenario: Folder/overview-label resolution is behavior-preserving with the injected seam
- **WHEN** `mapDeploymentToCatalogItem`/`mapToolsetToCatalogItem`/`mapPromptToCatalogItem`/`mapSkillToCatalogItem` are called with the same pre-resolved label objects the pre-move `t()` calls would have produced
- **THEN** the returned catalog item is identical to the pre-move output

#### Scenario: `mapEntityDetailsToCatalogDetails` behaves identically with no `t` parameter
- **WHEN** `mapEntityDetailsToCatalogDetails` is called with just its `details` argument, as `apps/chat`'s current call site now does
- **THEN** every label resolves to its hardcoded English fallback, identical to today's behavior

#### Scenario: Both `mapToolsetCredentials`-shaped functions remain independently callable
- **WHEN** `apps/chat` imports both `mapToolsetCredentials` (from `map-entity-details-to-catalog.ts`) and `mapDeploymentToolsetCredentials` (from `map-deployment-to-catalog-item.ts`) from `@epam/ai-dial-chat-hooks`
- **THEN** each resolves to its own distinct, behavior-preserved implementation

#### Scenario: `isPublicToolsetId` has one shared declaration

- **WHEN** `libs/chat-hooks` is type-checked
- **THEN** `map-entity-details-to-catalog.ts` and `map-deployment-to-catalog-item.ts` both import
  `isPublicToolsetId` from `oauth/toolset-id.ts`, and neither declares its own copy of the helper or
  of the `TOOLSETS_ID_PREFIX`/`PUBLIC_BUCKET_SEGMENT` constants it reads
