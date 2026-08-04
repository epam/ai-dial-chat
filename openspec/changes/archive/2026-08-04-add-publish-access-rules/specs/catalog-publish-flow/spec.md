## ADDED Requirements

### Requirement: Catalog publish flow wires the shared access-rules editor and includes rules in the publish request

`DetailsPanel`'s existing `usePublishFlow` instance SHALL supply `rules`/`setRules` to its inline `PublishPanel` render (`DetailsPanel.tsx:329-366`) via the new `rules`/`onRulesChange` props, threaded down from `CatalogProps` the same way `publishFolderItems`/`publishLabels` already are — `CatalogProps` gains `ruleSourceOptions?: string[]` (host-supplied, defaulting to `[]` when absent) and `CatalogView` supplies it from `useAppConfig().config.publicationFilterSources`. `CatalogView.handlePublish` (`CatalogView.tsx:503-515`) SHALL accept the `rules` argument now supplied by `usePublishFlow.handleSubmit`'s extended `onPublish` signature and forward it to `publishCatalogEntity`, which SHALL include it in the request body sent to `POST /api/v1/catalog/{entityType}/{entityId}/publish` (see `catalog-publish-api`).

#### Scenario: Rules entered in the details panel reach the publish call
- **GIVEN** the user has added one rule (`source: 'title'`, `function: 'EQUAL'`, `targets: ['Internal Tools']`) and selected a destination folder for an application
- **WHEN** the user clicks Publish
- **THEN** `publishCatalogEntity` is called with a request body whose `rules` array contains exactly that one rule

#### Scenario: No rules added sends an empty array
- **GIVEN** the user has not added any rules
- **WHEN** the user clicks Publish for a toolset
- **THEN** `publishCatalogEntity` is called with `rules: []`, identical to today's behavior

#### Scenario: Same rules section appears for applications and toolsets
- **WHEN** the Publish sub-view opens inside `DetailsPanel` for an Application and, separately, for a Toolset
- **THEN** the same access-rules section renders identically in both cases, since `PublishPanel` has no entity-type-specific branching for this section

### Requirement: Selecting a destination folder pre-fills the rules editor with that folder's existing rules

`DetailsPanel`'s `usePublishFlow` instance SHALL be supplied an `onFetchExistingRules` option — a thin call to the same `apps/chat/src/server-api/publish-rules.api.ts`'s `getPublishRules(folderPath)` used by the conversation flow — passed down through `CatalogProps` from `CatalogView` (or supplied directly by `DetailsPanel` if threading through `Catalog` is unnecessary; decided at implementation time, matching however `onCreatePublishFolder` is currently threaded). For applications and toolsets, choosing a destination folder replaces the rules editor's contents with that folder's already-configured rules (or empties it, if none).

#### Scenario: Selecting a folder with prior rules pre-fills the editor for an application
- **GIVEN** the user opens the Publish sub-view for an application and selects a destination folder that already has a configured rule
- **WHEN** the lookup resolves
- **THEN** the rules editor shows that existing rule as a chip, without the user having entered it

#### Scenario: A rules-lookup failure does not block the catalog publish flow
- **GIVEN** the user selects a destination folder for a toolset and the rules lookup fails
- **THEN** folder selection, manual rule entry, and the Publish submit action all remain fully usable; only the pre-fill did not occur
