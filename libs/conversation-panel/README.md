# @epam/ai-dial-conversation-panel

Panel component for browsing conversation history with virtual scrolling, grouped views, tab filtering, and search.

## Overview

`@epam/ai-dial-conversation-panel` renders the conversation history sidebar that lets users navigate between past chats. It addresses the performance and UX challenges that come with displaying large conversation histories: items are rendered with `react-window` for virtualised scrolling so the DOM stays small even with thousands of entries; conversations are grouped by recency (Today, This Week, This Month, Older) or by source (local vs. remote) so users can quickly locate recent work; and a tab bar with a search field narrows the list without a full page reload. Use this library whenever an application needs a left-rail or slide-in drawer that shows the user's chat history with standard navigation affordances. The library is intentionally data-agnostic — it accepts a flat list of `ConversationItem` objects and emits callbacks for selection, deletion, and moves, leaving storage and routing entirely to the consuming app.

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
  onSelect={handleSelect}
  onDelete={handleDelete}
  onMove={handleMove}
  selectedId={activeConversationId}
/>;
```

## Enums

```tsx
import { FilterTab } from '@epam/ai-dial-conversation-panel';

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
  ConversationItem,
  ConversationMove,
  FilterLabels,
  ConversationGroupProps,
} from '@epam/ai-dial-conversation-panel';
```

### ConversationItem

Minimal data shape required for each conversation entry in the list.

```tsx
interface ConversationItem {
  id: string;
  name: string;
  updatedAt: number;
  source: FilterTab;
  isPinned?: boolean;
}
```
