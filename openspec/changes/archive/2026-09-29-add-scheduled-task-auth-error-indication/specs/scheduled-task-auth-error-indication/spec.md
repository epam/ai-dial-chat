# Spec: scheduled-task-auth-error-indication

## ADDED Requirements

### Requirement: A 403 on scheduled-task edit or create triggers exactly one fresh status check

When a scheduled-task **update or create** submission fails with HTTP `403`, the submitting page SHALL make exactly one fresh `GET /api/v1/offline-credentials` call (the same authoritative status check the login/signout flows use) before choosing which error indication to show. The check SHALL NOT be cached or repeated within the failure, and SHALL NOT be issued on success or on any non-403 failure. The activation and delete flows SHALL NOT issue this check — Core does not block them when the external Scheduler auth service is logged out.

#### Scenario: 403 on edit triggers one check

- **WHEN** a scheduled-task update submission fails with `403`
- **THEN** exactly one `GET /api/v1/offline-credentials` request is issued before the error indication is chosen

#### Scenario: 403 on create triggers one check

- **WHEN** a scheduled-task create submission fails with `403`
- **THEN** exactly one `GET /api/v1/offline-credentials` request is issued before the error indication is chosen

#### Scenario: Success and non-403 failures issue no check

- **WHEN** an edit or create succeeds, or fails with any status other than `403` (including mapped validation codes and `404`)
- **THEN** no offline-credentials status request is issued and behavior is identical to today

#### Scenario: Activation and delete never issue the check

- **WHEN** a task's active status is toggled or a task is deleted, regardless of outcome
- **THEN** no offline-credentials status request is issued by those flows

### Requirement: The check's result disambiguates the 403

The page SHALL treat the fresh check as authoritative for the disambiguation: when it reports `connected: false` and `available: true`, the 403 SHALL be attributed to the logged-out external Scheduler auth service; when it reports `connected: true` (or the check itself fails), the 403 SHALL keep today's generic error handling — it is a genuine permission denial, not an auth-session problem.

#### Scenario: Disconnected shows the auth-expired indication

- **WHEN** an edit or create fails with `403` and the fresh check reports `{ available: true, connected: false }`
- **THEN** the auth-expired toast is shown and the generic update error toast is not

#### Scenario: Still connected keeps the generic error

- **WHEN** an edit or create fails with `403` and the fresh check reports `connected: true`
- **THEN** today's generic error toast is shown, with no auth-expired indication

#### Scenario: A failed check keeps the generic error

- **WHEN** an edit or create fails with `403` and the fresh status check itself errors
- **THEN** today's generic error toast is shown — a failed check must not be treated as evidence of disconnection

### Requirement: The indication is a toast that preserves the form

The auth-expired indication SHALL be an error toast carrying the `scheduledTasks.authSessionExpiredNotification` message (a new `ScheduledTasksI18nKeys` member, value in `en.json`), stating that the external scheduler service session has expired and the user should log in again from the Scheduled tasks page. The page SHALL NOT navigate, close, or reset the form — the user's unsaved edits remain exactly as they are, and the generic toast SHALL NOT also appear on this path. No new inline UI, login action, or navigation is introduced on these routes.

#### Scenario: The toast replaces the generic error without touching the form

- **WHEN** the auth-expired toast is shown after a 403-attributed failure
- **THEN** the toast carries the `scheduledTasks.authSessionExpiredNotification` text, the form retains the user's unsaved values, and the page does not navigate

#### Scenario: The key is declared through the enum

- **WHEN** the toast renders
- **THEN** its text resolves from the `ScheduledTasksI18nKeys` member whose value exists in `en.json`, with no duplicated generic string

### Requirement: The disambiguation logic has a single shared owner

The 403-triggered check-and-decide logic SHALL live in one shared app-level helper used by both the edit and create submit handlers, so the two pages cannot drift apart; each page keeps its own toast display and state handling. The helper SHALL use `useCallback`-stable inputs and perform no rendering.

#### Scenario: Both pages route through the shared helper

- **WHEN** either page's submit handler handles a `403` failure
- **THEN** the check-and-decide step is the same shared implementation, covered by unit tests for its four outcome paths (disconnected, connected, failed check, non-403)
