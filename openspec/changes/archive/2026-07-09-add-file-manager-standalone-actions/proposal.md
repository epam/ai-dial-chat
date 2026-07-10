## Why

The #7503 roadmap's step 12 target action matrix — `my_files`: Copy, Move, Duplicate, Download, Delete, Rename; `shared`/`organization`: Download only — is **already fully implemented** by the time this change starts. `useDialFileManager.ts`'s `actionLabels` computation already includes all six `my_files` actions (Rename/Copy/Move/Duplicate gated by `uploadEnabled`; Delete unconditional on the tab; Download always) and only Download for `shared`/`organization`, shipped incrementally across `add-file-manager-rename`, `add-file-manager-copy-move`, and `add-file-manager-duplicate`.

What is **not** done, and is exactly what those three prior changes' own design docs each flagged as a check to make ("Regression: Attach modal `actionProfile=Attach` unchanged") without actually implementing: `actionLabels` is computed purely from `activeTab`/`uploadEnabled` and never branches on `actionProfile`. The hook carries this comment verbatim today:

```ts
// `actionProfile` is not yet branched on below (see design.md Decision 3 —
// Attach and Browse must compute identical actionLabels in this change);
// this switch only guards that every profile is deliberately accounted for.
switch (actionProfile) { ... }
```

The practical consequence: `DialFileManagerModal` (the attach-to-chat picker, `variant=Attach`) currently exposes Copy, Move, and Duplicate on its `my_files` tab too — not because that was ever decided, but because nothing gates it. This was confirmed by reading the current code (not assumed) and confirmed with the reporter as an unintended side effect, not a deliberate feature: Copy/Move/Duplicate should be standalone-only; Rename should remain available in both (it was deliberately added to the attach modal in an earlier change, before the `variant`/`actionProfile` split existed, and that decision is not being revisited here).

## What Changes

- **`useDialFileManager`**: `actionLabels` computation gains an `actionProfile !== DialFileManagerActionProfile.Attach` condition around `DialFileManagerActions.Copy`/`.Move`/`.Duplicate` (in addition to the existing `activeTab === MyFiles && uploadEnabled` gate). `Rename` and `Delete` remain ungated by `actionProfile`, matching their existing, deliberately-shipped behavior.
- **Placeholder comment and exhaustiveness-only `switch` removed** from `useDialFileManager.ts` — `actionProfile` is now genuinely branched on, so the comment explaining why it *wasn't* is no longer accurate; the `switch` is replaced by the real conditional (still exhaustively typed via the enum).
- **`DialFileManagerPage`** stays on `actionProfile: DialFileManagerActionProfile.Browse` — **not** switched to `Full`, contrary to the original roadmap note. `Full` is reserved for `#7504`'s legacy-parity additions (Share/Unshare/Remove access/Info); `Browse` already correctly represents "the full #7503 minimum matrix," and relabeling it `Full` now would misrepresent it as already having #7504's capabilities.
- **Regression tests** added confirming: the attach modal (`actionProfile=Attach`) does not expose Copy/Move/Duplicate on `my_files` even with WRITE permission, but still exposes Rename and Delete unchanged; the standalone page (`actionProfile=Browse`) exposes the full six-action matrix on `my_files` and Download-only on `shared`/`organization`.
- **Non-breaking for standalone**: `DialFileManagerPage`'s behavior is unchanged by this proposal (it was already `Browse` and already showed the full matrix). This is a **behavior change for the attach modal**: Copy/Move/Duplicate disappear from it. No BFF or DTO changes.

## Capabilities

### Modified Capabilities

- `file-manager-tabs`: the per-tab action-label table gains an explicit `actionProfile` column, formalizing that Copy/Move/Duplicate are Browse/Full-only while Rename/Delete/Download remain profile-independent. This closes the gap the requirement's own text left open across the three prior changes that incrementally built toward it.

### New Capabilities

_None._ No new capability spec is introduced — this change completes and formalizes `file-manager-tabs`'s existing action-visibility requirement rather than adding a new behavioral surface.

## Impact

- **Frontend only**: `apps/chat/src/hooks/files/useDialFileManager.ts` (the `actionLabels` computation and the now-obsolete placeholder comment/switch), test files for the hook, `DialFileManagerModal`, and `DialFileManagerShell`.
- **No backend changes.**
- **User-visible change**: Copy, Move, and Duplicate no longer appear when attaching a file to a chat message. Standalone File Manager (`/files`) is unaffected — it already showed the full matrix.
- **Docs**: `openspec/specs/file-manager-tabs/spec.md` gains the `actionProfile` column on archive.

## Non-Goals

- Share/Unshare/Remove access/Info, `sharedByMePaths`, upload-archive — all remain `#7504`.
- Implementing `DialFileManagerActionProfile.Full` behavior — still reserved, unimplemented; only the `Attach`/`Browse` distinction is resolved here.
- `DialFileManagerVariant.FolderPicker` — still reserved per `add-file-manager-select-folder-modal`'s non-goals.
- Revisiting whether Rename should also be Attach-excluded — out of scope; that was a separate, already-shipped decision this change does not reopen.
