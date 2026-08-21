## Why

The Usage settings page currently shows only the three aggregate cost-limit cards (Today/This week/This month). Users cannot see how each individual accessible model is consuming its own token, request, and cost budgets, or which models are close to or past a limit. The design calls for a "Model limits" table below the cards that answers this per model, using the same `GET /api/v1/user/usage` payload the page already fetches.

**Data-source correction**: an earlier draft of this proposal specified `limits.deployments` (from `GET /api/v1/user/limits`) as the source, reasoning that `usage.deployments` (from `GET /api/v1/user/usage`) omits models unused in the trailing 30 days. Confirmed against real production payloads, `usage.deployments` already carries every stat field this table needs (`minute`/`day`/`week`/`month` Cost/Token stats, `hour`/`day` Request stats) for every model the caller has actually exercised, which is what the table needs to show — so the adapter reads `usage.deployments` instead. This does mean a model the caller has never used will not appear as a zero-usage row; that trade-off is accepted in exchange for not adding a second per-model data source to reconcile.

**Second correction — drop the limits fetch entirely**: `GET /api/v1/user/usage`'s top-level `dayCostStats`/`weekCostStats`/`monthCostStats` fields (confirmed against real payloads) already carry the same real global cost budget `GET /api/v1/user/limits` would report — the two endpoints are redundant for this page's needs. `useUsageData` (and the `usage-data-hook` capability it belongs to) is therefore simplified to call only `getUserUsage()`. This removes the `limits`/`limitsError` fields from the hook's return shape and collapses the previous partial-vs-full-failure notification distinction to a single failure mode.

**Third correction — expose every period the upstream data actually has**: the per-deployment stats include `minute*Stats` (Cost/Tokens) and `hourRequestStats` in addition to day/week/month — real, non-sentinel limits the table was not previously surfacing. The period selector is extended from three options to five: Last minute, Last hour, Last 24 hours, Last 7 days, Last 30 days. Cost/Tokens have no hour-level field (Unavailable for "Last hour"); Requests have no minute/week/month-level field (Unavailable for those periods) — the existing Unavailable-cell contract already covers this, just extended to two more periods.

## What Changes

- Add a presentational "Model limits" section to `@epam/ai-dial-usage-dashboard` (`libs/usage-dashboard`): a heading with model count, a controlled period selector (Last minute / Last hour / Last 24 hours / Last 7 days / Last 30 days), and a table with Item, Cost, Tokens, Requests, and Status columns — one row per model present in the fetched usage data.
- Add normalized public types for a model-limit row: model identity (id, name, version, avatar), one metric cell per column (finite/unlimited/unavailable variants), a per-metric status enum, and a period enum — all free of Core DTO field names and the `2**53` sentinel.
- Add an app-level adapter (`apps/chat`) that reads `usage.deployments` (already fetched by the existing `useUsageData` hook — no new API call), joins deployment IDs with model/catalog metadata, maps the selected period to the correct `*Stats` fields, detects finite/unlimited/unavailable per metric, computes per-metric and per-row status, and formats all display and accessible-label strings.
- Own the selected period as app-level state (`UsageTab` or a small app-level hook); switching it re-derives view-model rows from already-fetched data and triggers no new request.
- Integrate the new section below `UsageLimitCardGroup` in `UsageTab`, reusing the existing loading/error/notification behavior from the prior Usage proposal without emitting duplicate notifications.
- Reuse the UI-kit `ProgressBar` and other public UI-kit 2.0 primitives for progress, badges, and the period control; do not import `libs/catalog`'s private `Limits` tab or its component into the usage-dashboard library.
- **BREAKING**: none — purely additive to the existing library's public API and to `UsageTab`'s rendered output.

## Capabilities

### New Capabilities

- `usage-model-limits`: the Usage page's per-model "Model limits" adapter and integration — app-owned period state, `usage.deployments` interpretation, model-metadata joining, per-metric/per-row status derivation, formatting, and `UsageTab` integration below the aggregate cards.

### Modified Capabilities

- `usage-dashboard-lib`: adds the presentational "Model limits" section (component(s), normalized types, status enum, five-value period enum, styling/theming contract) to the library's existing public API, alongside the unchanged `UsageLimitCardGroup`/`UsageLimitCard` surface.
- `usage-data-hook`: `useUsageData` no longer calls `getUserLimits()` — it fetches only `getUserUsage()`. Its return shape drops `limits`/`limitsError`, and the previous partial-vs-full-failure notification distinction collapses to a single failure mode. The aggregate-card mapper (`map-usage-data-to-dashboard.ts`) reads its cost fields from `usage` directly, with no `limits ?? usage` fallback.

## Impact

- `libs/usage-dashboard/src/**`: new components, models, and styles for the Model limits section (five-period selector); updated `index.ts` exports; updated `README.md`.
- `apps/chat/src/hooks/useUsageData.ts`: simplified to a single `getUserUsage()` fetch; `UseUsageDataResult` drops `limits`/`limitsError`.
- `apps/chat/src/utils/map-usage-data-to-dashboard.ts`: drops the `limits` parameter and the `limits ?? usage` fallback.
- `apps/chat/src/pages/SettingsPage/UsageTab/UsageTab.tsx`: renders the new section below the cards; owns selected-period state; notification effect simplified to the single `usageError` path.
- `apps/chat/src/utils/map-user-usage-to-model-limits.ts`: app-level adapter mapping `usage.deployments` + model/catalog metadata → the library's normalized row type, across all five periods.
- `apps/chat/src/constants/translation-keys.ts` and `apps/chat/src/i18n/locales/en.json`: new localized strings (column headers, period labels including Last minute/Last hour, status/badge labels, unavailable/no-limit text, accessible labels); `PartialLoadError` removed as unreachable.
- No backend, OpenAPI, or generated-client changes — `GET /api/v1/user/usage` already returns everything this feature needs.
- `openspec/specs/usage-dashboard-lib/spec.md`: delta spec for the new section.
- `openspec/specs/usage-model-limits/spec.md` (new): delta spec for the adapter/integration capability.
- `openspec/specs/usage-data-hook/spec.md`: delta spec for the simplified single-fetch hook and notification contract.
