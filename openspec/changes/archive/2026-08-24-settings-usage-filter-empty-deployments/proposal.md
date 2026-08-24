## Why

The Settings → Usage "Model limits" table currently lists every deployment present in
`usage.deployments` regardless of whether it has any usage in the selected time period, so
switching to "Last 24 hours" (for example) still shows models that were only used a week or a
month ago, with every metric reading zero. This makes the table noisy and the period selector feel
ineffective. When the filtered result is empty, the page falls back to a plain, unstyled paragraph
instead of a real empty state, which is inconsistent with the empty-state pattern used elsewhere in
the app (`PanelEmptyState`).

## What Changes

- **BREAKING** (behavior, not API): rows whose Cost, Tokens, and Requests metrics are all zero (or
  all `unavailable`) for the *currently selected period* are no longer included in the Model
  limits table — a deployment must have nonzero usage in the selected period to appear. This
  reverses the previously specified "zero-usage deployment still appears" behavior for the selected
  period (a deployment with usage in a *different* period but none in the current one now drops
  out when that period is selected).
- Add a real empty-state UI, rendered by `ModelLimitsSection` itself (reusing the existing
  `PanelEmptyState` component from `@epam/ai-dial-chat-shared`, the same pattern used by
  `ScheduledTasks` and sidebar panels) whenever the Model limits table would render zero rows for
  the selected period — whether because `usage.deployments` itself is empty, or because every
  deployment was filtered out for having no usage in that period. The section's heading and period
  selector always stay visible and interactive, even when the table body is empty, so the user can
  still switch to a different period instead of being stuck with no way back to a period that has
  data. Replaces the current plain `<p>` fallback text in `UsageTab`, which previously hid the
  period selector along with the table whenever the row set was empty.
- The heading row count (`Model limits <N>`) reflects the post-filter row count, not the total
  number of deployments in `usage.deployments`.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `usage-model-limits`: the adapter (`mapUserUsageToModelLimits`) additionally filters out rows
  with no usage in the selected period, and `UsageTab` renders `ModelLimitsSection`
  unconditionally, no longer branching on row count itself.
- `usage-dashboard-lib`: `ModelLimitsSection` renders its own empty state (with a new required
  `ModelLimitsLabels.emptyStateLabel` and optional `emptyStateIconSize` prop) in place of the table
  body when `rows` is empty, while keeping its heading and period selector rendered and
  interactive; the library gains `@tabler/icons-react` as a peer dependency for the empty-state
  icon.

## Impact

- `apps/chat/src/utils/map-user-usage-to-model-limits.ts` — add per-period zero-usage filtering
  after row construction.
- `apps/chat/src/pages/SettingsPage/UsageTab/UsageTab.tsx` — render `ModelLimitsSection`
  unconditionally (remove the `modelLimitRows.length > 0` branch and the plain-text/`PanelEmptyState`
  fallback previously rendered in its place), passing `emptyStateLabel` through the existing
  `modelLimitsLabels` object.
- `apps/chat/src/constants/translation-keys.ts` and `apps/chat/src/i18n/locales/en.json` — the
  existing `ModelLimitsEmptyState` key is reused as `emptyStateLabel` (no new key required unless
  copy needs to change per empty-state cause).
- `libs/usage-dashboard/src/components/ModelLimitsSection/ModelLimitsSection.tsx` and
  `libs/usage-dashboard/src/models/model-limits-props.ts` — render `PanelEmptyState` (from
  `@epam/ai-dial-chat-shared`) in place of the column-header row and row group when `rows` is
  empty; add `ModelLimitsLabels.emptyStateLabel` (required) and
  `ModelLimitsSectionProps.emptyStateIconSize` (optional, default `48`).
- `libs/usage-dashboard/package.json` and `libs/usage-dashboard/README.md` — add
  `@tabler/icons-react` as a peer dependency and document the new prop/label.
- No changes to `libs/chat-api-client` / backend DTOs.
