## ADDED Requirements

### Requirement: Public package surface
`libs/skill-editor/src/index.ts` SHALL export a `SkillEditor` React component plus every TypeScript type reachable through its props (form values, labels/texts, file-tree node types, callback signatures, error/status enums). Internal-only helpers SHALL NOT be exported from the barrel. The package `libs/skill-editor/package.json` SHALL declare `name: "@epam/ai-dial-skill-editor"`, an `exports` map matching `libs/prompt-editor/package.json`'s shape (source/types/import/default for `.`, plus `./package.json`), and peer dependencies on `react`, `@epam/ai-dial-ui-kit`, `@epam/ai-dial-chat-shared`, `@epam/ai-dial-react-file-manager`, and `@tabler/icons-react`.

#### Scenario: Consumer imports the library's public surface
- **WHEN** `apps/chat/src/pages/SkillEditor/SkillEditor.tsx` writes `import { SkillEditor, SkillEditorValues, SkillEditorLabels, SkillFileTreeNode } from '@epam/ai-dial-skill-editor'`
- **THEN** the import resolves successfully and every named type is defined

#### Scenario: Internal helper is not part of the public surface
- **WHEN** code outside `libs/skill-editor` attempts to import an unexported internal helper (e.g. a path-formatting utility used only inside the component) from `@epam/ai-dial-skill-editor`
- **THEN** the import fails to resolve, since the barrel does not re-export it

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

#### Scenario: Editing a field updates local state and notifies the host
- **WHEN** a user types into the Name field
- **THEN** `SkillEditor`'s internal `name` state updates immediately and the rendered input reflects the new value

#### Scenario: Host-supplied error renders inline
- **WHEN** the host passes `errors.name = 'A skill with this name already exists'`
- **THEN** the Name field renders in an invalid state with that message, without `SkillEditor` performing its own existence check

### Requirement: File-tree selection and protected `SKILL.md` node
`SkillEditor` SHALL render a file tree seeded from a `files` prop (the in-memory supporting-file/folder structure) plus an always-present, always-first root `SKILL.md` node. The library SHALL own which tree node is currently selected and which folder nodes are expanded as internal state (overridable via optional `selectedPath`/`expandedPaths` + `onSelectedPathChange`/`onExpandedPathsChange` controlled props, mirroring `PublishFoldersTree`'s controlled/uncontrolled pattern). The `SKILL.md` node SHALL NOT expose rename, move, or delete affordances; all other nodes SHALL.

#### Scenario: SKILL.md is selected by default
- **WHEN** `SkillEditor` first renders with no `selectedPath` override
- **THEN** the `SKILL.md` node is selected and the main pane shows the "SKILL.md" heading with the Name/Description/Instructions fields

#### Scenario: SKILL.md cannot be renamed, moved, or deleted
- **WHEN** a user opens the context menu or interaction affordance for the `SKILL.md` node
- **THEN** no rename, move, or delete action is offered

#### Scenario: Selecting a supporting file updates the main pane heading
- **WHEN** a user selects a supporting file node other than `SKILL.md`
- **THEN** the main pane heading updates to that file's name and `onSelectedPathChange` (if provided) is called with the new path

### Requirement: Adding and removing supporting files and folders
`SkillEditor` SHALL expose an "Add" interaction offering "New file", "New folder", and "Upload from device" actions, each validated through a host-supplied `validatePath: (path: string) => string | null` callback (returning an error message or `null`) before the entry is added to the tree, so the app boundary's path-safety rules apply without the library encoding DIAL-specific reserved-segment knowledge itself. Duplicate paths SHALL be rejected via the same callback. Removing a supporting file or folder SHALL require an explicit confirmation step before the entry is removed from local state.

#### Scenario: Adding a new file with a valid path succeeds
- **WHEN** a user chooses "New file" and enters a path that `validatePath` accepts (returns `null`)
- **THEN** a new file node appears in the tree and `onFilesChange` (if provided) is called with the updated file list

#### Scenario: Adding a duplicate path is rejected
- **WHEN** a user attempts to add a file at a path that already exists in the tree
- **THEN** `validatePath` is invoked, its returned error message is shown inline, and no node is added

#### Scenario: Uploading a file from the device adds it as a supporting file
- **WHEN** a user chooses "Upload from device" and selects a local file
- **THEN** `onFileUpload` is called with the selected `File`/`Blob` and its chosen relative path, and on success a corresponding node appears in the tree

#### Scenario: Removing a supporting entry requires confirmation
- **WHEN** a user triggers delete on a non-`SKILL.md` node
- **THEN** a confirmation prompt appears before the node is actually removed from the tree

### Requirement: Loading, saving, and inline error presentation
`SkillEditor` SHALL accept `isLoading`, `isSubmitting`, and `submitError` props and SHALL render, respectively, a loading state in place of the form, disabled Cancel/Create actions with a saving indicator while submitting, and an inline error region (`role="alert"`) reflecting `submitError` without redirecting or clearing user input.

#### Scenario: Submitting disables both actions
- **WHEN** `isSubmitting` is `true`
- **THEN** both the Cancel and Create actions are disabled and a saving indicator is visible

#### Scenario: Submit failure preserves user input
- **WHEN** `submitError` is set after a failed submit
- **THEN** the error renders in a `role="alert"` region and all field values remain exactly as the user left them

### Requirement: Accessibility of the editor surface
`SkillEditor` SHALL expose: a named, keyboard-operable file tree (each expandable node exposing `aria-expanded`, each selectable node exposing `aria-selected`, and the "Add" trigger exposing `aria-controls` pointing at the tree region it affects); visible focus states on every interactive element at least as strong as its hover state; `aria-live="polite"` status text for save-in-progress and save-success feedback, separate from any static button `aria-label`; and no focusable descendant left reachable inside a collapsed/hidden region (using `inert`, not bare `aria-hidden`, for any collapsed panel that still contains focusable content).

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
