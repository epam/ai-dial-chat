## Context

The DIAL streaming API delivers stage data on every SSE chunk inside `choices[0].delta.custom_content.stages`. Each stage has: `index` (ordering key), `name` (human-readable label), `status` (null while running, `"completed"` when settled), and optionally `content` (accumulated markdown body). The frontend reads only `choices[0].delta.content` and ignores everything else.

State before this change:
- `StreamChunkDelta` in `libs/chat-shared` — no `custom_content.stages` handling.
- `Stage.content` — absent from the type.
- `Conversation.tsx` `onChunk` handler — appends text tokens only.
- `ConversationView.tsx` — renders text content only.

## Goals / Non-Goals

**Goals:**
- Parse `custom_content.stages` from every streaming chunk.
- Accumulate `stage.content` across chunks (append, do not replace).
- Merge incoming stages into the live assistant message by `index` (upsert).
- Render a `StagesPanel` above the text content for assistant messages that have stages.
- Per-stage collapsible markdown body when `content` is present.
- Live status icon — spinner on the last running stage during streaming, settled icons after.
- Persist accumulated stages on the message so they remain visible after streaming ends.
- Allow consuming apps to theme the panel via CSS custom properties.

**Non-Goals:**
- No backend changes — stages arrive from DIAL Core unchanged.
- No nested sub-stages (flat list only).
- No persistence migration — field is optional, existing conversations load fine.
- No stage editing beyond collapse/expand of content.

## Decisions

### 1. Where to accumulate stages — `Message.stages` vs `Message.custom_content.stages`

**Options:**
- **A. `Message.stages?: Stage[]`** — top-level field, cleanest API.
- **B. `Message.custom_content.stages?: Stage[]`** — consistent with streaming delta shape; `custom_content` already exists on `Message` and carries attachments and form schema.

**Decision: B** — `custom_content.stages` mirrors the streaming delta format exactly. No new top-level field needed; the same `MessageCustomContent` type that carries attachments now also carries stages. Backward-compatible (field is optional).

### 2. Stage content accumulation

Each streaming chunk may carry a partial `stage.content` string. Content is **appended** (not replaced) across chunks for the same stage index, mirroring how `delta.content` accumulates message text.

### 3. Extract to a dedicated library (`libs/conversation-stages`)

**Options:**
- **A. Component in `apps/chat`** — fast to ship, couples app and component forever.
- **B. New `libs/conversation-stages`** — reusable across apps; enforces lib isolation; themed via props.

**Decision: B** — stage visualisation is a self-contained UI concern. Extracting to a lib keeps `apps/chat` as a thin composition root and allows other consumers (e.g. future embedding, chat-v2) to use the same panel.

### 4. Collapse behaviour — whole-panel vs per-item

The original plan was a single collapse/expand toggle for the entire panel. During implementation this changed:

- The **panel itself is always expanded** — all stage rows are visible.
- Each **`StageItem` individually collapses/expands its `content` body** (only when `content` is present).
- This gives users access to each stage's details independently without hiding the stage list.

### 5. Status icon mapping

Use `@epam/ai-dial-ui-kit` and `@tabler/icons-react`:

| Condition | Icon | Note |
|---|---|---|
| `status === null` AND `isLive` (last running stage during streaming) | `Spinner` | Animated; from ui-kit |
| `status === null` AND NOT `isLive` | `IconAlertCircle` | Stage started but not the active one |
| `status === StageStatus.Completed` | `IconCircleCheck` | Success |
| Any other non-null status | `IconAlertCircle` | Error / unknown |

`isLive` = the stage is the last entry with `status: null` while `isStreaming` is true. Only one stage can be live at a time.

### 6. Theming via CSS custom properties

`StagesPanelProps` accepts an optional `colors: StagesPanelColors` object. The panel root element receives the resolved values as CSS custom properties (`--cs-bg`, `--cs-border`, `--cs-text`, `--cs-stage-text`, `--cs-running`, `--cs-completed`, `--cs-failed`). Defaults fall through to the app's global theme variables. This keeps the lib free of app-specific colour imports.

### 7. `StageMarkdownContent`

Stage bodies are raw markdown strings. A dedicated `StageMarkdownContent` component wraps `MarkdownRenderer` from `@epam/ai-dial-conversation-messages` and applies stage-specific class names. Code blocks get an inline copy button (`StageCodeBlock` sub-component) using `GhostIconButton`.

## Risks / Trade-offs

- **[Risk] `custom_content` shape may vary across DIAL versions** → parse defensively with optional chaining; skip silently if `stages` is absent.
- **[Risk] High-frequency stage updates cause excessive re-renders** → functional `setConversation` updater avoids stale closures; React 19 batches updates automatically.
- **[Risk] Saved conversations include stages in `custom_content`; older consumers may not expect it** → field is optional; JSON round-trip is safe.
- **[Trade-off] `StagesPanel` sits outside `MessageBubble`** — visually a unit, technically siblings. Acceptable for now; `MessageBubble` can gain a `header` slot in a future change.
- **[Trade-off] `@epam/ai-dial-conversation-messages` bundled into `conversation-stages`** — currently not listed as external in `vite.config.mts`. Should be externalised in a follow-up to avoid duplicate React-Markdown instances.
