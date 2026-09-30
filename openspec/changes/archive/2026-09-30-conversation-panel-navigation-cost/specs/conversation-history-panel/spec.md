## ADDED Requirements

### Requirement: Changing the active conversation re-renders only the affected rows

In `libs/conversation-panel`, `ConversationRow` SHALL be wrapped in `React.memo`. Row-level inputs SHALL be referentially stable across a change of `activeConversationId` for every row whose own state did not change. In particular:

- each row receives `isActive` as a boolean, not the active id;
- `DeploymentIcon`'s `labels` and `styles` SHALL NOT be fresh object literals when their inputs are unchanged;
- the row's action items SHALL be computed with `useMemo` keyed on `getActions` and `item`, so they are built only when the row renders with a changed item or a changed `getActions`.

With a stable `conversations` array and a stable `getActions` from the host, a change of `activeConversationId` SHALL re-render only two `ConversationRow`s: the row that loses the active state and the row that gains it. react-window may still re-render its row wrappers; the row bodies are what this requirement limits.

The host SHALL keep `getActions` stable across navigation. `ConversationPanelView` reads the active conversation id inside `getActions` through a ref updated on each render, so the id is not a `useCallback` dependency.

The virtual list SHALL overscan `max(5, ceil(viewportRows / 2))` rows on each side, where `viewportRows = ceil(listHeight / ITEM_ROW_HEIGHT)`. This replaces the previous two viewports per side.

Existing row behavior is unchanged:

- the action trigger renders only when `getActions` returns a non-empty array;
- menu content still updates while the menu is open when the host's `getActions` identity changes, for example when a revoke-count or publish-history lookup lands;
- `aria-current="page"` on the active row, the unread dot rules, drag-and-drop and `href` behavior stay as they are.

The public API is unchanged: no prop is added, removed or retyped. This adds no user-visible string, RTL or accessibility change, feature flag or telemetry.

#### Scenario: Navigation re-renders only the old and new active rows

- **GIVEN** a panel rendering rows A, B and C with A active, a stable `conversations` array and a stable `getActions`
- **WHEN** `activeConversationId` changes from A to B
- **THEN** only the `ConversationRow`s for A and B re-render, and C does not

#### Scenario: Action items are not rebuilt for a row that does not re-render

- **GIVEN** a stable `getActions` spy and the panel from the previous scenario
- **WHEN** `activeConversationId` changes from A to B
- **THEN** `getActions` is not called for C

#### Scenario: Open menu still refreshes when the host's actions change

- **GIVEN** a row whose action menu is open
- **WHEN** the host passes a new `getActions` that returns a different list for that item
- **THEN** the open menu shows the new list

#### Scenario: A row without actions renders no trigger

- **WHEN** `getActions` returns `[]` for an item
- **THEN** that row renders no action trigger
