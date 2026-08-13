## MODIFIED Requirements

### Requirement: Save and exit
The editor SHALL persist the toolset via the backend write API on save and SHALL surface a
saving state. On successful save it SHALL raise a success notification and navigate to the
return URL; on failure it SHALL keep the user in the editor and show an error.

The success notification SHALL be raised through `useOperationNotification` (see
`entity-operation-notifications`) with `NotifiableEntity.Toolset` and
`EntityOperation.Created` when the save created the toolset or `EntityOperation.Edited` when
it updated an existing one, passing the toolset's name. The editor SHALL notify and navigate
in the same tick — navigation SHALL NOT be delayed to keep the notification on screen, since
`NotificationContainer` is mounted above the router and the notification survives the route
change.

A save that creates the draft toolset on advancing to the Settings step SHALL NOT notify;
only Save & Exit reports an outcome to the user.

#### Scenario: Successful create
- **WHEN** a user with a valid form clicks Save & Exit while creating a new toolset
- **THEN** the system calls the create endpoint and, on success, shows a success notification
  titled `"Toolset created successfully"` and navigates to the return URL

#### Scenario: Successful update
- **WHEN** a user with a valid form clicks Save & Exit while editing an existing toolset
- **THEN** the system calls the update endpoint and, on success, shows a success notification
  titled `"Toolset edited successfully"` and navigates to the return URL

#### Scenario: Notification survives leaving the editor
- **WHEN** the editor navigates to the return URL immediately after a successful save
- **THEN** the success notification remains visible on the destination route

#### Scenario: Draft creation is silent
- **WHEN** advancing from the General step to the Settings step creates the draft toolset
- **THEN** no success notification is shown

#### Scenario: Save failure
- **WHEN** the backend returns an error during save
- **THEN** the editor remains open, shows an error, clears the saving state, and shows no
  success notification
