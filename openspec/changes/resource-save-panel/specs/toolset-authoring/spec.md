## MODIFIED Requirements

### Requirement: Save and exit
The editor SHALL persist the toolset via the backend write API on save and SHALL surface a saving state. In create mode the primary action persists immediately. In edit mode the primary action opens the Save panel (see the `resource-save-panel` capability), and the toolset is persisted only when the panel's Save is confirmed. Through the panel, the toolset may be moved to another Personal folder, saved as a new version, or saved and then published to an Organization folder. In edit mode the Version field SHALL be read-only.

On successful save it SHALL raise a success notification and navigate to the return URL (the catalog, `ROUTES.Catalog`). On failure of the save itself it SHALL keep the user in the editor and show an error.

The success notification SHALL be raised through `useOperationNotification` with `NotifiableEntity.Toolset` and `EntityOperation.Created` (create mode) or `EntityOperation.Edited` (edit mode, keep version), passing the toolset's name. Navigation SHALL NOT be delayed to keep the notification on screen.

#### Scenario: Successful create
- **WHEN** a user with a valid form clicks the primary action (labelled "Create" in create mode) while creating a new toolset
- **THEN** the system calls the create endpoint and, on success, shows a success notification titled `"Toolset created successfully"` and navigates to the return URL

#### Scenario: Successful update
- **WHEN** a user with a valid form clicks Save while editing an existing toolset and confirms "Keep version" in the current folder in the Save panel
- **THEN** the system calls the update endpoint and, on success, shows a success notification titled `"Toolset edited successfully"` and navigates to the return URL

#### Scenario: Save as new version
- **WHEN** a user editing toolset `search@1.0.0` confirms "Save as new version" `1.1.0` in the Save panel
- **THEN** the system calls the create endpoint with the edited values, `version: "1.1.0"` and `createOnly: true`, makes no update request for `search__1.0.0`, and navigates to the return URL

#### Scenario: Version is read-only in edit mode
- **WHEN** a user opens an existing toolset in the editor
- **THEN** the Version field is read-only

#### Scenario: Notification survives leaving the editor
- **WHEN** the editor navigates to the return URL immediately after a successful save
- **THEN** the success notification remains visible on the destination route

#### Scenario: Save failure
- **WHEN** the backend returns an error during save
- **THEN** the editor remains open, shows an error notification, clears the saving state, and shows no success notification
