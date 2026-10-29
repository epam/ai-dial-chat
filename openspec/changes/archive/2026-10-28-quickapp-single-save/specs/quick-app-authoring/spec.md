## MODIFIED Requirements

### Requirement: Editing General step fields persists the changes on Save & Exit

In edit mode (an `appId` is known, whether from the URL or from an in-place create in this session), metadata edits SHALL be held in memory and persisted only when the user clicks **Save**.

When Save is clicked, the editor SHALL do the following:

- It SHALL always include the current metadata values (name, description, icon URL, topics and `display_version`) as a `general` payload on the `TriggerSave` message posted to the embedded Setup editor, for both Save and Preview. The embedded editor persists them as part of the single save it already performs and is the single writer: the host makes no follow-up `updateApplication` request.
- The `general` payload SHALL NOT include an `intro` property or the backend `version` field.
- The `general` payload SHALL NOT alter the application's setup configuration (`application_properties`, including orchestrator/tool set state) or its `version`.

#### Scenario: Save forwards edited metadata to the embedded editor
- **WHEN** a user edits Topic, Description, Icon, Name or Version of an existing Quick App and clicks Save
- **THEN** the `TriggerSave` message includes a `general` payload carrying the edited values (with no `intro` property), and the host makes no `updateApplication` request of its own

#### Scenario: Save still forwards metadata when it is unchanged
- **WHEN** a user clicks Save without editing any metadata field
- **THEN** the `TriggerSave` message still includes a `general` payload carrying the current values

#### Scenario: Save after an in-place create forwards metadata
- **WHEN** a user creates a Quick App in this session, edits its Description in the Metadata section and clicks Save
- **THEN** the `TriggerSave` message includes a `general` payload carrying the edited Description

#### Scenario: Preview forwards metadata
- **WHEN** a user triggers Preview
- **THEN** the `TriggerSave` message posted to the embedded editor includes the same `general` payload as Save, and the host makes no `updateApplication` request after `SaveSuccess`

#### Scenario: Save does not affect setup configuration or version
- **WHEN** metadata edits are forwarded on Save for an app that already has orchestrator or tool set configuration, or a `version`
- **THEN** that configuration and version are unchanged after the save completes

