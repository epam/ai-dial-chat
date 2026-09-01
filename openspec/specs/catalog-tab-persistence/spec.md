# Spec: catalog-tab-persistence

## Purpose

Persisting the catalog's active tab selection and reconciling it into the controlled `Catalog` component. Also the optional host-supplied tab list so a host can keep entity-type tabs that would disappear if `Catalog` derived them only from a narrowed `items` set.

## Requirements

### Requirement: Catalog accepts a controlled active tab

`CatalogProps` (`libs/catalog/src/models/catalog-props.ts`) SHALL gain two new optional properties:

- `activeTab?: string`
- `onActiveTabChange?: (tabId: string) => void`

`Catalog` (`libs/catalog/src/components/Catalog/Catalog.tsx`) SHALL use `props.activeTab ?? internalActiveTab` so it remains fully functional when the props are omitted (uncontrolled, current behavior unchanged: defaults to the first tab of the resolved tab list — `tabs` when supplied, otherwise `buildCatalogTabs` on non-hidden `items`). When `onActiveTabChange` is supplied, `Catalog` SHALL call it on every tab-switch interaction in addition to updating its own internal fallback state.

`Catalog` SHALL NOT read or write `localStorage`, `sessionStorage`, `URLSearchParams`, or any routing API to determine or persist the active tab — it remains host-agnostic per AGENTS.md §Library isolation.

State owner: `Catalog`'s existing internal `activeTab` state remains the fallback owner when uncontrolled; `CatalogView` (via `useCatalogActiveTabPreference`, see below) is the owner when controlled.

Memoisation: no new memoisation is required in `Catalog` beyond the existing `useMemo` for the resolved tab list.

i18n keys needed: none (no new user-visible strings).

RTL impact: none (tab switching logic only; the existing `Tabs` component already handles its own layout direction).

Accessibility: none — the existing `Tabs` component's `activeTabId`/`onTabChange` props already carry ARIA tab/tabpanel semantics; this requirement only changes which value drives `activeTabId`.

#### Scenario: Uncontrolled Catalog behaves exactly as before

- **WHEN** `Catalog` is rendered without `activeTab` or `onActiveTabChange`
- **THEN** it defaults to the first tab id of the resolved tab list and tab switching works entirely from internal state, as it does today

#### Scenario: Controlled activeTab overrides internal state

- **WHEN** `Catalog` is rendered with `activeTab="skill"` and a `Skill` tab is present in the resolved tab list
- **THEN** the Skill tab is shown as active regardless of any internal default

#### Scenario: Switching tabs calls onActiveTabChange

- **WHEN** the user clicks the "Agents" tab and `onActiveTabChange` is supplied
- **THEN** `onActiveTabChange` is called with the Agent tab's id

---

### Requirement: Catalog accepts a host-supplied tab list

`CatalogProps` SHALL include an optional `tabs?: TabModel[]` (`TabModel` from `@epam/ai-dial-ui-kit`).

When `tabs` is supplied, `Catalog` SHALL render that list as the entity-type tab row and SHALL NOT call `buildCatalogTabs` on `items`. The Browse grid/list SHALL still be limited to the `items` prop: a host tab with no matching item type is shown, but its panel is empty.

When `tabs` is omitted, `Catalog` SHALL derive the tab row from non-hidden `items` via `buildCatalogTabs(filteredItems, titles?.tabLabels)`. Host-supplied `titles.tabLabels` apply only on this default path; they SHALL NOT relabel a host-supplied `tabs` list.

`@epam/ai-dial-catalog` SHALL export `buildCatalogTabs` so a host can compute tabs from a wider item set than it passes as `items` — for example after a category-tree selection that leaves one entity type with zero matches in the narrowed set.

`Catalog` SHALL NOT read storage, routes, translations, or feature flags to decide the tab list.

i18n keys needed: none. RTL/accessibility: the existing `Tabs` component already handles layout direction and ARIA tab semantics. Feature flag: none.

#### Scenario: Host tabs survive a narrowed items list

- **WHEN** `Catalog` is rendered with `items` containing only an Agent, and `tabs` computed via `buildCatalogTabs` from a wider set that also includes Model and Prompt items
- **THEN** the tab row includes Models, Agents, and Prompts
- **AND** the Browse grid still contains only the Agent item

#### Scenario: Omitted tabs are still derived from items

- **WHEN** `Catalog` is rendered with only an Agent item and no `tabs` prop
- **THEN** the tab row includes Agents
- **AND** it does not include Models, Prompts, or any other type absent from `items`

#### Scenario: Host tabs are not relabelled by titles.tabLabels

- **WHEN** `Catalog` is rendered with a host-supplied `tabs` list whose Agent label is `'Agents'` and `titles.tabLabels = { AGENT: 'Агенты' }`
- **THEN** the Agents tab still shows `'Agents'`

---

### Requirement: useCatalogActiveTabPreference hook persists and reconciles the active tab

A custom hook `useCatalogActiveTabPreference` SHALL be created at `apps/chat/src/hooks/useCatalogActiveTabPreference/useCatalogActiveTabPreference.ts`, built on top of the existing `apps/chat/src/hooks/useLocalStorage.ts` hook — mirroring `useCatalogSortFilterPreference`'s shape.

`apps/chat/src/types/storage-key.ts` SHALL gain a new `StorageKey.CatalogActiveTab` member.

The hook SHALL accept the list of currently available tab ids (`string[]`, derived by the caller from `buildCatalogTabs`), and SHALL:

- Call `useLocalStorage<string | null>(StorageKey.CatalogActiveTab, null)` to obtain the persisted tab id and its setter.
- Resolve the effective active tab in this order: (1) the persisted `localStorage` value, if it is present in the available tab ids; (2) the first available tab id, or `undefined` if the available tab id list is empty.
- Expose `activeTab: string | undefined` (the resolved value) and `setActiveTab: (tabId: string) => void`.
- On every `setActiveTab` call, forward the new value to the underlying `useLocalStorage` setter for `StorageKey.CatalogActiveTab`.
- Rely on `useLocalStorage`'s own `try`/`catch` handling for `localStorage` read/write failures — the hook does not need its own storage-access error handling.

The hook SHALL NOT call `useTranslation`, `navigate`, `useSearchParams`, or make network requests — no query-param or routing concern is involved; persistence is `localStorage`-only, identical in mechanism to `useCatalogSortFilterPreference`.

i18n keys needed: none.

RTL impact: none.

#### Scenario: No persisted value on first visit

- **WHEN** the hook is called with `availableTabIds: ['model', 'agent', 'prompt']` and `localStorage` has no `dial:catalog:activeTab` entry
- **THEN** `activeTab` is `'model'` (the first available tab id)

#### Scenario: Persisted tab is restored

- **WHEN** the hook is called with `availableTabIds: ['model', 'agent', 'prompt']` and `localStorage.getItem('dial:catalog:activeTab')` returns `JSON.stringify('agent')`
- **THEN** `activeTab` is `'agent'`

#### Scenario: Stale persisted tab id falls back to first available tab

- **WHEN** the hook is called with `availableTabIds: ['model', 'agent']` and `localStorage.getItem('dial:catalog:activeTab')` returns `JSON.stringify('skill')` (a tab not present in `availableTabIds`)
- **THEN** `activeTab` is `'model'`

#### Scenario: setActiveTab persists the new value

- **WHEN** `setActiveTab('prompt')` is called
- **THEN** `localStorage.getItem(StorageKey.CatalogActiveTab)` returns `JSON.stringify('prompt')` and the hook's `activeTab` updates to `'prompt'`

#### Scenario: Empty available tab list resolves to undefined

- **WHEN** the hook is called with `availableTabIds: []`
- **THEN** `activeTab` is `undefined`

#### Scenario: localStorage write failure does not throw

- **WHEN** `setActiveTab` is called and the underlying `useLocalStorage` setter's `localStorage.setItem` call throws (e.g. quota exceeded)
- **THEN** the hook's `activeTab` state still updates in memory and no error propagates out of the hook

---

### Requirement: CatalogView wires the persisted tab into Catalog

`CatalogView` (`apps/chat/src/components/CatalogView/CatalogView.tsx`) SHALL use `useCatalogActiveTabPreference` (passing the current `buildCatalogTabs` output's ids) to obtain `activeTab` and `setActiveTab`.

- `CatalogView` SHALL only forward `activeTab` and an `onActiveTabChange` callback to `Catalog` when it is not rendered in selector mode (`isSelectorMode` is falsy); in selector mode both SHALL be `undefined` so `Catalog` falls back to its own internal, session-only tab state. `CatalogView` SHALL still call `useCatalogActiveTabPreference` unconditionally (the hook read is harmless), but its value is only wired to `Catalog` outside selector mode.
- Outside selector mode, `CatalogView` SHALL pass `activeTab={activeTab}` to `Catalog`, and its `onActiveTabChange` handler SHALL call `setActiveTab(tabId)` — no URL/query-param update is involved.
- `CatalogModal` (`apps/chat/src/components/DeploymentSelector/CatalogModal.tsx`) renders `CatalogView` with `isSelectorMode`; because of the selector-mode gating above, `CatalogModal` SHALL NOT be changed and its tab selection remains uncontrolled and session-only (resets whenever the modal is closed and reopened).

Memoisation: the `availableTabIds` array passed into `useCatalogActiveTabPreference` SHALL be derived via the existing `buildCatalogTabs` memoized tab list (`.map(t => t.id)`, wrapped in its own `useMemo` keyed on the existing `tabs` memo).

Feature flag: none required.

Accessibility: no change — the tab list already carries its existing ARIA semantics; this requirement only changes which value drives `activeTabId`.

#### Scenario: Refresh restores the last-used tab

- **WHEN** `CatalogView` mounts and `useCatalogActiveTabPreference` resolves `activeTab: 'prompt'` from `localStorage`
- **THEN** the rendered `Catalog` shows the Prompts tab as active, with no additional user interaction

#### Scenario: First-ever visit defaults to Models

- **WHEN** `CatalogView` mounts with no persisted `localStorage` value
- **THEN** the rendered `Catalog` shows the Models tab as active (the first entry in `buildCatalogTabs`'s output)

#### Scenario: Switching tabs persists the new value

- **WHEN** the user clicks the "Agents" tab
- **THEN** `localStorage` is updated via `setActiveTab` to the Agent tab's id

#### Scenario: Editing an item and returning restores the origin tab

- **WHEN** the user is on the Prompts tab (so `localStorage`'s persisted value is `'prompt'`), clicks Edit on a prompt, and the editor navigates back to the bare `ROUTES.Catalog` on save/cancel
- **THEN** `CatalogView` remounts, `useCatalogActiveTabPreference` resolves `activeTab: 'prompt'` from the unchanged `localStorage` value, and the rendered `Catalog` shows the Prompts tab as active

#### Scenario: CatalogModal is unaffected

- **WHEN** `CatalogModal` is rendered
- **THEN** it does not read from or write to `localStorage` for tab selection, and its tab selection resets when the modal is closed and reopened

---

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
