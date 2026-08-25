## Why

The Usage tab (`apps/chat/src/pages/SettingsPage/UsageTab/UsageTab.tsx:9-20`) is currently an empty
container — `useUsageData` (`apps/chat/src/hooks/useUsageData.ts:25-78`) already fetches
`GET /api/v1/user/limits` and `GET /api/v1/user/usage` but nothing renders the result. Users have no
visibility into their global cost budget until they hit a hard limit. The design supplied for this
change (superseding an earlier rougher mock) shows three independent cards — "Today", "This week",
"This month" — each with an always-visible status badge; the per-model table below them is a
separate, larger effort and stays out of scope.

## What Changes

- Add a new host-agnostic library `libs/usage-dashboard` (package `@epam/ai-dial-usage-dashboard`,
  Nx tag `type:ui`), scaffolded with the Nx generator appropriate for a buildable React/Vite/Vitest
  lib (confirmed via dry-run against `libs/settings-panel`'s inferred-target structure), exporting a
  presentational `UsageLimitCardGroup` component (and a standalone `UsageLimitCard`) plus their
  prop/label/color types. The library imports only `react`, `@epam/ai-dial-ui-kit`, and
  `@epam/ai-dial-chat-shared` — no server-api, generated client, i18n, routing, or app-context
  imports. `UsageLimitCardGroup` takes an ordered `cards: UsageLimitCardData[]` and renders each as
  its own independent, equally-sized box (stacked on mobile, side by side on desktop) — there is no
  shared container or divider between cards.
- Extend `useUsageData` (`apps/chat/src/hooks/useUsageData.ts`) to expose **per-request** failure
  state (`limitsError` / `usageError`) instead of the current single shared `error` field, so a
  consumer can tell which call failed and still render the other's data.
- Implement an app-level, pure mapper (`apps/chat/src/utils/map-usage-data-to-dashboard.ts`) that
  turns the raw `UserLimitStatsResponseDto` top-level `dayCostStats`/`weekCostStats`/`monthCostStats`
  fields into the library's normalized, preformatted (USD), ordered `UsageLimitCardData[]`. This
  mapper — not the library — owns the unlimited-sentinel check (`total >= 2**53`), the 75%/100%
  status thresholds, and USD formatting.
- Wire `UsageTab` to call `useUsageData`, run the mapper, render `UsageLimitCardGroup`, and show a
  loading state while `isLoading` is `true`.
- Add the Usage page header above the cards: a visible page title and a one-line description
  ("Cost, tokens and requests are metered independently — each can carry its own limit per day,
  week and month."), both localized and always rendered (independent of `isLoading`). The title is
  an `<h2>` — `SettingsPage` already owns the page's sole `<h1>` (currently `sr-only`, "Settings") —
  styled to read as the prominent page heading shown in the design.
- Add localized, deduplicated error notifications (via the existing `useNotification()` /
  `showErrorNotification` mechanism) when either or both of the two requests fail, without
  discarding whichever half of the data did resolve.
- Add new i18n keys under a new `UsageI18nKeys` enum in `apps/chat/src/constants/translation-keys.ts`
  and `apps/chat/src/i18n/locales/en.json`.
- Update `docs/architecture.md`'s library table to list the new library.
- **No** backend/Swagger/OpenAPI/generated-client changes, no new endpoints, no new React Context,
  no polling/caching changes, no per-model table.

### Revision note (superseded earlier design)

An earlier design iteration (two cards sharing one container with a divider, remaining-amount as
the prominent figure, badge hidden for the default status) was implemented first and then revised
in this same change once a more complete design reference was supplied. See design.md §D13 for the
full rationale; the current requirements below reflect the final (three-card) design only.

## Capabilities

### New Capabilities

- `usage-dashboard-lib`: The host-agnostic `@epam/ai-dial-usage-dashboard` library's public
  components, props, color/typography override contract, status-threshold semantics, and
  accessibility behavior for the two aggregate cost-limit cards.

### Modified Capabilities

- `usage-data-hook`: Replaces the current "No new library or client duplication" requirement (which
  stated no `libs/*` package would be created for this data) with a requirement describing the
  `apps/chat` ↔ `libs/usage-dashboard` split, and adds per-request error state
  (`limitsError`/`usageError`) plus the deduplicated error-notification behavior, replacing the
  current single-`error` requirement.
- `settings-page-shell`: Only if needed — clarify that the `Usage` tab now renders visible content
  (the two cards) rather than the empty container, if the shell spec asserts emptiness anywhere
  beyond `usage-data-hook`'s own "Empty Usage tab container" requirement (which lives in
  `usage-data-hook`, not `settings-page-shell` — see `openspec/specs/usage-data-hook/spec.md:11-20`).
  Verified during design: no change expected here since the shell spec only governs tab
  registration/routing, not tab content.

## Impact

- **New**: `libs/usage-dashboard/**`, `apps/chat/src/utils/map-usage-data-to-dashboard.ts`, new
  i18n keys, `docs/architecture.md` library table row.
- **Modified**: `apps/chat/src/hooks/useUsageData.ts` (per-request error state),
  `apps/chat/src/pages/SettingsPage/UsageTab/UsageTab.tsx` (renders the cards instead of an empty
  container), `apps/chat/src/constants/translation-keys.ts`,
  `apps/chat/src/i18n/locales/en.json`, `openspec/specs/usage-data-hook/spec.md` (delta).
- **Unaffected**: `apps/chat-api/**`, `libs/chat-api-client/**`, routing, feature flags, the
  per-model table (future change).
