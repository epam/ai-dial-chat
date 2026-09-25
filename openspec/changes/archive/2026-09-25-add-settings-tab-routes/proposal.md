## Why

Every Settings tab lives at the same URL. `SettingsPage` holds the active tab in local state
(`apps/chat/src/pages/SettingsPage/SettingsPage.tsx:12-14`), so `/settings` always opens on the
first tab and nothing can link to, bookmark, or return to a specific one. Reloading the page loses
the tab, and the browser's Back button steps out of Settings rather than back to the previous tab.

This became concrete while building the conversation-input usage popover. That popover now lists
only limits at or past 75% and hides itself entirely when everything is comfortable
(`conversation-input-usage-limits`), which makes a "see full usage" link the only way to reach the
complete picture from the chat — and there is no URL for it to point at. `/settings` would land the
user on whichever tab happens to be first and leave them to find Usage themselves.

## What Changes

- **Each Settings tab gets its own route.** `/settings/usage` and `/settings/preferences` render the
  Settings shell with that tab active. The tab is read from the URL rather than local state, so it
  survives reload, is linkable, and participates in browser history.
- **`/settings` redirects** to the default tab's route rather than rendering a tab of its own, so a
  single canonical URL exists per tab.
- **An unknown or disabled tab segment redirects** to the default tab rather than rendering an empty
  shell.
- **The usage popover gains its footer link** to `/settings/usage`, using `LimitsTab`'s existing
  `footerNote` prop. The link is app-owned; `libs/catalog` keeps knowing nothing about routes.
- The feature-flag gate on `/settings` is preserved unchanged for every new path.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `settings-page-shell`: the route requirement gains a per-tab path and a redirect rule, and the
  tab container reads its active tab from the route instead of local state.
- `conversation-input-usage-limits`: the popover gains a footer link to the Usage route.

## Non-goals

- **No change to which tabs exist.** This change routes whatever `useSettingsTabConfig` provides. The
  in-flight `add-settings-preferences-tab` change owns the Preferences tab itself; this one must
  merge cleanly with it and must not add, remove, or reorder tabs.
- **No nested sub-routes inside a tab** (e.g. `/settings/usage/2026-09`). One segment per tab.
- **No change to the Settings entry point** in the user menu beyond the URL it targets.
- **No deep-linking for any other page.**

## Acceptance criteria

1. Navigating directly to `/settings/usage` opens Settings with the Usage tab active.
2. Selecting a tab updates the URL, and the browser's Back button returns to the previously
   selected tab rather than leaving Settings.
3. Reloading on a tab's URL reopens that tab.
4. `/settings` redirects to the default tab's canonical URL.
5. `/settings/does-not-exist` redirects to the default tab rather than rendering an empty shell.
6. With `OverlayFeature.HideSettingsPage` resolving to `true`, every settings path redirects to
   `ROUTES.Root` and no `SettingsPage` chunk mounts.
7. The usage popover's footer link navigates to the Usage tab in one step.
8. `npm run verify:full` and `npm run validate:docs` pass.

## Alternatives considered

- **`?tab=usage` query parameter** — smaller diff and no route registration, but a query parameter
  reads as a filter rather than a location, does not compose with future nested routes, and leaves
  `/settings` ambiguous. Rejected; the user asked for real routes.
- **Keep local state and scroll the Usage tab into view from the link** — no URL change at all, but
  it solves only the one link and leaves reload, bookmarking, and history broken. Rejected.
- **Route each tab as a separate top-level path** (`/usage`, `/preferences`) — loses the Settings
  grouping in the URL and collides with the existing top-level namespace. Rejected.

## Rollback / backward compatibility

`/settings` keeps working: it redirects rather than 404s, so existing links, bookmarks, and the user
menu entry stay valid. No persisted state, no API surface, no stored schema. Reverting restores
local-state tabs; the only loss is the linkability this adds.

**Merge risk:** the in-flight `add-settings-preferences-tab` change touches
`useSettingsTabConfig.tsx` and its tasks explicitly say "Do not touch `SettingsPage.tsx`". This
change touches `SettingsPage.tsx` and the route registration but **not** `useSettingsTabConfig.tsx`,
so the two are disjoint by file. Land this one after that change is archived.

## Impact

- **Code:** `apps/chat/src/app/app.tsx` (route registration),
  `apps/chat/src/pages/SettingsPage/SettingsPage.tsx` (tab from route),
  `apps/chat/src/types/routes.ts` (new route members),
  `apps/chat/src/components/UsageLimitsControl/UsageLimitsControl.tsx` (footer link).
- **Not touched:** `apps/chat/src/hooks/useSettingsTabConfig.tsx`, `libs/settings-panel`,
  `libs/catalog`, `libs/chat-hooks`, any backend.
- **Library isolation:** `LimitsTab` receives the link as a `footerNote` ReactNode built by the app.
  The lib gains no route knowledge, no `react-router` import, and no new prop.
- **i18n:** one new user-visible string for the footer link label, under
  `conversationInput.usageLimits.*`, added to `en.json` and `ConversationInputI18nKeys`.
- **Docs:** `docs/architecture.md` lists route folders and the `ROUTES` enum, so it must be updated
  in the same change (see the Docs section of `AGENTS.md`).
