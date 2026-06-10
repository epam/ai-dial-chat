## Why

Attachment cards in `UserMessageBubble` (the conversation view) are inert, just like they were in `ConversationSourcesPanel` before the `attachment-card-click-handler` change. The same user expectation applies: clicking a file should do something. This change wires the `useAttachmentAction` hook — already specified in `attachment-card-click-handler` — through the message rendering stack so that the download behaviour is consistent and the two entry points share the same action resolver.

## What Changes

- `AttachmentTray` in `libs/conversation-input` gains an optional `onAttachmentClick?: (attachment: DisplayAttachment) => void` prop and `clickLabel?: string` forwarded to each `AttachmentCard` `onClick`/`clickLabel`.
- `UserMessageBubbleProps` gains `onAttachmentClick?: (attachment: DisplayAttachment) => void` and `attachmentClickLabel?: string`; `UserMessageBubble` forwards them to `AttachmentTray`.
- `MessageBubbleProps` gains the same two optional props; the `MessageBubble` wrapper forwards them to `UserMessageBubble` (not to `AssistantMessageBubble`, which has no attachment tray today).
- `ConversationMessageItem` in `apps/chat` calls `useAttachmentAction()` (specified in `attachment-card-click-handler`) and passes `handleAttachmentClick` as `onAttachmentClick` and the i18n string `messages.attachment.downloadLabel` as `attachmentClickLabel` to `MessageBubble`.

## Capabilities

### New Capabilities

- `message-bubble-attachment-click`: Clicking an attachment card in `UserMessageBubble` (conversation view) triggers the resolved action from `useAttachmentAction` — initially a file download. The propagation path is `ConversationMessageItem` → `MessageBubble` → `UserMessageBubble` → `AttachmentTray` → `AttachmentCard`.

### Modified Capabilities

- `conversation-input-attachments`: `AttachmentTray` gains `onAttachmentClick` and `clickLabel` props — a new interaction surface alongside the existing remove/retry/expand callbacks.

## Impact

- **`libs/conversation-input`** — `AttachmentTrayProps` gains `onAttachmentClick` and `clickLabel`; `AttachmentTray.tsx` forwards them to each `AttachmentCard`.
- **`libs/conversation-messages`** — `UserMessageBubbleProps` and `MessageBubbleProps` each gain `onAttachmentClick` and `attachmentClickLabel`; both components forward the props.
- **`apps/chat/src/components/ConversationView/ConversationMessageItem`** — calls `useAttachmentAction()`, passes result + i18n label to `MessageBubble`.
- **`apps/chat/src/i18n/locales/en.json`** — new key `messages.attachment.downloadLabel`.
- **`useAttachmentAction` hook** — no changes; already covered by `attachment-card-click-handler`.
- **BFF, generated client, shared models** — no changes.
