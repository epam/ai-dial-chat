# Design

## Context

`libs/conversation-stages` renders `Stage[]` via `StagesPanel` -> `StageItem` (and `StagesPanel` -> `StageGroupRow` -> `StageItem` for repeated-name groups), with `CollapsedGroup` as the outer wrapper apps/chat mounts. `Stage.attachments?: MessageAttachment[]` (`libs/chat-shared/src/models/chat.ts:166`) is already populated end-to-end by the merge pipeline (`toStage`/`mergeStages` in `libs/chat-hooks/src/conversation/stage.ts`, mirrored server-side in `apps/chat-api/src/conversations/utils/apply-chunk-stages.server.ts`) but `StageItem.tsx` only reads `stage.content`. See proposal.md for the network-trace evidence and root cause.

`libs/conversation-messages`' `AssistantMessageBubble` already renders read-only, message-level attachments via `AttachmentGroup`/`AttachmentCard` from `@epam/ai-dial-attachment-input`, declared as a plain `dependencies` entry (not a peer) in its `package.json`. The host (`ConversationMessageItem.tsx`) maps `MessageAttachment[]` to `DisplayAttachment[]` and wires click handling to `useAttachmentAction`'s `handleAttachmentClick`, which — for an attachment carrying inline `data` — just downloads it; a reference-only attachment (`referenceUrl`, no `data`) opens a PDF-typed canvas via `referenceAttachmentToPdfCanvasContent`. Neither branch previews generic markdown text. The actual markdown-preview primitive already used elsewhere in the same file is `handleTableOpenInCanvas`: `openCanvas({ type: AttachmentContentType.Markdown, text }, title)`.

## Goals / Non-Goals

**Goals:**
- Make `stage.attachments` visible inside the same expandable body `stage.content` already uses.
- Render each attachment as a real attachment tile, reusing the same component (`AttachmentCard`) and visual language the composer tray and message-level attachments already use, rather than a bespoke markup block.
- Let a click on a tile preview the attachment's markdown `data` in the existing attachment-canvas panel — the same in-app preview experience message-level attachments already get for markdown tables — without teaching `libs/conversation-stages` anything about DIAL file paths, the canvas panel, or download URLs.

**Non-Goals:**
- No change to how `stage.attachments` are merged/accumulated during streaming (`chat-hooks`, `chat-api`) — already correct.
- No reuse of `useAttachmentAction`/`handleAttachmentClick`'s download-first branch — it doesn't preview `data`-carrying attachments, so it's the wrong primitive for this case (see Decisions).
- No support for rendering non-text attachment `data` (e.g. base64 images) in this change — every attachment observed carries `type: "text/markdown"`. A future change can extend the click handler if other MIME types show up.

## Decisions

**Render each attachment as an `AttachmentCard` tile, reusing `@epam/ai-dial-attachment-input` as a `dependencies`-role import.** Matches the `conversation-messages` precedent exactly (same package, same role) instead of a bespoke lib-local rendering — one shared, already-shipped read-only tile beats a parallel implementation.

**Keep `@epam/ai-dial-attachment-input` where it is; don't relocate `AttachmentCard`/`AttachmentGroup` to `@epam/ai-dial-ui-kit` or split them into a new lib.** `ui-kit` has zero dependency on `chat-shared` and is deliberately domain-agnostic, while `AttachmentCard`'s props are bound to chat-domain types (`DisplayAttachment`, `RequestStatus`, `AttachmentType`) — moving it would invert that boundary, not just relocate a component. A shared sibling lib consumed by several unrelated domain libs as a plain `dependency` is also the norm here (`@epam/ai-dial-sidebar`, `@epam/ai-dial-builder-form` follow the same shape). The narrower observation — `attachment-input`'s manifest describes it as upload/drag-and-drop-specific, which no longer matches half its consumers — is accepted as pre-existing, deliberately deferred tech debt, not something this change addresses.

**Map `MessageAttachment[]` to `DisplayAttachment[]` inside the lib, via `messageAttachmentsToDisplayAttachments` from `@epam/ai-dial-chat-shared` (already a peer).** Doing the mapping inside `StageItem` keeps the existing `Stage[]` prop shape untouched — no parallel `DisplayStage` type needed across the prop boundary.

**Render tiles directly via `AttachmentCard`, not `AttachmentGroup`.** `AttachmentGroup` always renders a header and, once `onAttachmentClick` is supplied, a "download all" button that (with no `onDownloadAll`) invokes `onAttachmentClick` once per attachment — firing our canvas-preview handler N times for one click. Bare `AttachmentCard` tiles in a plain `role="list"` row avoid that and the unneeded header chrome.

**Expandability becomes `!!stage.content || !!stage.attachments?.length`.** Minimal change to `StageItem`'s existing boolean gate; keeps the "no toggle for a truly empty stage" behavior the spec already covers.

**Click wiring is a caller-supplied `onAttachmentClick: (attachment: DisplayAttachment) => void`, not a URL resolver.** `StageItem` resolves the clicked tile's `id` back to its full `DisplayAttachment` and hands the whole object to the host — simpler than `AttachmentGroup`'s own `onAttachmentClick(id: string)`, which forces the caller to look the object back up. The host (`ConversationMessageItem.tsx`) implements `handleStageAttachmentClick`: `data`-carrying attachments open via `openCanvas({ type: AttachmentContentType.Markdown, text: attachment.data }, attachment.name)` (the same primitive `handleTableOpenInCanvas` already uses); a reference-only attachment opens the `resolveMarkdownUrl`-resolved URL in a new tab. Same "accept a callback, never construct the URL/open the canvas from inside the lib" isolation boundary as before — only the callback's shape changed.

**Attachment title rendering does not go through i18n.** Attachment `title`/`data` are agent-produced content, not UI copy — consistent with the lib-wide "no i18n in libs" rule. The one new user-visible string, `attachmentClickLabel` (defaults to `'Preview search result'`), follows the standard English-default-prop pattern.

**No new `StagesPanelColors` entries.** `AttachmentCard` carries its own `AttachmentCardStyles`/color-token contract; no per-tile color override was requested, so none is exposed.

**Override the mapped tile's `contentType` with the attachment's own declared `type`.** The generic mapper prioritizes a type inferred from `reference_url`'s path over the wire's `type` — correct when `reference_url` points at the attachment's own file, wrong here since a stage attachment's `reference_url` points at the *source document a snippet was extracted from* (e.g. a `.csv`), while the snippet's own `data` is markdown/plain text regardless of that source format. `annotationToDisplayAttachment` (citation attachments in `libs/quotations`, the same "snippet + pointer back to source" shape) already sets `contentType: att.type` directly for this reason — the precedent this change follows. `mapStageAttachmentsToDisplay` (`conversation-stages/src/utils/stage-attachments.ts`) wraps `messageAttachmentsToDisplayAttachments` and overrides each result's `contentType` with its original `MessageAttachment.type` when declared, matched back by the same `id` derivation (`url ?? data ?? title`) the shared mapper uses, so the override survives its de-duplication. With no declared `type`, the inferred value is kept.

## Risks / Trade-offs

- **`AttachmentCard`'s default `clickLabel` doesn't describe a preview action** → overridden via the new `attachmentClickLabel` label (default `'Preview search result'`).
- **Large attachment counts** (8–10 snippets per stage in the RAG example) → tiles wrap in a `flex flex-wrap` row (matching `AttachmentGroup`'s own layout), no fixed-height scroll container needed.
- **`messageAttachmentsToDisplayAttachments` synthesizes `id` as `dto.url ?? dto.data ?? dto.title`** — for a `data`-carrying attachment, `id` is the entire snippet text, and de-duplication drops a later attachment whose `id` collides with an earlier one. Accepted as-is: same behavior message-level attachments already have; no collision observed in the field traces so far.
- **`reference_url` semantics are undocumented** (always a DIAL file path? could be external?) → the host's `resolveMarkdownUrl` already handles both cases, so no new assumption is introduced.

## Migration Plan

Additive, backward-compatible: existing stages with only `content` render unchanged. No data/schema migration. Rollback is a plain revert of the `StageItem`/`StagesPanel`/`CollapsedGroup`/model/`package.json` changes and the `ConversationMessageItem.tsx` wiring.
