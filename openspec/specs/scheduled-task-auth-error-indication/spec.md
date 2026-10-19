# Spec: scheduled-task-auth-error-indication

## Purpose

Defines the app-level handling for a scheduled-task edit or create failure caused by the logged-out external Scheduler auth service: the 403-triggered one-shot offline-credentials status check, the disambiguation rule between a dropped auth session and a genuine permission denial, and the user-consented login-and-retry flow (login-required toast with its "Log in and retry" action, the post-login submit retry, and the login-failed fallback toast) that preserves the user's unsaved form. Sibling capabilities: `scheduled-tasks-offline-credentials-login`/`-signout` own the list-page banner and revoke flows; `offline-credentials` owns the BFF endpoints.

## Requirements

### Requirement: A 403 on scheduled-task edit or create triggers exactly one fresh status check

When a scheduled-task **update or create** submission fails with HTTP `403`, the submitting page SHALL make exactly one fresh `GET /api/v1/offline-credentials` call (the same authoritative status check the login/signout flows use) before choosing the failure path. The check SHALL NOT be cached or repeated within the failure, and SHALL NOT be issued on success or on any non-403 failure. The activation and delete flows SHALL NOT issue this check — Core does not block them when the external Scheduler auth service is logged out. The check's response SHALL also yield the `connect` OAuth client settings (when Core returns a complete `connect` object) that the login-and-retry flow consumes — no separate client-settings request is issued.

#### Scenario: 403 on edit triggers one check

- **WHEN** a scheduled-task update submission fails with `403`
- **THEN** exactly one `GET /api/v1/offline-credentials` request is issued before the failure path is chosen

#### Scenario: 403 on create triggers one check

- **WHEN** a scheduled-task create submission fails with `403`
- **THEN** exactly one `GET /api/v1/offline-credentials` request is issued before the failure path is chosen

#### Scenario: The one check also yields the connect settings for the login

- **WHEN** the 403-triggered check resolves with a complete `connect` object
- **THEN** the login toast's action consumes that same response's `connect` settings, and no additional client-settings request is issued

#### Scenario: Success and non-403 failures issue no check

- **WHEN** an edit or create succeeds, or fails with any status other than `403` (including mapped validation codes and `404`)
- **THEN** no offline-credentials status request is issued and behavior is identical to today

#### Scenario: Activation and delete never issue the check

- **WHEN** a task's active status is toggled or a task is deleted, regardless of outcome
- **THEN** no offline-credentials status request is issued by those flows

### Requirement: The check's result disambiguates the 403

The page SHALL treat the fresh check as authoritative for the disambiguation: when it reports `connected: false` and `available: true`, the 403 SHALL be attributed to the logged-out external Scheduler auth service and the page SHALL show the login-required toast with its "Log in and retry" action (see the login-and-retry requirement below); when it reports `connected: true` (or the check itself fails, or the response carries no usable `connect` client settings), the 403 SHALL keep today's generic error handling — it is a genuine permission denial or an unactionable state, not a login candidate.

#### Scenario: Disconnected shows the login-required toast

- **WHEN** an edit or create fails with `403` and the fresh check reports `{ available: true, connected: false }` with a usable `connect` object
- **THEN** the page shows the login-required toast with the "Log in and retry" action, and no login is invoked at that point

#### Scenario: Still connected keeps the generic error

- **WHEN** an edit or create fails with `403` and the fresh check reports `connected: true`
- **THEN** today's generic error toast is shown, with no login-required toast

#### Scenario: A failed check keeps the generic error

- **WHEN** an edit or create fails with `403` and the fresh status check itself errors
- **THEN** today's generic error toast is shown — a failed check must not be treated as evidence of disconnection

#### Scenario: Missing connect settings keep the generic error

- **WHEN** the fresh check reports `{ available: true, connected: false }` but the response carries no usable `connect` client settings
- **THEN** no login can be driven; today's generic error toast is shown

### Requirement: Auth-session 403 offers a user-consented login through the login-required toast, which retries the submit

When a 403 is attributed to the logged-out external Scheduler auth service, the page SHALL show a login-required error toast (the `scheduledTasks.loginRequiredNotification` message, carrying the failing request's trace ID) with a **"Log in and retry"** action button (`scheduledTasks.loginAndRetryAction`). The login SHALL NOT be invoked until the user activates that action — the action's click is the fresh user activation that lets the OAuth popup open, so no popup is reserved at Save-click time and no blank window opens on a save that never needs a login. The toast SHALL stay until manually dismissed (an actionable toast must not auto-dismiss) and SHALL be dismissed when its action runs, so a completed or failed login-and-retry cannot leave a stale actionable toast behind.

Activating the action SHALL drive the existing offline-credentials login flow (`useOfflineCredentialsLogin`, the same OAuth-popup flow the Scheduled Tasks page banner and the Extensions section drive) with the check's `connect` settings — **at most one login per toast action activation**. While the login and its retry are in flight, the page SHALL keep the submit in its in-flight state (the Save action stays disabled). The page SHALL NOT navigate, close, or reset the form on this path in any outcome — the user's unsaved edits remain exactly as they are.

**On login success**, the page SHALL automatically retry the failed submit with the body re-prepared from the form's current values (an edit made while the toast sat open is included in the retried save). A successful retry SHALL behave exactly like a normal successful save (success toast + navigation). A failed retry SHALL keep today's generic error handling for that failure **without offering the login toast again within the same submit activation** — the loop guard.

**On login failure** (popup blocked, timed out, or the flow fails), the page SHALL show a login-failed error toast carrying the `scheduledTasks.autoLoginFailedNotification` message, stating that the login failed and the user can try saving the task again. The form SHALL retain its values, `isSubmitting` SHALL be cleared so Save is operable again, and a subsequent Save activation SHALL re-run the full path — including a fresh login-required toast if the 403 recurs.

**A user-cancelled login stays silent**: when the user closes the OAuth popup, no additional toast is shown — the dismissal is deliberate, so the form retains its values, Save is operable again, and the next Save re-runs the full path.

The prior auth-expired toast (`scheduledTasks.authSessionExpiredNotification`) is removed from this path — the login-required and login-failed toasts replace it; the generic error toast still covers genuine permission denials.

#### Scenario: The login-required toast shows without invoking the login

- **WHEN** an edit or create fails with a 403 attributed to the logged-out service
- **THEN** the login-required toast with its "Log in and retry" action is shown, no OAuth popup opens, and no login flow is invoked until the action is activated

#### Scenario: The action's click drives the login and retries the submit automatically

- **WHEN** the user activates the toast's "Log in and retry" action and the login succeeds
- **THEN** the OAuth popup opened inside that click, the toast is dismissed, and the page re-submits the re-prepared body automatically; on success the user sees the normal success toast and navigation, with no extra action

#### Scenario: A failed retried submit does not offer the login toast again

- **WHEN** the login succeeds but the retried submit fails
- **THEN** today's generic error handling covers that failure and no second login-required toast is shown within the same submit activation

#### Scenario: Blocked popup shows the login-failed toast with the form intact

- **WHEN** the login popup opened from the action's click is blocked by the browser
- **THEN** the login-failed toast is shown, the form retains the user's unsaved values, the page does not navigate, and the Save action is operable again

#### Scenario: Timed-out or failed login shows the login-failed toast

- **WHEN** the login flow times out or fails
- **THEN** the login-failed toast is shown, the form retains its values, and Save is operable again

#### Scenario: Cancelled login stays silent with the form intact

- **WHEN** the user closes the OAuth popup opened by the toast action
- **THEN** no additional toast is shown — the user dismissed the login deliberately — the form retains its values, and Save is operable again

#### Scenario: Saving again re-runs the full path

- **WHEN** the user presses Save again after a failed login and the submit fails with an attributed 403 again
- **THEN** a fresh login-required toast with a fresh action is shown for that new submit activation

#### Scenario: The keys are declared through the enum

- **WHEN** the login-required or login-failed toast renders
- **THEN** its text resolves from the `ScheduledTasksI18nKeys` members whose values exist in `en.json`, `scheduledTasks.authSessionExpiredNotification` no longer exists, and no generic string is duplicated

### Requirement: The disambiguation and submit flows have a single shared owner

The 403-triggered check-and-decide logic SHALL live in one shared app-level helper used by both the edit and create submit flows, so the two pages cannot drift apart; the whole submit orchestration (in-flight state, every failure branch, the login-required toast, and the login-and-retry handshake) SHALL likewise live in one shared app-level hook (`useScheduledTaskSubmit`) used by both pages — each page supplies only its own pieces: the body preparation, the save request, the success path, the field-error sink, the generic failure key, and (edit only) its not-found branch. The helper SHALL use `useCallback`-stable inputs and perform no rendering.

#### Scenario: Both pages route through the shared helper and hook

- **WHEN** either page's submit flow handles a `403` failure
- **THEN** the check-and-decide step is the same shared implementation, and the submit orchestration (including the login-required toast and the retry) is the same shared hook, covered by unit tests for the outcome paths (disconnected, connected, failed check, missing connect, non-403)
