# @epam/ai-dial-conversation-panel

Panel component for browsing conversation history with virtual scrolling, grouped views, tab filtering, and search.

## Overview

This library renders the conversation history sidebar. It uses `react-window` for virtualized rendering of large conversation lists, groups items by time period or source, and supports tab-based filtering and text search.

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
import {
  ConversationGroupKey,
  ConversationSource,
  FilterTab,
} from '@epam/ai-dial-conversation-panel';

ConversationGroupKey.Today; // 'today'
ConversationGroupKey.Week; // 'week'
ConversationGroupKey.Month; // 'month'
ConversationGroupKey.Older; // 'older'

ConversationSource.Local; // locally stored conversations
ConversationSource.Remote; // server-synced conversations

FilterTab.All; // 'all'
FilterTab.Pinned; // 'pinned'
```

## Types

```tsx
import type {
  ConversationPanelProps,
  ConversationHistoryItem,
  ConversationMove,
  FilterLabels,
  ConversationGroupProps,
} from '@epam/ai-dial-conversation-panel';
```

### ConversationHistoryItem

Minimal data shape required for each conversation entry in the list.

```tsx
interface ConversationHistoryItem {
  id: string;
  name: string;
  updatedAt: number;
  source: ConversationSource;
  isPinned?: boolean;
}
```
