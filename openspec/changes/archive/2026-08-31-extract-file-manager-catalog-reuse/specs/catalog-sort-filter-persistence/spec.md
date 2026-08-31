## MODIFIED Requirements

### Requirement: CatalogView reconciles and wires persisted preferences into Catalog

`CatalogView` SHALL use `useCatalogSortFilterPreference` to obtain `sortKey`,
`setSortKey`, `filterTopics`, and `setFilterTopics`.

- Before passing `filterTopics` to `Catalog`, `CatalogView` SHALL call the pure
  `reconcileFilterTopics(filterTopics, visibleCatalogItems)` helper from
  `@epam/ai-dial-chat-hooks`. It SHALL return only persisted topics present in
  the current visible item set, without mutating either input. The call SHALL be
  wrapped in `useMemo` keyed on the items and stored topics.
- Selector visible-type filtering and hide-owned filtering SHALL use the
  corresponding pure `chat-hooks` derivations while preserving the current
  filter order and item order.
- `CatalogView` SHALL only forward `sortKey`, `onSortChange`, `filterTopics`,
  and `onFilterTopicsChange` outside selector mode; in selector mode these props
  SHALL be `undefined`, so `Catalog` retains session-only internal state.
- Outside selector mode, `Catalog` SHALL receive `sortKey={sortKey}`,
  `onSortChange={setSortKey}`, `filterTopics={reconciledFilterTopics}`, and
  `onFilterTopicsChange={setFilterTopics}`.
- `CatalogModal` SHALL NOT be changed.

The persistence hook and `StorageKey` remain app-owned. The pure helpers SHALL
NOT read or write storage, contexts, routes, translations, or feature flags.

Memoisation: reconciled topics and visible item derivations SHALL remain
memoized. Feature flag: none. Accessibility/RTL: no change.

#### Scenario: Persisted sort and filter are applied on page load

- **WHEN** stored sort is Newest and stored topic `nlp` exists in a visible item
- **THEN** `Catalog` receives Newest and a set containing `nlp`

#### Scenario: Stale persisted topic is dropped when no longer present

- **WHEN** stored topic `deprecated-topic` is absent from visible items
- **THEN** `Catalog` receives an empty topic set and shows unfiltered results

#### Scenario: Changing sort updates persisted storage

- **WHEN** the user selects a different sort option
- **THEN** `setSortKey` updates the app-owned preference

#### Scenario: Selector and hide-owned filtering preserve order

- **WHEN** selector types and hide-owned mode remove items
- **THEN** the remaining items retain source order before topic reconciliation

#### Scenario: CatalogModal is unaffected

- **WHEN** `CatalogModal` is rendered in selector mode
- **THEN** it neither reads nor writes catalog sort/filter storage and resets
  its session-only selections on remount

