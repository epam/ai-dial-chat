# catalog-personal-empty-state Specification

## Purpose

Defines the empty state the Catalog shows when the "My" filter is on and the active tab has no personal entities: a heading naming the tab's entity type, a secondary line, and a Create button that creates only that type.

## Requirements

### Requirement: The "My" filter shows a personal empty state on an empty creatable tab

`Catalog` (`libs/catalog/src/components/Catalog/Catalog.tsx`) SHALL render `PersonalEmptyState` instead of the default empty grid/list when all of the following hold:

- loading has finished and the active tab has no items to show;
- the "My" filter is active (`isMyAppsActive`, controlled or internal);
- the search query is empty and no topic filter is selected;
- `createMenuByTab` is omitted, or it has an entry for the active tab.

A tab missing from `createMenuByTab` (the Models tab, since `useCatalogEditNavigation` gives models no entry — see `catalog-create-app`) SHALL keep the default empty state. When the host's `renderEmptyState` returns content, that content SHALL win over the personal empty state.

`PersonalEmptyState` renders the kit `NoDataContent` with the heading and the secondary line, and below it a `CreateButton` with `variant={ButtonVariant.Secondary}` when a Create button is configured.

#### Scenario: An empty "My" tab shows the personal empty state

- **WHEN** the "My" filter is on, no query or topic filter is applied, and the Agents tab has no personal agents
- **THEN** the Catalog shows the "No personal agents yet" heading, the "Create your first one, it'll show up right here." line and a Create button

#### Scenario: The Models tab keeps the default empty state

- **WHEN** the "My" filter is on and the Models tab is empty
- **THEN** the default empty state is shown, with no personal heading and no Create button

#### Scenario: The "My" filter off keeps the default empty state

- **WHEN** the "My" filter is off and the active tab is empty
- **THEN** the default empty state is shown

#### Scenario: A search or topic filter keeps the default empty state

- **WHEN** the "My" filter is on and a search query or a selected topic leaves the tab empty
- **THEN** the default empty state is shown rather than the personal empty state

#### Scenario: A host empty state wins

- **WHEN** `renderEmptyState` returns content for the empty tab
- **THEN** that content is shown and `PersonalEmptyState` is not rendered

### Requirement: The personal empty state's Create button creates only the active tab's type

The button SHALL be derived from `createMenuByTab[activeTab]` by `getTabCreateButtonConfig` (`libs/catalog/src/utils/create-menu.tsx`):

- an entry with no options yields no button — the heading and secondary line still render;
- an entry with exactly one option that has no `children`, and no `search`, yields a plain button that runs that option's `onClick` directly, with no menu;
- any other entry yields a dropdown of its `options`, with its `search` when present.

When `createMenuByTab` is omitted, the button SHALL reuse the header's `createOptions` / `onCreateClick` / `createSearch`. The button SHALL carry the same labels as the header Create button (`createLabel`, the `titles.createSearch*` and `titles.createMenu*` labels), and SHALL be omitted entirely when the header Create button is hidden (`hideCreateButton` or `isReadonly`).

`CreateButton` SHALL accept `variant?: ButtonVariant` (default `ButtonVariant.Primary`) and apply it to every form it renders; for the plain-button form a non-primary variant renders the kit `Button` with `ButtonAppearance.Solid` instead of `PrimaryButton`. Its `onClick` receives the button's `MouseEvent`.

#### Scenario: A lone option runs directly

- **WHEN** the Prompts tab's personal empty state is shown and its entry holds only the `prompt` option
- **THEN** clicking Create navigates to the Prompt Editor without opening a menu

#### Scenario: The Skills tab offers both skill actions

- **WHEN** the Skills tab's personal empty state is shown
- **THEN** Create opens a menu with "Write instructions" and "Upload" and no "Skill" parent

#### Scenario: A disabled type shows no button

- **WHEN** `OverlayFeature.Toolsets` is off and the Toolsets tab's personal empty state is shown
- **THEN** the heading and secondary line render with no Create button

#### Scenario: A read-only catalog shows no button

- **WHEN** `isReadonly` is true and the personal empty state is shown
- **THEN** no Create button renders

### Requirement: The personal empty state's texts are host-translated

`CatalogTitles` SHALL carry `myAppsEmptyTitle?: (activeTab: string) => string` (lib default `() => 'No personal items yet'`) and `myAppsEmptyDescription?: string` (lib default `"Create your first one, it'll show up right here."`).

`CatalogView` SHALL pass `myAppsEmptyTitle` built by `getCatalogMyAppsEmptyTitle` (`apps/chat/src/utils/catalog.ts`), which interpolates the tab's plural entity name (the `catalog.searchEntity.*` keys shared with the search placeholder) into the `catalog.myAppsEmpty.title` translation key ("No personal {{entities}} yet"), and falls back to the `catalog.myAppsEmpty.titleGeneric` translation key for a tab that is not a `CatalogEntityType`. `myAppsEmptyDescription` is the `catalog.myAppsEmpty.description` translation key.

#### Scenario: The heading names the active tab's entity

- **WHEN** the personal empty state is shown on the Toolsets tab
- **THEN** the heading reads "No personal toolsets yet"

#### Scenario: An unknown tab gets the generic heading

- **WHEN** `getCatalogMyAppsEmptyTitle` is called with a tab id that is not a `CatalogEntityType`
- **THEN** it returns "No personal items yet"
