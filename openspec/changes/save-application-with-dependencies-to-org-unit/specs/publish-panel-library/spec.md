# Spec Delta

## MODIFIED Requirements

### Requirement: SaveToFolderPanel lists private dependencies in the main view

`SaveToFolderPanelBaseProps` (`libs/publish-panel/src/models/save-to-folder-panel.ts`) SHALL accept optional `dependencies?: PublishDependency[]`, `dependenciesLabels?: PublishDependenciesLabels`, `dependenciesStyles?: PublishDependenciesStyles` and `dependenciesNote?: string`, and `SaveToFolderPanel` and `StandaloneSaveToFolderPanel` SHALL render `PublishDependenciesList` with the first three in the main view only, above the versions history. The section SHALL be informational: it SHALL NOT change `isSubmitDisabled` or any submit behavior, and SHALL render nothing while `dependencies` is omitted or empty and no note is given. When `dependenciesNote` is given and `dependencies` is omitted or empty, the panel SHALL render that text as a plain paragraph in the same place, under the section's heading from `dependenciesLabels`; when both are given the list is rendered and the note is not. The panel SHALL NOT decide when the section or the note applies; the host passes them only for the destinations and resource kinds that need them, and the library learns nothing about the resource's kind.

#### Scenario: Dependencies are listed in the main view
- **WHEN** `SaveToFolderPanel` renders the main view with `dependencies` holding one prompt
- **THEN** the dependencies heading and the prompt's name are present

#### Scenario: Empty or omitted list renders nothing
- **WHEN** `dependencies` is `[]` or omitted and no `dependenciesNote` is given
- **THEN** no dependencies section is rendered

#### Scenario: Note without a list
- **WHEN** `dependencies` is omitted and `dependenciesNote` is "Dependencies are saved together."
- **THEN** the dependencies heading and that text are present and no rows are rendered

#### Scenario: List wins over the note
- **WHEN** `dependencies` holds one prompt and `dependenciesNote` is also given
- **THEN** the prompt is listed and the note is not rendered

#### Scenario: Folder view shows no section
- **WHEN** the panel renders the folder view with `dependencies` non-empty
- **THEN** no dependencies section is rendered

## ADDED Requirements

### Requirement: SaveToFolderPanel can show a notice under the destination

`SaveToFolderPanelBaseProps` SHALL accept an optional `destinationNote?: string`, and `SaveToFolderPanel` and `StandaloneSaveToFolderPanel` SHALL render it in the main view as a plain paragraph under the destination path, in the same section. The panel SHALL render it as given, SHALL NOT decide when it applies, SHALL NOT change `isSubmitDisabled` or any submit behavior because of it, and SHALL NOT put it in a live region. It SHALL render nothing while `destinationNote` is omitted or empty, and nothing in the folder view.

Both notes (`dependenciesNote` and `destinationNote`) SHALL take their typography from the optional `noteClassName` prop, whose default is `'dial-small-text'`, and their text color from `SaveToFolderPanelColors.noteText`, set as the CSS custom property `--stf-note-text` and falling back to `--text-secondary`. The notes SHALL use no physical left/right classes.

#### Scenario: Destination note is shown
- **WHEN** `SaveToFolderPanel` renders the main view with `destinationNote` "The icon will not be copied."
- **THEN** that text is present under the destination and is not inside an element with role `alert` or `status`

#### Scenario: No note
- **WHEN** `destinationNote` is omitted
- **THEN** no paragraph is rendered under the destination

#### Scenario: Notes in a right-to-left page
- **WHEN** both notes are rendered under `dir="rtl"`
- **THEN** both are plain text in reading order and carry no physical direction classes
