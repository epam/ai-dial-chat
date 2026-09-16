## MODIFIED Requirements

### Requirement: Dirty-navigation guard
When the edit or create form has unsaved changes (`onDirtyChange(true)` most recently reported by `libs/skill-editor`), the page SHALL confirm before: activating Cancel, activating the page's Back control **while the `SKILL.md` view is shown**, or closing/navigating away from the browser tab via `beforeunload`. A confirmed navigation proceeds; a declined one leaves the user on the page with their edits intact. No in-app router-level navigation-blocking mechanism (e.g. intercepting arbitrary link/menu clicks elsewhere in the app) is in scope — no such pattern exists elsewhere in this codebase to extend, and this guard is scoped to the page's own Cancel/Back controls plus the browser-level `beforeunload` guard.

The Back control while a supporting file is selected is **not** a navigation and SHALL NOT be guarded: it returns to the `SKILL.md` view inside the editor (see `skill-file-preview`'s "Returning from a supporting-file preview"), so it neither discards edits nor leaves the page and therefore SHALL NOT raise the confirmation. Cancel SHALL remain an editor exit in every selection state, guarded as above.

#### Scenario: Cancel with unsaved changes confirms first
- **WHEN** a user has unsaved edits and activates Cancel
- **THEN** the page asks for confirmation before navigating to `returnUrl`; declining leaves the edits intact

#### Scenario: Cancel with no unsaved changes navigates immediately
- **WHEN** a user has made no edits (or has reverted to the seeded state) and activates Cancel
- **THEN** the page navigates immediately, with no confirmation prompt

#### Scenario: Back from the manifest view with unsaved changes confirms first
- **WHEN** a user has unsaved edits, the `SKILL.md` view is shown, and they activate Back
- **THEN** the page asks for confirmation before navigating to `returnUrl`; declining leaves the edits intact

#### Scenario: Back from a supporting-file preview with unsaved changes does not prompt
- **WHEN** a user has unsaved edits, a supporting file is selected, and they activate Back
- **THEN** the editor returns to the `SKILL.md` view with the edits intact, no confirmation prompt is shown, and no navigation occurs

#### Scenario: Cancel from a supporting-file preview is still guarded
- **WHEN** a user has unsaved edits, a supporting file is selected, and they activate Cancel
- **THEN** the page asks for confirmation before navigating to `returnUrl`, exactly as it does from the `SKILL.md` view

### Requirement: Selecting a supporting file in edit mode opens its preview

In edit mode, selecting a supporting-file node in the file tree (any node other than `SKILL.md`) SHALL open a preview of that file's already-unpacked in-memory bytes (from the edit-mode ZIP unpack described in "Frontmatter and supporting files are unpacked and preserved for editing") through the `skill-file-preview` capability. This SHALL NOT trigger any additional `downloadSkill` call or other network request — the bytes are already resident in the page's `Map<relativePath, Uint8Array>` from the initial load. Selecting `SKILL.md` SHALL continue to show the editable manifest form exactly as today, closing any open supporting-file preview; activating the editor header's Back control while a supporting file is selected SHALL have the same effect, returning to the manifest form without leaving the editor.

#### Scenario: Selecting an unpacked supporting file previews it with no extra download
- **WHEN** an edit-mode session has loaded a skill whose ZIP contained `assets/logo.png`, and a user selects that node
- **THEN** the preview renders `assets/logo.png` from the already-unpacked bytes, with no additional network request beyond the original `downloadSkill` call

#### Scenario: Selecting SKILL.md after previewing a file returns to the manifest form
- **WHEN** a user has a supporting file previewed and then selects the `SKILL.md` node
- **THEN** the preview closes and the editable Name/Description/Instructions form renders as it did before any file was previewed

#### Scenario: Back after previewing a file returns to the manifest form
- **WHEN** a user has a supporting file previewed and activates the editor header's Back control
- **THEN** the preview closes, the editable Name/Description/Instructions form renders with its current values, and the editor route is unchanged
