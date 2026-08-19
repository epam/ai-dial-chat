## ADDED Requirements

### Requirement: Save & Exit confirms the saved quick app

`AppsEditor` SHALL raise a success notification when a user-initiated **Save & Exit** completes — that is, when the embedded editor posts `AppsEditorEvent.SaveSuccess` for a save the host triggered from Save & Exit — through `useOperationNotification` (see `entity-operation-notifications`), before or in the same tick as the navigation to the return URL.

- Create mode → `NotifiableEntity.QuickApp` + `EntityOperation.Created`.
- Edit mode → `NotifiableEntity.QuickApp` + `EntityOperation.Edited`.
- `name` = the quick app's General-step name as submitted.

The notification SHALL NOT be raised for saves the host triggers for other reasons — a `TriggerSave` issued to open Preview, or any other implicit save — because those are not outcomes the user asked to be told about. The `hasChanges` flag on `SaveSuccess` SHALL NOT gate the notification: the user asked to save, so the save is reported whether or not any user-editable field differed (`hasChanges` keeps its existing, separate role of resetting the preview session).

A `SaveError` or a save that never reports success SHALL NOT raise a success notification; the existing error handling is unchanged.

#### Scenario: Save & Exit in create mode confirms

- **WHEN** a user completes Save & Exit for a new quick app and the embedded editor reports `SaveSuccess`
- **THEN** a success notification titled `"Quick app created successfully"` naming the app is shown and the host navigates to the return URL

#### Scenario: Save & Exit in edit mode confirms

- **WHEN** a user completes Save & Exit for an existing quick app and the embedded editor reports `SaveSuccess`
- **THEN** a success notification titled `"Quick app edited successfully"` naming the app is shown and the host navigates to the return URL

#### Scenario: Preview-triggered save stays silent

- **WHEN** the host issues `TriggerSave` to open Preview and the embedded editor reports `SaveSuccess`
- **THEN** no success notification is shown and the preview opens as before

#### Scenario: A no-op Save & Exit still confirms

- **WHEN** Save & Exit succeeds with `hasChanges: false`
- **THEN** the success notification is still shown, and the preview session is not reset
