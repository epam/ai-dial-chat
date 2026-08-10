## ADDED Requirements

### Requirement: Folder creation is rejected for invalid names or paths
The system SHALL validate a new folder's name and path before creating it, in both the Publish dialog's destination-folder picker and the generic file manager, and SHALL NOT create the folder when validation fails, regardless of how creation was triggered (Enter key, click, or any other UI interaction).

#### Scenario: Enter key with invalid folder name shows error and does not create folder
- **WHEN** a user is creating a new folder in the Publish dialog's destination-folder picker, types an invalid name or path (e.g. `/invaid/folder`) so the validation error is shown, and presses Enter
- **THEN** no new folder is created (no create-folder action is dispatched) and the validation error remains visible

#### Scenario: Click with invalid folder name shows error and does not create folder
- **WHEN** a user is creating a new folder in the Publish dialog's destination-folder picker, types an invalid name or path, and clicks on or near the folder row to confirm
- **THEN** no new folder is created (no create-folder action is dispatched) and the validation error remains visible

#### Scenario: Valid folder name is created normally
- **WHEN** a user types a valid folder name in the Publish dialog's destination-folder picker or the generic file manager and confirms via Enter or click
- **THEN** the folder is created (the corresponding create-folder action is dispatched) exactly as before this change

#### Scenario: Generic file manager rejects invalid folder name on creation
- **WHEN** a user is creating a new folder in the generic file manager (outside the Publish dialog) and confirms an invalid name or path
- **THEN** no new folder is created (no create-folder action is dispatched) and the validation error remains visible
