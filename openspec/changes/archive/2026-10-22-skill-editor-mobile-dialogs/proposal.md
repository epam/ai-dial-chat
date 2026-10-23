# Proposal

## Why

New mobile designs for the skill editor (Create skill / Edit skill):

- The Files block is a card, not the kit `Accordion` row. The card shows an "EDITING FILE" caption, the file-type icon with the file name, and a caret pointing down (up when open).
- Upload, the duplicate-name question, and folder creation open at the bottom of the screen, like the app's other mobile menus.
- Folder creation on mobile is a dialog, not an inline draft in the tree.

The duplicate-name question is new behaviour. Before this change, an upload onto an existing path only showed the row error "A file or folder already exists at this path". Desktop keeps its current look.

## What Changes

- **Mobile Files card.** `SkillFilesSummary` (lib-internal) replaces the kit `Accordion` in the narrow layout.
  - It sits 20px above the selected file's heading.
  - New style props: `filesCardBackground` / `filesCardBorder` and `editingFileLabelClassName` / `editingFileNameClassName`.
- **Dialogs below the `desktop` breakpoint.** `SkillEditorDialog` (lib-internal) renders a kit `BottomSheet` there, with Confirm/Cancel pinned at the bottom, and the same `Popup` as before on desktop. The upload dialog and the new Create folder dialog use it.
- **Format hint.** The upload drop zone takes an optional second line (`uploadDropZoneDescription` / `uploadArchiveDropZoneDescription`). The DIAL Chat host passes the per-file size limit and "File format .zip".
- **Replace or duplicate.** An upload onto an existing supporting file asks this question in the same dialog, one file at a time.
  - **Replace** stages the file with the new `SkillFileUploadCandidate.replacesExisting`.
  - **Duplicate** stages it as `name (n).ext`.
  - **Cancel** drops it.
  - Focus moves to the question and back to the drop zone.
- **Host side (`chat-hooks`).**
  - `validateSkillFileBatch` accepts a replacement and drops the replaced file's bytes and count from the projected totals. It rejects a file at a folder's path.
  - `useSkillFileActions.commitBatch` overwrites a replaced file's bytes without adding a node, and returns per-path `contentRevisions`.
- **Consumers of the new signals.**
  - `SkillEditor` reports dirty after a replacing commit (`onCommitted`).
  - `useSkillFilePreviewSync` reopens a replaced preview.
  - `useSkillEditorSubmit` fingerprints `contentRevisions`, so a retry after a 503 never resends old bytes.
- **Create folder on mobile.** It opens `SkillCreateFolderDialog`, a required Name field with the same validation as the inline draft. Desktop keeps the inline draft.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `skill-authoring`: replacement and folder-path rules in batch validation; the retry fingerprint; the mobile card in the responsive layout (requirement renamed).
- `skill-editor-library`: dirty state after a replacement; the mobile card in the layout requirement.
- `skill-file-tree-actions`: Create folder is a dialog below the `desktop` breakpoint.
- `skill-file-drag-drop`: the dialog is a `BottomSheet` on mobile and has the drop-zone hint; new requirement for the Replace-or-duplicate step.
- `skill-file-preview`: in-place replacement reopens the preview; the card wording.

## Out of scope

- Upload progress bars ("3 of 8 completed" in the mockup): the upload is still staged, then committed with Add.
- A drag handle on the sheet: the kit `BottomSheet` draws none, and neither do the app's other sheets.
- "Apply to all" for several conflicting files.
