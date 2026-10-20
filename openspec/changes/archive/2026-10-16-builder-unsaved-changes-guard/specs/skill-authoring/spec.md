## MODIFIED Requirements

### Requirement: Submission state machine
`useSkillEditorSubmit` SHALL track a submit `phase` among `idle`, `submitting`, `success`, and `failure`. Dirtiness is tracked separately through the library's `onDirtyChange`. The page passes the library only `isSubmitting={phase === 'submitting'}`.

Cancel SHALL be disabled only while submitting. Create SHALL be disabled while submitting, and also while any of the following holds:

- a text refinement is pending;
- the skill is loading;
- loading failed.

Navigation away SHALL occur in exactly these cases:

- after `createSkill` resolves successfully (`success` phase);
- when the user leaves from a clean form;
- when the user confirms Discard changes in the shared unsaved-changes dialog.

A `failure` phase SHALL NOT navigate away.

#### Scenario: Cancel with unsaved changes asks first
- **WHEN** a user with unsaved changes clicks Cancel
- **THEN** the page shows the shared "Discard unsaved changes?" dialog (`unsavedChanges.*` keys) and navigates to `ROUTES.Catalog` only after the user chooses Discard changes, without calling any API

#### Scenario: Cancel on a clean form navigates away immediately
- **WHEN** a user with no unsaved changes clicks Cancel
- **THEN** the page navigates to `ROUTES.Catalog` without calling any API

#### Scenario: Failure does not navigate
- **WHEN** `createSkill` rejects
- **THEN** the page transitions to `failure`, remains on `/skill-editor`, and keeps all field values intact

#### Scenario: Success navigates once
- **WHEN** `createSkill` resolves successfully
- **THEN** the page transitions to `success`, shows a success notification, and navigates to the Catalog `itemId` URL of the new skill exactly once, without the unsaved-changes dialog intercepting it
