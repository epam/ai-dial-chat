## MODIFIED Requirements

### Requirement: CatalogView wires the persisted tab into Catalog

`CatalogView` SHALL use `useCatalogActiveTabPreference` to obtain `activeTab`
and `setActiveTab`. The available tab ids supplied to that app-owned hook SHALL
be derived through `deriveAvailableTabIds(visibleCatalogItems, tabOrder)` from
`@epam/ai-dial-chat-hooks`. The pure helper SHALL include only entity types
present in the current visible items, preserve the supplied tab order, and read
no storage, context, route, translation, or feature flag.

- `CatalogView` SHALL forward `activeTab` and `onActiveTabChange` only outside
  selector mode; both SHALL be `undefined` in selector mode.
- Outside selector mode, `onActiveTabChange` SHALL call `setActiveTab(tabId)`;
  no URL/query-param update is involved.
- `CatalogModal` SHALL NOT be changed and remains uncontrolled/session-only.
- The available-id derivation SHALL remain memoized using the current visible
  items and tab order.

Feature flag: none. Accessibility/RTL: no change to the existing Tabs behavior.

#### Scenario: Refresh restores the last-used available tab

- **WHEN** the stored tab is `prompt` and visible items contain a prompt
- **THEN** the rendered catalog shows the Prompts tab

#### Scenario: First-ever visit defaults to the first available tab

- **WHEN** there is no persisted value and Models is the first available id
- **THEN** the rendered catalog shows Models

#### Scenario: Stale tab is excluded by current items

- **WHEN** the stored tab has no matching visible item type
- **THEN** the preference hook receives no such available id and falls back to
  the first current id

#### Scenario: Tab order is stable

- **WHEN** input items appear in a different order than the configured tabs
- **THEN** available ids follow configured tab order, not item order

#### Scenario: Switching tabs persists the new value

- **WHEN** the user selects Agents outside selector mode
- **THEN** `setActiveTab` receives the Agent tab id

#### Scenario: Editing and returning restores the origin tab

- **WHEN** the user edits an item from Prompts and returns to the bare catalog
  route
- **THEN** the app-owned preference restores Prompts from unchanged storage

#### Scenario: CatalogModal is unaffected

- **WHEN** `CatalogModal` is rendered
- **THEN** it neither reads nor writes tab storage and resets on remount
