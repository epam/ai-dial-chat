import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { UsageSummaryCard } from '../UsageSummaryCard';

const dailyWithin = {
  title: 'Daily limit',
  scope: 'All models',
  used: 1,
  limit: 4,
  resetLabel: 'Resets 00:00 · in 6h 12m',
};

const monthlyWithin = {
  title: 'Monthly limit',
  scope: 'All models',
  used: 41,
  limit: 120,
  resetLabel: 'Resets 1 Aug · in 12 days',
};

describe('UsageSummaryCard', () => {
  it('renders a window within limits without a pill', () => {
    render(<UsageSummaryCard windows={[dailyWithin]} />);
    expect(screen.getByText('Daily limit')).toBeTruthy();
    expect(screen.getByText('$3.00', { exact: false })).toBeTruthy();
    expect(screen.getByText('25% used')).toBeTruthy();
    expect(screen.queryByText('Running low')).toBeNull();
  });

  it('shows the Running low pill once a window crosses the warning threshold', () => {
    render(
      <UsageSummaryCard windows={[{ ...dailyWithin, used: 3.6, limit: 4 }]} />,
    );
    expect(screen.getByText('Running low')).toBeTruthy();
    expect(screen.getByText('90% used')).toBeTruthy();
  });

  it('reads $0.00 left and shows a Limit reached pill once the window is fully used', () => {
    render(
      <UsageSummaryCard windows={[{ ...dailyWithin, used: 4, limit: 4 }]} />,
    );
    expect(screen.getByText('$0.00', { exact: false })).toBeTruthy();
    expect(screen.getByText('100% used')).toBeTruthy();
    expect(screen.getByText('Limit reached')).toBeTruthy();
    expect(screen.queryByText('Running low')).toBeNull();
  });

  it('shows the unlimited heading and hides the meter/pill when there is no limit', () => {
    render(<UsageSummaryCard windows={[{ ...dailyWithin, limit: null }]} />);
    expect(screen.getByText('No limit set')).toBeTruthy();
    expect(screen.queryByRole('progressbar')).toBeNull();
    expect(screen.queryByText('Running low')).toBeNull();
  });

  it('always shows the reset line regardless of state', () => {
    render(<UsageSummaryCard windows={[dailyWithin]} />);
    expect(screen.getByText('Resets 00:00 · in 6h 12m')).toBeTruthy();
  });

  it('renders two windows side by side', () => {
    render(<UsageSummaryCard windows={[dailyWithin, monthlyWithin]} />);
    expect(screen.getByText('Daily limit')).toBeTruthy();
    expect(screen.getByText('Monthly limit')).toBeTruthy();
  });

  it('uses green for a Normal window and the AA-safe dark warning color for a Warning window', () => {
    render(
      <UsageSummaryCard
        windows={[
          { ...dailyWithin, used: 1, limit: 4 },
          { ...monthlyWithin, used: 102, limit: 120 },
        ]}
      />,
    );
    const normalFigure = screen.getByText('$3.00', { exact: false });
    expect(normalFigure.className).toContain('text-accent-secondary');

    // Warning text uses `text-warning` (dark, AA-safe) — never the light decorative
    // orange fill color, which only meets the lower non-text contrast bar.
    const warningFigure = screen.getByText('$18.00', { exact: false });
    expect(warningFigure.className).toContain('text-warning');
    expect(warningFigure.className).not.toContain('text-accent-secondary');
    expect(warningFigure.className).not.toContain('text-error');
  });

  it('uses red for a Blocked window', () => {
    render(
      <UsageSummaryCard windows={[{ ...dailyWithin, used: 4, limit: 4 }]} />,
    );
    const figure = screen.getByText('$0.00', { exact: false });
    expect(figure.className).toContain('text-error');
  });
});
