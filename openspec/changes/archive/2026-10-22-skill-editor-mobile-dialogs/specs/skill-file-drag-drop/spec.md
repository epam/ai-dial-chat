# Spec Delta

## ADDED Requirements

### Requirement: An upload onto an existing file asks to replace or duplicate it

`SkillEditor` SHALL pass the paths of its supporting files (`files` nodes of kind `File`) to the upload dialog as `existingFilePaths`. A candidate whose path is one of them — from any source, and never the root `SKILL.md` — SHALL NOT be staged on arrival; the dialog SHALL instead switch to a step titled `labels.uploadConflictTitle` ("Replace or duplicate it?") with `labels.uploadConflictMessage(path)`, a Replace/Duplicate radio group (Replace selected) and Confirm (`labels.uploadConflictConfirmLabel`) / Cancel, asking about one conflicting candidate at a time while the others wait. Replace SHALL stage the candidate with `replacesExisting: true` and the row note `labels.uploadReplaceRowNote`; Duplicate SHALL stage it at the first `name (n).ext` path (numbering from 1) that neither an existing file nor another staged or waiting candidate holds; Cancel, Escape or the close control SHALL drop it. Non-conflicting candidates from the same pick SHALL be staged immediately. The step SHALL render in the same dialog surface, so it is a `BottomSheet` below the `desktop` breakpoint. Because the step swaps the dialog body, focus SHALL move to the step's message when a question appears (so it is read out) and back to the drop zone once the last question is answered. A committed batch SHALL be reported through `onCommitted(candidates)`, which `SkillEditor` uses to mark the form dirty after a replacement.

App keys: `skillEditor.uploadConflictTitle`, `skillEditor.uploadConflictMessage`, `skillEditor.uploadReplaceRowNote`; the option and Confirm labels reuse `buttons.replace`, `buttons.duplicate` and `buttons.confirm`.

#### Scenario: Replace stages an overwrite
- **WHEN** `notes.md` exists and the user uploads `notes.md`, then confirms with Replace selected
- **THEN** a `notes.md` row is staged with `replacesExisting: true` and the "Will replace the existing file" note

#### Scenario: Duplicate stages a numbered copy
- **WHEN** `notes.md` and `notes (1).md` exist and the user uploads `notes.md`, chooses Duplicate and confirms
- **THEN** the upload is staged as `notes (2).md`

#### Scenario: Focus follows the question
- **WHEN** an upload conflicts and the step opens, and the user then confirms it
- **THEN** focus lands on the step's message while it is shown, and returns to the drop zone after Confirm

#### Scenario: Cancel drops only the conflicting file
- **WHEN** the user uploads `a.md` and `notes.md` while `notes.md` exists, then cancels the step
- **THEN** `a.md` stays staged and `notes.md` is not

## MODIFIED Requirements

### Requirement: Upload dialog opens from "Upload from device" and supports drag-and-drop plus click-to-browse

`libs/skill-editor` SHALL open a dialog (a centred ui-kit `Popup` at the `desktop` breakpoint and a ui-kit `BottomSheet` below it, with Confirm and Cancel pinned at the sheet's bottom) when an Add entry that stages files is activated: **Upload files from device** opens it in files mode, **Upload archive from device** opens it in archive mode (`SkillFileUploadMode.Archive`), and a resolved **Open DIAL file system** pick opens it in files mode pre-staged with the picked entries. The dialog SHALL contain a drop zone that accepts a file-bearing drag from anywhere over the zone and, on drop, stages every dropped file (in archive mode: every entry of every dropped `.zip`, as resolved by `fileActions.extractArchive`); clicking the drop zone SHALL open the native OS file picker configured for multiple selection (in archive mode: restricted to `.zip`). The dialog SHALL remain open and accept additional drags/drops or additional picker selections until the user confirms or cancels.

The drop zone SHALL show `labels.uploadDropZoneDescription` (files mode) or `labels.uploadArchiveDropZoneDescription` (archive mode) as a second line when the host supplies it; the DIAL Chat host passes the per-file size limit and "File format .zip" (`skillEditor.uploadArchiveFormats`).

#### Scenario: Activating "Upload files from device" opens the dialog
- **WHEN** a user activates Add → Upload files from device
- **THEN** the upload dialog opens in files mode, showing an empty drop zone and no staged files

#### Scenario: The dialog is a bottom sheet on mobile
- **WHEN** the upload dialog opens below the `desktop` breakpoint
- **THEN** it renders as a `BottomSheet` with the dialog title, a close control, and Confirm/Cancel buttons at its bottom

#### Scenario: Activating "Upload archive from device" opens the archive dialog
- **WHEN** a user activates Add → Upload archive from device
- **THEN** the upload dialog opens in archive mode with the archive title and drop-zone copy, and its picker accepts `.zip`

#### Scenario: Dropping files stages them
- **WHEN** a user drags one or more files over the drop zone and drops them
- **THEN** every dropped file appears as a staged row in the dialog, and the browser does not navigate to any dropped file

#### Scenario: Clicking the drop zone opens the native picker with multi-select enabled
- **WHEN** a user clicks the drop zone
- **THEN** the native file picker opens allowing more than one file to be selected at once

#### Scenario: Dropping files anywhere on the editor surface opens the dialog and stages them
- **WHEN** a user drags files from their device and drops them anywhere on the Skill Editor surface without first activating an Add entry
- **THEN** the upload dialog opens in files mode, targeting the root, and every dropped file is immediately staged, with no separate click required first

#### Scenario: A page-wide drop while the dialog is already open does not reopen it
- **WHEN** the upload dialog is already open and a user drops files inside its own drop zone
- **THEN** the files are staged into the same open dialog exactly once, not staged twice or via a second dialog instance
