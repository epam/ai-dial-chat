## Why

The send tooltip in `Input.tsx` is currently forwarded unconditionally. Hosts such as pg-chat need an empty-composer hint while the parent chat must retain its existing Send message tooltip.

## What Changes

- Add optional `emptyMessageTooltip` to `InputProps` and `ConversationInputProps`.
- Select it only when the composer has no sendable content, falling back to `sendTooltip` when omitted.
- Preserve the parent app's existing props, disabled state, accessible label, and send behavior.
- Document and test the public contract, including legacy callers and content changes.

## Capabilities

### New Capabilities

- `conversation-input-send-tooltip`: Host-configurable tooltips for empty and populated composers with backward-compatible defaults.

### Modified Capabilities

None.

## Impact

The change is scoped to `libs/conversation-input` and its documentation/specifications. The existing forwarding in `libs/conversation-input/src/components/ConversationInput/ConversationInput.tsx` and `hasSendableContent` in `libs/conversation-input/src/components/Input/Input.tsx` provide the implementation pattern. All localized text stays host-owned; no new translation keys or dependencies are introduced. pg-chat can pass its existing `chat.sendMessage` and `chat.sendDisabledTooltip` after consuming a release containing this API. Publishing is outside this change.

Compatibility: omitting the new prop retains the current tooltip for all message states. Removing the new prop rolls a consumer back. Alternatives considered: changing `sendTooltip` semantics globally would break the parent app; deriving the text in hosts would duplicate internal composer state.

## Acceptance Criteria

- Empty or whitespace-only drafts show the configured empty hint.
- Text, attachments, or an inline selected skill use the regular tooltip, even when sending is disabled for another reason.
- Existing callers retain their regular tooltip for both empty and populated inputs.
- Tooltip selection follows local typing, clearing, programmatic updates, and send reset.

## Non-goals

Click-triggered validation, send-button enablement changes, app-owned translations in the library, and publishing packages.
