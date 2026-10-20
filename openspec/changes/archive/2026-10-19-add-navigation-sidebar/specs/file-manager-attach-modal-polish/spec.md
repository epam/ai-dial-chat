## MODIFIED Requirements

### Requirement: Attach is a picker without bulk actions or column filters

In Attach mode, `DialFileManagerShell` SHALL NOT supply `bulkActionsToolbarOptions`, so the bulk-actions toolbar (selection count, `Clear selection`, bulk Download and Delete) is not rendered: the footer's `Attach` button is the only action on the selection. It SHALL turn column filtering off in the grid (`gridOptions.filterable: false`), because the search bar replaces it, and SHALL render the toolbar's Add button with the neutral button variant (`toolbarOptions.newButtonVariant`), because the footer owns the primary action. Standalone mode SHALL keep column filters, the bulk-actions toolbar and the default Add button. The shell's surface SHALL default to the base layer in both Standalone and Attach modes, with the tree panel raised on top of it. A host MAY replace that background through the optional `surfaceClassName`, as the standalone page does inside its desktop card.

#### Scenario: Selecting files shows no bulk toolbar in Attach

- **WHEN** a user selects a file in the attach modal
- **THEN** the `Attach` button becomes enabled, no selection count or `Clear selection` control is rendered, and no bulk Download or Delete is offered

#### Scenario: Attach picker configuration

- **WHEN** the attach modal renders
- **THEN** the grid has column filtering turned off and the Add button uses the neutral variant

#### Scenario: Standalone keeps filters and bulk actions

- **WHEN** the standalone File storage page renders
- **THEN** column filters and the bulk-actions toolbar remain available
