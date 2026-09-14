## 1. Shared type

- [x] 1.1 Add `FileManagerSelectableNode` (minimal node shape: `path`, `nodeType`, `contentType?`, `contentLength?`) in `libs/chat-shared/src/types/file-manager-node.ts` and export it from `libs/chat-shared/src/index.ts`
- [x] 1.2 Widen the `isRowSelectable` prop type of `DialFileManagerShell` and `FileManagerAttachModal` from `FileManagerGridRow` to `FileManagerSelectableNode`

## 2. Selection gate

- [x] 2.1 Add `handleSelectedPathsChange` in `FileManagerAttachModal`: when `isRowSelectable` is provided, re-check every path against it via the existing `filesByPath` index, drop paths resolving to no listed node, and forward the filtered set to `onSelectedPathsChange`
- [x] 2.2 Forward selection changes unfiltered when no `isRowSelectable` predicate is provided

## 3. Host wiring

- [x] 3.1 Reduce `DialFileManagerModal.handleSelectedPathsChange` to a plain passthrough and retype its `isRowSelectable` predicate to `FileManagerSelectableNode` (rules unchanged: hidden paths, `canAttachFolders`, allowed types, max size)

## 4. Tests

- [x] 4.1 Lib behavior tests in `FileManagerAttachModal.spec.tsx`: folder rejected by the predicate, folder kept when accepted, mixed change keeps allowed file, unknown path dropped, unfiltered passthrough without predicate
- [x] 4.2 App integration tests in `DialFileManagerModal.spec.tsx`: created folder not selected when the model cannot attach folders; allowed file kept while non-selectable folder dropped from the same selection

## 5. Docs and verification

- [x] 5.1 Update `libs/chat-shared/README.md`: `FileManagerAttachModal` selection-filtering behavior and the new `FileManagerSelectableNode` section; pass `npm run validate:docs`
- [x] 5.2 Verify: targeted spec files pass, chat-shared typecheck/lint pass, chat app lint passes (apps/chat typecheck blocked only by the pre-existing `attachment-canvas` failure, reproduced on a clean tree)
