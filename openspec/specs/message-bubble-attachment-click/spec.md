# message-bubble-attachment-click Specification

## Purpose

Forwarding an attachment-click callback and its accessible label from `ConversationMessageItem` down through `MessageBubble` to `UserMessageBubble` and `AssistantMessageBubble`.

## Requirements

### Requirement: `UserMessageBubble` accepts and forwards an attachment click callback

`libs/conversation-messages/src/models/message-bubble.ts` SHALL declare, for both bubble kinds:

- `onAttachmentClick?: (attachment: DisplayAttachment) => void` on the shared `BaseMessageBubbleProps` (inherited by `UserMessageBubbleProps` and `AssistantMessageBubbleProps`).
- `attachmentClickLabel?: string` on `MessageBubbleLabels`, read from the bubble's `labels` prop.

`UserMessageBubble.tsx` and `AssistantMessageBubble.tsx` SHALL render their attachments through `<AttachmentGroup>` (from the attachment-input lib). Only when the bubble receives `onAttachmentClick` SHALL they pass the group an `onAttachmentClick(id)` handler that resolves the id back to the matching `DisplayAttachment` and calls the bubble's `onAttachmentClick` with it (an id with no match calls nothing); otherwise they pass `undefined`, so the group renders its tiles as non-interactive. They also pass `labels.attachmentClickLabel` as the group's `labels.clickLabel`. When `attachmentClickLabel` is absent, the group receives `clickLabel: undefined` (its own defaults apply).

#### Scenario: Attachments are inert when `onAttachmentClick` is absent

- **WHEN** `UserMessageBubble` or `AssistantMessageBubble` is rendered without `onAttachmentClick` (and without `onDownloadAll`)
- **THEN** the `AttachmentGroup` receives no `onAttachmentClick`, and no element in the attachment list is a button or a Tab stop

#### Scenario: Attachment click invokes the callback

- **WHEN** `UserMessageBubble` is rendered with `onAttachmentClick` and a non-empty `attachments` list
- **THEN** clicking any attachment card invokes `onAttachmentClick` with the corresponding `DisplayAttachment`

#### Scenario: `attachmentClickLabel` is forwarded to the group

- **WHEN** `UserMessageBubble` is rendered with `labels={{ attachmentClickLabel: "Download file" }}`
- **THEN** the `AttachmentGroup` receives `labels.clickLabel="Download file"`

---

### Requirement: `MessageBubble` forwards attachment click props to the role-specific bubble

`MessageBubbleProps` (`libs/conversation-messages/src/models/message-bubble.ts`) SHALL carry the same `onAttachmentClick` prop and `labels.attachmentClickLabel` label.

`MessageBubble.tsx` SHALL forward `onAttachmentClick` (and `labels`) to `UserMessageBubble` when `role === MessageRole.User` and to `AssistantMessageBubble` for the assistant role. For `MessageRole.Status` it renders `StatusMessageBubble`, and the attachment props SHALL be ignored.

#### Scenario: Props forwarded to user bubble

- **WHEN** `MessageBubble` is rendered with `role={MessageRole.User}`, `onAttachmentClick`, and `labels.attachmentClickLabel`
- **THEN** the rendered `UserMessageBubble` receives both

#### Scenario: Props forwarded to assistant bubble

- **WHEN** `MessageBubble` is rendered with `role={MessageRole.Assistant}` and `onAttachmentClick`
- **THEN** the rendered `AssistantMessageBubble` receives `onAttachmentClick`

#### Scenario: Props ignored for status bubble

- **WHEN** `MessageBubble` is rendered with `role={MessageRole.Status}` and `onAttachmentClick`
- **THEN** the rendered `StatusMessageBubble` receives no attachment props

---

### Requirement: `ConversationMessageItem` wires `useAttachmentAction` to `MessageBubble`

`apps/chat/src/components/ConversationView/ConversationMessageItem.tsx` SHALL call `useAttachmentAction({ resolveDownloadUrl: resolveDialFileDownloadUrl })` (from `@epam/ai-dial-chat-hooks`) and pass the resulting click handler as `onAttachmentClick` to every `MessageBubble` it renders (the user/assistant render paths and the `Suspense` fallback shown while `EditMessageInput` loads). When the item's own optional `onAttachmentClick(attachment, messageIndex)` prop is supplied, it SHALL be used instead of the default download action. It SHALL also pass `t(AttachmentsI18nKeys.Download)` as `labels.attachmentClickLabel`.

`ConversationMessageItem` SHALL NOT implement any download or action logic itself — all resolution is delegated to `useAttachmentAction` or the caller's override.

#### Scenario: Clicking a user message attachment triggers a download

- **WHEN** a user message is rendered in `ConversationMessageItem` with a DIAL file attachment and no `onAttachmentClick` override
- **THEN** clicking the attachment card triggers the `handleAttachmentClick` callback from `useAttachmentAction`
- **AND** `useAttachmentAction` initiates a browser download for the file

#### Scenario: Suspense fallback also wires the click handler

- **WHEN** the `EditMessageInput` lazy chunk is loading and the fallback `MessageBubble` is rendered
- **THEN** the fallback bubble also receives `onAttachmentClick` and the click handler is active

#### Scenario: Caller override replaces the default download

- **WHEN** `ConversationMessageItem` receives an `onAttachmentClick` prop
- **THEN** activating an attachment card calls that prop with the attachment and the item's `index`, and no download is started

---

### Requirement: `attachments.downloadFile` i18n key is defined

`apps/chat/src/i18n/locales/en.json` SHALL contain the key `attachments.downloadFile` with the value `"Download file"`, exposed as `AttachmentsI18nKeys.Download` from `apps/chat/src/constants/translation-keys.ts`.

#### Scenario: Key exists in en.json

- **WHEN** `apps/chat/src/i18n/locales/en.json` is inspected
- **THEN** it contains `attachments.downloadFile` with a non-empty English string

#### Scenario: Translation key is consumed via typed map

- **WHEN** `ConversationMessageItem` builds `labels.attachmentClickLabel`
- **THEN** it does so via `AttachmentsI18nKeys.Download` from the i18n constants module, not a hardcoded string literal
