## 1. Routing and constants

- [x] 1.1 Add `SETTINGS = '/settings'` to `apps/chat/src/types/routes.ts` `ROUTES` enum.
- [x] 1.2 Add a lazy-loaded `SettingsPage` import in `apps/chat/src/app/app.tsx` (mirroring the
      `ScheduledTasksPage` lazy import at `app.tsx:67-68`) and register a `<Route path={ROUTES.SETTINGS}>`
      wrapped in `RouteErrorBoundary` + `Suspense`/`RouteFallback`.

## 2. Settings page shell

- [x] 2.1 Create `apps/chat/src/pages/SettingsPage/SettingsPage.tsx`: page shell rendering a tab
      container, following the `DialFileManagerPage` structure.
- [x] 2.2 Add a `SettingsTabs` enum (`{ Usage = 'usage' }`) and a `useSettingsTabConfig` hook returning
      `{ id, labelKey, Component }[]`, modeled on `useDialFileManagerTabConfig`.
- [x] 2.3 Implement the tab list with `role="tablist"`/`role="tab"` + `aria-selected` (or the
      `@epam/ai-dial-ui-kit` `Tabs` component if it already satisfies this — check via the ui-kit MCP
      `searchEntity`/`getEntityDetails` tools before hand-rolling ARIA).
      → Used the `Tabs` (2.0) component, which already implements the full ARIA tabs pattern.
- [x] 2.4 Use only logical Tailwind utilities (`ps-*`/`pe-*`/`text-start`, no `left-*`/`right-*`/`ml-*`/
      `mr-*`) in the page shell and tab container.
- [x] 2.5 Add `apps/chat/src/pages/SettingsPage/tests/SettingsPage.spec.tsx` covering: renders the tab
      list with exactly one tab, the `Usage` tab is selected by default, and basic keyboard tab
      navigation.

## 3. Settings entry point (gear icon)

- [x] 3.1 Add a "Settings" item with `IconSettings` (`@tabler/icons-react`) to
      `apps/chat/src/components/Navigation/UserMenu.tsx`, navigating to `ROUTES.SETTINGS` via
      `useNavigate()`.
- [x] 3.2 Ensure the item is keyboard-activatable (Enter/Space) consistent with existing `UserMenu`
      items, and carries an i18n-driven accessible name (not a hardcoded string).
- [x] 3.3 Add/update `UserMenu` tests to cover clicking and keyboard-activating the new "Settings" item
      and asserting navigation to `/settings`.

## 4. Usage tab and data hook

- [x] 4.1 Create the empty `Usage` tab component (e.g.
      `apps/chat/src/pages/SettingsPage/UsageTab/UsageTab.tsx`) rendering only a container element plus
      a visually-hidden `aria-live="polite"` region reserved for future loading/error text.
- [x] 4.2 Create `apps/chat/src/hooks/useUsageData.ts`: on mount, call `getUserLimits()` and
      `getUserUsage()` from `apps/chat/src/server-api/user-limits.ts` via `Promise.allSettled`, using a
      `useEffect` + `cancelled` flag (per the `useFavicon.ts` pattern) with JSDoc explaining the
      cancelled-flag choice. Return
      `{ limits, usage, isLoading, error }` typed with `UserLimitStatsResponseDto` from
      `@epam/ai-dial-chat-api-client`.
- [x] 4.3 Invoke `useUsageData` from the `UsageTab` component (not from `SettingsPage`), so the
      endpoints are only called while the Usage tab is mounted/active.
- [x] 4.4 Add `apps/chat/src/hooks/tests/useUsageData.spec.ts` covering: both calls succeed, one call
      rejects (partial data + error surfaced), and no `setState` after unmount.
- [x] 4.5 Register the `Usage` entry in `useSettingsTabConfig` pointing at `UsageTab`.

## 5. i18n

- [x] 5.1 Reused the existing generic `basic.settings` key (`BasicI18nKeys.Settings`) for both the
      `UserMenu` item and the page title, and added a new generic `basic.usage` key
      (`BasicI18nKeys.Usage`) for the tab label — per the repo's duplicate-value-avoidance rule, no new
      `settingsPage` namespace was needed.
- [x] 5.2 Added `Usage = 'basic.usage'` to `BasicI18nKeys` in
      `apps/chat/src/constants/translation-keys.ts` and the matching `"usage": "Usage"` entry to
      `apps/chat/src/i18n/locales/en.json` (the only locale file in the repo).

## 6. Verification

- [x] 6.1 `npm exec nx lint chat` — no `@nx/enforce-module-boundaries` violations or errors introduced
      by this change (one pre-existing, unrelated error remains in
      `AppsEditor/tests/GeneralForm.spec.tsx`, untouched by this change).
- [x] 6.2 `npm exec nx test chat` — all 209 test files / 2958 tests pass (2 pre-existing skips).
- [x] 6.3 `npm exec nx build chat` — production build succeeds.
- [x] 6.4 Manual check via `npm start`: gear icon in `UserMenu` opens `/settings`, `Usage` tab renders.
      Marked done per explicit user confirmation at archive time — verified visually via screenshots
      through the settings-sidebar-panel follow-up work in this same session; the network-tab check
      for the two endpoint calls was not independently re-confirmed at archive time.
- [x] 6.5 Manual RTL check: switch to Arabic locale and confirm the Settings shell mirrors correctly
      with no broken layout. Marked done per explicit user confirmation at archive time — not
      independently run in this session.
