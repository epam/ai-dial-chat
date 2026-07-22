## MODIFIED Requirements

### Requirement: Settings step readiness gates Save and Preview

The "Save & Exit" and "Preview" actions SHALL be disabled until the Settings step's embedded iframe editor has signaled it is ready to save (`AppsEditorEvent.ReadyToSave`) — a distinct signal from `AppsEditorEvent.ReadyToInteract`, which only indicates the iframe's UI has rendered and continues to control the loading-spinner overlay independently. `ReadyToSave` SHALL indicate that the embedded editor has finished loading and validating its own internal application model and it is safe to trigger a save. Triggering a save or preview before readiness would post a message the embedded app is not yet safely able to act on, risking a save that operates on stale or partially-loaded data. As a defense in depth against any case where no save/preview response arrives after being triggered, a save or preview action that does not receive a response (`SaveSuccess`/`SaveError`) within a bounded timeout SHALL time out, reset the loading state, and surface an error, rather than leaving the buttons stuck disabled forever. Separately, if `ReadyToSave` itself never arrives within a bounded readiness timeout after the Settings step becomes visible, the system SHALL surface an inline error explaining that the Settings editor did not report readiness, rather than leaving Save/Preview disabled indefinitely with no explanation.

#### Scenario: Save & Exit is disabled before the Settings step is ready to save
- **WHEN** the Settings step's iframe has not yet sent `ReadyToSave`
- **THEN** the "Save & Exit" button is disabled and cannot trigger a save

#### Scenario: Preview is disabled before the Settings step is ready to save
- **WHEN** the Settings step's iframe has not yet sent `ReadyToSave`
- **THEN** the "Preview" button is disabled and cannot trigger a preview

#### Scenario: UI-rendered readiness alone does not enable Save or Preview
- **WHEN** the Settings step's iframe sends `ReadyToInteract` but has not sent `ReadyToSave`
- **THEN** the loading spinner over the iframe is hidden, but the "Save & Exit" and
  "Preview" buttons remain disabled

#### Scenario: Buttons re-enable once the Settings step signals it is ready to save
- **WHEN** the Settings step's iframe sends `ReadyToSave` after the user has been waiting
  on the Settings step
- **THEN** the "Save & Exit" and "Preview" buttons become enabled without requiring a
  page reload

#### Scenario: Readiness re-gates to false when the iframe reloads for a different app
- **WHEN** the host reloads the Settings step's iframe for a different app or schema after
  having previously received `ReadyToSave`
- **THEN** "Save & Exit" and "Preview" become disabled again until a new `ReadyToSave` is
  received for the newly loaded app/schema

#### Scenario: A save that never receives a response times out instead of hanging forever
- **WHEN** a save is triggered and no `SaveSuccess`/`SaveError` response arrives within
  the bounded save-in-progress timeout
- **THEN** the saving state is cleared, an error is shown, and the "Save & Exit" button
  becomes clickable again without a page reload

#### Scenario: A Settings step that never signals readiness surfaces an error instead of hanging forever
- **WHEN** the Settings step's iframe has not sent `ReadyToSave` within the bounded readiness
  timeout after becoming visible
- **THEN** an inline error explaining that the Settings editor did not report readiness is
  shown, distinct from the save-in-progress timeout error
