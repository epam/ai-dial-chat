import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  UsageLimitCardData,
  UsageLimitCardGroupLabels,
  UsageLimitStatus,
} from '../../../models/usage-limit-card-props';
import { UsageLimitCard } from '../UsageLimitCard';
import styles from '../UsageLimitCard.module.scss';

vi.mock('@epam/ai-dial-ui-kit', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@epam/ai-dial-ui-kit')>();
  return {
    ...actual,
    ProgressBar: ({
      value,
      max,
      className,
      'aria-label': ariaLabel,
      'aria-valuetext': ariaValueText,
    }: {
      value: number;
      max?: number;
      className?: string;
      'aria-label'?: string;
      'aria-valuetext'?: string;
    }) => (
      <div
        role="progressbar"
        className={className}
        aria-label={ariaLabel}
        aria-valuenow={value}
        aria-valuemax={max}
        aria-valuetext={ariaValueText}
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

const baseData: UsageLimitCardData = {
  title: 'Today',
  periodDescription: 'Last 24 hours',
  used: 0.4,
  total: 4,
  usedLabel: '$0.40',
  totalLabel: '$4.00',
  remainingLabel: '$3.60',
  usedPercent: 10,
  status: UsageLimitStatus.Default,
  progressAriaLabel: '$0.40 of $4.00, 10% used',
};

const renderCard = (data: Partial<UsageLimitCardData> = {}) =>
  render(<UsageLimitCard data={{ ...baseData, ...data }} labels={labels} />);

describe('UsageLimitCard', () => {
  it('renders the title and the prominent used amount with its "used of" caption', () => {
    renderCard();

    expect(screen.getByText('Today')).toBeTruthy();
    expect(screen.getByText('$0.40')).toBeTruthy();
    expect(screen.getByText('used of $4.00')).toBeTruthy();
  });

  it('renders the "within limits" badge for the default status', () => {
    renderCard({ status: UsageLimitStatus.Default });

    expect(screen.getByText('Within limits')).toBeTruthy();
  });

  it('renders the running-low badge and warning accent at 90% used', () => {
    renderCard({ status: UsageLimitStatus.RunningLow, usedPercent: 90 });

    expect(screen.getByText('Running low')).toBeTruthy();
    const progress = screen.getByRole('progressbar');
    expect(progress.className).toContain(styles.progressFillWarning);
  });

  it('renders the limit-reached badge and error accent at 100% used', () => {
    renderCard({ status: UsageLimitStatus.LimitReached, usedPercent: 100 });

    expect(screen.getByText('Limit reached')).toBeTruthy();
    const progress = screen.getByRole('progressbar');
    expect(progress.className).toContain(styles.progressFillDanger);
  });

  it('renders the remaining-amount and used-percent captions below the progress bar', () => {
    renderCard();

    expect(screen.getByText('$3.60 left')).toBeTruthy();
    expect(screen.getByText('10%')).toBeTruthy();
  });

  it('shows only the used amount, with no progress bar, ratio, or badge, when unlimited', () => {
    renderCard({
      isUnlimited: true,
      totalLabel: undefined,
      remainingLabel: undefined,
      usedPercent: undefined,
      status: UsageLimitStatus.Default,
    });

    expect(screen.getByText('$0.40')).toBeTruthy();
    expect(screen.queryByRole('progressbar')).toBeNull();
    expect(screen.queryByText('used of $4.00')).toBeNull();
    expect(screen.getByText('Within limits')).toBeTruthy();
  });

  it('clamps the visual progress fill and the visible percent label at 100%, while the accessible value text keeps the real percentage', () => {
    renderCard({
      status: UsageLimitStatus.LimitReached,
      usedPercent: 137,
      progressAriaLabel: '$5.48 of $4.00, 137% used',
    });

    const progress = screen.getByRole('progressbar');
    expect(progress.getAttribute('aria-valuenow')).toBe('100');
    expect(progress.getAttribute('aria-valuetext')).toBe(
      '$5.48 of $4.00, 137% used',
    );
    expect(screen.getByText('100%')).toBeTruthy();
    expect(screen.queryByText('137%')).toBeNull();
  });

  it('names the progress bar after the card title', () => {
    renderCard();

    expect(screen.getByRole('progressbar', { name: 'Today' })).toBeTruthy();
  });

  it('renders long localized labels without breaking the layout query', () => {
    const longRunningLowLabel =
      'You are running critically low on your allotted budget for this period';
    render(
      <UsageLimitCard
        data={{ ...baseData, status: UsageLimitStatus.RunningLow }}
        labels={{ ...labels, runningLowBadgeLabel: longRunningLowLabel }}
      />,
    );

    expect(screen.getByText(longRunningLowLabel)).toBeTruthy();
  });

  it('exposes the card as an accessible group named with the title and period description', () => {
    renderCard();

    expect(
      screen.getByRole('group', { name: 'Today, Last 24 hours' }),
    ).toBeTruthy();
  });

  it('keeps the same accessible name and value text under an RTL ancestor', () => {
    render(
      <div dir="rtl">
        <UsageLimitCard data={baseData} labels={labels} />
      </div>,
    );

    expect(screen.getByRole('progressbar', { name: 'Today' })).toBeTruthy();
    expect(screen.getByText('$0.40')).toBeTruthy();
  });
});
