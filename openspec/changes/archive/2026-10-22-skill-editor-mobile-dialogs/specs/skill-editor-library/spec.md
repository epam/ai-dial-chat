# Spec Delta

## MODIFIED Requirements

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

#### Scenario: Replacing a file's content makes the form dirty
- **WHEN** an upload committed with `replacesExisting: true` overwrites an existing file, leaving `files` unchanged
- **THEN** `onDirtyChange(true)` is called, and the form stays dirty until it is re-seeded from a new `initialValues`

### Requirement: EditorLayout delegates header and body frame
`SkillEditor` SHALL use `EntityEditor` from `@epam/ai-dial-builder-form` as its outer shell, the same shell every entity editor uses. The skill keeps its Files | selected-file arrangement on that shell. `EntityEditor` SHALL receive the following:

- `onBack`, `labels.backAriaLabel` and `title`, forwarded from `SkillEditorProps`.
- `metadataTitle={null}` and `metadata`: the Files pane, which carries its own "Files" heading. On mobile it sits inside the collapsible "Editing file" card, whose summary row shows the caption and the selected file's type icon and name next to a down/up caret.
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

#### Scenario: Mobile Editing file card comes first
- **WHEN** `SkillEditor` renders at mobile width
- **THEN** the collapsible "Editing file" card renders first, followed by the selected file's section

#### Scenario: Name and Description belong to SKILL.md
- **WHEN** a supporting file is selected in the Files tree
- **THEN** the right panel shows only the supporting file, and Name and Description reappear once `SKILL.md` is selected again
