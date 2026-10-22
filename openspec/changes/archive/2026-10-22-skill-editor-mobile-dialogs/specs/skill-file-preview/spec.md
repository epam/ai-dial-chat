# Spec Delta

## MODIFIED Requirements

### Requirement: Preview lifecycle tracks selection, removal, replacement, and navigation

The preview SHALL replace its content whenever a different supporting file is selected, close when the currently-previewed file is removed, and close when the user navigates away from the Skill Editor route or switches between a create and an edit resource.

A supporting file's bytes can be replaced in two ways. Removing it and uploading a new file at the same path is the removal case above plus the selection case. Uploading onto the path and choosing **Replace** in the upload dialog overwrites the bytes in place: the node, its path and its canvas id stay the same, and `useSkillFileActions` bumps the path in `contentRevisions`. When the replaced file is the one previewed, the preview SHALL reopen with the new bytes, keyed on that revision (see the cross-cutting requirement below). Selecting the same already-previewed file again, at an unchanged revision, SHALL NOT re-trigger a duplicate `openCanvas` call. Selecting `SKILL.md` or a folder node SHALL NOT open or affect the preview.

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

#### Scenario: Replacing a previewed file in place reopens its preview
- **WHEN** the previewed file is overwritten through the upload dialog's Replace choice
- **THEN** the preview reopens for the same canvas id and shows the new bytes, without the user reselecting the file

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

### Requirement: Accessibility, RTL, i18n, and cross-cutting behavior

Selecting a file via keyboard (arrow keys + Enter, per `skill-editor-library`'s existing keyboard support) SHALL open its preview identically to a pointer click. The rendered preview region SHALL expose an accessible region name (via `AttachmentCanvasBody`'s existing labeling, applied by the app's content-only wrapper — see the "no Download or Close control" requirement above). Preview loading SHALL be announced via the existing `aria-live="polite"` status pattern `attachment-canvas` already uses; preview failures SHALL use the existing alert/error content type, not a new error surface. No new keyboard focus trap SHALL be introduced when a preview opens inline in the main pane. The preview body relies on `AttachmentCanvasBody`'s existing RTL handling; since the Skill Editor renders no header of its own around it, there are no app-level directional icons to mirror. All new user-visible strings SHALL use existing `attachment-canvas` i18n keys where the copy is identical, and new `skillEditor.*` keys only where it is genuinely Skill-Editor-specific — no hardcoded strings in JSX. This capability is not gated behind any `ENABLED_FEATURES`/`ENABLED_FEATURES_ROLES` key; it activates for every user who can already reach `/skill-editor`. Unrelated re-renders of `SkillEditor.tsx` SHALL NOT re-open the preview: `canvasAttachmentId` is memoized with `useMemo`, and the file→attachment conversion (`skillFileToAttachment`) runs only inside `useSkillFilePreviewSync`'s `openPreview` callback, which the selection effect skips when the canvas already holds (or is loading) that id at the selected file's current `contentRevision`, when the id is already in flight at that revision, or when it is the recorded failure. The page passes `useSkillFileActions`'s `contentRevisions[selectedPath]` as `contentRevision`; a file replaced in place keeps its path and canvas id, so a bumped revision SHALL reopen its preview with the new bytes.

#### Scenario: Keyboard selection opens the preview
- **WHEN** a keyboard-only user moves file-tree selection to a supporting file via arrow keys and Enter
- **THEN** the preview opens exactly as it would from a pointer click

#### Scenario: Preview loading is announced
- **WHEN** a supporting file's content is still resolving
- **THEN** an `aria-live="polite"` region announces the loading state

#### Scenario: RTL renders correctly
- **WHEN** the Skill Editor is viewed under `dir="rtl"` with a supporting file previewed
- **THEN** the preview and its header render mirrored via logical properties/`rtl:` variants, matching `attachment-canvas`'s existing RTL behavior

### Requirement: The editor layout survives any preview attempt for the rest of the session

After any supporting-file preview attempt — successful, still loading, or failed, and for any supported file type including PDF — every subsequently opened Skill Editor session SHALL render its complete layout for the current viewport without a page reload. At desktop widths this SHALL include the Files panel and the header's Cancel/Save actions; at mobile widths it SHALL include the collapsible "Editing file" card and the bottom action bar. Exactly one of the mobile and desktop presentations SHALL be visible at a given viewport width.

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
- **THEN** the desktop width shows the Files panel and header actions without the mobile "Editing file" card or bottom action bar, and the mobile width shows the card and bottom action bar without the desktop panel and header actions

#### Scenario: A preview opened elsewhere does not degrade a later editor session
- **WHEN** a user opens a PDF attachment preview outside the Skill Editor and then opens the Skill Editor
- **THEN** the editor renders its complete layout for the current viewport

#### Scenario: Recovery requires no reload
- **WHEN** any of the above sequences is performed
- **THEN** the complete layout is restored by in-app navigation alone; no browser reload is required at any point
