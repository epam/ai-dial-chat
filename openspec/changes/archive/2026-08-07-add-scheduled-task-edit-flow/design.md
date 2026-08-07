## Context

The detail page (`apps/chat/src/pages/ScheduledTaskDetailPage/ScheduledTaskDetailPage.tsx`) currently only fetches and displays a task read-only; its header renders a back button and title, nothing on the end side (`libs/scheduled-tasks/src/components/ScheduledTaskDetailView/ScheduledTaskDetailView.tsx:263-291`). The create flow (`ScheduledTaskCreatePage` + `ScheduledTaskCreateForm`) already provides a full two-column editor (markdown prompt, model picker, schedule fields, activity-window pickers) and its `mapFormValuesToCreateBody` forward mapper, but there is no reverse (DTO → form values) mapper anywhere in `apps/chat/src/utils/scheduled-task-trigger.ts`, and the create page has no concept of an existing `scheduleId` to prefill from. The backend `PUT /api/v1/scheduled-tasks/:scheduleId` (`updateScheduledTask`), its DTOs (`UpdateScheduledTaskBodyDto extends CreateScheduledTaskBodyDto`), the generated client method, and the `server-api` wrapper are already implemented and unchanged by this design — the only backend-adjacent finding worth carrying forward is that `scheduled-tasks.service.ts` does not perform an explicit `createdBy === sub` check on `getScheduledTask`/`updateScheduledTask`; scoping is implicit via forwarding the caller's own access token upstream. This design does not change that trust boundary.

`redesign-scheduled-task-create-editor` is functionally complete (all tasks checked, code already reflects it) but not yet archived; its proposal explicitly excluded the edit flow (`PUT`) as out of scope, so there is no conflict — this change is its natural follow-up.

## Goals / Non-Goals

**Goals:**
- Add a discoverable Edit entry point on the detail page that reuses the existing create-form editor and existing update endpoint.
- Define a safe, explicit reverse mapping from `ScheduledTaskDto` to editor form values, including a fail-closed path for triggers or fields the editor cannot represent.
- Keep `libs/scheduled-tasks` host-agnostic: no routing, API, or feature-flag knowledge enters the lib.
- Reuse `ScheduledTaskCreateForm` as-is (no new `mode` prop) — differences between create and edit live entirely in the hosting page.

**Non-Goals:**
- Active/Pause/Resume, Delete, Run-now, run-history editing/pagination — unchanged.
- New backend/BFF endpoints, DTO changes, or direct upstream Scheduler calls — `PUT /api/v1/scheduled-tasks/:scheduleId` is reused unmodified.
- Client-side `createdBy` authorization checks — the server-side trust boundary is out of scope for this change (documented, not fixed).
- Unsaved-changes confirmation dialogs — no established pattern in this codebase to build on; Back/Cancel navigate immediately.

## Decisions

### 1. One presentational form, two host pages, no `mode` prop

`ScheduledTaskCreateForm`'s props (`labels`, `values`, `errors`, `modelOptions`, `onFieldChange`, `onBack`, `onCancel`, `onSubmit`, `isSubmitting?`) are already sufficient to drive an edit UI: the page supplies edit-flavored `labels` (e.g. "Edit scheduled task" title, "Save changes" button text) and an `onSubmit` that calls `updateScheduledTask` instead of `createScheduledTask`. No `mode`/`isEdit` prop is added to the lib.

**Alternative rejected — convert to a generic mode-agnostic editor inside the lib**: would require threading a `mode` prop through purely for label defaults the host already fully controls via `labels`; adds lib-side branching with no behavioral payoff since the lib has no submission logic of its own.

**Alternative rejected — separate edit-only form component**: duplicates ~440 lines of two-column layout, validation display, and markdown editor wiring for zero contract difference. Rejected as pure duplication.

New page: `apps/chat/src/pages/ScheduledTaskEditPage/ScheduledTaskEditPage.tsx`, structured like `ScheduledTaskCreatePage.tsx` but with:
- `const { scheduleId } = useParams<{ scheduleId: string }>()`.
- On mount: `getScheduledTask(scheduleId)`, mapped to form values via the new reverse mapper (Decision 3). Loading/error/not-found states mirror `ScheduledTaskDetailPage`'s existing fetch pattern (`useEffect` + cancelled flag, per `apps/chat/src/hooks/useFavicon.ts`'s reference pattern).
- Back/Cancel both navigate to `getScheduledTaskDetailRoute(scheduleId)` (not `ROUTES.ScheduledTasks` — the user came from that specific task's detail page and should return there) without calling the API.
- `onSubmit`: validates (same rules as create), maps form values to `UpdateScheduledTaskBodyDto` via a new `mapFormValuesToUpdateBody` (thin wrapper reusing the same field-mapping as `mapFormValuesToCreateBody` — the DTOs are identical shapes), calls `updateScheduledTask(scheduleId, body)`, shows a success notification, and navigates to `getScheduledTaskDetailRoute(scheduleId)` so the detail page refetches fresh data.
- On failure: form values are untouched (they live in page-local `useState`, exactly as `ScheduledTaskCreatePage` already does on its own submit failure), the same notification/error pattern is used including request/trace ID, and `isSubmitting` is reset so Save is re-enabled.

### 2. New route, registered exactly like existing scheduled-task routes

`apps/chat/src/types/routes.ts`: add `ScheduledTaskEdit = '/scheduled-tasks/:scheduleId/edit'` alongside the existing three entries.
`apps/chat/src/constants/routes.ts`: add
```ts
export const getScheduledTaskEditRoute = (scheduleId: string): string =>
  `${getScheduledTaskDetailRoute(scheduleId)}/edit`;
```
mirroring the existing `getScheduledTaskDetailRoute` (`encodeURIComponent` applied once, inherited from the detail-route builder rather than re-applied).
`apps/chat/src/app/app.tsx`: add a `ScheduledTaskEditPage = lazy(() => import(...))` and a `<Route path={ROUTES.ScheduledTaskEdit} element={<RouteErrorBoundary><Suspense fallback={<RouteFallback/>}><ScheduledTaskEditPage/></Suspense></RouteErrorBoundary>}/>`, registered unconditionally (feature-flag gating happens inside the page component, matching `ScheduledTaskCreatePage`/`ScheduledTaskDetailPage`'s existing `useFeatureFlag('scheduledTasksEnabled')` pattern — not at the route table).

### 3. Reverse trigger mapper with an explicit representability check (fail-closed, not fail-silent)

Add to `apps/chat/src/utils/scheduled-task-trigger.ts`:
```ts
function tryMapScheduledTaskDtoToFormValues(
  dto: ScheduledTaskDto,
): { ok: true; values: ScheduledTaskCreateFormValues } | { ok: false; reason: UnsupportedTriggerReason };
```
This inverts `buildCronFields`/`buildCronWindowBoundary` (UTC → local `time`/`dayOfWeek`/`dayOfMonth`/`startDate`/`endDate`), reusing the same reference-`Date` + local getters technique already used forward, so DST behavior is symmetric with the existing forward conversion rather than reimplemented independently. It returns `ok: false` — never a best-effort guess — when:
- the trigger's cron shape falls outside the subset the editor's schedule-type fields can express (e.g. a cron expression with multiple day-of-week values, non-standard step fields, or any field the create form has no control for),
- `model` or `prompt` is missing/empty on the DTO (legacy or partially-created task),
- the `triggerType` is not one of the values the create form's schedule-type selector supports.

**Alternative rejected — best-effort coercion (e.g. collapse an unsupported cron to the nearest supported daily/weekly shape)**: would silently change the user's actual schedule on next Save, which is explicitly the failure mode this proposal must avoid per the requirements. Fail-closed with a visible error is the only acceptable behavior.

On `ok: false`, `ScheduledTaskEditPage` renders a localized, non-destructive message (e.g. "This task's schedule can't be edited here yet.") and never mounts the form in an editable state — Save stays unavailable. This is a page-level state, not a lib concern; `ScheduledTaskCreateForm` itself is never told about representability.

### 4. Detail-page Edit entry point: new `onEdit` prop, header restructured to an end-side slot

`libs/scheduled-tasks/src/components/ScheduledTaskDetailView/ScheduledTaskDetailView.tsx`: add `onEdit?: () => void` to `ScheduledTaskDetailViewProps` (optional, so the lib stays usable without it) and localized label props (`editButtonLabel` or reuse the existing `labels` object, consistent with how `ScheduledTaskCreateForm` receives all text). Restructure the header `div` from its current back-button+title-only layout to `flex items-center justify-between`, with the back button + `<h1>` on the start side (unchanged) and, when `onEdit` is supplied, an outlined button with `IconEdit` (`@tabler/icons-react`) + the label on the end side — mirroring `ScheduledTaskCreateForm.tsx:100-134`'s own header pattern, the closest existing precedent for a header with a start title and end-side action(s). Confirm the exact outlined-button component (likely `SecondaryButton`/`OutlinedButton` from `@epam/ai-dial-ui-kit`) via the UI Kit MCP tools before implementation; do not guess the component name here.

`ScheduledTaskDetailPage.tsx`: render the Edit button only after the task has loaded successfully (i.e. pass `onEdit={task ? handleEdit : undefined}`, not a permanently-present-but-disabled button), where `handleEdit = () => navigate(getScheduledTaskEditRoute(scheduleId))`. Memoize `handleEdit` with `useCallback` since it is passed into `ScheduledTaskDetailView`.

### 5. `ScheduledTaskCard` overflow-menu Edit is wired in the same change

`ScheduledTaskCard`'s `onEdit?: (id: string) => void` already exists and renders correctly (`libs/scheduled-tasks/src/components/ScheduledTaskCard/ScheduledTaskCard.tsx:74-83`); it is simply unwired at `ScheduledTasksPage.tsx:124-126`. Wiring it to `onEdit={(id) => navigate(getScheduledTaskEditRoute(id))}` is a one-line, zero-risk addition reusing infrastructure this change already builds, so it is included here rather than deferred again.

## Risks / Trade-offs

- **[Risk] A task's trigger cannot be represented by the current editor (cron shapes beyond the supported subset)** → Mitigation: Decision 3's fail-closed representability check; Save is disabled and a localized error is shown instead of silently rewriting the schedule.
- **[Risk] Legacy tasks missing `model`/`prompt`** → Mitigation: same representability check treats missing required fields as unsupported; edit is blocked rather than allowing a Save that would submit an incomplete/invalid update body.
- **[Risk] DST-sensitive local↔UTC conversion drift between the existing forward mapper and the new reverse mapper** → Mitigation: reverse mapper is implemented as the literal inverse of `buildCronFields`/`buildCronWindowBoundary` using the same reference-`Date`-based UTC/local conversion technique, and round-trip (forward→reverse→forward) tests are required for daily/weekly/monthly cases across a DST boundary date.
- **[Risk] No explicit server-side ownership check on `getScheduledTask`/`updateScheduledTask`** → Not mitigated by this change (out of scope); documented as an existing, accepted trust boundary relying on DIAL Scheduler enforcing per-user visibility via the forwarded access token. Any future hardening (explicit `createdBy === sub` check) is a separate change.
- **[Trade-off] No `mode` prop on the shared form** → keeps the lib simpler and avoids a lib-side behavioral branch, at the cost of the two host pages independently constructing similar `labels`/mapping glue. Accepted since the duplication is confined to page-level wiring, not presentation or validation logic.

## Migration Plan

No data migration. Deployment is a standard frontend release: new route, new page, updated lib props (additive/optional), updated detail-page and list-page wiring. Rollback is a plain revert — no schema, DTO, or endpoint changes to unwind. The `scheduled-task-detail-page` spec amendment (removing the "no Edit control" requirement) ships in the same change as the code so spec and implementation never diverge.

## Open Questions

None outstanding — all functional ambiguities identified during investigation (create-form reuse strategy, reverse-mapper existence, ownership-check scope, card-Edit wiring) are resolved above per the proposal's stated defaults.
