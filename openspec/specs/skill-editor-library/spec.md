# skill-editor-library Specification

## Purpose
Specifies `libs/skill-editor`'s host-agnostic `SkillEditor` React component: its public package surface, host-isolation boundary (no REST/i18n/routing knowledge), form-field and file-tree state ownership, create/edit-mode and save-conflict presentation, accessibility, and RTL support.

## Requirements

### Requirement: Public package surface
`libs/skill-editor/src/index.ts` SHALL export a `SkillEditor` React component plus every TypeScript type reachable through its props (form values, labels/texts, file-tree node types, callback signatures, error/status enums, edit-mode/conflict-state types). Internal-only helpers SHALL NOT be exported from the barrel. The package `libs/skill-editor/package.json` SHALL declare `name: "@epam/ai-dial-skill-editor"`, an `exports` map with `.` (`@epam/source`/types/import/default), `./package.json`, and `./styles.css` (→ `./dist/index.css`), peer dependencies on `react`, `@epam/ai-dial-ui-kit`, `@epam/ai-dial-chat-shared`, and `@epam/ai-dial-react-file-manager`, and regular `dependencies` on `@epam/ai-dial-builder-form`, `@tabler/icons-react`, `@uiw/react-md-editor`, and `@uiw/react-markdown-preview`.

The `headerContent?: ReactNode` prop IS REMOVED from `SkillEditorProps`. It is replaced by:
- `onBack: () => void` — called when the back button is clicked
- `backAriaLabel?: string` — accessible label for the back button (English default `'Back'`)
- `title: string` — heading text shown in the header

#### Scenario: Consumer imports the library's public surface
- **WHEN** `apps/chat` is type-checked
- **THEN** `SkillEditor`, `SkillEditorValues`, `SkillEditorLabels`, `SkillFileTreeNode`, and `SkillEditorConflict` all resolve from `@epam/ai-dial-skill-editor`

#### Scenario: Internal helper is not part of the public surface
- **WHEN** code outside `libs/skill-editor` attempts to import an unexported internal helper (e.g. a path-formatting utility used only inside the component) from `@epam/ai-dial-skill-editor`
- **THEN** the import fails to resolve, since the barrel does not re-export it

#### Scenario: headerContent prop is removed
- **WHEN** a consumer passes `headerContent={<>...</>}` to `SkillEditor`
- **THEN** the TypeScript compiler reports an error — `headerContent` is no longer a valid prop

#### Scenario: Back button delegates to onBack
- **WHEN** a user clicks the back-arrow button in the skill editor header
- **THEN** `onBack` is called exactly once

### Requirement: No host, REST, serialization, or i18n dependency
`libs/skill-editor/src/**` SHALL NOT import `react-i18next`, `i18next`, any module under `apps/chat/src/server-api`, `@epam/chat-api-client`, `yaml`, `fflate`, any app-level React Context/provider, `react-router-dom`, or any environment/feature-flag/analytics module. All user-facing strings SHALL be supplied via a `labels`/`texts` prop object with English-language defaults. The library SHALL treat `name`, `description`, and `instructions` as opaque strings and SHALL NOT serialize them to YAML frontmatter or a ZIP archive itself.

#### Scenario: No i18n import
- **WHEN** `libs/skill-editor/src/**` is searched for `react-i18next`/`i18next` imports
- **THEN** none are found; all copy is passed in via the `labels` prop

#### Scenario: No serialization or server-api import
- **WHEN** `libs/skill-editor/src/**` is searched for imports of `yaml`, `fflate`, `apps/chat/src/server-api`, or `@epam/chat-api-client`
- **THEN** none are found

#### Scenario: No routing import
- **WHEN** `libs/skill-editor/src/**` is searched for `react-router-dom` imports
- **THEN** none are found; navigation is exposed only via `onSubmit`/`onCancel` callback props

### Requirement: Form field state ownership
`SkillEditor` SHALL own the current `name`, `description`, and `instructions` field values as internal state, seeded from an `initialValues` prop and re-seeded whenever `initialValues`'s identity changes, mirroring `libs/prompt-editor`'s `PromptEditorValues` pattern. Field-level validation messages, `invalid` state, and submit-time conflict errors SHALL be supplied by the host via an `errors` prop rather than computed internally, since DIAL-specific normalization and path-safety rules live at the app boundary.

When the host passes `isNameReadOnly`, the Name field SHALL render as non-editable (disabled/read-only, with its value still visible and still included in submitted values unchanged) regardless of any local edit attempt. `SkillEditor` SHALL call an optional `onDirtyChange(isDirty: boolean)` prop whenever any field value or the file-tree state diverges from its most recently seeded `initialValues`/`files`, and again with `false` when it returns to exactly that seeded state (e.g. the user undoes their own edit).

#### Scenario: Editing a field updates local state and notifies the host
- **WHEN** a user types into the Name field
- **THEN** `SkillEditor`'s internal `name` state updates immediately and the rendered input reflects the new value

#### Scenario: Host-supplied error renders inline
- **WHEN** the host passes `errors.name = 'A skill with this name already exists'`
- **THEN** the Name field renders in an invalid state with that message, without `SkillEditor` performing its own existence check

#### Scenario: Read-only Name cannot be edited
- **WHEN** the host passes `isNameReadOnly={true}`
- **THEN** the Name field's input rejects keystrokes/paste and any submitted value for `name` equals the seeded `initialValues.name` unchanged

#### Scenario: Dirty state is reported on first edit
- **WHEN** a user changes any field or adds/removes a file after the form has seeded from `initialValues`
- **THEN** `onDirtyChange(true)` is called; if the user then reverts to the exact seeded values, `onDirtyChange(false)` is called

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

### Requirement: Host-rendered supporting-file content slot

`SkillEditor` SHALL accept an optional `supportingFileContent?: ReactNode` prop and render it verbatim in the main pane whenever the currently selected node is a supporting file (not `SKILL.md`, not a folder), with no knowledge of what it contains. The library owns layout and the selection/visibility decision, the host owns the rendered content (typically an attachment preview). No new callback (e.g. `onPreviewFile`) is introduced — the existing `selectedPath`/`onSelectedPathChange` controlled pair already tells the host which node is selected, which is sufficient for the host to decide what to pass as `supportingFileContent`.

#### Scenario: Host content renders for the selected supporting file
- **WHEN** the host passes `supportingFileContent={<FilePreview />}` while a supporting file is selected
- **THEN** `<FilePreview />` renders in the main pane in place of the default note

#### Scenario: Host content does not render for SKILL.md or a folder
- **WHEN** the host passes a non-`undefined` `supportingFileContent` while `SKILL.md` or a folder node is selected
- **THEN** the library does not render `supportingFileContent` for that selection — it only ever appears for a selected supporting-file node

#### Scenario: Omitting the prop preserves prior behavior
- **WHEN** a host never passes `supportingFileContent`
- **THEN** `SkillEditor` behaves exactly as it did before this prop existed

### Requirement: Adding and removing supporting files and folders
`SkillEditor` SHALL expose an **Add** dropdown in the Files pane header and **Add child** / **Add sibling** submenus in each non-`SKILL.md` node's context menu (specified by the `skill-file-tree-actions` capability). Supporting files SHALL be added only through the upload dialog (specified by the `skill-file-drag-drop` capability) — whether their source is the device, an archive expanded by `fileActions.extractArchive`, or the DIAL file system via `fileActions.pickFromFileSystem` — so a user always stages one or more files, reviews them, and commits the whole valid batch at once, rather than a single file being added directly on selection. Validation SHALL be performed through a host-supplied `fileActions.validateBatch` callback (returning per-candidate and batch-level results) and commit SHALL be performed through a host-supplied `fileActions.commitBatch` callback, so the app boundary's path-safety, size, count, and duplicate-detection rules apply without the library encoding any DIAL-specific policy itself. The library SHALL offer creating an empty folder only when the host supplies `fileActions.onCreateFolder`; it SHALL NOT offer creating an empty file. Removing an already-committed supporting file or folder from the editor's tree (as opposed to removing a not-yet-committed staged candidate inside the upload dialog) SHALL happen immediately on the **Delete** action, with no confirmation step — the entry SHALL be removed from local state and the host-supplied removal callback invoked synchronously when Delete is activated.

#### Scenario: Uploading files from the device adds them as supporting files
- **WHEN** a user activates Add → Upload files from device, stages one or more local files in the resulting dialog, and confirms
- **THEN** `fileActions.commitBatch` is called with the staged batch and, on success, a corresponding node appears in the tree for each committed file

#### Scenario: A rejected batch shows inline errors and commits nothing
- **WHEN** every candidate in the staged batch fails `fileActions.validateBatch`
- **THEN** the library shows each candidate's error inline in the dialog and does not call `fileActions.commitBatch`

#### Scenario: No control exists to create an empty file
- **WHEN** a host renders `SkillEditor`
- **THEN** no "New file" action is present anywhere in the Add dropdown, the node menus, the upload dialog, or elsewhere in the files pane

#### Scenario: Folder creation is offered only with host support
- **WHEN** a host renders `SkillEditor` without `fileActions.onCreateFolder`
- **THEN** no Create folder entry is present in the Add dropdown or any node submenu

#### Scenario: Removing a committed supporting entry happens immediately, with no confirmation
- **WHEN** a user triggers the Delete action on a non-`SKILL.md` node already present in the editor's file tree
- **THEN** the entry is removed from the tree immediately, the host's removal callback is invoked with that entry's path, and no confirmation prompt is shown

#### Scenario: Removing a staged (not yet committed) candidate needs no such confirmation
- **WHEN** a user removes a row from the still-open upload dialog's staged list before confirming the batch
- **THEN** the candidate is removed immediately, with no separate confirmation step, since nothing has been added to the editor's tree yet

### Requirement: Loading, saving, and inline error presentation
`SkillEditor` SHALL accept `isLoading`, `isSubmitting`, and `submitError` props and SHALL render, respectively, a loading state in place of the form, disabled Cancel/Create actions with a saving indicator while submitting, and an inline error region (`role="alert"`) reflecting `submitError` without redirecting or clearing user input.

#### Scenario: Submitting disables both actions
- **WHEN** `isSubmitting` is `true`
- **THEN** both the Cancel and Create actions are disabled and a saving indicator is visible

#### Scenario: Submit failure preserves user input
- **WHEN** `submitError` is set after a failed submit
- **THEN** the error renders in a `role="alert"` region and all field values remain exactly as the user left them

### Requirement: Create/edit mode presentation and conflict-state actions
`SkillEditor` has no `mode` prop and infers no DIAL-specific policy (bucket resolution, path construction, ETag semantics) of its own — create-vs-edit presentation is fully expressed through props the host already supplies: `isNameReadOnly` (host sets `true` in edit mode, since DIAL Core has no rename/move operation for a skill) and `labels.createLabel` (the host resolves "Create" vs "Save" per its own i18n before passing it down). `SkillEditor` SHALL accept an optional `conflict` prop describing a save-time conflict (distinct from `submitError`, which represents an unrecoverable submit failure) and, when present, SHALL render a conflict-specific message plus a "Reload latest" action that calls an `onReloadLatest` callback prop — this action SHALL NOT clear the user's current field/file edits itself; discarding those edits (if the host chooses to, after the callback resolves) is the host's decision, not the library's.

#### Scenario: Host-resolved label reflects edit mode
- **WHEN** the host renders `<SkillEditor isNameReadOnly labels={{ createLabel: 'Save', ... }} .../>` (host-resolved per its own i18n and edit-mode state)
- **THEN** the submit button shows "Save" and the Name field is read-only, with no `mode` prop involved

#### Scenario: Conflict state renders a non-destructive reload action
- **WHEN** the host passes a `conflict` prop describing a stale-ETag save failure
- **THEN** the library renders the conflict message and a "Reload latest" control that calls `onReloadLatest` when activated, without itself discarding any field value

### Requirement: EditorLayout delegates header and body frame
`SkillEditor` SHALL use `EntityEditor` from `@epam/ai-dial-builder-form` as its outer shell, the same shell every entity editor uses. The skill keeps its Files | selected-file arrangement on that shell. `EntityEditor` SHALL receive the following:

- `onBack`, `labels.backAriaLabel` and `title`, forwarded from `SkillEditorProps`.
- `metadataTitle={null}` and `metadata`: the Files pane, which carries its own "Files" heading. On mobile it sits inside the collapsible "Editing file" accordion.
- `setupTitle`: `SKILL.md`, or `labels.selectedFileHeading(name)` for a supporting file.
- `setup`: for `SKILL.md`, the shared `MetadataForm` followed by the Instructions editor, which fills the height left below the fields. `MetadataForm` gets these settings:
  - `fields={[MetadataField.Name, MetadataField.Description]}`
  - `isDescriptionRequired`
  - `nameCaption` (the existing lowercase-and-hyphens caption)
  - `isNameReadOnly` forwarded from the existing prop
  - `renderDescription` wrapping the Description textarea in `TextRefinementField` when `onRefineDescription` is supplied, so the AI refine action keeps working

  For another selected file, `setup` is the host-rendered supporting-file content slot. The Name and Description values stay owned by the skill editor's field state (see "Form field state ownership"). `MetadataForm` is controlled.
- `alert`: the `submitError` text, or the `conflict` message with its "Reload latest" action.
- `onCancel`, `onSubmit`, `submitLabel` (from `labels.createLabel`, which the host resolves as Create or Save), and `isSubmitting` (from the `isSubmitting` prop).

#### Scenario: Header row rendered by the shared shell
- **WHEN** `SkillEditor` renders
- **THEN** the header row (back arrow, title, Cancel, primary button) is rendered by `EntityEditor`, not by markup local to `SkillEditor`

#### Scenario: Desktop layout — Files left, selected file right
- **WHEN** `SkillEditor` renders at desktop width
- **THEN** the left panel shows the Files tree and no "Metadata" heading
- **AND** the right panel shows a section titled with the selected file path; for `SKILL.md` it holds Name, Description and Instructions

#### Scenario: Mobile accordion comes first
- **WHEN** `SkillEditor` renders at mobile width
- **THEN** the collapsible "Editing file" accordion renders first, followed by the selected file's section

#### Scenario: Name and Description belong to SKILL.md
- **WHEN** a supporting file is selected in the Files tree
- **THEN** the right panel shows only the supporting file, and Name and Description reappear once `SKILL.md` is selected again

### Requirement: Accessibility of the editor surface
`SkillEditor` SHALL expose: a named, keyboard-operable file tree (each expandable node exposing `aria-expanded`, each selectable node exposing `aria-selected`); visible focus states on every interactive element at least as strong as its hover state; `aria-live="polite"` status text for save-in-progress and save-success feedback, separate from any static button `aria-label`; and no focusable descendant left reachable inside a collapsed/hidden region (using `inert`, not bare `aria-hidden`, for any collapsed panel that still contains focusable content). Device upload is not a standalone button: it is the "Upload files from device" item (plus "Upload archive from device" when `fileActions.extractArchive` is supplied) of the Files pane's **Add** `ButtonDropdown`, and activating it opens the upload dialog rather than the native file picker directly; the dropdown's menu semantics come from the ui-kit `ButtonDropdown`, not from library-specific ARIA.

#### Scenario: Keyboard user can operate the file tree
- **WHEN** a keyboard-only user tabs to the file tree and uses arrow keys / Enter
- **THEN** they can expand folders, move selection, and activate nodes without a pointer

#### Scenario: Save-in-progress is announced
- **WHEN** `isSubmitting` becomes `true`
- **THEN** an `aria-live="polite"` region announces the saving state, independent of the Create button's own stable label

#### Scenario: Collapsed mobile Files summary has no reachable hidden focus
- **WHEN** the "Editing file" summary is collapsed on a narrow layout
- **THEN** the collapsed tree's descendants are `inert` and unreachable by Tab, not merely `aria-hidden`

### Requirement: Direction inheritance without i18n
`SkillEditor` SHALL rely on CSS logical properties and the ambient `dir` attribute inherited from `<html>` for right-to-left layout; it SHALL NOT import `react-i18next`/`i18next` or otherwise inspect the active application language to decide direction. Directional icons (back/expand/collapse chevrons) SHALL be mirrored via `rtl:scale-x-[-1]` or an equivalent logical/`rtl:` Tailwind variant.

#### Scenario: Renders correctly under an RTL ancestor
- **WHEN** `SkillEditor` is mounted under an ancestor with `dir="rtl"`
- **THEN** its layout flips via inherited CSS logical properties with no prop or i18n call telling it to do so

#### Scenario: Directional chevrons mirror in RTL
- **WHEN** the file tree's expand/collapse chevron renders under `dir="rtl"`
- **THEN** the chevron is visually mirrored via a logical/`rtl:` class, not a hardcoded left/right icon swap

### Requirement: Host-observable field-value changes

`SkillEditorProps` SHALL accept an optional
`onValuesChange?: (values: SkillEditorValues) => void` callback. `SkillEditor` SHALL
invoke it with the complete current `SkillEditorValues` object whenever any of
`name`, `description`, or `instructions` changes, including when a change originates
from a paste into the Instructions Markdown editor. It SHALL NOT be invoked for
file-tree changes, which are already reported through `fileActions` and
`onDirtyChange`.

`SkillEditor` SHALL NOT invoke `onValuesChange` while seeding or re-seeding from
`initialValues` — seeding is not a user edit, and a host that validated the seeded
value would show an error the user did not cause.

This callback exists so a host can validate a field's content live and feed the result
back through the existing `errors` prop. The library SHALL derive no meaning from the
values it reports: it SHALL continue to treat `name`, `description`, and `instructions`
as opaque strings, SHALL NOT parse them, and SHALL NOT gain a dependency on `yaml` or
any other serialization package, preserving the "No host, REST, serialization, or i18n
dependency" requirement.

The prop is optional and additive: an existing consumer that omits it observes no
behavior change.

#### Scenario: Typing into a field reports the full value object

- **WHEN** a user types into the Description field
- **THEN** `onValuesChange` is called with an object carrying the current `name`, `description`, and `instructions`, with `description` reflecting the new text

#### Scenario: Pasting into Instructions reports the pasted value

- **WHEN** a user pastes multi-line text into the Instructions Markdown editor
- **THEN** `onValuesChange` is called with `instructions` equal to the editor's new full value

#### Scenario: Seeding does not report a change

- **WHEN** the host passes a new `initialValues` object identity and the form re-seeds
- **THEN** `onValuesChange` is not called

#### Scenario: Omitting the callback changes nothing

- **WHEN** a consumer renders `SkillEditor` without `onValuesChange`
- **THEN** the component behaves exactly as before, with no error and no extra render work

#### Scenario: The library still performs no serialization

- **WHEN** `libs/skill-editor/src/**` is searched for imports of `yaml` or `fflate`
- **THEN** none are found, and `libs/skill-editor/package.json` declares neither as a dependency or peer dependency
