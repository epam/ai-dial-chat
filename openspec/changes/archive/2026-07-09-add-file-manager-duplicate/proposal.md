## Why

The #7503 roadmap's step 11 (`add-file-manager-duplicate`) assumed a same-folder duplicate feature would need new BFF logic (a `duplicate: true` flag or client-side name resolution against the cached listing) and a new `onDuplicate` hook handler, modeled on the legacy Redux-era `useFileManager` duplicate handler.

Following the same investigation pattern that reshaped [add-file-manager-select-folder-modal](../archive/2026-07-09-add-file-manager-select-folder-modal/proposal.md) (slice 2), decompiling the installed `@epam/ai-dial-ui-kit` bundle (`node_modules/@epam/ai-dial-ui-kit/dist/index-U9Eh_lOr.js`) shows `DialFileManager` already implements the entire duplicate flow internally:

```js
// handleDuplicate(files) — FileManagerContext-internal
const destinationFolder = files[0]?.parentPath ?? '/';
const resolved = resolveConflictsWithStrategy(destinationFolder, files, /* overwriteIfConflict */ false);
onCopyFiles?.(resolved, destinationFolder);
onDuplicateSuccess?.();

// kv(name, existingNames, nodeType) — the actual naming algorithm
// folders: "name (1)", "name (2)", ...
// files:   splits at the last ".", produces "base (1).ext", "base (2).ext", ...
// increments until a name not in `existingNames` is found
```

`existingNames` comes from the file manager's own already-loaded folder listing (the same `items` this app already passes to `DialFileManager`) — no server round-trip, exactly the "client-side name resolution against the cached listing" approach the original roadmap asked for, already built. `resolveConflictsWithStrategy` is called with `overwriteIfConflict=false`, so every duplicated item always gets a freshly incremented name and `overwrite: false` — and the resulting `DialCopiedItem[]` is handed to **`onCopyFiles`**, the exact callback `add-file-manager-copy-move` already wired to `POST /api/v1/files/copy`.

There is therefore no new backend work, no new naming code, and no new hook handler required — Duplicate is a one-line action-label wiring change, plus verification that the existing `onCopyFiles` path handles a same-folder destination correctly (it was designed for cross-folder copy; same-folder is an edge case worth a regression test, not new logic).

## What Changes

- **`useDialFileManager`**: add `DialFileManagerActions.Duplicate` to the `actionLabels` computation for the `my_files` tab, gated by `uploadEnabled` (same WRITE-permission rule already applied to Copy/Move/Rename). No new callback, no new state.
- **`DialFileManagerShell`**: map `DialFileManagerActions.Duplicate` to a translated label in the existing `actionLabels` `useMemo`, mirroring the Copy/Move/Rename entries already there. `isDuplicateFolderAvailable` is left unset — ui-kit's default (`true`) already permits duplicating folders, and this app's BFF already supports recursive folder copy (`add-file-manager-copy-move`'s `copyFolderItem`), so no restriction is needed.
- **`customDuplicateAction`** is deliberately **not** set — setting it would override ui-kit's correct built-in behavior with something this app would have to reimplement for no benefit.
- **i18n**: one new key, `dialFileManager.duplicateAction`, following the same domain-namespaced pattern as `CopyAction`/`MoveAction`/`RenameAction` (not the unrelated generic `ButtonsI18nKeys.Duplicate`, which belongs to conversation duplicate and should stay independently reviewable).
- **Regression test**: a new test proving `onCopyFiles`, when invoked with `destinationFolder === sourceFolder` (the duplicate case), produces a correct `CopyItemDto[]` and does not misbehave (e.g. does not skip cache invalidation, does not error on the source/destination-equal edge case).
- **Non-breaking**: no new endpoints, no new DTOs, no OpenAPI regeneration, no new components.

## Capabilities

### New Capabilities

- `file-manager-duplicate`: documents the ui-kit-native duplicate mechanism (naming algorithm ownership, same-folder `onCopyFiles` dispatch, multi-select behavior) and this change's action-label/i18n wiring.

### Modified Capabilities

- `file-manager-tabs`: the per-tab action-label table gains a Duplicate row, `my_files`-only and WRITE-gated, matching the existing Copy/Move/Rename rows.

## Impact

- **Frontend only**: `apps/chat/src/hooks/files/useDialFileManager.ts`, `apps/chat/src/components/DialFileManagerShell/DialFileManagerShell.tsx`, `apps/chat/src/components/DialFileManagerShell/types/labels.ts`, `apps/chat/src/pages/DialFileManagerPage/DialFileManagerPage.tsx`, one i18n key.
- **No backend changes.** `POST /api/v1/files/copy` (from `add-file-manager-copy-move`) is reused unmodified.
- **No new components.**

## Non-Goals

- A dedicated `onDuplicate` hook handler or BFF `duplicate: true` flag — superseded by the ui-kit-native mechanism (see Why).
- Any naming-algorithm code in this app — ui-kit's `kv()` already implements the exact "(1)", "(2)" pattern from the legacy `useFileManager` reference.
- Restricting duplicate for folders — ui-kit's `isDuplicateFolderAvailable` defaults to `true` and this app's BFF already supports folder copy; no reason to restrict.
- Cross-tab duplicate (Shared/Organization) — Duplicate is `my_files`-only, matching Copy/Move/Rename's existing scope boundary.
