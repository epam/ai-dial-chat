## MODIFIED Requirements

### Requirement: File-tree selection and protected `SKILL.md` node

`SkillEditor` SHALL render a file tree seeded from a `files` prop (the in-memory supporting-file/folder structure) plus an always-present, always-first root `SKILL.md` node. The library SHALL own which tree node is currently selected and which folder nodes are expanded as internal state (overridable via optional `selectedPath`/`expandedPaths` + `onSelectedPathChange`/`onExpandedPathsChange` controlled props, mirroring `PublishFoldersTree`'s controlled/uncontrolled pattern). The `SKILL.md` node SHALL NOT expose rename, move, or delete affordances; all other nodes SHALL. When a supporting-file node (not `SKILL.md`, not a folder) is selected, the main pane SHALL render the host-supplied `supportingFileContent` prop when present, falling back to the existing `labels.supportingFileNote` text when it is not. Selecting a folder node SHALL only select or expand/collapse that folder and SHALL NOT render `supportingFileContent` or `supportingFileNote`.

#### Scenario: SKILL.md is selected by default
- **WHEN** `SkillEditor` first renders with no `selectedPath` override
- **THEN** the `SKILL.md` node is selected and the main pane shows the "SKILL.md" heading with the Name/Description/Instructions fields

#### Scenario: SKILL.md cannot be renamed, moved, or deleted
- **WHEN** a user opens the context menu or interaction affordance for the `SKILL.md` node
- **THEN** no rename, move, or delete action is offered

#### Scenario: Selecting a supporting file updates the main pane heading and renders host content
- **WHEN** a user selects a supporting file node other than `SKILL.md`
- **THEN** the main pane heading updates to that file's name, `onSelectedPathChange` (if provided) is called with the new path, and the main pane body renders the host's `supportingFileContent` node when the host supplied one for this selection

#### Scenario: Selecting a folder does not render supporting-file content
- **WHEN** a user selects or expands a folder node
- **THEN** the main pane does not render `supportingFileContent` or `supportingFileNote`, and only the folder's selection/expansion state changes

#### Scenario: Falls back to the static note when no content is supplied
- **WHEN** a host does not pass `supportingFileContent` and selects a supporting file
- **THEN** the main pane renders `labels.supportingFileNote` exactly as it did before this change

## ADDED Requirements

### Requirement: Host-rendered supporting-file content slot

`SkillEditor` SHALL accept an optional `supportingFileContent?: ReactNode` prop and render it verbatim in the main pane whenever the currently selected node is a supporting file (not `SKILL.md`, not a folder), with no knowledge of what it contains. This follows the same pattern as the existing `headerContent` prop: the library owns layout and the selection/visibility decision, the host owns the rendered content (typically an attachment preview). No new callback (e.g. `onPreviewFile`) is introduced — the existing `selectedPath`/`onSelectedPathChange` controlled pair already tells the host which node is selected, which is sufficient for the host to decide what to pass as `supportingFileContent`.

#### Scenario: Host content renders for the selected supporting file
- **WHEN** the host passes `supportingFileContent={<FilePreview />}` while a supporting file is selected
- **THEN** `<FilePreview />` renders in the main pane in place of the default note

#### Scenario: Host content does not render for SKILL.md or a folder
- **WHEN** the host passes a non-`undefined` `supportingFileContent` while `SKILL.md` or a folder node is selected
- **THEN** the library does not render `supportingFileContent` for that selection — it only ever appears for a selected supporting-file node

#### Scenario: Omitting the prop preserves prior behavior
- **WHEN** a host never passes `supportingFileContent`
- **THEN** `SkillEditor` behaves exactly as it did before this prop existed
