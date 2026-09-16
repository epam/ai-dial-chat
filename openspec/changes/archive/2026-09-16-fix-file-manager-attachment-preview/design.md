## Context

Issue [#8761](https://github.com/epam/ai-dial-chat/issues/8761): an image attached from the DIAL file system previews as "Failed to load file" when its card in the message box is clicked, while the same image attached locally previews fine.

Root cause (verified in code):

- `dialFileToAttachment` (`libs/chat-hooks/src/files/dial-file-to-attachment.ts:60`) satisfies the required `Attachment.file` field (`libs/chat-shared/src/models/chat.ts:338`) with a placeholder `new File([], name, { type })` — 0 bytes, content actually behind the DIAL `files/{bucket}/{path}` id in `attachment.url`.
- All four local-`File` gates in `libs/chat-hooks/src/files/attachment-canvas.ts` — `resolveAttachmentBlobUrl` (:295), `resolveAttachmentText` (:346), `hasAttachmentTextSource` (:364), `resolveImageCanvasContent` (:377) — check `'file' in attachment` before `resolvers.resolveDialUrl(attachment)`, so the placeholder always wins. The image canvas hands `URL.createObjectURL(placeholder)` to `<img>`, which decodes 0 bytes and fires `onError` → the reporter's "0-byte blob typed image/png".
- History: a `file.size > 0` guard existed since 2026-06 precisely for this case and was deliberately dropped on 2026-08-13 (`add-skill-file-preview`, archived) so that a *genuine* zero-byte local text file resolves to empty content instead of "missing" — the archived design doc considered real empty files but not the file-manager placeholder. The code moved to `libs/chat-hooks` unchanged on 2026-08-27 (`89845c649`).

Affected surface (verified by reading each resolver's source order): the two resolvers whose gates are local-`File`-first — `resolveImageCanvasContent` (:377) and `resolveAttachmentBlobUrl` (:295), which feeds `resolvePdfCanvasContent` and `resolveOoxmlCanvasContent`. Images show the reported "Failed to load file" (0-byte object URL handed to `<img>`); PDF/OOXML previews get the same 0-byte blob. **Not affected**: `resolveAttachmentText` (:331-348) already resolves `data` → DIAL download URL → local file, so text/Markdown/code/JSON/visualizer previews already fetch DIAL-hosted content, and `hasAttachmentTextSource` (:358-364) is an OR over the same sources that already conforms. Sent-message attachments are unaffected (DTO mapping produces no `file`); locally-picked attachments are unaffected (real `File`, no `url`).

## Goals / Non-Goals

**Goals:**

- A file-manager attachment previews from its real DIAL-hosted content for every content type that resolves through the two local-`File`-first gates — images and the blob path (PDF, OOXML/CSV) — in the composer and anywhere else the canvas opens it.
- Preserve the `add-skill-file-preview` behavior: a genuine local `File` (no DIAL url) still resolves locally, including zero-byte text files resolving to `''`.
- Regression tests for the placeholder+`url` shape across both affected resolver families (issue label `add-test-coverage`).

**Non-Goals:**

- Changing `Attachment.file` from required to optional, or stopping `dialFileToAttachment` from synthesizing the placeholder — the placeholder is load-bearing for the `Attachment` contract (`file` required) and for name/type display; widening the model would touch every `Attachment` consumer for no user-visible gain.
- Changing `AttachmentCanvasUrlResolvers`, `dialFileToAttachment` output, or any `@epam/ai-dial-chat-shared` model — no public API changes.
- Any backend work: the BFF `/api/v1/files/download` route serves the bytes correctly (the card thumbnail and the download button already prove it).
- Re-adding a `file.size > 0` guard.

## Decisions

**Decision 1 — Gate the precedence on `isFileEmpty`: a local `File` with bytes wins; the DIAL url wins only over a 0-byte `File`.**

In `resolveImageCanvasContent` and `resolveAttachmentBlobUrl`, resolve the local `attachment.file` first **when it has bytes** (`!isFileEmpty`); when the `File` is 0-byte (`isFileEmpty` — the file-manager placeholder) or absent, resolve `resolvers.resolveDialUrl(attachment)` first, keeping the (empty) local `File` as the fallback after it. `resolveAttachmentText` and `hasAttachmentTextSource` already resolve DIAL-first and need no change.

The gate exists because the composer's eager-upload flow (`libs/conversation-input/src/hooks/useAttachments.ts:176-183`) assigns the DIAL `url` at upload completion **before send** while keeping the real local `File`, and the tray card stays clickable until send. An unconditional DIAL-first flip would capture that shape too: every preview of an uploaded-but-unsent attachment would re-download bytes already in memory, and a network failure would show an error canvas despite the exact bytes sitting in `attachment.file`. Gating on `isFileEmpty` keeps that shape on the instant local preview while still routing the placeholder (always 0 bytes) to its real DIAL content.

*Why this is not the rejected `file.size > 0` re-add:* re-adding `file.size > 0` on the local-`File` branch treats a genuine zero-byte local file as "missing", reintroducing the `add-skill-file-preview` defect. The `isFileEmpty` gate instead keeps the empty-`File` branch reachable *after* the DIAL url — a genuine zero-byte local pick carries no `url`, so `resolveDialUrl` returns `undefined` and it still resolves to empty content.

*Alternatives considered:*

- *Unconditional DIAL-first flip* — rejected after code review: regresses uploaded-but-unsent previews to network-first (round trips for in-memory bytes; offline preview failure) and re-downloads large files the browser already holds.
- *Re-add `&& file.size > 0` on the local-`File` branch* — rejected: reintroduces the `add-skill-file-preview` defect (genuine zero-byte local text file treated as "missing").
- *Make `Attachment.file` optional and drop the placeholder* — rejected: type-wide refactor of every `Attachment` consumer; the precedence bug would still need fixing for callers that legitimately hold both a `file` and a `url`.

**Decision 2 — Order of the remaining fallbacks stays as-is.**

After the gated branches, each resolver keeps its current order (`previewUrl`, then inline `data`; PDF keeps its fetchable-external-`url` tail). The full priority list becomes: local `File` with bytes → DIAL download URL → 0-byte local `File` → `previewUrl` → `data`. This keeps the diff minimal and the spec delta one requirement.

**Decision 3 — Update JSDoc on both flipped sites in the same edit.**

The JSDoc on `resolveAttachmentBlobUrl`/`resolveImageCanvasContent` must state the precedence factually (a local `File` with bytes takes precedence over the DIAL download URL; a 0-byte `File` does not), per `.claude/rules/libs.md` (doc must match behavior; implementation rationale stays in code comments, not JSDoc).

**Decision 4 — Tests live in `libs/chat-hooks/src/files/tests/attachment-canvas.spec.ts`.**

The resolvers are pure functions over `(attachment, resolvers)`; no app wiring is needed. The `makeFileManagerAttachment` fixture is built by the real producer (`dialFileToAttachment`) so it cannot drift from the actual attach-flow output. Cases: the image resolver returns the download URL (not an object URL) for placeholder+`url`; `resolvePdfCanvasContent` (via `resolveAttachmentBlobUrl`) fetches the download URL (mocked `fetch`) for placeholder+`url`; an uploaded-but-unsent attachment (real `File` with bytes + `url`) previews locally with zero content fetches; a genuine local file with no `url` still resolves locally (including zero-byte text → `''`, also covered by the existing `zero-byte local file handling` block).

## Risks / Trade-offs

- [A caller holds a real local `File` with bytes AND a DIAL `url`, and the local bytes are stale relative to the DIAL copy] → the local preview wins by design. The one in-repo producer of that shape (`useAttachments` eager upload) uploads the very same bytes it keeps, so they cannot diverge; a hypothetical future producer that mutates the DIAL copy post-upload would need its own freshness story.
- [`resolveImageCanvasContent` for placeholder+`url` now returns the BFF download URL, so the `<img>` does a network fetch where it previously (broken) did not] → this is the fix; the browser HTTP cache deduplicates it with the card thumbnail `<img>` already loading the identical URL (documented in the `canvas` spec's image-rendering section).
- [Other libs or hosts re-export/call these resolvers with assumptions about local-first precedence] → checked: the resolvers are consumed through `useAttachmentCanvasResolvers` (`apps/chat/src/hooks/attachment/useAttachmentCanvasResolvers.ts`) and the `skill-file-preview` flow, both of which pass through the same seam; behavior only changes for the placeholder+`url` shape.
- [Known residual gap (out of scope): a file-manager attachment whose `url` is an absolute http(s) URL] → `dialFileToAttachment` passes such urls through with the same 0-byte placeholder, `resolveDialUrl` returns `undefined` for them, and the placeholder still shadows `previewUrl`/the external-url fallback. Identical behavior before and after this change (not a regression); fixing it needs a placeholder predicate at the `dialFileToAttachment` seam and is left for a follow-up.

## Migration Plan

Single-PR fix, no migration: frontend-only, `libs/chat-hooks` internal precedence. Rollback = revert the commit.

## Open Questions

(none — the reproduction, root cause, and blast radius were verified in code during exploration.)
