## Why

The Figma design for the Settings page (node 1106-189) shows a vertical sidebar nav panel —
icon + label rows under a "SETTINGS" header, with the active row highlighted — not the horizontal
`Tabs` (2.0) strip that `settings-usage-page` shipped as a placeholder. `settings-usage-page`
explicitly deferred visual design ("routing/shell/hook only") and any Settings tab beyond `Usage`.
This change delivers the actual panel layout from the design and extracts the panel itself as a
presentational, host-agnostic component so it can be unit-tested and reused without pulling in
`apps/chat`'s routing/i18n/data-fetching concerns.

## What Changes

- Add a new hand-authored library `libs/settings-panel` (npm name
  `@epam/ai-dial-settings-panel`, Nx tag `"type:ui"` — matching `libs/share`/`libs/prompts`/
  `libs/prompt-editor`, not `libs/conversation-input`'s looser `"publishable"` tag) containing one
  presentational component: a vertical nav list with a section header, icon + label rows, and
  active-row highlighting. Props-only: `items`, `activeId`, `onSelect`, optional `sectionLabel` —
  no i18n, no API calls, no routing, no host-specific icon choices (icons passed in as `ReactNode`
  per item, following the `SelectedToolsChips` pattern in `libs/conversation-input`).
- Register the lib in `tsconfig.base.json` path aliases and wire its `package.json`
  `peerDependencies` to `react`, `@epam/ai-dial-chat-shared`, `@epam/ai-dial-ui-kit`,
  `@tabler/icons-react` only (no dependency on other libs, matching the `libs/share` reference
  rather than `libs/conversation-input`, which additionally depends on `attachment-input`).
- Replace the horizontal `Tabs` (2.0) usage in `apps/chat/src/pages/SettingsPage/SettingsPage.tsx`
  with the new panel component. `SettingsPage` keeps owning `activeTab` state, routing, and i18n —
  it resolves the panel's `items` (label text, icon element, disabled flag) from
  `useSettingsTabConfig` and passes them down as props.
- Extend `SettingsTabs` (`apps/chat/src/types/settings-tabs.ts`) and
  `useSettingsTabConfig` with two additional entries, `General` and `Preferences`, rendered as
  **visible but disabled** placeholder rows (no route, no content, no `Component`) — matching the
  Figma layout without building any real functionality for them. Only `Usage` remains selectable.
- No changes to routing, the `useUsageData` hook, the backend, or `UserMenu`'s gear entry point —
  those are unchanged from `settings-usage-page`.

**Not breaking**: additive/replacement within the still-unarchived `settings-usage-page` surface;
no persisted state or public API affected. Rollback is a revert; the previous `Tabs`-based
`SettingsPage` can be restored from git history if needed.

## Capabilities

### New Capabilities

- `settings-panel-lib`: the new `libs/settings-panel` presentational component (item list,
  active-row highlighting, keyboard navigation) and its lib scaffolding (package.json, tsconfig,
  path alias, isolation boundary).

### Modified Capabilities

- `settings-page-shell` (from `settings-usage-page`): replaces the horizontal `Tabs`-based layout
  with the new sidebar panel, and adds `General`/`Preferences` as disabled placeholder tabs.

## Impact

- **New**: `libs/settings-panel/**` (component, tests, package.json, tsconfig, README), a
  `tsconfig.base.json` path-alias entry.
- **Modified**: `apps/chat/src/pages/SettingsPage/SettingsPage.tsx` (swaps `Tabs` for the new
  panel), `apps/chat/src/hooks/useSettingsTabConfig.ts` and
  `apps/chat/src/types/settings-tabs.ts` (add `General`/`Preferences` disabled entries), i18n
  locale additions for the two new (disabled) labels and the "SETTINGS" section header.
- **No backend changes.**
- **Library isolation note**: this is the first `libs/*` addition in this change set. Per
  `AGENTS.md` §Library isolation, the panel takes all host-specific values (labels, icons, active
  id, disabled state, click handling) as props — it never imports i18n, routing, or
  `apps/chat/src/server-api/*`. **Caveat found during investigation**: the repo's
  `@nx/enforce-module-boundaries` ESLint rule (`eslint.config.mjs`) currently uses a wildcard
  constraint (`sourceTag: '*' → onlyDependOnLibsWithTags: ['*']`) — it does **not** actually lint-
  enforce "`type:ui` may only depend on `chat-shared`". That boundary is presently a documented
  convention (`AGENTS.md`) plus observed practice in `libs/share`/`libs/prompts`, not a lint gate.
  This proposal follows the convention regardless but flags the gap; tightening the lint rule
  itself is out of scope here.
- **i18n**: yes — new keys for "General" and "Preferences" labels and the "SETTINGS" section
  header; both new labels are rendered but their rows are disabled (no navigable content yet).

## Non-Goals (carried over / clarified)

- No real "General" or "Preferences" page/content — placeholder, disabled rows only.
- No change to `useUsageData`, the backend endpoints, or the empty `UsageTab` content.
- No lint-rule tightening of `@nx/enforce-module-boundaries` for `type:ui` tags (documented as a
  gap, not fixed here).
