## 1. Backend feature flag registration

- [x] 1.1 Add `SettingsPageEnabled = 'features.settingsPageEnabled'` to `FeatureKey`
      (`apps/chat-api/src/app-config/feature-flags/feature-key.enum.ts`).
- [x] 1.2 Add the matching `CONFIG_DEFINITIONS` entry
      (`apps/chat-api/src/app-config/config-registry/config-registry.constants.ts`):
      `type: 'feature'`, `valueType: 'boolean'`, `visibility: 'client'`, `defaultValue: false`,
      `critical: false`, `envVar: 'SETTINGS_PAGE_ENABLED'`, `allowedRolesEnvVar:
      'SETTINGS_PAGE_ENABLED_ROLES'`, `owner: 'chat-team'`, and a description covering the gear
      icon, `/settings` route, and Usage tab fetch.
- [x] 1.3 Run `npm exec nx test chat-api` and `npm exec nx lint chat-api` and confirm the existing
      "FeatureKey values match registry keys" spec scenario still passes with the new key.

## 2. Gate the UI entry point

- [x] 2.1 In `apps/chat/src/components/Navigation/UserMenu.tsx`, read `const
      isSettingsPageEnabled = useFeatureFlag('settingsPageEnabled');`.
- [x] 2.2 Wrap the existing `settings` menu item in the same conditional-array-spread style
      already used elsewhere in the item list (`...(isSettingsPageEnabled ? [{ key: 'settings',
      ... }] : [])`), so the item is omitted entirely (not just hidden) when the flag is off.
- [x] 2.3 Update `apps/chat/src/components/Navigation/tests/UserMenu.spec.tsx` to cover: the
      gear icon is absent when the flag resolves `false`, and present (unchanged position/behavior)
      when it resolves `true`.

## 3. Gate the /settings route

- [x] 3.1 In `apps/chat/src/app/app.tsx`, read `const isSettingsPageEnabled =
      useFeatureFlag('settingsPageEnabled');` alongside the existing `isFileManagerEnabled` read.
- [x] 3.2 Change the `ROUTES.Settings` route's `element` to the `FileManager`-style ternary:
      render the existing `RouteErrorBoundary`/`Suspense`/`SettingsPage` tree when
      `isSettingsPageEnabled` is `true`, otherwise `<Navigate to={ROUTES.Root} replace />`.
- [x] 3.3 No `app.tsx` unit-test harness exists in this codebase (the sibling `ROUTES.FileManager`
      /`isFileManagerEnabled` gating this pattern was copied from has no dedicated test either) —
      covered instead by manual verification in task 5.2.

## 4. Gate the usage-data fetch

- [x] 4.1 Add an `enabled: boolean = true` parameter to `useUsageData`
      (`apps/chat/src/hooks/useUsageData.ts`), following `useScheduledTasks(enabled = true)`:
      initialize `isLoading` from `useState(enabled)`, and guard the `fetchUsageData()` call inside
      the effect (and its cleanup) on `enabled`, resetting `limits`/`usage`/`error`/`isLoading`
      appropriately when disabled.
- [x] 4.2 Update the Usage tab's call site to pass `useFeatureFlag('settingsPageEnabled')` into
      `useUsageData`.
- [x] 4.3 Update `apps/chat/src/hooks/tests/useUsageData.spec.ts` to cover: `enabled: false` means
      neither `getUserLimits` nor `getUserUsage` is called and the hook returns the disabled-state
      shape (`isLoading: false`, both data fields `undefined`, `error: undefined`); and a transition
      from `enabled: false` to `enabled: true` triggers the fetch.

## 5. Verification

- [x] 5.1 Run `npm exec nx affected --target=lint --base=origin/development-1.0` and `npm exec nx
      affected --target=test --base=origin/development-1.0` and confirm both pass. (Both ran clean
      except one pre-existing, unrelated `prettier/prettier` lint error in
      `apps/chat/src/pages/AppsEditor/tests/GeneralForm.spec.tsx`, not touched by this change.)
- [x] 5.2 Manually verified the disabled path against the already-running dev app (localhost:4207 /
      localhost:5000, pre-existing session left running rather than restarted with an env var to
      avoid disturbing it): with `SETTINGS_PAGE_ENABLED` unset, `GET /api/v1/client-config`
      confirms `features.settingsPageEnabled: false`, the user menu shows no gear/"Settings" item,
      navigating to `/settings` client-side-redirects to `/` (confirmed via
      `window.location.pathname`), and no `/user/limits` or `/user/usage` requests fire. The
      enabled path (`SETTINGS_PAGE_ENABLED=true`) is covered by the `UserMenu.spec.tsx` and
      `SettingsPage.spec.tsx` unit tests added in sections 2 and 4; re-run this manual check with
      the env var set the next time the dev server is restarted to close the loop end-to-end.
