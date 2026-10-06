# quick-app-authoring Specification

## Purpose
TBD - created by archiving change add-intro-field-quick-app-toolset. Update Purpose after archive.
## Requirements
### Requirement: General step fields
The Quick App editor's **Metadata section** SHALL allow editing the application's avatar, name, version, description and topics.

- **Avatar** SHALL be picked via the shared `AddAvatar` control (preview box plus "Add avatar" button), not a plain URL text field. It opens the file manager restricted to a single PNG/JPG/SVG image up to 1 MB.
- **Name** SHALL be required and restricted to letters, digits, spaces, underscores, dots and dashes.
- **Intro:** the Metadata section SHALL NOT render an Intro field.
- **Additional locales:** name and description SHALL also allow editing translations for additional locales, through the shared `DeploymentLocalesField` popup. The popup is present only while the host supplies a non-empty `availableLocaleOptions` (see `builder-form`).

These fields SHALL be rendered through the shared `MetadataForm` from `@epam/ai-dial-builder-form` and validated through `useMetadataForm`, the same components the Toolset and Custom App editors use.

#### Scenario: Edit general fields
- **WHEN** a user picks an avatar image and types a name, version, description, and adds topic tags
- **THEN** those values are held in component state without saving

#### Scenario: Pick an avatar image
- **WHEN** a user clicks "Add avatar" in the Metadata section
- **THEN** the file manager opens restricted to PNG, JPG, or SVG files up to 1 MB, and selecting one replaces the placeholder icon with that image while leaving the "Add avatar" button in place so the user can pick a different file

#### Scenario: Edit an additional-locale translation
- **WHEN** a user opens the "Add locale" popup in the Metadata section and adds a translated name and description for another language
- **THEN** that translation is held in component state, alongside the primary name and description, until the next save

#### Scenario: Name is required
- **WHEN** a user clears the name field and attempts to save
- **THEN** the system shows a required-field error for the name and blocks the save

#### Scenario: Created name survives the in-place editor transition
- **WHEN** a user creates a Quick App and the editor switches to its settings in the same session
- **THEN** the submitted name remains in the Metadata form while the deployments list refreshes

#### Scenario: Reloaded editor restores the persisted name
- **WHEN** a user reloads a newly created Quick App's editor
- **THEN** the Metadata form shows the application's persisted name once the deployment resolves

### Requirement: Create request forwards form fields
On save, the editor SHALL submit the General step field values to the create-application
endpoint via the generated `@epam/ai-dial-chat-api-client` `ApplicationsApi`, through the
`createApplication` wrapper in `apps/chat/src/server-api/applications.ts` (called from
`apps/chat/src/pages/ApplicationEditor/definitions/quickAppDefinition.tsx`). The submitted payload SHALL NOT include an
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
The `TriggerSave` message's General payload SHALL include `locales`/`primaryLocale` fields, composed the same way as for the create request. This holds even though Quick App editing (as opposed to creation) is handled by an embedded QuickApps editor owned by another repository, whose save this repository does not control.

This repository SHALL NOT assume the embedded editor honors those fields. Until it does, saving an existing Quick App's metadata through the embedded editor MAY flatten a previously configured locale map back to a plain string.

#### Scenario: Save forwards locale fields to the embedded editor
- **WHEN** a user clicks Save in edit mode for a Quick App with additional-locale translations
- **THEN** the `TriggerSave` message's `general` payload includes `locales`/`primaryLocale` composed from the current form state, in addition to the other metadata fields

### Requirement: Editing General step fields persists the changes on Save & Exit

In edit mode (an `appId` is known, whether from the URL or from an in-place create in this session), metadata edits SHALL be held in memory and persisted only when the user clicks **Save**.

When Save is clicked, the editor SHALL do the following:

- It SHALL always include the current metadata values (name, description, icon URL, topics and `display_version`) as a `general` payload on the `TriggerSave` message posted to the embedded Setup editor. The embedded editor persists them as part of the single save it already performs.
- The `general` payload SHALL NOT include an `intro` property or the backend `version` field.
- After the embedded editor reports `SaveSuccess`, `QuickAppSetup` SHALL make one follow-up `updateApplication` request (`reassertSkillsSupport`) carrying the current name, description, icon URL, topics and `locales`/`primaryLocale` (never `display_version`, `version` or `application_properties`), so the backend force-sets `features.skills_supported` (see `applications-write-api`); the save counts as successful only once that request finishes. The same follow-up runs after the `TriggerSave` issued for Preview.
- The `general` payload SHALL NOT alter the application's setup configuration (`application_properties`, including orchestrator/tool set state) or its `version`.

Triggering Preview SHALL NOT include a `general` payload.

#### Scenario: Save forwards edited metadata to the embedded editor
- **WHEN** a user edits Topic, Description, Icon, Name or Version of an existing Quick App and clicks Save
- **THEN** the `TriggerSave` message includes a `general` payload carrying the edited values (with no `intro` property), and the host's only own request is the follow-up `updateApplication` skills-support reassertion

#### Scenario: Save still forwards metadata when it is unchanged
- **WHEN** a user clicks Save without editing any metadata field
- **THEN** the `TriggerSave` message still includes a `general` payload carrying the current values, followed by the same `updateApplication` skills-support reassertion

#### Scenario: Save after an in-place create forwards metadata
- **WHEN** a user creates a Quick App in this session, edits its Description in the Metadata section and clicks Save
- **THEN** the `TriggerSave` message includes a `general` payload carrying the edited Description

#### Scenario: Preview does not forward metadata
- **WHEN** a user triggers Preview
- **THEN** the `TriggerSave` message posted to the embedded editor has no `general` payload

#### Scenario: Save does not affect setup configuration or version
- **WHEN** metadata edits are forwarded on Save for an app that already has orchestrator or tool set configuration, or a `version`
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
(`apps/chat/src/pages/ApplicationEditor`) and the embedded Quick Apps editor; it requires a
corresponding change in the Quick Apps editor's own save-completion code, not only in this
repo. Until the embedded editor sends it, the host SHALL treat a `SaveSuccess` without the
field as `hasChanges: false` (see the `app-preview-chat` spec's "Preview session resets when
the saved configuration actually changed" requirement for how the host uses this value).

On this repo's side, `apps/chat/src/types/apps-editor.ts` SHALL declare a
`SaveSuccessMessage` interface (`{ type: AppsEditorEvent.SaveSuccess; hasChanges?: boolean }`)
and `AppEditorIframe`'s message handler SHALL forward the received `hasChanges` value (or
`undefined`) to its `onSaveSuccess` prop, which SHALL be widened from `() => void` to
`(hasChanges: boolean) => void` (normalizing a missing/non-boolean field to `false` before
calling it). `QuickAppSetup` (`apps/chat/src/pages/ApplicationEditor/setup/QuickAppSetup.tsx`) passes it as `handleSaveSuccess`, which resolves the pending `TriggerSave` promise with that value so its `save`/`startPreview` handle can reset the preview session when it is `true`.

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

In edit mode, the **Save** button and the **Preview** action SHALL be disabled until the Setup section's embedded editor has signaled it is ready to save (`AppsEditorEvent.ReadyToSave`). That editor runs in an iframe and communicates over `postMessage`.

- **Readiness signals.** `ReadyToSave` is distinct from `AppsEditorEvent.ReadyToInteract`. `ReadyToInteract` only indicates that the iframe's UI has rendered, and it continues to control the loading-spinner overlay independently. `ReadyToSave` SHALL indicate that the embedded editor has finished loading and validating its own application model, so a save is safe.
- **Save timeout.** A save or preview that receives no `SaveSuccess`/`SaveError` within a bounded timeout SHALL time out, reset the loading state and surface an error.
- **Readiness timeout.** If `ReadyToSave` never arrives within a bounded readiness timeout after the Setup editor mounts, the system SHALL surface an inline error explaining that the editor did not report readiness.
- **Logged out.** The embedded editor MAY instead post `LoggedOut`. In that case the host SHALL NOT surface the readiness-timeout error, while or after `LoggedOut` is received, and SHALL clear an instance of it already shown. Save and Preview SHALL remain disabled.

In create mode, before the app exists, the Create button is not gated by readiness, and Preview is disabled.

#### Scenario: A logged-out signal suppresses the readiness-timeout error
- **WHEN** the Setup iframe posts `LoggedOut` before the readiness timeout elapses
- **THEN** the timeout does not surface the "not ready" error once it elapses, and Save and Preview remain disabled

#### Scenario: A logged-out signal clears an already-surfaced readiness-timeout error
- **WHEN** the readiness timeout has already surfaced the "not ready" error and the iframe then posts `LoggedOut`
- **THEN** the "not ready" error is cleared

#### Scenario: Save is disabled before the Setup editor is ready to save
- **WHEN** in edit mode the iframe has not yet sent `ReadyToSave`
- **THEN** the Save button is disabled and cannot trigger a save

#### Scenario: Preview is disabled before the Setup editor is ready to save
- **WHEN** the iframe has not yet sent `ReadyToSave`
- **THEN** the Preview button is disabled

#### Scenario: UI-rendered readiness alone does not enable Save or Preview
- **WHEN** the iframe sends `ReadyToInteract` but not `ReadyToSave`
- **THEN** the loading spinner over the iframe is hidden, but Save and Preview remain disabled

#### Scenario: Buttons re-enable once the Setup editor signals it is ready to save
- **WHEN** the iframe sends `ReadyToSave`
- **THEN** Save and Preview become enabled without a page reload

#### Scenario: Readiness re-gates to false when the iframe reloads for a different app
- **WHEN** the host reloads the iframe for a different app or schema (including the in-place switch after create) after having received `ReadyToSave`
- **THEN** Save and Preview become disabled again until a new `ReadyToSave` is received

#### Scenario: A save that never receives a response times out
- **WHEN** a save is triggered and no `SaveSuccess`/`SaveError` arrives within the bounded save timeout
- **THEN** the saving state is cleared, an error is shown, and Save becomes clickable again without a page reload

#### Scenario: A Setup editor that never signals readiness surfaces an error
- **WHEN** the iframe has not sent `ReadyToSave` within the bounded readiness timeout after mounting
- **THEN** an inline error explaining that the editor did not report readiness is shown, distinct from the save-timeout error

#### Scenario: Create is not gated by iframe readiness
- **WHEN** the editor is in create mode with no `appId`
- **THEN** the Create button is enabled (subject only to submit-in-flight) and Preview is disabled

### Requirement: Settings iframe receives live updates for toolset logins initiated elsewhere

The host SHALL keep a mounted Settings-step iframe's toolset status in sync with toolset logins that succeed outside its own request-response flow, without reloading the iframe.

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

### Requirement: Save & Exit confirms the saved quick app

The Quick App editor SHALL raise success notifications through `useOperationNotification` (see `entity-operation-notifications`), with `name` set to the metadata name as submitted:

- **Create** (metadata-first create succeeds): `NotifiableEntity.QuickApp` + `EntityOperation.Created`, raised before the in-place switch to edit mode.
- **Save** (the embedded editor posts `AppsEditorEvent.SaveSuccess` for a save the host triggered from the Save button): `NotifiableEntity.QuickApp` + `EntityOperation.Edited`, raised before or in the same tick as the navigation to the return URL.

The notification SHALL NOT be raised for a `TriggerSave` issued to open Preview. The `hasChanges` flag SHALL NOT gate the notification. A `SaveError`, or a save that never reports success, SHALL NOT raise a success notification.

#### Scenario: Create confirms and stays on the page

- **WHEN** a user clicks Create for a new quick app and `createApplication` succeeds
- **THEN** a notification titled `"Quick app created successfully"` naming the app is shown, and the page stays open in edit mode

#### Scenario: Save in edit mode confirms

- **WHEN** a user clicks Save for a quick app and the embedded editor reports `SaveSuccess`
- **THEN** a notification titled `"Quick app edited successfully"` naming the app is shown, and the host navigates to the return URL

#### Scenario: Preview-triggered save stays silent

- **WHEN** the host issues `TriggerSave` to open Preview and the embedded editor reports `SaveSuccess`
- **THEN** no success notification is shown and the preview opens as before

#### Scenario: A no-op Save still confirms

- **WHEN** Save succeeds with `hasChanges: false`
- **THEN** the success notification is still shown, and the preview session is not reset
