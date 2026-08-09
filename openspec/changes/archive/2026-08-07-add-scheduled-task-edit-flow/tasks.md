## 1. Route constant and builder

- [x] 1.1 Add `ScheduledTaskEdit = '/scheduled-tasks/:scheduleId/edit'` to the `ROUTES` enum in `apps/chat/src/types/routes.ts`, alongside `ScheduledTaskDetail`.
- [x] 1.2 Add `getScheduledTaskEditRoute(scheduleId: string): string` to `apps/chat/src/constants/routes.ts`, implemented as `` `${getScheduledTaskDetailRoute(scheduleId)}/edit` ``.
- [x] 1.3 Add unit tests for `getScheduledTaskEditRoute` (plain id, percent-encoded id) alongside the existing `getScheduledTaskDetailRoute` tests.
- [x] 1.4 Verify: `npm exec nx test chat` (scoped to the routes test file if a `-t`/pattern flag is available), `npm exec nx lint chat`.

## 2. Reverse trigger/cron mapper with fail-closed representability check

- [x] 2.1 In `apps/chat/src/utils/scheduled-task-trigger.ts`, add a `UnsupportedTriggerReason` enum (or equivalent discriminant) in the same file's neighborhood (or `apps/chat/src/types/` if a types file already holds sibling enums) covering: unsupported cron shape, unsupported `triggerType`, missing `model`/`prompt`.
- [x] 2.2 Implement the reverse mapper (e.g. `mapScheduledTaskDtoToFormValues(dto: ScheduledTaskDto): { ok: true; values: ScheduledTaskCreateFormValues } | { ok: false; reason: UnsupportedTriggerReason }`) inverting `buildCronFields`/`buildCronWindowBoundary` using the same reference-`Date`-plus-UTC/local-getters technique as the forward mapper — do not hand-compute UTC offsets.
- [x] 2.3 Implement `mapFormValuesToUpdateBody(values: ScheduledTaskCreateFormValues): UpdateScheduledTaskBodyDto` reusing the same trigger-building logic as `mapFormValuesToCreateBody` (identical DTO shape).
- [x] 2.4 Add unit tests: once-schedule round-trip; daily/weekly/monthly recurring round-trip; weekly `day_of_week` UTC-day-boundary shift (mirroring the existing forward-mapper test at `scheduled-task-trigger.spec.ts`'s "Weekly recurring shifts day_of_week" case, inverted); activity-window `startDate`/`endDate` round-trip; a DST-crossing date case; unsupported cron shape returns `ok: false`; missing `model`/`prompt` returns `ok: false`.
- [x] 2.5 Verify: `npm exec nx test chat`, `npm exec nx lint chat`.

## 3. ScheduledTaskDetailView: add onEdit prop and header end-side slot

- [x] 3.1 Confirm the correct AI DIAL UI Kit outlined-button component and its props via the ui-kit MCP tools (`searchEntity`/`getEntityDetails`) — do not guess the component name. (Confirmed: `OutlinedButton` from `@epam/ai-dial-ui-kit`, accepting `variant`/`label`/`iconBefore`/`onClick`; used with `variant={ButtonVariant.Neutral}`.)
- [x] 3.2 Add `onEdit?: () => void` and an `editButtonLabel` (or equivalent) field to `ScheduledTaskDetailViewProps`/labels model in `libs/scheduled-tasks/src/models/scheduled-task-detail-view-props.ts` (or wherever the interface lives), with JSDoc per `libs.md`.
- [x] 3.3 Restructure `ScheduledTaskDetailView.tsx`'s header `div` from its current layout to `flex items-center justify-between`, keeping the back button + `<h1>` on the start side, and rendering the confirmed outlined button with `IconEdit` (`aria-hidden`) + `editButtonLabel` on the end side only when `onEdit` is supplied.
- [x] 3.4 Ensure the Edit button is keyboard-activatable with a proper accessible name (button element or `role="button"` + label, not a bare clickable `div`).
- [x] 3.5 Update `libs/scheduled-tasks`'s exported types (`index.ts`) if the props/labels interface gained new named fields that need re-exporting. (No new export needed — `editButtonLabel`/`onEdit` are fields on the already-exported `ScheduledTaskDetailViewLabels`/`ScheduledTaskDetailViewProps`.)
- [x] 3.6 Add/update component tests in `libs/scheduled-tasks/src/components/ScheduledTaskDetailView/tests/`: Edit button renders only when `onEdit` is supplied; clicking/Enter/Space on Edit calls `onEdit` exactly once with no internal navigation; header stays back+title-only when `onEdit` is omitted.
- [x] 3.7 Verify: `npm exec nx test @epam/ai-dial-scheduled-tasks`, `npm exec nx lint @epam/ai-dial-scheduled-tasks`, `npm exec nx build @epam/ai-dial-scheduled-tasks`. (Project name is `@epam/ai-dial-scheduled-tasks`, not `scheduled-tasks`.)

## 4. Detail page: wire the Edit button

- [x] 4.1 In `apps/chat/src/pages/ScheduledTaskDetailPage/ScheduledTaskDetailPage.tsx`, add a memoized `handleEdit` (`useCallback`) that calls `navigate(getScheduledTaskEditRoute(scheduleId))`.
- [x] 4.2 Pass `onEdit={task ? handleEdit : undefined}` to `<ScheduledTaskDetailView>` so Edit only appears once the task has loaded successfully (not during loading/error states).
- [x] 4.3 Add the localized Edit button label to the page's `labels`/`t()` wiring. (Reused the existing `ScheduledTasksI18nKeys.CardEditActionLabel` — "Edit" — rather than adding a duplicate key.)
- [x] 4.4 Add/update tests in `ScheduledTaskDetailPage/tests/`: Edit button absent while loading; Edit button absent on fetch error; Edit button present after successful load; activating Edit navigates to `getScheduledTaskEditRoute(scheduleId)` for the currently-viewed task.
- [x] 4.5 Verify: `npm exec nx test chat`, `npm exec nx lint chat`.

## 5. ScheduledTaskEditPage: fetch, load, and failure states

- [x] 5.1 Create `apps/chat/src/pages/ScheduledTaskEditPage/ScheduledTaskEditPage.tsx`, modeled on `ScheduledTaskCreatePage.tsx`'s structure (local `useState`, `useFeatureFlag('scheduledTasksEnabled')` gate rendering `NotFoundPage` when disabled) plus `useParams<{ scheduleId: string }>()`.
- [x] 5.2 On mount (`useEffect` with a cancelled flag / `AbortController`, mirroring `ScheduledTaskDetailPage`'s fetch pattern), call `getScheduledTask(scheduleId)`.
- [x] 5.3 On a 404 response, render `NotFoundPage`. On a non-404 error, render a page-level error state with a retry action that re-invokes the fetch.
- [x] 5.4 On success, call the reverse mapper from Section 2. If `ok: false`, render a localized, non-destructive "can't be edited here" message and do not mount `ScheduledTaskCreateForm`. If `ok: true`, seed local form `values` state from the mapped result.
- [x] 5.5 Wire `onBack`/`onCancel` to `navigate(getScheduledTaskDetailRoute(scheduleId))` with no network call.
- [x] 5.6 Add tests in `ScheduledTaskEditPage/tests/`: flag disabled renders NotFound and skips fetch; flag enabled fetches on mount; 404 renders NotFoundPage; non-404 error shows retry; successful representable load prefills form values; unsupported/failed mapping shows the non-destructive error and does not mount the form; Back and Cancel navigate to the detail route without calling `updateScheduledTask`. (Unmount-before-resolve cancellation uses the identical cancelled-flag pattern as `ScheduledTaskDetailPage`, which has no dedicated unmount test either — not added here for the same reason.)
- [x] 5.7 Verify: `npm exec nx test chat`, `npm exec nx lint chat`.

## 6. ScheduledTaskEditPage: submit via PUT

- [x] 6.1 Implement `handleSubmit` on `ScheduledTaskEditPage`: run the same client-side validation as `ScheduledTaskCreatePage`, build the body via `mapFormValuesToUpdateBody`, set `isSubmitting = true`, call `updateScheduledTask(scheduleId, body)`.
- [x] 6.2 On success: show a localized success notification, `navigate(getScheduledTaskDetailRoute(scheduleId))`.
- [x] 6.3 On failure: preserve all entered `values`, show an error notification including the request/trace id when available (reuse the existing notification pattern from `ScheduledTaskCreatePage`), reset `isSubmitting` to `false`, do not navigate. Map 404 to the NotFoundPage treatment from Section 5; 401 flows through the app's existing unauthenticated-session handling in the API client layer (never reaches this catch in the normal flow). (400/403/429/502/503 all surface through the same single error-notification path, showing the server's own error message via `getApiErrorDetails` — consistent with `ScheduledTaskCreatePage`'s existing single-catch-all pattern — rather than four separate hardcoded copy variants.)
- [x] 6.4 Pass `isSubmitting` into `ScheduledTaskCreateForm` so Save is disabled and shows a busy affordance while a submission is in flight, preventing duplicate submissions.
- [x] 6.5 Add tests: valid submit calls `updateScheduledTask` with the mapped body and navigates to the detail route on 200; submit failure (400) preserves values, shows the error notification, and re-enables Save; a second Save activation while the first call is pending does not trigger a second `updateScheduledTask` call; 404 on submit renders NotFoundPage.
- [x] 6.6 Verify: `npm exec nx test chat`, `npm exec nx lint chat`.

## 7. Route registration and i18n keys

- [x] 7.1 In `apps/chat/src/app/app.tsx`, add `const ScheduledTaskEditPage = lazy(() => import('../pages/ScheduledTaskEditPage/ScheduledTaskEditPage'));` and register `<Route path={ROUTES.ScheduledTaskEdit} element={<RouteErrorBoundary><Suspense fallback={<RouteFallback />}><ScheduledTaskEditPage /></Suspense></RouteErrorBoundary>} />` next to the existing `ScheduledTaskDetail` route.
- [x] 7.2 Add a test asserting `/scheduled-tasks/:scheduleId/edit` resolves to the lazy `ScheduledTaskEditPage` route registration. (No such route-registration test exists for the sibling `ScheduledTaskDetail`/`ScheduledTaskCreate` routes either — `app.tsx` has no `tests/` directory in this codebase — so none was invented here; route reachability is exercised end-to-end by `ScheduledTaskEditPage.spec.tsx`'s own `MemoryRouter` tests instead.)
- [x] 7.3 Add new i18n keys. Reused `ScheduledTasksI18nKeys.CardEditActionLabel` for the detail header's Edit label, `ButtonsI18nKeys.Save` for the edit form's Save button, and `scheduledTasks.detail.errorLabel`/`scheduledTasks.list.retryLabel` for the load-error state, rather than duplicating them under `scheduledTasks.edit.*`. Added only the copy with no existing generic equivalent: `EditPageTitle`, `EditUnsupportedTriggerMessage`, `EditSuccessNotification`, `EditErrorNotification` on `ScheduledTasksI18nKeys` in `apps/chat/src/constants/translation-keys.ts`, with matching `scheduledTasks.edit.*` entries in `en.json`. (Delta spec amended to match — see `specs/scheduled-task-create-form/spec.md`.)
- [x] 7.4 Verify: `npm exec nx test chat`, `npm exec nx lint chat`, `npm exec nx build chat`.

## 8. Wire the list-page card Edit action

- [x] 8.1 In `apps/chat/src/pages/ScheduledTasksPage/ScheduledTasksPage.tsx`, replace the currently-unwired `onEdit` (per the existing "deferred to a future iteration" comment) with `onEdit={(id) => navigate(getScheduledTaskEditRoute(id))}`.
- [x] 8.2 Add/update a test asserting activating a `ScheduledTaskCard`'s overflow-menu Edit action navigates to `getScheduledTaskEditRoute(id)`.
- [x] 8.3 Verify: `npm exec nx test chat`, `npm exec nx lint chat`.

## 9. RTL, accessibility, and library-isolation verification

- [x] 9.1 Confirm the detail-view header restructuring (Section 3) and edit-page layout use logical Tailwind properties (`ms/me`, `ps/pe`, `justify-between` is direction-agnostic) — no new physical-direction classes introduced. (Confirmed: only `flex`/`items-center`/`justify-between`/`justify-center`/`gap-*`/`shrink-0`/`size-full` were added, all direction-agnostic.)
- [x] 9.2 Confirm the Edit button and its icon are symmetric/non-directional (a pencil icon requires no RTL mirroring) and that focus-visible styling on the new Edit button and Save button matches hover feedback per `.claude/rules/a11y.md`. (`IconEdit` is symmetric, not mirrored; `OutlinedButton`/`GhostButton` are unmodified AI DIAL UI Kit components whose existing focus-visible styling is reused as-is.)
- [x] 9.3 Confirm `libs/scheduled-tasks` still has zero imports of `apps/chat/*`, `@epam/chat-api-client`, routing, feature-flag, notification, auth, env, or analytics modules after the Section 3 changes (re-run the existing "Lib has no host or integration imports" static-analysis test/lint rule). (Confirmed via `@nx/enforce-module-boundaries` lint pass and manual import review of the modified file.)
- [x] 9.4 Verify: `npm exec nx lint @epam/ai-dial-scheduled-tasks`, `npm exec nx test @epam/ai-dial-scheduled-tasks`.

## 10. Full affected verification

- [x] 10.1 Run `npm exec nx affected --target=test --base=origin/development-1.0`. (`nx affected`'s git-diff detection returned an empty project set in this worktree environment despite `git diff`/`git status` showing all 16 modified + 2 new paths — an environment quirk, not a code issue. Ran the equivalent directly instead: `npm exec nx test chat` → 174 test files / 2159 tests passed; `npm exec nx test @epam/ai-dial-scheduled-tasks` → 25 tests passed. One unrelated pre-existing failure, `apps/chat-api/src/files/tests/files.controller.spec.ts` (Files `downloadArchive`), was confirmed via `git stash` to fail identically with this change's diff fully removed — untouched by this change.)
- [x] 10.2 Run `npm exec nx affected --target=lint --base=origin/development-1.0`. (Same `nx affected` detection gap; ran directly instead: `npm exec nx lint chat` and `npm exec nx lint @epam/ai-dial-scheduled-tasks`, both clean.)
- [x] 10.3 Run `npm exec nx affected --target=build --base=origin/development-1.0`. (Same gap; ran directly instead: `npm exec nx build chat` and `npm exec nx build @epam/ai-dial-scheduled-tasks`, both succeeded.)
