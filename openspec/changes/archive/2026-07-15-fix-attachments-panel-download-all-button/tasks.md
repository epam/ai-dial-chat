## 1. Extract reusable single-file download logic

- [x] 1.1 In `apps/chat/src/hooks/attachment/useAttachmentAction.ts`, extract the DIAL-hosted download branch (`isDialFileId` check → `resolveDialFileDownloadUrl` → `triggerAnchorDownload`) out of `handleAttachmentClick` into a standalone function, e.g. `downloadAttachment(attachment: DisplayAttachment): boolean` returning whether a download was actually triggered.
- [x] 1.2 Update `handleAttachmentClick` to call `downloadAttachment` for the download branch, preserving its existing fallback behavior for non-downloadable attachments (viewer/annotation path unchanged).
- [x] 1.3 Export `downloadAttachment` (or an equivalent hook API, e.g. `useAttachmentAction().downloadAttachment`) so the panel container can reuse it.

## 2. Wire `onDownloadAll` through the lib boundary

- [x] 2.1 Add `onDownloadAll?: () => void` to `ConversationSourcesPanelProps` in `libs/source-panel/src/models/conversation-sources-panel-props.ts`, with JSDoc noting it is omitted when there is nothing downloadable.
- [x] 2.2 In `libs/source-panel/src/components/ConversationSourcesPanel/ConversationSourcesPanel.tsx`, replace the hardcoded `disabled` on the top-right Download button with `disabled={!onDownloadAll}` and add `onClick={onDownloadAll}`. Do not introduce any file-URL or DIAL-specific logic in this lib file.

## 3. Implement the app-level download-all handler

- [x] 3.1 In `apps/chat/src/components/ConversationSourcesPanel/ConversationSourcesPanel.tsx`, compute whether at least one attachment in `uploaded` or `generated` is downloadable (same DIAL-file-URL check used by `downloadAttachment`/`isDialFileId`).
- [x] 3.2 Implement `handleDownloadAll`, iterating `[...uploaded, ...generated]`, calling `downloadAttachment` for each, skipping attachments that aren't downloadable, and sequencing calls with a small delay between triggers to avoid browser multi-download blocking.
- [x] 3.3 Pass `onDownloadAll={hasDownloadableAttachment ? handleDownloadAll : undefined}` to the lib's `ConversationSourcesPanel`.

## 4. Tests

- [x] 4.1 Unit test `downloadAttachment` (or the extracted function) for: DIAL-hosted attachment triggers a download; non-DIAL/reference-only attachment does not.
- [x] 4.2 Unit test the app container: download-all button prop is `undefined` (thus rendered disabled) when no attachment is downloadable, and defined when at least one is.
- [x] 4.3 Unit test `handleDownloadAll` triggers one download per downloadable attachment across `uploaded` + `generated`, and skips non-downloadable ones.
- [x] 4.4 Update/add a test on the lib's `ConversationSourcesPanel` confirming the Download button's `disabled` attribute follows `onDownloadAll` presence and that `onClick` invokes the passed callback.

## 5. Verification

- [x] 5.1 Run `npm exec nx test source-panel` and `npm exec nx test chat` (or the affected equivalents) and confirm they pass. **Blocked by pre-existing environment issues unrelated to this change** — confirmed via `git stash` that both failures exist on the unmodified branch: (a) `@epam/ai-dial-source-panel` tests fail with `Cannot read properties of undefined (reading 'config')` for all spec files in the project, including ones this change didn't touch; (b) `@epam/chat` tests that import `useAttachmentAction` fail with `ReferenceError: DOMMatrix is not defined` because `@epam/ai-dial-attachment-canvas` transitively pulls in `pdfjs-dist`, which needs a `DOMMatrix` polyfill missing from this vitest/jsdom environment. Typecheck and lint for both projects pass with the new tests included.
- [x] 5.2 Run `npm exec nx lint source-panel` and `npm exec nx lint chat` and confirm no violations, including module-boundary/lib-isolation lint rules. Both pass (0 errors); remaining warnings are pre-existing and in unrelated files.
- [ ] 5.3 Manually verify in the running app: open a conversation with uploaded and/or generated attachments, open the sources panel, confirm the Download button is enabled and clicking it downloads the attachments; confirm the button stays disabled when the panel has no downloadable attachments.
