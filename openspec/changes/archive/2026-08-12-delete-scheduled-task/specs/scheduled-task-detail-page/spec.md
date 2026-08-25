## MODIFIED Requirements

### Requirement: Detail page header shows back navigation and title, plus Active/Delete/Edit actions once loaded

The detail page header SHALL render a back-navigation control and the task's `displayName` as its title on the start side. Activating the back control SHALL navigate to `ROUTES.ScheduledTasks`. Once the task has loaded successfully and `task.isDeleted` is not `true`, the header SHALL additionally render, on the inline-end side, in this order:

1. an **Active** switch (`DialSwitch` from `@epam/ai-dial-ui-kit`) with a visible localized "Active" label, rendered only when `isActive !== undefined` on the loaded task, never an unchecked switch while the active state is unknown;
2. a destructive **Delete** action (`GhostIconButton`/equivalent destructive-treatment control from `@epam/ai-dial-ui-kit`, red/danger styling, the standard delete icon marked `aria-hidden`, and a visible localized "Delete" label). Activating Delete SHALL open the confirmation dialog described in the "Delete confirmation dialog gates the delete request" requirement — it SHALL NOT call any API directly;
3. a `NeutralButton` (`@epam/ai-dial-ui-kit`) with a pencil icon (`IconPencilMinus` from `@tabler/icons-react`) and a localized "Edit" label. Activating Edit SHALL navigate to `getScheduledTaskEditRoute(scheduleId)` for the task currently being viewed.

When `task.isDeleted` is `true`, the header SHALL render none of the Active switch, Delete action, or Edit button — only the back control, title, and the read-only deleted-state indicator described in the "Soft-deleted task renders as a read-only deleted state" requirement. The header SHALL NOT render a Run-now control in this iteration, and SHALL NOT render the Edit button, Active switch, or Delete action while the task is loading or failed to load. While a delete request is in flight (`isDeleting` is `true`), the Active switch, Delete action, and Edit button SHALL all render disabled rather than absent.

#### Scenario: Back control returns to the list

- **WHEN** the user activates the back control on the detail page
- **THEN** the app navigates to `ROUTES.ScheduledTasks`

#### Scenario: Header shows back, title, Active switch, Delete, and Edit in order once the task has loaded

- **WHEN** the detail page renders with a successfully loaded, non-deleted task whose `isActive` is defined
- **THEN** the header contains a back control and the task's `displayName` on the start side, and on the end side — in order — the Active switch, a destructive Delete action with a visible "Delete" label, and a `NeutralButton` with `IconPencilMinus` and a localized "Edit" label

#### Scenario: Edit, Active, and Delete are absent while loading or on error

- **WHEN** the detail page is still fetching the task, or the task fetch has failed
- **THEN** the header does not render the Edit button, the Active switch, or the Delete action

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

### Requirement: Presentational ScheduledTaskDetailView stays host-agnostic

`libs/scheduled-tasks` SHALL export a presentational `ScheduledTaskDetailView` component accepting only props: localized label strings (including Edit and Delete button labels, the Active switch's label/status announcements, and a deleted-state label), detail field values (`description`, model display value, schedule label), either `instructionsMarkdown: string` or a `renderInstructions: (markdown: string) => ReactNode` callback, a runs list plus `{ runsHasMore, runsIsLoadingMore, runsSkeletonCount, onRunsLoadMore }`, top-level `isLoading`/`error` flags and their History-scoped counterparts, an `onBack` callback, an optional `onEdit?: () => void` callback, optional `isActive?: boolean`/`isActiveUpdating?: boolean`/`isActiveDisabled?: boolean`/`onActiveChange?: (nextActive: boolean) => void` for the Active switch, an optional `onDelete?: () => void` callback, an optional `isDeleting?: boolean` flag, and an optional `isDeleted?: boolean` flag.

When `onEdit` is supplied, the component SHALL render the Edit button; when omitted, no Edit button renders. When `onDelete` is supplied, the component SHALL render the Delete action; when omitted, no Delete action renders. When `isActive` is `undefined`, no Active switch SHALL render. When `isDeleted` is `true`, the component SHALL render its read-only deleted-state indicator and SHALL NOT render the Edit button, Delete action, or Active switch regardless of whether `onEdit`/`onDelete`/`isActive` are supplied — `isDeleted` takes precedence over the presence of those callbacks. When `isDeleting` is `true`, the component SHALL render the Edit button, Delete action, and Active switch (whichever are otherwise eligible to render) in a disabled state rather than omitting them. The component SHALL NOT import `@epam/chat-api-client`, any routing module, i18n, or auth/env/analytics modules, and SHALL NOT render any confirmation dialog itself — activating Delete only invokes `onDelete`; the host page owns opening/closing the confirmation dialog, the API call, and all post-delete navigation.

#### Scenario: Lib has no host or integration imports

- **WHEN** `libs/scheduled-tasks`'s `ScheduledTaskDetailView` source is statically analyzed
- **THEN** it contains no imports of `apps/chat/*`, `@epam/chat-api-client`, routing, feature-flag, auth, env, or analytics modules, and no import of a confirmation-dialog component

#### Scenario: Instructions rendering is delegated when a callback is supplied

- **WHEN** `ScheduledTaskDetailView` renders with a `renderInstructions` callback supplied
- **THEN** the Instructions content is produced by calling that callback with the `prompt` markdown string, rather than the lib rendering markdown itself

#### Scenario: onBack is invoked without the lib performing navigation

- **WHEN** the user activates the back control rendered by `ScheduledTaskDetailView`
- **THEN** `onBack` is called exactly once, and the lib performs no `navigate`/history call itself

#### Scenario: onEdit is invoked without the lib performing navigation

- **WHEN** the user activates the Edit button rendered by `ScheduledTaskDetailView`
- **THEN** `onEdit` is called exactly once, and the lib performs no `navigate`/history call or `scheduleId` resolution itself

#### Scenario: Edit button renders only when onEdit is supplied

- **WHEN** `ScheduledTaskDetailView` renders with `onEdit` left `undefined` and `isDeleted` is not `true`
- **THEN** no Edit button is present in the header, regardless of loading state

#### Scenario: onDelete is invoked without the lib opening a dialog or calling an API

- **WHEN** the user activates the Delete action rendered by `ScheduledTaskDetailView`
- **THEN** `onDelete` is called exactly once, and the lib renders no dialog, performs no network call, and performs no `scheduleId` resolution itself

#### Scenario: Delete action renders only when onDelete is supplied and the task is not deleted

- **WHEN** `ScheduledTaskDetailView` renders with `onDelete` left `undefined`, or with `isDeleted: true` regardless of whether `onDelete` is supplied
- **THEN** no Delete action is present in the header

#### Scenario: isDeleted suppresses Edit, Delete, and Active regardless of callback presence

- **WHEN** `ScheduledTaskDetailView` renders with `isDeleted: true` and `onEdit`, `onDelete`, and `isActive` all supplied with defined values
- **THEN** none of the Edit button, Delete action, or Active switch render; only the deleted-state indicator renders in their place

## ADDED Requirements

### Requirement: Delete confirmation dialog gates the delete request

`ScheduledTaskDetailPage` SHALL render a confirmation dialog (`ConfirmationPopup` from `@epam/ai-dial-ui-kit`, `variant={ConfirmationPopupVariant.Danger}`) that opens when the header's Delete action is activated and MUST NOT issue any `deleteScheduledTask` call until the dialog's destructive confirm action is explicitly activated. The dialog SHALL present a localized title and a description stating that deletion is permanent, the task will never run again, and the action cannot be undone, plus a `Cancel` action and a destructive `Delete` confirm action. Activating `Cancel`, pressing `Escape`, or otherwise closing the dialog SHALL close it without making any API call and SHALL NOT change any task state. While a delete request triggered by the confirm action is in flight, the dialog SHALL remain open, its confirm action SHALL render a loading state (`isLoading`) and be prevented from firing a second concurrent call (`disableConfirmButton`), and `Cancel`/`Escape`/close SHALL be inert until the request settles. When the dialog closes without a completed deletion (`Cancel`, `Escape`, close, or a failed request that the user dismisses), focus SHALL return to the header's Delete action.

#### Scenario: Opening the dialog makes no API call

- **WHEN** the user activates Delete
- **THEN** the confirmation dialog opens with a permanent/irreversible description, `Cancel`, and a destructive `Delete` confirm action, and no `deleteScheduledTask` call has been made

#### Scenario: Cancel makes no API call and returns focus to Delete

- **WHEN** the user activates `Cancel` in the open dialog
- **THEN** the dialog closes, no `deleteScheduledTask` call is made, and keyboard focus returns to the header's Delete action

#### Scenario: Escape makes no API call and returns focus to Delete

- **WHEN** the dialog is open and the user presses `Escape`
- **THEN** the dialog closes, no `deleteScheduledTask` call is made, and keyboard focus returns to the header's Delete action

#### Scenario: Confirming calls the delete operation exactly once

- **WHEN** the user activates the dialog's destructive `Delete` confirm action
- **THEN** `deleteScheduledTask(scheduleId)` is called exactly once for the task currently being viewed

#### Scenario: Repeated confirmation is prevented while a request is pending

- **WHEN** the user activates the confirm action again while a previous `deleteScheduledTask` call for the same task is still in flight
- **THEN** no second `deleteScheduledTask` call is made, and the confirm action renders a loading state throughout

#### Scenario: Cancel, Escape, and close are inert while a request is pending

- **WHEN** a `deleteScheduledTask` call is in flight
- **THEN** activating `Cancel`, pressing `Escape`, or otherwise attempting to close the dialog has no effect until the request settles

### Requirement: Delete action calls the BFF and handles success/failure

`ScheduledTaskDetailPage` SHALL call `deleteScheduledTask(scheduleId)` (via `apps/chat/src/server-api/scheduled-tasks.api.ts`) exactly once per confirmed delete, setting `isDeleting: true` for the call's duration. On a successful `204` response, the page SHALL close the confirmation dialog, invalidate or refresh any Scheduled Task queries it holds, show a localized success notification, and navigate to `ROUTES.ScheduledTasks`, leaving no browser-visible application state referencing the deleted task's detail page. On failure, the page SHALL keep the user on the detail page with the previously loaded task data intact, set `isDeleting: false`, allow the user to retry, and show a localized, actionable error notification that distinguishes an already-deleted/not-found failure (upstream 404/409) from a retryable scheduler-unregistration failure (upstream 502) using a third generic message for any other failure. The page SHALL NOT navigate away from the detail page, and SHALL NOT remove or mark the task as deleted in its own state, before receiving a successful `204` response.

#### Scenario: Successful delete closes the dialog, notifies, and navigates to the list

- **WHEN** `deleteScheduledTask(scheduleId)` resolves with `204`
- **THEN** the confirmation dialog closes, a localized success notification is shown, and the app navigates to `ROUTES.ScheduledTasks`

#### Scenario: Not-found/already-deleted failure keeps the user on the page with a distinct message

- **WHEN** `deleteScheduledTask(scheduleId)` rejects with an upstream-mapped 404 or 409
- **THEN** the user remains on the detail page, the task's previously loaded data is unchanged, `isDeleting` becomes `false`, and a localized "already deleted / not found" error notification is shown

#### Scenario: Retryable scheduler failure keeps the user on the page with a distinct message

- **WHEN** `deleteScheduledTask(scheduleId)` rejects with an upstream-mapped 502
- **THEN** the user remains on the detail page, the task's previously loaded data is unchanged, `isDeleting` becomes `false`, and a localized retryable-error notification is shown that does not claim the task was deleted

#### Scenario: Generic failure keeps the user on the page

- **WHEN** `deleteScheduledTask(scheduleId)` rejects with any error other than a mapped 404/409/502
- **THEN** the user remains on the detail page, the task's previously loaded data is unchanged, `isDeleting` becomes `false`, and a localized generic error notification is shown

#### Scenario: No optimistic removal before a confirmed 204

- **WHEN** a `deleteScheduledTask(scheduleId)` call is in flight and has not yet resolved
- **THEN** the task's data remains fully visible and unmodified on the detail page, and no navigation has occurred

### Requirement: Soft-deleted task renders as a read-only deleted state

When `ScheduledTaskDetailPage` loads a task whose `isDeleted` is `true` — whether reached via a direct URL, a stale bookmark, or an existing conversation link — the page SHALL pass `isDeleted: true` to `ScheduledTaskDetailView` and SHALL NOT supply `onEdit`, `onDelete`, or `isActive`/`onActiveChange` for that render, so the view suppresses Edit, Delete, and the Active switch and instead renders a read-only deleted-state indicator using the existing UI conventions for status badges. The Details, Configuration, and History sections SHALL continue to render using the task's last-known data and run history, exactly as they do for a non-deleted task, since run history remains available for a soft-deleted schedule per the upstream contract. The page SHALL NOT offer any restore action.

#### Scenario: Direct navigation to a soft-deleted task's URL renders it read-only

- **WHEN** the user navigates directly to `/scheduled-tasks/:scheduleId` for a schedule whose `GET` response has `isDeleted: true`
- **THEN** the page renders the deleted-state indicator, and none of Edit, Delete, or the Active switch are present or enabled

#### Scenario: History remains visible for a soft-deleted task

- **WHEN** a soft-deleted task's detail page renders
- **THEN** the History panel renders the task's run history exactly as it would for a non-deleted task

#### Scenario: No restore action is offered

- **WHEN** a soft-deleted task's detail page renders
- **THEN** no restore/undelete control is present anywhere on the page

### Requirement: Detail page strings flow through react-i18next

Every user-visible string on the Scheduled Task Detail page (section titles, back control accessible label, Active switch label and status announcements, Delete action label, deletion confirmation dialog title/description/Cancel/confirm/loading labels, deletion success/error notifications, deleted-state label, run status labels, empty-history label, error/retry labels, loading-more indicator) MUST be resolved via `useTranslation().t()` in `ScheduledTaskDetailPage` and passed into `ScheduledTaskDetailView` as plain strings. Keys MUST live under a `scheduledTasks.detail` namespace in `apps/chat/src/i18n/locales/en.json` and be referenced through the existing `ScheduledTasksI18nKeys` enum in `apps/chat/src/constants/translation-keys.ts`. Existing generic labels (e.g. `ButtonsI18nKeys.Delete`, `ButtonsI18nKeys.Cancel`) MUST be reused where an equivalent already exists, rather than duplicated under a new key.

#### Scenario: Delete-related keys are present in en.json

- **WHEN** the change is applied
- **THEN** `en.json` contains `scheduledTasks.detail.deleteButtonLabel`, `scheduledTasks.detail.deleteConfirmTitle`, `scheduledTasks.detail.deleteConfirmDescription`, `scheduledTasks.detail.deleteConfirmingLabel`, `scheduledTasks.detail.deleteSuccess`, `scheduledTasks.detail.deleteNotFoundError`, `scheduledTasks.detail.deleteRetryableError`, `scheduledTasks.detail.deleteGenericError`, and `scheduledTasks.detail.deletedStateLabel`

#### Scenario: Lib receives strings, not translation keys

- **WHEN** `ScheduledTaskDetailPage` renders `<ScheduledTaskDetailView />`
- **THEN** every string-typed prop passed to it is the result of `t(SomeI18nKeys.Member)`, never a raw i18n key or hard-coded English literal

### Requirement: Detail page supports RTL and meets AAA accessibility defaults

All directional layout in the detail page header, Details/Configuration sections, History panel, and the delete confirmation dialog MUST use Tailwind logical properties (`ms/me`, `ps/pe`, `text-start/end`) per `.claude/rules/rtl.md`. The back control's directional icon MUST be mirrored in RTL via `rtl:scale-x-[-1]` or an equivalent; the delete icon is symmetric and MUST NOT be mirrored. The Active switch and the Delete action MUST NOT be mirrored in RTL and MUST remain at the inline end of the header, in the order Active → Delete → Edit, in both LTR and RTL. The Delete action MUST expose an accessible name equal to its localized "Delete" label, a minimum 44×44 CSS pixel touch target, a visible focus indicator matching its hover treatment, and (when disabled during an in-flight delete or a loaded-deleted task) the native `disabled` attribute rather than a purely visual disabled treatment. The confirmation dialog MUST expose an accessible title and description, trap focus while open, support closing via `Escape`, and restore focus to the Delete action on close without a completed deletion. Deletion success and failure notifications MUST be announced through the application's existing accessible live-region/notification pattern. The History panel SHALL be marked up as a `<ul>`/`<li>` list with each `<li>` exposing an accessible name that includes the run's status and timestamp. Status-icon-only, switch-color-only, and Delete-icon-color-only visual differences MUST NOT be the sole means of conveying state to assistive technology.

#### Scenario: Detail page mirrors under RTL without flipping the switch or the delete icon

- **WHEN** `document.documentElement.dir` is `rtl`
- **THEN** the header, Details/Configuration sections, History panel, and delete confirmation dialog lay out mirrored, the back icon is visually flipped, and neither the Active switch nor the Delete icon is mirrored, with both remaining at the inline end in the order Active → Delete → Edit

#### Scenario: Delete action meets AAA target size and accessible name

- **WHEN** the Delete action renders
- **THEN** it exposes an accessible name equal to the localized "Delete" label and a touch target of at least 44×44 CSS pixels

#### Scenario: Confirmation dialog traps focus and supports Escape

- **WHEN** the confirmation dialog is open
- **THEN** keyboard focus is trapped within the dialog, pressing `Escape` closes it without an API call, and closing it without a completed deletion restores focus to the Delete action

#### Scenario: Deletion outcome is announced accessibly

- **WHEN** a delete request succeeds or fails
- **THEN** the corresponding localized notification is announced through the application's accessible live-region/notification pattern, not conveyed by visual change alone

#### Scenario: History list uses semantic list markup with accessible row names

- **WHEN** a screen reader user navigates into the History panel
- **THEN** the panel is exposed as a list (`<ul>`/`<li>` or equivalent ARIA list role), and each row's accessible name conveys both its status and its timestamp
