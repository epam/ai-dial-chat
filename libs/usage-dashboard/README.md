# @epam/ai-dial-usage-dashboard

## Overview

Provides `UsageLimitCardGroup` and `UsageLimitCard`, presentational cards for a caller's aggregate
cost-budget usage over a calendar period (the current UTC day, week, and month), and
`ModelLimitsSection`, a presentational per-model comparison table with fixed Today / This week /
This month columns. Each period groups Tokens usage/progress with a compact attributed Cost line, and a final
Status reflects the host-derived result across model-token and overall Cost limits in all periods.
Overall Cost warning/reached indicators, their tooltips, and an optional preformatted reset-time
line are supplied for the matching period headers. All components are fully host-agnostic: they take already-normalized,
preformatted amounts, status enums, and localized labels via props — they never interpret raw API
data, format currency, detect the unlimited sentinel, or compute percentages themselves.
`UsageLimitCardGroup` renders each card as its own independent, equally-sized box: stacked on mobile,
side by side on desktop. `UsageLimitCard` is also exported standalone for a single-card use case.

### BREAKING — period properties renamed to calendar names

The three fixed periods are DIAL Core **calendar** windows anchored to UTC boundaries (UTC midnight,
UTC week start, UTC month start), not trailing windows of 24 hours, 7 days, or 30 days. The property
names were renamed accordingly; the old names are no longer exported or accepted.

| Type | Old property | New property |
| --- | --- | --- |
| `ModelLimitRow` | `last24Hours` | `day` |
| `ModelLimitRow` | `last7Days` | `week` |
| `ModelLimitRow` | `last30Days` | `month` |
| `ModelLimitPeriodStatuses` | `last24Hours` | `day` |
| `ModelLimitPeriodStatuses` | `last7Days` | `week` |
| `ModelLimitPeriodStatuses` | `last30Days` | `month` |
| `ModelLimitsLabels` | `last24HoursColumnLabel` | `dayColumnLabel` |
| `ModelLimitsLabels` | `last7DaysColumnLabel` | `weekColumnLabel` |
| `ModelLimitsLabels` | `last30DaysColumnLabel` | `monthColumnLabel` |

Column-label **values** should change with them — pass `Today` / `This week` / `This month` rather
than `Last 24 hours` / `Last 7 days` / `Last 30 days`.

`mapUsageDataToDashboard` also gained a required third parameter, `formatResetTime`; see
[Utilities](#utilities).

### Reset times

`UsageLimitCardData` and `ModelLimitPeriodStatus` each accept an optional trio of host-preformatted
reset-time strings — `resetLabel` (visible text), `resetIsoValue` (the machine-readable instant for
the rendered `<time dateTime>`), and `resetAriaLabel` (the spoken form, which should name the
timezone in full rather than as an offset). When `resetAriaLabel` is supplied the library renders it
on a visually-hidden sibling and marks the visible `<time>` `aria-hidden`, because `aria-label` is
not reliably supported on a bare `<time>`; with no `resetAriaLabel` the visible line is its own
accessible name. The library renders every string verbatim: it imports no `Intl`, accepts no locale, timezone, or raw timestamp, and never parses
or reformats a value. All three are absent together when the host could not format a reset time, in
which case the card or header renders exactly as it did before reset times existed. A card renders
its reset line even when `isUnlimited` is `true` — an unconfigured limit still accumulates spend
against a period that rolls over.

## Installation

```json
{
  "dependencies": {
    "@epam/ai-dial-usage-dashboard": "*"
  }
}
```

Import the stylesheet once in the consuming app:

```ts
import '@epam/ai-dial-usage-dashboard/styles.css';
```

## Peer Dependencies

- `react` ^19.2.7
- `@epam/ai-dial-chat-shared` \*
- `@epam/ai-dial-ui-kit`

## Components

### UsageLimitCardGroup

```tsx
import {
  UsageLimitCardGroup,
  UsageLimitStatus,
} from '@epam/ai-dial-usage-dashboard';

<UsageLimitCardGroup
  cards={[
    {
      title: 'Today',
      periodDescription: 'Today',
      used: 3.6,
      total: 4,
      usedLabel: '$3.60',
      totalLabel: '$4.00',
      remainingLabel: '$0.40',
      usedPercent: 90,
      status: UsageLimitStatus.RunningLow,
      progressAriaLabel: '$3.60 of $4.00, 90% used',
    },
    {
      title: 'This month',
      periodDescription: 'This month',
      used: 41,
      total: 120,
      usedLabel: '$41.00',
      totalLabel: '$120.00',
      remainingLabel: '$79.00',
      usedPercent: 34,
      status: UsageLimitStatus.Default,
      progressAriaLabel: '$41.00 of $120.00, 34% used',
      resetLabel: 'Resets Oct 1, 2026, 2:00 AM GMT+2',
      resetIsoValue: '2026-10-01T00:00:00Z',
      resetAriaLabel:
        'Usage resets Oct 1, 2026, 2:00 AM Central European Summer Time',
    },
  ]}
  labels={{
    defaultBadgeLabel: 'Within limits',
    runningLowBadgeLabel: 'Running low',
    limitReachedBadgeLabel: 'Limit reached',
    usedOfTotalLabel: ({ total }) => `used of ${total}`,
    remainingCaptionLabel: ({ remaining }) => `${remaining} left`,
    usedPercentLabel: ({ percent }) => `${percent}%`,
  }}
/>;
```

Pass `styles={{ colors, typography }}` to override the per-card background/accent colors or the
typography classes (applied as CSS custom properties and class overrides):

```tsx
<UsageLimitCardGroup
  cards={cards}
  labels={labels}
  styles={{ colors: { cardBackground: '#0e1320' } }}
/>
```

### UsageLimitCard

Renders a single card:

```tsx
import {
  UsageLimitCard,
  UsageLimitStatus,
} from '@epam/ai-dial-usage-dashboard';

<UsageLimitCard
  data={{
    title: 'Today',
    periodDescription: 'Today',
    used: 0.4,
    total: 4,
    usedLabel: '$0.40',
    totalLabel: '$4.00',
    remainingLabel: '$3.60',
    isUnlimited: false,
    usedPercent: 10,
    status: UsageLimitStatus.Default,
    progressAriaLabel: '$0.40 of $4.00, 10% used',
  }}
  labels={{
    defaultBadgeLabel: 'Within limits',
    runningLowBadgeLabel: 'Running low',
    limitReachedBadgeLabel: 'Limit reached',
    usedOfTotalLabel: ({ total }) => `used of ${total}`,
    remainingCaptionLabel: ({ remaining }) => `${remaining} left`,
    usedPercentLabel: ({ percent }) => `${percent}%`,
  }}
/>;
```

### ModelLimitsSection

Renders a "Model tokens limits" heading with the rendered row count and one fixed comparison table per
model: Item, Today, This week, This month, and Status. Every period cell contains Tokens
followed by an attributed Cost amount supplied by the host. Cost has no visible sublabel,
per-model limit, or progress bar; `costLabel` supplies screen-reader context. Overall Cost statuses
can add warning/reached icons with accessible tooltips to the period headers. Desktop row content is
vertically centered while preserving its existing horizontal alignment:

```tsx
import {
  ModelLimitMetricKind,
  ModelLimitsSection,
  ModelLimitStatus,
} from '@epam/ai-dial-usage-dashboard';

<ModelLimitsSection
  periodStatuses={{
    day: {
      status: ModelLimitStatus.LimitReached,
      tooltipLabel:
        "Overall cost limit for today is reached. Models can't be used until the period resets, regardless of remaining token limits.",
      resetLabel: 'Resets Sep 16, 2026, 2:00 AM GMT+2',
      resetIsoValue: '2026-09-16T00:00:00Z',
      resetAriaLabel:
        'Usage resets Sep 16, 2026, 2:00 AM Central European Summer Time',
    },
    week: { status: ModelLimitStatus.WithinLimits },
    month: { status: ModelLimitStatus.WithinLimits },
  }}
  rows={[
    {
      id: 'gpt-4o',
      name: 'GPT-4o',
      version: '2024-08-06',
      avatarSrc: 'https://example.com/gpt-4o.png',
      day: {
        tokens: {
          kind: ModelLimitMetricKind.Finite,
          usedLabel: '4K',
          totalLabel: '10K',
          usedPercent: 40,
          status: ModelLimitStatus.WithinLimits,
          ariaLabel: '4,000 of 10,000 tokens used, 40%',
        },
        cost: {
          kind: ModelLimitMetricKind.Unlimited,
          usedLabel: '$3.20 spent',
          ariaLabel: '$3.20 spent',
        },
      },
      week: {
        tokens: {
          kind: ModelLimitMetricKind.Finite,
          usedLabel: '52K',
          totalLabel: '70K',
          usedPercent: 74.3,
          status: ModelLimitStatus.WithinLimits,
          ariaLabel: '52,000 of 70,000 tokens used, 74%',
        },
        cost: {
          kind: ModelLimitMetricKind.Unlimited,
          usedLabel: '$18.60 spent',
          ariaLabel: '$18.60 spent',
        },
      },
      month: {
        tokens: {
          kind: ModelLimitMetricKind.Finite,
          usedLabel: '240K',
          totalLabel: '300K',
          usedPercent: 80,
          status: ModelLimitStatus.RunningLow,
          ariaLabel: '240,000 of 300,000 tokens used, 80%',
        },
        cost: {
          kind: ModelLimitMetricKind.Unlimited,
          usedLabel: '$55.10 spent',
          ariaLabel: '$55.10 spent',
        },
      },
      status: ModelLimitStatus.RunningLow,
    },
  ]}
  labels={{
    headingLabel: 'Model tokens limits',
    itemColumnLabel: 'Item',
    dayColumnLabel: 'Today',
    weekColumnLabel: 'This week',
    monthColumnLabel: 'This month',
    statusColumnLabel: 'Status',
    tokensLabel: 'Tokens',
    costLabel: 'Cost',
    modelTypeLabel: 'Model',
    noLimitLabel: 'No limit',
    unavailableLabel: 'Not available',
    withinLimitsBadgeLabel: 'Within limits',
    runningLowBadgeLabel: 'Running low',
    limitReachedBadgeLabel: 'Limit reached',
    noLimitBadgeLabel: 'No limit',
    unavailableBadgeLabel: 'Unavailable',
    emptyStateLabel: 'No models to show yet.',
  }}
/>;
```

`ModelLimitsSection` never fetches data or infers the unlimited sentinel, percentage, supporting
label, header status, tooltip, or row status. The host derives `kind`, `usedPercent`, and `status`
for every token/cost cell, supplies `Follows cost limit` through an unlimited token cell's optional
`supportingLabel`, and combines model-token plus overall Cost limits into the final row `status`.
Cost renders only its normalized attributed-spend `usedLabel` (or the unavailable state), even
though the cell keeps its metric kind. All three periods are always present; there is no period
selector state.

The heading and row count remain visible when `rows` is empty; the table body switches to
`labels.emptyStateLabel`. Pass `emptyStateIconSize` (default `48`) to resize the empty-state icon.

## Utilities

Three pure transform functions map raw `UserLimitStatsResponseDto` data (from `@epam/ai-dial-chat-api-client`) into the props each component consumes. They are host-agnostic: every user-visible string is produced by a caller-supplied `t` function that matches i18next's `TFunction` signature.

### mapUsageDataToDashboard

Maps a `UserLimitStatsResponseDto` into the `cards` array for `UsageLimitCardGroup`, in Today / This week / This month order. A period is omitted when the response carries no usable stat for it.

Requires a host-owned `formatResetTime(resetsAt)` callback, so that all `Date`/`Intl` work stays at the application edge. It receives each period's raw `resetsAt` and returns a `ResetTimeDisplayLike`, or `undefined` when the value is absent, unparseable, or `Intl` is unavailable — in which case the card carries no reset fields.

```tsx
import {
  mapUsageDataToDashboard,
  USAGE_DATA_I18N_KEYS,
  UsageLimitCardGroup,
} from '@epam/ai-dial-usage-dashboard';
import type { UserLimitStatsResponseDto } from '@epam/ai-dial-chat-api-client';

// In your component:
const formatResetTime = useCallback(
  (resetsAt: string | undefined) => formatMyResetTime(resetsAt, activeLocale, t),
  [activeLocale, t],
);

const cards = mapUsageDataToDashboard(usage, t, formatResetTime);
// <UsageLimitCardGroup cards={cards} labels={labels} />
```

Keep `formatResetTime` referentially stable (for example with `useCallback`) — it is a dependency of
the `useMemo` the mapper usually sits behind, so an unstable identity recomputes on every render.

`USAGE_DATA_I18N_KEYS` is a const object of the default i18n key strings this function passes to `t`. Include those keys in your translation bundle.

### mapUserUsageToModelLimits

Maps `usage.deployments` into the `rows` array for `ModelLimitsSection`, joined with display metadata from a list of `DeploymentItemDto`. Only deployments that have nonzero usage in at least one displayed period are included. Requires two host-owned callbacks to stay host-agnostic:

- `resolveIconUrl(iconUrl)` — resolves a deployment's raw `iconUrl` to the URL the avatar should load (typically the app's own icon-proxy endpoint).
- `resolveDisplayName(name, locale)` — resolves a localized-text map or plain string to the display name for the active locale.

Cost and Tokens cells use the same `total >= 2 ** 53` sentinel test. A sentinel Cost `total` produces an `Unlimited` cell showing attributed spend with no cap; a genuinely finite one produces a `Finite` cell whose status folds into the row's overall Status alongside finite Tokens statuses.

```tsx
import {
  mapUserUsageToModelLimits,
  USAGE_MODEL_LIMITS_I18N_KEYS,
  ModelLimitsSection,
} from '@epam/ai-dial-usage-dashboard';

const rows = mapUserUsageToModelLimits(
  usage,
  deploymentItems,
  activeLocale,
  t,
  (iconUrl) => resolveMyIconUrl(iconUrl),
  (name, locale) => resolveLocalizedText(name, locale),
);
// <ModelLimitsSection rows={rows} labels={labels} periodStatuses={periodStatuses} />
```

`USAGE_MODEL_LIMITS_I18N_KEYS` is a const object of the default i18n key strings this function passes to `t`.

### mapOverallCostLimitsToPeriodStatuses

Maps the top-level Cost budget fields from `UserLimitStatsResponseDto` (the same source `mapUsageDataToDashboard` uses for the aggregate cards) into the `periodStatuses` prop for `ModelLimitsSection`. Produces a `{ status, tooltipLabel? }` entry keyed `day`, `week`, and `month`.

Pass the same `formatResetTime` callback used for the aggregate cards as an optional fourth argument to add each header's reset trio, read from the same top-level `*CostStats` stat that drives that header's status. A per-deployment `resetsAt` is never read for a header, and a top-level value is never reconciled against a differing per-deployment one. Omit the argument to produce statuses with no reset fields.

```tsx
import { mapOverallCostLimitsToPeriodStatuses } from '@epam/ai-dial-usage-dashboard';

const periodStatuses = mapOverallCostLimitsToPeriodStatuses(
  usage,
  activeLocale,
  t,
  formatResetTime,
);
// <ModelLimitsSection periodStatuses={periodStatuses} ... />
```

## Types

- `UsageLimitStatus` — `Default | RunningLow | LimitReached`
- `UsageLimitCardData` — `{ title, periodDescription, used, total, usedLabel, totalLabel?, remainingLabel?, isUnlimited?, usedPercent?, status, progressAriaLabel, resetLabel?, resetIsoValue?, resetAriaLabel? }`
- `UsageLimitCardGroupLabels` — `{ defaultBadgeLabel, runningLowBadgeLabel, limitReachedBadgeLabel, usedOfTotalLabel, remainingCaptionLabel, usedPercentLabel }`
- `UsageLimitCardGroupProps` — `{ cards, labels, styles? }`
- `UsageLimitCardProps` — `{ data, labels, styles? }`
- `UsageLimitCardGroupStyles` — `{ colors?, typography? }`
- `UsageLimitCardGroupColors` — CSS-custom-property color overrides
- `UsageLimitCardGroupTypography` — typography class overrides
- `ModelLimitStatus` — `WithinLimits | RunningLow | LimitReached | NoLimit | Unavailable`
- `ModelLimitMetricKind` — `Finite | Unlimited | Unavailable`
- `ModelLimitMetricCell` — `{ kind, usedLabel?, totalLabel?, usedPercent?, status?, supportingLabel?, ariaLabel }`
- `ModelLimitPeriodCell` — `{ tokens: ModelLimitMetricCell, cost: ModelLimitMetricCell }`
- `ModelLimitPeriodStatus` — `{ status, tooltipLabel?, resetLabel?, resetIsoValue?, resetAriaLabel? }`
- `ModelLimitPeriodStatuses` — `{ day, week, month }`
- `ModelLimitRow` — `{ id, name, version?, avatarSrc?, day, week, month, status }`
- `ModelLimitsLabels` — `{ headingLabel, itemColumnLabel, dayColumnLabel, weekColumnLabel, monthColumnLabel, statusColumnLabel, tokensLabel, costLabel, modelTypeLabel, noLimitLabel, unavailableLabel, withinLimitsBadgeLabel, runningLowBadgeLabel, limitReachedBadgeLabel, noLimitBadgeLabel, unavailableBadgeLabel, emptyStateLabel }`
- `ModelLimitsSectionProps` — `{ rows, labels, periodStatuses, styles?, emptyStateIconSize? }`
- `ModelLimitsStyles` — `{ colors?, typography? }`
- `ModelLimitsColors` — CSS-custom-property color overrides
- `ModelLimitsTypography` — typography class overrides
- `ResetTimeDisplayLike` — `{ resetsAtMs, isoValue, label, ariaLabel }`, the structural shape `formatResetTime` returns
- `FormatResetTime` — `(resetsAt: string | undefined) => ResetTimeDisplayLike | undefined`
