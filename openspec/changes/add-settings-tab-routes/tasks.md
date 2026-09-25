**Slicing strategy: vertical.** The route and the page that reads it are one path through the stack
and land together (group 2) — a route nothing reads, or a page reading a segment no route supplies,
is not independently verifiable. Group 3 then hangs the popover link off the finished route.

**Sequencing:** land this only after `add-settings-preferences-tab` is archived. The two are disjoint
by file — that change edits `useSettingsTabConfig.tsx` and is fenced off `SettingsPage.tsx`; this one
edits `SettingsPage.tsx` and the route table and must not touch the tab config — but its tab tests
are the ones that would catch a bad merge.

## 1. Route vocabulary

- [x] 1.1 Add `SettingsTab = '/settings/:tab'` to the `ROUTES` enum in
      `apps/chat/src/types/routes.ts`, directly after the existing `Settings` member, with a JSDoc
      noting it is a pattern rather than a navigable URL — matching `ScheduledTaskDetail`. Do **not**
      add one member per tab.
- [x] 1.2 Add a `buildSettingsTabPath(tab: SettingsTabs): string` helper beside the enum, returning
      the concrete path for a tab. Give it JSDoc per the app conventions.
- [x] 1.3 Add a spec at `apps/chat/src/types/tests/routes.spec.ts` (or the app's existing utils
      tests folder, whichever matches where 1.2 landed) asserting that every `SettingsTabs` member
      round-trips through `buildSettingsTabPath` and back to the same member — the guard that fails
      if a future tab id is not URL-safe.

  **Verification:** `npm run test:file -- <the spec file added in 1.3>`

## 2. Routing the Settings shell

- [x] 2.1 Register `ROUTES.SettingsTab` alongside the existing `ROUTES.Settings` entry — in
      `apps/chat/src/app/settings-routes.tsx`, which `app.tsx` spreads into its `<Routes>` (design
      Decision 7) — reusing the same lazy `SettingsPage`, `RouteErrorBoundary`,
      `Suspense`/`RouteFallback` wrapping, and applying the `SettingsPageEnabled` gate to **both**
      entries so no settings path mounts the chunk while the flag is off.
- [x] 2.2 Change the `ROUTES.Settings` element to `<Navigate replace />` to the default tab's path,
      keeping it behind the same flag gate.
- [x] 2.3 In `apps/chat/src/pages/SettingsPage/SettingsPage.tsx`, delete the `useState` selection
      and read the tab from `useParams`, resolving it against the ids `useSettingsTabConfig`
      returned rather than against the `SettingsTabs` enum. Do not add an effect that mirrors the
      URL into state.
- [x] 2.4 Make `onSelect` navigate to `buildSettingsTabPath(id)` with a normal push, so Back steps
      between tabs.
- [x] 2.5 Redirect an unresolvable segment with `<Navigate replace />` to the default tab's path,
      where the default is the first entry of `items`. Guard the empty-`items` case so it renders
      the existing empty state instead of navigating — a redirect with no valid target would loop.
- [x] 2.6 Confirm no change was needed in `apps/chat/src/hooks/useSettingsTabConfig.tsx` or
      `libs/settings-panel`; if either seems to need one, stop and re-check against the
      `add-settings-preferences-tab` change before editing.
- [x] 2.7 Add or extend `apps/chat/src/pages/SettingsPage/tests/SettingsPage.spec.tsx`: the route
      segment decides the rendered tab; selecting a tab navigates; an unknown segment redirects to
      the default; a segment whose config entry is absent redirects; an empty config renders the
      empty state without navigating. Query by role, label, and text.
- [x] 2.8 Cover the route gating. The app has no route tests to extend, and mounting `app.tsx` for
      this would be disproportionate, so the route pair moved into `apps/chat/src/app/settings-routes.tsx`
      (design Decision 7) and is covered there: every settings path mounts the shell with the flag
      off, and redirects to `ROUTES.Root` without mounting it when the flag is on.

  **Verification:**
  `npm run test:file -- apps/chat/src/pages/SettingsPage/tests/SettingsPage.spec.tsx`
  `npm run test:file -- <the app route spec touched in 2.8>`
  `npm run verify:changed`

## 3. The popover's link to full usage

- [x] 3.1 Add the link label to `apps/chat/src/i18n/locales/en.json` under
      `conversationInput.usageLimits` and mirror it in `ConversationInputI18nKeys` in
      `apps/chat/src/constants/translation-keys.ts`.
- [x] 3.2 Pass a `footerNote` to `<LimitsTab>` in
      `apps/chat/src/components/UsageLimitsControl/UsageLimitsControl.tsx`: a `react-router` `<Link>`
      to `buildSettingsTabPath(SettingsTabs.Usage)` carrying the translated label, closing the
      popover on activation.
- [x] 3.3 Architecture guard: confirm `libs/catalog` gained nothing — no router import, no settings
      path, no new prop on `LimitsTab`. The link is an app-built `ReactNode` through the prop that
      already exists.
- [x] 3.4 Extend
      `apps/chat/src/components/UsageLimitsControl/tests/UsageLimitsControl.spec.tsx`: the footer
      link renders with the Usage tab's path as its target, and activating it dismisses the popover.

  **Verification:**
  `npm run test:file -- apps/chat/src/components/UsageLimitsControl/tests/UsageLimitsControl.spec.tsx`
  `npm run verify:changed`

## 4. RTL and accessibility

- [x] 4.1 Check the footer link for logical properties only, and confirm it is a real `<a>` through
      `<Link>` rather than a click-handling `<div>`, so it is keyboard-reachable and announces as a
      link.
- [x] 4.2 Confirm focus behaviour on navigation: the popover closing must not strand focus on a
      removed node.

  **Verification:**
  `npm run test:file -- apps/chat/src/components/UsageLimitsControl/tests/UsageLimitsControl.spec.tsx`

## 5. Documentation

- [x] 5.1 Update `docs/architecture.md` for the new `ROUTES` member and the settings route shape —
      `AGENTS.md` requires it in the same change for any `ROUTES` enum or route-folder change.
- [x] 5.2 Check whether `docs/technical-requirements.md` describes the Settings page or the usage
      popover's reach to full usage, and update the sentence if so.

  **Verification:** `npm run validate:docs`

## 6. Close out

- [x] 6.1 Run `npm run verify:full` once and fix anything it surfaces that belongs to this change.
- [x] 6.2 Confirm the merge boundary held: `git diff` shows no change to
      `apps/chat/src/hooks/useSettingsTabConfig.tsx` or `libs/settings-panel`.
