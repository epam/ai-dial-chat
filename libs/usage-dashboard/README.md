# @epam/ai-dial-usage-dashboard

## Overview

Provides `UsageLimitCardGroup` and `UsageLimitCard`, presentational cards for a caller's aggregate
cost-budget usage over a rolling period (e.g. today, this week, this month). The components are
fully host-agnostic: they take already-normalized, preformatted amounts, a derived
`UsageLimitStatus`, and localized labels via props — they never interpret raw API data, format
currency, or compute percentages themselves. `UsageLimitCardGroup` renders each card as its own
independent, equally-sized box: stacked on mobile, side by side on desktop. `UsageLimitCard` is
also exported standalone for a single-card use case.

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
/>;
```

### UsageLimitCard

Renders a single card:

```tsx
import { UsageLimitCard, UsageLimitStatus } from '@epam/ai-dial-usage-dashboard';

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

## Types

- `UsageLimitStatus` — `Default | RunningLow | LimitReached`
- `UsageLimitCardData` — `{ title, periodDescription, used, total, usedLabel, totalLabel?, remainingLabel?, isUnlimited?, usedPercent?, status, progressAriaLabel }`
- `UsageLimitCardGroupLabels` — `{ defaultBadgeLabel, runningLowBadgeLabel, limitReachedBadgeLabel, usedOfTotalLabel, remainingCaptionLabel, usedPercentLabel }`
- `UsageLimitCardGroupProps` — `{ cards, labels, styles? }`
- `UsageLimitCardProps` — `{ data, labels, styles? }`
- `UsageLimitCardGroupStyles` — `{ colors?, typography? }`
- `UsageLimitCardGroupColors` — CSS-custom-property color overrides
- `UsageLimitCardGroupTypography` — typography class overrides
