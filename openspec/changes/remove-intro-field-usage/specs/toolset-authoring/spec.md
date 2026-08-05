## MODIFIED Requirements

### Requirement: Draft toolset creation on advancing to Settings
When a user advances from the General step to the Settings step for a toolset that has not
yet been persisted, the editor SHALL create the toolset via the backend write API using the
General-step field values (name, version, icon URL, description, topics) and an empty
endpoint, before switching to the Settings step. The returned toolset id SHALL be used for
the remainder of the session — Settings-step actions, login, the Connect toolset section, and
the final Save, which SHALL update rather than re-create the toolset.

If the toolset already has a persisted id (a draft created by an earlier Next, or an existing
toolset opened in edit mode) and the form has changed since it was last persisted, advancing
to the Settings step again SHALL update (not re-create) the toolset with the current form
values before switching steps. If the form has not changed since it was last persisted, the
editor SHALL NOT send a create or update request and SHALL just switch to the Settings step.

#### Scenario: Next creates a draft toolset
- **WHEN** a user on the General step with a valid name clicks Next
- **THEN** the editor calls the create endpoint with the General-step field values and an
  empty endpoint, receives a toolset id, and switches to the Settings step

#### Scenario: Next updates a persisted toolset with unsaved changes
- **WHEN** a user returns to the General step of an already-persisted toolset (draft or
  existing), edits a field, and clicks Next again
- **THEN** the editor calls the update endpoint (not create) with the current form values
  before switching to the Settings step

#### Scenario: Next sends no request when nothing changed
- **WHEN** a user returns to the General step of an already-persisted toolset without editing
  anything and clicks Next again
- **THEN** the editor sends neither a create nor an update request and switches straight to
  the Settings step

#### Scenario: Final save updates the draft
- **WHEN** a user completes the Settings step and clicks Save & Exit for a toolset created via
  Next
- **THEN** the editor calls the update endpoint, not create, using the previously created
  toolset id

#### Scenario: Draft creation failure
- **WHEN** the create call triggered by Next fails
- **THEN** the editor stays on the General step and shows an error notification

### Requirement: General step fields
The General step SHALL allow editing the toolset name, version, icon URL, description, and
topics. The icon SHALL be entered as a plain URL text field (no file-manager). Topics SHALL be
entered as free-entry tags sourced from the application config. These fields SHALL be
rendered and validated through the shared `deployment-creation-form` library component, the
same component used by Quick App creation's General step. The General step SHALL NOT render
an Intro field.

#### Scenario: Edit general fields
- **WHEN** a user types a name, version, icon URL, description, and adds topic tags
- **THEN** those values are held in component state without saving

#### Scenario: Name is required
- **WHEN** a user clears the name field and attempts to proceed or save
- **THEN** the system shows a required-field error for the name and blocks the save
