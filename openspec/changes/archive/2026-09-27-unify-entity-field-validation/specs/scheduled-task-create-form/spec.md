## MODIFIED Requirements

### Requirement: Create-task strings flow through react-i18next

Every user-visible string on the create-task page (page title, repeat-field labels, model/prompt/description labels, validation messages, success/error notifications) MUST be resolved via `useTranslation().t()` in `ScheduledTaskCreatePage` and passed into the lib as plain strings. Feature-specific keys live under `scheduledTasks.create.*` in `apps/chat/src/i18n/locales/en.json`, referenced through `ScheduledTasksI18nKeys`. The display name label/required message MUST reuse `EditorI18nKeys.NameLabel` and `EditorI18nKeys.NameRequired`. Length and control-character errors on the display name, description and instructions MUST reuse `EditorI18nKeys.FieldTooLong` (interpolating the exceeded limit as `count`) and `EditorI18nKeys.NameControlCharacters`; there is no scheduled-task-specific length key. Cancel MUST reuse `ButtonsI18nKeys.Cancel`; the submit action MUST reuse `ButtonsI18nKeys.Create` (labeled "Create" — the create page creates a task; the edit page keeps `ButtonsI18nKeys.Save`).

#### Scenario: New keys exist for the Repeat control and model copy

- **WHEN** the change is applied
- **THEN** `en.json` contains at minimum `scheduledTasks.create.pageTitle`, `scheduledTasks.create.repeatLabel`, `scheduledTasks.create.repeatOneTime`, `scheduledTasks.create.repeatHourly`, `scheduledTasks.create.repeatDaily`, `scheduledTasks.create.repeatWeekly`, `scheduledTasks.create.repeatMonthly`, `scheduledTasks.create.minuteLabel`, `scheduledTasks.create.minuteInvalid`, `scheduledTasks.create.timeLabel`, `scheduledTasks.create.modelLabel`, `scheduledTasks.create.promptLabel`, `scheduledTasks.create.descriptionLabel`, `scheduledTasks.create.successNotification`, and `scheduledTasks.create.errorNotification`; it no longer needs `scheduleSectionLabel`, `scheduleTypeOnce`, `scheduleTypeRecurring`, `scheduleTypeAriaLabel`, `frequencyLabel`, `frequencyDaily`, `frequencyWeekly`, `frequencyMonthly`, or `streamLabel` keys

#### Scenario: Generic labels are reused, not duplicated

- **WHEN** `ScheduledTaskCreatePage` renders `<ScheduledTaskCreateForm />`
- **THEN** display name text props resolve from `EditorI18nKeys`, Cancel from `ButtonsI18nKeys.Cancel`, and the submit action from `ButtonsI18nKeys.Create`, not duplicated feature-scoped strings

### Requirement: Create and edit integrate shared validation without duplicating policy

Both app pages SHALL use the shared validator/checked preparation before API writes and map error codes through one host translation mapping. A local useScheduledTaskFormLabels(mode) SHALL own common labels/options. Form values and notifications SHALL remain app-owned. Network failure SHALL preserve edits. The library minimum disabled guard SHALL not replace full submit validation. On every field change, both pages SHALL re-check the display name, description and instructions through `validateScheduledTaskTextField` (via `getLiveScheduledTaskFieldError` in `apps/chat/src/utils/scheduled-task-form-validation.ts`), so an over-limit value or a control character in the display name shows inline as the user types, instead of surfacing as the generic create/update error notification after submit.

#### Scenario: Both submit paths reject missing recurrence day

- **WHEN** Create or Save is activated for Weekly/Monthly without its day
- **THEN** a field error is shown and neither create nor update is called.

#### Scenario: Correcting a field clears obsolete feedback

- **WHEN** a user fixes an invalid field or changes repeat mode
- **THEN** irrelevant field errors clear/recompute consistently in create and edit while other errors remain meaningful.

#### Scenario: Over-long display name is flagged before submit

- **WHEN** the user types a 257-character display name on the create or edit page
- **THEN** "Use 256 characters or fewer." is shown under Display name immediately, and activating Create/Save calls neither create nor update

#### Scenario: Save failure preserves entered values

- **WHEN** a valid write request fails
- **THEN** the form preserves values, reports the host error and re-enables actions without navigation.

Both pages SHALL pass support resolved for the draft model into shared preparation and derive immediate skill errors from the same pure predicate/validator. Server skill errors SHALL map to the existing unsupported translation. A deployment-lookup 404 SHALL be distinguished from a missing task and SHALL preserve the edit draft.

#### Scenario: Immediate and submit validation share capability errors

- **WHEN** a selected model changes to one without explicit skill support while the draft has a skill
- **THEN** the field immediately shows the shared error, Save is disabled, and checked submission returns no body even if invoked directly
