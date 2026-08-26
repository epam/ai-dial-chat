# @epam/ai-dial-usage-dashboard

## Overview

Provides `UsageLimitCardGroup` and `UsageLimitCard`, presentational cards for a caller's aggregate
cost-budget usage over a rolling period (e.g. today, this week, this month), and
`ModelLimitsSection`, a presentational per-model comparison table with fixed Last 24 hours, Last 7
days, and Last 30 days columns. Each period groups Tokens usage/progress with a compact attributed
Cost line, and a final Status reflects the host-derived result across model-token and overall Cost
limits in all periods. Overall Cost warning/reached indicators and their tooltips are supplied for
the matching period headers. All components are fully host-agnostic: they take already-normalized,
preformatted amounts, status enums, and localized labels via props — they never interpret raw API
data, format currency, detect the unlimited sentinel, or compute percentages themselves.
`UsageLimitCardGroup` renders each card as its own independent, equally-sized box: stacked on mobile,
side by side on desktop. `UsageLimitCard` is also exported standalone for a single-card use case.

## Installation

```json
{
  "dependencies": {
    "@epam/ai-dial-usage-dashboard": "*"
  }
}
```

## Peer Dependencies

- `react` ^19.2.7
- `@epam/ai-dial-ui-kit`
- `@epam/ai-dial-chat-shared`
- `@tabler/icons-react`

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
      periodDescription: 'Last 24 hours',
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
      periodDescription: 'Last 30 days',
      used: 41,
      total: 120,
      usedLabel: '$41.00',
      totalLabel: '$120.00',
      remainingLabel: '$79.00',
      usedPercent: 34,
      status: UsageLimitStatus.Default,
      progressAriaLabel: '$41.00 of $120.00, 34% used',
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
    periodDescription: 'Last 24 hours',
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
model: Item, Last 24 hours, Last 7 days, Last 30 days, and Status. Every period cell contains Tokens
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
    last24Hours: {
      status: ModelLimitStatus.LimitReached,
      tooltipLabel:
        "Overall last 24 hours cost limit is reached. Models can't be used until it resets, regardless of remaining token limits.",
    },
    last7Days: { status: ModelLimitStatus.WithinLimits },
    last30Days: { status: ModelLimitStatus.WithinLimits },
  }}
  rows={[
    {
      id: 'gpt-4o',
      name: 'GPT-4o',
      version: '2024-08-06',
      avatarSrc: 'https://example.com/gpt-4o.png',
      last24Hours: {
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
      last7Days: {
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
      last30Days: {
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
    last24HoursColumnLabel: 'Last 24 hours',
    last7DaysColumnLabel: 'Last 7 days',
    last30DaysColumnLabel: 'Last 30 days',
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

## Types

- `UsageLimitStatus` — `Default | RunningLow | LimitReached`
- `UsageLimitCardData` — `{ title, periodDescription, used, total, usedLabel, totalLabel?, remainingLabel?, isUnlimited?, usedPercent?, status, progressAriaLabel }`
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
- `ModelLimitPeriodStatus` — `{ status, tooltipLabel? }`
- `ModelLimitPeriodStatuses` — `{ last24Hours, last7Days, last30Days }`
- `ModelLimitRow` — `{ id, name, version?, avatarSrc?, last24Hours, last7Days, last30Days, status }`
- `ModelLimitsLabels` — `{ headingLabel, itemColumnLabel, last24HoursColumnLabel, last7DaysColumnLabel, last30DaysColumnLabel, statusColumnLabel, tokensLabel, costLabel, modelTypeLabel, noLimitLabel, unavailableLabel, withinLimitsBadgeLabel, runningLowBadgeLabel, limitReachedBadgeLabel, noLimitBadgeLabel, unavailableBadgeLabel, emptyStateLabel }`
- `ModelLimitsSectionProps` — `{ rows, labels, periodStatuses, styles?, emptyStateIconSize? }`
- `ModelLimitsStyles` — `{ colors?, typography? }`
- `ModelLimitsColors` — CSS-custom-property color overrides
- `ModelLimitsTypography` — typography class overrides
