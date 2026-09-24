## MODIFIED Requirements

### Requirement: EditorLayout delegates header and body frame
`SkillEditor` SHALL use `EntityEditor` from `@epam/ai-dial-builder-form` as its outer shell, the same shell every entity editor uses. `EntityEditor` SHALL receive the following:

- `onBack`, `labels.backAriaLabel` and `title`, forwarded from `SkillEditorProps`.
- `metadata`: the shared `MetadataForm` with these settings:
  - `fields={[MetadataField.Name, MetadataField.Description]}`
  - `isDescriptionRequired`
  - `nameCaption` (the existing lowercase-and-hyphens caption)
  - `isNameReadOnly` forwarded from the existing prop

  The Name and Description values stay owned by the skill editor's field state (see "Form field state ownership"). `MetadataForm` is controlled.
- `metadataFooter`: the Files pane, below the Metadata section in the left panel.
- `setup`: for `SKILL.md`, the Instructions editor. For another selected file, the host-rendered supporting-file content slot.
- `setupTitle`: `SKILL.md`, or `labels.selectedFileHeading(name)` for a supporting file. This replaces the ad-hoc `<h2>` file heading.
- `alert`: the `submitError` text, or the `conflict` message with its "Reload latest" action.
- `onCancel`, `onSubmit`, `submitLabel` (from `labels.createLabel`, which the host resolves as Create or Save), and `isSubmitting` (from the `isSubmitting` prop).

The existing mobile accordion for the files pane SHALL remain inside `metadataFooter`. `EntityEditor` does not own it.

#### Scenario: Header row rendered by the shared shell
- **WHEN** `SkillEditor` renders
- **THEN** the header row (back arrow, title, Cancel, primary button) is rendered by `EntityEditor`, not by markup local to `SkillEditor`

#### Scenario: Desktop layout — Metadata and Files left, Setup right
- **WHEN** `SkillEditor` renders at desktop width
- **THEN** the left 360 px panel shows a "Metadata" section with Name and Description, followed by the Files tree
- **AND** the right panel shows a section titled with the selected file path containing that file's editor or preview

#### Scenario: Mobile accordion stays in the left panel
- **WHEN** `SkillEditor` renders at mobile width
- **THEN** Metadata renders first, followed by the collapsible "Editing file" accordion, and then the Setup section

#### Scenario: Name and Description stay editable when a supporting file is selected
- **WHEN** a supporting file is selected in the Files tree
- **THEN** the Metadata section still shows the SKILL.md Name and Description, and the Setup section shows the supporting file
