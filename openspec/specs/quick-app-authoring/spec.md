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
icon URL, topics, `intro`, and `display_version` — as a `general` payload on the
`TriggerSave` message posted to the embedded Settings-step editor, so the embedded editor
persists them as part of the single save it already performs for the Settings step. The
host SHALL NOT make a separate `update-application` (or any other) request to persist
these values. The `general` payload SHALL NOT include the backend `version` field.
Triggering a Preview action SHALL NOT
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
- **WHEN** a user edits Topic, Description, Intro, Icon, Name, or Version on the General step of an
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

### Requirement: SaveSuccess reports whether persisted data changed

The Settings step's embedded editor (the separate Quick Apps application loaded at
`schema.editorUrl`, out of this repo's source tree) SHALL include a `hasChanges: boolean`
field on the `AppsEditorEvent.SaveSuccess` message it posts back to the host after a
`TriggerSave` completes successfully — for both a plain Settings-step save and one that also
carried a `general` payload. `hasChanges` SHALL be computed by the embedded editor by
comparing the record it is about to persist against the record as it existed before this
save, and SHALL be `true` if any field the user can edit changed — Settings-step
configuration (`application_properties`, including orchestrator/tool set state,
conversation starters, chat-input-disabled state, etc.) or any forwarded `general` field
(name, description, icon URL, topics, intro). It SHALL be `false` when none of those fields
changed, even though the save still updates server-managed metadata such as `updatedAt`. A
save that persists no user-editable field change but still touches only metadata (e.g. a
no-op re-save) SHALL report `hasChanges: false`.

This field is part of the cross-repo `postMessage` contract between this host
(`apps/chat/src/pages/AppsEditor`) and the embedded Quick Apps editor; it requires a
corresponding change in the Quick Apps editor's own save-completion code, not only in this
repo. Until the embedded editor sends it, the host SHALL treat a `SaveSuccess` without the
field as `hasChanges: false` (see the `app-preview-chat` spec's "Preview session resets when
the saved configuration actually changed" requirement for how the host uses this value).

On this repo's side, `apps/chat/src/types/apps-editor.ts` SHALL declare a
`SaveSuccessMessage` interface (`{ type: AppsEditorEvent.SaveSuccess; hasChanges?: boolean }`)
and `AppEditorIframe`'s message handler SHALL forward the received `hasChanges` value (or
`undefined`) to its `onSaveSuccess` prop, which SHALL be widened from `() => void` to
`(hasChanges: boolean) => void` (normalizing a missing/non-boolean field to `false` before
calling it), threading it through `SettingsStep` to `AppsEditor`.

#### Scenario: Settings-only change is reported
- **WHEN** the user changes orchestrator/tool set configuration in the Settings step and
  triggers a save
- **THEN** the embedded editor's `SaveSuccess` message includes `hasChanges: true`

#### Scenario: General-only change is reported
- **WHEN** the user only edits a General step field (forwarded via the `general` payload) and
  no Settings-step configuration changed, then triggers Save & Exit
- **THEN** the embedded editor's `SaveSuccess` message includes `hasChanges: true`

#### Scenario: No user-editable field changed
- **WHEN** the user triggers a save (e.g. via Preview) without having changed any
  Settings-step configuration or General field since the last save
- **THEN** the embedded editor's `SaveSuccess` message includes `hasChanges: false`, even
  though the persisted record's `updatedAt` still advances

#### Scenario: Host forwards the flag to `onSaveSuccess`
- **WHEN** `AppEditorIframe` receives a `SaveSuccess` message with `hasChanges: true`
- **THEN** it calls `onSaveSuccess(true)` (not the no-argument call used before this
  requirement)

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

The embedded editor MAY instead post a `LoggedOut` message once its session has resolved
and the user is not authenticated (or the session errored). In that case `ReadyToInteract`
was already sent (so the loading spinner clears) but `ReadyToSave` will never arrive, since
the embedded editor cannot load its data model without an authenticated session. This is an
expected state, not a readiness failure, so the host SHALL NOT surface the generic
"Settings not ready" timeout error while, or after, a `LoggedOut` message has been received
for the current Settings-step session — including suppressing an instance of that error
already shown before `LoggedOut` arrived. The "Save & Exit" and "Preview" buttons SHALL
remain disabled in this state, since `ReadyToSave` still gates them and will not arrive.

#### Scenario: A logged-out signal suppresses the readiness-timeout error
- **WHEN** the Settings step's iframe posts `LoggedOut` before the readiness timeout elapses
- **THEN** the timeout does not surface the "Settings not ready" error once it elapses, and
  the "Save & Exit" and "Preview" buttons remain disabled

#### Scenario: A logged-out signal clears an already-surfaced readiness-timeout error
- **WHEN** the readiness timeout has already surfaced the "Settings not ready" error and the
  Settings step's iframe then posts `LoggedOut`
- **THEN** the "Settings not ready" error is cleared

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
