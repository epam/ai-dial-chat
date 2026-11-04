## ADDED Requirements

### Requirement: `ConversationPanel` shows host-supplied pinned project trees

`ConversationPanelProps` (`libs/conversation-panel/src/models/panel-props.ts`) SHALL accept an optional `pinnedProjects?: PinnedProjects`, the type exported from `@epam/ai-dial-conversation-panel` and defined by the requirement "The Pinned section renders host-supplied project trees". `ConversationPanel` SHALL forward the value to its inner `ConversationList` by reference, without copying, wrapping or filtering it. The list owns the rendering, so the project rows, nested chat rows and See all rows, their ordering inside the Pinned group, drag and drop rules, `aria-level`/`aria-setsize`/`aria-posinset` and RTL behaviour are exactly those the list defines; `ConversationPanel` adds none of its own.

`ConversationPanel` SHALL also forward `labels.seeAllLabel` and `labels.seeAllAriaLabel` to the list. Both fields already belong to `ConversationPanelLabels` through `ConversationListLabels`; the panel SHALL include them in its memoized list labels object and in that object's dependency list, so the object keeps its identity while the values keep theirs. With either field omitted the list's defaults apply (`'See all'` and `` (name) => `See all chats in ${name}` ``).

The panel's controlled inputs already reach the list, so these hold without panel-specific code:

- **Search.** The panel's search text is the list's `searchQuery`: a project is matched by name or by the titles of its chats, as the list defines.
- **Filter chips.** The active chip is the list's `activeFilter`, and `hiddenSources` is forwarded, so the Origin filter applies to a project's `source`.
- **Chrome.** The header, New chat button, search field and filter chips render as without `pinnedProjects`.

With `pinnedProjects` omitted or `undefined`, `ConversationPanel` SHALL render exactly as before. The prop has no state owner inside the panel: the host owns the trees and their callbacks, and the lib SHALL NOT know about DIAL projects, routes, pins or feature keys. The panel is already a `memo` component, so a host SHALL pass a referentially stable `pinnedProjects` (and a stable `seeAllAriaLabel`) to keep it from re-rendering; the lib adds no memoisation of its own beyond the labels object above.

The change adds no user-visible strings (the See all text is host-translated through `labels`), is not gated by `ENABLED_FEATURES` or `ENABLED_FEATURES_ROLES`, adds no cache, and has no telemetry. It adds no direction-specific UI: the rows are the list's own.

`libs/conversation-panel/README.md` SHALL document `pinnedProjects` and the See all labels for `ConversationPanel`.

#### Scenario: A pinned project renders inside the panel

- **GIVEN** `pinnedProjects.projects` holds P named "Support" with chats C1 and C2 and `hasMore: true`
- **WHEN** `<ConversationPanel pinnedProjects={…} />` renders
- **THEN** the Pinned group shows P's row, C1 and C2 as nested rows and a See all row, before any pinned conversation, below the panel's New chat button, search field and filter chips

#### Scenario: Activating pinned project rows through the panel

- **WHEN** the user activates P's row, C1 and P's See all row in turn
- **THEN** `onSelectProject(P)`, `onSelectConversation(C1, P)` and `onSeeAll(P)` are called, and the panel's `onSelectConversation` is not called

#### Scenario: The panel search filters project trees

- **GIVEN** P is named "Support" and has chats "Weekly summary" and "Billing reply"
- **WHEN** the user types "billing" into the panel's search field
- **THEN** P's row and only "Billing reply" render, and no See all row renders

#### Scenario: The panel filter chip applies to a project's source

- **GIVEN** P has `source: FilterTab.Shared`
- **WHEN** the user selects the "My chats" chip
- **THEN** P does not render, and it renders again under the "All" and "Shared" chips

#### Scenario: See all labels reach the list

- **WHEN** `labels.seeAllLabel` is `'Show all'` and `labels.seeAllAriaLabel` returns `All chats of ${name}`
- **THEN** P's See all row shows "Show all" and is named "All chats of Support"

#### Scenario: Default See all labels

- **WHEN** `labels` omits `seeAllLabel` and `seeAllAriaLabel`
- **THEN** the See all row shows "See all" and is named "See all chats in Support"

#### Scenario: No project trees without the prop

- **WHEN** `pinnedProjects` is omitted
- **THEN** the Pinned group holds only pinned conversations, and the rendered output matches the panel's output before this change

#### Scenario: Labels keep their identity across unrelated renders

- **WHEN** the panel re-renders with new `conversations` and the same `labels` field values
- **THEN** the labels object handed to the list is the same reference, including the See all fields
