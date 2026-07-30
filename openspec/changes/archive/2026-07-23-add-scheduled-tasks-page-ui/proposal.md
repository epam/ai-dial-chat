## Why

Product wants a dedicated **Scheduled Tasks** surface — a catalog-style page with header, toolbar, and grouped task cards — so navigation, layout, i18n, and RTL/responsive behavior can be validated in production before the backend contract for scheduled tasks exists. Shipping the shell now, gated behind a feature flag, decouples UI validation from backend readiness and avoids blocking on API design.

## What Changes

- New standalone route `/scheduled-tasks` with a lazy-loaded page, following the File Manager standalone-page pattern.
- New host-agnostic lib `libs/scheduled-tasks/` (`@epam/ai-dial-scheduled-tasks`) exposing a presentational `ScheduledTasks` root component: header (title + subtitle + "New task" primary action), toolbar (search input + sort control), and an empty-state content area. No task cards/list rows are rendered in this iteration — the lib only ever renders the empty state for `items`.
- New app adapter `apps/chat/src/pages/ScheduledTasksPage/ScheduledTasksPage.tsx` (+ optional thin `ScheduledTasksView` wrapper) wiring i18n and a no-op `onCreateClick` placeholder callback.
- New feature flag `features.scheduledTasksEnabled` (config registry + `FeatureKey` enum + `useFeatureFlag('scheduledTasksEnabled')`), gating: the sidebar nav item, and direct-URL access (redirect to `NotFound` when disabled). Defaults to `false`.
- `NAVIGATION_CONFIG` gains an optional per-item flag key and `Navigation.tsx` filters items by `useFeatureFlag` before rendering — this is a new capability for the navigation list (no existing entry is flag-gated today).
- New i18n keys under a `scheduledTasks` namespace in `en.json` (and mirrored placeholder keys in other locales), plus a `ScheduledTasksI18nKeys` enum in `translation-keys.ts`.
- **Explicitly not included**: any REST/BFF endpoints, `@epam/chat-api-client` usage, task cards/list rows, create/edit modals, task lifecycle actions (run/pause/delete), details panel, or telemetry.

## Capabilities

### New Capabilities

- `scheduled-tasks-page-ui`: The Scheduled Tasks page shell — route, lib component (header, toolbar, empty state), app adapter, and its own empty-state/i18n/RTL behavior. Covers everything rendered under `/scheduled-tasks` in this iteration.

### Modified Capabilities

- `navigation-routing`: Adds a new gated route (`/scheduled-tasks`) and introduces the first feature-flag-gated nav item, requiring `NAVIGATION_CONFIG`/`Navigation.tsx` to support conditional visibility (a new requirement — no existing nav entry is flag-gated).

Note: the new `features.scheduledTasksEnabled` flag itself is a registry/enum data addition, not a behavior change to `feature-flags-service` (its existing requirements — enum/registry parity, `isEnabled` semantics, `FeatureGuard` — already generically cover any new key) — no delta spec is needed for that capability.

## Impact

- **Frontend**: `apps/chat/src/app/app.tsx` (route registration), `apps/chat/src/types/routes.ts` (`ROUTES.ScheduledTasks`), `apps/chat/src/constants/navigation.ts`, `apps/chat/src/components/Navigation/Navigation.tsx`, `apps/chat/src/pages/ScheduledTasksPage/`, `apps/chat/src/constants/translation-keys.ts`, `apps/chat/src/i18n/locales/*.json`.
- **New lib**: `libs/scheduled-tasks/` (new Nx project, `@epam/ai-dial-scheduled-tasks`), plus `tsconfig.base.json` path alias.
- **Backend**: `apps/chat-api/src/app-config/config-registry/config-registry.constants.ts`, `apps/chat-api/src/app-config/feature-flags/feature-key.enum.ts` (registry entry + enum member only — no new endpoints, no controller/service changes).
- **No changes** to `@epam/chat-api-client`, OpenAPI spec, DIAL Core, or `@epam/ai-dial-typescript-sdk`.
