## MODIFIED Requirements

### Requirement: General step fields
The General step SHALL allow editing the toolset name, version, icon URL, description,
topics, and intro. The icon SHALL be entered as a plain URL text field (no file-manager).
Topics SHALL be entered as free-entry tags sourced from the application config. Intro SHALL
be a single-line text field limited to 90 characters. These fields SHALL be rendered and
validated through the shared `deployment-creation-form` library component, the same component
used by Quick App creation's General step.

#### Scenario: Edit general fields
- **WHEN** a user types a name, version, icon URL, description, intro, and adds topic tags
- **THEN** those values are held in component state without saving

#### Scenario: Name is required
- **WHEN** a user clears the name field and attempts to proceed or save
- **THEN** the system shows a required-field error for the name and blocks the save

#### Scenario: Intro exceeds the character limit
- **WHEN** a user enters an intro longer than 90 characters and attempts to save
- **THEN** the system shows a length-limit error on the intro field and blocks the save

#### Scenario: Intro is optional
- **WHEN** a user leaves the intro field empty and saves the toolset
- **THEN** the save proceeds without an intro-related error
