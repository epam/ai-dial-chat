## Why

Users editing messages see a "Save & Submit" button, but unlike the "Send" button in the message input area, it provides no tooltip explanation for why it might be disabled. This creates inconsistency in UX and leaves users uncertain about what actions are required before they can save their edits (e.g., "wait for attachments to load", "type a message"). Tooltips improve discoverability and reduce confusion.

## What Changes

Add tooltip-explanation to the "Save & Submit" button that appears when editing user or assistant messages, showing the same types of helpful context as the Send button:

- **Upload in progress**: "Wait for attachment to load"
- **Empty content**: "Please type message" or equivalent
- **Transcription in progress** (user messages): "Wait for transcription to complete"
- Tooltip hidden when button is enabled and ready to submit

## Capabilities

### New Capabilities
- `edit-message-save-tooltip`: Tooltip support for Save & Submit button when editing messages (user and assistant), with conditional display based on button disabled state and context (file uploads, empty content, transcription).

### Modified Capabilities
- `message-editing`: Existing message editing capability will gain tooltip explanations on the Save & Submit action button.

## Impact

**Affected components:**
- `apps/chat/src/components/Chat/ChatMessage/ChatMessageContent/UserMessage.tsx` — Add tooltip to Save & Submit button for user message edits
- `apps/chat/src/components/Chat/ChatMessage/ChatMessageContent/AssistantMessage.tsx` — Add tooltip to Save & Submit button for assistant message edits
- Possibly `apps/chat/src/components/Chat/ChatMessage/ChatMessageContent/` shared logic or new helper for tooltip generation

**Affected store domains:**
- None directly (tooltip is purely UI/presentational)

**Dependencies:**
- Uses existing `DialPrimaryButton` component with `tooltipProps` from `@epam/ai-dial-ui-kit` (same pattern as Send button)
- Follows same i18n pattern as other tooltips (ChatI18nKeys)

## Non-goals

- Changing disable conditions or button behavior
- Adding keyboard shortcuts or accessibility features beyond existing patterns
- Modifying the Send button's tooltip implementation (as reference only)
- Adding new message states or validation logic
