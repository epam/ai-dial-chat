## Why

Users have no way to recall and edit previously sent messages from the chat input — pressing the Up arrow key does nothing. This is a familiar terminal/shell UX pattern (also present in Google Gemini's UI) that reduces re-typing effort when iterating on prompts.

## What Changes

- Pressing **Up** in the chat input (when the cursor is at the start of the field or the field is empty) cycles backward through the sent-message history for that conversation.
- Pressing **Down** cycles forward, restoring the draft when returning to the most-recent position.
- The current unsent draft is preserved and restored when the user navigates back to the "bottom" of history.
- History is scoped to the current conversation and populated from user messages already sent.

## Capabilities

### New Capabilities

- `input-history-navigation`: Keyboard-driven navigation through the current conversation's sent-message history from the chat input field.

### Modified Capabilities

<!-- No existing spec-level requirements change. -->

## Impact

- `libs/conversation-input` — ConversationInput component gains Up/Down keydown handling and a history navigation hook.
- `apps/chat` — passes the ordered list of user messages from the active conversation into ConversationInput as a prop.
- No API, backend, or routing changes.
