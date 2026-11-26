# Spec Delta

## ADDED Requirements

### Requirement: The catalog and project publish panels pre-check the target in the selected folder

The catalog publish panel (applications, toolsets, prompts, skills) and the project publish panel SHALL supply `usePublishFlow` an `onCheckTargetExists` that calls the target-check endpoint of the publish API with the item's entity type and id, the selected folder and, for applications and toolsets, the item's version. The panel has no version field of its own: the version is the saved resource's, so the user resolves a collision by renaming or re-versioning the resource itself, not in the panel. When the folder is selected, the panel SHALL ask; while the request runs Publish SHALL be disabled; when the target is taken the panel SHALL show a warning callout under the destination row and keep Publish disabled; when the check fails Publish SHALL stay enabled. If the item's version changes while a folder is selected, the check SHALL run again. The conversation publish panel is not changed.

The callout text SHALL say that a resource with this name already exists in the folder and tell the user to rename it or choose another folder. For applications and toolsets it SHALL also tell the user to change the version. Prompts, skills and projects have no version, so their text SHALL NOT mention one. Each text SHALL be a translation key of its own.

#### Scenario: Another author's agent holds the name and version
- **GIVEN** another author already published an agent with the same name and version to folder `F`
- **WHEN** the user selects `F` in the publish panel
- **THEN** the callout says the agent name and version are taken and to rename it, change its version or choose another folder, and Publish is disabled

#### Scenario: Item version changes while the panel is open
- **GIVEN** the callout is shown for the item's version `1.0.0`
- **WHEN** the item's version changes to one that is free in the folder
- **THEN** the check runs again, the callout disappears and Publish is enabled

#### Scenario: A prompt or skill holds the name
- **GIVEN** another author's prompt with the same name is in the selected folder
- **WHEN** the user selects the folder
- **THEN** the callout tells the user to rename it or choose another folder and does not mention a version

#### Scenario: A project holds the name
- **GIVEN** another author's project with the same name is in the selected folder
- **WHEN** the user selects the folder in the project publish panel
- **THEN** the same callout without a version part is shown and Publish is disabled

#### Scenario: Check in flight
- **WHEN** the user selects a folder and the check has not answered yet
- **THEN** Publish is disabled until it answers

#### Scenario: Check fails
- **WHEN** the target-check request fails
- **THEN** no callout is shown and Publish stays enabled

#### Scenario: Freshly created folder is not checked
- **WHEN** the user creates a new folder in the panel and selects it
- **THEN** no check request is sent

### Requirement: A publish rejected as target-exists explains how to resolve it

When the publish endpoint answers `409` with `code: "target-exists"`, the catalog and project publish flows SHALL treat it as a taken target: the panel SHALL show the same callout as after the pre-check instead of the generic "Publishing failed. Please try again." callout, and the error notification SHALL carry the same text instead of Core's raw message. The notification text SHALL follow the same version/no-version split as the callout.

Any other publish failure SHALL keep the generic callout and the existing notification behaviour.

#### Scenario: Taken target found only on submit
- **GIVEN** the pre-check answered that the target is free (for example the copy is hidden from the user, or another publication landed in between)
- **WHEN** the user submits and the endpoint answers `409` `target-exists`
- **THEN** the panel shows the target-taken callout, the notification tells the user to rename it (or change its version) or choose another folder, and the raw Core message is not shown

#### Scenario: Other failures are unchanged
- **WHEN** the publish endpoint answers `502`
- **THEN** the generic submit-error callout and the existing notification are shown
