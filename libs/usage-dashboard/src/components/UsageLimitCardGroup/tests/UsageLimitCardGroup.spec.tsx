import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  UsageLimitCardData,
  UsageLimitCardGroupLabels,
  UsageLimitStatus,
} from '../../../models/usage-limit-card-props';
import { UsageLimitCardGroup } from '../UsageLimitCardGroup';

vi.mock('@epam/ai-dial-ui-kit', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@epam/ai-dial-ui-kit')>();
  return {
    ...actual,
    ProgressBar: ({
      value,
      max,
      'aria-label': ariaLabel,
    }: {
      value: number;
      max?: number;
      'aria-label'?: string;
    }) => (
      <div
        role="progressbar"
        aria-label={ariaLabel}
        aria-valuenow={value}
        aria-valuemax={max}
      />
    ),
  };
});

const labels: UsageLimitCardGroupLabels = {
  defaultBadgeLabel: 'Within limits',
  runningLowBadgeLabel: 'Running low',
  limitReachedBadgeLabel: 'Limit reached',
  usedOfTotalLabel: ({ total }) => `used of ${total}`,
  remainingCaptionLabel: ({ remaining }) => `${remaining} left`,
  usedPercentLabel: ({ percent }) => `${percent}%`,
};

const daily: UsageLimitCardData = {
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
};

const weekly: UsageLimitCardData = {
  title: 'This week',
  periodDescription: 'Last 7 days',
  used: 11.2,
  total: 20,
  usedLabel: '$11.20',
  totalLabel: '$20.00',
  remainingLabel: '$8.80',
  usedPercent: 56,
  status: UsageLimitStatus.Default,
  progressAriaLabel: '$11.20 of $20.00, 56% used',
};

const monthly: UsageLimitCardData = {
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
};

describe('UsageLimitCardGroup', () => {
  it('renders one independent box per card, in order', () => {
    const { container } = render(
      <UsageLimitCardGroup cards={[daily, weekly, monthly]} labels={labels} />,
    );

    expect(screen.getByText('Today')).toBeTruthy();
    expect(screen.getByText('This week')).toBeTruthy();
    expect(screen.getByText('This month')).toBeTruthy();
    // eslint-disable-next-line testing-library/no-node-access
    expect(container.firstElementChild?.children).toHaveLength(3);
  });

  it('renders a single full-width card when only one is provided', () => {
    render(<UsageLimitCardGroup cards={[daily]} labels={labels} />);

    expect(screen.getByText('Today')).toBeTruthy();
    expect(screen.queryByText('This week')).toBeNull();
    expect(screen.queryByText('This month')).toBeNull();
  });

  it('renders nothing when no cards are provided', () => {
    const { container } = render(
      <UsageLimitCardGroup cards={[]} labels={labels} />,
    );

    // Component renders null; no semantic query can assert total absence of output.
    // eslint-disable-next-line testing-library/no-node-access
    expect(container.firstChild).toBeNull();
  });

  it('uses the mobile-first grid classes with a card-count-driven desktop column count', () => {
    const { container } = render(
      <UsageLimitCardGroup cards={[daily, weekly, monthly]} labels={labels} />,
    );

    // eslint-disable-next-line testing-library/no-node-access
    const root = container.firstChild as HTMLElement;
    expect(root.className).toContain('grid-cols-1');
    expect(root.style.getPropertyValue('--uld-card-count')).toBe('3');
  });
});
