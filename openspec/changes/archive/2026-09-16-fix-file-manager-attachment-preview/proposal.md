## Why

Clicking an image card attached from the DIAL file system in the message box opens the preview panel with "Failed to load file" instead of the image (issue [#8761](https://github.com/epam/ai-dial-chat/issues/8761)). The canvas receives an object URL over a 0-byte blob because `dialFileToAttachment` synthesizes a placeholder `new File([])` to satisfy the required `Attachment.file` field, and the two attachment-canvas content resolvers that check `'file' in attachment` before trying the DIAL download URL — `resolveImageCanvasContent` and `resolveAttachmentBlobUrl` (which feeds the PDF and OOXML/CSV resolvers) — let the empty placeholder shadow the real DIAL-hosted content. The text-based resolvers (`resolveAttachmentText` and everything built on it) already resolve the DIAL URL before the local file and are unaffected. The `.size > 0` guard that previously prevented this was deliberately dropped in the `add-skill-file-preview` change (archived 2026-08-13) to let genuine zero-byte local text files resolve to empty content, without accounting for the file-manager placeholder.

## What Changes

- In the two local-`File`-first gate sites of `libs/chat-hooks/src/files/attachment-canvas.ts` (`resolveAttachmentBlobUrl` and `resolveImageCanvasContent`), gate the precedence on `isFileEmpty` (`file.size === 0`): a local `attachment.file` with bytes resolves first (instant in-memory preview — also covers the composer's uploaded-but-unsent attachments, which carry a real `File` plus the DIAL `url` from eager upload); when the `File` is the 0-byte file-manager placeholder or absent, a DIAL file id in `attachment.url`/`attachment.referenceUrl` resolves through the host-injected download-URL resolver first, with the empty local `File` kept as a later fallback. `resolveAttachmentText` and `hasAttachmentTextSource` already resolve DIAL-first and are unchanged.
- Preserve the `add-skill-file-preview` behavior: a genuine locally-picked file (which carries no `url` in the composer) still resolves from `attachment.file`, including zero-byte text files resolving to empty content.
- Keep `dialFileToAttachment`'s placeholder `new File([])` as-is — `Attachment.file` remains a required `File` in `@epam/ai-dial-chat-shared`; only the resolver precedence changes.
- Add regression tests covering a file-manager-shaped attachment (placeholder `File` + `files/{bucket}/{path}` url) across the image and blob/PDF resolvers (issue carries the `add-test-coverage` label).

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `canvas`: content-resolution precedence for the image and blob-based resolvers changes — a local `attachment.file` with bytes SHALL resolve first; a DIAL-hosted `files/{bucket}/{path}` id in `url`/`referenceUrl` SHALL resolve before a 0-byte local `File` (the file-manager placeholder), so file-manager attachments preview from their real DIAL content while uploaded-but-unsent attachments keep their instant in-memory preview.

## Impact

- **Code**: `libs/chat-hooks/src/files/attachment-canvas.ts` (two gate sites + their JSDoc); `libs/chat-hooks/src/files/tests/attachment-canvas.spec.ts` (new cases).
- **No API/contract changes**: `AttachmentCanvasUrlResolvers` keeps its shape; `dialFileToAttachment` output is unchanged; `@epam/ai-dial-chat-shared` models untouched.
- **Behavior**: only attachments that carry BOTH a placeholder/empty local `File` AND a resolvable DIAL url change behavior — file-manager composer attachments previewing as **images or via the blob path (PDF, OOXML/CSV)**. Text-based previews (text/Markdown/code/JSON/visualizer) already resolved DIAL-first and are unchanged, as are locally-picked attachments, sent-message DTO attachments (no `file`), and stage/inline-`data` attachments.
- **Docs**: `canvas` capability spec gains the precedence requirement; no README API drift (no public exports change shape).
