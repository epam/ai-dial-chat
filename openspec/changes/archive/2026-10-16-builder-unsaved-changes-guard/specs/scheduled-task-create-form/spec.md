## MODIFIED Requirements

### Requirement: ScheduledTaskCreateForm guards unsaved changes

`ScheduledTaskCreateForm` SHALL accept an optional `initialValues: ScheduledTaskCreateFormValues`, the values the form was opened with.

While `initialValues` is provided and `values` differs from it, activating the back control or Cancel SHALL NOT call `onBack` / `onCancel` directly. It SHALL instead open a discard confirmation: `ConfirmationDialog` from `@epam/ai-dial-chat-shared`, with `ConfirmationPopupVariant.Danger`, a title, a message, a confirming "Discard changes" action and a cancelling "Keep editing" action.

- **Confirming action:** closes the dialog, then calls whichever deferred callback opened it (`onBack` or `onCancel`).
- **Cancelling action, Escape, the close control or an outside click:** closes the dialog, calls neither callback, and leaves `values` untouched.

Any in-flight text-refinement state SHALL be reset only when the deferred callback actually runs. While the form is dirty, the browser SHALL be asked to warn before the page unloads (`beforeunload`).

"Differs" SHALL be decided by the exported pure function `hasScheduledTaskFormChanges(values, initialValues)`, which compares every field after normalisation. `undefined`, `null`, empty and whitespace-only strings, and empty arrays are all equal to each other, so typing into a field and then clearing it is not a change. Skill selections compare by their ordered contents.

The dialog copy SHALL come from the optional labels below, each falling back to a default:

| Label | Default |
|---|---|
| `labels.discardTitle` | "Discard unsaved changes?" |
| `labels.discardMessage` | "You have unsaved changes. Leaving now will discard them." |
| `labels.discardConfirmLabel` | "Discard changes" |
| `labels.discardCancelLabel` | "Keep editing" |

When `initialValues` is omitted, the form SHALL behave as before: no confirmation and no `beforeunload` listener. This lets a host own unsaved-change handling itself.

The lib SHALL NOT import i18n, routing or app contexts. Its dirty-state and deferral logic is the host-agnostic `useUnsavedChangesGuard(isDirty)` hook exported from `@epam/ai-dial-chat-shared`.

`ScheduledTaskCreatePage` and `ScheduledTaskEditPage` SHALL own unsaved-change handling themselves. They do this by **not** passing `initialValues` (the opt-out above). Each SHALL instead call `useBuilderLeaveGuard` (see `builder-unsaved-changes-guard`) with

`isDirty = hasScheduledTaskFormChanges(values, baseline)`, where the baseline is `DEFAULT_VALUES` on the create page and, on the edit page, the values the form was hydrated with from the loaded task. On the edit page `isDirty` stays `false` until the task has loaded.
Each page SHALL also call `allowNextNavigation()` immediately before its post-save navigation, so that navigation is not intercepted.

The shared dialog is rendered by `UnsavedChangesProvider`. Cancel and Back therefore navigate to their usual destination and are intercepted by the router-level guard, exactly like nav-rail navigation. The pages SHALL NOT supply the `discard*` labels.

#### Scenario: Pristine form leaves without confirmation

- **WHEN** `values` equals `initialValues` and the user activates Cancel or Back
- **THEN** `onCancel` / `onBack` is called once and no dialog opens

#### Scenario: Edited form asks first

- **WHEN** the user changes any field and activates Cancel
- **THEN** the "Discard unsaved changes?" dialog opens and `onCancel` has not been called

#### Scenario: Keep editing preserves the draft

- **WHEN** the dialog is open and the user chooses "Keep editing"
- **THEN** the dialog closes, neither `onBack` nor `onCancel` is called, and the entered values are unchanged

#### Scenario: Discard changes runs the deferred callback

- **WHEN** the dialog was opened by Cancel and the user chooses "Discard changes"
- **THEN** `onCancel` is called once and `onBack` is not

#### Scenario: Back is guarded the same way

- **WHEN** the form is dirty and the user activates the back control
- **THEN** the same dialog opens, and confirming calls `onBack`

#### Scenario: Host opts out

- **WHEN** `initialValues` is not passed and the user activates Cancel after editing
- **THEN** `onCancel` is called immediately with no dialog

#### Scenario: Reload with unsaved edits warns

- **WHEN** the form is dirty and the user reloads or closes the tab
- **THEN** the browser's unload warning is requested; when the form is clean it is not

#### Scenario: Edit page compares against the loaded task

- **WHEN** the user opens an existing task on `ScheduledTaskEditPage`, changes its description, and activates Cancel
- **THEN** the shared "Discard unsaved changes?" dialog (`unsavedChanges.*` keys) opens; if the user instead changes nothing, or reverts the change, Cancel navigates immediately

#### Scenario: App pages show the shared dialog on section change

- **WHEN** the user edits the create form on `ScheduledTaskCreatePage` and activates the Catalog nav item
- **THEN** the shared "Discard unsaved changes?" dialog (`unsavedChanges.*` keys) opens; the lib's built-in dialog is never rendered on the app pages

#### Scenario: Successful create is not intercepted

- **WHEN** the user edits a valid create form and activates Create, and the request succeeds
- **THEN** the app navigates to `ROUTES.ScheduledTasks` without showing the dialog
