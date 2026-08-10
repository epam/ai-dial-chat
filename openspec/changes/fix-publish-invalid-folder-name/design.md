## Context

The Publish dialog's destination-folder picker (`apps/chat/src/components/Chat/ChangePathDialog.tsx`) and the generic file manager (`apps/chat/src/components/FileManager/hooks/useFileManager.tsx`) both render new-folder creation UI through the external `DialDestinationFolderPopup` / file-tree components from `@epam/ai-dial-ui-kit` (npm package, not part of this monorepo — its Enter-key and click handlers are compiled/minified and cannot be patched here).

Both call sites wire two **independent** callbacks into the ui-kit component:
- an `onCreateFolder*` callback that performs the actual creation (`handleCreateOrganizationFolder` in `ChangePathDialog.tsx:596-611`, `handleCreateFolder` in `useFileManager.tsx:1557-1576`)
- an `onCreateFolderValidate` callback that only computes an error string for display (`handleCreateFolderValidate` in `ChangePathDialog.tsx:613-621` and `useFileManager.tsx:1650-1656`, both delegating to `handleRenameValidation`)

The ui-kit component is expected to block invoking `onCreateFolder*` when `onCreateFolderValidate` returns a non-null error, but per the bug report it does not (or the two are invoked independently regardless of the shown error). Since the ui-kit source isn't available in this repo, the fix must not depend on the ui-kit enforcing this — it must be enforced defensively in this repo's own handlers, which is also the pattern already used correctly by `apps/chat/src/components/Folder/Folder.tsx`'s `handleRename` (lines 456-540): validation runs inside the submit handler itself and returns early, so no caller (Enter key, click, or otherwise) can bypass it.

## Goals / Non-Goals

**Goals:**
- Make `handleCreateOrganizationFolder` (`ChangePathDialog.tsx`) and `handleCreateFolder` (`useFileManager.tsx`) each independently re-validate before dispatching a create-folder action, regardless of what the ui-kit component does with `onCreateFolderValidate`.
- Keep the existing validation rules (`getEntityNameSchema`, max-depth check) as the single source of truth — reuse `handleCreateFolderValidate`/`handleRenameValidation`, don't duplicate validation logic.
- Preserve existing dedup/temp-folder bookkeeping (`deduplicatedFileIdsRef`, `addedTempFolderIdsRef`, `pendingNewFolderIdRef`) exactly as-is for the valid path.

**Non-Goals:**
- Changing or patching `@epam/ai-dial-ui-kit` / `DialDestinationFolderPopup` behavior.
- Changing validation rules themselves (regex, max depth, reserved names, etc.).
- Touching folder rename flows (already correct, per `Folder.tsx`).

## Decisions

1. **Enforce validation inside the creation handlers, not by tightening the ui-kit contract.**
   Alternative considered: file a fix/report against `@epam/ai-dial-ui-kit` and wait for a package update. Rejected as the sole fix because it leaves this app vulnerable to the same bug for as long as the dependency is unpatched, and this repo can defend itself without an external change. Filing an upstream issue can still happen in parallel but is out of scope for this change's tasks.

2. **Derive the `(name, parentFolder)` pair needed by `handleRenameValidation`/`handleCreateFolderValidate` from the same inputs already available in each handler** (`folderPath`, and the resolved `DialFile` for the parent, already resolvable via existing refs/selectors in each file — e.g. `filesFoldersRef.current` in `ChangePathDialog.tsx`, `getFolderIdFromEntityId` in `useFileManager.tsx`) rather than changing the ui-kit callback signatures. This keeps the prop contract with the external component unchanged.

3. **Return early (no dispatch, no ref bookkeeping mutation) when validation fails**, mirroring `Folder.tsx`'s `handleRename` early-return shape, so the temporary folder never enters Redux state and no stale "loading" folder row appears.

## Risks / Trade-offs

- [Risk] The `(name, parentFolder)` values reconstructed inside `handleCreateOrganizationFolder`/`handleCreateFolder` might not perfectly match what the ui-kit already validated (e.g. display-name vs. storage-name transforms), causing a valid name to be wrongly rejected → Mitigation: reuse the exact same `handleCreateFolderValidate`/`handleRenameValidation` functions already used for the ui-kit's `onCreateFolderValidate` prop, and add unit tests for both valid and invalid names at each call site.
- [Risk] Duplicate validation (ui-kit's own check plus this repo's defensive check) could cause a visible double error state or flicker → Mitigation: the defensive check only gates the dispatch silently (early return); it does not need to render its own error UI since the ui-kit already shows the validation error inline.
- [Trade-off] This fix is defensive/duplicative by design (repo-side validation exists even though the ui-kit is supposed to already gate this) — acceptable since it costs one extra function call per creation attempt and closes the security/UX gap immediately without an external dependency bump.

## Migration Plan

No data migration. This is a pure client-side logic fix with no backward-incompatible API/state changes; ships as a normal patch release. No rollback concerns beyond reverting the two handler changes.

## Open Questions

None — root cause and fix locations are confirmed in both call sites.
