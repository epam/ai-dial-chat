## Context

The DIAL streaming API already delivers stage data on every SSE chunk inside `choices[0].delta.custom_content.stages`. Each stage has three fields: `index` (ordering key), `name` (human-readable label), and `status` (null while running, a string value such as `"completed"` or `"failed"` when settled). The frontend currently reads only `choices[0].delta.content` and discards the rest of the chunk.

Current state:
- `StreamChunk` / `StreamChunkDelta` types in `libs/chat-shared` — no `custom_content` field.
- `Message` in `libs/chat-shared` — no `stages` field.
- `Conversation.tsx` `onChunk` handler — appends text tokens only.
- `ConversationView.tsx` / `MessageBubble` — renders text content only.

## Goals / Non-Goals

**Goals:**
- Parse `custom_content.stages` from every streaming chunk.
- Merge incoming stages into the live assistant message by `index` (upsert).
- Render a collapsible `StagesPanel` above the text content inside each assistant `MessageBubble`.
- Persist accumulated stages on the `Message` so they remain visible after streaming ends and the conversation is saved/reloaded.
- Reflect live stage status with appropriate icons (spinner → running, check → completed, X → failed/errored).

**Non-Goals:**
- No backend changes — stages arrive from DIAL Core and pass through unchanged.
- No support for nested sub-stages (flat list only in this change).
- No persistence migration — the `stages` field is optional; existing conversations load without issue.
- No stage editing or interaction beyond collapse/expand.

## Decisions

### 1. Where to accumulate stage state — inside `Message` vs. separate map

**Options:**
- **A. Store stages on `Message`** — `stages?: Stage[]` added to the shared type. Single source of truth; persists to the server on save; no extra state to reconcile.
- **B. Separate `Map<messageId, Stage[]>` in `Conversation.tsx`** — decouples transient UI state from the persisted model, but creates a two-source problem and loses stage data after navigation.

**Decision: A** — stages belong to the message. They are produced by the model and should survive save/reload like `content` does. The field is optional so backward-compatibility is free.

### 2. Stage merging strategy

Chunks may arrive out of order and may repeat the same `index`. Stages are merged by `index`: on each chunk, incoming stages are upserted into the accumulated list (replace-if-exists, append-if-new), then the list is sorted ascending by `index`.

This is done inside the `onChunk` callback in `Conversation.tsx` using a functional `setConversation` updater — no extra reducer needed.

### 3. `StagesPanel` — new component vs. extending `MessageBubble`

`MessageBubble` is from the `@epam/ai-dial-conversation-messages` lib and owns its own layout. We cannot easily inject arbitrary children inside it. The panel will be rendered **above** the `MessageBubble` for assistant messages that have stages, wrapped in the same row layout container already present in `ConversationView`. This keeps `ConversationView` as the composition root and avoids patching the lib.

### 4. Status icons

Use `@tabler/icons-react` as required by the project rules:
- `null` status (running) → `IconLoader2` with a `animate-spin` Tailwind class.
- `"completed"` → `IconCheck` (green).
- Any other non-null string → `IconX` (red / muted).

### 5. Collapse state

`StagesPanel` manages its own `isOpen` boolean via `useState`, defaulting to `true` (expanded) while streaming and remaining at user preference after streaming ends. The panel is collapsed by clicking the header row.

## Risks / Trade-offs

- **[Risk] `custom_content` shape may vary across DIAL versions** → Mitigation: parse defensively with optional chaining; skip silently if `stages` is absent or malformed.
- **[Risk] High-frequency stage updates cause excessive re-renders** → Mitigation: functional `setConversation` updater avoids stale closures; React 19 batches the state updates automatically. No debounce needed at this scale.
- **[Risk] Saved conversations include `stages` on `Message`; older consumers may not expect it** → Mitigation: field is `stages?: Stage[]` (optional); JSON round-trip is safe; no schema migration needed.
- **[Trade-off] `StagesPanel` sits outside `MessageBubble`** — visually they are a unit but technically siblings. This is acceptable for now; the lib can be patched to support `header` slot in a future change.
