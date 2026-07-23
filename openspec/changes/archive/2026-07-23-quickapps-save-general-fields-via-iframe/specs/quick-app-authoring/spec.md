## MODIFIED Requirements

### Requirement: Editing General step fields persists the changes on Save & Exit

Clicking "Next" on the General step of an existing app (an `appId` is already known) SHALL
only validate the fields and advance to the Settings step — it SHALL NOT call any
persistence API. The edited General step values SHALL be held in memory across the step
transition. Persistence of General step edits SHALL happen only when the user performs the
final "Save & Exit" action from the Settings step. At that point, if this editor session
started against an app that already existed (as opposed to one created fresh in this
session), the editor SHALL include the current General-step values — name, description,
icon URL, and topics, and `intro` — as a `general` payload on the `TriggerSave` message
posted to the embedded Settings-step editor, so the embedded editor persists them as part
of the single save it already performs for the Settings step. The host SHALL NOT make a
separate `update-application` (or any other) request to persist these values. The
`general` payload SHALL NOT include `version`. Triggering a Preview action SHALL NOT
include a `general` payload. The `TriggerSave` message's `general` payload SHALL NOT alter
that application's settings-step configuration (`application_properties`, including
orchestrator/tool set state) or its `version`. "Save & Exit" SHALL always additionally
trigger the Settings step's own save (regardless of whether the Settings step step was
itself touched), matching prior behavior for that step.

#### Scenario: Next does not persist General edits
- **WHEN** a user edits General step fields for an existing app and clicks "Next"
- **THEN** no update-application (or create-application) request is sent, and the editor
  advances to the Settings step with the edited values retained in memory

#### Scenario: Save & Exit forwards edited General fields to the embedded editor
- **WHEN** a user edits Topic, Description, Intro, Icon, or Name on the General step of an
  existing Quick App, clicks Next, and then clicks Save & Exit on the Settings step
- **THEN** the `TriggerSave` message posted to the embedded Settings-step editor includes
  a `general` payload carrying the edited field values, and no `update-application`
  request is made by the host

#### Scenario: Save & Exit still forwards General fields when General is unchanged
- **WHEN** a user does not edit any General step field for an existing app, clicks Next,
  and then clicks Save & Exit on the Settings step without changing Settings either
- **THEN** the `TriggerSave` message still includes a `general` payload carrying the
  (unchanged) current values, no `update-application` request is made, and the Settings
  step save is still triggered as it was before this behavior existed

#### Scenario: Preview does not forward General fields
- **WHEN** a user triggers Preview from the Settings step
- **THEN** the `TriggerSave` message posted to the embedded editor has no `general`
  payload

#### Scenario: Save & Exit does not forward General fields for a session-created app
- **WHEN** a user creates a new app in this editor session, advances to the Settings
  step, and clicks Save & Exit
- **THEN** the `TriggerSave` message posted to the embedded editor has no `general`
  payload, matching the pre-existing behavior for apps created within the current
  session

#### Scenario: Save does not affect Settings-step configuration or version
- **WHEN** the General step's edits are forwarded as part of Save & Exit for an existing
  app that already has orchestrator or tool set configuration, or a `version`, from the
  Settings step
- **THEN** that configuration and version are unchanged after the save completes
