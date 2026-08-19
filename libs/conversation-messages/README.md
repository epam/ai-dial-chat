# @epam/ai-dial-conversation-messages

Message display components for rendering conversation history — user, assistant, and status bubbles with an actions bar and attachments.

## Overview

`@epam/ai-dial-conversation-messages` provides the visual building blocks for rendering a chat transcript. It solves the problem of consistently displaying messages from different roles — users, assistant, and system — without duplicating bubble layout, markdown rendering, or action toolbar logic across every view that needs a conversation thread. Each role has a dedicated bubble component: `UserMessageBubble` renders plain text with collapse-on-overflow and optional attachments, `AssistantMessageBubble` renders streaming markdown with code blocks, quick-reply starters, a deployment icon, and a slot for extra content such as a stages panel, and `StatusMessageBubble` renders a full-width info banner for in-timeline notices like a model switch. The `MessageActions` toolbar provides role-appropriate actions in a consistent position relative to any bubble — edit and delete for user messages, regenerate, copy, and like/dislike for assistant messages. All components accept `styles` overrides so host applications can theme the transcript area without forking the components.

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
- `@epam/ai-dial-attachment-input`
- `@tabler/icons-react`
- `react-markdown`

## Components

### UserMessageBubble

Renders a user message with text content and optional attachments. Long messages collapse to `collapsedLineCount` lines (default `10`) behind a toggle.

```tsx
import {
  UserMessageBubble,
  BubblePosition,
} from '@epam/ai-dial-conversation-messages';

<UserMessageBubble
  text={message.content}
  position={BubblePosition.Bottom}
  attachments={message.attachments}
  onAttachmentClick={handleAttachmentClick}
  actions={{ onEdit: handleEdit, onDelete: handleDelete }}
/>;
```

### AssistantMessageBubble

Renders an assistant message as markdown. Set `isStreaming` while the response is still arriving so newly appended text reveals smoothly. Use `markdownComponents` to inject custom renderers (for example citation markers from `@epam/ai-dial-quotations`), and `afterContent` to place a stages panel between the text and the actions bar.

```tsx
import { AssistantMessageBubble } from '@epam/ai-dial-conversation-messages';

<AssistantMessageBubble
  text={message.content}
  isStreaming={isStreaming}
  markdownComponents={citationComponents}
  afterContent={<StagesPanel stages={stages} isStreaming={isStreaming} />}
  starters={starters}
  onSelectStarter={handleSelectStarter}
  deploymentIconUrl={deployment.iconUrl}
  deploymentDisplayName={deployment.displayName}
  actions={{
    role: MessageRole.Assistant,
    onRegenerate: handleRegenerate,
    onCopy: handleCopy,
    onLike: handleLike,
    onDislike: handleDislike,
    activeRating: message.rating,
  }}
/>;
```

### StatusMessageBubble

Full-width info banner shown in the timeline when the active deployment changes. `labels.bodyText` is required; `labels.titleText` defaults to `'Model switched.'`.

```tsx
import { StatusMessageBubble } from '@epam/ai-dial-conversation-messages';

<StatusMessageBubble
  labels={{ bodyText: 'The model has been switched from GPT to Imagen.' }}
/>;
```

### MessageBubble

Role-dispatching wrapper — `AssistantMessageBubbleProps` plus the user-only fields and a required `role`. Use it when the caller iterates a mixed transcript and does not want to branch itself; reach for the specialised bubbles when the role is already known.

```tsx
import { MessageBubble } from '@epam/ai-dial-conversation-messages';

<MessageBubble role={message.role} text={message.content} />;
```

### MessageActions

Toolbar with per-message actions. `role` selects the action set: `MessageRole.User` (the default) shows Edit/Delete, any other role shows Regenerate/Copy/Like/Dislike. Usually passed to a bubble through its `actions` prop rather than rendered directly.

```tsx
import { MessageActions } from '@epam/ai-dial-conversation-messages';

<MessageActions
  role={MessageRole.Assistant}
  onRegenerate={handleRegenerate}
  onCopy={handleCopy}
  onCopyMarkdown={handleCopyMarkdown}
  onLike={handleLike}
  onDislike={handleDislike}
  activeRating={activeRating}
  isAlwaysVisible={isMobile}
/>;
```

## Enums

```tsx
import { BubblePosition } from '@epam/ai-dial-conversation-messages';

BubblePosition.Bottom; // first bubble in a group — bottom-start corner squared
BubblePosition.Top; // subsequent bubble in a group — top-start corner squared
```

## Types

```tsx
import type {
  MessageBubbleProps,
  UserMessageBubbleProps,
  AssistantMessageBubbleProps,
  StatusMessageBubbleProps,
  StatusMessageBubbleLabels,
  MessageBubbleStyles,
  MessageBubbleColors,
  MessageBubbleTypography,
  MessageBubbleLabels,
  AssistantMessageBubbleLabels,
  MessageActionsProps,
  MessageActionLabels,
  MessageActionTooltips,
  MessageActionAriaLabels,
} from '@epam/ai-dial-conversation-messages';
```

All user-visible strings — including every `aria-label` — arrive through the
`labels` props with English defaults; the consuming app passes translated
values in.
