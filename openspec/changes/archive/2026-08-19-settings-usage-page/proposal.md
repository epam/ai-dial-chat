## Why

PR #8365 (`feat(chat-api): integrate user limits and usage API endpoints`) added `GET /api/v1/user/limits`
and `GET /api/v1/user/usage`, and already exposes them through the generated client wrapper
`apps/chat/src/server-api/user-limits.ts` — but nothing in the frontend calls them yet. The product
needs a dedicated **Settings** area, entered via a gear icon, to eventually surface this usage data. This
change delivers the navigation, the tabbed page shell, and the data-fetching hook now, so a follow-up
task can drop in the Usage UI without any structural rework.

## What Changes

- Add a gear-icon entry point (in `UserMenu`, the only existing "settings-like" surface — see
  `apps/chat/src/components/Navigation/UserMenu.tsx:12-18` and its `settings` i18n namespace at
  `en.json:532-540`) that navigates to a new `/settings` route.
- Add a new lazy-loaded `SettingsPage` route (`apps/chat/src/pages/SettingsPage/SettingsPage.tsx`),
  following the existing lazy-route + `RouteErrorBoundary`/`Suspense` pattern used for
  `ScheduledTasksPage` (`apps/chat/src/app/app.tsx:63-106`, `:397-445`).
- Structure `SettingsPage` as a tab container modeled on the `DialFileManagerPage` tabs pattern
  (`DialFileManagerTabs` enum + `useDialFileManagerTabConfig`, see
  `apps/chat/src/pages/DialFileManagerPage/DialFileManagerPage.tsx:2-54`), with a `SettingsTabs` enum
  currently containing only `Usage`, so a second tab is a config addition, not a refactor.
- Add an empty `UsagePage`/`UsageTab` component that renders only a container (no content) and calls a
  new `useUsageData` hook on mount.
- Add `useUsageData` (`apps/chat/src/hooks/useUsageData.ts`), following the `useFavicon` pattern
  (`apps/chat/src/hooks/useFavicon.ts`: JSDoc, `useEffect` + cancelled flag, async/await) to call the
  existing `getUserLimits` / `getUserUsage` wrappers (`apps/chat/src/server-api/user-limits.ts:1-8`) in
  parallel, and expose `{ limits, usage, isLoading, error }`.
- Add route constants: extend `apps/chat/src/types/routes.ts` (`ROUTES` enum) with `SETTINGS`, and add a
  `getSettingsUsageRoute`-style helper next to `apps/chat/src/constants/routes.ts:59-63` if the Usage tab
  needs its own URL segment (e.g. `/settings/usage`).
- Add a new i18n namespace for the page itself (e.g. `settingsPage`) — the existing `settings` key at
  `en.json:532` is already owned by the `UserMenu` dropdown (language/theme/shortcuts) and must not be
  reused, to avoid key collisions.

**Not breaking**: purely additive (new route, new nav entry, new hook). Nothing existing is removed or
renamed. Rollback is a revert of this change set; no data migration or persisted state is introduced.

## Capabilities

### New Capabilities

- `settings-page-shell`: the `/settings` route, its gear-icon entry point, and the tab-container
  structure (currently one `Usage` tab) that future Settings tabs plug into without refactoring.
- `usage-data-hook`: the empty Usage tab/page and the `useUsageData` hook that fetches
  `GET /api/v1/user/limits` and `GET /api/v1/user/usage` on mount and exposes loading/error/data state.

### Modified Capabilities

_None._ `user-usage-limits-api` (the backend spec from PR #8365) is consumed as-is; no backend
requirement changes.

## Impact

- **New files**: `apps/chat/src/pages/SettingsPage/SettingsPage.tsx` (+tests), a `Usage`
  tab/page component, `apps/chat/src/hooks/useUsageData.ts` (+tests), i18n additions in
  `apps/chat/src/i18n/locales/*.json` (all locales, per repo i18n rules) and
  `apps/chat/src/constants/translation-keys.ts`.
- **Modified files**: `apps/chat/src/app/app.tsx` (new lazy route), `apps/chat/src/types/routes.ts`
  (new `ROUTES.SETTINGS`), `apps/chat/src/components/Navigation/UserMenu.tsx` (gear entry point).
- **No backend or libs/* changes.** `apps/chat/src/server-api/user-limits.ts` and the generated
  `UserApi`/`UserLimitStatsResponseDto` (`libs/chat-api-client`) already exist and are reused unchanged.
- **Library isolation note**: per `AGENTS.md` §Library isolation, `libs/*` may not import the generated
  API client or server-api wrappers. `useUsageData` therefore stays in `apps/chat/src/hooks/`
  (app layer), not in a lib — this matches the existing precedent that no domain hook wrapping
  `server-api/*` lives under `libs/*` today. If the Usage UI later needs a presentational
  component reused outside `apps/chat`, that component (not the data-fetching hook) is the
  candidate for extraction into a `type:ui` lib, taking data via props.
- **i18n**: yes — new user-visible strings for the Settings page shell (tab label, page title) and any
  placeholder/empty-state text on the Usage tab; no strings for the (out-of-scope) Usage content itself.
