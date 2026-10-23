# scheduled-task-detail-page delta

## MODIFIED Requirements

### Requirement: Detail page header shows back navigation and title, plus Active/Delete/Edit actions once loaded

The detail page header SHALL render a back-navigation control and the task's `displayName` as its title on the start side. Activating the back control SHALL navigate to `ROUTES.ScheduledTasks`. Once the task has loaded successfully and `task.isDeleted` is not `true`, the header SHALL additionally render, on the inline-end side, in this order:

1. an **Active** switch (`Switch` from `@epam/ai-dial-ui-kit`) with a visible localized "Active" label, rendered only when `isActive !== undefined` on the loaded task, never an unchecked switch while the active state is unknown;
2. a destructive **Delete** action (`GhostButton` from `@epam/ai-dial-ui-kit` with `variant={ButtonVariant.Danger}`, a leading `IconTrashX` marked `aria-hidden`, and a visible localized "Delete" label). Activating Delete SHALL open the confirmation dialog described in the "Delete confirmation dialog gates the delete request" requirement — it SHALL NOT call any API directly;
3. a `NeutralButton` (`@epam/ai-dial-ui-kit`) with a pencil icon (`IconPencilMinus` from `@tabler/icons-react`) and a localized "Edit" label, rendered only when the route-scoped offline-credentials status check does not report `schedulerServiceConsent: 'signed_out'`. Activating Edit SHALL navigate to `getScheduledTaskEditRoute(scheduleId)` for the task currently being viewed;
4. a localized **Start now** button with a decorative play icon, invoking the manual-run action described above.

When `task.isDeleted` is `true`, the header SHALL render none of the Active switch, Delete action, Edit button, or Start now button — only the back control, title, and the read-only deleted-state indicator described in the "Soft-deleted task renders as a read-only deleted state" requirement. The header SHALL render a localized Start now button after Edit as specified by the manual-run requirements, and SHALL NOT render Start now, the Edit button, Active switch, or Delete action while the task is loading or failed to load. While a delete request is in flight (`isDeleting` is `true`), the Active switch, Delete action, Edit button, and Start now button SHALL all render disabled rather than absent. The Edit button SHALL also not render while `schedulerServiceConsent` is `signed_out` — an absent consent makes editing pointless (the BFF rejects the update with `scheduledTaskAdminConsentRequired`), and hiding the affordance matches the list page's withdrawn "New task" button. A `schedulerServiceConsent` of `signed_in` or `unknown` (including a not-yet-resolved check, which the page treats as fail-open) changes nothing. The Active switch, Delete action, Start now button, and the read-only views are NOT gated by the consent — a user can always stop, remove, or inspect a schedule.

#### Scenario: Back control returns to the list

- **WHEN** the user activates the back control on the detail page
- **THEN** the app navigates to `ROUTES.ScheduledTasks`

#### Scenario: Header shows back, title, Active switch, Delete, and Edit in order once the task has loaded

- **WHEN** the detail page renders with a successfully loaded, non-deleted task whose `isActive` is defined and `schedulerServiceConsent` is `signed_in` or `unknown`
- **THEN** the header contains a back control and the task's `displayName` on the start side, and on the end side — in order — the Active switch, a destructive Delete action with a visible "Delete" label, and a `NeutralButton` with `IconPencilMinus` and a localized "Edit" label

#### Scenario: Edit, Active, and Delete are absent while loading or on error

- **WHEN** the detail page is still fetching the task, or the task fetch has failed
- **THEN** the header does not render the Edit button, the Active switch, or the Delete action

#### Scenario: Revoked consent hides the Edit button only

- **WHEN** the status check reports `schedulerServiceConsent: 'signed_out'` and the loaded task is not deleted
- **THEN** the header renders the Active switch, the Delete action, and the Start now button as before, and no Edit button renders

#### Scenario: Not-yet-resolved consent keeps the Edit button

- **WHEN** the route's status check has not yet resolved (the fail-open window) and the task has loaded
- **THEN** the Edit button renders as before until the check resolves to `signed_out`

#### Scenario: Activating Edit navigates to the edit route for the current task

- **WHEN** the user activates the Edit button while viewing `/scheduled-tasks/sched_123`
- **THEN** the app navigates to `getScheduledTaskEditRoute('sched_123')`, which resolves to `/scheduled-tasks/sched_123/edit`

#### Scenario: Edit button is keyboard accessible

- **WHEN** a keyboard user tabs to the Edit button and presses Enter or Space
- **THEN** the same navigation occurs as with a pointer click, and the button exposes an accessible name of "Edit" (or the localized equivalent)

#### Scenario: Activating Delete opens the confirmation dialog without calling the API

- **WHEN** the user activates the Delete action
- **THEN** the confirmation dialog opens and no `deleteScheduledTask` call is made

#### Scenario: Header actions are disabled, not removed, while a delete is in flight

- **WHEN** `isDeleting` is `true`
- **THEN** the Active switch, Delete action, and Edit button all render in a disabled state and none of their activation handlers fire

#### Scenario: Deleted task header shows only back, title, and the deleted indicator

- **WHEN** the loaded task has `isDeleted: true`
- **THEN** the header shows the back control, the title, and the deleted-state indicator, and none of the Active switch, Delete action, or Edit button render

#### Scenario: Start now follows Edit

- **WHEN** the loaded task is not deleted and the host supplies the start action
