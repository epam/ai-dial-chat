# Proposal: add-scheduled-task-auth-error-indication

## Why

When the external Scheduler auth service is logged out, editing or creating a scheduled task fails with a bare Core `403 Forbidden` (no error code), and the chat surfaces only the generic toast "Failed to update the scheduled task" — the user cannot tell that the real cause is the disconnected external session (issue [#9046](https://github.com/epam/ai-dial-chat/issues/9046), P2, milestone release-1.2). The login-required banner covers only the list route; the edit/create flows give no indication.

## What Changes

- On a **403** failure of a scheduled-task **update or create** submit, the page makes exactly one fresh `GET /api/v1/offline-credentials` status check (no caching, no page state).
- If that check reports `connected: false` and `available: true`, the page shows a specific toast — the external scheduler service session has expired, log in from the Scheduled tasks page — instead of the generic error toast.
- Any other 403 outcome (still connected) keeps today's generic error handling: it is a genuine permission denial. All other failure statuses, and success, behave exactly as today with **zero** extra requests.
- The form and the user's unsaved edits stay exactly as they are — toast-only indication, no navigation, no inline UI.

## Non-goals

- Activation and delete of a task — empirically **not** blocked by Core when the external service is logged out; their flows stay untouched.
- No inline login affordance in the form and no navigation to the list banner (considered and rejected — see Alternatives).
- No BFF changes: Core's 403 already passes through `mapDialHttpStatus` unchanged; no new endpoint, no new client operation.
- No automatic signout or proactive checking outside the 403 path.

## Capabilities

### New Capabilities

- `scheduled-task-auth-error-indication`: the 403-triggered one-shot status check on scheduled-task edit/create failure, the disambiguation rule (disconnected vs. permission denial), and the toast indication with its i18n requirements.

### Modified Capabilities

(none — `scheduled-tasks-page-ui` and `scheduled-tasks-offline-credentials-signout` already describe their sides; this capability owns only the new failure-path behavior.)

## Impact

- **Code:** `apps/chat/src/pages/ScheduledTaskEditPage/`, `apps/chat/src/pages/ScheduledTaskCreatePage/` (submit catch blocks + a small shared check helper), one i18n key + `ScheduledTasksI18nKeys` member, page specs for both pages.
- **APIs:** none new — reuses `GET /api/v1/offline-credentials` and the existing `updateScheduledTask`/`createScheduledTask` clients.
- **i18n:** one new toast-message key under the `scheduledTasks` namespace.
- **Behavior boundary:** one extra bodyless GET per 403 failure — no extra request on success or on any non-403 failure.

## Alternatives considered

- **Cached "disconnected" determination (check once per episode, invalidate on login)** — rejected: the session can be re-established outside the app (Admin panel, per the bug report) with no in-app invalidation event, so the cache can misattribute a later genuine 403; the invalidation patches (TTL) reintroduce the calls the cache existed to avoid.
- **Trust the 403 alone (no check)** — rejected: a bare `{"message": "Forbidden"}` 403 is also what a real permission denial looks like; without disambiguation we would tell a user with a permissions problem to log in.
- **Inline login notice + Log in action in the form (reusing the OAuth popup flow)** — rejected as heavier than the bug warrants; the toast keeps the user's unsaved edits intact and informs them (user decision).
- **BFF-side disambiguation (server checks status on 403, returns a typed error)** — rejected: couples the scheduled-tasks domain to the offline-credentials domain and makes the endpoint's meaning conditional on a racy side-check.

## Acceptance criteria

- Edit/create failing with 403 + a fresh check reporting `connected: false`/`available: true` → the specific auth-expired toast; the generic toast does not appear.
- Edit/create failing with 403 while still connected → today's generic error toast.
- Non-403 failures and successes → behavior and request count identical to today.
- Activation/delete flows unchanged.
- The status check is issued at most once per 403 failure (no cache, no repeats within one failure).
- Both page specs cover the four outcome paths; i18n key declared in `ScheduledTasksI18nKeys` + `en.json`.

## Rollback / backward compatibility

Additive frontend behavior only — revert removes the check and the toast; no API, client, or contract change.
