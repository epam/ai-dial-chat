# Design: fix-file-manager-attach-selection-gate

## Context

The attach-files modal is a three-layer composition: the external `@epam/ai-dial-react-file-manager` package renders the grid and owns the `autoSelectUploadedItems` behavior; `FileManagerAttachModal` (libs/chat-shared) supplies popup chrome, the attach footer, and the `filesByPath` index over `controller.items` + `searchResults`; the host app (`DialFileManagerModal`) owns `selectedPaths` state and the `isRowSelectable` predicate that encodes the selected deployment's constraints (hidden paths, `canAttachFolders`, allowed MIME types, max size).

The bug (issue #8760): the package's auto-select effect calls the controlled `setSelectedPaths`/`onSelectedPathsChange` callback directly — never consulting AG Grid's `rowSelection.isRowSelectable`, where the predicate is enforced for manual clicks. Its internal filter checks only `contentType`/`contentLength`, both vacuous for a folder, so a newly created folder entered the host's selection state with no visible tick (the grid checkbox stays disabled) and was attachable as an `application/octet-stream` file.

Selection in the package is fully controlled (`selectedPaths` prop + `onSelectedPathsChange`), so a filtered response at the host boundary never displays as selected anywhere ("N items selected", bulk toolbar, row highlights all derive from the prop value).

## Goals / Non-Goals

**Goals:**

- Selection entering the attach modal follows exactly the same rules as a manual grid click, for every host of `FileManagerAttachModal`.
- No duplicated selection-rule logic between the lib and the app.
- No breaking change to `FileManagerAttachModal`/`DialFileManagerShell` public props.

**Non-Goals:**

- Changing `@epam/ai-dial-react-file-manager` (published package; its auto-select effect still needs an upstream fix so created folders are never auto-selected at all — see Risks).
- Gating the standalone file-manager page (`DialFileManagerShell` used directly by `DialFileManagerPage`): it passes no `isRowSelectable` and has no attach constraints; folder selection there is legitimate.
- Attach-time folder filtering in `handleAttach` — selection-time gating is sufficient and keeps one enforcement point.

## Decisions

**Filter inside `FileManagerAttachModal`, not the app modal.**
The lib already builds the path→`DialFile` index (`filesByPath`) and already receives `isRowSelectable` and `onSelectedPathsChange` as props; the app would have had to duplicate both. Filtering at the lib boundary also fixes every host of the shared modal, not only the chat app. The app's `handleSelectedPathsChange` became a plain passthrough.

**Reuse `isRowSelectable` as-is; no separate "extra checks".**
The predicate already encodes every constraint (hidden paths, folders, MIME, size). Re-running it on selection changes makes manual-click and programmatic selection rules identical by construction — the issue's expected behavior #2.

**New `FileManagerSelectableNode` type instead of a cast.**
`DialFile.id` is optional while `FileManagerGridRow.id` is required, so a `DialFile` is not assignable to `FileManagerGridRow` without a cast. A minimal structural shape (`path`, `nodeType`, `contentType?`, `contentLength?`) — placed in `libs/chat-shared/src/types/` per the lib's types convention — is satisfied by both, and by parameter contravariance a predicate accepting it remains assignable to AG Grid's `rowSelection.isRowSelectable` (`GridRow = FileManagerGridRow`). Both components' `isRowSelectable` prop types were widened to it.

*Alternative considered (rejected):* `file as FileManagerGridRow` cast in the lib — contained but hides the shape mismatch; the shared type makes the contract explicit and reusable.

**Passthrough when no predicate is provided.**
Hosts that pass no `isRowSelectable` get selection changes forwarded unfiltered — zero behavior change for the standalone/predicate-less usage pattern.

**Drop paths resolving to no listed node.**
The package's own pruning effect removes selected paths absent from the items tree, so dropping them at the filter is consistent, not new behavior.

## Risks / Trade-offs

- [Auto-select still fires then gets dropped] → A created folder on a folder-attachable model is still auto-selected (it passes `isRowSelectable`); issue #8760 expected-behavior #1 ("never auto-select a created folder") needs the upstream package fix — auto-select and manual clicks are indistinguishable at the callback layer. Mitigation: file the upstream issue; the repo-side gate already prevents every constraint violation.
- [Selection-change filter runs on manual clicks too] → Harmless: AG Grid already enforces `isRowSelectable` on manual clicks, so allowed items pass unchanged; verified by the existing "attaches selected folder when canAttachFolders is true" test flowing through the filter.
- [`filesByPath` recomputation] → The index already existed for attach-time resolution; the filter adds no new memoization cost.
- [Pre-existing `@epam/ai-dial-attachment-canvas` typecheck failure blocks `@epam/chat:typecheck` in affected runs] → Unrelated to this change (reproduces on a clean tree); tracked separately.

## Migration Plan

Change is already implemented on `fix/file-manager-image-attachement`; no deploy steps. Rollback is reverting the single commit.

## Open Questions

None — the upstream package fix (auto-select consulting a selectability predicate) remains the only follow-up and lives outside this repo.
