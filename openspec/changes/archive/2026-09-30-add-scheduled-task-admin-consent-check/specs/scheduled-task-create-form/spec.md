## ADDED Requirements

### Requirement: Create and edit notifications show the actionable reason with a localized fallback

When `createScheduledTask` or `updateScheduledTask` rejects and the failure is not handled by a field error or the edit page's NotFound treatment, `ScheduledTaskCreatePage` and `ScheduledTaskEditPage` SHALL choose the error-notification message through one app-level helper, `resolveScheduledTaskErrorMessage(details, fallbackKey, t)` in `apps/chat/src/utils/map-scheduled-task-dto.ts` (shared with the detail page; `details` is the `getApiErrorDetails` result), in this order:

1. `details.code === 'scheduledTaskAdminConsentRequired'` → `t('toolsetSignin.adminConsentRequired')` (en: "A DIAL administrator must approve this application's access before you can continue. Contact your administrator, then retry.");
2. otherwise a non-empty `details.upstreamMessage` → that text as received from DIAL Scheduler (not translated);
3. otherwise `t(fallbackKey)` — `scheduledTasks.create.errorNotification` / `scheduledTasks.edit.errorNotification`.

The BFF's own generic `details.message` SHALL NOT be displayed (it is English-only and not actionable). The notification SHALL still include the trace id when present, all entered values SHALL be preserved, the submit action SHALL be re-enabled, and no navigation SHALL occur. No new i18n key is added. State stays local to each page (no context); the helper is a pure function, so no memoisation is required. The notification uses the existing `useNotification` alert pattern — no new UI surface, so no new RTL or ARIA requirements; upstream text renders in the notification's inherited direction. No `libs/scheduled-tasks` change: `ScheduledTaskCreateForm` stays unaware of error codes.

#### Scenario: Create shows the admin-consent message and keeps the draft

- **WHEN** the user activates Create and the BFF returns `403 { code: "scheduledTaskAdminConsentRequired" }`
- **THEN** an error notification with `toolsetSignin.adminConsentRequired` is shown, the form keeps every entered value, Create is re-enabled, and no navigation occurs

#### Scenario: Create shows the Scheduler's reason

- **WHEN** create fails with `502 { message: "DIAL Core returned a server error", upstreamMessage: "Quota exceeded for schedules" }`
- **THEN** the error notification text is `Quota exceeded for schedules`, not the generic `message`

#### Scenario: Edit shows the admin-consent message and keeps the draft

- **WHEN** the user activates Save and `updateScheduledTask` rejects with `code: "scheduledTaskAdminConsentRequired"`
- **THEN** an error notification with `toolsetSignin.adminConsentRequired` is shown, the page does not render `NotFoundPage`, and the draft is preserved

#### Scenario: No upstream text falls back to the localized message

- **WHEN** create or update fails without a known code and without `upstreamMessage` (for example a 503 timeout)
- **THEN** the page's localized generic error key is used

## MODIFIED Requirements

### Requirement: Edit page submits via PUT and preserves input on failure

On submit, `ScheduledTaskEditPage` SHALL run the same client-side validation rules as the create page, map the current form `values` to `UpdateScheduledTaskBodyDto` (identical shape to `CreateScheduledTaskBodyDto`) using the same trigger-building logic as `mapFormValuesToCreateBody`, and call `updateScheduledTask(scheduleId, body)` (`PUT /api/v1/scheduled-tasks/:scheduleId`) through `apps/chat/src/server-api/scheduled-tasks.api.ts`. The Save action SHALL be disabled while a submission is in flight (`isSubmitting`) to prevent duplicate submissions. On success (**200 OK**), the page SHALL show a localized success notification and navigate to `getScheduledTaskDetailRoute(scheduleId)`. On failure, all user-entered form values SHALL be preserved, an error notification SHALL be shown (including the request/trace id when available, per the existing notification pattern), `isSubmitting` SHALL be reset so Save is re-enabled, and no navigation SHALL occur. A task-not-found **404** SHALL render the same NotFoundPage treatment as an initial task-load 404; a response carrying `scheduledTaskDeploymentUnavailable` SHALL preserve the draft and show a model error instead; a response carrying a field-mapped code (`scheduledTaskSkillUnsupported`, `scheduledTaskInstructionsOrSkillRequired`) SHALL show the inline field error instead of a notification. **400**, **403**, **409**, **429**, **502**, and **503** otherwise SHALL all surface through that same single error-notification path, whose message `resolveScheduledTaskErrorMessage` chooses: `toolsetSignin.adminConsentRequired` for `scheduledTaskAdminConsentRequired`, else the response's `upstreamMessage` from DIAL Scheduler, else the localized `scheduledTasks.edit.errorNotification`; the BFF's generic `message` is never displayed, matching `ScheduledTaskCreatePage`'s single-catch-all error handling. **401** SHALL trigger the app's existing unauthenticated-session handling in the API client layer, which intercepts it before it reaches this page's catch block in the normal flow.

#### Scenario: Back and Cancel both return to the detail page without a network call

- **WHEN** the user activates Back or Cancel on the edit page for `sched_123`
- **THEN** the app navigates to `getScheduledTaskDetailRoute('sched_123')` and no `updateScheduledTask` call is made

#### Scenario: Valid submit calls PUT and returns to the detail page

- **WHEN** all required fields pass validation and the user activates Save on the edit page for `sched_123`
- **THEN** the app calls `updateScheduledTask('sched_123', body)`, shows a success notification on 200, and navigates to `getScheduledTaskDetailRoute('sched_123')`

#### Scenario: Submit failure preserves entered values and re-enables Save

- **WHEN** the user activates Save and `updateScheduledTask` rejects with a 400, 403, 429, 502, or 503 that carries no field-mapped code
- **THEN** an error notification is shown with the message chosen by `resolveScheduledTaskErrorMessage` (admin-consent key, else `upstreamMessage`, else `scheduledTasks.edit.errorNotification`) and a trace id when present, the form remains open with all entered values unchanged, `isSubmitting` returns to `false`, and no navigation occurs

#### Scenario: Duplicate submission is prevented while a save is in flight

- **WHEN** the user activates Save a second time while the first `updateScheduledTask` call is still pending
- **THEN** no second `updateScheduledTask` call is made, because Save is disabled while `isSubmitting` is `true`

#### Scenario: 404 on submit renders NotFoundPage

- **WHEN** `updateScheduledTask` rejects with a 404 (task deleted or inaccessible between load and save)
- **THEN** the edit page renders `NotFoundPage`

The shared update mapper SHALL include the hydrated `skillUrl`, or explicit `null` after removal, and allow empty prompt with a skill. Skill compatibility/content errors returned by the BFF SHALL be displayed without losing draft state. A hidden feature-gated field SHALL not be cleared during hydration or serialization.

#### Scenario: Edit removes a skill explicitly

- **WHEN** a user removes the skill, retains nonblank instructions, and saves
- **THEN** the PUT body includes `skillUrl: null`, and a subsequent detail/edit read has no skill
