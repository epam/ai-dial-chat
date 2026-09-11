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

Renders a user message with text content and optional attachments. Long messages collapse to `collapsedLineCount` lines (default `10`) behind a toggle. Pass `beforeContent` to render host-supplied content inline at the start of the first text line, which word-flows after it on the same line (e.g. a used-skill chip; pass inline-level content no taller than a text line — the slot participates in the bubble's content-sized width and the collapse line measurement); the bubble renders for the slot alone even when `text` is empty, and with no slot the rendering is unchanged.

```tsx
import {
  UserMessageBubble,
  BubblePosition,
} from '@epam/ai-dial-conversation-messages';

<UserMessageBubble
  text={message.content}
  position={BubblePosition.Bottom}
  attachments={message.attachments}
  beforeContent={usedSkillChip}
  onAttachmentClick={handleAttachmentClick}
  actions={{ onEdit: handleEdit, onDelete: handleDelete }}
/>;
```

### AssistantMessageBubble

Renders an assistant message as markdown. Set `isStreaming` while the response is still arriving so newly appended text reveals smoothly. Use `markdownComponents` to inject custom renderers (for example citation markers from `@epam/ai-dial-quotations`), `markdownClassNames` to pick the markdown type scale (`COMPACT_MARKDOWN_CLASS_NAMES` from `@epam/ai-dial-chat-shared` drops the body copy one step for narrow viewports), `markdownUrlTransform` to rewrite markdown `href`/`src` values (for example mapping DIAL `files/{bucket}/{path}` ids to host download URLs), `afterContent` to place a stages panel between the text and the actions bar, and `beforeContent` to render host-supplied content overlaid at the inline-start of the first markdown block's first line, which indents past the measured slot width so the text word-flows after it (e.g. a used-skill chip); while there is no text — the streaming placeholder case — the slot renders in flow above it, and an assistant message with no text at all renders the slot on its own line.

Assistant tables receive the matching copy/download controls when their table
action labels (`tableCopyCsvLabel`, `tableCopyTxtLabel`,
`tableCopyMarkdownLabel`, `tableCopiedLabel`, and `tableDownloadCsvLabel`) are
supplied; each control has a UI-kit tooltip with its localized label. The bubble forwards
`labels.tableDownloadFilename` and `labels.tableScrollRegionAriaLabel` to the
markdown viewer, and hides the table action bar while `isStreaming` is true.
Set `tableOnOpenInCanvas` together with `labels.tableOpenInCanvasLabel` to add
a fifth "Open in Canvas" action that receives the table serialized as Markdown
when activated — omitting either one hides the action.

```tsx
import { COMPACT_MARKDOWN_CLASS_NAMES } from '@epam/ai-dial-chat-shared';
import { AssistantMessageBubble } from '@epam/ai-dial-conversation-messages';

<AssistantMessageBubble
  text={message.content}
  isStreaming={isStreaming}
  markdownComponents={citationComponents}
  markdownClassNames={COMPACT_MARKDOWN_CLASS_NAMES}
  markdownUrlTransform={resolveMarkdownUrl}
  afterContent={<StagesPanel stages={stages} isStreaming={isStreaming} />}
  starters={starters}
  onSelectStarter={handleSelectStarter}
  deploymentIconUrl={deployment.iconUrl}
  deploymentDisplayName={deployment.displayName}
  labels={{
    codeBlockCopyLabel: 'Copy code',
    codeBlockCopiedLabel: 'Copied!',
    tableCopyCsvLabel: 'Copy as CSV',
    tableCopyTxtLabel: 'Copy as TXT',
    tableCopyMarkdownLabel: 'Copy as Markdown',
    tableCopiedLabel: 'Copied!',
    tableDownloadCsvLabel: 'Download as CSV',
    tableOpenInCanvasLabel: 'Open in canvas',
    tableDownloadFilename: 'table.csv',
    tableScrollRegionAriaLabel: 'Scrollable table',
  }}
  tableOnOpenInCanvas={handleTableOpenInCanvas}
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

Role-dispatching wrapper — `AssistantMessageBubbleProps` plus the user-only fields (`position`, `collapsedLineCount`) and a required `role`. Use it when the caller iterates a mixed transcript and does not want to branch itself; reach for the specialised bubbles when the role is already known. `beforeContent` is consumed for both `MessageRole.User` and `MessageRole.Assistant` messages (status messages ignore it).

```tsx
import { MessageBubble } from '@epam/ai-dial-conversation-messages';

<MessageBubble role={message.role} text={message.content} />;
```

### MessageActions

Toolbar with per-message actions. `role` selects the action set: `MessageRole.User` (the default) shows Edit/Delete, any other role shows Regenerate/Copy/Like/Dislike. Usually passed to a bubble through its `actions` prop rather than rendered directly.

`isDisabled` disables every button in the toolbar — pass it while a response is generating so the actions cannot be triggered mid-stream.

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
  isDisabled={isStreaming}
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
