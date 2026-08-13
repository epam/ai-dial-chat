# message-bubble-attachment-click Specification

## Purpose

Forwarding an attachment-click callback from `ConversationMessageItem` down through `MessageBubble` to `UserMessageBubble`.

## ADDED Requirements

### Requirement: `UserMessageBubble` accepts and forwards an attachment click callback

`libs/conversation-messages/src/models/MessageBubble.ts` (`UserMessageBubbleProps`) SHALL gain two optional props:

- `onAttachmentClick?: (attachment: DisplayAttachment) => void` — Passed through to `AttachmentTray` as `onAttachmentClick`.
- `attachmentClickLabel?: string` — Passed through to `AttachmentTray` as `clickLabel`.

`UserMessageBubble.tsx` SHALL forward both props to `<AttachmentTray>`. When either prop is absent, `AttachmentTray` receives `undefined` (its own defaults apply).

#### Scenario: Attachments are inert when `onAttachmentClick` is absent

- **WHEN** `UserMessageBubble` is rendered without `onAttachmentClick`
- **THEN** no attachment card is keyboard-accessible as a button

#### Scenario: Attachment click invokes the callback

- **WHEN** `UserMessageBubble` is rendered with `onAttachmentClick` and a non-empty `attachments` list
- **THEN** clicking any attachment card invokes `onAttachmentClick` with the corresponding `DisplayAttachment`

#### Scenario: `attachmentClickLabel` is forwarded to the tray

- **WHEN** `UserMessageBubble` is rendered with `attachmentClickLabel="Download file"`
- **THEN** the `AttachmentTray` receives `clickLabel="Download file"`

---

### Requirement: `MessageBubble` forwards attachment click props to `UserMessageBubble`

`libs/conversation-messages/src/models/MessageBubble.ts` (`MessageBubbleProps`) SHALL gain the same two optional props:

- `onAttachmentClick?: (attachment: DisplayAttachment) => void`
- `attachmentClickLabel?: string`

`MessageBubble.tsx` SHALL forward both props to `UserMessageBubble` when `role === MessageRole.User`. For all other roles (`Assistant`, `Status`) the props SHALL be ignored.

#### Scenario: Props forwarded to user bubble

- **WHEN** `MessageBubble` is rendered with `role="User"`, `onAttachmentClick`, and `attachmentClickLabel`
- **THEN** the rendered `UserMessageBubble` receives both props

#### Scenario: Props ignored for assistant bubble

- **WHEN** `MessageBubble` is rendered with `role="Assistant"` and `onAttachmentClick`
- **THEN** the rendered `AssistantMessageBubble` does NOT receive `onAttachmentClick`

---

### Requirement: `ConversationMessageItem` wires `useAttachmentAction` to `MessageBubble`

`apps/chat/src/components/ConversationView/ConversationMessageItem.tsx` SHALL call `useAttachmentAction()` and pass the returned `handleAttachmentClick` as `onAttachmentClick` to every `MessageBubble` it renders (both the normal render path and the `Suspense` fallback). It SHALL also pass the i18n value of `messages.attachment.downloadLabel` as `attachmentClickLabel`.

`ConversationMessageItem` SHALL NOT implement any download or action logic itself — all resolution is delegated to `useAttachmentAction`.

#### Scenario: Clicking a user message attachment triggers a download

- **WHEN** a user message is rendered in `ConversationMessageItem` with a DIAL file attachment
- **THEN** clicking the attachment card triggers the `handleAttachmentClick` callback from `useAttachmentAction`
- **AND** `useAttachmentAction` initiates a browser download for the file

#### Scenario: Suspense fallback also wires the click handler

- **WHEN** the `EditMessageInput` lazy chunk is loading and the fallback `MessageBubble` is rendered
- **THEN** the fallback bubble also receives `onAttachmentClick` and the click handler is active

#### Scenario: Non-user messages are unaffected

- **WHEN** an assistant message is rendered in `ConversationMessageItem`
- **THEN** no click handler is applied to any of its content (no `onAttachmentClick` prop on `AssistantMessageBubble`)

---

### Requirement: `messages.attachment.downloadLabel` i18n key is defined

`apps/chat/src/i18n/locales/en.json` SHALL contain the key `messages.attachment.downloadLabel` with the value `"Download file"`. A corresponding `MessagesI18nKeys` member (or extension of an existing i18n key enum) SHALL be exported from `apps/chat/src/constants/translation-keys.ts`.

#### Scenario: Key exists in en.json

- **WHEN** `apps/chat/src/i18n/locales/en.json` is inspected
- **THEN** it contains `messages.attachment.downloadLabel` with a non-empty English string

#### Scenario: Translation key is consumed via typed map

- **WHEN** `ConversationMessageItem` reads `messages.attachment.downloadLabel`
- **THEN** it does so via the typed key from the i18n constants module, not a hardcoded string literal
