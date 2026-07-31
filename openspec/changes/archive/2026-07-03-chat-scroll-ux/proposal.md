## Why

Today the chat view has no auto-scroll logic at all: when a user sends a message, the view stays wherever it was, so the new message and the assistant's streaming response can end up entirely off-screen until the user manually scrolls down. This breaks the baseline expectation set by virtually every other chat product (ChatGPT, Claude, etc.), where sending a message always brings the new exchange into view without forcing the user to fight the scroll position while a response streams in.

## What Changes

- On sending a message, scroll the conversation so the newly sent user message becomes visible near the top of the viewport (not the bottom), giving the upcoming streamed response room to render below it.
- While an assistant response is streaming, stop forcing the scroll position on every content update — the view only continues to track the bottom if the user was already there when streaming started (or hasn't scrolled away since).
- Introduce a "scroll to bottom" floating button that appears whenever the user is not at the bottom of the conversation and there is unseen content below (including newly arrived/streaming content), and disappears once the user returns to the bottom.
- Clicking the scroll-to-bottom button smoothly scrolls to the latest content and dismisses the button.
- Apply the same "new message near top" anchoring when regenerating a response or editing-and-resubmitting a message, so behavior stays consistent across the ways a new assistant turn can start; initial load of an existing conversation keeps landing at the bottom (no "just sent" message to anchor to).

## Capabilities

### New Capabilities
- `chat-scroll-behavior`: Defines scroll-on-send, streaming scroll suppression, and the scroll-to-bottom affordance for the chat message list.

### Modified Capabilities
(none identified — no existing spec currently documents chat scroll behavior)

## Impact

- Affected code: `apps/chat/src/components/ConversationView/ConversationView.tsx` (existing scroll subsystem: `scrollToBottom`, `userScrolledRef`, the message-count/streaming effect, the `FabButton` scroll-to-bottom affordance) which now wraps `onSend`/`onRegenerateMessage`/`onEditMessage` to capture anchor intent before delegating to the handlers already owned by `apps/chat/src/hooks/conversation/useConversationHandlers.ts` (`handleSend`, `handleRegenerateMessage`, `handleEditMessage`).
- A scroll-to-bottom button and a pinned-to-bottom auto-follow during streaming already exist and already broadly match conventional chat UX; the actual defect is that sending a message scrolls to the container's bottom rather than positioning the new message near the top, which can leave the start of a new (especially longer) message scrolled out of view — matching the reported symptom.
- No API or backend changes expected — this is a frontend-only UX change confined to `apps/chat`.
