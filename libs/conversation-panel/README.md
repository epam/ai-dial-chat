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

## Peer Dependencies

- `react`
- `@epam/ai-dial-chat-shared`
- `@epam/ai-dial-ui-kit`
- `@epam/ai-dial-sidebar`
- `@tabler/icons-react`

## Components

### ConversationPanel

Root component. Renders the full panel with header, search, tab filters, grouped list, and empty states.

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

The row renders each filter as a ui-kit `Tag` in its `TagAppearance.Selectable`
appearance, so the chips take their colors from the active theme's tag tokens.
It is a named `role="group"` of toggle chips — the selected one carries
`aria-pressed` — not a `tablist`, because the chips filter the list in place
rather than switching between panels. `labels.filterLabels.groupAriaLabel` names
the group and defaults to `"Filter chats"`;
`styles.typography.tabClassName` sets the label typography and defaults to
`'dial-tiny-semi-text'`.

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
  showTaskBadge?: boolean;
  taskBadgeLabel?: string;
  isUnread?: boolean;
}
```

The panel does not sort — it renders `conversations` in the order given, so
recency ordering is the host's job. Grouping is derived from `isPinned` and
`source`.

### ConversationMove

Payload for a completed drag-and-drop move: the dragged `draggedId`, the
`targetGroupKey` it landed in, and `afterId` — the item to insert after, or
`null` for the top of that group.

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
