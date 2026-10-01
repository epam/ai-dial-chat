## Context

The attached desktop image places Start now after Edit and shows a spinner on the newest History row. Section 3 of `model_expose_and_run_now_endpoint.md` defines a bodyless Scheduler POST returning HTTP 202 and a run, followed by single-run GET polling. The linked `api_contract.md` was not attached; this design relies on the supplied excerpt and the repository's existing run contract, without inventing additional upstream result fields.

`ScheduledTaskDetailPage` already owns task fetching and mutations. `useScheduledTaskRuns` in `libs/chat-hooks` owns paginated history and refreshes page zero every 15 seconds for in-progress rows. Its `refetch` clears items and pagination, so it is unsuitable for inserting an accepted run. `ScheduledTaskRunHistoryList` already renders an InProgress spinner and makes rows navigable only with a conversation id. The BFF lists runs but has neither run-now nor single-run retrieval; its mapper currently drops `result.stage`.

Existing specs explicitly prohibit Run-now and describe completed tasks as unable to produce another run. The delta removes the prohibition and narrows completion to **automatic** execution. Active-switch behavior remains governed by trigger exhaustion.

## Goals / Non-Goals

**Goals:** immediate execution of the saved task, immediate accepted-run visibility, bounded status tracking, actionable failures, and existing library boundaries.

**Non-goals:** model facets/list enrichment from the attachment, new scheduler configuration, payload overrides, cancelling runs, new contexts, changed generic polling, or automatic re-execution after errors/login.

## Decisions

### 1. Extend the existing BFF and generated API

Add handlers `startScheduledTask` and `getScheduledTaskRun` in the existing controller/service. Follow `apps/chat-api/AGENTS.md` sections 2–6, 9–11 for versioning, DTOs, error mapping, security and logging.

| BFF operation | Scheduler route suffix | Success | Parameters / response |
| --- | --- | --- | --- |
| `POST /api/v1/scheduled-tasks/:scheduleId/run` | `/v1/schedules/{scheduleId}/run` | 202 | `GetScheduledTaskDto`, no request body; `ScheduledTaskRunDto` |
| `GET /api/v1/scheduled-tasks/:scheduleId/runs/:runId` | `/v1/schedules/{scheduleId}/runs/{runId}` | 200 | new `GetScheduledTaskRunDto`; `ScheduledTaskRunDto` |

Reuse the service's routed-deployment URL construction and `DialClientService.fetchCore` transport. This is the existing Scheduler routed-application integration, not a new direct-fetch path or a new SDK instance. Preserve configured request timeouts and upstream exception handling. Do not add the create/resume offline-credentials precheck: the run endpoint accepts first and records credential failure later.

Use the existing `ScheduledTaskRunDto` casing and status enum. Add optional `resultStage?: string`, mapped only from a string `result.stage`; do not expose the arbitrary result object. Apply the mapping consistently to list, start and get-one responses. `conversation_id: null` remains an omitted `conversationId`, matching current callers.

Both routes require the current session and `scheduledTasksEnabled` role decision. POST uses existing cookie-session CSRF protection. Upstream ownership remains enforced using the caller's access token; foreign schedules/runs yield 404. No extra role is introduced. BFF 403 remains possible for feature/CSRF enforcement even though the Scheduler run endpoint does not reject missing external sign-in with 403.

No server or browser cache is added: `Cache-Control: private, no-store`, TTL zero, no cache key. POST does not invalidate the schedule-list cache or refetch schedule metadata. The execution changes history, not the saved schedule.

Regenerate `libs/chat-api-client` from Swagger. Add thin app wrappers calling the existing configured `scheduledTasksApi.startScheduledTask` / `.getScheduledTaskRun` normal methods; success bodies suffice, so `Raw` methods are unnecessary. Existing scheduler facade and shared-hook contracts need no widening for this app-owned action.

### 2. Keep manual execution state in an app hook

Add `apps/chat/src/hooks/scheduled-tasks/useStartScheduledTask.ts`. It owns POST pending state, accepted run DTOs keyed by id for the current schedule, the current polling session, and request/poll feedback. It receives the current schedule id and enablement/eligibility plus loaded history; the page supplies translated notifications and login behavior. No global context is added.

Use a synchronous in-flight guard as well as button disabling to prevent double dispatch before React commits. Scope requests/timers to schedule id and generation; abort read requests and ignore stale POST/GET results on navigation/unmount/feature disablement. A cancelled browser request never promises that the server cancelled a run.

On 202, store the returned DTO immediately. Compose it with existing history in a memoized page value: deduplicate by id, put newly accepted rows first, retain all previously loaded pages, and let confirmed terminal status override an older InProgress snapshot. In particular, an initial history response captured before POST must not erase the accepted run, and a stale list response must not undo the polled terminal state. Keep accepted rows for the page lifetime so later manual runs do not erase earlier ones. The underlying hook retains its server pagination offset; it must not advance by the locally prepended count. Server pages can overlap after insertion and are deduplicated as today.

The app adapter must still show accepted rows if the independent initial history request fails or is pending; do not pass a blanket history loading/error state that hides a confirmed accepted run. Keep a scoped load-history retry message alongside available rows. Do not call the destructive `refetch` simply because a run was accepted.

Poll the accepted run every two seconds, with one GET in flight at a time and an absolute 70-second deadline measured from acceptance. Stop early on terminal status. Pause network polling in hidden tabs; on visibility restoration, fetch once if within the deadline. Past the deadline, keep the last server status and offer **Refresh status** (a GET only). A deadline or transport error is not execution failure. A terminal result discovered by ordinary history polling also ends fast polling; prefer terminal over InProgress across both sources. Ordinary shared-history refresh keeps its existing lifecycle and cadence.

Polling 401 follows the existing session-expiry flow; 403/404 stops fast polling with scoped feedback. Transient 429/5xx/network failures retain the row and allow the next eligible GET within the deadline (honor Retry-After when supplied). A status-retry action performs one GET, not another POST. Start remains disabled while a known run is InProgress, including after a polling deadline; a confirmed terminal status releases it.

Alternative considered: changing shared history to poll at two seconds. Rejected because it changes traffic and behavior for unrelated consumers. An app-owned overlay reuses pagination without introducing host policy in `chat-hooks`.

### 3. Presentation stays host-agnostic

Extend `ScheduledTaskDetailViewProps` with optional `onStartNow`, `isStarting`, `isStartNowDisabled` and optional label entries `startNowButtonLabel`, `startingButtonLabel`, `startNowAnnouncement`, `startNowDisabledReason`. Render only when a callback and label are supplied and the task is loaded, readable and not deleted. Existing hosts omit the props and retain current behavior. Labels and disabled state are resolved by the app; the library does not inspect feature flags, DTOs, auth or endpoints. Follow `.claude/rules/libs.md`, `.claude/rules/lib-styling.md` and `openspec/lib-styling-guide.md`; no dependency or manifest changes are expected.

Use a generation-2 kit button matching the existing Edit treatment, plus a Tabler play icon with `DIAL_KIT_ICON_STROKE`. UI Kit MCP tools are unavailable in this session; exact component props must be confirmed with `searchEntity` / `getEntityDetails` at implementation, not inferred from node_modules. The existing spinner/history presentation is reused.

Desktop order is Active, Delete, Edit, Start now. Pending POST disables Start now; deleting or updating Active also disables it to avoid conflicting mutations. The existing other actions retain their own behavior and stale guards. Pending recommendation: any known InProgress run additionally disables Start now; this is local UX protection, not a cross-tab or server lock.

Paused, completed one-time and expired recurring schedules can be run manually without being resumed. Deleted tasks cannot. Hide Start now during task loading/failure. Empty History becomes a single accepted row on 202, with no fake duration or conversation link. Preserve tab selection and focus; on mobile, announce acceptance even if the user is viewing Details.

Mobile proposal (not supplied by the screenshot): wrap the existing actions, retain the Start now label, allow header height to grow, and preserve the existing title row and three tabs. Use only project mobile/desktop breakpoints, logical spacing and 44px touch targets; fit 360px width. RTL reverses inline layout through logical properties; mirror back/navigation arrows, keep the media-play symbol unmirrored. Decorative icons are aria-hidden, button names are translated, pending controls expose disabled/busy state, acceptance and status updates use a polite live region, errors use an alert. Preserve focus and target the repository's WCAG AAA contrast requirements.

### 4. Failures and localization

POST 404 reports not found; 409 reports that a deleted schedule cannot run and disables the action until detail retry establishes a current non-deleted state. Known rejections do not add history rows. Network/5xx outcomes can be ambiguous: say that starting could not be confirmed, retain history, and never automatically retry the non-idempotent POST. Existing background/history retry can reconcile server state; no invented client run id.

When an error run has `resultStage === 'credentials'`, show a localized sign-in prompt instead of a generic execution-failed notification. Reuse `ScheduledTasksLoginBanner` and the app's `useOfflineCredentialsGate` / `useOfflineCredentialsLogin` flow on user activation. Keep the failed run in History. Successful login never restarts it automatically. Authentication, popup failure and admin-consent behavior remain those of the existing flow.

New `ScheduledTasksI18nKeys` entries and `en.json` keys:

| Key | English text |
| --- | --- |
| `scheduledTasks.detail.startNow` | Start now |
| `scheduledTasks.detail.starting` | Starting… |
| `scheduledTasks.detail.startAccepted` | Task started. Execution is in progress. |
| `scheduledTasks.detail.startBusy` | A task run is already in progress. |
| `scheduledTasks.detail.startNotFound` | Task not found. |
| `scheduledTasks.detail.startDeleted` | A deleted task cannot be run. |
| `scheduledTasks.detail.startError` | Could not confirm that the task started. Check History before trying again. |
| `scheduledTasks.detail.runStatusUnavailable` | Could not refresh the run status. |
| `scheduledTasks.detail.runStatusDelayed` | This run has not reported completion yet. Refresh its status. |
| `scheduledTasks.detail.refreshRunStatus` | Refresh status |
| `scheduledTasks.detail.runCredentialsRequired` | Sign in to DIAL Chat to run this task. |
| `scheduledTasks.detail.runFinished` | Task run finished: {{status}}. |

Reuse existing status labels and login/retry labels; add translations using the repository locale policy, including Arabic. Avoid repeated announcements on unchanged polls. Memoize composed run items/labels and stabilize callbacks passed into the presentation library.

Existing HTTP metrics and Nest error logging cover the two routes. No new analytics or logging of stored task payloads, outputs or credentials is needed.

### Review corrections: implementation safeguards

- End the request generation on cleanup as well as on task/feature changes; check it on rejected POSTs too. The page checks its stale guard again after asynchronous error decoding so a late 409 cannot disable another task.
- Cancel a scheduled polling tick before a visibility catch-up, and keep an independent absolute-deadline timer that aborts a pending GET. A late aborted response cannot overwrite the retained run or a newer request's loading state.
- Evaluate launch eligibility against the same terminal-preferred merged history used for presentation. A stale list snapshot must not silently reject a launch offered by the button.
- Recheck offline credentials once per newly observed credential-error run; the initial route check may precede revocation. Keep the existing login flow and do not rerun after login.
- Show an app-owned History error/retry alongside accepted rows when initial history loading fails. This keeps presentation libraries host-agnostic and does not alter shared pagination.
- Preserve a valid Scheduler Retry-After header on rate-limited single-run BFF reads. A domain HTTP exception carries the validated value; the controller adds only the header and rethrows for the existing error/trace filter. The browser honors seconds and HTTP dates during regular polling, visibility catch-up and manual refresh.

## Risks / Trade-offs

- Offset history may overlap when new runs arrive → retain server offsets, deduplicate ids, preserve accepted rows, and test insertion during initial/load-more/background responses.
- Slow/stuck runs can exceed 70 seconds, especially with custom timeout → stop only fast observation, retain InProgress and offer a GET refresh; do not claim execution timed out.
- Multiple browser tabs can start concurrently → document local-only duplicate prevention; no scheduler lock is promised.
- Credential result details are only partially described in the attachment → project only `result.stage`, test missing/null results, and avoid exposing arbitrary result content.
- The excerpt's linked full API contract is absent → use established status/DTO mapping and record any actual integration mismatch during apply; do not guess new upstream fields.
- Mobile and eligibility/concurrency choices need product review → carry the explicit assumptions below into the acceptance review.

## Migration Plan

Deploy additive BFF endpoints and regenerated client first, then the frontend action. No data migration. Existing `scheduledTasksEnabled` controls both new routes/action; no new env values. Roll back the frontend to remove the action; accepted runs and ordinary scheduling continue. Update app/lib READMEs and architecture API summary in the same implementation change, run `npm run validate:docs` and the dedicated OpenAPI checks.

## Open Questions

Questions have been sent to the user; the current proposal uses these recommendations pending response:

1. Disable Start now while any known run is InProgress, rather than expose parallel launches?
2. Permit manual execution of all non-deleted schedules, including paused/completed, as implied by the new contract?
3. Approve the derived wrapping mobile header with existing body tabs, since only desktop artwork was provided?
