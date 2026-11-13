# Spec Delta

## ADDED Requirements

### Requirement: A pinned project's row collapses and expands its chats

`PinnedProjectGroup` (`libs/conversation-panel/src/models/pinned-projects.ts`) SHALL gain `isExpanded?: boolean` — an absent value means expanded — and `PinnedProjects` SHALL gain `onToggleProject?: (projectId: string) => void`. `ConversationListLabels` (`libs/conversation-panel/src/models/conversation-list.ts`) SHALL gain `expandProjectLabel?: string` (default `'Expand project'`) and `collapseProjectLabel?: string` (default `'Collapse project'`), and `ConversationPanelLabels` carries them through. The lib stores no collapse state: the host owns it, and the lib SHALL NOT read storage, the route, the language or feature keys for it.

**Toggle.** When `onToggleProject` is set, a project row SHALL render a chevron toggle in front of the project name, as a separate `<button type="button">` outside the row's link, so a click or Enter/Space on it only calls `onToggleProject(project.id)`: it does not call `onSelectProject`, does not navigate, and does not change the active chat.

- The button has `aria-expanded` (`true` while the project's chats are shown), `aria-controls` set to the `id` of the list container, as the group header toggles do, and an accessible name from `collapseProjectLabel` while expanded and `expandProjectLabel` while collapsed.
- The icon is `aria-hidden` and drawn with `DIAL_KIT_ICON_STROKE`. It points down while expanded and inline-end while collapsed; the inline-end chevron carries `rtl:scale-x-[-1]`.
- The button is a 24px target with a round hover background, a separate hit target from the row, whose own hover highlights the whole row and shows the ⋮ trigger.
- The chevron shares the row's 24px leading slot with the project icon. At rest, expanded or collapsed, the slot shows the project icon. While the row is hovered, has focus within, or its menu is open, the slot shows the chevron instead, and it stays reachable by keyboard while hidden. On `mobile` (below 1280px, where there is no hover) the slot always shows the chevron instead of the project icon, so the state stays readable; the ⋮ trigger and the unread dot behave as on the panel's other rows. Hovering the chevron adds its round background without removing the row's own hover highlight, and a pointer press on it does not leave it focused, so it hides again once the pointer leaves.
- With `onToggleProject` absent the row renders as before: no chevron, and every project shows its chats.

**Collapsed.** A project is collapsed when `isExpanded` is `false` and no search override applies. A collapsed project renders only its row: its nested chat rows, guide line and See all row are not rendered, and the rows of every later section move up. Its ⋮ trigger works as in the expanded state. The Pinned header, the project order and the other filters are unchanged.

**Search override.** While `searchQuery` is non-empty and at least one chat of the project matches it, the project SHALL render expanded whatever `isExpanded` says, with the matching chats as the existing search rule defines. A project that matches only by name keeps the state the host gave it. The override is derived, is never reported through `onToggleProject` and ends with the query.

**Unread.** A collapsed project with at least one chat whose `isUnread` is `true` SHALL show the unread dot in the row's trailing slot, with the visually hidden `labels.unreadIndicatorLabel`, hidden while the ⋮ trigger is shown (hover, focus within, open menu), as on a conversation row. An expanded project shows no such dot, since its chats are visible. The dot reflects the chats the host passed in `conversations`.

**Scroll.** Because a collapsed project removes its rows, the list SHALL scroll to the active conversation once it is shown again, through the existing scroll-to-active behaviour.

The change adds no feature gate, no telemetry and no cache. Memoisation: a host passes a referentially stable `pinnedProjects` and rebuilds a group only when its rows or its `isExpanded` change; the project row stays memoised. RTL: the chevron is the only directional icon and is mirrored as above; layout uses logical properties. Strings reach the lib only through the two labels above.

`libs/conversation-panel/README.md` SHALL document `isExpanded`, `onToggleProject` and the two labels.

#### Scenario: Collapsing a project

- **GIVEN** a project P with chats C1 and C2 and `hasMore: true`, expanded
- **WHEN** the user activates P's chevron
- **THEN** `onToggleProject(P)` is called once, `onSelectProject` is not, and the host's next render with `isExpanded: false` shows only P's row, with the sections below it moved up

#### Scenario: The leading slot at rest and on hover

- **GIVEN** P is collapsed, and then expanded
- **WHEN** the pointer is away from P's row
- **THEN** the leading slot shows the project icon in both states
- **WHEN** the pointer enters the row
- **THEN** the slot shows the chevron in P's current state, the ⋮ trigger shows, and hovering the chevron adds its round background

#### Scenario: The chevron reports its state

- **WHEN** P is expanded, and then collapsed
- **THEN** the chevron has `aria-expanded="true"` and the name "Collapse project", then `aria-expanded="false"` and the name "Expand project", and its `aria-controls` is the list's `id` in both

#### Scenario: Keyboard

- **WHEN** the chevron has focus and the user presses Enter or Space
- **THEN** `onToggleProject(P)` is called and no navigation happens

#### Scenario: The menu works while collapsed

- **GIVEN** P is collapsed and `getActions` returns items
- **WHEN** the user opens P's ⋮ menu
- **THEN** the menu opens with the same items as when expanded

#### Scenario: RTL

- **GIVEN** the document direction is `rtl` and P is collapsed
- **THEN** the chevron is mirrored with `rtl:scale-x-[-1]`

#### Scenario: Search shows a chat of a collapsed project

- **GIVEN** P is collapsed with a chat titled "Billing reply"
- **WHEN** the user types "billing"
- **THEN** P renders expanded with "Billing reply", `onToggleProject` is not called, and clearing the query collapses P again

#### Scenario: Search matching only the project name

- **GIVEN** P is collapsed and named "Support", and none of its chats matches "support"
- **WHEN** the user types "support"
- **THEN** P's row renders and its chats do not

#### Scenario: Unread chats in a collapsed project

- **GIVEN** P is collapsed and one of its chats has `isUnread: true`
- **THEN** P's row shows the unread dot with the label "Unread", and an expanded P shows none

#### Scenario: Without a toggle callback

- **WHEN** `pinnedProjects.onToggleProject` is omitted
- **THEN** no chevron renders and every project shows its chats
