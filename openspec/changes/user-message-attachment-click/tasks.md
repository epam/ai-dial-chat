## 1. Lib — `AttachmentTray` click forwarding

- [ ] 1.1 Add `onAttachmentClick?: (attachment: DisplayAttachment) => void` and `clickLabel?: string` to `AttachmentTrayProps` in `libs/conversation-input/src/models/AttachmentTray.ts`
- [ ] 1.2 Update `AttachmentTray.tsx` to pass `onClick={(att) => onAttachmentClick?.(att)}` and `clickLabel` to each `AttachmentCard` when `onAttachmentClick` is provided
- [ ] 1.3 Update `AttachmentTray` unit tests: cards have no `onClick` when prop is absent; cards receive `onClick` and `clickLabel` when prop is provided; remove button does not propagate to `onAttachmentClick`

## 2. Lib — `UserMessageBubble` and `MessageBubble` prop threading

- [ ] 2.1 Add `onAttachmentClick?: (attachment: DisplayAttachment) => void` and `attachmentClickLabel?: string` to `UserMessageBubbleProps` in `libs/conversation-messages/src/models/MessageBubble.ts`
- [ ] 2.2 Add the same two props to `MessageBubbleProps` in `libs/conversation-messages/src/models/MessageBubble.ts`
- [ ] 2.3 Update `UserMessageBubble.tsx` to forward `onAttachmentClick` and `attachmentClickLabel` to `<AttachmentTray>`
- [ ] 2.4 Update `MessageBubble.tsx` to forward both props to `<UserMessageBubble>` when `role === MessageRole.User`; do not pass them to `AssistantMessageBubble`
- [ ] 2.5 Update `UserMessageBubble` unit tests: tray cards inert without prop; click invokes callback; label forwarded
- [ ] 2.6 Update `MessageBubble` unit tests: props forwarded to user bubble; not passed to assistant bubble

## 3. App — i18n

- [ ] 3.1 Add `messages.attachment.downloadLabel` with value `"Download file"` to `apps/chat/src/i18n/locales/en.json`
- [ ] 3.2 Add `AttachmentDownloadLabel` (or `MessagesAttachmentDownloadLabel`) member to the i18n key constants in `apps/chat/src/constants/translation-keys.ts`

## 4. App — `ConversationMessageItem` wiring

- [ ] 4.1 Call `useAttachmentAction()` in `ConversationMessageItem` and pass `handleAttachmentClick` as `onAttachmentClick` to the main `MessageBubble` render
- [ ] 4.2 Pass the same handler and `t(MessagesI18nKeys.AttachmentDownloadLabel)` as `attachmentClickLabel` to the `Suspense` fallback `MessageBubble`
- [ ] 4.3 Update `ConversationMessageItem` tests: both `MessageBubble` instances receive `onAttachmentClick`; clicking a user attachment card fires `handleAttachmentClick`

## 5. Verification

- [ ] 5.1 Run `npm exec nx run conversation-input:test` — all tests pass
- [ ] 5.2 Run `npm exec nx run conversation-messages:test` — all tests pass
- [ ] 5.3 Run `npm exec nx run chat:test` — all tests pass
- [ ] 5.4 Run `npm exec nx run conversation-input:lint` and `npm exec nx run conversation-messages:lint` — no lint errors
- [ ] 5.5 Run `npm exec nx run chat:lint` — no lint errors
- [ ] 5.6 Run `npm exec nx run chat:type-check` — no TypeScript errors

## Prerequisites

> **Note:** Tasks in groups 1–4 depend on `AttachmentCard.onClick` being available from the `attachment-card-click-handler` change (Task 1.1–1.2 of that change). Implement that change first, or include it in the same branch.
