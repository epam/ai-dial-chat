## 1. Feature flag plumbing

- [x] 1.1 Add `features.scheduledTasksEnabled` entry to `apps/chat-api/src/app-config/config-registry/config-registry.constants.ts` (`type: 'feature'`, `valueType: 'boolean'`, `visibility: 'client'`, `defaultValue: false`, `envVar: 'SCHEDULED_TASKS_ENABLED'`, `allowedRolesEnvVar: 'SCHEDULED_TASKS_ENABLED_ROLES'`), mirroring `features.liveChatInteraction`.
- [x] 1.2 Add `ScheduledTasksEnabled = 'features.scheduledTasksEnabled'` to `FeatureKey` enum in `apps/chat-api/src/app-config/feature-flags/feature-key.enum.ts`.
- [x] 1.3 Add/extend `chat-api` unit tests asserting the new key resolves to `false` by default and `true` when `SCHEDULED_TASKS_ENABLED=true`, and that it is included in `getClientConfig()` output (client visibility).
- [x] 1.4 Run `npm exec nx lint chat-api` and `npm exec nx test chat-api`.

## 2. Scheduled Tasks lib scaffold

- [x] 2.1 Generate `libs/scheduled-tasks` as a new Nx `type:ui` library (`@epam/ai-dial-scheduled-tasks`), add the `tsconfig.base.json` path alias, and confirm `@nx/enforce-module-boundaries` allows only `chat-shared`/`ai-dial-ui-kit`/`@tabler/icons-react` imports.
- [x] 2.2 Implement `ScheduledTasks` root component (`libs/scheduled-tasks/src/components/ScheduledTasks/ScheduledTasks.tsx`): header (title, subtitle, create button), toolbar (search input, sort control), content region always rendering `PanelEmptyState` from `@epam/ai-dial-chat-shared`. Props per design.md: `texts`, `onCreateClick`, `searchQuery`/`onSearchQueryChange`, `sortKey`/`onSortChange`, optional `isLoading`.
- [x] 2.3 Apply Tailwind logical properties and `rtl:` mirroring for any directional icon (e.g. sort chevron); no `sm:`/`md:`/`lg:` breakpoint prefixes — use project `mobile`/`desktop` breakpoints if the layout needs to branch.
- [x] 2.4 Add AAA a11y attributes: labeled search input, `aria-expanded`/`aria-selected` (or `aria-current`) on the sort control, `aria-hidden` on decorative icons already paired with a label.
- [x] 2.5 Write co-located Vitest specs (`libs/scheduled-tasks/src/components/ScheduledTasks/tests/ScheduledTasks.spec.tsx`) covering: header/toolbar render from props, empty state always shown regardless of `searchQuery`/`sortKey`, `onCreateClick` invoked on click, no host-integration imports.
- [x] 2.6 Run `npm exec nx lint scheduled-tasks` and `npm exec nx test scheduled-tasks`.

## 3. Route, nav gating, i18n, RTL

- [x] 3.1 Add `ScheduledTasks = '/scheduled-tasks'` to `ROUTES` enum in `apps/chat/src/types/routes.ts`.
- [x] 3.2 Create `apps/chat/src/pages/ScheduledTasksPage/ScheduledTasksPage.tsx`: reads `useFeatureFlag('scheduledTasksEnabled')`, renders `NotFound` content when `false`, otherwise wires `useTranslation`, local `searchQuery`/`sortKey` state, and a no-op `onCreateClick`, and renders `<ScheduledTasks />` from `@epam/ai-dial-scheduled-tasks`.
- [x] 3.3 Register the lazy-loaded route in `apps/chat/src/app/app.tsx` using the `RouteErrorBoundary` + `Suspense` + `RouteFallback` pattern (see `DialFileManagerPage` registration).
- [x] 3.4 Extend `NavigationItem` in `apps/chat/src/constants/navigation.ts` with an optional `featureFlag?: string` field; add a `ScheduledTasks` entry pointing at `ROUTES.ScheduledTasks` with `featureFlag: 'scheduledTasksEnabled'`.
- [x] 3.5 Update `apps/chat/src/components/Navigation/Navigation.tsx` to filter `NAVIGATION_CONFIG` by the flag before mapping to buttons (ungated items always render); also updated `apps/chat/src/components/MobileNavBottomSheet/NavPageContent.tsx`, which renders `NAVIGATION_CONFIG` independently for the mobile bottom sheet and needed the same gating.
- [x] 3.6 Add `ScheduledTasksI18nKeys` enum to `apps/chat/src/constants/translation-keys.ts` and the corresponding `scheduledTasks.*` keys to `apps/chat/src/i18n/locales/en.json` (title, subtitle, navLabel, toolbar search placeholder, toolbar sort label + options, empty-state label).
- [x] 3.7 N/A — only `en.json` exists in this repo today (no other locale files registered in `i18n/config.ts` yet), so there is nothing to mirror. RTL infra (dir-switching, logical classes) is already in place for when a locale is added.
- [x] 3.8 RTL: header/toolbar/empty-state use logical Tailwind classes throughout (no hardcoded `left/right`), and the sort chevron icon has `rtl:scale-x-[-1]`; verified by code review since no RTL locale file exists yet to toggle live.
- [x] 3.9 Write co-located tests: `Navigation.spec.tsx` cases for flag-gated item hidden/shown/ungated-unaffected; `ScheduledTasksPage.spec.tsx` for flag-off → NotFound content, flag-on → page renders, flag queried by short key.
- [x] 3.10 Run `npm exec nx lint chat` and `npm exec nx test chat`.

## 4. Verification

- [x] 4.1 Run `npm exec nx affected --target=lint --base=origin/development-1.0` and `npm exec nx affected --target=test --base=origin/development-1.0` and fix any regressions.
- [x] 4.2 Manually verify in the running app (`npm run start:all`): with `SCHEDULED_TASKS_ENABLED` unset/false, no nav item and direct navigation to `/scheduled-tasks` shows the 404 state; with `SCHEDULED_TASKS_ENABLED=true`, nav item appears, page renders header/toolbar/empty-state, create button is keyboard-reachable and clickable with no console errors. Verified by the user directly against their own running dev servers.
- [x] 4.3 Confirm no hand-authored file under `libs/scheduled-tasks` imports host/integration modules (grep for `apps/chat`, `chat-api-client`, `server-api`, routing, feature-flag, auth, env, analytics imports) — confirmed clean.
