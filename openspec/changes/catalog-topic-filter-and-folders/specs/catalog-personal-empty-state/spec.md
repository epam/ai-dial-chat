## MODIFIED Requirements

### Requirement: The "My" filter shows a personal empty state on an empty creatable tab

`Catalog` (`libs/catalog/src/components/Catalog/Catalog.tsx`) SHALL render `PersonalEmptyState` instead of the default empty grid or list when all of the following hold:

- loading has finished and the active tab has no items to show;
- the effective folder selection, controlled or internal, has `root` equal to `CatalogFolderRootKind.Personal`, at any `path` depth;
- the search query is empty and no topic filter is selected;
- `createMenuByTab` is omitted, or it has an entry for the active tab.

The Personal folder replaces the removed "My" filter as the trigger.

A tab missing from `createMenuByTab` SHALL keep the default empty state. That is the Models tab, since `useCatalogEditNavigation` gives models no entry (see `catalog-create-app`). When the host's `renderEmptyState` returns content, that content SHALL win over the personal empty state.

`PersonalEmptyState` renders the kit `NoDataContent` with the heading and the secondary line. Below them it renders a `CreateButton` with `variant={ButtonVariant.Secondary}` when a Create button is configured.

#### Scenario: An empty Personal folder shows the personal empty state

- **WHEN** the Personal folder is selected, no query or topic filter is applied, and the Agents tab has no personal agents
- **THEN** the Catalog shows the "No personal agents yet" heading, the "Create your first one, it'll show up right here." line and a Create button

#### Scenario: The Models tab keeps the default empty state

- **WHEN** the Personal folder is selected and the Models tab is empty
- **THEN** the default empty state is shown, with no personal heading and no Create button

#### Scenario: Another folder keeps the default empty state

- **WHEN** All entities or an Organization folder is selected and the active tab is empty
- **THEN** the default empty state is shown

#### Scenario: A search or topic filter keeps the default empty state

- **WHEN** the Personal folder is selected and a search query or a selected topic leaves the tab empty
- **THEN** the default empty state is shown rather than the personal empty state

#### Scenario: A host empty state wins

- **WHEN** `renderEmptyState` returns content for the empty tab
- **THEN** that content is shown and `PersonalEmptyState` is not rendered
