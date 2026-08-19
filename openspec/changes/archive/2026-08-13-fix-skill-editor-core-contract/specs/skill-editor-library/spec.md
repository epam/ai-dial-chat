## MODIFIED Requirements

### Requirement: Adding and removing supporting files and folders
`SkillEditor` SHALL expose a single "Upload from device" control as the only way to add a supporting file, validated through a host-supplied `validatePath: (path: string) => string | undefined` callback (returning an error message or `undefined`) before the entry is added to the tree, so the app boundary's path-safety rules apply without the library encoding DIAL-specific reserved-segment knowledge itself. The library SHALL NOT offer any control for creating a new empty file or an empty folder — folder nodes are inferred only from the paths of existing files (own or previously loaded), never created directly. Removing a supporting file or folder SHALL require an explicit confirmation step before the entry is removed from local state.

#### Scenario: Uploading a file from the device adds it as a supporting file
- **WHEN** a user activates "Upload from device" and selects a local file
- **THEN** `fileActions.onUploadFile` is called with the selected `File` and its name, and on success a corresponding node appears in the tree

#### Scenario: A rejected upload shows an inline error and adds nothing
- **WHEN** the host's `validatePath` returns an error message for the uploaded file's name
- **THEN** the library renders that message inline and does not call `onUploadFile`

#### Scenario: No control exists to create an empty file or folder
- **WHEN** a host renders `SkillEditor`
- **THEN** no "New file" or "New folder" action is present anywhere in the Add control or elsewhere in the files pane

### Requirement: Accessibility of the editor surface
`SkillEditor` SHALL expose: a named, keyboard-operable file tree (each expandable node exposing `aria-expanded`, each selectable node exposing `aria-selected`); visible focus states on every interactive element at least as strong as its hover state; `aria-live="polite"` status text for save-in-progress and save-success feedback, separate from any static button `aria-label`; and no focusable descendant left reachable inside a collapsed/hidden region (using `inert`, not bare `aria-hidden`, for any collapsed panel that still contains focusable content). Since the "Upload from device" control is a plain button that opens the browser's native file picker rather than a menu or a region it expands in place, it SHALL NOT carry `aria-haspopup`/`aria-controls`.

#### Scenario: Keyboard user can operate the file tree
- **WHEN** a keyboard-only user tabs to the file tree and uses arrow keys / Enter
- **THEN** they can expand folders, move selection, and activate nodes without a pointer

### Requirement: Public package surface
`libs/skill-editor/src/index.ts` SHALL export a `SkillEditor` React component plus every TypeScript type reachable through its props (form values, labels/texts, file-tree node types, callback signatures, error/status enums, edit-mode/conflict-state types). Internal-only helpers SHALL NOT be exported from the barrel. The package `libs/skill-editor/package.json` SHALL declare `name: "@epam/ai-dial-skill-editor"`, an `exports` map matching `libs/prompt-editor/package.json`'s shape (source/types/import/default for `.`, plus `./package.json`), and peer dependencies on `react`, `@epam/ai-dial-ui-kit`, `@epam/ai-dial-chat-shared`, `@epam/ai-dial-react-file-manager`, and `@tabler/icons-react`.

#### Scenario: Consumer imports the library's public surface
- **WHEN** `apps/chat/src/pages/SkillEditor/SkillEditor.tsx` writes `import { SkillEditor, SkillEditorValues, SkillEditorLabels, SkillFileTreeNode, SkillEditorConflict } from '@epam/ai-dial-skill-editor'`
- **THEN** the import resolves successfully and every named type is defined

#### Scenario: Internal helper is not part of the public surface
- **WHEN** code outside `libs/skill-editor` attempts to import an unexported internal helper (e.g. a path-formatting utility used only inside the component) from `@epam/ai-dial-skill-editor`
- **THEN** the import fails to resolve, since the barrel does not re-export it

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

## ADDED Requirements

### Requirement: Create/edit mode presentation and conflict-state actions
`SkillEditor` has no `mode` prop and infers no DIAL-specific policy (bucket resolution, path construction, ETag semantics) of its own — create-vs-edit presentation is fully expressed through props the host already supplies: `isNameReadOnly` (host sets `true` in edit mode, since DIAL Core has no rename/move operation for a skill) and `labels.createLabel` (the host resolves "Create" vs "Save" per its own i18n before passing it down). `SkillEditor` SHALL accept an optional `conflict` prop describing a save-time conflict (distinct from `submitError`, which represents an unrecoverable submit failure) and, when present, SHALL render a conflict-specific message plus a "Reload latest" action that calls an `onReloadLatest` callback prop — this action SHALL NOT clear the user's current field/file edits itself; discarding those edits (if the host chooses to, after the callback resolves) is the host's decision, not the library's.

#### Scenario: Host-resolved label reflects edit mode
- **WHEN** the host renders `<SkillEditor isNameReadOnly labels={{ createLabel: 'Save', ... }} .../>` (host-resolved per its own i18n and edit-mode state)
- **THEN** the submit button shows "Save" and the Name field is read-only, with no `mode` prop involved

#### Scenario: Conflict state renders a non-destructive reload action
- **WHEN** the host passes a `conflict` prop describing a stale-ETag save failure
- **THEN** the library renders the conflict message and a "Reload latest" control that calls `onReloadLatest` when activated, without itself discarding any field value

### Requirement: Host-rendered header content on the desktop action row
`SkillEditor` SHALL accept an optional `headerContent: ReactNode` prop and render it verbatim at the start of the desktop-breakpoint header row, before the Cancel/Create actions, with no knowledge of what it contains (typically a host-rendered back button and page title). This keeps navigation and page-title/i18n concerns entirely at the host boundary while still letting the host's header content and the library's own actions share one visual row, matching a single-row header design.

#### Scenario: Host header content renders alongside the actions
- **WHEN** the host passes `headerContent={<><BackButton /><h1>Create skill</h1></>}`
- **THEN** at the `desktop` breakpoint that content renders at the start of the same row as the Cancel/Create actions, with no `SkillEditor`-imposed spacing between the two that isn't already covered by the row's own layout
