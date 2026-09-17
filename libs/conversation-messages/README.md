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

Import the stylesheet once in the consuming app:

```ts
import '@epam/ai-dial-conversation-messages/styles.css';
```

### Tailwind setup (required)

This package's layout, spacing, and sizing are Tailwind utility classes in its
compiled JSX — not rules in its stylesheet. Your own Tailwind build has to
produce them, so add the design-token preset and scan this package:

```js
// your tailwind.config.js
module.exports = {
  presets: [require('@epam/ai-dial-chat-shared/tailwind-preset')],
  content: [
    './src/**/*.{html,js,ts,jsx,tsx}',
    './node_modules/@epam/ai-dial-conversation-messages/dist/**/*.js',
    './node_modules/@epam/ai-dial-ui-kit/**/*.{js,ts,jsx,tsx}',
  ],
};
```

The preset is required, not optional: this package's JSX uses semantic token
utilities (`bg-layer-raised`, `text-secondary`, `stroke-secondary`, …) whose
class names exist only in that theme.

**Omitting either piece fails silently** — no build error, no warning, correct
DOM, missing layout. Tailwind CSS 3 in the host is a hard requirement; a
non-Tailwind host is unsupported.

## Peer Dependencies

- `react`
- `@epam/ai-dial-chat-shared`
- `@epam/ai-dial-ui-kit`

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

Assistant tables receive copy/download controls when their table action labels
(`tableCopyLabel`, `tableCopiedLabel`, and `tableDownloadCsvLabel`) are
supplied; each control has a UI-kit tooltip with its localized label. The bubble forwards
`labels.tableDownloadFilename` and `labels.tableScrollRegionAriaLabel` to the
markdown viewer, and hides the table actions while `isStreaming` is true.
Set `tableOnOpenInCanvas` together with `labels.tableOpenInCanvasLabel` to add
an "Open in Canvas" action that receives the table serialized as Markdown
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
    tableCopyLabel: 'Copy',
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

## Public class names

The bubbles carry stable `dial-cm-*` classes in addition to their internal
classes. Target those instead of hashed CSS-module names or ARIA attributes.
The names are exported so you never hardcode them:

```tsx
import { CONVERSATION_MESSAGES_CLASS } from '@epam/ai-dial-conversation-messages';

CONVERSATION_MESSAGES_CLASS.userBubble; // 'dial-cm-user-bubble'
```

| Class                       | Element                                           |
| --------------------------- | ------------------------------------------------- |
| `dial-cm-user-bubble`       | The user message's bubble                         |
| `dial-cm-assistant-content` | The assistant message's streamed content region   |

`dial-cm-user-bubble` is emitted only when the bubble renders — a message with
neither text nor `beforeContent` has no bubble at all. It is additive to
`styles.bubbleClassName`, which keeps working exactly as before.

These classes carry no declarations of their own, so they change nothing until
you style them.

### Replacing fragile selectors

| Instead of                     | Use                                |
| ------------------------------ | ---------------------------------- |
| `[class*='userBubble']`        | `.dial-cm-user-bubble`             |
| `[aria-live='polite']`         | `.dial-cm-assistant-content`       |
| `[aria-live='polite'] pre`     | `.dial-cm-assistant-content pre`   |

`aria-live` is an accessibility contract, not a styling one — using it as a
selector pressures this package to keep an ARIA attribute frozen on a
particular element. Use the class.

**Fenced code blocks have no class of their own.** They are rendered by
`MarkdownCodeBlock` from `@epam/ai-dial-chat-shared`, which is outside this
package, so style them by descending from the content region:
`.dial-cm-assistant-content pre`.

### Stability

A `dial-cm-*` class is public API: renaming it, removing it, or moving it to a
different element is a breaking change, announced in the release notes and
recorded here with its replacement. The element itself stays free — its Tailwind
utilities, its CSS-module class, and its position in the DOM may all change.

Your own overrides are responsible for direction: the class names are
direction-agnostic and identical under `dir="rtl"`, so use CSS logical
properties (`border-start-start-radius`, `margin-inline-end`) rather than
physical ones.

The full convention is in
[`openspec/lib-styling-guide.md`](../../openspec/lib-styling-guide.md).

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
  MessageActionColors,
  MessageActionTooltips,
  MessageActionAriaLabels,
} from '@epam/ai-dial-conversation-messages';
```

All user-visible strings — including every `aria-label` — arrive through the
`labels` props with English defaults; the consuming app passes translated
values in.
