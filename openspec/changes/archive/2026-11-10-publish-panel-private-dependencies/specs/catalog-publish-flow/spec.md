# Spec Delta

## ADDED Requirements

### Requirement: The catalog publish flow shows the entity's private dependencies

`libs/catalog` SHALL accept an optional `getPublishDependencies?: (item: CatalogItem) => Promise<PublishDependency[]>` on `CatalogProps` and on `DetailsPanelProps` (beside `getPublishHistory` in `libs/catalog/src/models/catalog-props.ts` and `libs/catalog/src/models/item-details-props.ts`), and SHALL pass the resolved list to the shared panel as `dependencies` through `DetailsPublishContent`. The details panel owns the loading state in `useDetailsPublish` (`libs/catalog/src/components/Details/hooks/useDetailsPublish.ts`), as it does for the publish history: the lookup runs each time the publish sub-view opens, a response that arrives after the panel closed or the item changed is ignored, and another item's list is never shown. A rejected read leaves the list empty and shows no error. A host that omits the prop renders today's panel. `libs/catalog` does not import `@epam/ai-dial-chat-hooks`.

`apps/chat` SHALL supply the callback from `apps/chat/src/hooks/useCatalogPublishing/useCatalogPublishing.ts`, calling `getCatalogPublishDependencies` from `apps/chat/src/server-api/publish.api.ts` and mapping the DTO with the `libs/chat-hooks` mapper, and SHALL supply the translated text through the existing `publishLabels` (as `PublishPanelLabels.dependenciesLabels`); no separate labels prop is added to `libs/catalog`. `libs/catalog` SHALL NOT build an endpoint path, import the generated client or read app context.

The project publish panel (`apps/chat/src/components/PublishProjectPanelContainer/PublishProjectPanelContainer.tsx`) SHALL load the list with `usePublishDependencies` from `@epam/ai-dial-chat-hooks` (the app may import it) and the same entity-type route with `CatalogPublishEntityType.Project`, which resolves to an empty list, so it shows no section today and shows one without further wiring if projects gain references.

i18n keys: `publish.dependenciesTitle`, `publish.dependenciesDescription`, `publish.dependenciesAnnouncement` (i18next plural forms `_one` and `_other`, resolved by the host's `getAnnouncement(count)`), `publish.dependenciesRootLocation`, `publish.dependenciesTypeApplication`, `publish.dependenciesTypeToolset`, `publish.dependenciesTypePrompt`, `publish.dependenciesTypeSkill`, `publish.dependenciesTypeFile`; each also added to the `PublishI18nKeys` enum in `translation-keys.ts`.

#### Scenario: Application with a private prompt shows the section
- **GIVEN** the catalog host resolves one private prompt for the application being published
- **WHEN** the user opens Publish in the details panel
- **THEN** the panel lists that prompt in its dependencies section

#### Scenario: Read fails
- **GIVEN** the dependencies request rejects
- **WHEN** the publish sub-view opens
- **THEN** no section or error is shown and the user can publish as before

#### Scenario: Another item opens
- **GIVEN** dependencies were loaded for item A
- **WHEN** the user opens Publish for item B before B's list resolves
- **THEN** A's list is never shown for B

#### Scenario: Toolset shows nothing
- **WHEN** the user opens Publish for a toolset
- **THEN** no dependencies section is rendered

#### Scenario: Project publish panel
- **WHEN** the user opens Publish for a project
- **THEN** the project container loads the list with `usePublishDependencies` and renders no section while the list is empty
