## Context

`scheduled-tasks-page-ui` shipped the page shell: header, toolbar (search + sort, both inert), and a content region that always renders `PanelEmptyState`. `scheduled-tasks-api` shipped `GET/POST/GET/:id/PUT/:id` under `/api/v1/scheduled-tasks`, with `ScheduledTaskDto = { id, displayName, trigger }` (`trigger` is `{ date?: string } | { cron?: { fields: Record<string,string> } }`) and a 30s per-user list cache invalidated on create/update. `scheduled-task-create-form` shipped the create flow, navigating back to `/scheduled-tasks` via `ScheduledTaskCreateQuery.ReturnUrl`.

The target card grid layout (see also `openspec/changes/archive/2026-07-23-add-scheduled-tasks-page-ui/design.md` for the full page): header + toolbar unchanged, then named sections ("Shared", "My tasks") each with a count badge, each rendering a card grid. A card shows: title + optional "N NEW" badge, description/prompt-preview text, a schedule pill ("Every Monday 12:00"), and a location breadcrumb (folder icon → "Public" → chevron → "Project folder").

The live `ScheduledTaskDto` has no `status`/`owner`/`createdAt`/`model`/`prompt` fields, so several card-visible fields (schedule-pill wording, "N NEW" badge, Shared/My-tasks split, location breadcrumb) cannot be populated from today's DTO without either (a) confirming the upstream scheduler response already carries more fields than the DTO currently maps, or (b) deferring those fields to a documented fallback.

## Goals / Non-Goals

**Goals:**
- Fetch `listScheduledTasks()` on the list page and render a catalog-style card grid when items exist.
- Preserve every existing `scheduled-tasks-page-ui` requirement (flag gating, lazy route, lib host-isolation, i18n, RTL, AAA a11y) while replacing the "always empty" content-region requirement with real states.
- Keep search and sort entirely client-side over the already-fetched list.
- Keep `libs/scheduled-tasks` host-agnostic: it receives `items` (a lib-defined `ScheduledTaskItem[]`), never a DTO, and never imports API/routing/flag code.

**Non-Goals:**
- Run now / Edit / Delete backend wiring — no such endpoints exist yet on `scheduled-tasks-api`. The overflow menu is presentational and takes optional callback props; this change does not implement handlers that call an API.
- Server-side search, sort, filtering, or pagination — the BFF list endpoint takes no query params today and none are added.
- Virtualization or a list/table view toggle.
- Extracting a generic card-shell primitive into `@epam/ai-dial-kit` — only revisited as a follow-up change if a second consumer appears.

## Decisions

**Confirm DTO fields against a live upstream response before extending `ScheduledTaskDto`.**
The first implementation slice inspects an actual `GET .../route/v1/schedules/` upstream payload (or the scheduler's `openapi.json` if a live call isn't available) for fields the card UI needs: creation timestamp, next-run time, prompt/description text, owning user, and any share/visibility marker. Only fields confirmed present are added to `ScheduledTaskDto` + `scheduled-tasks.mapper.ts`, each with a `scheduled-tasks-api` spec delta and mapper test. Alternative — inventing plausible field names to match the card layout — rejected: the repo rule against fabricated data applies, and a wrong guess would need a breaking DTO change later.

**Shared vs. My tasks grouping — defer to a single ungrouped section if ownership data is absent.**
If the confirmed DTO has no owner/visibility field, `ScheduledTaskCardGrid` renders one section (reusing the "My tasks" copy, count badge included) rather than fabricating a Shared/My-tasks split. `ScheduledTaskSection` still exists and is exercised by this path, so adding real grouping later is a data-only change, not a component change. Alternative — hardcoding an empty "Shared" section — rejected as visibly wrong (a permanent empty section).

**Client-side search/sort over the full fetched list (Alternative A in the proposal).**
The list endpoint is cached 30s server-side and returns all of a user's schedules with no pagination; filtering/sorting an array already in memory is simpler than adding query params to a stable, just-shipped contract, and matches how the toolbar was already speced against local `searchQuery`/`sortKey` state in `scheduled-tasks-page-ui`. Revisit only if list sizes require pagination (no evidence of that today — out of scope).

**`ScheduledTaskItem` is a lib-owned type, mapped from `ScheduledTaskDto` at the app edge.**
```ts
// libs/scheduled-tasks/src/models/scheduled-task-item.ts
interface ScheduledTaskItem {
  id: string;
  displayName: string;
  scheduleLabel: string;       // pre-formatted, e.g. "Every Monday 12:00"
  descriptionPreview?: string;
  locationSegments?: string[]; // outermost first, e.g. ['Public', 'Project folder'] — rendered as a real breadcrumb with a mirrored chevron separator
  isNew?: boolean;             // drives "N NEW"-style badge presence; count itself is app-computed if needed
  sectionKey: 'shared' | 'myTasks';
  sortValues: {
    nextRunAt?: string;  // ISO, for firstToRun/lastToRun
    createdAt?: string;  // ISO, for newest — omitted if DTO has no createdAt
  };
}
```
Date formatting, breadcrumb joining, and cron-vs-date-to-human-label translation happen in `apps/chat/src/utils/map-scheduled-task-dto.ts` (app edge, has i18n/locale access), not in the lib — mirrors the library-isolation rule that libs receive resolved values, not raw dates/locale-dependent formatting decisions. Alternative — passing raw `trigger`/timestamps into the lib and formatting there — rejected: formatting is locale- and i18n-dependent, which the lib must not own.

**`useScheduledTasks` owns fetch + refetch; the page owns when to call `refetch`.**
```ts
// apps/chat/src/hooks/scheduled-tasks/useScheduledTasks.ts
interface UseScheduledTasksResult {
  items: ScheduledTaskDto[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}
```
Follows the `useFavicon.ts` reference pattern (AbortController + cancelled flag, async/await). `ScheduledTasksPage` calls `refetch()` when it detects a return from the create flow (e.g. `useLocation().state?.refresh` set by the create-form's navigate-back call, matching the existing `ScheduledTaskCreateQuery.ReturnUrl` mechanism already in place). Alternative — polling — rejected: no requirement for live updates, and the BFF already caches for 30s, so polling would mostly hit cache or thrash it.

**Card overflow menu renders only actions with a real handler.**
`ScheduledTaskCard` accepts `onEdit?`, `onRunNow?`, `onDelete?`; the menu renders an item only when the corresponding prop is provided. This change passes none of them (no backend capability yet), so the overflow trigger is omitted entirely when zero handlers are supplied — **Resolved** during implementation to avoid a dead affordance.

**Catalog visual parity via copied token/layout patterns, not shared components.**
`libs/scheduled-tasks` does not import `@epam/ai-dial-catalog` (per proposal's reuse-strategy: wrong item shape, domain coupling, extra deps pulled into an unrelated lib). `ScheduledTaskCard`/`ScheduledTaskCardGrid` are new components that reuse `@epam/ai-dial-kit` primitives (`SearchBar`, buttons) and `@epam/ai-dial-chat-shared` (`Highlight`, `PanelEmptyState`, `mergeClasses`), styled to match `libs/catalog/src/components/CardGrid/` spacing/radius/color tokens by inspection, not import.

## Risks / Trade-offs

- [Risk] Confirming DTO fields against a live upstream response may be blocked if no test scheduler instance is reachable during implementation. → Mitigation: fall back to the scheduler's `openapi.json` (already referenced in `scheduled-tasks-api`'s design) as a secondary source; if neither is available, ship this change with only `id`/`displayName`/`trigger`-derived card content (schedule pill from `trigger`, no owner/date-based fields) and file a follow-up rather than guessing field names.
- [Risk] Client-side sort by `createdAt`/`nextRunAt` degrades silently (falls back to `displayName` order or a stable no-op) if those fields turn out unavailable. → Mitigation: `sortValues` fields are optional by design; the sort comparator documents its fallback per key so behavior is deterministic and testable, not undefined.
- [Risk] Single ungrouped section (if grouping data is absent) may not visually match the two-section design during review. → Mitigation: `ScheduledTaskSection` is still used for the single section, so visual spacing/heading style is consistent even though the split doesn't exist yet; call this out explicitly in the PR description.
- [Risk] Refetch-on-return-from-create relying on router state is fragile if the user reaches `/scheduled-tasks` by other means (browser back after a deep link). → Mitigation: `useScheduledTasks` also refetches on mount regardless, so the worst case is a up-to-30s-stale list until the BFF cache naturally expires or another create/update invalidates it — no broken state, just a bounded staleness window already accepted by the API spec.

## Migration Plan

- Additive to `libs/scheduled-tasks` (new components) and `apps/chat` (new hook, mapper, i18n keys); modifies `ScheduledTasksPage` and the `ScheduledTasks` root's content-region branching. No route, flag, or nav changes.
- If DTO extension is confirmed necessary: additive optional fields only (`@ApiPropertyOptional`), no removal/rename of `id`/`displayName`/`trigger` — non-breaking for any other DTO consumer.
- Rollback: revert the commit(s); `ScheduledTasks` content region reverts to always-`PanelEmptyState`, matching the pre-change spec exactly (git revert is clean since no data migration or persisted state is introduced).

## Open Questions

- ~~Exact upstream scheduler fields available for `createdAt`/`nextRunAt`/owner/visibility~~ — **Resolved twice.** First pass: no live DIAL Scheduler instance was reachable in the implementation sandbox, so `ScheduledTaskDto` shipped unextended (`id`/`displayName`/`trigger` only) per the documented fallback. **Second pass, against a real deployment:** debug logging added post-ship (see Migration Plan) surfaced two corrections to that first pass:
  1. **Bug, not a data-shape gap:** `GET .../route/v1/schedules/` returns a paginated envelope `{ count, limit, offset, results, next, previous }` — `results`, not `items`. The original `Array.isArray(result) ? result : result.items ?? []` unwrapping in `ScheduledTasksService.listScheduledTasks` therefore always resolved zero items against a real Scheduler, independent of any DTO shape question. Fixed via a new `extractListItems` helper that checks `results` first, `items` as a fallback (in case an older/different Scheduler version uses that key), then a bare array.
  2. **Data-shape gap, now closed:** a real `create`/`list` response confirmed `next_run_time` and `created_at` (plus `service_id`, `properties`, `metadata`, `created_by`, `updated_at`, none of which are consumed here) are present upstream. `ScheduledTaskDto` was extended with optional `nextRunTime`/`createdAt`; `map-scheduled-task-dto.ts` now populates `sortValues.nextRunAt` from `nextRunTime` (falling back to `trigger.date` for schedules created before this field was mapped) and `sortValues.createdAt` from `createdAt`, so `newest` sort has real data instead of always sorting last. Owner/visibility (for a `shared` vs `myTasks` split) still isn't present upstream — that part of the original fallback stands.
  3. **Third pass, against a live `GET .../route/v1/schedules/` response (logged 2026-07-24), found via the same debug-logging approach — resolved (task 8 below), except the per-item trigger-detail question:**
     - **`trigger` is absent from list items entirely — unresolved, deliberately not worked around.** A real list-endpoint item looks like `{ id, display_name, service_id, next_run_time, trigger_type: "cron"|"date", created_by, created_at, updated_at }` — there is no nested `trigger.cron.fields` or `trigger.date` in the list response, only a `trigger_type` discriminator. `fromUpstreamSchedule`'s `trigger: { date: upstream.trigger?.date, cron: upstream.trigger?.cron ? {...} : undefined }` therefore still maps to `{ date: undefined, cron: undefined }` for list results — every card's `scheduleLabel` falls through to the generic "Recurring schedule" fallback regardless of the actual cron config, independent of the `day_of_week`/`day` field-name fix already applied to the create/update path. Whether a per-item `GET .../route/v1/schedules/{scheduleId}` call would return the cron fields is still unconfirmed (no live instance reachable in this pass to check) — deliberately not implementing N+1 per-card detail fetches to work around it without that confirmation; `triggerType` (now mapped, see below) is the best available signal for the list view until a follow-up confirms and wires per-item detail.
     - **`created_by` is present and now used, fixed:** `ScheduledTaskDto.createdBy` is mapped from upstream `created_by`; `map-scheduled-task-dto.ts` compares it against the current session user's sub (via `useUser()` in `ScheduledTasksPage`) to resolve real `shared`/`myTasks` `sectionKey`s instead of hardcoding `myTasks` for everything, falling back to `myTasks` when either value is unavailable. `serviceId`, `triggerType`, and `updatedAt` are also now mapped onto `ScheduledTaskDto` (additive, optional), even though `triggerType` isn't yet consumed by the schedule-label formatter (see previous bullet).
     - **List pagination envelope, fixed at the data level only:** `ListScheduledTasksResponseDto` now surfaces `count`/`limit`/`offset`/`next`/`previous` from the upstream envelope. The endpoint still doesn't accept client-supplied `limit`/`offset`, and no frontend paging/"load more" UI was added — a user with more than the upstream page size worth of schedules still only sees the first page; the difference is the BFF response now carries enough information for a future change to build that UI without another backend round-trip.
- Whether the overflow-menu trigger itself renders when zero action props are supplied, or is omitted — **Resolved:** the trigger is omitted entirely when none of `onEdit`/`onRunNow`/`onDelete` are supplied, avoiding a dead affordance; this change supplies none of them (no backend capability yet), so no overflow trigger renders on any card in this iteration.
