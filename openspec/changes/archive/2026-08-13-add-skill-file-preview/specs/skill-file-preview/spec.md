## ADDED Requirements

### Requirement: Selecting a supporting file previews it via the shared attachment-canvas pipeline

`apps/chat/src/pages/SkillEditor/SkillEditor.tsx` SHALL own an effect over `libs/skill-editor`'s `selectedPath` (received via `onSelectedPathChange`) that, when the selected path resolves to a `SkillFileTreeNode` with `kind: File` (excluding the synthetic `SKILL.md` node), converts that node's in-memory bytes into an `Attachment` (`libs/chat-shared/src/models/chat.ts`) and calls `useOpenAttachmentCanvas().openAttachmentCanvas(attachment, attachment.id)`. The converted `Attachment`'s `id` SHALL be the file's full relative path (e.g. `agents/analyzer.md`), not a basename or content-derived hash, so two files sharing a basename in different folders never collide. No new BFF or DIAL Core request SHALL be made to service this preview — the bytes already live in `SkillEditor.tsx`'s `filesContentRef` (create-mode uploads or edit-mode unpacked ZIP entries).

The preview content SHALL be rendered through the extracted `AttachmentCanvasBody` component (`libs/attachment-canvas`) — the same Markdown/JSON/Code/Html/Pdf/Image/Audio/Visualizer/Unsupported/Error/loading rendering `AttachmentCanvas` already uses for chat attachments — mounted by the app inside `libs/skill-editor`'s new `supportingFileContent` slot, not the global `AttachmentCanvasContainer` sidebar.

#### Scenario: Selecting a Markdown supporting file opens the Markdown renderer
- **WHEN** a user selects `agents/analyzer.md` in the Files tree
- **THEN** its content renders through the same Markdown renderer chat attachments use, with no network request to the BFF or DIAL Core

#### Scenario: Selecting a code file opens the syntax-highlighted code renderer
- **WHEN** a user selects `eval-viewer/generate_review.py`
- **THEN** its content renders through the same syntax-highlighted code renderer chat attachments use

#### Scenario: Two files with the same basename in different folders preview independently
- **WHEN** a user selects `agents/README.md`, then selects `assets/README.md`
- **THEN** each selection opens its own file's content — the second selection does not display the first file's content, and no stale canvas state from the first file is reused for the second

#### Scenario: Unsupported binary file shows the existing unsupported state
- **WHEN** a user selects a supporting file whose extension/MIME is not recognized by any renderer
- **THEN** the preview shows the same "preview not supported" state chat attachments show, not an error or a blank pane

### Requirement: Preview lifecycle tracks selection, removal, replacement, and navigation

The preview SHALL replace its content whenever a different supporting file is selected, close when the currently-previewed file is removed, refresh when the currently-previewed file's bytes are replaced (e.g. re-uploading a file at the same path), and close when the user navigates away from the Skill Editor route or switches between a create and an edit resource. Selecting the same already-previewed file again SHALL NOT re-trigger a duplicate `openCanvas` call. Selecting `SKILL.md` or a folder node SHALL NOT open or affect the preview.

Asynchronous content resolution SHALL guard against out-of-order completion: if a user selects file A and then quickly selects file B before A's content finishes resolving, the preview SHALL show file B's content once both resolve, never A's.

#### Scenario: Removing the previewed file closes the preview
- **WHEN** a user removes the supporting file that is currently previewed
- **THEN** the preview closes and the main pane returns to its default state (the SKILL.md form, if `SKILL.md` becomes selected, or the library's default "no file selected" presentation)

#### Scenario: Replacing the previewed file's bytes refreshes the preview
- **WHEN** a user re-uploads a file at the path that is currently previewed, replacing its bytes
- **THEN** the preview updates to reflect the new bytes without requiring the user to reselect the file

#### Scenario: Rapid selection change shows only the latest file
- **WHEN** a user selects file A and, before its content resolves, selects file B
- **THEN** the preview ends up showing file B's content; file A's slower-resolving content is discarded if it arrives after B's selection

#### Scenario: Leaving the Skill Editor closes the preview
- **WHEN** a user navigates away from `/skill-editor` while a supporting file is previewed
- **THEN** the attachment canvas closes and any object URL created for that preview is revoked

#### Scenario: Selecting SKILL.md does not open a preview
- **WHEN** a user selects the `SKILL.md` node while a supporting file was previously previewed
- **THEN** the preview closes and the manifest form renders instead; no attachment-canvas content is shown for `SKILL.md`

### Requirement: Zero-byte supporting files open as a valid empty preview

A zero-byte text/code/markdown/JSON supporting file SHALL open as a valid empty preview (empty content, not an error or "missing" state); this SHALL be verified generically against chat's own locally-picked zero-byte attachments, since the underlying fix is not Skill-specific.

The Skill Editor's inline preview exposes no Download or Close control of its own — matching the inspected Figma node, which shows no such affordance. `AttachmentCanvasBody`'s renderers and `libs/attachment-canvas`'s `downloadAttachmentContent` utility remain generically reusable by a future host that does want a download action (e.g. the global sidebar `AttachmentCanvasContainer` still exposes one), but the Skill Editor does not wire one up. Returning to the `SKILL.md` form is done by re-selecting `SKILL.md` in the file tree, not a dedicated close button.

#### Scenario: A zero-byte text file opens as an empty preview, not a missing-content error
- **WHEN** a user uploads an empty (`0` bytes) `.txt` file and selects it
- **THEN** the preview shows an empty text area, not the "preview not supported" or error state

#### Scenario: No download or close control is rendered in the inline preview
- **WHEN** a user selects any supporting file in the Skill Editor
- **THEN** no Download or Close button is rendered alongside the preview content — the only way back to the `SKILL.md` form is re-selecting it in the file tree

### Requirement: The attachment canvas context is reachable from the Skill Editor route

The Skill Editor page SHALL be able to open, update, and close attachment-canvas preview state without requiring any new route-level provider — `AttachmentCanvasProvider` is already mounted globally above the router in `apps/chat/src/main.tsx`. This capability SHALL NOT depend on `OverlayFeature.AttachmentsManager` or on the global `AttachmentCanvasContainer`/sidebar being mounted on the Skill Editor route.

#### Scenario: Preview works regardless of the AttachmentsManager feature flag
- **WHEN** `OverlayFeature.AttachmentsManager` is disabled for the current user
- **THEN** selecting a supporting file in the Skill Editor still opens its preview

#### Scenario: Conversation attachment preview is unaffected
- **WHEN** a user opens an attachment preview in a conversation, then separately visits `/skill-editor`
- **THEN** each surface's preview behavior is unaffected by the existence of the other; no shared preview state leaks between a conversation and a Skill Editor session

### Requirement: Accessibility, RTL, i18n, and cross-cutting behavior

Selecting a file via keyboard (arrow keys + Enter, per `skill-editor-library`'s existing keyboard support) SHALL open its preview identically to a pointer click. The rendered preview region SHALL expose an accessible region name (via `AttachmentCanvasBody`'s existing labeling, applied by the app's content-only wrapper — see the "no Download or Close control" requirement above). Preview loading SHALL be announced via the existing `aria-live="polite"` status pattern `attachment-canvas` already uses; preview failures SHALL use the existing alert/error content type, not a new error surface. No new keyboard focus trap SHALL be introduced when a preview opens inline in the main pane. The preview body relies on `AttachmentCanvasBody`'s existing RTL handling; since the Skill Editor renders no header of its own around it, there are no app-level directional icons to mirror. All new user-visible strings SHALL use existing `attachment-canvas` i18n keys where the copy is identical, and new `skillEditor.*` keys only where it is genuinely Skill-Editor-specific — no hardcoded strings in JSX. This capability is not gated behind any `ENABLED_FEATURES`/`ENABLED_FEATURES_ROLES` key; it activates for every user who can already reach `/skill-editor`. The app-level file→attachment conversion SHALL be memoized (`useMemo`/`useCallback` as appropriate) keyed on the selected path and its underlying bytes reference, so unrelated re-renders of `SkillEditor.tsx` do not re-derive or re-open the preview.

#### Scenario: Keyboard selection opens the preview
- **WHEN** a keyboard-only user moves file-tree selection to a supporting file via arrow keys and Enter
- **THEN** the preview opens exactly as it would from a pointer click

#### Scenario: Preview loading is announced
- **WHEN** a supporting file's content is still resolving
- **THEN** an `aria-live="polite"` region announces the loading state

#### Scenario: RTL renders correctly
- **WHEN** the Skill Editor is viewed under `dir="rtl"` with a supporting file previewed
- **THEN** the preview and its header render mirrored via logical properties/`rtl:` variants, matching `attachment-canvas`'s existing RTL behavior
