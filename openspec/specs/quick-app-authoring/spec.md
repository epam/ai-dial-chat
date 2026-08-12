# quick-app-authoring Specification

## Purpose
TBD - created by archiving change add-intro-field-quick-app-toolset. Update Purpose after archive.
## Requirements
### Requirement: General step fields
The Quick App editor's General step SHALL allow editing the application name, version, icon
URL, description, and topics. The icon SHALL be entered as a plain URL text field. Name
SHALL be required and restricted to letters, digits, spaces, underscores, dots, and dashes.
The General step SHALL NOT render an Intro field. The name and description fields SHALL also
allow editing translations for additional locales through the shared `DeploymentLocalesField`
popup. These fields SHALL be rendered and validated through the shared `deployment-creation-form`
library component, the same component used by Toolset creation's General step.

#### Scenario: Edit general fields
- **WHEN** a user types a name, version, icon URL, description, and adds topic tags
- **THEN** those values are held in component state without saving

#### Scenario: Edit an additional-locale translation
- **WHEN** a user opens the "Add locale" popup on the General step and adds a translated name
  and description for another language
- **THEN** that translation is held in component state, alongside the primary name and
  description, until the next save

#### Scenario: Name is required
- **WHEN** a user clears the name field and attempts to save
- **THEN** the system shows a required-field error for the name and blocks the save

### Requirement: Create request forwards form fields
On save, the editor SHALL submit the General step field values to the create-application
endpoint via the generated `@epam/chat-api-client` `ApplicationsApi`, through the
`apps/chat/src/server-api/applications.ts` wrapper. The submitted payload SHALL NOT include an
`intro` property. Any additional-locale translations entered through the "Add locale" popup
SHALL be composed into the create request's `locales`/`primaryLocale` fields; when no additional
locales were entered, both fields SHALL be omitted so the request is byte-identical to a save
made before this feature existed.

#### Scenario: Save sends General step values
- **WHEN** a user saves a new Quick App with name, description, icon URL, version, and topics
  filled in
- **THEN** the create request body includes those field values and no `intro` property

#### Scenario: Save sends additional locale translations
- **WHEN** a user saves a new Quick App with a translation added for another language
- **THEN** the create request body includes `locales` with that translation and a
  `primaryLocale` identifying the language the primary name/description are written in

#### Scenario: Save omits locale fields when no translations were added
- **WHEN** a user saves a new Quick App without opening the "Add locale" popup
- **THEN** the create request body includes neither `locales` nor `primaryLocale`

### Requirement: Quick App edit forwards additional locales for forward compatibility only
The `TriggerSave` message's General payload SHALL include `locales`/`primaryLocale` fields
composed the same way as the create request, even though Quick App editing (as opposed to
creation) is handled by an embedded QuickApps editor owned by another repository that this
repository does not control the save for. This repository SHALL NOT assume the embedded editor
honors those fields — until it does, saving an existing Quick App's General step through the
embedded editor MAY flatten a previously configured locale map back to a plain string.

#### Scenario: Save & Exit forwards locale fields to the embedded editor
- **WHEN** an existing Quick App with additional-locale translations advances past the General
  step via "Next"/"Save & Exit"
- **THEN** the `TriggerSave` message's `general` payload includes `locales`/`primaryLocale`
  composed from the current form state, in addition to the existing General-step fields

### Requirement: Editing General step fields persists the changes on Save & Exit

Clicking "Next" on the General step of an existing app (an `appId` is already known) SHALL
only validate the fields and advance to the Settings step — it SHALL NOT call any
persistence API. The edited General step values SHALL be held in memory across the step
transition. Persistence of General step edits SHALL happen only when the user performs the
final "Save & Exit" action from the Settings step. At that point, if this editor session
started against an app that already existed (as opposed to one created fresh in this
session), the editor SHALL include the current General-step values — name, description,
icon URL, topics, and `display_version` — as a `general` payload on the
`TriggerSave` message posted to the embedded Settings-step editor, so the embedded editor
persists them as part of the single save it already performs for the Settings step. The
`general` payload SHALL NOT include an `intro` property. The host SHALL NOT make a separate
`update-application` (or any other) request to persist these values. The `general` payload
SHALL NOT include the backend `version` field. Triggering a Preview action SHALL NOT
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
- **WHEN** a user edits Topic, Description, Icon, Name, or Version on the General step of an
  existing Quick App, clicks Next, and then clicks Save & Exit on the Settings step
- **THEN** the `TriggerSave` message posted to the embedded Settings-step editor includes
  a `general` payload carrying the edited field values (with no `intro` property), and no
  `update-application` request is made by the host

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

The Settings step's embedded editor SHALL include a `hasChanges: boolean` field on the
`AppsEditorEvent.SaveSuccess` message it posts back to the host after a
`TriggerSave` completes successfully — for both a plain Settings-step save and one that also
carried a `general` payload. `hasChanges` SHALL be computed by the embedded editor by
comparing the record it is about to persist against the record as it existed before this
save, and SHALL be `true` if any field the user can edit changed — Settings-step
configuration (`application_properties`, including orchestrator/tool set state,
conversation starters, chat-input-disabled state, etc.) or any forwarded `general` field
(name, description, icon URL, topics). It SHALL be `false` when none of those fields
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

The "Save & Exit" and "Preview" actions SHALL be disabled until the Settings step's
embedded editor — which runs in an iframe and communicates over `postMessage` — has
signaled it is ready to interact (`AppsEditorEvent.ReadyToInteract`).
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

#### Scanario: Preview is reset when step is changed
- **WHEN** current step is changed
- **THEN** Preview state is reset and becomes false

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

### Requirement: Settings iframe receives live updates for toolset logins initiated elsewhere

A toolset login can succeed outside the embedded Settings-step editor's own
`RequestToolsetLogin`/`ToolsetLoginResult` request-response flow — specifically, the global
sign-in-interrupt dialog (`SigninInterruptDialog`) lets the user log into a toolset mid-stream
while the Apps editor Preview chat pane is showing, via `useToolsetLogin`. The embedded
Settings-step editor (`AppEditorIframe`) has no way to learn about that login on its own: it
stays mounted (only visually hidden) while Preview is active per the "Exit preview returns to
the settings iframe without reload" requirement in the `app-preview-chat` spec, and that
requirement forbids reloading it, which would otherwise have been the only way for it to
re-fetch a toolset's current status.

To keep the iframe's own toolset status in sync without reloading it, whenever
`useToolsetLogin`'s `login` resolves with a successful outcome, the host SHALL broadcast the
login's already-encoded `toolsetId` and `credentialsLevel` to any currently mounted
`AppEditorIframe` for the current Apps-editor session (via an in-process pub/sub, not
`postMessage`, since this is host-to-host). On receiving that broadcast, `AppEditorIframe`
SHALL decode the toolset id back to the raw, human-readable form the embedded editor uses
(inverse of `encodeToolsetId`), fetch refreshed credentials the same way `handleToolsetLoginRequest`
does (`fetchToolsetCredentials`), and post a `ToolsetLoginResult` message to the iframe with
that raw id, `success: true`, the credentials level, and the refreshed credentials — the same
message shape already used for iframe-initiated logins, but sent unprompted. This SHALL happen
regardless of whether the iframe is currently visible (Settings step) or hidden (Preview is
active), and regardless of whether the login was for a toolset this particular app actually
uses — the embedded editor is responsible for ignoring a `ToolsetLoginResult` for a toolset id
it does not recognize, matching how it already tolerates unsolicited/duplicate messages in the
existing request-response flow.

#### Scenario: A toolset login completed via the sign-in-interrupt dialog during Preview updates the hidden Settings iframe
- **WHEN** the user is in the Apps editor Preview pane, a `toolset/signin` interrupt appears
  mid-stream for a toolset used by the app being edited, and the user logs in successfully via
  `SigninInterruptDialog`
- **THEN** the still-mounted, hidden `AppEditorIframe` receives a `ToolsetLoginResult` message
  for that toolset with `success: true` and refreshed credentials, without the iframe being
  reloaded or remounted
- **AND** when the user exits Preview back to the Settings step, the toolset's connection
  status shown by the embedded editor already reflects the successful login

#### Scenario: An unrelated toolset login does not require special handling
- **WHEN** a toolset login succeeds for a toolset the currently open app's Settings-step
  configuration does not reference
- **THEN** the host still broadcasts it to the mounted `AppEditorIframe` the same way, and the
  embedded editor is expected to ignore it as an unrecognized toolset id

