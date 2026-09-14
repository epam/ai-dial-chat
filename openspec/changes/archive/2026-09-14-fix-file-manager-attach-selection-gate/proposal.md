# Proposal: fix-file-manager-attach-selection-gate

## Why

Issue #8760: a folder created inside the attach-files modal was auto-selected by `@epam/ai-dial-react-file-manager`'s `autoSelectUploadedItems` behavior and could be attached as an `application/octet-stream` "file", even when the selected model or agent does not support folder attachments. The package's auto-select writes to the controlled `onSelectedPathsChange` callback directly, bypassing the grid's `isRowSelectable` gate where the deployment-defined constraints (`canAttachFolders`, allowed MIME types, max size, hidden paths) are enforced — so auto-selected items could enter the host's selection state (and then the attach result) without passing the same rules as a manual click.

## What Changes

- `FileManagerAttachModal` (libs/chat-shared) re-applies the host's `isRowSelectable` predicate to every selection change before forwarding it to `onSelectedPathsChange`, reusing the modal's existing `filesByPath` index. Selection changes that did not originate from a manual grid click (the known case: auto-select of newly created/uploaded items) can no longer introduce non-selectable items.
- Paths that resolve to no listed node (not in `items` or `searchResults`) are dropped from selection changes, matching the file manager's own pruning of unknown paths.
- When no `isRowSelectable` predicate is provided, selection changes are forwarded unfiltered (no behavior change for predicate-less hosts).
- New exported type `FileManagerSelectableNode` (libs/chat-shared, `src/types/file-manager-node.ts`): the minimal node shape (`path`, `nodeType`, `contentType?`, `contentLength?`) satisfied by both grid rows and `DialFile` controller items, so one predicate can gate both. The `isRowSelectable` prop type of `FileManagerAttachModal` and `DialFileManagerShell` is widened from `FileManagerGridRow` to this shape (type-compatible with the grid's `rowSelection.isRowSelectable` via parameter contravariance).
- `DialFileManagerModal` (apps/chat) becomes a plain passthrough for selection changes; its `isRowSelectable` rules (hidden paths, `canAttachFolders`, allowed types, max size) are unchanged and are now the single source of selection gating.
- Tests: behavior-level cases in `libs/chat-shared/.../FileManagerAttachModal.spec.tsx` (folder rejected / kept when selectable, mixed selection, unknown path, unfiltered passthrough) and integration cases in `apps/chat/.../DialFileManagerModal.spec.tsx`.
- README (libs/chat-shared) documents the filtering behavior and the new type.

This change is already implemented and verified on branch `fix/file-manager-image-attachement`; the artifacts below record it retroactively.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `dial-file-manager-attach-folders`: adds a requirement that selection entering the attach modal is gated by `isRowSelectable` on every selection change (not only on manual grid clicks), so programmatically selected items (e.g. a newly created folder) follow the same rules as manual selection.

## Impact

- `libs/chat-shared/src/file-manager/FileManagerAttachModal/FileManagerAttachModal.tsx` — new `handleSelectedPathsChange` filter; `isRowSelectable` prop type widened.
- `libs/chat-shared/src/file-manager/DialFileManagerShell/DialFileManagerShell.tsx` — `isRowSelectable` prop type widened.
- `libs/chat-shared/src/types/file-manager-node.ts` — new; exported via `libs/chat-shared/src/index.ts`.
- `apps/chat/src/components/DialFileManagerModal/DialFileManagerModal.tsx` — selection handler becomes a passthrough; predicate retyped to the shared node shape.
- `libs/chat-shared/README.md` — behavior + type documentation.
- No breaking changes: the widened prop type accepts every previously valid predicate that reads only the four shared fields, and hosts without `isRowSelectable` see no filtering.
- Residual upstream gap (out of scope here): the package's auto-select effect still selects then drops; issue #8760's expected-behavior #1 ("never auto-select a created folder at all, even when attachable") requires an `@epam/ai-dial-react-file-manager` fix, since auto-select and manual clicks are indistinguishable at the callback layer.
