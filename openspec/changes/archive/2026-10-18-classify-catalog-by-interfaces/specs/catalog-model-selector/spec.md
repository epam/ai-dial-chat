## MODIFIED Requirements

### Requirement: Only conversational favorites populate the selector

`DeploymentSelectorPanel.tsx` (`apps/chat/src/components/DeploymentSelector/`) SHALL build the selector's list from the user's favorited catalog items, filtered to conversational items only: an item is conversational when its tab membership (`getCatalogItemTabs(item)` from `@epam/ai-dial-catalog`) includes `CatalogEntityType.Model` or `CatalogEntityType.Agent`. Non-conversational items — `Toolset`, `Skill`, any other `CatalogEntityType`, and applications listed only under Toolsets (MCP-only, `catalogTabs: [Toolset]`) — SHALL be excluded; they are not things a user can talk to. Items with `isHidden` set (operator `HIDDEN_ENTITY_TAGS`) are excluded as well. An optional `pinnedItem` is placed first, ahead of the favorites, and goes through the same filter; the currently selected item is shown in its own section and is removed from the favorites list.

The overlays that map favorites for the panel (`useDeploymentSelectorOverlay.tsx`, `useDeploymentSelectorFieldOverlay.tsx`) SHALL pass the same `isToolsetTabEnabled` value the catalog uses, so an MCP-only application is excluded exactly when the catalog lists it only under Toolsets.

The currently selected item is not dropped when it is `isHidden` — an existing conversation can still point at a model the operator hid afterwards (Issue #9183). Its row SHALL instead render disabled (it cannot be re-picked), carry the `deploymentSelector.unavailableLabel` translation key as its description, and offer no favorite toggle.

This filter SHALL be memoised on the favorites list and `pinnedItem`, and the search query SHALL be applied on top of the already-filtered list rather than over the raw favorites.

#### Scenario: Favorited application appears in the selector

- **WHEN** the user has favorited an item mapped to `CatalogEntityType.Agent` whose membership includes Agent
- **THEN** it appears as a selectable entry alongside favorited models

#### Scenario: Favorited model appears in the selector

- **WHEN** the user has favorited an item mapped to `CatalogEntityType.Model`
- **THEN** it appears as a selectable entry

#### Scenario: Favorited non-conversational entity is excluded

- **WHEN** the user has favorited an item mapped to `CatalogEntityType.Toolset` or `CatalogEntityType.Skill`
- **THEN** it does not appear in the selector

#### Scenario: Favorited MCP-only application is excluded

- **WHEN** the user has favorited an application with `catalogTabs: [CatalogEntityType.Toolset]`
- **THEN** it does not appear in the selector

#### Scenario: Hidden currently-selected model is shown as unavailable

- **WHEN** `selectedItem` has `isHidden: true`
- **THEN** the "Currently selected" row is disabled, shows "Unavailable", has no add-to-favorites button, and clicking it does not call `onSelect`

#### Scenario: Search applies to the conversational subset

- **WHEN** the user types a query that would also match a favorited toolset
- **THEN** the toolset is still absent, because filtering by membership happens before the query is applied
