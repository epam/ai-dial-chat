# user-message-copy Specification

## Purpose

A Copy message action on every user-authored message bubble that writes the raw prompt text to the clipboard, rendered by `MessageActions` in `@epam/ai-dial-conversation-messages` when the host app supplies `onCopy` and translated labels.

## Requirements

### Requirement: Copy message action availability
Every user-authored message in a conversation SHALL show a Copy message action in its message action toolbar, rendered before the Edit and Delete actions. The action SHALL be present for newly sent and historical (reloaded or scrolled-to) messages, in read-only conversations (shared, published, or lacking WRITE permission), and in the application-editor preview chat. It SHALL NOT be gated by `ENABLED_FEATURES` / `ENABLED_FEATURES_ROLES`, and SHALL NOT be hidden by the settings that hide Edit or Delete.

#### Scenario: Copy action on a newly sent message
- **WHEN** the user sends a prompt and it appears as a user message bubble
- **THEN** the bubble's action toolbar contains a "Copy message" button before the Edit and Delete buttons

#### Scenario: Copy action on historical messages
- **WHEN** the user reopens a conversation that already contains user messages
- **THEN** every user message bubble shows the "Copy message" button

#### Scenario: Copy action in a read-only conversation
- **WHEN** a conversation is rendered read-only so Edit and Delete are not rendered
- **THEN** the user message toolbar still renders the "Copy message" button

#### Scenario: Copy action while a response is streaming
- **WHEN** the assistant is streaming a response
- **THEN** the "Copy message" button on every user message stays enabled and clickable

#### Scenario: No copy action on status messages
- **WHEN** a status message (e.g. a model-changed notice) is rendered
- **THEN** no "Copy message" button is rendered for it

### Requirement: Copied content
Activating Copy message SHALL write the message's raw text (`Message.content`) to the system clipboard as plain text, byte-for-byte as stored, including line breaks, indentation, and any Markdown characters the user typed. Attachments and skill chips SHALL NOT be added to the copied text. The clipboard write SHALL be issued synchronously inside the click handler (via `copyToClipboard` from `@epam/ai-dial-chat-shared`) so it runs within the user gesture.

#### Scenario: Single-line prompt
- **WHEN** the user clicks "Copy message" on a message whose content is `Summarize this file`
- **THEN** the clipboard contains exactly `Summarize this file`

#### Scenario: Multiline prompt keeps line breaks
- **WHEN** the user clicks "Copy message" on a message whose content is `Line one\n\n- item a\n- item b`
- **THEN** the clipboard contains exactly `Line one\n\n- item a\n- item b`

#### Scenario: Collapsed long message is copied in full
- **WHEN** a long user message is shown collapsed behind "Show more" and the user clicks "Copy message"
- **THEN** the clipboard contains the complete message content, not only the visible portion

### Requirement: Copy does not mutate the conversation
Activating Copy message SHALL NOT edit, resend, regenerate, truncate, or delete the message or any other message, SHALL NOT enter edit mode, and SHALL NOT persist anything to the conversation.

#### Scenario: Message and conversation unchanged after copy
- **WHEN** the user clicks "Copy message" on a user message
- **THEN** the message list, the message content, and the conversation's stored state are unchanged
- **AND** no edit input opens and no request to the model is sent

### Requirement: Copy feedback and accessibility
The Copy message button SHALL show the tooltip "Copy message" (i18n key `buttons.copyMessage`) and expose the accessible name "Copy message" (same key). After a click it SHALL switch to the existing copied state — copied icon and tooltip "Copied!" (`buttons.copied`) — for 2 seconds, then revert, and SHALL announce "Message copied to clipboard" (i18n key `buttons.messageCopiedStatus`) through the toolbar's existing polite `aria-live` status region. The button SHALL be a native button reachable by Tab and activatable by Enter and Space, and its icon SHALL be `aria-hidden`. The copy icon is direction-agnostic and SHALL NOT be mirrored in RTL; button order follows the toolbar's flex flow, so it flips with `dir="rtl"` without physical-direction classes.

#### Scenario: Tooltip on hover
- **WHEN** the user hovers or focuses the "Copy message" button
- **THEN** the tooltip "Copy message" is displayed

#### Scenario: Visual confirmation after copy
- **WHEN** the user clicks "Copy message"
- **THEN** the button shows the copied icon and the tooltip "Copied!"
- **AND** after 2 seconds the button returns to its default icon and tooltip

#### Scenario: Screen reader announcement
- **WHEN** the user activates "Copy message" with the keyboard
- **THEN** the toolbar's status region announces "Message copied to clipboard"

### Requirement: Library contract for user-role copy
`MessageActions` in `@epam/ai-dial-conversation-messages` SHALL render a copy button for `role = MessageRole.User` when, and only when, the host passes `onCopy`. Its labels SHALL come from the new optional fields `MessageActionTooltips.copyMessage` and `MessageActionAriaLabels.copyMessage`, defaulting to the English string "Copy message"; plus `MessageActionAriaLabels.copiedMessageStatus` for the announcement (default "Message copied to clipboard"); the copied tooltip reuses `tooltips.copied`. The lib SHALL NOT call the clipboard, read i18n, or decide availability itself — the host app's `buildMessageActions` adapter supplies `onCopy` and the translated labels. Copied-state, timer, and label handling SHALL reuse the existing `handleCopy` `useCallback` so no new memoisation is introduced. No backend endpoint, cache, or telemetry is added.

#### Scenario: User toolbar without onCopy is unchanged
- **WHEN** a host renders `MessageActions` with `role={MessageRole.User}` and only `onEdit`/`onDelete`
- **THEN** no copy button is rendered

#### Scenario: User toolbar with onCopy
- **WHEN** a host renders `MessageActions` with `role={MessageRole.User}` and `onCopy`
- **THEN** a button named "Copy message" is rendered before Edit/Delete and clicking it calls `onCopy` once

#### Scenario: Translated labels are applied
- **WHEN** the host passes `labels.tooltips.copyMessage` and `labels.ariaLabels.copyMessage`
- **THEN** the button uses those strings instead of the English defaults
