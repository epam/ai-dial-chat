## MODIFIED Requirements

### Requirement: Save and exit
The editor SHALL persist the toolset via the backend write API on save and SHALL surface a saving state. Both in create mode and in edit mode of the user's own toolset, the primary action opens the Save panel (see the `resource-save-panel` capability), and the toolset is persisted only when the panel's Save is confirmed:

- in create mode the panel creates the toolset create-only in the chosen Personal folder (`createToolsetCreateAdapter`), or at the Personal root and then publishes it to an Organization folder; it offers no version choice;
- in edit mode the toolset may be saved in place, moved to another Personal folder, saved as a new version, or saved and then published to an Organization folder. In edit mode the Version field SHALL be read-only.

A toolset shared with the user saves in place without the panel. A toolset created through the panel in this session (including the draft the editor saves before a Log In) is then edited as the user's own.

On a successful save the panel raises the success notification and the editor navigates to the return URL (the catalog, `ROUTES.Catalog`). When the save itself fails, the panel shows the error, stays open, and the editor stays put.

The success notification SHALL be raised through `useOperationNotification` with `NotifiableEntity.Toolset` and `EntityOperation.Created` (create) or `EntityOperation.Edited` (edit, keep version), passing the toolset's name. Navigation SHALL NOT be delayed to keep the notification on screen.

#### Scenario: Successful create
- **WHEN** a user with a valid form clicks the primary action (labelled "Create" in create mode) and confirms the Save panel with Personal `Search`
- **THEN** the system calls the create endpoint with `createOnly: true` and `folderPath: "Search"` and, on success, shows a success notification titled `"Toolset created successfully"` and navigates to the return URL

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
- **WHEN** the backend returns an error during the panel's save
- **THEN** the editor remains open, the panel shows the error and clears its saving state, and no success notification is shown
