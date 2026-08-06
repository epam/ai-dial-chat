## Context

The Scheduled Tasks list page (`scheduled-tasks-page-ui`, `scheduled-tasks-api`) already ships list/create/get/update against DIAL Scheduler, routed through `apps/chat-api/src/scheduled-tasks/`. There is no drill-down: cards are terminal UI. Upstream DIAL Scheduler exposes a schedule-detail GET and a paginated `.../runs` GET (both confirmed via `DIAL Scheduler.postman_collection.json`), so the missing piece is BFF surface + a new frontend page, not a new upstream capability.

Stakeholders: Scheduled Tasks feature owners (frontend + chat-api), existing `libs/scheduled-tasks` maintainers (library-isolation boundary applies).

Constraints carried over from the existing capability specs:
- Session-bearer auth, `FeatureGuard` + `scheduledTasksEnabled`, per existing four endpoints.
- `scheduleId` allowlist validation (`^[A-Za-z0-9_-]{1,128}$`) already established for `get`/`update`.
- `libs/scheduled-tasks` must stay host-agnostic (no routing, no `@epam/chat-api-client`, no i18n).
- Markdown rendering for assistant-authored text already has one sanctioned stack: `MarkdownRenderer`/`MDMessageViewer` in `@epam/ai-dial-chat-shared`, used by chat messages. The instructions section must reuse it rather than introduce a second markdown renderer.

## Goals / Non-Goals

**Goals:**
- Card click on the list navigates to a detail route showing description, model, schedule label, and prompt/instructions rendered as markdown.
- A History panel shows paginated past/current runs with infinite scroll, status icons, and human-readable timestamps.
- BFF exposes the two upstream calls (`get` extended, `runs` new) needed to fill that page, mapped snake_case → camelCase, matching the existing `scheduled-tasks-api` conventions (validation, error mapping, non-caching where appropriate).
- Reuse the existing shared markdown stack, existing scroll-pagination pattern already validated in this same feature area (`ListView.tsx` `findScrollParent`), and existing lib-isolation boundary.

**Non-Goals:**
- Edit / Delete / Active-toggle / Run-now actions on the detail header (existing `updateScheduledTask` stays unwired to this page).
- `GET .../runs/{runId}` single-run detail endpoint.
- Polling or auto-refresh of `in_progress` runs — the user must re-enter the page or manually refresh.
- A "Skill" row (out of scope unless upstream already returns a skill id — it does not, per the confirmed get-response shape).
- History search/sort UI — server order (`created_at desc`) is fixed and non-negotiable in this iteration.
- Unread-dot indicators on history rows (belongs to the separate `scheduled-task-unread-tracking` change, only if it lands in the same PR).
- Navigating a run row to its conversation — the list-runs response does not expose a conversation id, and the design explicitly forbids an N+1 `GET .../runs/{runId}` call just to discover one.

## Decisions

### 1. Extend the existing `get` DTO instead of adding a separate detail-only endpoint
`GET /api/v1/scheduled-tasks/:scheduleId` already exists and is uncached; adding `model`/`prompt` (in addition to the already-planned `description`) to its response is a superset extension, not a new contract. This avoids a second endpoint that would duplicate scheduleId validation, auth, and error-mapping logic. Alternative considered: a dedicated `/scheduled-tasks/:id/detail` endpoint — rejected, no behavioral difference from extending `get`, just extra surface to maintain.

### 2. New `GET /:scheduleId/runs` endpoint, uncached, explicit ordering
Mirrors the `list` endpoint's envelope-unwrapping pattern (`results` → `items`) but is **not cached**, unlike the 30s TTL on `listScheduledTasks`: run status changes (`in_progress` → `success`/`error`) are exactly the kind of freshness a cache would stale-serve, and the existing `get` endpoint for a single schedule is already uncached for the same reason. The BFF always sends `order_by=created_at&order_dir=desc` explicitly (never relies on upstream's own default) — this mirrors the same "explicit default" decision already made for `listScheduledTasks`'s `order_by=next_run_time&order_dir=asc`, for the same reason: an endpoint's documented default must be what's actually observed, not whatever upstream happens to default to today.

### 3. Reuse `findScrollParent` pattern for History infinite scroll, not a bare `IntersectionObserver`
`scheduled-tasks-page-ui` already established (for the list page) that `libs/catalog/src/components/ListView/ListView.tsx`'s `findScrollParent` + scroll-listener approach is the one infinite-scroll implementation this codebase should have. The History panel is a second, independent scrollable region on the same page (not the page's own scroll), so it reuses the same detection utility scoped to its own container rather than introducing a second scrolling pattern.

### 4. `useScheduledTaskRuns` hook mirrors `useScheduledTasks` shape
Same `{ items, isLoading, isLoadingMore, error, hasMore, loadMore, refetch }` contract as the already-shipped `useScheduledTasks`, for consistency and so a reviewer/future maintainer already familiar with that hook can read this one without relearning conventions. `hasMore` prefers `items.length < count` when `count` is present (matches upstream's confirmed envelope), falling back to a non-null `next` check, matching the same tiered fallback `listScheduledTasks` already uses.

### 5. Instructions render through `renderInstructions` callback prop, not a hardcoded import inside the lib
`ScheduledTaskDetailView` (in `libs/scheduled-tasks`) cannot import `@epam/ai-dial-chat-shared`'s `MarkdownRenderer` directly if that would violate the lib-boundary rule — but `@epam/ai-dial-chat-shared` is itself a lib, and `type:ui` libs may import from `chat-shared` per the module-boundary rules, so a direct import is technically allowed. The design still prefers a `renderInstructions?: (markdown: string) => ReactNode` callback (falling back to a default inline `MarkdownRenderer` usage) so the app can override markdown class names/behavior without a `libs/scheduled-tasks` release, and so the lib's own tests aren't required to snapshot full markdown rendering.

### 6. Card-click wiring: `onCardClick` prop threaded through, overflow menu stops propagation
`ScheduledTaskCard` already has an overflow-menu trigger for `onEdit`/`onRunNow`/`onDelete` (per `scheduled-tasks-page-ui`). Adding `onCardClick?: (id: string) => void` as a new optional prop on `ScheduledTaskCard`, threaded through `ScheduledTaskCardGrid` and `ScheduledTasks`, keeps the lib boundary intact (still no routing knowledge in the lib — `ScheduledTasksPage` supplies the `navigate(getScheduledTaskDetailRoute(id))` callback). The overflow-menu's trigger button and its portal-rendered menu items must call `event.stopPropagation()` so a click on "Edit"/"Delete" doesn't bubble to the card's own click handler and cause a stray navigation.

### 7. Detail page fetch sequencing: task detail and first runs page fetch in parallel
`ScheduledTaskDetailPage` fires `getScheduledTask(scheduleId)` and the hook's initial `listScheduledTaskRuns({ scheduleId, limit: 20, offset: 0 })` concurrently on mount (not sequentially) — the History panel has no dependency on task-detail fields, so serializing them would only add latency. A 404 from `getScheduledTask` still renders `NotFoundPage`; a runs-fetch error is scoped to the History card only (task metadata stays visible per the proposal's explicit requirement) so one failing section doesn't blank the whole page.

## Risks / Trade-offs

- **[Risk]** Row click intended to navigate to a conversation has no conversation id available from `.../runs` in this iteration → user-visible affordance would be misleading if clickable. **Mitigation:** row click is an explicit no-op in v1 (documented in proposal's "Out of scope"); do not render a hover/pointer affordance that implies clickability until a future iteration adds the id.
- **[Risk]** `in_progress` runs shown at page-load could go stale if the user leaves the tab open. **Mitigation:** explicitly non-goal (no polling) — acceptable given DIAL Scheduler runs are typically short-lived and a manual refetch (re-entering the page) is a reasonable escape hatch for this iteration.
- **[Risk]** Extending `ScheduledTaskDto` with `model`/`prompt` on the `get` response could tempt reuse of the same DTO for `list`, leaking two extra fields into every list-row payload. **Mitigation:** `model`/`prompt` are additive optional fields exactly like the existing `description`/`nextRunTime` extensions — the `list` mapper is untouched and continues to omit them from its response shape at the mapper level (not just "unused" on the frontend), keeping list payload size stable.
- **[Trade-off]** Reusing `findScrollParent` for a second, nested scroll container (History card) rather than a purpose-built hook adds one more call site to an already-shared utility instead of introducing `react-intersection-observer` or similar. Accepted: consistent with the one existing repo convention, avoids a new dependency, and the utility is already scoped to an arbitrary ancestor rather than assuming page-level scroll.

## Migration Plan

No data migration. Rollout is additive (new route, new endpoint, new lib component) and stays behind the existing `scheduledTasksEnabled` feature flag — no separate flag needed since detail navigation only becomes reachable once list cards are already visible. Rollback is a flag flip or revert; no schema/state to unwind.

## Open Questions

- Exact upstream field name/shape for "Model or Agent" display name resolution (deployments context lookup vs. raw id fallback) — resolved at implementation time against the deployments context already used elsewhere in the app; not a blocking design unknown.
- Whether a future PR adds conversation id to the runs list response (unblocking row-click navigation) is out of this change's control — tracked as a follow-up, not resolved here.
