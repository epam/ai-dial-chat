## MODIFIED Requirements

### Requirement: Edit-specific labels and success notification
In edit mode, the page SHALL render an edit-specific title and Save-button label (distinct from create mode's "Create skill" title and Create button) and, on a successful save, SHALL show a success notification distinct from the create-success notification in both its title and its message (e.g. title "Skill updated" vs. "Skill created", message "\"{{name}}\" has been updated." vs. "\"{{name}}\" has been created."). The edit-mode notification's title SHALL use a dedicated i18n key distinct from create mode's title key — reusing the create-mode title key for an edit-mode save is a defect, not an acceptable shortcut.

#### Scenario: Edit mode shows Save, not Create
- **WHEN** the page renders in edit mode
- **THEN** the primary submit button reads a Save-oriented label, and the page title reflects editing an existing skill

#### Scenario: Successful edit save shows an update notification
- **WHEN** an edit save succeeds
- **THEN** the shown notification's title and message both reflect an update ("Skill updated"), not a creation ("Skill created")
