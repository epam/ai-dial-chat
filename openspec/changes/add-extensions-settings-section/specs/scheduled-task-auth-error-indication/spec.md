# Delta: scheduled-task-auth-error-indication

## Purpose

Upgrades the 403-attributed failure path from a toast-only indication to an auto-login flow: when a scheduled-task edit or create submit fails because the external Scheduler auth service is logged out, the page auto-invokes the existing offline-credentials login flow and retries the submit on success; a failed auto-login falls back to a login-failed toast with the form preserved. The 403-triggered one-shot check and the disambiguation rule are unchanged in shape; the outcome they drive changes.

## MODIFIED Requirements

### Requirement: A 403 on scheduled-task edit or create triggers exactly one fresh status check

When a scheduled-task **update or create** submission fails with HTTP `403`, the submitting page SHALL make exactly one fresh `GET /api/v1/offline-credentials` call (the same authoritative status check the login/signout flows use) before choosing the failure path. The check SHALL NOT be cached or repeated within the failure, and SHALL NOT be issued on success or on any non-403 failure. The activation and delete flows SHALL NOT issue this check — Core does not block them when the external Scheduler auth service is logged out. The check's response SHALL also yield the `connect` OAuth client settings (when Core returns a complete `connect` object) that the auto-login flow consumes — no separate client-settings request is issued.

#### Scenario: 403 on edit triggers one check

- **WHEN** a scheduled-task update submission fails with `403`
- **THEN** exactly one `GET /api/v1/offline-credentials` request is issued before the failure path is chosen

#### Scenario: 403 on create triggers one check

- **WHEN** a scheduled-task create submission fails with `403`
- **THEN** exactly one `GET /api/v1/offline-credentials` request is issued before the failure path is chosen

#### Scenario: The one check also yields the connect settings for the auto-login

- **WHEN** the 403-triggered check resolves with a complete `connect` object
- **THEN** the auto-login consumes that same response's `connect` settings, and no additional client-settings request is issued

#### Scenario: Success and non-403 failures issue no check

- **WHEN** an edit or create succeeds, or fails with any status other than `403` (including mapped validation codes and `404`)
- **THEN** no offline-credentials status request is issued and behavior is identical to today

#### Scenario: Activation and delete never issue the check

- **WHEN** a task's active status is toggled or a task is deleted, regardless of outcome
- **THEN** no offline-credentials status request is issued by those flows

### Requirement: The check's result disambiguates the 403

The page SHALL treat the fresh check as authoritative for the disambiguation: when it reports `connected: false` and `available: true`, the 403 SHALL be attributed to the logged-out external Scheduler auth service and the page SHALL auto-invoke the offline-credentials login flow (see the auto-login requirement below); when it reports `connected: true` (or the check itself fails, or the response carries no usable `connect` client settings), the 403 SHALL keep today's generic error handling — it is a genuine permission denial or an unactionable state, not an auto-login candidate.

#### Scenario: Disconnected invokes the auto-login flow

- **WHEN** an edit or create fails with `403` and the fresh check reports `{ available: true, connected: false }` with a usable `connect` object
- **THEN** the page auto-invokes the login flow and no error toast is shown at that point

#### Scenario: Still connected keeps the generic error

- **WHEN** an edit or create fails with `403` and the fresh check reports `connected: true`
- **THEN** today's generic error toast is shown, with no auto-login invocation

#### Scenario: A failed check keeps the generic error

- **WHEN** an edit or create fails with `403` and the fresh status check itself errors
- **THEN** today's generic error toast is shown — a failed check must not be treated as evidence of disconnection

#### Scenario: Missing connect settings keep the generic error

- **WHEN** the fresh check reports `{ available: true, connected: false }` but the response carries no usable `connect` client settings
- **THEN** no auto-login can be driven; today's generic error toast is shown

### Requirement: Auth-session 403 auto-invokes the login flow and retries the submit

When a 403 is attributed to the logged-out external Scheduler auth service, the page SHALL auto-invoke the existing offline-credentials login flow (`useOfflineCredentialsLogin`, the same OAuth-popup flow the Scheduled Tasks page banner and the Extensions section drive) with the check's `connect` settings — **at most one auto-login per submit activation** (no auto-login loop). While the auto-login and its retry are in flight, the page SHALL keep the submit in its in-flight state (the Save action stays disabled). The page SHALL NOT navigate, close, or reset the form on this path in any outcome — the user's unsaved edits remain exactly as they are.

**On login success**, the page SHALL automatically retry the failed submit with the same task body (re-prepared from the form's unchanged values). A successful retry SHALL behave exactly like a normal successful save (success toast + navigation). A failed retry SHALL keep today's generic error handling for that failure **without a second auto-login within the same submit activation** — the loop guard.

**On login failure** (popup blocked, cancelled, timed out, or the flow fails), the page SHALL show a login-failed error toast carrying the `scheduledTasks.autoLoginFailedNotification` message (a new `ScheduledTasksI18nKeys` member, value in `en.json`), stating that the login failed and the user can try saving the task again. The form SHALL retain its values, `isSubmitting` SHALL be cleared so Save is operable again, and a subsequent Save activation SHALL re-run the full path — including a fresh auto-login invocation if the 403 recurs.

The prior auth-expired toast (`scheduledTasks.authSessionExpiredNotification`) is removed from this path — the login-failed toast replaces it as the failure fallback; the generic error toast still covers genuine permission denials.

#### Scenario: Auto-login opens the OAuth popup without a toast

- **WHEN** an edit or create fails with a 403 attributed to the logged-out service
- **THEN** the login flow's OAuth popup opens automatically, no error toast is shown at that point, and the Save action stays disabled while the flow is in flight

#### Scenario: Successful login retries the submit automatically

- **WHEN** the auto-invoked login succeeds
- **THEN** the page re-submits the same task body automatically; on success the user sees the normal success toast and navigation, with no extra action

#### Scenario: A failed retried submit does not trigger a second auto-login

- **WHEN** the auto-login succeeds but the retried submit fails
- **THEN** today's generic error handling covers that failure and no second login popup opens within the same submit activation

#### Scenario: Blocked popup shows the login-failed toast with the form intact

- **WHEN** the auto-invoked login popup is blocked by the browser
- **THEN** the login-failed toast is shown, the form retains the user's unsaved values, the page does not navigate, and the Save action is operable again

#### Scenario: Cancelled, timed-out, or failed login shows the login-failed toast

- **WHEN** the user closes the popup, the flow times out, or the flow fails
- **THEN** the login-failed toast is shown, the form retains its values, and Save is operable again

#### Scenario: Saving again re-runs the full path

- **WHEN** the user presses Save again after a failed auto-login and the submit fails with an attributed 403 again
- **THEN** a fresh auto-login is invoked for that new submit activation

#### Scenario: The keys are declared through the enum

- **WHEN** the login-failed toast renders
- **THEN** its text resolves from the `ScheduledTasksI18nKeys` member whose value exists in `en.json`, `scheduledTasks.authSessionExpiredNotification` no longer exists, and no generic string is duplicated

### Requirement: The disambiguation logic has a single shared owner

The 403-triggered check-and-decide logic SHALL live in one shared app-level helper used by both the edit and create submit handlers, so the two pages cannot drift apart; the auto-login orchestration (invoking the login flow with the check's `connect` settings and reporting its outcome) SHALL likewise live in one shared app-level hook used by both pages — each page keeps its own submit-retry, toast display, and state handling. The helper SHALL use `useCallback`-stable inputs and perform no rendering.

#### Scenario: Both pages route through the shared helper and hook

- **WHEN** either page's submit handler handles a `403` failure
- **THEN** the check-and-decide step is the same shared implementation, and the auto-login is driven through the same shared hook, covered by unit tests for the outcome paths (disconnected, connected, failed check, missing connect, non-403)
