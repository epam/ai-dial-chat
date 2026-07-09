# @epam/ai-dial-conversation-messages

Message display components for rendering conversation history — user, assistant, and status bubbles with actions and source citations.

## Overview

This library provides the visual building blocks for a chat transcript. It renders individual message bubbles for each role, action toolbars (copy, delete, retry), and source/citation chips. All components accept style and color overrides for theming.

## Installation

```json
{
  "dependencies": {
    "@epam/ai-dial-conversation-messages": "*"
  }
}
```

## Peer Dependencies

- `react`
- `@epam/ai-dial-chat-shared`
- `@epam/ai-dial-ui-kit`
- `@epam/ai-dial-conversation-input`
- `@tabler/icons-react`
- `react-markdown`

## Components

### MessageBubble

Generic bubble wrapper. Use the specialised variants below for role-specific rendering.

```tsx
import {
  MessageBubble,
  BubblePosition,
} from '@epam/ai-dial-conversation-messages';

<MessageBubble position={BubblePosition.End}>...</MessageBubble>;
```

### UserMessageBubble

Renders a user message with text content and optional attachments.

```tsx
import { UserMessageBubble } from '@epam/ai-dial-conversation-messages';

<UserMessageBubble message={userMessage} />;
```

### AssistantMessageBubble

Renders an assistant message with markdown content.

```tsx
import { AssistantMessageBubble } from '@epam/ai-dial-conversation-messages';

<AssistantMessageBubble message={assistantMessage} />;
```

### StatusMessageBubble

Renders a status or system message (errors, notifications).

```tsx
import { StatusMessageBubble } from '@epam/ai-dial-conversation-messages';

<StatusMessageBubble message={statusMessage} />;
```

### MessageActions

Toolbar with per-message actions such as copy, delete, and retry.

```tsx
import { MessageActions } from '@epam/ai-dial-conversation-messages';

<MessageActions
  onCopy={handleCopy}
  onDelete={handleDelete}
  onRetry={handleRetry}
/>;
```

### MessageSource

Renders a source citation chip linking to a referenced document.

```tsx
import { MessageSource } from '@epam/ai-dial-conversation-messages';

<MessageSource source={citation} onClick={handleSourceClick} />;
```

## Enums

```tsx
import { BubblePosition } from '@epam/ai-dial-conversation-messages';

BubblePosition.Start; // left-aligned (assistant)
BubblePosition.End; // right-aligned (user)
```

## Types

```tsx
import type {
  MessageBubbleProps,
  MessageBubbleStyles,
  MessageBubbleColors,
  MessageActionsProps,
  MessageSourceProps,
} from '@epam/ai-dial-conversation-messages';
```
