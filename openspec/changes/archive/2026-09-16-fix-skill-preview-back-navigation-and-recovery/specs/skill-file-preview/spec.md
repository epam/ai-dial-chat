## MODIFIED Requirements

### Requirement: Selecting a supporting file previews it via the shared attachment-canvas pipeline

`apps/chat/src/pages/SkillEditor/SkillEditor.tsx` SHALL own an effect over `libs/skill-editor`'s `selectedPath` (received via `onSelectedPathChange`) that, when the selected path resolves to a `SkillFileTreeNode` with `kind: File` (excluding the synthetic `SKILL.md` node), converts that node's in-memory bytes into an `Attachment` (`libs/chat-shared/src/models/chat.ts`) and calls `useOpenAttachmentCanvas().openAttachmentCanvas(attachment, canvasAttachmentId)`. No new BFF or DIAL Core request SHALL be made to service this preview — the bytes already live in `SkillEditor.tsx`'s `filesContentRef` (create-mode uploads or edit-mode unpacked ZIP entries).

The converted `Attachment`'s `id` SHALL be the file's full relative path (e.g. `agents/analyzer.md`), not a basename or content-derived hash. The `canvasAttachmentId` passed to `openAttachmentCanvas` — the caller-scoped key the canvas uses to decide which selection its state belongs to — SHALL additionally be scoped to the edited resource, composed from the resource's bucket, the skill's path (or a stable create-mode marker when there is none), and the file's full relative path. The same value SHALL be the one the inline preview component compares against the canvas's `attachmentId` to decide whether the displayed content is its own. Two files sharing a basename in different folders, and two files sharing a full relative path in different skills or buckets, SHALL therefore never be mistaken for one another.

The preview content SHALL be rendered through the extracted `AttachmentCanvasBody` component (`libs/attachment-canvas`) — the same Markdown/JSON/Code/Html/Pdf/Image/Audio/Visualizer/Unsupported/Error/loading rendering `AttachmentCanvas` already uses for chat attachments — mounted by the app inside `libs/skill-editor`'s `supportingFileContent` slot, not the global `AttachmentCanvasContainer` sidebar.

#### Scenario: Selecting a Markdown supporting file opens the Markdown renderer
- **WHEN** a user selects `agents/analyzer.md` in the Files tree
- **THEN** its content renders through the same Markdown renderer chat attachments use, with no network request to the BFF or DIAL Core

#### Scenario: Selecting a code file opens the syntax-highlighted code renderer
- **WHEN** a user selects `eval-viewer/generate_review.py`
- **THEN** its content renders through the same syntax-highlighted code renderer chat attachments use

#### Scenario: Two files with the same basename in different folders preview independently
- **WHEN** a user selects `agents/README.md`, then selects `assets/README.md`
- **THEN** each selection opens its own file's content — the second selection does not display the first file's content, and no stale canvas state from the first file is reused for the second

#### Scenario: The same relative path in two different skills previews independently
- **WHEN** a user previews `docs/guide.pdf` in one skill, leaves the editor, opens a different skill that also contains `docs/guide.pdf`, and selects it
- **THEN** the preview renders the second skill's bytes, and the canvas does not treat the first skill's already-open state as belonging to the new selection

#### Scenario: The same relative path in a different bucket previews independently
- **WHEN** the same relative path exists in two skills owned by different buckets and the user previews each in turn
- **THEN** each preview resolves against its own resource, with no reuse of the other's canvas state

#### Scenario: Unsupported binary file shows the existing unsupported state
- **WHEN** a user selects a supporting file whose extension/MIME is not recognized by any renderer
- **THEN** the preview shows the same "preview not supported" state chat attachments show, not an error or a blank pane

### Requirement: Preview lifecycle tracks selection, removal, replacement, and navigation

The preview SHALL replace its content whenever a different supporting file is selected, close when the currently-previewed file is removed, and close when the user navigates away from the Skill Editor route or switches between a create and an edit resource.

Replacing a supporting file's bytes is a removal followed by an upload, not an in-place overwrite: `skill-file-batch-validation` rejects an upload at a path the skill already has (`pathDuplicate`). The preview's obligation for that flow is therefore the removal case above plus the selection case — removing the previewed file closes the preview, and selecting the re-added file opens its new bytes. This requirement previously described an in-place same-path re-upload, which the editor does not permit. Selecting the same already-previewed file again SHALL NOT re-trigger a duplicate `openCanvas` call. Selecting `SKILL.md` or a folder node SHALL NOT open or affect the preview.

Asynchronous content resolution SHALL guard against out-of-order completion: if a user selects file A and then quickly selects file B before A's content finishes resolving, the preview SHALL show file B's content once both resolve, never A's. The guard SHALL hold for every ordering of completion and selection, including the cases where the later selection is `SKILL.md`, where the previewed file was removed, and where the user left the editor: a result that finishes after the selection it belongs to is no longer current SHALL NOT replace the content of the current selection, SHALL NOT reopen a preview that has been closed, and SHALL NOT leave the canvas holding state attributed to the stale selection.

The guard SHALL be applied where canvas state is committed, not after the fact. A superseded result SHALL NOT be published and then corrected: correcting a write that already happened leaves the stale content briefly displayed and forces a redundant reopen of the current selection, which a check made before the write does not. Requests SHALL therefore be identified by a monotonically increasing request number rather than by the selection they belong to alone — selecting A, then B, then A again makes the first A's identity current once more, so identity comparison alone would treat its superseded result as fresh.

Ownership SHALL be part of the same check. A request issued by the Skill Editor SHALL NOT write to, or close, a canvas that the editor no longer owns — including after the user has left the editor and another surface has opened the shared canvas for its own attachment. A superseded request SHALL NOT be reported as a failure of the current selection.

Object-URL cleanup SHALL be preserved across this guard: a resolved payload that is discarded before it reaches the canvas SHALL have its object URL released, since the canvas revokes only content it actually held. Cancelling the underlying I/O SHALL NOT be required — suppressing a stale request's effect on shared state is what is specified.

#### Scenario: Removing the previewed file closes the preview
- **WHEN** a user removes the supporting file that is currently previewed
- **THEN** the preview closes and the main pane returns to its default state (the SKILL.md form, if `SKILL.md` becomes selected, or the library's default "no file selected" presentation)

#### Scenario: Replacing a previewed file's bytes shows the new bytes
- **WHEN** a user removes the supporting file that is currently previewed and uploads a new file at the same path
- **THEN** the removal closes the preview, and selecting the re-added file shows the new bytes rather than the removed file's

#### Scenario: Rapid selection change shows only the latest file
- **WHEN** a user selects file A and, before its content resolves, selects file B
- **THEN** the preview ends up showing file B's content; file A's slower-resolving content is discarded if it arrives after B's selection

#### Scenario: A late result cannot reopen a preview closed by returning to SKILL.md
- **WHEN** a user selects file A and, before its content resolves, returns to the `SKILL.md` view
- **THEN** A's late result does not reopen the preview, and the manifest form stays displayed

#### Scenario: A late result cannot replace a newer selection's content
- **WHEN** file A's resolution completes after file B has already been selected and rendered
- **THEN** the displayed content remains file B's, and the canvas's recorded selection remains file B's

#### Scenario: A superseded result is ignored even when its file is selected again
- **WHEN** a user selects file A, then file B, then file A again before the first request for A has resolved, and that first request resolves last
- **THEN** the preview keeps showing the content resolved by the *latest* request for A, and the superseded first request changes nothing

#### Scenario: A stale completion does not force the current file to reload
- **WHEN** file A's resolution completes after file B has been selected and rendered
- **THEN** B's content is never replaced, and no second open is issued for B to recover from the stale completion

#### Scenario: A stale failure is not attributed to the current selection
- **WHEN** file A's resolution fails after file B has been selected and rendered successfully
- **THEN** the preview continues to show B, with no error state

#### Scenario: An abandoned request does not disturb another surface's canvas
- **WHEN** a user selects a supporting file, leaves the editor before it resolves, another surface opens the shared attachment canvas for its own attachment, and the abandoned request then resolves — whether with content or with nothing to display
- **THEN** that surface's canvas is neither replaced nor closed

#### Scenario: A discarded preview payload does not leak its object URL
- **WHEN** a supporting file's resolved content carries an object URL and the result is discarded as stale
- **THEN** that object URL is revoked rather than left allocated for the lifetime of the page

#### Scenario: A late result cannot bleed into a newly opened skill
- **WHEN** a user selects a supporting file, leaves the editor before it resolves, and opens a different skill
- **THEN** the newly opened skill's editor shows its `SKILL.md` view with no preview content or loading state carried over from the abandoned resolution

#### Scenario: Leaving the Skill Editor closes the preview
- **WHEN** a user navigates away from `/skill-editor` while a supporting file is previewed
- **THEN** the attachment canvas closes and any object URL created for that preview is revoked

#### Scenario: Selecting SKILL.md does not open a preview
- **WHEN** a user selects the `SKILL.md` node while a supporting file was previously previewed
- **THEN** the preview closes and the manifest form renders instead; no attachment-canvas content is shown for `SKILL.md`

### Requirement: Zero-byte supporting files open as a valid empty preview

A zero-byte text/code/markdown/JSON supporting file SHALL open as a valid empty preview (empty content, not an error or "missing" state); this SHALL be verified generically against chat's own locally-picked zero-byte attachments, since the underlying fix is not Skill-specific.

The Skill Editor's inline preview exposes no Download or Close control of its own — matching the inspected Figma node, which shows no such affordance. `AttachmentCanvasBody`'s renderers and `libs/attachment-canvas`'s `downloadAttachmentContent` utility remain generically reusable by a future host that does want a download action (e.g. the global sidebar `AttachmentCanvasContainer` still exposes one), but the Skill Editor does not wire one up. Returning to the `SKILL.md` form is done either by re-selecting `SKILL.md` in the file tree or by activating the editor header's Back control (see "Returning from a supporting-file preview"); the preview pane itself still renders no dedicated close button.

#### Scenario: A zero-byte text file opens as an empty preview, not a missing-content error
- **WHEN** a user uploads an empty (`0` bytes) `.txt` file and selects it
- **THEN** the preview shows an empty text area, not the "preview not supported" or error state

#### Scenario: No download or close control is rendered in the inline preview
- **WHEN** a user selects any supporting file in the Skill Editor
- **THEN** no Download or Close button is rendered alongside the preview content; the ways back to the `SKILL.md` form are re-selecting it in the file tree and the editor header's Back control

## ADDED Requirements

### Requirement: Returning from a supporting-file preview

While the Skill Editor's selection is a supporting file, activating the editor header's Back control SHALL return the editor to the skill's `SKILL.md` editing view without leaving the editor route, without resolving or consulting `returnUrl`, and without raising the unsaved-changes confirmation. This SHALL hold while the preview is still loading, after it has rendered successfully, and after it has failed. The decision SHALL be made in the application layer — `libs/skill-editor` and `libs/builder-form` continue to delegate Back to the host callback they are given and SHALL NOT gain knowledge of routes, `returnUrl`, or selection policy.

Returning SHALL preserve unsaved manifest fields (Name, Description, Instructions) and the current set of uploaded or unpacked supporting files exactly as they were before the preview was opened, and SHALL leave the editor's dirty state unchanged.

Because the control's action depends on the current selection, its accessible name SHALL change with it: the existing `skillEditor.backAriaLabel` while the `SKILL.md` view is shown, and a new `skillEditor.backToManifestAriaLabel` key while a supporting file is selected. The return SHALL be announced through a polite `role="status"` live region so a screen-reader user learns the pane switched back to `SKILL.md`. The control SHALL remain the same keyboard-reachable button; keyboard focus SHALL stay on it across the return rather than being moved or lost. Direction impact: none beyond what already applies — the Back glyph is already mirrored for RTL via `rtl:scale-x-[-1]` in `libs/builder-form`'s `EditorLayout`, and no new directional affordance is introduced.

#### Scenario: Back after a successfully rendered preview returns to the manifest view
- **WHEN** a supporting file's preview has rendered and the user activates Back
- **THEN** the editor shows the `SKILL.md` editing view, the route does not change, and no confirmation prompt appears

#### Scenario: Back while the preview is still loading returns to the manifest view
- **WHEN** a supporting file has been selected and its content has not finished resolving, and the user activates Back
- **THEN** the editor shows the `SKILL.md` editing view without leaving the editor, and the abandoned resolution does not reopen the preview

#### Scenario: Back after a failed preview returns to the manifest view
- **WHEN** a supporting file's preview has failed and the user activates Back
- **THEN** the editor shows the `SKILL.md` editing view without leaving the editor and without a confirmation prompt

#### Scenario: Returning preserves unsaved manifest fields
- **WHEN** a user edits Description, selects a supporting file, then activates Back
- **THEN** the `SKILL.md` view shows the edited Description unchanged, and the editor is still reported as having unsaved changes

#### Scenario: Returning preserves uploaded files
- **WHEN** a user uploads supporting files, previews one of them, then activates Back
- **THEN** every uploaded file is still listed in the Files panel and still staged for the next save

#### Scenario: Back from the manifest view keeps the existing exit behavior
- **WHEN** the `SKILL.md` view is shown and the user activates Back
- **THEN** the page behaves as it does today: with unsaved changes it asks for confirmation before navigating to `returnUrl`, and with none it navigates immediately

#### Scenario: Cancel still exits the editor from a supporting-file preview
- **WHEN** a supporting file is selected and the user activates Cancel
- **THEN** Cancel keeps its editor-exit behavior — confirming first if there are unsaved changes — rather than returning to the `SKILL.md` view

#### Scenario: The Back control's accessible name reflects its current action
- **WHEN** a user moves focus to the Back control while a supporting file is selected, and again while the `SKILL.md` view is shown
- **THEN** its accessible name describes returning to `SKILL.md` in the first case and leaving the editor in the second

### Requirement: A failed supporting-file preview is local and recoverable

A supporting-file preview that fails to resolve SHALL present an explicit, legible error inside the preview pane with a retry control, and SHALL NOT present an indefinite loading state. The failure SHALL be attributed to the specific file that failed: selecting another file, returning to `SKILL.md`, or retrying SHALL clear it, and it SHALL NOT suppress or alter any other file's preview. The failure SHALL NOT navigate, unmount the editor, or change the editor's dirty state, and it SHALL NOT prevent the user from continuing to edit the manifest, upload files, or save.

The preview's presentation SHALL be driven by explicit states rather than inferred from the absence of a matching canvas selection: a loading state only while an open for the currently selected file is in flight, a ready state when the canvas's recorded selection matches it, and an error state when its open failed. A state enum SHALL be used rather than a string-literal union, per the project's enum convention.

The error SHALL be rendered in a `role="alert"` region and the retry SHALL be a real button, reachable and operable by keyboard. Existing i18n keys SHALL be reused — `attachmentCanvas.loadErrorLabel` for the message and `buttons.retry` for the control — and a new key added only if a Skill-specific message is required. No feature flag gates this behavior: it follows the existing preview, which is explicitly independent of `OverlayFeature.AttachmentsManager`.

#### Scenario: A failed preview shows an error instead of a spinner
- **WHEN** a selected supporting file's preview fails to resolve
- **THEN** the preview pane shows an error message and a retry control, and no loading indicator remains

#### Scenario: Retry re-attempts the failed preview
- **WHEN** a user activates retry after a failed preview
- **THEN** the preview attempts to resolve the same file again and renders it on success

#### Scenario: A failure does not block editing
- **WHEN** a supporting file's preview has failed
- **THEN** the user can still edit the manifest fields, upload or remove supporting files, and save the skill

#### Scenario: Selecting a different file clears the previous failure
- **WHEN** a preview fails and the user then selects a different supporting file that resolves normally
- **THEN** the second file renders, and the first file's error is no longer displayed

#### Scenario: A failure is announced, not silent
- **WHEN** a preview fails
- **THEN** the error is exposed in a `role="alert"` region so assistive technology announces it

### Requirement: The editor layout survives any preview attempt for the rest of the session

After any supporting-file preview attempt — successful, still loading, or failed, and for any supported file type including PDF — every subsequently opened Skill Editor session SHALL render its complete layout for the current viewport without a page reload. At desktop widths this SHALL include the Files panel and the header's Cancel/Save actions; at mobile widths it SHALL include the collapsible file-list accordion and the bottom action bar. Exactly one of the mobile and desktop presentations SHALL be visible at a given viewport width.

This SHALL hold when opening a different existing skill, when starting a new skill, and when reopening the same skill, whether the user left the editor by Cancel, by Back from the `SKILL.md` view, or by any other navigation. It SHALL also hold in the reverse direction: opening an attachment preview elsewhere in the application SHALL NOT degrade a Skill Editor session opened afterwards. Recovery SHALL NOT depend on a page reload, a timer or arbitrary delay, or a blanket reset of shared application state.

#### Scenario: Opening another skill after a failed PDF preview shows the complete layout
- **WHEN** a user's supporting-file PDF preview fails, they leave the editor, and they open a different skill
- **THEN** the editor renders its complete layout for the current viewport, with no page reload

#### Scenario: Opening another skill after a successful PDF preview shows the complete layout
- **WHEN** a user previews a supporting-file PDF successfully, leaves the editor, and opens a different skill
- **THEN** the editor renders its complete layout for the current viewport

#### Scenario: Starting a new skill after a preview attempt shows the complete layout
- **WHEN** a user attempts a supporting-file preview, leaves the editor, and starts creating a new skill
- **THEN** the create-mode editor renders its complete layout with `SKILL.md` selected

#### Scenario: Reopening the same skill after a failed preview shows the complete layout
- **WHEN** a user's preview fails, they exit the editor, and they reopen the same skill
- **THEN** the editor renders its complete layout with `SKILL.md` selected and no residual preview state

#### Scenario: Exactly one responsive presentation is shown
- **WHEN** the editor is opened at a desktop width after a preview attempt, and again at a mobile width
- **THEN** the desktop width shows the Files panel and header actions without the mobile accordion or bottom action bar, and the mobile width shows the accordion and bottom action bar without the desktop panel and header actions

#### Scenario: A preview opened elsewhere does not degrade a later editor session
- **WHEN** a user opens a PDF attachment preview outside the Skill Editor and then opens the Skill Editor
- **THEN** the editor renders its complete layout for the current viewport

#### Scenario: Recovery requires no reload
- **WHEN** any of the above sequences is performed
- **THEN** the complete layout is restored by in-app navigation alone; no browser reload is required at any point
