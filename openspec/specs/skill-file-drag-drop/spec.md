# skill-file-drag-drop Specification

## Purpose
Specifies `libs/skill-editor`'s file-upload dialog: opening it from the existing "Upload from device" control or from a page-wide drag-and-drop, staging multiple candidates with drag-and-drop or the native file picker, resolving and normalizing candidate paths, driving per-row and batch-level feedback through host-supplied `validateBatch`/`commitBatch` callbacks, distinguishing a manifest-kind candidate, and the dialog's accessibility and RTL/localization requirements.

## Requirements

### Requirement: Upload dialog opens from "Upload from device" and supports drag-and-drop plus click-to-browse

`libs/skill-editor` SHALL open a dialog (a responsive centered modal at every breakpoint — a bottom-sheet deviation for `mobile` was considered but rejected because the ui kit's `Popup` has no sheet variant, documented in design.md) when the existing "Upload from device" control is activated. The dialog SHALL contain a drop zone that accepts a file-bearing drag from anywhere over the zone and, on drop, stages every dropped file; clicking the drop zone SHALL open the native OS file picker configured for multiple selection. The dialog SHALL remain open and accept additional drags/drops or additional picker selections until the user confirms or cancels.

#### Scenario: Activating "Upload from device" opens the dialog
- **WHEN** a user activates the existing "Upload from device" control
- **THEN** the upload dialog opens, showing an empty drop zone and no staged files

#### Scenario: Dropping files stages them
- **WHEN** a user drags one or more files over the drop zone and drops them
- **THEN** every dropped file appears as a staged row in the dialog, and the browser does not navigate to any dropped file

#### Scenario: Clicking the drop zone opens the native picker with multi-select enabled
- **WHEN** a user clicks the drop zone
- **THEN** the native file picker opens allowing more than one file to be selected at once

#### Scenario: Dropping files anywhere on the editor surface opens the dialog and stages them
- **WHEN** a user drags files from their device and drops them anywhere on the Skill Editor surface without first activating "Upload from device"
- **THEN** the upload dialog opens and every dropped file is immediately staged, with no separate click required first

#### Scenario: A page-wide drop while the dialog is already open does not reopen it
- **WHEN** the upload dialog is already open and a user drops files inside its own drop zone
- **THEN** the files are staged into the same open dialog exactly once, not staged twice or via a second dialog instance

### Requirement: A full-surface overlay is shown while dragging over the editor, before the dialog opens

While a file-bearing drag is over the Skill Editor and the upload dialog is not yet open, the library SHALL render a full-surface overlay (icon, title, subtitle) over the editor, matching the visual language of the app's existing page-wide attachment-drag overlay so the interaction feels consistent across the product. The overlay SHALL disappear once the drop occurs and the upload dialog opens, and SHALL NOT block the drop event from reaching the editor's drop handling.

#### Scenario: Overlay appears while dragging over the editor
- **WHEN** a file-bearing drag enters the Skill Editor surface and the upload dialog is not open
- **THEN** a full-surface overlay with an upload icon, title, and subtitle appears

#### Scenario: Overlay disappears once the dialog opens
- **WHEN** the dragged files are dropped
- **THEN** the overlay is no longer shown and the upload dialog is open with the dropped files staged

#### Scenario: Overlay does not intercept the drop
- **WHEN** the overlay is visible and a drop occurs
- **THEN** the drop is still handled by the editor's drop logic (the overlay itself does not swallow the event)

#### Scenario: Dropping additional files while the dialog is open adds to the staged set
- **WHEN** a user has already staged files and drags a further file onto the still-open drop zone
- **THEN** the newly dropped file is added to the existing staged set rather than replacing it

### Requirement: Drop zone renders distinct default, active, and invalid visual states

The drop zone SHALL render a default (idle) visual state, an active visual state while a file-bearing drag is currently over it, and an invalid visual state when the currently staged batch, taken as a whole, has no valid entries. `dragover` SHALL always call `preventDefault()` while the dialog is open so the subsequent `drop` event is received and the browser's default navigate-to-file behavior is suppressed, regardless of which visual state is shown.

#### Scenario: Dragging a file over the zone shows the active state
- **WHEN** a file-bearing drag enters the drop zone
- **THEN** the zone renders its active visual state, and reverts to default when the drag leaves without dropping

#### Scenario: An all-invalid staged batch shows the invalid state
- **WHEN** every currently staged candidate has a validation error
- **THEN** the drop zone (or an equivalent batch-level indicator within the dialog) renders its invalid visual state

#### Scenario: Browser navigation is suppressed on drop
- **WHEN** a file is dragged over and dropped on the zone
- **THEN** the browser does not navigate away from the page to display the dropped file

### Requirement: Staged files are listed with path, size, status, and a remove control before commit

Each staged candidate SHALL render as a row showing: its resolved relative path (see path resolution below), its file size formatted in human-readable units, its current validation status or, when invalid, the specific error message, and a control to remove that candidate from the staged set without affecting any other staged candidate or the editor's already-committed files.

#### Scenario: A valid staged file shows path and size with no error
- **WHEN** a staged candidate passes validation
- **THEN** its row shows the resolved path and a formatted size (e.g. "12.4 KB"), with no error text

#### Scenario: An invalid staged file shows its specific error
- **WHEN** a staged candidate fails validation (e.g. exceeds the per-file size limit)
- **THEN** its row shows that specific error message, distinguishable from other rows' errors

#### Scenario: Removing a staged row does not affect other rows or the editor
- **WHEN** a user activates the remove control on one staged row
- **THEN** only that row disappears from the staged list; no other staged row changes and the editor's existing file tree is unaffected until commit

### Requirement: Candidate paths are resolved from File objects and normalized

For each selected or dropped `File`, the dialog SHALL resolve a candidate path using `webkitRelativePath` when the browser populates it (non-empty), falling back to `File.name` otherwise, and SHALL normalize any backslash separators in the resolved path to forward slashes before it is ever passed to host validation.

#### Scenario: A plain file drop resolves to its file name
- **WHEN** a single file with no `webkitRelativePath` is dropped
- **THEN** its resolved candidate path equals `File.name`

#### Scenario: A relative-path-bearing file normalizes separators
- **WHEN** a `File` object's `webkitRelativePath` (or, on a platform that reports backslashes, its `name`) contains a backslash
- **THEN** the resolved candidate path uses only forward slashes

### Requirement: Host validation drives per-row and batch-level feedback

The dialog SHALL call the host-supplied `validateBatch` function whenever the staged candidate set changes (add or remove), passing the complete current staged set, and SHALL render each returned per-candidate result against its corresponding row and any returned batch-level errors (e.g. projected total size or file count exceeded) at the dialog level, not attributed to one row. The dialog SHALL call `validateBatch` again immediately before invoking `commitBatch`, using its result as the final gate for what is committed.

#### Scenario: A batch-level size error renders once, not per row
- **WHEN** the staged batch's projected total size exceeds the package limit
- **THEN** a single batch-level message is shown, not duplicated onto every individual staged row

#### Scenario: Revalidation immediately precedes commit
- **WHEN** a user activates the confirm action
- **THEN** the dialog re-runs `validateBatch` on the current staged set before calling `commitBatch`, so a result that changed since the last render (e.g. because the editor's own file tree changed concurrently) is caught

### Requirement: Confirm action commits the whole valid batch atomically; cancel changes nothing

The dialog's confirm action ("Add"/"Upload") SHALL be disabled while `validateBatch` or `commitBatch` is in flight, or while any staged candidate's latest validation result is invalid. Activating it SHALL call the host-supplied `commitBatch` with the full currently-valid staged set exactly once; the dialog SHALL NOT commit only a valid subset of a batch that also contains invalid entries — an invalid entry must be removed by the user (or corrected, if correction is possible) before the remaining valid entries can be committed. The dialog's cancel action SHALL close the dialog and discard all staged candidates without calling `commitBatch` or making any change to the editor's existing file tree or form fields.

#### Scenario: Confirm is disabled while any staged item is invalid
- **WHEN** at least one staged candidate has an invalid validation result
- **THEN** the confirm action is disabled and activating it (if attempted) has no effect

#### Scenario: Confirm is disabled while validation or commit is in flight
- **WHEN** `validateBatch` or `commitBatch` has been called and has not yet resolved
- **THEN** the confirm action is disabled until it resolves

#### Scenario: A successful commit closes the dialog and clears staged state
- **WHEN** `commitBatch` resolves without an error
- **THEN** the dialog closes and the staged candidate list is cleared

#### Scenario: A failed commit keeps the dialog open with the batch intact
- **WHEN** `commitBatch` resolves with an error
- **THEN** the dialog remains open, the staged batch is unchanged, and the returned error is shown

#### Scenario: Cancel discards everything staged
- **WHEN** a user activates Cancel with staged candidates present
- **THEN** the dialog closes, no staged candidate is committed, and the editor's file tree and form fields are unchanged

### Requirement: A manifest-kind staged candidate is visually distinct

When a host-supplied validation result marks a staged candidate's kind as the manifest kind (as opposed to an ordinary supporting-file kind), the dialog SHALL render that row distinctly from ordinary supporting-file rows, using host-supplied label text explaining that it will populate or replace the Skill's metadata, without the dialog itself knowing anything about YAML, frontmatter, or manifest semantics beyond the tag it was given.

#### Scenario: A manifest candidate's row explains its effect
- **WHEN** a staged candidate's validation result has the manifest kind
- **THEN** its row shows host-supplied explanatory text distinct from an ordinary supporting-file row's copy

#### Scenario: The dialog performs no manifest parsing itself
- **WHEN** `libs/skill-editor/src/**` is searched for `yaml`/frontmatter-parsing logic
- **THEN** none is found; the manifest kind is only ever a tag supplied by the host's validation result

### Requirement: Upload dialog accessibility

The upload dialog SHALL be a semantic dialog with an accessible name (its title) and, where applicable, an accessible description, SHALL trap keyboard focus while open, SHALL restore focus to the "Upload from device" trigger control when it closes, SHALL close on `Escape` and via an explicit close control, SHALL make the drop zone operable via keyboard (activatable with Enter/Space to open the native file picker), SHALL render a visible focus state on every interactive element at least as strong as its hover state, SHALL expose validation-count or batch-error updates through an `aria-live="polite"` region distinct from any static row text, and SHALL give every interactive control (drop zone, remove buttons, confirm, cancel, close) a hit target of at least 44×44 px. Decorative icons (upload glyph, drag handle) SHALL be `aria-hidden`.

#### Scenario: Escape closes the dialog and restores focus
- **WHEN** a user presses `Escape` while the dialog is open
- **THEN** the dialog closes and keyboard focus returns to the "Upload from device" control

#### Scenario: The drop zone is keyboard-operable
- **WHEN** a keyboard-only user tabs to the drop zone and presses Enter or Space
- **THEN** the native file picker opens, identical to a pointer click

#### Scenario: Batch validation changes are announced
- **WHEN** a batch-level error appears or clears after `validateBatch` resolves
- **THEN** an `aria-live="polite"` region announces the change

### Requirement: RTL and localization

The upload dialog SHALL use CSS logical properties for all directional layout so it renders correctly under an inherited `dir="rtl"`, without importing i18n or reading the active language itself. Every user-visible string in the dialog (title, drop-zone copy, status/error text, manifest-row explanation, button labels) SHALL be supplied via the existing `labels` prop pattern rather than hardcoded, so the host can localize them.

#### Scenario: Dialog renders correctly under an RTL ancestor
- **WHEN** the dialog is mounted under an ancestor with `dir="rtl"`
- **THEN** its layout flips via inherited CSS logical properties with no prop or i18n call telling it to do so

#### Scenario: All dialog copy is host-supplied
- **WHEN** `libs/skill-editor/src/components/**` for the dialog is searched for hardcoded English strings outside the `labels` prop's defaults
- **THEN** none are found in JSX beyond the `labels` object's own default values
