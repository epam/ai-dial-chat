## Why

Users need to correct or refine messages they've already sent without starting a new conversation. The edit button exists in the UI but is currently non-functional, leaving users with no way to fix mistakes in earlier messages.

## What Changes

- The edit button on user message bubbles becomes functional on both desktop and mobile.
- Clicking edit transforms the message bubble into an inline editable area (styled like the conversation input) with the original text and attachments pre-populated.
- Below the editable area: attachment add button (left), Cancel and Save & Submit buttons (right).
- Saving replaces all subsequent messages and re-triggers the AI from that point.
- Multiple messages may be in edit mode simultaneously; submitting any one silently cancels the others.
- The edit button is disabled while the AI is streaming.
- Users may add or remove attachments during editing (same restrictions as the conversation input).

## Capabilities

### New Capabilities

- `edit-message`: Inline editing of user messages within a conversation — entering edit mode, modifying text and attachments, submitting (truncates subsequent messages and re-runs the AI), and cancelling.

### Modified Capabilities

- `conversation-input`: The `Input` component gains two optional extension points — `initialAttachments` to pre-populate attachments on mount, and `renderFooterActions` to replace the default send/stop button area with custom actions.

## Impact

- `libs/conversation-input` — `Input` component extended; new `EditMessageInput` component added.
- `libs/conversation-messages` — `UserMessageBubble` and `buildMessageActions` updated to support edit mode.
- `apps/chat/src/hooks/conversation/useConversationHandlers.ts` — new `handleEditMessage` handler and `editingMessageIds` state.
- `apps/chat/src/components/ConversationView/ConversationView.tsx` — wires edit state and renders `EditMessageInput` inline.
- `apps/chat/src/i18n/locales/en.json` — new translation keys for Cancel and Save & Submit labels.
