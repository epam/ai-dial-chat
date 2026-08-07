## Why

The DIAL streaming API surfaces agent reasoning as a list of stages inside each SSE chunk (`choices[0].delta.custom_content.stages`), but the chat frontend ignored this field entirely. Users had no visibility into what the model is doing between sending a message and receiving the final answer, making multi-step tool-calling responses feel opaque.

## What Changed

- **Extended `Stage` interface** in `libs/chat-shared` with an optional `content?: string` field so per-stage markdown body can be accumulated and displayed.
- **Extended `Message`** in `libs/chat-shared` — stages are stored on the existing `custom_content` object (`Message.custom_content.stages?: Stage[]`), keeping the persisted shape consistent with the streaming delta format.
- **Updated streaming handler** in `apps/chat` (`Conversation.tsx`) to accumulate stages from incoming chunks and merge them into the in-progress assistant message via upsert-by-index.
- **New `libs/conversation-stages` library** containing all stage UI components:
  - `StagesPanel` — renders accumulated stages as a flat list; themed via CSS custom properties.
  - `StageItem` — a single stage row; collapses/expands its markdown body when `content` is present.
  - `StageIcon` — maps stage status to the correct icon (`Spinner` while live, `IconCircleCheck` on completion, `IconAlertCircle` on failure/unknown).
  - `StageMarkdownContent` — renders stage body text as formatted markdown with a copy button on code blocks.
- **Integrated `StagesPanel`** into `ConversationView` above the assistant message bubble for messages that carry stages.

## Capabilities

### New Capabilities

- `stage-visualization`: Real-time display of streaming agent stages inside the chat assistant message bubble — flat list, per-stage collapsible markdown content, live status icons, and persisted on the final saved message.

## Impact

- **`libs/chat-shared`**: `chat.ts` — `Stage` gains optional `content` field; `MessageCustomContent` already had a `stages` slot which is now populated; `StreamChunkDelta.custom_content.stages` receives incremental updates.
- **`libs/conversation-stages`**: new library — `StagesPanel`, `StageItem`, `StageIcon`, `StageMarkdownContent` components; `StagesPanelProps` / `StagesPanelColors` model types.
- **`apps/chat`**: `Conversation.tsx` (streaming handler merges stages into `custom_content`), `ConversationView.tsx` (renders `StagesPanel` above message bubble), `message-utils.ts` (new `messageHasStages` helper).
- **No backend changes required** — stages already arrive in the SSE stream from DIAL Core; this is a pure frontend change.
- **No breaking API changes** — `stages` is optional on `MessageCustomContent`; stored conversations without it deserialise correctly.
