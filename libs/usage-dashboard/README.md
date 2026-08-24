# @epam/ai-dial-usage-dashboard

## Overview

Provides `UsageLimitCardGroup` and `UsageLimitCard`, presentational cards for a caller's aggregate
cost-budget usage over a rolling period (e.g. today, this week, this month), and
`ModelLimitsSection`, a presentational per-model table of Cost/Tokens/Requests/Status metrics with
a controlled period selector. All components are fully host-agnostic: they take already-normalized,
preformatted amounts, host-derived status enums, and localized labels via props — they never
interpret raw API data, format currency, detect the unlimited sentinel, or compute percentages
themselves. `UsageLimitCardGroup` renders each card as its own independent, equally-sized box:
stacked on mobile, side by side on desktop. `UsageLimitCard` is also exported standalone for a
single-card use case.

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

Renders a "Model limits" heading (with the rendered row count), a controlled period selector, and
a table of one row per model — model identity (avatar/name/version), Cost/Tokens/Requests cells,
and an overall status badge:

```tsx
import {
  ModelLimitMetricKind,
  ModelLimitsPeriod,
  ModelLimitsSection,
  ModelLimitStatus,
} from '@epam/ai-dial-usage-dashboard';
import { useState } from 'react';

const [period, setPeriod] = useState(ModelLimitsPeriod.Last24Hours);

<ModelLimitsSection
  rows={[
    {
      id: 'gpt-4o',
      name: 'GPT-4o',
      version: '2024-08-06',
      avatarSrc: 'https://example.com/gpt-4o.png',
      cost: {
        kind: ModelLimitMetricKind.Unlimited,
        usedLabel: '$3.20',
        ariaLabel: '$3.20 used, unlimited',
      },
      tokens: {
        kind: ModelLimitMetricKind.Finite,
        usedLabel: '4,000',
        totalLabel: '10,000',
        usedPercent: 40,
        status: ModelLimitStatus.WithinLimits,
        ariaLabel: '4,000 of 10,000, 40% used',
      },
      requests: {
        kind: ModelLimitMetricKind.Unavailable,
        ariaLabel: 'Not available',
      },
      status: ModelLimitStatus.WithinLimits,
    },
  ]}
  period={period}
  onPeriodChange={setPeriod}
  labels={{
    headingLabel: 'Model limits',
    periodLabels: {
      [ModelLimitsPeriod.LastMinute]: 'Last minute',
      [ModelLimitsPeriod.LastHour]: 'Last hour',
      [ModelLimitsPeriod.Last24Hours]: 'Last 24 hours',
      [ModelLimitsPeriod.Last7Days]: 'Last 7 days',
      [ModelLimitsPeriod.Last30Days]: 'Last 30 days',
    },
    periodSelectorAriaLabel: 'Select usage period',
    itemColumnLabel: 'Item',
    costColumnLabel: 'Cost',
    tokensColumnLabel: 'Tokens',
    requestsColumnLabel: 'Requests',
    statusColumnLabel: 'Status',
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

`ModelLimitsSection` is fully controlled: it never manages the selected period itself, never
refetches anything, and never infers the unlimited sentinel or a metric's status — the host derives
`kind`, `usedPercent`, and `status` for every cell and `status` for the row.

The heading and period selector always render, even when `rows` is empty — only the table body
switches to an empty-state message (`labels.emptyStateLabel`), so the host can still change the
selected period from an empty result. Pass `emptyStateIconSize` (default `48`) to resize the
empty-state icon.

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
- `ModelLimitsPeriod` — `LastMinute | LastHour | Last24Hours | Last7Days | Last30Days`
- `ModelLimitMetricKind` — `Finite | Unlimited | Unavailable`
- `ModelLimitMetricCell` — `{ kind, usedLabel?, totalLabel?, usedPercent?, status?, ariaLabel }`
- `ModelLimitRow` — `{ id, name, version?, avatarSrc?, cost, tokens, requests, status }`
- `ModelLimitsLabels` — `{ headingLabel, periodLabels, periodSelectorAriaLabel, itemColumnLabel, costColumnLabel, tokensColumnLabel, requestsColumnLabel, statusColumnLabel, modelTypeLabel, noLimitLabel, unavailableLabel, withinLimitsBadgeLabel, runningLowBadgeLabel, limitReachedBadgeLabel, noLimitBadgeLabel, unavailableBadgeLabel, emptyStateLabel }`
- `ModelLimitsSectionProps` — `{ rows, period, onPeriodChange, labels, styles?, emptyStateIconSize? }`
- `ModelLimitsStyles` — `{ colors?, typography? }`
- `ModelLimitsColors` — CSS-custom-property color overrides
- `ModelLimitsTypography` — typography class overrides
