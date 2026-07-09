# @epam/ai-dial-conversation-messages

Message display components for rendering conversation history — user, assistant, and status bubbles with actions and source citations.

## Overview

`@epam/ai-dial-conversation-messages` provides the visual building blocks for rendering a chat transcript. It solves the problem of consistently displaying messages from different roles — users, assistant, and system — without duplicating bubble layout, markdown rendering, or action toolbar logic across every view that needs a conversation thread. Each role has a dedicated bubble component (`UserMessageBubble`, `AssistantMessageBubble`, `StatusMessageBubble`) that handles its own content format: plain text with optional attachments for users, streaming markdown for the assistant, and notification-style text for status messages. The `MessageActions` toolbar provides copy, delete, and retry actions in a consistent position relative to any bubble. The `MessageSource` component renders citation chips that link a bubble back to the documents the model retrieved. All components accept `colors` and `styles` override props so that host applications can theme the transcript area without forking the components.

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
