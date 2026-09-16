## 1. Regression tests (red first)

- [x] 1.1 In `libs/chat-hooks/src/files/tests/attachment-canvas.spec.ts`, add a `makeFileManagerAttachment` helper (0-byte `new File([], name, { type })` placeholder + `url: 'files/bucket/...'`, mirroring `dialFileToAttachment`'s output) and a failing case: `resolveImageCanvasContent` returns `ImageCanvasContent` whose `url` is the resolver-produced download URL, not a `blob:` object URL over the placeholder.
- [x] 1.2 Add a failing case: `resolvePdfCanvasContent` (via `resolveAttachmentBlobUrl`) fetches from the DIAL download URL (mocked `fetch`) for the same placeholder+`url` shape, instead of object-URLing the placeholder `File` — assert the `/download` content fetch happened and the result wraps the fetched blob.
- [x] 1.3 Add guarding cases for unchanged behavior: a genuine local `File` with no `url` still resolves locally (image object URL), and the existing `zero-byte local file handling` block (zero-byte local text → `''`, `hasAttachmentTextSource` → `true`) plus the DIAL-url text path (`resolveMarkdownCanvasContent` with placeholder+`url` already fetches) still pass unchanged.
- [x] 1.4 Run `npm run test:file -- libs/chat-hooks/src/files/tests/attachment-canvas.spec.ts` and confirm the new cases fail for the reported reason (placeholder `File` wins) and the guarding cases pass.

## 2. Precedence flip

- [x] 2.1 In `libs/chat-hooks/src/files/attachment-canvas.ts`, flip `resolveImageCanvasContent`: resolve `resolvers.resolveDialUrl(attachment)` first; use `'file' in attachment` only when no DIAL URL resolves. Keep the `previewUrl`/`data` fallback order unchanged after the local-`File` branch.
- [x] 2.2 Flip `resolveAttachmentBlobUrl` the same way (DIAL fetch via `fetchDialBlob` with existing error classification first; local `File` object URL only when no DIAL URL resolves; `previewUrl`/`data` fallbacks unchanged after it).
- [x] 2.3 Confirm by reading that `resolveAttachmentText` and `hasAttachmentTextSource` already resolve DIAL-first (no edit needed); leave them untouched.
- [x] 2.4 Update the JSDoc on both flipped sites in the same edit: state that a resolvable DIAL download URL takes precedence over the local `File` because file-manager attachments carry a 0-byte placeholder `File` (`.claude/rules/libs.md` — doc must match behavior).
- [x] 2.5 Re-run the spec file: `npm run test:file -- libs/chat-hooks/src/files/tests/attachment-canvas.spec.ts` — new cases pass, guarding cases still pass.

## 3. Verification

- [x] 3.1 Run `npm run verify:changed` (typecheck/lint/test for the affected slice).
- [x] 3.2 Manual smoke on `npm run start:all`: attach an image from DIAL file system (My Files) in the message box, click the card — the preview panel renders the image; also verify a locally-attached image and a sent-message image still preview, and a file-manager PDF previews from real content.
- [x] 3.3 Confirm `npm run validate:docs` passes (no README drift; no public API changed — the `canvas` capability spec prose is synced from the delta spec at archive time).

## 4. Review refinement (code-review findings)

- [x] 4.1 Gate the DIAL-first branch on `isFileEmpty` (`file.size === 0`) in both flipped resolvers, so an uploaded-but-unsent attachment (real `File` with bytes + DIAL `url` from `useAttachments`' eager upload) keeps its instant local preview with zero network round trips.
- [x] 4.2 Rebuild `makeFileManagerAttachment` via the real producer (`dialFileToAttachment`) so the fixture cannot drift from the attach-flow output.
- [x] 4.3 Add uploaded-but-unsent regression cases: image and PDF resolvers object-URL the local `File` and issue no content fetch (red before the gate, green after).
- [x] 4.4 Compress the documentation on both sites to the factual precedence sentence in the JSDoc above each declaration (bytes-bearing `File` wins; 0-byte `File` does not) — the JSDoc alone carries the rationale, with no inline comment inside the function bodies.
- [x] 4.5 Update design.md (Decision 1/2/3/4, risks — including the corrected premise about `useAttachments` eager upload and the recorded http(s)-url residual gap), proposal.md, and the delta spec; re-run the spec file and `npm run verify:changed`.
- [x] 4.6 Restructure both resolvers so the local-`File` object-URL branch appears once: `dialUrl` is computed as `undefined` when a byte-bearing `File` exists, and the single `file != null && dialUrl == null` branch covers both the bytes-wins and empty-file-fallback positions (user review of the duplicated branch).
