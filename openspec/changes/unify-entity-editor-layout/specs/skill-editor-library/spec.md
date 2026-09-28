## MODIFIED Requirements

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
