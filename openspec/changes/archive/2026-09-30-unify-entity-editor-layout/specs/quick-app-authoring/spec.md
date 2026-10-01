## MODIFIED Requirements

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
- The host SHALL NOT make a separate `update-application` request to persist these values.
- The `general` payload SHALL NOT alter the application's setup configuration (`application_properties`, including orchestrator/tool set state) or its `version`.

Triggering Preview SHALL NOT include a `general` payload.

#### Scenario: Save forwards edited metadata to the embedded editor
- **WHEN** a user edits Topic, Description, Icon, Name or Version of an existing Quick App and clicks Save
- **THEN** the `TriggerSave` message includes a `general` payload carrying the edited values (with no `intro` property), and no `update-application` request is made by the host

#### Scenario: Save still forwards metadata when it is unchanged
- **WHEN** a user clicks Save without editing any metadata field
- **THEN** the `TriggerSave` message still includes a `general` payload carrying the current values, and no `update-application` request is made

#### Scenario: Save after an in-place create forwards metadata
- **WHEN** a user creates a Quick App in this session, edits its Description in the Metadata section and clicks Save
- **THEN** the `TriggerSave` message includes a `general` payload carrying the edited Description

#### Scenario: Preview does not forward metadata
- **WHEN** a user triggers Preview
- **THEN** the `TriggerSave` message posted to the embedded editor has no `general` payload

#### Scenario: Save does not affect setup configuration or version
- **WHEN** metadata edits are forwarded on Save for an app that already has orchestrator or tool set configuration, or a `version`
- **THEN** that configuration and version are unchanged after the save completes

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
