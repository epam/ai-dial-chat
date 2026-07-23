# quick-app-authoring Specification

## Purpose
TBD - created by archiving change add-intro-field-quick-app-toolset. Update Purpose after archive.

## Requirements

### Requirement: General step fields
The Quick App editor's General step SHALL allow editing the application name, version, icon
URL, description, topics, and intro. The icon SHALL be entered as a plain URL text field. Name
SHALL be required and restricted to letters, digits, spaces, underscores, dots, and dashes.
Intro SHALL be a single-line text field limited to 90 characters and SHALL be optional. These
fields SHALL be rendered and validated through the shared `deployment-creation-form` library
component, the same component used by Toolset creation's General step.

#### Scenario: Edit general fields
- **WHEN** a user types a name, version, icon URL, description, intro, and adds topic tags
- **THEN** those values are held in component state without saving

#### Scenario: Name is required
- **WHEN** a user clears the name field and attempts to save
- **THEN** the system shows a required-field error for the name and blocks the save

#### Scenario: Intro exceeds the character limit
- **WHEN** a user enters an intro longer than 90 characters and attempts to save
- **THEN** the system shows a length-limit error on the intro field and blocks the save

#### Scenario: Intro is optional
- **WHEN** a user leaves the intro field empty and saves the Quick App
- **THEN** the save proceeds without an intro-related error

### Requirement: Create request forwards form fields
On save, the editor SHALL submit the General step field values — including `intro` when set —
to the create-application endpoint via the generated `@epam/chat-api-client`
`ApplicationsApi`, through the `apps/chat/src/server-api/applications.ts` wrapper.

#### Scenario: Save sends intro
- **WHEN** a user saves a new Quick App with a non-empty intro
- **THEN** the create request body includes `intro` with the entered value

#### Scenario: Save omits intro
- **WHEN** a user saves a new Quick App with an empty intro
- **THEN** the create request body does not include a truthy `intro` value

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

### Requirement: Settings step readiness gates Save and Preview

The Settings step's embedded editor runs in an iframe and communicates over
`postMessage`. The "Save & Exit" and "Preview" actions SHALL be disabled until the
iframe has signaled it is ready to interact (`AppsEditorEvent.ReadyToInteract`).
Triggering a save or preview before readiness would post a message the embedded app is
not yet listening for, and no response (`SaveSuccess`/`SaveError`) would ever arrive,
leaving the action's loading state — and therefore the action buttons — stuck disabled
indefinitely with no recovery short of reloading the page. As a defense in depth against
any other case where no response arrives, a save or preview action that does not
receive a response within a bounded timeout SHALL time out, reset the loading state, and
surface an error, rather than leaving the buttons stuck disabled forever.

#### Scenario: Save & Exit is disabled before the Settings step is ready
- **WHEN** the Settings step's iframe has not yet sent `ReadyToInteract`
- **THEN** the "Save & Exit" button is disabled and cannot trigger a save

#### Scenario: Preview is disabled before the Settings step is ready
- **WHEN** the Settings step's iframe has not yet sent `ReadyToInteract`
- **THEN** the "Preview" button is disabled and cannot trigger a preview

#### Scenario: Buttons re-enable once the Settings step becomes ready
- **WHEN** the Settings step's iframe sends `ReadyToInteract` after the user has been
  waiting on the Settings step
- **THEN** the "Save & Exit" and "Preview" buttons become enabled without requiring a
  page reload

#### Scenario: A save that never receives a response times out instead of hanging forever
- **WHEN** a save is triggered and no `SaveSuccess`/`SaveError` response arrives within
  the bounded timeout
- **THEN** the saving state is cleared, an error is shown, and the "Save & Exit" button
  becomes clickable again without a page reload
