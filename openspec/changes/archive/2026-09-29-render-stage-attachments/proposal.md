# Proposal

## Why

[epam/ai-dial-chat#9116](https://github.com/epam/ai-dial-chat/issues/9116) (Case 1): RAG-agent search stages ("Combined search", "Embeddings search", "Keywords search", "Page image search") show timing but no details. Confirmed via a network trace of a live RAG-agent response: the SSE deltas only open the stage (`{index, name, status: null}`), and the persisted message shows the finished stage as `{ name: "Combined search [0.01s]", status: "completed", attachments: [{ type: "text/markdown", title: "[0.202] uploads/2026-09/glossary_terms.csv", data: "...", reference_url: "..." }, ...] }` — a populated `attachments` array and **no `content` field at all**. The RAG agent reports its search results as stage-scoped `attachments`, not `stage.content`.

`StageItem.hasExpandableContent` (`libs/conversation-stages/src/components/StageItem/StageItem.tsx:52`) is gated solely on `!!stage.content`, and nothing in `libs/conversation-stages` (`StageItem`, `StagesPanel`, `CollapsedGroup`) reads `stage.attachments` at all — confirmed by grep, zero matches. The data survives the merge pipeline (`toStage`/`mergeStages` in `libs/chat-hooks/src/conversation/stage.ts` and `apps/chat-api/src/conversations/utils/apply-chunk-stages.server.ts` both already merge `attachments` by index) but is dropped at render time. Users see a row with a timing label and no way to see what was actually found.

## What Changes

- `StageItem` treats a stage as expandable when it has `stage.content` **or** a non-empty `stage.attachments`, not `stage.content` alone.
- Each stage attachment renders as an `AttachmentCard` tile (from `@epam/ai-dial-attachment-input`, the same composer-tray tile component `libs/conversation-messages` already reuses for message-level attachments), in a wrapping row below any `stage.content`. Attachments are mapped from the raw `MessageAttachment` wire shape to `DisplayAttachment` via `messageAttachmentsToDisplayAttachments` (already exported from the peered `@epam/ai-dial-chat-shared`).
- Clicking/activating a tile calls a new `onAttachmentClick?: (attachment: DisplayAttachment) => void` callback the host supplies — the lib never opens a preview or constructs a URL itself. The host (`ConversationMessageItem.tsx`) opens the attachment's `data` as markdown in the existing attachment-canvas panel (`openCanvas({ type: AttachmentContentType.Markdown, text }, name)`, the same primitive already used there for markdown-table previews), falling back to opening the resolved `reference_url` in a new tab for a reference-only attachment with no inline `data`.
- No change to the streaming/merge pipeline (`chat-hooks`, `chat-api`) — `attachments` already merges correctly by index; this is a rendering-only fix.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `stage-visualization`: the `StageItem` collapses/expands its content body requirement changes from "expandable only when `stage.content` is present" to "expandable when `stage.content` **or** a non-empty `stage.attachments` is present," and gains a new requirement describing how stage attachments render inside the expanded body.

## Impact

- `libs/conversation-stages/package.json` — new `dependencies` entry: `@epam/ai-dial-attachment-input` (matches the existing `libs/conversation-messages` precedent — a `dependency`, not a peer).
- `libs/conversation-stages/src/components/StageItem/StageItem.tsx`, `StagesPanel/StagesPanel.tsx`, `CollapsedGroup/CollapsedGroup.tsx` — expandability check, attachment-tile row, `onAttachmentClick` threaded through all three.
- `libs/conversation-stages/src/models/stages-props.ts`, `collapsed-group.ts` — `onAttachmentClick?: (attachment: DisplayAttachment) => void` replaces the earlier `resolveAttachmentUrl` prop; new `attachmentClickLabel` label.
- `apps/chat/src/components/ConversationView/ConversationMessageItem.tsx` — `handleStageAttachmentClick` wired to `CollapsedGroup`, reusing the existing `openCanvas`/`AttachmentContentType.Markdown` primitive and `resolveMarkdownUrl` util already imported there.
- No change to `libs/chat-shared` (`Stage`/`MessageAttachment`/`DisplayAttachment` types and `messageAttachmentsToDisplayAttachments` already exist), `libs/chat-hooks`, or `apps/chat-api` — the merge pipeline already carries `attachments` through untouched.
- No i18n impact for the primary text-attachment path — attachment titles/`data` are agent-supplied content, not UI copy. The new `attachmentClickLabel` follows the lib convention of an English-default prop, not `useTranslation`.
- Not breaking: purely additive rendering; a stage with only `content` (today's only supported shape) renders exactly as before.
- Rollback: revert the `StageItem`/`StagesPanel`/`CollapsedGroup`/model/`package.json` changes and the `ConversationMessageItem.tsx` wiring; no data migration, no persisted-format change.
