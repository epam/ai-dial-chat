## Why

Settings → Usage currently makes users switch a five-option period selector to compare one model's
limits over time. This hides the relationship between the three actionable rolling windows and
also dedicates separate columns to Cost, Tokens, and Requests even though the requested comparison
is Tokens plus Cost for the same period.

## Problem

`UsageTab` owns a selected period (`apps/chat/src/pages/SettingsPage/UsageTab/UsageTab.tsx:30`) and
re-maps every row when it changes, while `ModelLimitsSection` renders the selector and the separate
Cost/Tokens/Requests columns (`libs/usage-dashboard/src/components/ModelLimitsSection/ModelLimitsSection.tsx:92`,
`libs/usage-dashboard/src/components/ModelLimitsSection/ModelLimitsSection.tsx:138`). A user cannot
compare Last 24 hours, Last 7 days, and Last 30 days without repeatedly changing the filter, and the
single Status cell only describes the currently selected window.

## What Changes

- Replace the period-filtered table with one table whose fixed columns are Item, Last 24 hours,
  Last 7 days, Last 30 days, and Status.
- Remove the Last minute / Last hour / Last 24 hours / Last 7 days / Last 30 days segmented period
  selector and remove selected-period state from `UsageTab`.
- In each period column, show the existing token used/total progress treatment followed by the
  formatted attributed cost and `spent` caption for that same rolling window. The Cost sublabel and
  per-model Cost limit are not shown; Requests are no longer displayed in this table.
- When a model has no finite token cap for a period, show `Follows cost limit` and evaluate that
  period against the matching top-level user Cost limit used by the aggregate cards.
- Derive the row Status from the most severe model-token or overall Cost status across all three
  displayed windows: Limit reached > Running low > Within limits; unlimited/unavailable fallbacks
  keep their existing meaning when no finite status exists.
- Rename the section to `Model tokens limits`, keep its dynamic row count, and show a status icon in
  each affected period header when the matching overall Cost limit is running low or reached. The
  icon tooltip explains the overall period Cost status and that a reached limit blocks all models.
- Include a deployment row when any usable Cost or Tokens stat has non-zero usage in at least one of
  the three displayed windows. Keep the section and its existing empty state when no row qualifies.
- Keep the existing aggregate Today / This week / This month cards above the table unchanged.
- **BREAKING**: change the public `@epam/ai-dial-usage-dashboard` `ModelLimitRow`,
  `ModelLimitsLabels`, and `ModelLimitsSectionProps` contracts by replacing selected-period and
  separate metric fields with fixed per-period cells.

## Solution

Use a fixed, comparison-oriented row model. The app-level adapter continues to interpret
`UserLimitStatsResponseDto`, format amounts, resolve deployment metadata, and derive statuses; the
host-agnostic library receives only three normalized period cells and renders them. This follows
the existing boundary in `apps/chat/src/utils/map-user-usage-to-model-limits.ts:193` and the existing
responsive table-row pattern in
`libs/usage-dashboard/src/components/ModelLimitsSection/ModelLimitsRow.tsx:84`.

Each period cell contains a Tokens block (used/total plus progress, `Follows cost limit`, or Not
available) followed by a formatted attributed cost amount with the `spent` caption (or Not
available), without a visible Cost sublabel or per-model Cost limit. The app derives overall Cost
statuses from the same top-level stats as the aggregate cards and passes normalized header statuses,
tooltips, supporting labels, and row statuses into the library. On
desktop the five columns remain aligned and every cell's content is vertically centered within the
row without changing its horizontal alignment. On mobile each model becomes a stacked card-like
row, so the table does not require horizontal page scrolling at 360px.

## Non-goals

- Changing `GET /api/v1/user/usage`, generated API DTOs, fetching, caching, or error notifications.
- Removing or redesigning the aggregate Usage cards.
- Adding minute/hour columns, Requests data, sorting, pagination, or a user-selectable period.
- Changing the 75% Running low and 100% Limit reached thresholds.

## Alternatives Considered

- Keep the selector and add a compact comparison popover: rejected because the three windows would
  still not be visible together or keyboard/screen-reader comparable as table columns.
- Keep Cost, Tokens, and Requests columns and add three period sub-rows per model: rejected because
  it triples row height and preserves a metric (Requests) outside the requested scope.
- Selected approach — fixed period columns containing Tokens and Cost — gives direct comparison with
  one row per model and reuses the current normalized metric/progress rendering.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `usage-model-limits`: replace selected-period state/mapping/filtering with fixed 24-hour, 7-day,
  and 30-day period data plus a status aggregated across those windows.
- `usage-dashboard-lib`: replace the controlled period-selector table contract and layout with a
  fixed five-column responsive comparison table.

## Acceptance Criteria

- Settings → Usage shows exactly one Model tokens limits table with Item, Last 24 hours, Last 7 days, Last
  30 days, and Status columns and no period selector.
- Every period cell shows token usage using the finite/unlimited/unavailable treatment, then the
  formatted attributed cost plus `spent` for that period, without a visible Cost sublabel or
  per-model Cost limit; a finite token progress bar sits between the token value and Cost line.
- An unlimited model-token period shows `Follows cost limit` when the matching overall Cost limit is
  finite, and the period header shows an accessible running-low/reached icon with the supplied
  tooltip when that overall Cost status requires attention.
- A row's Status reflects the most severe finite model-token or overall Cost status found across all
  three periods, independent of which period or metric has that status.
- Rows with no non-zero usable Cost or Tokens usage in any displayed period are absent; a zero-row
  result renders the existing section-level empty state.
- The layout remains usable without page-level horizontal overflow at 360px and preserves aligned
  columns at desktop widths; row content is vertically centered without changing horizontal text
  alignment; table semantics and progress-bar accessible values remain available.
- Existing Usage loading, error notification, aggregate cards, deployment identity enrichment, RTL,
  and feature-flag behavior remain unchanged.

## Impact

- App integration and mapper:
  `apps/chat/src/pages/SettingsPage/UsageTab/UsageTab.tsx`,
  `apps/chat/src/utils/map-user-usage-to-model-limits.ts`, their tests, and Usage i18n keys.
- Host-agnostic UI library:
  `libs/usage-dashboard/src/models/model-limits-props.ts`,
  `libs/usage-dashboard/src/components/ModelLimitsSection/**`, exports, tests, and README.
- Specs: `usage-model-limits` and `usage-dashboard-lib`.
- No backend, endpoint, generated-client, dependency, feature-flag, authorization, cache, telemetry,
  or rate-limit changes.
- i18n removes selector/Requests labels from this surface, changes the heading to `Model tokens
  limits`, and adds localized `spent`, `Follows cost limit`, and overall Cost-status tooltip text.
- Scope touches `libs/usage-dashboard`; all API field selection, currency formatting, locale
  resolution, icon URL resolution, and status thresholds stay in the app mapper and cross the
  boundary only as normalized props.

## Compatibility and Rollback

The UI change is intentionally breaking for direct consumers of `ModelLimitsSection`; all known
workspace call sites and README examples must migrate in the same change. There is no persisted
state or API migration. Rollback is a code-only revert restoring the previous row/label/props
contracts, selector state, and selected-period mapper signature.
