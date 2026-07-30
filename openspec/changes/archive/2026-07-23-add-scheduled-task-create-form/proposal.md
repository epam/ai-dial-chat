## Why

The Scheduled Tasks list page (`/scheduled-tasks`) ships with a **New task** button wired to a no-op handler (`apps/chat/src/pages/ScheduledTasksPage/ScheduledTasksPage.tsx:40`). Users can see the empty list but cannot start authoring a task. The BFF contract for creating schedules is defined in the companion change `add-scheduled-tasks-api` (`POST /api/v1/scheduled-tasks` → DIAL Scheduler upstream). This change wires navigation to a create form whose fields match that contract and persists a new schedule on submit.

## What Changes

- Add a new route, `ROUTES.ScheduledTaskCreate = '/scheduled-tasks/new'`, registered in `apps/chat/src/app/app.tsx` behind the existing `scheduledTasksEnabled` feature flag (same `RouteErrorBoundary` + `Suspense` + `RouteFallback` pattern as other standalone pages).
- Add a `returnUrl`-aware app page, `apps/chat/src/pages/ScheduledTaskCreatePage/ScheduledTaskCreatePage.tsx`, following the `returnUrl` query-param + Cancel-returns-without-saving convention used by `ToolsetEditor`/`AppsEditor`.
- Extend `libs/scheduled-tasks` with a presentational `ScheduledTaskCreateForm` component whose fields align with `CreateScheduledTaskBodyDto` from `add-scheduled-tasks-api`:
  - **Display name** (required)
  - **Schedule trigger** — one-shot run datetime **or** recurring frequency (Daily / Weekly / Monthly) + time, mapped at the app edge to `trigger.date` or `trigger.cron.fields`
  - **Model** (deployment picker, required)
  - **Prompt** (required textarea → upstream chat message content)
  - **Stream** (optional toggle, default `true`)
  - Cancel / Create actions
- Wire the list page's **New task** button to navigate to the create route with `returnUrl` set to the list page, replacing the current no-op handler.
- On valid submit, call `POST /api/v1/scheduled-tasks` through `apps/chat/src/server-api/scheduled-tasks.api.ts` (generated client wrapper from `add-scheduled-tasks-api`); show success notification and navigate to `returnUrl` on 201; show error notification and keep form state on failure.
- Add `scheduledTasks.create.*` i18n keys (mirrored across all locales). Reuse `EditorI18nKeys` for display-name label/required and `ButtonsI18nKeys` for Cancel/Create where strings already exist.

## Capabilities

### New Capabilities

- `scheduled-task-create-form`: navigation from the Scheduled Tasks list to a dedicated create-task route, and a create-task form UI whose fields and submit behavior match the `scheduled-tasks-api` BFF create contract (`displayName`, `trigger`, `model`, `prompt`, `stream`).

### Modified Capabilities

- `scheduled-tasks-api` (companion change `add-scheduled-tasks-api`): this change consumes `POST /api/v1/scheduled-tasks` via `apps/chat/src/server-api/scheduled-tasks.api.ts`. The BFF request/response contract is normative in `openspec/changes/add-scheduled-tasks-api/specs/scheduled-tasks-api/spec.md` — do not duplicate endpoint design here; reference it.

## Impact

- **Hard dependency:** `add-scheduled-tasks-api` must land first (or in the same PR stack) — at minimum `POST /api/v1/scheduled-tasks`, OpenAPI regen, and `apps/chat/src/server-api/scheduled-tasks.api.ts`.
- **Routes:** `apps/chat/src/types/routes.ts` (new `ScheduledTaskCreate` member), `apps/chat/src/app/app.tsx` (new lazy route).
- **Pages:** new `apps/chat/src/pages/ScheduledTaskCreatePage/`; `apps/chat/src/pages/ScheduledTasksPage/ScheduledTasksPage.tsx` updated to navigate instead of no-op.
- **Lib:** `libs/scheduled-tasks/src/components/ScheduledTaskCreateForm/` (new component + models), exported from `libs/scheduled-tasks/src/index.ts`.
- **App edge:** `apps/chat/src/server-api/scheduled-tasks.api.ts` (consumer of generated client — implemented by `add-scheduled-tasks-api`, called from the create page).
- **i18n:** `apps/chat/src/constants/translation-keys.ts`, `apps/chat/src/i18n/locales/*.json`.
- **Tests:** co-located Vitest specs for lib component, create page (including mocked API success/failure), and updated `ScheduledTasksPage.spec.tsx`.
- **Explicitly not included:** edit-existing-task flow, list cards populated after create, pause/resume/delete.

## Alternatives considered

- **UI-only form (previous iteration plan):** rejected now that the BFF create contract is known — shipping placeholder fields (description, generic frequency) would require a second form rewrite.
- **Flat `/scheduled-task-editor` route:** rejected — create is a single-step form nested under `/scheduled-tasks/new` (see `design.md`).

## Rollback

Revert removes the create route, lib form component, list-page navigation wiring, and page tests. The list shell and BFF endpoints from `add-scheduled-tasks-api` are unaffected. No persisted client-side state beyond what the API stores upstream.
