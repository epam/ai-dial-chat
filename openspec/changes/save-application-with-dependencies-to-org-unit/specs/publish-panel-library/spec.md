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
