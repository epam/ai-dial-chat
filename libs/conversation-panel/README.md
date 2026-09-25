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
    emptyLabel: 'No conversations yet',
    noResultsLabel: 'No results found',
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
  FilterLabels,
} from '@epam/ai-dial-conversation-panel';
```

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
- `isUnread` sets the title in `dial-small-semi-text` and renders a dot at the
  row's trailing edge, with a visually hidden `unreadIndicatorLabel`. While the
  row's actions trigger is visible (hover, focus, open menu) the dot is hidden
  and the trigger takes its place; the label keeps announcing the state. The
  dot color is `colors.unreadDot`.

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
(`@epam/ai-dial-ui-kit` `^0.15.0-dev.20`). A host maps its
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

### RenameConversationPopupStyles

`styles?: RenameConversationPopupStyles` exposes `bodyClassName` for the popup content wrapper and `cssVars` for custom properties inherited by the input, spinner, and AI-generation control. The popup shell and action buttons continue to use the UI kit theme.
