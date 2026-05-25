## Why

The DIAL streaming API surfaces agent reasoning as a list of stages inside each SSE chunk (`choices[0].delta.custom_content.stages`), but the chat frontend ignores this field entirely. Users have no visibility into what the model is doing between sending a message and receiving the final answer, making multi-step tool-calling responses feel opaque.

## What Changes

- **Extend `StreamChunk` types** in `libs/chat-shared` to include `custom_content.stages` inside `StreamChunkDelta`, with a new `Stage` interface (`index`, `name`, `status`) and a `StageStatus` enum.
- **Extend `Message`** in `libs/chat-shared` to carry an optional `stages` array so accumulated stage data survives after streaming ends.
- **Update streaming handler** in `apps/chat` (`Conversation.tsx`) to accumulate stages from incoming chunks and merge them into the in-progress assistant message.
- **New `StagesPanel` component** in `apps/chat` to render accumulated stages as a collapsible tree with appropriate status icons (running spinner, success check, error indicator).
- **Integrate `StagesPanel`** into the assistant message bubble inside `ConversationView`.

## Capabilities

### New Capabilities

- `stage-visualization`: Real-time display of streaming agent stages inside the chat assistant message bubble — collapsible tree, live status icons, and persisted on the final saved message.

### Modified Capabilities

- `conversations-api`: The `Message` type now has an optional `stages` field; existing persisted conversations without stages continue to work unchanged (field is optional).

## Impact

- **`libs/chat-shared`**: `chat.ts` — adds `Stage`, `StageStatus`, mutates `StreamChunkDelta` and `Message`.
- **`apps/chat`**: `Conversation.tsx` (streaming handler), new `StagesPanel/StagesPanel.tsx` component, `ConversationView.tsx` (render stages in message bubble).
- **No backend changes required** — stages already arrive in the SSE stream from DIAL Core; this is a pure frontend change.
- **No breaking API changes** — `stages` is optional on `Message`; stored conversations without it deserialise correctly.
