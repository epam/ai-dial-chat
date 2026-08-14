## ADDED Requirements

### Requirement: Selecting a supporting file in edit mode opens its preview

In edit mode, selecting a supporting-file node in the file tree (any node other than `SKILL.md`) SHALL open a preview of that file's already-unpacked in-memory bytes (from the edit-mode ZIP unpack described in "Frontmatter and supporting files are unpacked and preserved for editing") through the `skill-file-preview` capability. This SHALL NOT trigger any additional `downloadSkill` call or other network request — the bytes are already resident in the page's `Map<relativePath, Uint8Array>` from the initial load. Selecting `SKILL.md` SHALL continue to show the editable manifest form exactly as today, closing any open supporting-file preview.

#### Scenario: Selecting an unpacked supporting file previews it with no extra download
- **WHEN** an edit-mode session has loaded a skill whose ZIP contained `assets/logo.png`, and a user selects that node
- **THEN** the preview renders `assets/logo.png` from the already-unpacked bytes, with no additional network request beyond the original `downloadSkill` call

#### Scenario: Selecting SKILL.md after previewing a file returns to the manifest form
- **WHEN** a user has a supporting file previewed and then selects the `SKILL.md` node
- **THEN** the preview closes and the editable Name/Description/Instructions form renders as it did before any file was previewed
