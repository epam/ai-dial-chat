# @epam/ai-dial-conversation-panel

Panel component for browsing conversation history with virtual scrolling, grouped views, tab filtering, and search.

## Overview

`@epam/ai-dial-conversation-panel` renders the conversation history sidebar that lets users navigate between past chats. It addresses the performance and UX challenges that come with displaying large conversation histories: rows are rendered through `react-window` so the DOM stays small even with thousands of entries; conversations are grouped into a Pinned section plus per-source sections (`FilterTab`) with collapsible headers, so users can quickly locate work; and a tab bar with a search field narrows the list without a full page reload. Rows support drag-and-drop reordering between groups, per-row action menus, task badges, and unread indicators. Use this library whenever an application needs a left-rail or slide-in drawer that shows the user's chat history with standard navigation affordances. The library is intentionally data-agnostic — it accepts an already-ordered flat list of `ConversationItem` objects and emits callbacks for selection, actions, and moves, leaving sorting, storage, and routing entirely to the consuming app.

## Installation

```json
{
  "dependencies": {
    "@epam/ai-dial-conversation-panel": "*"
  }
}
```

Import the stylesheet once in the consuming app:

```ts
import '@epam/ai-dial-conversation-panel/styles.css';
```

## Peer Dependencies

- `react`
- `@epam/ai-dial-chat-shared`
- `@epam/ai-dial-ui-kit`

## Components

### ConversationPanel

Root component. Renders the full panel with header, search, tab filters, grouped list, and empty states.

`isOpen` animates the panel's layout width so it pushes the content beside it.
When the host positions the panel over the content instead — via `className`, as
the mobile layout does — pass `isOverlay` so the panel slides in and out at full
width rather than collapsing in place.

```tsx
import { FilterTab } from '@epam/ai-dial-chat-shared';
import { ConversationPanel } from '@epam/ai-dial-conversation-panel';
import type { ConversationPanelProps } from '@epam/ai-dial-conversation-panel';

<ConversationPanel
  conversations={historyItems}
  isOpen={isPanelOpen}
  onSelectConversation={handleSelectConversation}
  activeConversationId={activeConversationId}
  onNewChat={handleNewChat}
  getActions={buildRowActions}
  onMoveConversation={handleMove}
  labels={{
    title: 'Chats',
    emptyLabel: 'No chats yet',
    emptyDescription: 'Chats will appear here once you start one.',
    noResultsLabel: 'No chats found',
    noResultsDescription: 'Try a different search term or check your filters.',
    sharedEmptyDescription:
      'Chats other people share with you will show up here.',
    tabEmptyLabels: {
      [FilterTab.Shared]: {
        label: 'No shared chats yet',
        description: 'Chats other people share with you will show up here.',
      },
    },
    newChatLabel: 'New chat',
    searchPlaceholder: 'Search…',
    searchClearLabel: 'Clear search',
    filterLabels: {
      all: 'All',
      myChats: 'My chats',
      shared: 'Shared',
      organization: 'Organization',
      groupAriaLabel: 'Filter chats',
    },
  }}
/>;
```

Pass `isFilterTabsHidden` to drop the All / My chats / Shared / Organization
row. The list then stays on whichever tab is active — `FilterTab.All` unless
`activeFilter` says otherwise — so every group remains visible; only the
control disappears. `labels.filterLabels` stays required either way.

The row is the ui-kit's `FilterChips`, which draws each filter as a `Tag` in
its `TagAppearance.Selectable` appearance, so the chips take their colors from
the active theme's tag tokens. This component only maps the panel's vocabulary
onto it: `FilterTab` values, the host's `filterLabels`, and `hiddenSources` as
an exclusion list.
It is a named `role="group"` of toggle chips — the selected one carries
`aria-pressed` — not a `tablist`, because the chips filter the list in place
rather than switching between panels. `labels.filterLabels.groupAriaLabel` names
the group and defaults to `"Filter chats"`;
`styles.typography.tabClassName` sets the label typography and defaults to
`'dial-tiny-semi-text'`.

### ConversationList

The grouped, collapsible, virtualized list on its own — no `SidebarPanel`, no
New chat button, no search field, no filter chips. `ConversationPanel` is built
from it, so the grouping, `hiddenSources`, drag-and-drop pinning, per-row
actions and the active-row scroll behave identically. Search text and the
filter arrive as controlled props, so the host decides where those controls
live.

`isUpdatingTitles` keeps the loaded rows interactive while the host fills in
missing names. An empty text search shows `labels.updatingTitlesLabel` (default:
"Updating conversation names") until this flag clears, instead of reporting
that no conversation exists. It also announces the update through the list's
live region. `preserveActiveSearchResult` keeps a matching opened row visible
if its title changes, until the search query changes; source and type filters
still apply. Both options default to `false` and are also available on
`ConversationListSection` and `ConversationPanel`. The host owns requests,
cancellation, failures and when to finish the update state.

`onVisibleConversationIdsChange(ids)` reports the distinct conversation IDs of
the rows actually inside the virtual viewport, in row order — group headers and
overscan rows excluded — whenever that sequence changes. It reports `[]` while
the list is loading, empty or showing no search results. The list only reports
IDs; a host uses them, for example, to resolve visible titles first. It is also
available on `ConversationListSection` and `ConversationPanel`.

```tsx
import {
  ConversationList,
  ConversationRowVariant,
} from '@epam/ai-dial-conversation-panel';
import { FilterTab } from '@epam/ai-dial-chat-shared';

<ConversationList
  conversations={historyItems}
  onSelectConversation={handleSelectConversation}
  activeConversationId={activeConversationId}
  searchQuery={searchQuery}
  activeFilter={FilterTab.All}
  rowVariant={ConversationRowVariant.Indicator}
  getActions={buildRowActions}
  onMoveConversation={handleMove}
  onVisibleConversationIdsChange={handleVisibleIdsChange}
  labels={{
    emptyLabel: 'No conversations yet',
    noResultsLabel: 'No results found',
  }}
/>;
```

`ConversationRowVariant.Avatar` (the default) draws the deployment avatar or
`leadingIcon` with a trailing unread dot, as the panel does.
`ConversationRowVariant.Indicator` draws a leading status dot instead — hollow
when read, filled with a semi-bold title when unread — and renders neither the
avatar nor `leadingIcon`; the visually hidden `unreadIndicatorLabel` is still
announced. Both dots are 7.11px; the hollow one has a 1.5px border in
`colors.indicatorDot` (`--cp-indicator-dot`). Row and group-header heights
follow the variant, and so does the group-header color: `colors.textSecondary`
(`--cp-text-secondary`) falls back to `--text-secondary` over `Indicator` rows
and to `--text-tertiary` over `Avatar` rows. `ConversationPanel`
always renders `Avatar` rows. An `Indicator` row has 8px inline padding on both
sides (`ps-2`, and `pe-2` without actions), so its 24px dot slot sits under the
8px-padded group label; while the actions trigger shows, the end padding is
`pe-9`. `Avatar` rows keep `ps-3` and `pe-3`.

`styles.typography.fontClassName` puts one typography class on the list root, which rows
and group headers inherit unless they set their own (`groupHeaderClassName`,
`itemTitleClassName`, `unreadItemTitleClassName` — `'dial-small-semi-text'` by
default for an unread title), and `styles.typography.fontFamily` sets its `font-family`
(`--cp-list-font-family`). `ConversationPanel` forwards `fontFamily` but not
`fontClassName`, which there names the title.

### ConversationListHeader

The "Chats and tasks" row for a host that lays the list out itself: a title
that collapses the list (`aria-expanded`, plain text when `onToggleExpanded` is
omitted), a search toggle, a filter menu, and an `actions` slot.

```tsx
import { ConversationListHeader } from '@epam/ai-dial-conversation-panel';

<ConversationListHeader
  labels={{
    title: 'Chats and tasks',
    searchOpenLabel: 'Search chats',
    searchCloseLabel: 'Close search',
    searchPlaceholder: 'Search...',
    searchClearLabel: 'Clear search',
    filterLabels: {
      all: 'All',
      myChats: 'My chats',
      shared: 'Shared',
      organization: 'Organization',
      groupAriaLabel: 'Filter chats',
    },
  }}
  isExpanded={isListExpanded}
  onToggleExpanded={toggleList}
  searchQuery={searchQuery}
  isSearchOpen={isSearchOpen}
  onSearchChange={setSearchQuery}
  onSearchOpenChange={setIsSearchOpen}
  activeFilter={activeFilter}
  onFilterChange={setActiveFilter}
  actions={<OverflowMenu />}
/>;
```

Each control renders only when its props are present: the search control needs
both `onSearchChange` and `onSearchOpenChange`, the filter menu needs
`onFilterChange` (its "Origin" submenu) or `onTypeFilterChange` (its "Type"
submenu). While the search is open it replaces the row, with a separate
Close search button. Closing — by that button or Escape — calls
`onSearchChange('')` and returns focus to the search toggle. The filter menu has two rows, each showing its current value and opening a
single-select submenu: "Type" (All, Chat, Task; `activeTypeFilter`) and "Origin"
(All, Personal, Shared, Organization; `activeFilter`, omitting `hiddenSources`).
Their labels come from `labels.filterLabels` (`type`, `origin`, `chat`, `task`,
`personal`, with English defaults).
The filter trigger is named by `labels.filterLabels.groupAriaLabel` (default
`'Filter chats'`). `styles.typography.titleClassName` and
`styles.typography.searchTextClassName` set the title and search text
typography; `styles.colors.title` and `styles.colors.titleFocus` recolor the
title at rest and under keyboard focus (`--cp-list-header-title`,
`--cp-list-header-title-focus`).
While `activeFilter` or `activeTypeFilter` is not `All`, the filter trigger
carries a dot and is described by `labels.filterActiveLabel` (default
`'Filters applied'`) for assistive tech; `styles.colors.filterIndicator`
recolors the dot (`--cp-list-header-filter-indicator`, defaults to
`--text-accent`), and `styles.colors.filterValue` recolors each filter row's
current value in the menu (`--cp-list-header-filter-value`, defaults to
`--text-secondary`).

### ConversationListSection

`ConversationListHeader` and an indicator-row `ConversationList` wired together
for a host that lays the list out itself: the section owns the search text,
whether the search is open, whether the list is collapsed and the active filter.
It renders a `section` named by `labels.title`.

```tsx
import { ConversationListSection } from '@epam/ai-dial-conversation-panel';

<ConversationListSection
  conversations={conversations}
  activeConversationId={activeId}
  onSelectConversation={openConversation}
  labels={{
    title: 'Chats and tasks',
    searchOpenLabel: 'Search chats',
    searchCloseLabel: 'Close search',
    searchPlaceholder: 'Search...',
    searchClearLabel: 'Clear search',
    filterLabels: {
      all: 'All',
      myChats: 'My chats',
      shared: 'Shared',
      organization: 'Organization',
      groupAriaLabel: 'Filter chats',
    },
    emptyLabel: 'No chats yet',
    noResultsLabel: 'No results',
  }}
  headerActions={<OverflowMenu />}
/>;
```

The list shows `emptyLabel` / `emptyDescription` when it is empty with no
search and no filter applied, and `noResultsLabel` / `noResultsDescription`
when a search or a filter (origin or type other than `All`) matches nothing.
Under the `Shared` filter with no search, the description is
`sharedEmptyDescription`, which falls back to `noResultsDescription`.
`tabEmptyLabels` goes further: when one filter tab alone narrows the list to
nothing (no search typed, type filter at `All`), its `label` and `description`
replace `noResultsLabel` and the description above, each falling back to them
when left out.

`requestedFilter` makes the section adopt a filter whenever it changes (the user
can still pick another afterwards), `onFilterChange` reports the user's choice,
`isFilterHidden` drops the filter trigger, `isTypeFilterHidden` drops only its
"Type" submenu (a host with no scheduled tasks), `onTypeFilterChange` reports
the chosen type, and `hiddenSources` removes sources from the list altogether.
A conversation is a task when its `ConversationItem.kind` is
`ConversationKind.Task` (from `@epam/ai-dial-chat-shared`); without a kind it is
a chat. Row actions, `onActionMenuOpen`, `onMoveConversation` and
`onVisibleConversationIdsChange` go to the list unchanged, `headerActions` to the header,
and `styles.header` / `styles.list` to the matching component. `listClassName`
is merged onto the list root, for a host anchor. The section fills the height
its parent gives it, with the list scrolling inside.

### Pinned projects

`pinnedProjects` (on `ConversationList`, `ConversationListSection` and
`ConversationPanel`) renders host-supplied project trees at the top of the Pinned group, before the pinned
conversations. The list does not trim, sort or fetch: each project renders as a
project row (briefcase icon, name, ⋮ actions), one nested row per
conversation in the given order (`Indicator` by default; `conversationRowVariant: ConversationRowVariant.Avatar` gives them the deployment avatar or `leadingIcon` and a trailing unread dot, like the panel's own rows, at the 36px row height), and a See all row when `hasMore` is set. The
rows are never draggable nor drop targets. A project collapses through its own
chevron when the host passes `onToggleProject` (see below); collapsing the Pinned
group hides every project with the rest of it.

```tsx
import {
  ConversationListSection,
  type PinnedProjects,
} from '@epam/ai-dial-conversation-panel';
import { FilterTab } from '@epam/ai-dial-chat-shared';

const pinnedProjects: PinnedProjects = {
  projects: [
    {
      id: 'projects/bucket/support',
      name: 'Support',
      href: '/projects/view/bucket/support',
      source: FilterTab.MyChats,
      conversations: [
        {
          id: 'projects/bucket/support/conversations/c1',
          title: 'Billing reply',
          href: '/projects/chat/bucket/support/conversations/c1',
          isUnread: true,
        },
      ],
      hasMore: true,
      isExpanded: !collapsedProjectIds.has('projects/bucket/support'),
    },
  ],
  onSelectProject: openProject,
  onSelectConversation: (conversationId, projectId) =>
    openProjectChat(conversationId, projectId),
  onSeeAll: openProject,
  onToggleProject: toggleProject,
  getActions: (project) => [
    { key: 'unpin', label: 'Unpin', onClick: () => unpin(project.id) },
  ],
  activeProjectId,
};

<ConversationListSection
  conversations={conversations}
  onSelectConversation={openConversation}
  pinnedProjects={pinnedProjects}
  labels={{
    ...sectionLabels,
    seeAllLabel: 'See all',
    seeAllAriaLabel: (name) => `See all chats in ${name}`,
  }}
/>;
```

- **Callbacks.** A project row calls `onSelectProject(id)`, a nested row
  `onSelectConversation(conversationId, projectId)` — never the list's own
  `onSelectConversation` — and a See all row `onSeeAll(id)`. `getActions`
  builds the ⋮ items of the project, shown on its project row and on its See all
  row; no trigger renders when it returns none. `onActionMenuOpen(project, trigger)`
  reports the trigger of either row, for focus to return to after an overlay.
- **Collapsing.** The lib stores no collapse state: the host owns it and passes
  `isExpanded` per project (absent means expanded) and
  `onToggleProject(id, isExpanded)`, where `isExpanded` is the state the chevron
  asks for.
  With `onToggleProject` set, the project row's 24px leading slot shows the
  briefcase at rest and, while the row is hovered, focused within or its menu is
  open, a chevron button instead; on `mobile` (below 1280px, where there is no
  hover) the slot always shows it in place of the briefcase, so the state is
  always readable. The chevron is down when expanded, inline-end when collapsed,
  mirrored in RTL), with a round background under the pointer while the row
  keeps its own highlight. A pointer press does not move focus to it, so it hides
  again when the pointer leaves. The button sits
  outside the row's link, so it only calls `onToggleProject(id, isExpanded)`: it neither
  calls `onSelectProject` nor navigates. It has `aria-expanded`, `aria-controls`
  pointing at the list container, and the name `labels.expandProjectLabel`
  (default `'Expand project'`) or `labels.collapseProjectLabel` (default
  `'Collapse project'`). A collapsed project renders only its row, so the
  sections after it move up; its ⋮ menu still works. A collapsed project with an
  unread chat shows the unread dot in the row's trailing slot (the link's `iconAfter`, so a
  long name truncates before it and its label is part of the link's name), hidden while the
  ⋮ trigger shows. While `searchQuery` matches one of a collapsed project's
  chats the project renders expanded without calling `onToggleProject`; a match
  on its name alone does not expand it. Without `onToggleProject` no chevron
  renders and every project shows its chats.
- **Current location.** The row of `activeProjectId` and the nested row of
  `activeConversationId` get `aria-current="page"`.
- **Search and filters.** While `searchQuery` is non-empty, a project whose
  name matches keeps all its rows; otherwise it keeps only the matching
  conversations and drops its See all row, and a project with no match is
  hidden. Names and titles are highlighted with `Highlight`. The Origin filter
  keeps a project under `FilterTab.All` and the tab equal to its `source`
  (default `FilterTab.MyChats`), `hiddenSources` removes it, and
  `ConversationTypeFilter.Task` hides every project. A list whose only rows are
  projects is not empty.
- **Layout.** Every row is 32px with a 2px gap (36px for nested chats in the `Avatar` variant). Nested and See all rows are
  indented 28px (`ps-7`); a 1px guide line at `inset-inline-start: 20px` (the
  centre of the project icon) runs from 5px below the first nested row's top
  to 5px above the last one's bottom. Its color is
  `colors.projectGuideLine` (`--cp-project-guide-line`, default
  `var(--stroke-tertiary, #e0e6f0)`). The See all text and the briefcase icon use
  `colors.textSecondary` (`--cp-text-secondary`, default `--text-secondary`), and project names and See all
  text use `typography.itemTitleClassName`. Indent and line use logical
  properties, so they mirror in RTL; the briefcase is not mirrored.
- **Accessibility.** Project rows carry `aria-level="1"`; nested and See all
  rows `aria-level="2"`, `aria-posinset` and `aria-setsize` (conversations plus
  See all). The See all row's accessible name is
  `labels.seeAllAriaLabel(name)` (default `` `See all chats in ${name}` ``),
  its visible text `labels.seeAllLabel` (default `'See all'`). A row focused
  with the keyboard is tinted like a hovered one.

In `ConversationPanel` the prop works the same way: the panel forwards it, and
`labels.seeAllLabel` and `labels.seeAllAriaLabel`, to its list, and its own
search field and filter chips drive the list's `searchQuery` and
`activeFilter`, so they filter the project trees as above. The panel is
memoized: pass a referentially stable `pinnedProjects` object and
`seeAllAriaLabel` (for example from `useMemo` and `useCallback`), or it
re-renders on every host render.

```tsx
<ConversationPanel
  conversations={conversations}
  isOpen={isPanelOpen}
  onSelectConversation={openConversation}
  onNewChat={handleNewChat}
  pinnedProjects={pinnedProjects}
  labels={{
    ...panelLabels,
    seeAllLabel: 'See all',
    seeAllAriaLabel: (name) => `See all chats in ${name}`,
  }}
/>
```

### Corner radii

The panel's controls take their corner radius from CSS custom properties, so a
host sets them once instead of passing a class per control. Each falls back to
the value the panel has always rendered:

| Property             | Applies to                     | Default   |
| -------------------- | ------------------------------ | --------- |
| `--cp-row-radius`    | Each conversation row's button | `0.75rem` |
| `--cp-search-radius` | The search field               | `9999px`  |

```css
/* a host that wants 8px rows under a 12px search field */
:root {
  --cp-row-radius: 8px;
  --cp-search-radius: 12px;
}
```

The New chat button is not on this list on purpose: it is a labelled button, so
it reads the ui-kit's own `--radius-control` and stays in step with every other
button in the host app.

Its height and elevation are classes rather than properties, and
`styles.newChatButtonClassName` is merged after them, so a `h-*` or `shadow-*`
utility passed there replaces the default instead of landing beside it:

```tsx
<ConversationPanel
  {...props}
  styles={{ newChatButtonClassName: 'h-[44px] shadow-md' }}
/>
```

Colors stay on `styles.newChatButton` (`background`, `text`, `focusOutline`),
which sets them as custom properties.

`styles.searchWrapperClassName` remains for anything else the search wrapper
needs; a `rounded-*` utility passed there still wins over `--cp-search-radius`,
since a host's utilities are emitted after this package's stylesheet.

### Header

The panel renders a 64 px header inside `SidebarPanel`. `styles.headerClassName`
is merged after that height and `styles.headerActionsClassName` onto the cluster
holding `headerActions` and the panel toggle, so a `h-*` or `gap-*` passed here
replaces the default rather than competing with it at equal specificity — which
is what a rule on `.dial-sb-header` does:

```tsx
<ConversationPanel
  {...props}
  headerActions={<CollapseButton />}
  styles={{
    headerClassName: 'h-[56px] px-4',
    headerActionsClassName: 'gap-2',
  }}
/>
```

## Public class names

The panel's controls carry stable `dial-cp-*` classes in addition to their
internal classes. Target those instead of DOM-order selectors or hashed
CSS-module names. The names are exported so you never hardcode them:

```tsx
import { CONVERSATION_PANEL_CLASS } from '@epam/ai-dial-conversation-panel';

CONVERSATION_PANEL_CLASS.search; // 'dial-cp-search'
```

| Class                     | Element                                             |
| ------------------------- | --------------------------------------------------- |
| `dial-cp-new-chat-button` | The new-chat button                                 |
| `dial-cp-search`          | The `role="search"` wrapper around the search field |
| `dial-cp-list`            | The root of the list rendered by `ConversationList` |
| `dial-cp-list-header`     | The row rendered by `ConversationListHeader`        |
| `dial-cp-list-section`    | The root of `ConversationListSection`               |

The panel renders inside `SidebarPanel`, so `dial-sb-aside` and
`dial-sb-header` from `@epam/ai-dial-sidebar` are available on the surrounding
chrome.

These classes carry no declarations of their own, so they change nothing until
you style them.

### Replacing fragile selectors

| Instead of                                                             | Use                               |
| ---------------------------------------------------------------------- | --------------------------------- |
| `[role='complementary'] > div:nth-child(2) > div:first-child > button` | `.dial-cp-new-chat-button`        |
| `[role='search'] .dial-kit-input`                                      | `.dial-cp-search .dial-kit-input` |

`dial-kit-input` is itself a public class of `@epam/ai-dial-ui-kit`, so
descending to it from `dial-cp-search` is supported — what was fragile was the
`role='search'` half.

### Stability

A `dial-cp-*` class is public API: renaming it, removing it, or moving it to a
different element is a breaking change, announced in the release notes and
recorded here with its replacement. The element itself stays free — its Tailwind
utilities, its CSS-module class, and its position in the DOM may all change.

Your own overrides are responsible for direction: the class names are
direction-agnostic and identical under `dir="rtl"`, so use CSS logical
properties (`padding-inline-start`, `inset-inline-end`) rather than physical ones.

The full convention is in
[`openspec/lib-styling-guide.md`](../../openspec/lib-styling-guide.md).

## Enums

`FilterTab` is owned and exported by `@epam/ai-dial-chat-shared`, and this
package does not re-export it — import it from its own package alongside this
one. It identifies a filter tab, a collapsible group, and a conversation's
source/ownership.

```tsx
import { FilterTab } from '@epam/ai-dial-chat-shared';

FilterTab.All; // 'all'
FilterTab.Pinned; // 'pinned' — also identifies the Pinned collapsible group
FilterTab.MyChats; // 'my-chats' — also used as a conversation's source/ownership
FilterTab.Shared; // 'shared'
FilterTab.Organization; // 'organization'
```

`ConversationTypeFilter` is owned by this package; a conversation's own `kind` is
`ConversationKind` from `@epam/ai-dial-chat-shared`:

```tsx
import { ConversationTypeFilter } from '@epam/ai-dial-conversation-panel';

ConversationTypeFilter.All; // 'all'
ConversationTypeFilter.Chat; // 'chat'
ConversationTypeFilter.Task; // 'task'
```

`ConversationRowVariant` is owned by this package:

```tsx
import { ConversationRowVariant } from '@epam/ai-dial-conversation-panel';

ConversationRowVariant.Avatar; // 'avatar' — avatar or leadingIcon, trailing unread dot
ConversationRowVariant.Indicator; // 'indicator' — leading status dot, no avatar
```

## Types

```tsx
import type {
  ConversationPanelProps,
  ConversationPanelLabels,
  ConversationPanelStyles,
  ConversationPanelTypography,
  ConversationColors,
  NewChatButtonColors,
  ConversationItem,
  ConversationMove,
  ConversationListProps,
  ConversationListLabels,
  ConversationListStyles,
  ConversationListColors,
  ConversationListTypography,
  ConversationListHeaderProps,
  ConversationListHeaderLabels,
  ConversationListHeaderColors,
  ConversationListHeaderStyles,
  ConversationListHeaderTypography,
  ConversationListSectionProps,
  ConversationListSectionLabels,
  ConversationListSectionStyles,
  FilterLabels,
  PinnedProjectGroup,
  PinnedProjects,
} from '@epam/ai-dial-conversation-panel';
```

`PinnedProjectGroup` (`id`, `name`, `href?`, `source?`, `conversations`,
`hasMore`, `isExpanded?`) and `PinnedProjects` (`projects`, `onSelectProject`,
`onSelectConversation`, `onSeeAll`, `onToggleProject?`, `getActions?`, `onActionMenuOpen?`,
`activeProjectId?`, `conversationRowVariant?`) are described under [Pinned projects](#pinned-projects).

### ConversationItem

Data shape for each conversation entry in the list. Only `id` and `title` are
required.

```tsx
interface ConversationItem {
  id: string;
  title: string;
  isPinned?: boolean;
  source?: FilterTab;
  iconUrl?: string;
  iconTooltip?: string;
  isIconLoading?: boolean;
  href?: string;
  leadingIcon?: ReactNode;
  isUnread?: boolean;
}
```

- `leadingIcon` replaces the deployment avatar (`iconUrl`, `iconTooltip` and
  `isIconLoading` are then ignored). The panel gives it no meaning of its own:
  pass a decorative, `aria-hidden` node that fits the 24px avatar slot.
- `isUnread` sets the title in `dial-small-semi-text` and, for `Avatar` rows,
  renders a dot at the row's trailing edge, with a visually hidden `unreadIndicatorLabel`. While the
  row's actions trigger is visible (hover, focus, open menu) the dot is hidden
  and the trigger takes its place; the label keeps announcing the state. The
  dot color is `colors.unreadDot`. `Indicator` rows show the unread state in
  their leading dot instead.

```tsx
import type { ConversationItem } from '@epam/ai-dial-conversation-panel';
import { DIAL_KIT_ICON_STROKE } from '@epam/ai-dial-ui-kit';
import { IconCalendarTime } from '@tabler/icons-react';

const item: ConversationItem = {
  id: 'bucket/gpt-4__Daily digest__run-1',
  title: 'Daily digest',
  leadingIcon: (
    <IconCalendarTime size={24} stroke={DIAL_KIT_ICON_STROKE} aria-hidden />
  ),
  isUnread: true,
};
```

**Breaking since the TASK pill was removed:** `showTaskBadge`, `taskBadgeLabel`,
`ConversationColors.taskBadgeBorder` / `taskBadgeBackground` / `taskBadgeText`,
and `ConversationPanelStyles.taskBadgeClassName` no longer exist. Pass
`leadingIcon` to mark a row and keep passing `isUnread`.

The panel does not sort — it renders `conversations` in the order given, so
recency ordering is the host's job. Grouping is derived from `isPinned` and
`source`.

### ConversationMove

Payload for a completed drag-and-drop move: the dragged `draggedId`, the
`targetGroupKey` it landed in, and `afterId` — the item to insert after, or
`null` for the top of that group.

## Export/import queue

The floating queue that shows export/import job progress is no longer part of
this package: it is the UI kit's generic `TransferQueue`
(`@epam/ai-dial-ui-kit` `^0.16.0`). A host maps its
`ConversationTransferJob`s (from `@epam/ai-dial-chat-shared`) onto
`TransferQueueItem`s — `id`, `fileName` as `name`, the status, `progress.percent`
as `percent`, and the translated failure or warning reason as `message` — and
renders the kit component itself.

## RenameConversationPopup

Modal dialog for renaming a conversation. Validates the name (non-empty, ≤ 255 UTF-8 bytes, sanitized of DIAL-prohibited characters), shows a byte-length error, supports AI-generated names via `onGenerateWithAi`, and guards against concurrent generation requests.

```tsx
import {
  RenameConversationPopup,
  type RenameConversationPopupLabels,
  type RenameConversationPopupProps,
  type RenameConversationPopupStyles,
} from '@epam/ai-dial-conversation-panel';

const labels: RenameConversationPopupLabels = {
  popupTitle: 'Rename conversation',
  inputPlaceholder: 'Enter conversation name',
  renameWithAiLabel: 'Rename with AI',
  renameWithAiError: 'Failed to generate name with AI',
  nameTooLongError: 'Name is too long',
  saveLabel: 'Save',
  cancelLabel: 'Cancel',
};

<RenameConversationPopup
  isOpen={isRenameOpen}
  currentTitle={conversation.title}
  isSaving={isRenaming}
  error={renameError}
  onSave={handleSave}
  onCancel={handleCancel}
  onGenerateWithAi={generateConversationTitle}
  labels={labels}
  styles={{ bodyClassName: 'my-popup-body' }}
/>;
```

### RenameConversationPopupLabels

| Field               | Type     | Description                                               |
| ------------------- | -------- | --------------------------------------------------------- |
| `popupTitle`        | `string` | Popup dialog heading                                      |
| `inputPlaceholder`  | `string` | Placeholder text for the name input                       |
| `renameWithAiLabel` | `string` | Accessible name and tooltip for the AI-generation button  |
| `renameWithAiError` | `string` | Error shown when AI name generation fails                 |
| `nameTooLongError`  | `string` | Error shown when the trimmed name exceeds 255 UTF-8 bytes |
| `saveLabel`         | `string` | Label for the save/confirm button                         |
| `cancelLabel`       | `string` | Label for the cancel button                               |
| `savingLabel`       | `string` | Optional spinner name while saving; defaults `'Saving'`   |

### RenameConversationPopupStyles

`styles?: RenameConversationPopupStyles` exposes `bodyClassName` for the popup content wrapper and `cssVars` for custom properties inherited by the input, spinner, and AI-generation control. The popup shell and action buttons continue to use the UI kit theme.
