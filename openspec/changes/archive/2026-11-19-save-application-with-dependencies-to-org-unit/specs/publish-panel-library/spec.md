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

### Requirement: PublishFoldersTree supports a per-row disabled state with a reason
`PublishFoldersTree` SHALL accept an optional `getDisabledReason?: (destination: FolderDestination) => string | undefined` (in single-root mode `rootKey` is the empty string). A folder for which it returns a non-empty string SHALL render disabled with that string as its reason: `aria-disabled="true"`, not selectable by click, Enter or Space, still reachable by keyboard and arrow navigation, and still expandable so its children can be reached. The reason SHALL show as a kit tooltip on hover and focus and SHALL also be exposed through `aria-describedby` on the row, so it never depends on hover. The disabled look SHALL NOT rely on color or opacity alone. The tree takes no rights data and knows no unit: the host decides and passes the text. If the tree turns out not to support a per-row disabled state with a reason, the work stops and is reported before anything is built around it. When the callback is absent, or returns `undefined` for every folder, the tree behaves exactly as before. The whole-tree `disabled` prop keeps its meaning and wins over the per-row state. Search results and the existing keyboard navigation include disabled rows, and inline folder creation is not offered under a disabled folder. Layout uses logical properties and the tooltip places by `start`/`end`.

`SaveToFolderPanel`, `StandaloneSaveToFolderPanel`, `PublishPanel` and `StandalonePublishPanel` SHALL forward `getDisabledReason` to the tree, so a host sets one callback per panel (the catalog's details panel takes it as `getPublishDisabledReason`). `SaveToFolderPanel`'s main view SHALL also show the reason of the committed destination directly under the destination row, in the destination section and above `destinationNote`, as a kit section-message notification of the error variant (which carries its own alert role, so it is not wrapped in a second live region), linked to the destination group by `aria-describedby`.

#### Scenario: Disabled row cannot be selected
- **WHEN** `getDisabledReason` returns a reason for `{ rootKey: 'organization', path: ['EPAM', 'Sales'] }` and the user clicks that row
- **THEN** `onDestinationChange` is not called

#### Scenario: Reason reaches assistive technology
- **WHEN** keyboard focus reaches a disabled row
- **THEN** the row has `aria-disabled="true"` and its accessible description is the reason text, and the tooltip shows it

#### Scenario: Children of a disabled folder stay reachable
- **WHEN** a disabled folder is expanded and `getDisabledReason` returns `undefined` for its child
- **THEN** the child is selectable

#### Scenario: No callback, no change
- **WHEN** the tree is rendered without `getDisabledReason`
- **THEN** it renders, selects and navigates exactly as before this change

#### Scenario: Whole-tree disabled wins
- **WHEN** the tree has `disabled` set and `getDisabledReason` returns `undefined` for a folder
- **THEN** that folder is still disabled

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
