## MODIFIED Requirements

### Requirement: Settings step readiness gates Save and Preview

In edit mode, the **Save** button and the **Preview** action SHALL be disabled until the Setup section's embedded editor has signaled it is ready to save (`AppsEditorEvent.ReadyToSave`). That editor runs in an iframe and communicates over `postMessage`.

- **Readiness signals.** `ReadyToSave` is distinct from `AppsEditorEvent.ReadyToInteract`. `ReadyToInteract` only indicates that the iframe's UI has rendered, and it continues to control the loading-spinner overlay independently. `ReadyToSave` SHALL indicate that the embedded editor has finished loading and validating its own application model, so a save is safe. `AppEditorIframe` SHALL receive these signals through `AppsEditorHost` from `@epam/ai-dial-visualizer-connector`, with the expected sender window, origin, and application namespace checked. Uppercase visualizer `READY` / `READY_TO_INTERACT` messages SHALL NOT substitute for editor readiness.
- **Save timeout.** A save or preview that receives no `SaveSuccess`/`SaveError` within a bounded timeout SHALL time out, reset the loading state and surface an error.
- **Readiness timeout.** If `ReadyToSave` never arrives within a bounded readiness timeout after the Setup editor mounts, the system SHALL surface an inline error explaining that the editor did not report readiness.
- **Readiness recovery.** `QuickAppSetup` SHALL keep the readiness-timeout error separate from save failures and clear it when `ReadyToSave` arrives, including after the timeout. Each new iframe load reported by `AppEditorIframe` (mount, URL change, or explicit Reload) SHALL clear the previous readiness-timeout error and start a fresh bounded wait, even if the previous load never became ready. These readiness transitions SHALL NOT clear or replace an existing save failure. Re-rendering without a new iframe load SHALL NOT restart the wait.
- **Form validity.** The embedded editor posts `VALIDITY_STATE` with `{ isValid }` (separate from its `DIRTY_STATE`) whenever its form's validity changes, including `{ isValid: false }` on mount when the form starts invalid (e.g. blank Instructions). While `isValid` is `false`, Save and Preview SHALL be disabled, as before `ReadyToSave`. The host SHALL accept the message only from the embedded editor's window, SHALL treat the form as valid until told otherwise, and SHALL reset to valid when the iframe reloads for a different app or schema.
- **Logged out.** The embedded editor MAY instead post `LoggedOut`. In that case the host SHALL revoke any previous save readiness, SHALL NOT surface the readiness-timeout error while the editor remains logged out, and SHALL clear an instance of it already shown. Save and Preview SHALL remain disabled. A later `ReadyToSave` SHALL clear the logged-out state and restore readiness subject to form validity, without requiring an iframe reload.

In create mode, before the app exists, the Create button is not gated by readiness, and Preview is disabled.

#### Scenario: A logged-out signal suppresses the readiness-timeout error
- **WHEN** the Setup iframe posts `LoggedOut` before the readiness timeout elapses
- **THEN** the timeout does not surface the "not ready" error once it elapses, and Save and Preview remain disabled

#### Scenario: A logged-out signal clears an already-surfaced readiness-timeout error
- **WHEN** the readiness timeout has already surfaced the "not ready" error and the iframe then posts `LoggedOut`
- **THEN** the "not ready" error is cleared

#### Scenario: Login recovery restores readiness without reloading
- **WHEN** the same iframe posts `LoggedOut` and later `ReadyToSave`
- **THEN** the host clears its logged-out state and enables Save and Preview if the form is valid

#### Scenario: Logout revokes previously granted readiness
- **WHEN** the same iframe posts `ReadyToSave` and later `LoggedOut`
- **THEN** Save and Preview become disabled again

#### Scenario: Save is disabled before the Setup editor is ready to save
- **WHEN** in edit mode the iframe has not yet sent `ReadyToSave`
- **THEN** the Save button is disabled and cannot trigger a save

#### Scenario: An invalid form disables Save and Preview
- **WHEN** the iframe has sent `ReadyToSave` and then `VALIDITY_STATE` with `isValid: false`
- **THEN** Save and Preview are disabled, and re-enable once the iframe sends `VALIDITY_STATE` with `isValid: true`

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

#### Scenario: Late readiness clears the timeout error
- **WHEN** the readiness timeout has surfaced the "not ready" error and the iframe then posts `ReadyToSave`
- **THEN** that error disappears without a page reload

#### Scenario: Reloading an editor that never became ready starts a fresh wait
- **WHEN** a new iframe load starts before `ReadyToSave` has arrived for the previous load
- **THEN** the previous readiness-timeout error and deadline are cleared
- **AND** the new load receives the full readiness timeout before a new "not ready" error can appear

#### Scenario: Readiness recovery preserves a save failure
- **WHEN** a save failure is displayed and the iframe reports readiness or starts a new load
- **THEN** the save failure remains displayed independently of the readiness-timeout state

#### Scenario: Create is not gated by iframe readiness
- **WHEN** the editor is in create mode with no `appId`
- **THEN** the Create button is enabled (subject only to submit-in-flight) and Preview is disabled
